/* X-Burguer Caixa — separação do Resumo Financeiro
   O campo Venda do resumo usa exclusivamente as formas de pagamento.
   Vendas por canal continuam independentes e preservam seus próprios totais. */
(function(){
  'use strict';

  const rules=window.XBBusinessRules;
  const byId=id=>document.getElementById(id);
  const value=id=>Number(byId(id)?.value||0);
  const round=n=>rules?.roundMoney?rules.roundMoney(n):Math.round((Number(n||0)+Number.EPSILON)*100)/100;
  const money=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  function selectedDate(){
    return byId('date')?.value||((typeof isoToday==='function')?isoToday():'');
  }

  function currentFinancialSales(){
    return round(
      value('cash')+
      value('deliveryCash')+
      value('cardOut')+
      value('online')+
      value('deliveryCard')
    );
  }

  function recordFinancialSales(record={}){
    if(rules?.financialSummaryTotal)return round(rules.financialSummaryTotal(record));
    if(Number.isFinite(Number(record.summaryTotal)))return round(record.summaryTotal);
    if(Number.isFinite(Number(record.paymentTotal)))return round(record.paymentTotal);
    return round(
      Number(record.cash||0)+
      Number(record.deliveryCash||0)+
      Number(record.cardOut||0)+
      Number(record.onlinePayment||0)+
      Number(record.deliveryCard||0)
    );
  }

  function priorMonthRecords(date){
    if(!date)return[];
    try{
      return monthRecords(date.slice(0,7))
        .map(record=>typeof normalize==='function'?normalize(record):record)
        .filter(record=>String(record?.date||'')<date);
    }catch{return[]}
  }

  function updateFinancialSummarySales(){
    const date=selectedDate();
    const current=currentFinancialSales();
    const prior=priorMonthRecords(date);
    const accumulated=round(prior.reduce((total,record)=>total+recordFinancialSales(record),0)+current);

    const daySales=byId('daySales');
    if(daySales){
      daySales.textContent=money(current);
      daySales.title='Venda do Resumo Financeiro = soma das formas de pagamento. Vendas por canal são calculadas separadamente.';
    }

    const accumulatedSales=byId('aSales');
    if(accumulatedSales){
      accumulatedSales.textContent=money(accumulated);
      accumulatedSales.title='Venda acumulada do Resumo Financeiro = soma das formas de pagamento dos fechamentos do mês.';
    }
  }

  if(typeof calc==='function'){
    const previous=calc;
    calc=function(){
      const result=previous.apply(this,arguments);
      updateFinancialSummarySales();
      queueMicrotask(updateFinancialSummarySales);
      queueMicrotask(()=>queueMicrotask(updateFinancialSummarySales));
      return result;
    };
  }

  document.addEventListener('input',()=>queueMicrotask(()=>queueMicrotask(updateFinancialSummarySales)));
  document.addEventListener('change',()=>queueMicrotask(()=>queueMicrotask(updateFinancialSummarySales)));
  window.addEventListener('pageshow',()=>setTimeout(updateFinancialSummarySales,0));

  window.XBFinancialSummarySeparation=Object.freeze({update:updateFinancialSummarySales});
  setTimeout(updateFinancialSummarySales,0);
})();
