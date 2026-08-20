let realtimeClient=null;
let realtimeChannel=null;
let realtimeUserId=null;
let realtimeToken=null;
let realtimeReloadTimer=null;
let realtimeStartTimer=null;

function realtimeStatus(text,state='online'){
  if(typeof setCloudStatus==='function')setCloudStatus(text,state);
}

async function stopRealtimeSync(){
  clearTimeout(realtimeReloadTimer);
  clearTimeout(realtimeStartTimer);
  if(realtimeClient&&realtimeChannel){
    try{await realtimeClient.removeChannel(realtimeChannel)}catch{}
  }
  realtimeChannel=null;
  realtimeClient=null;
  realtimeUserId=null;
  realtimeToken=null;
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
    }catch(err){
      realtimeStatus(navigator.onLine?'● Nuvem • reconectando...':'● Sem internet',navigator.onLine?'syncing':'error');
    }
  },450);
}

async function startRealtimeSync(){
  if(!authSession?.access_token||!currentUser?.id)return false;
  if(!window.supabase?.createClient)return false;

  if(realtimeChannel&&realtimeUserId===currentUser.id){
    if(realtimeToken!==authSession.access_token){
      realtimeToken=authSession.access_token;
      try{realtimeClient.realtime.setAuth(realtimeToken)}catch{}
    }
    return true;
  }

  await stopRealtimeSync();
  realtimeUserId=currentUser.id;
  realtimeToken=authSession.access_token;

  realtimeClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    realtime:{params:{eventsPerSecond:2}}
  });
  realtimeClient.realtime.setAuth(realtimeToken);

  realtimeChannel=realtimeClient
    .channel('xburguer-caixa-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'cash_closings'},()=>scheduleRealtimeReload())
    .subscribe(status=>{
      if(status==='SUBSCRIBED')realtimeStatus('● Nuvem • tempo real','online');
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')realtimeStatus('● Nuvem • reconectando...','syncing');
      else if(status==='CLOSED'&&authSession)realtimeStatus('● Nuvem • reconectando...','syncing');
    });

  return true;
}

setInterval(()=>{
  if(authSession?.access_token&&currentUser?.id){
    startRealtimeSync().catch(()=>{});
  }else if(realtimeChannel){
    stopRealtimeSync().catch(()=>{});
  }
},1500);

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!authSession?.access_token)return;
  startRealtimeSync().then(async()=>{
    try{
      await loadCloudData();
      if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date')?.value||isoToday(),{notify:false});
      refreshAll();
      realtimeStatus('● Nuvem • tempo real','online');
    }catch{}
  }).catch(()=>{});
});

window.addEventListener('online',()=>{
  if(authSession?.access_token)startRealtimeSync().catch(()=>{});
});
