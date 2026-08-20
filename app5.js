async function importJSON(){
  const file=$('importFile').files[0];
  if(!file)return toast('Selecione um arquivo JSON.','error');
  let imported=0,total=0;
  try{
    const raw=JSON.parse(await file.text()),records=Array.isArray(raw)?raw:raw.records;
    const backupValid=validateBackupRecords(records);
    if(backupValid!==true)throw new Error(backupValid);
    total=records.length;
    const importOk=await openConfirmModal({title:'Importar backup',message:`Importar ${records.length} registros para o banco na nuvem?`,note:'Registros com a mesma data serão substituídos ou atualizados.',confirmText:'Importar agora',badge:'Importação'});
    if(!importOk)return;
    $('importBtn').disabled=true;setCloudStatus('● Importando...','syncing');
    for(const rec of records){
      await saveRecordCloud(normalize(rec));
      imported++;
      $('importBtn').textContent=`Importando ${imported}/${total}`;
    }
    await loadCloudData();
    if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date').value||isoToday(),{notify:false});
    refreshAll();
    $('importFile').value='';
    toast('Backup importado para a nuvem com sucesso!');
  }catch(err){
    if(imported>0){
      try{await loadCloudData();refreshAll()}catch{}
      toast(`Importação interrompida após ${imported} de ${total} registros. ${err.message||''}`.trim(),'error');
    }else{
      setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
      toast(err.message||'Arquivo de backup inválido.','error');
    }
  }finally{
    $('importBtn').disabled=false;
    $('importBtn').textContent='Restaurar arquivo';
  }
}

function showApp(){
  const screen=$('loginScreen');
  document.body.classList.remove('app-reveal');
  void document.body.offsetWidth;
  document.body.classList.add('app-reveal');
  screen.classList.add('leaving');
  setTimeout(()=>screen.classList.add('hidden'),390);
}

async function logout(){
  if(formDirty)flushDraft(activeClosingDate);
  try{
    if(authSession?.access_token){
      await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`,{
        method:'POST',
        headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${authSession.access_token}`}
      },6000);
    }
  }catch{}
  authSession=null;currentUser=null;currentProfile=null;cloudData=[];
  document.body.classList.remove('app-reveal');
  clearStoredSessions();
  $('loginScreen').classList.remove('hidden','leaving');
  $('loginPass').value='';
  $('userName').textContent='Usuário';$('userRole').textContent='Desconectado';
  setCloudStatus('● Desconectado','error');
  closeMenu();
}

async function bootstrapCloud(){
  setReportMode('daily',false);
  const stored=readStoredSession();
  if(!stored){
    setCloudStatus('● Aguardando login','syncing');
    refreshAll();
    return;
  }
  try{
    authSession=stored.session;currentUser=authSession.user;
    if(Number(authSession.expires_at||0)<Math.floor(Date.now()/1000)+60)await refreshAuthSession(stored.remember);
    currentUser=authSession.user;
    await loadProfile();
    await loadCloudData();
    restoreInitialClosing();
    refreshAll();
    showApp();
  }catch(err){
    clearStoredSessions();authSession=null;currentUser=null;currentProfile=null;cloudData=[];
    setCloudStatus('● Faça login','error');
    toast(err?.message||'Não foi possível restaurar a sessão. Entre novamente.','error');
    refreshAll();
  }
}

makeChannels();makeExpenses(14);
$('date').value=isoToday();activeClosingDate=isoToday();$('monthPicker').value=monthNow();$('dailyReportDate').value=isoToday();$('historyMonth').value=monthNow();
$('todayLabel').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
document.querySelectorAll('#fechamento input,#fechamento textarea').forEach(el=>{if(el.id!=='date'&&!el.id.startsWith('ed')&&!el.id.startsWith('ev')&&!el.id.startsWith('q')&&!el.id.startsWith('v'))el.addEventListener('input',onFormInput)});
$('date').addEventListener('change',handleClosingDateChange);
document.querySelectorAll('.nav button').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.page)));
$('saveTopBtn').addEventListener('click',saveDay);
$('saveBottomBtn').addEventListener('click',saveDay);
$('addExpenseBtn').addEventListener('click',()=>addExpenseRow());
$('clearFormBtn').addEventListener('click',async()=>{const ok=await openConfirmModal({title:'Limpar formulário',message:'Deseja apagar os dados preenchidos na tela desta data?',note:'Isso apaga o rascunho local, mas NÃO exclui um fechamento já salvo na nuvem.',confirmText:'Limpar agora',badge:'Limpeza'});if(ok){clearForm(true);toast('Formulário e rascunho desta data foram limpos.')}});
$('loadTodayBtn').addEventListener('click',()=>{const date=$('date').value||activeClosingDate;const result=loadBestRecordForDate(date,{notify:false});if(result==='saved')toast('Fechamento salvo carregado.');else if(result==='draft')toast('Rascunho desta data recuperado.');else toast('Não existe fechamento nem rascunho nesta data.','error')});
$('historyMonth').addEventListener('change',refreshHistory);
$('historySearch').addEventListener('input',refreshHistory);
$('clearHistoryFilters').addEventListener('click',()=>{$('historyMonth').value='';$('historySearch').value='';refreshHistory()});
$('monthPicker').addEventListener('change',refreshMonthly);
$('dailyReportDate').addEventListener('change',refreshDailyReport);
$('dailyReportTab').addEventListener('click',()=>setReportMode('daily'));
$('monthlyReportTab').addEventListener('click',()=>setReportMode('monthly'));
$('dailyReportEditBtn').addEventListener('click',()=>{const date=$('dailyReportDate').value;const r=load().find(x=>x.date===date);if(r){editRecord(date)}else toast('Não existe fechamento salvo nesta data.','error')});
$('printDailyReportBtn').addEventListener('click',printActiveReport);
$('printMonthlyReportBtn').addEventListener('click',printActiveReport);
$('exportJsonBtn').addEventListener('click',exportJSON);
$('exportCsvBtn').addEventListener('click',exportCSV);
$('importBtn').addEventListener('click',importJSON);
$('syncBtn').addEventListener('click',manualSync);
$('syncBackupBtn').addEventListener('click',manualSync);
$('menuToggle').addEventListener('click',openMenu);
$('overlay').addEventListener('click',closeMenu);
$('confirmCancelBtn').addEventListener('click',()=>closeConfirmModal(false));
$('confirmOkBtn').addEventListener('click',()=>closeConfirmModal(true));
document.querySelectorAll('[data-confirm-close="cancel"]').forEach(el=>el.addEventListener('click',()=>closeConfirmModal(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('confirmLayer').hidden)closeConfirmModal(false)});
$('logoutBtn').addEventListener('click',logout);
$('togglePass').addEventListener('click',()=>{$('loginPass').type=$('loginPass').type==='password'?'text':'password'});

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email='xburguer@xburguer.com',password=$('loginPass').value;
  $('loginError').style.display='none';
  $('loginForm').querySelector('.login-btn').disabled=true;
  try{
    await loginCloud(email,password,$('rememberMe').checked);
    restoreInitialClosing();
    refreshAll();showApp();toast('Login realizado. Dados sincronizados.');
  }catch(err){
    clearStoredSessions();authSession=null;currentUser=null;currentProfile=null;cloudData=[];
    $('loginError').textContent=err.message||'Não foi possível entrar no sistema.';
    $('loginError').style.display='block';
    setCloudStatus('● Falha no login','error');
  }finally{$('loginForm').querySelector('.login-btn').disabled=false}
});


window.addEventListener('offline',()=>{if(formDirty)flushDraft(activeClosingDate);setCloudStatus('● Sem internet','error');updateSyncUi()});
window.addEventListener('online',async()=>{
  if(!authSession)return;
  try{
    await loadCloudData();
    if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date').value||isoToday(),{notify:false});
    refreshAll();
    toast('Conexão restabelecida. Dados sincronizados.');
  }catch(err){setCloudStatus('● Erro de sincronização','error')}
});
window.addEventListener('beforeunload',()=>{if(formDirty)flushDraft(activeClosingDate)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&formDirty)flushDraft(activeClosingDate)});
window.editRecord=editRecord;window.deleteRecord=deleteRecord;
bootstrapCloud();
