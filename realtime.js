/* X-Burguer Caixa — sincronização em tempo real resiliente v4.18.3 */
let realtimeClient=null;
let realtimeChannel=null;
let realtimeUserId=null;
let realtimeToken=null;
let realtimeReloadTimer=null;
let realtimeReconnectTimer=null;
let realtimeStartPromise=null;
let realtimeState='idle';
let realtimeStopping=false;
let realtimeRetryCount=0;

const realtimeDisabled=()=>window.__XB_E2E__===true;

function realtimeStatus(text,state='online'){
  if(typeof setCloudStatus==='function')setCloudStatus(text,state);
}

function applyAutomaticSyncUI(){
  const topSync=document.getElementById('syncBtn');
  if(topSync)topSync.style.display='none';

  const backupSync=document.getElementById('syncBackupBtn');
  if(backupSync){
    backupSync.style.display='none';
    const card=backupSync.closest('.backup-card');
    if(card){
      const title=card.querySelector('h3');
      const text=card.querySelector('p');
      if(title)title.textContent='Sincronização automática';
      if(text)text.textContent='Os fechamentos são atualizados automaticamente em tempo real entre os aparelhos conectados.';
    }
  }

  const info=document.getElementById('syncInfo');
  if(info)info.textContent=realtimeDisabled()?'Ambiente de teste isolado':(navigator.onLine?'Conectando ao tempo real...':'Sem internet • rascunho local disponível');
}

applyAutomaticSyncUI();

async function stopRealtimeSync(){
  clearTimeout(realtimeReloadTimer);
  clearTimeout(realtimeReconnectTimer);
  realtimeReloadTimer=null;
  realtimeReconnectTimer=null;
  realtimeStopping=true;

  const client=realtimeClient;
  const channel=realtimeChannel;
  realtimeChannel=null;
  realtimeClient=null;
  realtimeUserId=null;
  realtimeToken=null;
  realtimeState='idle';

  if(client&&channel){
    try{await client.removeChannel(channel)}catch{}
  }
  realtimeStopping=false;
}

function nextReconnectDelay(){
  return Math.min(60000,5000*Math.pow(2,Math.min(realtimeRetryCount,4)));
}

function scheduleRealtimeRestart(delay=null){
  if(realtimeDisabled()||realtimeReconnectTimer||!authSession?.access_token||!currentUser?.id||!navigator.onLine)return;
  const wait=delay===null?nextReconnectDelay():Math.max(0,delay);
  realtimeReconnectTimer=setTimeout(()=>{
    realtimeReconnectTimer=null;
    if(realtimeDisabled())return;
    realtimeRetryCount++;
    startRealtimeSync(true).catch(()=>scheduleRealtimeRestart());
  },wait);
}

function scheduleRealtimeReload(){
  clearTimeout(realtimeReloadTimer);
  if(realtimeDisabled()||!navigator.onLine)return;
  realtimeReloadTimer=setTimeout(async()=>{
    realtimeReloadTimer=null;
    if(realtimeDisabled()||!authSession?.access_token||!navigator.onLine)return;
    if(saveInProgress||deleteInProgress||manualSyncInProgress){
      scheduleRealtimeReload();
      return;
    }
    try{
      await loadCloudData();
      if(!formDirty){
        const date=activeClosingDate||$('date')?.value||isoToday();
        loadBestRecordForDate(date,{notify:false});
      }
      refreshAll();
      realtimeStatus('● Nuvem • tempo real','online');
      const info=document.getElementById('syncInfo');
      if(info)info.textContent=formDirty?'Tempo real ativo • rascunho local preservado':'Tempo real ativo';
    }catch{
      realtimeStatus(navigator.onLine?'● Nuvem • reconectando...':'● Sem internet',navigator.onLine?'syncing':'error');
      if(navigator.onLine)scheduleRealtimeRestart();
    }
  },650);
}

async function startRealtimeSync(force=false){
  if(realtimeDisabled())return false;
  if(realtimeStartPromise)return realtimeStartPromise;

  realtimeStartPromise=(async()=>{
    if(realtimeDisabled())return false;
    if(!navigator.onLine){
      realtimeState='idle';
      realtimeStatus('● Sem internet','error');
      const info=document.getElementById('syncInfo');
      if(info)info.textContent='Sem internet • sincronização retomará automaticamente';
      return false;
    }
    if(!authSession?.access_token||!currentUser?.id||!window.supabase?.createClient)return false;

    if(realtimeChannel&&realtimeUserId===currentUser.id&&!force){
      if(realtimeToken!==authSession.access_token){
        realtimeToken=authSession.access_token;
        try{realtimeClient?.realtime?.setAuth(realtimeToken)}catch{}
      }
      return true;
    }

    if(force||realtimeChannel)await stopRealtimeSync();
    if(realtimeDisabled()||!navigator.onLine||!authSession?.access_token||!currentUser?.id)return false;

    realtimeUserId=currentUser.id;
    realtimeToken=authSession.access_token;
    realtimeState='connecting';
    realtimeStatus('● Nuvem • conectando...','syncing');

    const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      realtime:{params:{eventsPerSecond:2}}
    });
    client.realtime.setAuth(realtimeToken);
    realtimeClient=client;

    const channel=client
      .channel('xburguer-caixa-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'cash_closings'},()=>scheduleRealtimeReload());
    realtimeChannel=channel;

    channel.subscribe(status=>{
      if(channel!==realtimeChannel||realtimeDisabled())return;

      if(status==='SUBSCRIBED'){
        realtimeState='ready';
        realtimeRetryCount=0;
        clearTimeout(realtimeReconnectTimer);
        realtimeReconnectTimer=null;
        realtimeStatus('● Nuvem • tempo real','online');
        const info=document.getElementById('syncInfo');
        if(info)info.textContent='Tempo real ativo';
        return;
      }

      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        realtimeState='error';
        realtimeStatus(navigator.onLine?'● Nuvem • reconectando...':'● Sem internet',navigator.onLine?'syncing':'error');
        const info=document.getElementById('syncInfo');
        if(info)info.textContent=navigator.onLine?'Reconectando automaticamente...':'Sem internet • aguardando conexão';
        if(navigator.onLine)scheduleRealtimeRestart();
        return;
      }

      if(status==='CLOSED'&&!realtimeStopping){
        realtimeState='error';
        if(authSession?.access_token&&navigator.onLine){
          realtimeStatus('● Nuvem • reconectando...','syncing');
          scheduleRealtimeRestart();
        }
      }
    });

    return true;
  })();

  try{return await realtimeStartPromise}
  finally{realtimeStartPromise=null}
}

/* Verificação leve. O próprio cliente Realtime tenta recuperar a conexão;
   esta rotina só recria o canal quando ele realmente ficou indisponível. */
setInterval(()=>{
  if(realtimeDisabled()||!navigator.onLine)return;
  if(authSession?.access_token&&currentUser?.id){
    if(!realtimeChannel||realtimeState==='idle')startRealtimeSync(false).catch(()=>{});
    else if(realtimeState==='error')scheduleRealtimeRestart();
    else if(realtimeToken!==authSession.access_token)startRealtimeSync(false).catch(()=>{});
  }else if(realtimeChannel){
    stopRealtimeSync().catch(()=>{});
  }
},30000);

document.addEventListener('visibilitychange',()=>{
  if(realtimeDisabled()||document.visibilityState!=='visible'||!navigator.onLine||!authSession?.access_token)return;
  startRealtimeSync(false).then(async()=>{
    try{
      await loadCloudData();
      if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date')?.value||isoToday(),{notify:false});
      refreshAll();
      if(realtimeState==='ready')realtimeStatus('● Nuvem • tempo real','online');
    }catch{}
  }).catch(()=>{});
});

window.addEventListener('online',()=>{
  if(realtimeDisabled())return;
  realtimeRetryCount=0;
  if(authSession?.access_token)startRealtimeSync(true).catch(()=>scheduleRealtimeRestart());
});

window.addEventListener('offline',()=>{
  realtimeState='idle';
  clearTimeout(realtimeReconnectTimer);
  clearTimeout(realtimeReloadTimer);
  realtimeReconnectTimer=null;
  realtimeReloadTimer=null;
  if(realtimeDisabled())return;
  realtimeStatus('● Sem internet','error');
  const info=document.getElementById('syncInfo');
  if(info)info.textContent='Sem internet • sincronização retomará automaticamente';
  if(realtimeChannel)stopRealtimeSync().catch(()=>{});
});

const realtimeLogoutBtn=document.getElementById('logoutBtn');
if(realtimeLogoutBtn)realtimeLogoutBtn.addEventListener('click',()=>{stopRealtimeSync().catch(()=>{})});
