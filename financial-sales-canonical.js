/* X-Burguer Caixa — venda canônica = Resumo Financeiro/Formas de pagamento
   Vendas por canal são exclusivamente demonstrativas. */
(function(){
  'use strict';

  const rules=window.XBBusinessRules;
  const byId=id=>document.getElementById(id);
  const value=id=>Number(byId(id)?.value||0);
  const round=n=>rules?.roundMoney?rules.roundMoney(n):Math.round((Number(n||0)+Number.EPSILON)*100)/100;
  const money=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  const currentFinancialSales=()=>round(value('cash')+value('deliveryCash')+value('cardOut')+value('online')+value('deliveryCard'));
  const currentChannelSales=()=>{
    try{return round(channels.reduce((total,_,i)=>total+value('v'+i),0))}catch{return 0}
  };
  const currentOrders=()=>{
    try{return channels.reduce((total,_,i)=>total+Math.max(0,Math.trunc(value('q'+i))),0)}catch{return 0}
  };
  const currentExpenses=()=>{
    try{return round(getExpenses().reduce((total,item)=>total+Number(item?.val||0),0))}catch{return 0}
  };
  const recordChannelSales=record=>rules?.channelSales?rules.channelSales(record||{}):round((record?.channels||[]).reduce((t,c)=>t+Number(c?.v||0),0));

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

  function setToneSafe(el,n){if(el&&typeof setTone==='function')setTone(el,n)}

  function updateClosingFinancialTotals(){
    const date=selectedDate();
    const prior=priorMonthRecords(date);
    const sales=currentFinancialSales();
    const channelSales=currentChannelSales();
    const orders=currentOrders();
    const expenses=currentExpenses();
    const result=round(sales-expenses);
    const priorSales=round(prior.reduce((t,r)=>t+Number(r?.sales||0),0));
    const priorResult=round(prior.reduce((t,r)=>t+Number(r?.result||0),0));
    const priorChannel=round(prior.reduce((t,r)=>t+recordChannelSales(r),0));
    const priorOrders=prior.reduce((t,r)=>t+Number(r?.orders||0),0);
    const channelDiff=round(sales-channelSales);

    if(byId('daySales'))byId('daySales').textContent=money(sales);
    if(byId('aSales'))byId('aSales').textContent=money(round(priorSales+sales));
    if(byId('dayBalance')){byId('dayBalance').textContent=money(result);setToneSafe(byId('dayBalance'),result)}
    if(byId('aBalance')){const total=round(priorResult+result);byId('aBalance').textContent=money(total);setToneSafe(byId('aBalance'),total)}

    // O painel de canais continua independente e demonstrativo.
    if(byId('ctVal'))byId('ctVal').textContent=money(channelSales);
    if(byId('ctQtd'))byId('ctQtd').textContent=orders+' pedidos';
    if(byId('ctMonthVal'))byId('ctMonthVal').textContent=money(round(priorChannel+channelSales));
    if(byId('ctMonthQtd'))byId('ctMonthQtd').textContent=(priorOrders+orders)+' até o dia';

    if(byId('paymentTotal'))byId('paymentTotal').textContent=money(sales);
    if(byId('paymentDiff')){
      byId('paymentDiff').textContent=money(channelDiff);
      byId('paymentDiff').title='Comparação apenas demonstrativa entre o Resumo Financeiro e as vendas por canal. Não altera Total de Vendas nem Resultado.';
      setToneSafe(byId('paymentDiff'),-Math.abs(channelDiff));
      if(Math.abs(channelDiff)<0.005)byId('paymentDiff').className='positive';
    }

    document.querySelectorAll('.cash-conference-item').forEach(item=>{
      const label=item.querySelector('span');
      if(label?.textContent?.trim()==='Diferença pagamentos × vendas')label.textContent='Diferença resumo × canais';
    });

    const detail=byId('automaticConferenceDetail');
    if(detail)detail.textContent='Venda financeira: '+money(sales)+' • Vendas por canal (demonstrativo): '+money(channelSales)+' • Diferença demonstrativa: '+money(channelDiff);
  }

  function fixMonthlyChannelDemonstrativeTotal(){
    try{
      const ym=byId('monthPicker')?.value||monthNow();
      const month=monthRecords(ym).map(r=>typeof normalize==='function'?normalize(r):r);
      const channelValue=round(month.reduce((t,r)=>t+recordChannelSales(r),0));
      const channelOrders=month.reduce((t,r)=>t+Number(r?.orders||0),0);
      const row=byId('monthlyChannelsTable')?.querySelector('tr.report-total-row:last-child');
      if(row?.cells?.length>=4){
        row.cells[1].textContent=String(channelOrders);
        row.cells[2].textContent=money(channelValue);
        row.cells[3].textContent=money(channelOrders?channelValue/channelOrders:0);
      }
    }catch{}
  }

  // Diferença entre canais e resumo é apenas conferência demonstrativa e não bloqueia salvamento.
  if(typeof buildSaveWarnings==='function'){
    buildSaveWarnings=function(record){
      const warnings=[];
      if(record.date>isoToday())warnings.push('• A data selecionada está no futuro.');
      if(record.cashCountVerified&&Math.abs(Number(record.cashDifference||0))>=0.01){
        warnings.push('• A contagem física da gaveta tem diferença de '+money(record.cashDifference)+'.');
      }
      return warnings;
    };
  }

  if(typeof calc==='function'){
    const previous=calc;
    calc=function(){
      const out=previous.apply(this,arguments);
      updateClosingFinancialTotals();
      queueMicrotask(updateClosingFinancialTotals);
      return out;
    };
  }

  if(typeof refreshMonthly==='function'){
    const previous=refreshMonthly;
    refreshMonthly=function(){
      const out=previous.apply(this,arguments);
      fixMonthlyChannelDemonstrativeTotal();
      queueMicrotask(fixMonthlyChannelDemonstrativeTotal);
      return out;
    };
  }

  window.addEventListener('pageshow',()=>setTimeout(()=>{
    updateClosingFinancialTotals();
    fixMonthlyChannelDemonstrativeTotal();
  },0));

  window.XBFinancialSalesCanonical=Object.freeze({
    update:updateClosingFinancialTotals,
    fixMonthlyChannels:fixMonthlyChannelDemonstrativeTotal
  });

  setTimeout(()=>{
    updateClosingFinancialTotals();
    fixMonthlyChannelDemonstrativeTotal();
  },0);
})();
