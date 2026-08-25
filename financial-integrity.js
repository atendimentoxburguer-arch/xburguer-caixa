/* X-Burguer Caixa — integridade financeira consolidada v4.18.3
   Regra central:
   - Saldo Inicial NÃO é venda e NÃO é forma de pagamento.
   - Vendas = soma exclusiva dos canais.
   - Pagamentos = dinheiro + dinheiro entregas + cartões + Pix/apps.
   - Dinheiro esperado = saldo inicial + dinheiro + dinheiro entregas - retiradas.
   - Saldo inicial do próximo dia continua derivado do dinheiro que permanece no caixa. */
(function(){
  'use strict';

  const VERSION='4.18.3';
  const rules=window.XBBusinessRules;
  const byId=id=>document.getElementById(id);
  const value=id=>Number(byId(id)?.value||0);
  const money=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const round=n=>rules?.roundMoney?rules.roundMoney(n):Math.round((Number(n||0)+Number.EPSILON)*100)/100;

  function formSales(){
    try{return round(channels.reduce((total,_,i)=>total+value('v'+i),0))}catch{return 0}
  }

  function formOrders(){
    try{return channels.reduce((total,_,i)=>total+Math.max(0,Math.trunc(value('q'+i))),0)}catch{return 0}
  }

  function formExpenses(){
    try{return round(getExpenses().reduce((total,item)=>total+Number(item?.val||0),0))}catch{return 0}
  }

  function formPayments(){
    return round(value('cash')+value('deliveryCash')+value('cardOut')+value('online')+value('deliveryCard'));
  }

  function formExpectedCash(){
    return round(value('opening')+value('cash')+value('deliveryCash')-value('cashOut'));
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
    if(!el)return;
    if(typeof setTone==='function')setTone(el,n);
  }

  function updateFinancialUi(){
    const date=selectedDate();
    const prior=priorMonthRecords(date);
    const sales=formSales();
    const orders=formOrders();
    const expenses=formExpenses();
    const payments=formPayments();
    const paymentDiff=round(payments-sales);
    const result=round(sales-expenses);
    const expected=formExpectedCash();

    const priorSales=round(prior.reduce((t,r)=>t+Number(r?.sales||0),0));
    const priorOrders=prior.reduce((t,r)=>t+Number(r?.orders||0),0);
    const priorResult=round(prior.reduce((t,r)=>t+Number(r?.result||0),0));

    // Saldo inicial fica visível e separado, mas não é acumulado como receita.
    if(byId('aOpening')){
      byId('aOpening').textContent=money(value('opening'));
      byId('aOpening').title='Saldo inicial do dia selecionado. Não é venda e não é somado à receita do mês.';
    }

    if(byId('daySales'))byId('daySales').textContent=money(sales);
    if(byId('aSales'))byId('aSales').textContent=money(priorSales+sales);
    if(byId('ctVal'))byId('ctVal').textContent=money(sales);
    if(byId('ctQtd'))byId('ctQtd').textContent=orders+' pedidos';
    if(byId('ctMonthVal'))byId('ctMonthVal').textContent=money(priorSales+sales);
    if(byId('ctMonthQtd'))byId('ctMonthQtd').textContent=(priorOrders+orders)+' até o dia';

    if(byId('paymentTotal'))byId('paymentTotal').textContent=money(payments);
    if(byId('paymentDiff')){
      byId('paymentDiff').textContent=money(paymentDiff);
      setToneSafe(byId('paymentDiff'),-Math.abs(paymentDiff));
      if(Math.abs(paymentDiff)<0.005)byId('paymentDiff').className='positive';
    }

    if(byId('dayBalance')){
      byId('dayBalance').textContent=money(result);
      setToneSafe(byId('dayBalance'),result);
    }
    if(byId('aBalance')){
      const monthResult=round(priorResult+result);
      byId('aBalance').textContent=money(monthResult);
      setToneSafe(byId('aBalance'),monthResult);
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

    // Ajuda visual sem transformar saldo inicial em venda.
    const status=byId('automaticConferenceStatus');
    const detail=byId('automaticConferenceDetail');
    if(status){
      if(Math.abs(sales)<0.005&&Math.abs(payments)<0.005)status.textContent='Aguardando os lançamentos do fechamento';
      else if(Math.abs(paymentDiff)<0.005)status.textContent='✓ Vendas e pagamentos conferidos automaticamente';
      else status.textContent=paymentDiff>0
        ? 'Atenção: pagamentos estão '+money(Math.abs(paymentDiff))+' acima das vendas'
        : 'Atenção: faltam '+money(Math.abs(paymentDiff))+' nas formas de pagamento';
    }
    if(detail)detail.textContent='Vendas por canal: '+money(sales)+' • Formas de pagamento: '+money(payments)+' • Dinheiro previsto na gaveta: '+money(expected);
    const expectedHelp=byId('cashExpectedHelp');
    if(expectedHelp)expectedHelp.textContent='Previsto: Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) − retiradas = '+money(expected);
  }

  // Garante dados canônicos mesmo que módulos legados tenham calculado antes.
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
      // Alguns módulos antigos atualizam a tela em microtask; esta segunda passagem
      // garante que a regra canônica seja sempre a última exibida.
      queueMicrotask(updateFinancialUi);
      return result;
    };
  }

  if(typeof refreshDashboard==='function'){
    const previous=refreshDashboard;
    refreshDashboard=function(){
      const result=previous.apply(this,arguments);
      try{
        const month=monthRecords(monthNow()).map(normalize);
        const sales=round(month.reduce((t,r)=>t+Number(r.sales||0),0));
        const expenses=round(month.reduce((t,r)=>t+Number(r.expense||0),0));
        const orders=month.reduce((t,r)=>t+Number(r.orders||0),0);
        const monthResult=round(sales-expenses);
        if(byId('dSales'))byId('dSales').textContent=money(sales);
        if(byId('dExp'))byId('dExp').textContent=money(expenses);
        if(byId('dRes')){byId('dRes').textContent=money(monthResult);setToneSafe(byId('dRes'),monthResult);}
        if(byId('dTicket'))byId('dTicket').textContent=money(orders?sales/orders:0);
        if(byId('dCash'))byId('dCash').textContent=money(month.reduce((t,r)=>t+Number(r.cash||0)+Number(r.deliveryCash||0),0));
      }catch{}
      return result;
    };
  }

  if(typeof refreshDailyReport==='function'){
    const previous=refreshDailyReport;
    refreshDailyReport=function(){
      const result=previous.apply(this,arguments);
      const date=byId('dailyReportDate')?.value||((typeof isoToday==='function')?isoToday():'');
      try{
        const record=load().map(normalize).find(r=>r.date===date);
        if(record&&byId('drSales'))byId('drSales').textContent=money(record.sales||0);
      }catch{}
      return result;
    };
  }

  if(typeof refreshMonthly==='function'){
    const previous=refreshMonthly;
    refreshMonthly=function(){
      const result=previous.apply(this,arguments);
      try{
        const ym=byId('monthPicker')?.value||monthNow();
        const month=monthRecords(ym).map(normalize);
        const sales=round(month.reduce((t,r)=>t+Number(r.sales||0),0));
        if(byId('mSales'))byId('mSales').textContent=money(sales);
      }catch{}
      return result;
    };
  }

  // Atualiza a versão exibida sem depender de módulos antigos.
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

  // delivery-cash.js possui atualização assíncrona legada; executamos depois dela.
  document.addEventListener('input',()=>queueMicrotask(()=>queueMicrotask(updateFinancialUi)));
  document.addEventListener('change',()=>queueMicrotask(()=>queueMicrotask(updateFinancialUi)));
  window.addEventListener('pageshow',()=>setTimeout(()=>{updateFinancialUi();applyVersion();},0));

  applyVersion();
  setTimeout(()=>{
    try{updateFinancialUi()}catch{}
  },0);

  window.XBFinancialIntegrity=Object.freeze({version:VERSION,update:updateFinancialUi});
})();
