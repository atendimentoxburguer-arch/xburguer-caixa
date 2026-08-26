/* X-Burguer Caixa — controle de pães por estoque inicial e final v4.18.3 */
(function(){
  'use strict';

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

  function updateBreadUi(){
    const idealStart=byId('idealStart');
    const gourmetStart=byId('gourmetStart');
    if(!idealStart||!gourmetStart)return;

    const panel=idealStart.closest('.panel');
    const head=panel?.querySelector('.bread-row.head');
    if(head)head.innerHTML='<span>Tipo de pão</span><span>Est. inicial</span><span>Est. final</span><span>Produção</span><span>Acum. mês</span>';

    const pairs=[
      {prefix:'ideal',start:'idealStart',finalInput:'idealProd',productionOutput:'idealFinal',monthOutput:'idealMonth'},
      {prefix:'gourmet',start:'gourmetStart',finalInput:'gourmetProd',productionOutput:'gourmetFinal',monthOutput:'gourmetMonth'}
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

      const startRaw=String(byId(item.start)?.value??'').trim();
      const finalRaw=String(finalInput?.value??'').trim();
      const production=startRaw&&finalRaw?computedProduction(item.start,item.finalInput):0;
      const productionOutput=byId(item.productionOutput);
      if(productionOutput)productionOutput.textContent=production;
      productionOutput?.parentElement?.classList.toggle('negative-stock',production<0);

      const producedBefore=prior.reduce((sum,r)=>sum+Number(r.breads?.[item.prefix+'Prod']||0),0);
      const monthOutput=byId(item.monthOutput);
      if(monthOutput)monthOutput.textContent=producedBefore+production;
    });

    const note=panel?.querySelector('.bread-note');
    if(note)note.textContent='Informe o estoque inicial e o estoque final. A produção é calculada automaticamente: estoque inicial − estoque final. O acumulado mensal soma as produções do mês.';
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
          tbody.innerHTML=`<tr><td>Pão Ideal</td><td>${Number(b.idealStart||0)}</td><td>${idealFinal}</td><td>${Number(b.idealStart||0)-idealFinal}</td></tr><tr><td>Pão Gourmet</td><td>${Number(b.gourmetStart||0)}</td><td>${gourmetFinal}</td><td>${Number(b.gourmetStart||0)-gourmetFinal}</td></tr>`;
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
      if(!tbody)return result;

      const head=tbody.closest('table')?.querySelector('thead tr');
      if(head)head.innerHTML='<th>Tipo</th><th>Produção acumulada</th><th>Último est. final</th>';

      const ym=byId('monthPicker')?.value||monthNow();
      const month=monthRecords(ym).map(normalize).sort((a,b)=>a.date.localeCompare(b.date));
      const total=prefix=>month.reduce((sum,r)=>sum+Number(r.breads?.[prefix+'Prod']||0),0);
      const last=month.at(-1)?.breads||{};
      tbody.innerHTML=`<tr><td>Pão Ideal</td><td>${total('ideal')}</td><td>${month.length?canonicalBreadFinal(last,'ideal'):0}</td></tr><tr><td>Pão Gourmet</td><td>${total('gourmet')}</td><td>${month.length?canonicalBreadFinal(last,'gourmet'):0}</td></tr>`;
      return result;
    };
  }

  ['idealStart','idealProd','gourmetStart','gourmetProd'].forEach(id=>{
    byId(id)?.addEventListener('input',updateBreadUi);
  });

  try{
    const date=(typeof activeClosingDate!=='undefined'&&activeClosingDate)||byId('date')?.value;
    if(date&&typeof loadBestRecordForDate==='function'&&!formDirty)loadBestRecordForDate(date,{notify:false});
  }catch{}

  updateBreadUi();
})();
