/* X-Burguer Caixa — adaptador E2E local.
   Só ativa em localhost/127.0.0.1 com ?e2e=1. Nunca toca no Supabase real. */
(function(){
  'use strict';
  const localHost=location.hostname==='127.0.0.1'||location.hostname==='localhost';
  const enabled=localHost&&new URLSearchParams(location.search).get('e2e')==='1';
  if(!enabled)return;

  window.__XB_E2E__=true;
  const DATA_KEY='xb_e2e_cloud_records_v1';
  const rules=window.XBBusinessRules;
  const originalFetch=window.fetch.bind(window);

  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input?.url||'';
    let url;
    try{url=new URL(raw,location.href)}catch{return originalFetch(input,init)}
    if(url.hostname==='trnngxezppeembrvxkhh.supabase.co'){
      return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    }
    return originalFetch(input,init);
  };

  function readRecords(){
    try{
      const rows=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');
      return Array.isArray(rows)?rows:[];
    }catch{return []}
  }
  function writeRecords(rows){
    localStorage.setItem(DATA_KEY,JSON.stringify(rows));
  }
  function upsertRecord(record){
    const rows=readRecords();
    const normalized=rules?.normalizeRecord?rules.normalizeRecord(record,{cashCountVerified:record.cashCountVerified}):record;
    const saved={...normalized,_id:record._id||`e2e-${record.date}`,savedAt:new Date().toISOString()};
    const index=rows.findIndex(item=>item.date===saved.date);
    if(index>=0)rows[index]=saved;else rows.push(saved);
    rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    writeRecords(rows);
    return saved;
  }

  loginCloud=async function(email,password,remember){
    if(!String(password||'').trim())throw new Error('Informe a senha de teste.');
    authSession={
      access_token:'e2e-access-token',
      refresh_token:'e2e-refresh-token',
      token_type:'bearer',
      expires_at:Math.floor(Date.now()/1000)+86400,
      user:{id:'00000000-0000-0000-0000-000000000001',email}
    };
    currentUser=authSession.user;
    currentProfile={full_name:'Teste Automatizado',role:'manager',active:true};
    if(document.getElementById('userName'))document.getElementById('userName').textContent='Teste Automatizado';
    if(document.getElementById('userRole'))document.getElementById('userRole').textContent='Gerente • E2E';
    persistSession(authSession,remember);
    await loadCloudData();
  };

  loadProfile=async function(){
    currentProfile={full_name:'Teste Automatizado',role:'manager',active:true};
    if(document.getElementById('userName'))document.getElementById('userName').textContent='Teste Automatizado';
    if(document.getElementById('userRole'))document.getElementById('userRole').textContent='Gerente • E2E';
    return currentProfile;
  };

  refreshAuthSession=async function(remember=true){
    if(!authSession)throw new Error('Sessão E2E ausente.');
    authSession.expires_at=Math.floor(Date.now()/1000)+86400;
    persistSession(authSession,remember);
    return authSession;
  };

  loadCloudData=async function(){
    cloudData=readRecords().map(record=>rules?.normalizeRecord?rules.normalizeRecord(record,{cashCountVerified:record.cashCountVerified}):record);
    lastSyncAt=new Date();
    setCloudStatus('● Banco de teste local','online');
    updateSyncUi();
    return cloudData;
  };

  saveRecordCloud=async function(record){
    const saved=upsertRecord(record);
    cloudData=readRecords();
    return saved._id;
  };

  sbRest=async function(path,options={}){
    const method=String(options.method||'GET').toUpperCase();
    if(String(path).startsWith('cash_closings?')&&method==='DELETE'){
      const match=String(path).match(/id=eq\.([^&]+)/);
      const id=match?decodeURIComponent(match[1]):'';
      writeRecords(readRecords().filter(item=>item._id!==id));
      cloudData=readRecords();
      return null;
    }
    if(String(path).startsWith('rpc/restore_cash_backup')){
      const payload=typeof options.body==='string'?JSON.parse(options.body):options.body||{};
      const records=Array.isArray(payload.p_records)?payload.p_records:[];
      records.forEach(upsertRecord);
      cloudData=readRecords();
      return {restored:records.length};
    }
    if(String(path).startsWith('profiles?'))return [{full_name:'Teste Automatizado',role:'manager',active:true}];
    if(String(path).startsWith('backup_exports?'))return [];
    if(String(path).startsWith('cash_backup_snapshots?'))return [];
    if(String(path).startsWith('rpc/create_cash_snapshot'))return {snapshot_day:new Date().toISOString().slice(0,10),record_count:readRecords().length};
    return [];
  };

  async function sha256Hex(text){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  exportJSON=async function(){
    const records=readRecords();
    const checksum=await sha256Hex(JSON.stringify(records));
    const envelope={
      format:'xburguer-caixa-backup-v2',
      version:'4.18.2',
      exportedAt:new Date().toISOString(),
      recordCount:records.length,
      integrity:{algorithm:'SHA-256',scope:'records-json',checksum},
      records
    };
    download(`xburguer-caixa-e2e-${isoToday()}.json`,JSON.stringify(envelope,null,2),'application/json');
    localStorage.setItem(BACKUP_KEY,new Date().toLocaleString('pt-BR'));
    try{refreshBackup()}catch{}
    toast('Backup E2E protegido exportado.');
  };

  window.XBE2E={
    enabled:true,
    reset(){
      localStorage.removeItem(DATA_KEY);
      clearStoredSessions();
      cloudData=[];
    },
    records:readRecords
  };

  setTimeout(()=>{
    try{startRealtimeSync=async()=>null}catch{}
    try{window.startRealtimeSync=async()=>null}catch{}
    window.__XB_E2E_READY__=true;
  },0);
})();
