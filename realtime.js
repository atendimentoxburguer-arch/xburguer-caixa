/* X-Burguer Caixa — sincronização em tempo real resiliente v4.14.0 */
let realtimeClient=null;
let realtimeChannel=null;
let realtimeUserId=null;
let realtimeToken=null;
let realtimeReloadTimer=null;
let realtimeReconnectTimer=null;
let realtimeState='idle';
let realtimeStopping=false;

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
  if(info)info.textContent='Conectando ao tempo real...';
}

applyAutomaticSyncUI();

async function stopRealtimeSync(){
  clearTimeout(realtimeReloadTimer);
  clearTimeout(realtimeReconnectTimer);
  realtimeStopping=true;
  const client=realtimeClient,channel=realtimeChannel;
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

function scheduleRealtimeRestart(delay=1800){
  clearTimeout(realtimeReconnectTimer);
  if(!authSession?.access_token||!currentUser?.id||!navigator.onLine)return;
  realtimeReconnectTimer=setTimeout(()=>{
    startRealtimeSync(true).catch(()=>{});
  },delay);
}

function scheduleRealtimeReload(){
  clearTimeout(realtimeReloadTimer);
  realtimeReloadTimer=setTimeout(async()=>{
    if(!authSession?.access_token)return;
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
      if(!document.hidden)toast(formDirty?'Dados da nuvem atualizados. Seu rascunho foi preservado.':'Dados atualizados automaticamente.');
    }catch{
      realtimeStatus(navigator.onLine?'● Nuvem • reconectando...':'● Sem internet',navigator.onLine?'syncing':'error');
      if(navigator.onLine)scheduleRealtimeRestart();
    }
  },450);
}

async function startRealtimeSync(force=false){
  if(!authSession?.access_token||!currentUser?.id)return false;
  if(!window.supabase?.createClient)return false;

  if(!force&&realtimeChannel&&realtimeUserId===currentUser.id&&(realtimeState==='connecting'||realtimeState==='ready')){
    if(realtimeToken!==authSession.access_token){
      realtimeToken=authSession.access_token;
      try{realtimeClient?.realtime?.setAuth(realtimeToken)}catch{}
    }
    return true;
  }

  await stopRealtimeSync();
  if(!authSession?.access_token||!currentUser?.id)return false;

  realtimeUserId=currentUser.id;
  realtimeToken=authSession.access_token;
  realtimeState='connecting';
  realtimeStatus('● Nuvem • conectando...','syncing');

  realtimeClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    realtime:{params:{eventsPerSecond:2}}
  });
  realtimeClient.realtime.setAuth(realtimeToken);

  realtimeChannel=realtimeClient
    .channel('xburguer-caixa-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'cash_closings'},()=>scheduleRealtimeReload())
    .subscribe(status=>{
      if(status==='SUBSCRIBED'){
        realtimeState='ready';
        clearTimeout(realtimeReconnectTimer);
        realtimeStatus('● Nuvem • tempo real','online');
        const info=document.getElementById('syncInfo');
        if(info)info.textContent='Tempo real ativo';
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        realtimeState='error';
        realtimeStatus('● Nuvem • reconectando...','syncing');
        const info=document.getElementById('syncInfo');
        if(info)info.textContent='Reconectando automaticamente...';
        scheduleRealtimeRestart();
      }else if(status==='CLOSED'&&!realtimeStopping){
        realtimeState='error';
        if(authSession){
          realtimeStatus('● Nuvem • reconectando...','syncing');
          scheduleRealtimeRestart();
        }
      }
    });

  return true;
}

setInterval(()=>{
  if(authSession?.access_token&&currentUser?.id){
    if(!realtimeChannel||realtimeState==='error'||realtimeState==='idle')startRealtimeSync(realtimeState==='error').catch(()=>{});
    else if(realtimeToken!==authSession.access_token)startRealtimeSync(false).catch(()=>{});
  }else if(realtimeChannel){
    stopRealtimeSync().catch(()=>{});
  }
},2500);

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!authSession?.access_token)return;
  startRealtimeSync(realtimeState==='error').then(async()=>{
    try{
      await loadCloudData();
      if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date')?.value||isoToday(),{notify:false});
      refreshAll();
      if(realtimeState==='ready')realtimeStatus('● Nuvem • tempo real','online');
    }catch{}
  }).catch(()=>{});
});

window.addEventListener('online',()=>{
  if(authSession?.access_token)startRealtimeSync(true).catch(()=>{});
});

window.addEventListener('offline',()=>{
  realtimeState='error';
  clearTimeout(realtimeReconnectTimer);
});

const realtimeLogoutBtn=document.getElementById('logoutBtn');
if(realtimeLogoutBtn)realtimeLogoutBtn.addEventListener('click',()=>{stopRealtimeSync().catch(()=>{})});
