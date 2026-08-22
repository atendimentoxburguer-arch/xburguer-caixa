/* X-Burguer Caixa — controle de pães por estoque inicial e final */
(function(){
  'use strict';

  const FEATURE_VERSION='4.19.0';
  const byId=id=>document.getElementById(id);
  const qty=id=>Number(byId(id)?.value||0);

  function computedProduction(startId,finalInputId){
    return qty(startId)-qty(finalInputId);
  }

  function canonicalBreadFinal(breads,prefix){
    const start=Number(breads?.[prefix+'Start']||0);
    const storedFinal=breads?.[prefix+'Final'];
    if(storedFinal!==undefined&&storedFinal!==null&&storedFinal!=='')return Number(storedFinal||0);
    return start-Number(breads?.[prefix+'Prod']||0);
  }

  function setVersionUi(){
    window.XB_APP_VERSION=FEATURE_VERSION;
    document.documentElement.dataset.appVersion=FEATURE_VERSION;
    document.querySelectorAll('.reconcile').forEach(item=>{
      const label=item.querySelector('span');
      const value=item.querySelector('b');
      if(label&&value&&label.textContent.trim()==='Versão')value.textContent=FEATURE_VERSION;
    });
  }

  function updateBreadUi(){
    const idealStart=byId('idealStart');
    const gourmetStart=byId('gourmetStart');
    if(!idealStart||!gourmetStart)return;

    const panel=idealStart.closest('.panel');
    const head=panel?.querySelector('.bread-row.head');
    if(head)head.innerHTML='<span>Tipo de pão</span><span>Est. inicial</span><span>Est. final</span><span>Produção</span><span>Acum. mês</span>';

    const pairs=[
      {start:'idealStart',finalInput:'idealProd',productionOutput:'idealFinal',monthOutput:'idealMonth'},
      {start:'gourmetStart',finalInput:'gourmetProd',productionOutput:'gourmetFinal',monthOutput:'gourmetMonth'}
    ];

    const selectedDate=byId('date')?.value||isoToday();
    const ym=selectedDate.slice(0,7);
    const prior=monthRecords(ym).map(normalize).filter(r=>String(r.date||'')<selectedDate);

    pairs.forEach((item,index)=>{
      const finalInput=byId(item.finalInput);
      const finalLabel=finalInput?.closest('.bread-cell')?.querySelector('span');
      if(finalLabel)finalLabel.textContent='Est. final';
      if(finalInput){
        finalInput.setAttribute('aria-label',index===0?'Estoque final do Pão Ideal':'Estoque final do Pão Gourmet');
        finalInput.placeholder='Qtd';
      }

      const productionOutput=byId(item.productionOutput);
      const productionBox=productionOutput?.parentElement;
      const productionLabel=productionBox?.querySelector('span');
      if(productionLabel)productionLabel.textContent='Produção';

      const production=computedProduction(item.start,item.finalInput);
      if(productionOutput)productionOutput.textContent=production;
      productionBox?.classList.toggle('negative-stock',production<0);

      const prefix=index===0?'ideal':'gourmet';
      const producedBefore=prior.reduce((sum,r)=>sum+Number(r.breads?.[prefix+'Prod']||0),0);
      const monthOutput=byId(item.monthOutput);
      if(monthOutput)monthOutput.textContent=producedBefore+production;
    });

    const note=panel?.querySelector('.bread-note');
    if(note)note.textContent='Informe o estoque inicial e o estoque final. A produção é calculada automaticamente: estoque inicial − estoque final. O acumulado mensal soma as produções do mês.';
    setVersionUi();
  }

  if(typeof currentRecord==='function'){
    const previousCurrentRecord=currentRecord;
    currentRecord=function(dateOverride=null){
      const record=previousCurrentRecord(dateOverride);
      if(!record)return record;

      const idealStart=qty('idealStart');
      const idealFinal=qty('idealProd');
      const gourmetStart=qty('gourmetStart');
      const gourmetFinal=qty('gourmetProd');

      record.breads={
        ...(record.breads||{}),
        idealStart,
        idealFinal,
        idealProd:idealStart-idealFinal,
        idealOut:0,
        gourmetStart,
        gourmetFinal,
        gourmetProd:gourmetStart-gourmetFinal,
        gourmetOut:0
      };
      return record;
    };
  }

  if(typeof populateForm==='function'){
    const previousPopulateForm=populateForm;
    populateForm=function(rec,options={}){
      const normalized=normalize(rec);
      const result=previousPopulateForm(rec,options);
      if(!result)return result;

      const idealFinal=canonicalBreadFinal(normalized?.breads,'ideal');
      const gourmetFinal=canonicalBreadFinal(normalized?.breads,'gourmet');
      if(byId('idealProd'))byId('idealProd').value=Number.isFinite(idealFinal)?String(idealFinal):'';
      if(byId('gourmetProd'))byId('gourmetProd').value=Number.isFinite(gourmetFinal)?String(gourmetFinal):'';
      calc();
      return result;
    };
  }

  if(typeof validateRecord==='function'){
    const previousValidateRecord=validateRecord;
    validateRecord=function(rec){
      const breadPairs=[
        ['Pão Ideal','idealStart','idealProd',rec?.breads?.idealStart,rec?.breads?.idealFinal],
        ['Pão Gourmet','gourmetStart','gourmetProd',rec?.breads?.gourmetStart,rec?.breads?.gourmetFinal]
      ];

      for(const [name,startId,finalId,start,final] of breadPairs){
        const startRaw=String(byId(startId)?.value??'').trim();
        const finalRaw=String(byId(finalId)?.value??'').trim();
        if(Boolean(startRaw)!==Boolean(finalRaw))return`Informe o estoque inicial e o estoque final do ${name}.`;
        if(Number(final)>Number(start))return`O estoque final do ${name} não pode ser maior que o estoque inicial.`;
      }
      return previousValidateRecord(rec);
    };
  }

  if(typeof calc==='function'){
    const previousCalc=calc;
    calc=function(){
      const result=previousCalc.apply(this,arguments);
      updateBreadUi();
      return result;
    };
  }

  if(typeof refreshDailyReport==='function'){
    const previousDailyReport=refreshDailyReport;
    refreshDailyReport=function(){
      const result=previousDailyReport.apply(this,arguments);
      const tbody=byId('dailyBreadTable');
      const date=byId('dailyReportDate')?.value||isoToday();
      const record=load().map(normalize).find(r=>r.date===date);
      if(tbody){
        const head=tbody.closest('table')?.querySelector('thead tr');
        if(head)head.innerHTML='<th>Tipo</th><th>Est. inicial</th><th>Est. final</th><th>Produção</th>';
        if(record){
          const b=record.breads||{};
          const idealFinal=canonicalBreadFinal(b,'ideal');
          const gourmetFinal=canonicalBreadFinal(b,'gourmet');
          const idealProd=Number(b.idealStart||0)-idealFinal;
          const gourmetProd=Number(b.gourmetStart||0)-gourmetFinal;
          tbody.innerHTML=`<tr><td>Pão Ideal</td><td>${Number(b.idealStart||0)}</td><td>${idealFinal}</td><td>${idealProd}</td></tr><tr><td>Pão Gourmet</td><td>${Number(b.gourmetStart||0)}</td><td>${gourmetFinal}</td><td>${gourmetProd}</td></tr>`;
        }
      }
      return result;
    };
  }

  if(typeof refreshMonthly==='function'){
    const previousMonthly=refreshMonthly;
    refreshMonthly=function(){
      const result=previousMonthly.apply(this,arguments);
      const tbody=byId('monthlyBreadTable');
      if(tbody){
        const head=tbody.closest('table')?.querySelector('thead tr');
        if(head)head.innerHTML='<th>Tipo</th><th>Produção acumulada</th><th>Último est. final</th>';
      }
      return result;
    };
  }

  if(typeof exportCSV==='function'){
    exportCSV=function(){
      const rows=[
        ['Data','Responsável','Vendas','Despesas','Dinheiro retirado p/ despesas','Resultado','Pedidos','Dinheiro','Cartões','Pix/App','Diferença Caixa','Pão Ideal Est. inicial','Pão Ideal Est. final','Pão Ideal Produção','Pão Gourmet Est. inicial','Pão Gourmet Est. final','Pão Gourmet Produção','Observações'],
        ...load().map(normalize).map(r=>{
          const b=r.breads||{};
          const idealFinal=canonicalBreadFinal(b,'ideal');
          const gourmetFinal=canonicalBreadFinal(b,'gourmet');
          return [r.date,r.resp,r.sales,r.expense,r.cashOut||0,r.result,r.orders,r.cash,(r.cardOut||0)+(r.deliveryCard||0),r.onlinePayment,r.cashDifference,b.idealStart||0,idealFinal,Number(b.idealStart||0)-idealFinal,b.gourmetStart||0,gourmetFinal,Number(b.gourmetStart||0)-gourmetFinal,r.obs];
        })
      ];
      const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
      download(`xburguer-caixa-${isoToday()}.csv`,csv,'text/csv;charset=utf-8');
      toast('Planilha CSV exportada.');
    };
  }

  if(typeof exportJSON==='function'){
    exportJSON=function(){
      const data={version:FEATURE_VERSION,exportedAt:new Date().toISOString(),records:load()};
      download(`xburguer-backup-${isoToday()}.json`,JSON.stringify(data,null,2),'application/json');
      const now=new Date().toLocaleString('pt-BR');
      localStorage.setItem(BACKUP_KEY,now);
      refreshBackup();
      toast('Backup JSON exportado.');
    };
  }

  if(typeof validateBackupRecords==='function'){
    const previousValidateBackup=validateBackupRecords;
    validateBackupRecords=function(records){
      const base=previousValidateBackup(records);
      if(base!==true)return base;
      for(let i=0;i<records.length;i++){
        const breads=records[i]?.breads||{};
        for(const [label,prefix] of [['Pão Ideal','ideal'],['Pão Gourmet','gourmet']]){
          const start=Number(breads[prefix+'Start']||0);
          const final=canonicalBreadFinal(breads,prefix);
          if(!Number.isInteger(start)||start<0||!Number.isInteger(final)||final<0)return`Registro ${i+1} possui estoque inválido de ${label}.`;
          if(final>start)return`Registro ${i+1} possui estoque final de ${label} maior que o estoque inicial.`;
        }
      }
      return true;
    };
  }

  if(typeof refreshBackup==='function'){
    const previousRefreshBackup=refreshBackup;
    refreshBackup=function(){
      const result=previousRefreshBackup.apply(this,arguments);
      setVersionUi();
      return result;
    };
  }

  ['idealStart','idealProd','gourmetStart','gourmetProd'].forEach(id=>{
    byId(id)?.addEventListener('input',updateBreadUi);
  });

  updateBreadUi();
})();
