/* X-Burguer Caixa — integridade financeira canônica v4.18.3
   Regra central:
   - Venda oficial = Resumo Financeiro / formas de pagamento.
   - Vendas por canal são exclusivamente demonstrativas.
   - Saldo Inicial NÃO é venda e participa apenas da conferência física.
   - Dinheiro esperado = Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) - retiradas. */
(function(){
  'use strict';

  const VERSION='4.18.3';
  const rules=window.XBBusinessRules;
  const byId=id=>document.getElementById(id);
  const value=id=>Number(byId(id)?.value||0);
  const money=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const round=n=>rules?.roundMoney?rules.roundMoney(n):Math.round((Number(n||0)+Number.EPSILON)*100)/100;

  function formFinancialSales(){
    return round(value('cash')+value('deliveryCash')+value('cardOut')+value('online')+value('deliveryCard'));
  }

  function formChannelSales(){
    try{return round(channels.reduce((total,_,i)=>total+value('v'+i),0))}catch{return 0}
  }

  function formOrders(){
    try{return channels.reduce((total,_,i)=>total+Math.max(0,Math.trunc(value('q'+i))),0)}catch{return 0}
  }

  function formExpenses(){
    try{return round(getExpenses().reduce((total,item)=>total+Number(item?.val||0),0))}catch{return 0}
  }

  function formExpectedCash(){
    return round(value('opening')+value('cash')+value('deliveryCash')-value('cashOut'));
  }

  function recordFinancialSales(record={}){
    if(rules?.financialSummaryTotal)return round(rules.financialSummaryTotal(record));
    if(Number.isFinite(Number(record.summaryTotal)))return round(record.summaryTotal);
    if(Number.isFinite(Number(record.paymentTotal)))return round(record.paymentTotal);
    return round(Number(record.cash||0)+Number(record.deliveryCash||0)+Number(record.cardOut||0)+Number(record.onlinePayment||0)+Number(record.deliveryCard||0));
  }

  function recordChannelSales(record={}){
    if(rules?.channelSales)return round(rules.channelSales(record));
    if(Array.isArray(record.channels))return round(record.channels.reduce((total,item)=>total+Number(item?.v||0),0));
    return round(record.channelSales||0);
  }

  function selectedDate(){
    return byId('date')?.value||((typeof isoToday==='function')?isoToday():'');
  }

  function priorMonthRecords(date){
    if(!date)return[];
    try{
      return monthRecords(date.slice(0,7))
        .map(record=>typeof normalize==='function'?normalize(record):record)
        .filter(record=>String(record?.date||'')<date);
    }catch{return[]}
  }

  function setToneSafe(el,n){
    if(el&&typeof setTone==='function')setTone(el,n);
  }

  function updateFinancialUi(){
    const date=selectedDate();
    const prior=priorMonthRecords(date);
    const sales=formFinancialSales();
    const channelSales=formChannelSales();
    const orders=formOrders();
    const expenses=formExpenses();
    const difference=round(sales-channelSales);
    const result=round(sales-expenses);
    const expected=formExpectedCash();

    const priorSales=round(prior.reduce((t,r)=>t+recordFinancialSales(r),0));
    const priorChannelSales=round(prior.reduce((t,r)=>t+recordChannelSales(r),0));
    const priorOrders=prior.reduce((t,r)=>t+Number(r?.orders||0),0);
    const priorResult=round(prior.reduce((t,r)=>t+round(recordFinancialSales(r)-Number(r?.expense||0)),0));

    if(byId('aOpening')){
      byId('aOpening').textContent=money(value('opening'));
      byId('aOpening').title='Saldo inicial do dia selecionado. Não é venda e não é somado à receita.';
    }

    if(byId('daySales'))byId('daySales').textContent=money(sales);
    if(byId('aSales'))byId('aSales').textContent=money(round(priorSales+sales));
    if(byId('dayBalance')){byId('dayBalance').textContent=money(result);setToneSafe(byId('dayBalance'),result)}
    if(byId('aBalance')){const total=round(priorResult+result);byId('aBalance').textContent=money(total);setToneSafe(byId('aBalance'),total)}

    if(byId('ctVal'))byId('ctVal').textContent=money(channelSales);
    if(byId('ctQtd'))byId('ctQtd').textContent=orders+' pedidos';
    if(byId('ctMonthVal'))byId('ctMonthVal').textContent=money(round(priorChannelSales+channelSales));
    if(byId('ctMonthQtd'))byId('ctMonthQtd').textContent=(priorOrders+orders)+' até o dia';

    if(byId('paymentTotal'))byId('paymentTotal').textContent=money(sales);
    if(byId('paymentDiff')){
      byId('paymentDiff').textContent=money(difference);
      byId('paymentDiff').classList.remove('positive','negative');
      byId('paymentDiff').title='Diferença apenas demonstrativa entre o Resumo Financeiro e as vendas por canal.';
    }

    const countedRaw=String(byId('countedCash')?.value??'').trim();
    if(byId('cashDiff')){
      if(!countedRaw){
        byId('cashDiff').textContent='—';
        byId('cashDiff').classList.remove('positive','negative');
      }else{
        const diff=round(value('countedCash')-expected);
        byId('cashDiff').textContent=money(diff);
        setToneSafe(byId('cashDiff'),diff);
      }
    }

    const status=byId('automaticConferenceStatus');
    const detail=byId('automaticConferenceDetail');
    if(status){
      status.classList.remove('positive','negative');
      status.textContent=(sales||channelSales||orders||expenses)
        ? '✓ Resumo financeiro calculado • canais apenas demonstrativos'
        : 'Aguardando os lançamentos do fechamento';
    }
    if(detail)detail.textContent='Venda oficial: '+money(sales)+' • Canais (demonstrativo): '+money(channelSales)+' • Diferença demonstrativa: '+money(difference)+' • Dinheiro previsto: '+money(expected);
    const expectedHelp=byId('cashExpectedHelp');
    if(expectedHelp)expectedHelp.textContent='Previsto: Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) − retiradas = '+money(expected);
  }

  if(typeof normalize==='function'){
    const previous=normalize;
    normalize=function(record){
      const base=previous(record);
      if(!base)return base;
      return rules?.normalizeRecord
        ? rules.normalizeRecord(base,{cashCountVerified:base.cashCountVerified})
        : base;
    };
  }

  if(typeof currentRecord==='function'){
    const previous=currentRecord;
    currentRecord=function(dateOverride=null){
      const base=previous(dateOverride);
      if(!base)return base;
      const countedRaw=String(byId('countedCash')?.value??'').trim();
      return rules?.normalizeRecord
        ? rules.normalizeRecord(base,{cashCountVerified:countedRaw!==''})
        : base;
    };
  }

  if(typeof calc==='function'){
    const previous=calc;
    calc=function(){
      const result=previous.apply(this,arguments);
      updateFinancialUi();
      queueMicrotask(updateFinancialUi);
      return result;
    };
  }

  window.XB_APP_VERSION=VERSION;
  document.documentElement.dataset.appVersion=VERSION;
  function applyVersion(){
    window.XB_APP_VERSION=VERSION;
    document.documentElement.dataset.appVersion=VERSION;
    document.querySelectorAll('.reconcile').forEach(item=>{
      const label=item.querySelector('span');
      const output=item.querySelector('b');
      if(label&&output&&label.textContent.trim()==='Versão')output.textContent=VERSION;
    });
  }

  if(typeof refreshBackup==='function'){
    const previous=refreshBackup;
    refreshBackup=function(){
      const result=previous.apply(this,arguments);
      applyVersion();
      return result;
    };
  }

  document.addEventListener('input',()=>queueMicrotask(updateFinancialUi));
  document.addEventListener('change',()=>queueMicrotask(updateFinancialUi));
  window.addEventListener('pageshow',()=>setTimeout(()=>{updateFinancialUi();applyVersion();},0));

  applyVersion();
  setTimeout(()=>{try{updateFinancialUi()}catch{}},0);

  window.XBFinancialIntegrity=Object.freeze({
    version:VERSION,
    update:updateFinancialUi,
    financialSales:formFinancialSales,
    channelSales:formChannelSales
  });
})();
