/* X-Burguer Caixa — proteção profissional de backup v4.18.2 */
(function(){
  'use strict';

  const FORMAT='xburguer-caixa-backup-v2';
  const MAX_AGE_DAYS=7;
  const REMINDER_KEY='xburguer_backup_reminder_date';
  const baseSbRest=typeof sbRest==='function'?sbRest:null;
  let latestExternalExport=null;
  let importVerification={status:'idle',message:'',verified:false,legacy:false};
  let statusPromise=null;
  let snapshotPromise=null;

  const byId=id=>document.getElementById(id);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const nowIso=()=>new Date().toISOString();
  const dayMs=86400000;

  function formatDateTime(value){
    const d=value?new Date(value):null;
    if(!d||Number.isNaN(d.getTime()))return'Nunca';
    return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function formatDate(value){
    const d=value?new Date(String(value).length===10?value+'T12:00:00':value):null;
    if(!d||Number.isNaN(d.getTime()))return'—';
    return d.toLocaleDateString('pt-BR');
  }

  function ageInDays(value){
    const d=value?new Date(value):null;
    if(!d||Number.isNaN(d.getTime()))return Infinity;
    return Math.max(0,Math.floor((Date.now()-d.getTime())/dayMs));
  }

  async function sha256Hex(text){
    if(!window.crypto?.subtle||typeof TextEncoder==='undefined')throw new Error('Este navegador não oferece verificação criptográfica de backup.');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function recordsForBackup(){
    const source=clone(typeof load==='function'?(load()||[]):[]);
    return source.map(record=>typeof normalize==='function'?normalize(record):record);
  }

  async function buildEnvelope(){
    const records=recordsForBackup();
    const recordsJson=JSON.stringify(records);
    const checksum=await sha256Hex(recordsJson);
    return {
      format:FORMAT,
      version:String(window.XB_APP_VERSION||'4.18.2'),
      exportedAt:nowIso(),
      recordCount:records.length,
      integrity:{algorithm:'SHA-256',scope:'records-json',checksum},
      records
    };
  }

  async function verifyEnvelope(raw){
    const records=Array.isArray(raw)?raw:raw?.records;
    if(!Array.isArray(records))throw new Error('O arquivo não contém uma lista válida de fechamentos.');

    if(Array.isArray(raw)||!raw?.format){
      return {records,verified:false,legacy:true,checksum:null,recordCount:records.length};
    }

    if(raw.format!==FORMAT)throw new Error('Formato de backup não reconhecido por esta versão do X-Burguer Caixa.');
    if(Number(raw.recordCount)!==records.length)throw new Error('O backup está incompleto: a contagem de registros não confere.');
    if(raw.integrity?.algorithm!=='SHA-256'||raw.integrity?.scope!=='records-json')throw new Error('O backup protegido está sem a assinatura de integridade esperada.');

    const expected=String(raw.integrity?.checksum||'').toLowerCase();
    if(!/^[0-9a-f]{64}$/.test(expected))throw new Error('A assinatura de integridade do backup é inválida.');
    const actual=await sha256Hex(JSON.stringify(records));
    if(actual!==expected)throw new Error('A verificação SHA-256 falhou. O arquivo pode estar corrompido ou ter sido alterado.');

    return {records,verified:true,legacy:false,checksum:actual,recordCount:records.length};
  }

  function ensureBackupUi(){
    const grid=document.querySelector('#backup .reconcile-grid');
    if(grid&&!byId('backupExternalStatus')){
      const external=document.createElement('div');
      external.className='reconcile';
      external.innerHTML='<span>Status do backup externo</span><b id="backupExternalStatus">Verificando...</b>';
      grid.appendChild(external);
    }
    if(grid&&!byId('lastSnapshot')){
      const snapshot=document.createElement('div');
      snapshot.className='reconcile';
      snapshot.innerHTML='<span>Snapshot automático</span><b id="lastSnapshot">Verificando...</b>';
      grid.appendChild(snapshot);
    }

    const exportBtn=byId('exportJsonBtn');
    const card=exportBtn?.closest('.backup-card');
    if(card){
      const p=card.querySelector('p');
      if(p)p.textContent='Baixa uma cópia externa protegida por SHA-256. Guarde este arquivo também fora do aparelho.';
      let hint=byId('backupExportHint');
      if(!hint){
        hint=document.createElement('small');
        hint.id='backupExportHint';
        hint.style.display='block';
        hint.style.marginTop='10px';
        card.appendChild(hint);
      }
    }

    const restoreBtn=byId('importBtn');
    const restoreCard=restoreBtn?.closest('.backup-card');
    if(restoreCard&&!byId('backupImportHint')){
      const hint=document.createElement('small');
      hint.id='backupImportHint';
      hint.style.display='block';
      hint.style.marginTop='10px';
      hint.textContent='Backups protegidos serão verificados antes da restauração.';
      restoreCard.appendChild(hint);
    }
  }

  function setExternalStatus(exportRow){
    const status=byId('backupExternalStatus');
    const last=byId('lastBackup');
    const hint=byId('backupExportHint');
    latestExternalExport=exportRow||null;

    if(!exportRow?.exported_at){
      const local=localStorage.getItem(BACKUP_KEY);
      if(last)last.textContent=local||'Nunca';
      if(status)status.textContent='Atenção • nenhum backup verificado';
      if(hint)hint.textContent='Faça o primeiro backup externo e guarde o arquivo em outro local, como OneDrive ou Google Drive.';
      return;
    }

    const age=ageInDays(exportRow.exported_at);
    if(last)last.textContent=formatDateTime(exportRow.exported_at);
    if(status){
      status.textContent=age<=MAX_AGE_DAYS?'Em dia':`Atenção • ${age} dias sem exportar`;
      status.dataset.state=age<=MAX_AGE_DAYS?'ok':'warning';
    }
    if(hint){
      const shortHash=String(exportRow.checksum||'').slice(0,12);
      hint.textContent=`Último backup verificado: ${Number(exportRow.record_count||0)} fechamento(s) • código ${shortHash||'—'}`;
    }
  }

  function setSnapshotStatus(row){
    const el=byId('lastSnapshot');
    if(!el)return;
    if(!row?.snapshot_day){el.textContent='Ainda não criado';return;}
    el.textContent=`${formatDate(row.snapshot_day)} • ${Number(row.record_count||0)} fechamento(s)`;
  }

  async function refreshProtectionStatus(){
    ensureBackupUi();
    if(statusPromise)return statusPromise;
    statusPromise=(async()=>{
      if(!baseSbRest||!authSession?.access_token||!navigator.onLine){
        setExternalStatus(null);
        setSnapshotStatus(null);
        return;
      }
      try{
        const [exportsRows,snapshotRows]=await Promise.all([
          baseSbRest('backup_exports?select=exported_at,record_count,checksum,format_version&order=exported_at.desc&limit=1'),
          baseSbRest('cash_backup_snapshots?select=snapshot_day,created_at,record_count&order=snapshot_day.desc&limit=1')
        ]);
        setExternalStatus(exportsRows?.[0]||null);
        setSnapshotStatus(snapshotRows?.[0]||null);
      }catch{
        setExternalStatus(null);
      }
    })();
    try{await statusPromise}finally{statusPromise=null}
  }

  async function createSnapshot(){
    if(!baseSbRest||!authSession?.access_token||!navigator.onLine)return null;
    if(snapshotPromise)return snapshotPromise;
    snapshotPromise=(async()=>{
      const result=await baseSbRest('rpc/create_cash_snapshot',{method:'POST',headers:{Prefer:'return=representation'},body:'{}'});
      setTimeout(()=>refreshProtectionStatus().catch(()=>{}),0);
      return result;
    })();
    try{return await snapshotPromise}finally{snapshotPromise=null}
  }

  async function registerExternalExport(envelope){
    if(!baseSbRest||!currentUser?.id||!authSession?.access_token||!navigator.onLine)return false;
    await baseSbRest('backup_exports',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
      user_id:currentUser.id,
      record_count:envelope.recordCount,
      checksum:envelope.integrity.checksum,
      app_version:envelope.version,
      format_version:envelope.format
    })});
    return true;
  }

  exportJSON=async function(){
    const button=byId('exportJsonBtn');
    const oldText=button?.textContent||'Exportar JSON';
    if(button){button.disabled=true;button.textContent='Preparando backup...';}
    let downloaded=false;
    try{
      if(!authSession?.access_token||!navigator.onLine)throw new Error('Conecte-se à internet antes de gerar o backup externo completo.');
      if(typeof loadCloudData==='function')await loadCloudData();
      const envelope=await buildEnvelope();
      const stamp=new Date();
      const hm=`${String(stamp.getHours()).padStart(2,'0')}${String(stamp.getMinutes()).padStart(2,'0')}`;
      const fileName=`xburguer-caixa-backup-${isoToday()}-${hm}.json`;
      download(fileName,JSON.stringify(envelope,null,2),'application/json');
      downloaded=true;
      localStorage.setItem(BACKUP_KEY,new Date().toLocaleString('pt-BR'));

      let registered=false;
      try{
        registered=await registerExternalExport(envelope);
        await createSnapshot();
      }catch{}
      await refreshProtectionStatus().catch(()=>{});
      if(typeof refreshBackup==='function')refreshBackup();

      toast(registered
        ? `Backup protegido exportado e verificado: ${envelope.recordCount} fechamento(s).`
        : 'Backup protegido baixado. Guarde o arquivo em outro local; não foi possível registrar a exportação na nuvem.',
        registered?'ok':'error');
    }catch(err){
      toast(err?.message||'Não foi possível gerar o backup protegido.','error');
      if(downloaded)try{localStorage.setItem(BACKUP_KEY,new Date().toLocaleString('pt-BR'))}catch{}
    }finally{
      if(button){button.disabled=false;button.textContent=oldText;}
    }
  };

  async function inspectImportFile(){
    ensureBackupUi();
    const input=byId('importFile');
    const button=byId('importBtn');
    const hint=byId('backupImportHint');
    const file=input?.files?.[0];
    importVerification={status:'idle',message:'',verified:false,legacy:false};
    if(!file){
      if(hint)hint.textContent='Backups protegidos serão verificados antes da restauração.';
      if(button)button.disabled=false;
      return;
    }

    if(button){button.disabled=true;button.textContent='Verificando...';}
    if(hint)hint.textContent='Conferindo integridade do arquivo...';
    try{
      const raw=JSON.parse(await file.text());
      const result=await verifyEnvelope(raw);
      importVerification={status:'ready',message:'',verified:result.verified,legacy:result.legacy,recordCount:result.recordCount,checksum:result.checksum};
      if(hint){
        hint.textContent=result.verified
          ? `✓ Backup íntegro • ${result.recordCount} fechamento(s) • SHA-256 ${String(result.checksum).slice(0,12)}...`
          : `Backup antigo compatível • ${result.recordCount} fechamento(s) • sem assinatura SHA-256.`;
      }
      if(button)button.disabled=false;
    }catch(err){
      importVerification={status:'invalid',message:err?.message||'Arquivo de backup inválido.',verified:false,legacy:false};
      if(hint)hint.textContent='⚠ '+importVerification.message;
      if(button)button.disabled=true;
    }finally{
      if(button)button.textContent='Restaurar arquivo';
    }
  }

  if(typeof validateBackupRecords==='function'){
    const previousValidate=validateBackupRecords;
    validateBackupRecords=function(records){
      if(importVerification.status==='invalid')return importVerification.message;
      if(importVerification.status==='checking')return'Aguarde a verificação do arquivo antes de restaurar.';
      if(importVerification.status==='ready'&&Number(importVerification.recordCount)!==records.length)return'A contagem do arquivo mudou depois da verificação.';
      return previousValidate(records);
    };
  }

  /* Cria/atualiza o snapshot depois das escritas críticas no banco. */
  if(baseSbRest){
    sbRest=async function(path,options={},retry=true){
      const result=await baseSbRest(path,options,retry);
      const method=String(options?.method||'GET').toUpperCase();
      const changedClosing=String(path).startsWith('rpc/save_cash_closing')||String(path).startsWith('rpc/restore_cash_backup')||(method==='DELETE'&&String(path).startsWith('cash_closings?'));
      if(changedClosing){
        try{await createSnapshot()}catch{}
      }
      return result;
    };
  }

  if(typeof refreshBackup==='function'){
    const previousRefresh=refreshBackup;
    refreshBackup=function(){
      const result=previousRefresh.apply(this,arguments);
      setTimeout(()=>refreshProtectionStatus().catch(()=>{}),0);
      return result;
    };
  }

  function maybeRemind(){
    if(!(typeof load==='function'&&load().length))return;
    const age=latestExternalExport?.exported_at?ageInDays(latestExternalExport.exported_at):Infinity;
    if(age<=MAX_AGE_DAYS)return;
    const today=typeof isoToday==='function'?isoToday():new Date().toISOString().slice(0,10);
    if(localStorage.getItem(REMINDER_KEY)===today)return;
    localStorage.setItem(REMINDER_KEY,today);
    setTimeout(()=>toast('Lembrete de segurança: faça um backup externo JSON e guarde-o fora deste aparelho.','error'),2600);
  }

  byId('importFile')?.addEventListener('change',()=>{
    importVerification={status:'checking',message:'',verified:false,legacy:false};
    inspectImportFile().catch(()=>{});
  });

  ensureBackupUi();
  setTimeout(()=>{
    refreshProtectionStatus().then(maybeRemind).catch(()=>{});
  },300);

  window.XBBackupProtection={
    format:FORMAT,
    verifyEnvelope,
    createSnapshot,
    refreshStatus:refreshProtectionStatus
  };
})();
