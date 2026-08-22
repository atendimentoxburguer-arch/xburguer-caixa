/* X-Burguer Caixa — conferência automática + contagem física opcional v4.18.2 */
(function(){
  const AUTO_VERSION='4.18.2';
  const roundMoney=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
  const countedWasEntered=()=>String(document.getElementById('countedCash')?.value??'').trim()!=='';

  function applyCashVerificationRule(record,verifiedOverride){
    if(!record)return record;
    const expected=roundMoney(Number(record.cash||0)+Number(record.deliveryCash||0)-Number(record.cashOut||0));
    let verified=verifiedOverride;
    if(verified===undefined){
      if(record.cashCountVerified!==undefined)verified=!!record.cashCountVerified;
      else verified=Number(record.countedCash||0)!==0;
    }
    record.cashCountVerified=!!verified;
    record.expectedCash=expected;
    if(record.cashCountVerified){
      record.cashDifference=roundMoney(Number(record.countedCash||0)-expected);
    }else{
      record.countedCash=0;
      record.cashDifference=0;
    }
    return record;
  }

  if(typeof cloudToRecord==='function'){
    const originalCloudToRecord=cloudToRecord;
    cloudToRecord=function(row){
      const record=originalCloudToRecord(row);
      return applyCashVerificationRule(record,!!row?.cash_count_verified);
    };
  }

  if(typeof normalize==='function'){
    const originalNormalize=normalize;
    normalize=function(record){
      const normalized=originalNormalize(record);
      if(!normalized)return normalized;
      const verified=normalized.cashCountVerified!==undefined
        ? !!normalized.cashCountVerified
        : Number(normalized.countedCash||0)!==0;
      return applyCashVerificationRule(normalized,verified);
    };
  }

  if(typeof currentRecord==='function'){
    const originalCurrentRecord=currentRecord;
    currentRecord=function(dateOverride=null){
      const record=originalCurrentRecord(dateOverride);
      return applyCashVerificationRule(record,countedWasEntered());
    };
  }

  if(typeof populateForm==='function'){
    const originalPopulateForm=populateForm;
    populateForm=function(record,options={}){
      const normalized=record?normalize(record):record;
      const result=originalPopulateForm(record,options);
      if(normalized?.cashCountVerified&&Number(normalized.countedCash||0)===0){
        const input=document.getElementById('countedCash');
        if(input)input.value='0';
        try{window.XBurguerCurrency?.refresh?.()}catch{}
        try{calc()}catch{}
      }
      return result;
    };
  }

  buildSaveWarnings=function(record){
    const warnings=[];
    if(record.date>isoToday())warnings.push('• A data selecionada está no futuro.');
    if(Math.abs(Number(record.paymentDifference||0))>=0.01){
      warnings.push('• Pagamentos × vendas estão diferentes em '+br(record.paymentDifference)+'.');
    }
    if(record.cashCountVerified&&Math.abs(Number(record.cashDifference||0))>=0.01){
      warnings.push('• A contagem física da gaveta tem diferença de '+br(record.cashDifference)+'.');
    }
    return warnings;
  };

  if(typeof refreshDailyReport==='function'){
    const originalRefreshDailyReport=refreshDailyReport;
    refreshDailyReport=function(){
      const result=originalRefreshDailyReport.apply(this,arguments);
      const date=document.getElementById('dailyReportDate')?.value||isoToday();
      const record=load().map(normalize).find(r=>r.date===date);
      if(record&&!record.cashCountVerified){
        const diff=document.getElementById('drCashDiff');
        const status=document.getElementById('drCashStatus');
        if(diff){diff.textContent='—';diff.classList.remove('positive','negative');}
        if(status)status.textContent='Contagem física opcional';
        document.querySelectorAll('#dailyFinancialRows .data-row').forEach(row=>{
          const label=row.querySelector('span')?.textContent?.trim();
          const value=row.querySelector('b');
          const extra=row.querySelector('span:last-child');
          if(label==='Dinheiro contado'&&value){value.textContent='Não informado';value.classList.remove('money','positive','negative');}
          if(label==='Diferença do caixa'&&value){
            value.textContent='—';value.classList.remove('money','positive','negative');
            if(extra)extra.textContent='Opcional';
          }
        });
      }
      return result;
    };
  }

  if(typeof refreshHistory==='function'){
    const originalRefreshHistory=refreshHistory;
    refreshHistory=function(){
      const result=originalRefreshHistory.apply(this,arguments);
      const ym=document.getElementById('historyMonth')?.value||'';
      const query=(document.getElementById('historySearch')?.value||'').trim().toLowerCase();
      let records=load().map(normalize).slice().reverse();
      if(ym)records=records.filter(r=>r.date.startsWith(ym));
      if(query)records=records.filter(r=>(r.resp||'').toLowerCase().includes(query)||(r.obs||'').toLowerCase().includes(query));
      const rows=[...document.querySelectorAll('#historyTable tr')];
      records.forEach((record,index)=>{
        const cell=rows[index]?.cells?.[6];
        if(cell&&!record.cashCountVerified){cell.textContent='—';cell.classList.remove('positive','negative');}
      });
      return result;
    };
  }

  if(typeof refreshMonthly==='function'){
    const originalRefreshMonthly=refreshMonthly;
    refreshMonthly=function(){
      const result=originalRefreshMonthly.apply(this,arguments);
      document.querySelectorAll('#monthlyPaymentsTable tr').forEach(row=>{
        const first=row.querySelector('td');
        if(first?.textContent?.trim()==='Diferenças de caixa (líquido)'){
          first.textContent='Diferenças físicas informadas';
        }
      });
      const ym=document.getElementById('monthPicker')?.value||monthNow();
      const month=monthRecords(ym).map(normalize).sort((a,b)=>a.date.localeCompare(b.date));
      const rows=[...document.querySelectorAll('#monthTable tr')];
      month.forEach((record,index)=>{
        const cell=rows[index]?.cells?.[11];
        if(cell&&!record.cashCountVerified){cell.textContent='—';cell.classList.remove('positive','negative');}
      });
      return result;
    };
  }

  window.XB_APP_VERSION=AUTO_VERSION;
  if(typeof exportJSON==='function'){
    exportJSON=function(){
      const data={version:AUTO_VERSION,exportedAt:new Date().toISOString(),records:load()};
      download(`xburguer-backup-${isoToday()}.json`,JSON.stringify(data,null,2),'application/json');
      const now=new Date().toLocaleString('pt-BR');
      localStorage.setItem(BACKUP_KEY,now);
      refreshBackup();
      toast('Backup JSON exportado.');
    };
  }

  function applyVersion(){
    document.documentElement.dataset.appVersion=AUTO_VERSION;
    document.querySelectorAll('.reconcile').forEach(item=>{
      const label=item.querySelector('span');
      const value=item.querySelector('b');
      if(label&&value&&label.textContent.trim()==='Versão')value.textContent=AUTO_VERSION;
    });
  }
  if(typeof refreshBackup==='function'){
    const previousRefreshBackup=refreshBackup;
    refreshBackup=function(){const result=previousRefreshBackup.apply(this,arguments);applyVersion();return result;};
  }
  applyVersion();

  try{
    if(Array.isArray(cloudData)&&cloudData.length)cloudData=cloudData.map(normalize);
  }catch{}
})();
