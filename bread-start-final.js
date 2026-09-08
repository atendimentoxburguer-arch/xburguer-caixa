/* X-Burguer Caixa — controle de pães por estoque inicial e final v4.18.3 */
(function(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const qty=id=>Number(byId(id)?.value||0);
  const integerStock=value=>Math.max(0,Math.trunc(Number(value)||0));

  function computedProduction(startId,finalInputId){
    return qty(startId)-qty(finalInputId);
  }

  function canonicalBreadFinal(breads,prefix){
    const start=Number(breads?.[prefix+'Start']||0);
    const storedFinal=breads?.[prefix+'Final'];
    if(storedFinal!==undefined&&storedFinal!==null&&storedFinal!=='')return integerStock(storedFinal);
    return integerStock(start-Number(breads?.[prefix+'Prod']||0));
  }

  function hasMeaningfulBreadHistory(record){
    const breads=record?.breads||{};
    return [
      'idealStart','idealFinal','idealProd',
      'gourmetStart','gourmetFinal','gourmetProd'
    ].some(key=>Math.abs(Number(breads[key]||0))>0);
  }

  function previousBreadClosing(date){
    if(!date||typeof load!=='function')return null;
    const prior=load()
      .map(normalize)
      .filter(r=>r?.date&&String(r.date)<String(date))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.savedAt||'').localeCompare(String(b.savedAt||'')));

    if(!prior.length)return null;

    /* Fechamentos antigos sem uso real do controle de pães são normalizados como 0/0.
       Eles não podem iniciar a cadeia automática nem bloquear o primeiro estoque manual.
       Depois que existir qualquer histórico real de pães, os fechamentos seguintes —
       inclusive dias com estoque 0 — continuam pertencendo à mesma cadeia. */
    if(!prior.some(hasMeaningfulBreadHistory))return null;
    return prior.at(-1)||null;
  }

  function automaticBreadOpening(date){
    const previous=previousBreadClosing(date);
    if(!previous)return null;
    return {
      sourceDate:previous.date,
      ideal:canonicalBreadFinal(previous.breads||{},'ideal'),
      gourmet:canonicalBreadFinal(previous.breads||{},'gourmet')
    };
  }

  function formatDate(date){
    if(!date)return'';
    try{return new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}catch{return date}
  }

  function setStartFieldState(id,value,automatic,sourceDate=''){
    const input=byId(id);
    if(!input)return;
    const label=input.closest('.bread-cell')?.querySelector('span');

    if(automatic){
      input.value=String(integerStock(value));
      input.readOnly=true;
      input.dataset.autoBreadOpening='1';
      input.dataset.breadSourceDate=sourceDate;
      input.title='Automático: estoque final de '+formatDate(sourceDate);
      input.setAttribute('aria-readonly','true');
      if(label)label.textContent='Est. inicial (auto)';
    }else{
      input.readOnly=false;
      delete input.dataset.autoBreadOpening;
      delete input.dataset.breadSourceDate;
      input.removeAttribute('title');
      input.removeAttribute('aria-readonly');
      if(label)label.textContent='Est. inicial';
    }
  }

  function applyAutomaticBreadOpening(date){
    const targetDate=date||byId('date')?.value||isoToday();
    const automatic=automaticBreadOpening(targetDate);
    if(automatic){
      setStartFieldState('idealStart',automatic.ideal,true,automatic.sourceDate);
      setStartFieldState('gourmetStart',automatic.gourmet,true,automatic.sourceDate);
      return automatic;
    }

    setStartFieldState('idealStart',byId('idealStart')?.value||'',false);
    setStartFieldState('gourmetStart',byId('gourmetStart')?.value||'',false);
    return null;
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
    const automatic=automaticBreadOpening(selectedDate);

    pairs.forEach((item,index)=>{
      const startInput=byId(item.start);
      const startLabel=startInput?.closest('.bread-cell')?.querySelector('span');
      if(startLabel)startLabel.textContent=startInput?.dataset.autoBreadOpening==='1'?'Est. inicial (auto)':'Est. inicial';

      const finalInput=byId(item.finalInput);
      const finalLabel=finalInput?.closest('.bread-cell')?.querySelector('span');
      if(finalLabel)finalLabel.textContent='Est. final';
      if(finalInput){
        finalInput.setAttribute('aria-label',index===0?'Estoque final do Pão Ideal':'Estoque final do Pão Gourmet');
        finalInput.placeholder='Qtd';
      }

      const startRaw=String(startInput?.value??'').trim();
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
    if(note){
      note.textContent=automatic
        ?`Estoque inicial automático: veio do estoque final de ${formatDate(automatic.sourceDate)}. Informe o estoque final de hoje para calcular a produção. Se não fizer a contagem neste fechamento, o estoque permanece igual e a produção fica 0.`
        :'Primeiro controle disponível: informe o estoque inicial e o estoque final. A partir do próximo fechamento, o estoque final restante será levado automaticamente como estoque inicial.';
    }
  }

  if(typeof resetFormFields==='function'){
    const previousResetFormFields=resetFormFields;
    resetFormFields=function(date){
      const result=previousResetFormFields.apply(this,arguments);
      applyAutomaticBreadOpening(date||byId('date')?.value||isoToday());
      calc();
      return result;
    };
  }

  if(typeof currentRecord==='function'){
    const previousCurrentRecord=currentRecord;
    currentRecord=function(dateOverride=null){
      const record=previousCurrentRecord(dateOverride);
      if(!record)return record;

      const targetDate=record.date||dateOverride||byId('date')?.value||isoToday();
      const automatic=automaticBreadOpening(targetDate);
      const idealStart=automatic?automatic.ideal:qty('idealStart');
      const gourmetStart=automatic?automatic.gourmet:qty('gourmetStart');
      const idealFinalRaw=String(byId('idealProd')?.value??'').trim();
      const gourmetFinalRaw=String(byId('gourmetProd')?.value??'').trim();
      const idealFinal=idealFinalRaw===''&&automatic?idealStart:qty('idealProd');
      const gourmetFinal=gourmetFinalRaw===''&&automatic?gourmetStart:qty('gourmetProd');

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
      applyAutomaticBreadOpening(normalized?.date||byId('date')?.value||isoToday());
      calc();
      return result;
    };
  }

  if(typeof loadBestRecordForDate==='function'){
    const previousLoadBestRecordForDate=loadBestRecordForDate;
    loadBestRecordForDate=function(date,options={}){
      const status=previousLoadBestRecordForDate.apply(this,arguments);
      applyAutomaticBreadOpening(date);
      calc();
      return status;
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
        const startInput=byId(startId);
        const startRaw=String(startInput?.value??'').trim();
        const finalRaw=String(byId(finalId)?.value??'').trim();
        const automatic=startInput?.dataset.autoBreadOpening==='1';

        if(automatic&&finalRaw==='')continue;
        if(!automatic&&Boolean(startRaw)!==Boolean(finalRaw))return`Informe o estoque inicial e o estoque final do ${name}.`;
        if(finalRaw!==''&&Number(final)>Number(start))return`O estoque final do ${name} não pode ser maior que o estoque inicial.`;
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

  window.XBBreadStock={
    previousClosing:previousBreadClosing,
    automaticOpening:automaticBreadOpening,
    hasMeaningfulHistory:hasMeaningfulBreadHistory,
    apply:applyAutomaticBreadOpening
  };

  updateBreadUi();
})();
