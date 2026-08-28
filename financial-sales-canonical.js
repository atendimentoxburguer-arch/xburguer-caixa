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
  const recordFinancialSales=record=>{
    if(rules?.financialSummaryTotal)return round(rules.financialSummaryTotal(record||{}));
    if(Number.isFinite(Number(record?.summaryTotal)))return round(record.summaryTotal);
    if(Number.isFinite(Number(record?.paymentTotal)))return round(record.paymentTotal);
    return round(Number(record?.cash||0)+Number(record?.deliveryCash||0)+Number(record?.cardOut||0)+Number(record?.onlinePayment||0)+Number(record?.deliveryCard||0));
  };
  const recordChannelSales=record=>rules?.channelSales?round(rules.channelSales(record||{})):round((record?.channels||[]).reduce((t,c)=>t+Number(c?.v||0),0));

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
  function normalizeRecord(record){return typeof normalize==='function'?normalize(record):record}

  function updateClosingFinancialTotals(){
    const date=selectedDate();
    const prior=priorMonthRecords(date);
    const sales=currentFinancialSales();
    const channelSales=currentChannelSales();
    const orders=currentOrders();
    const expenses=currentExpenses();
    const result=round(sales-expenses);
    const priorSales=round(prior.reduce((t,r)=>t+recordFinancialSales(r),0));
    const priorResult=round(prior.reduce((t,r)=>t+round(recordFinancialSales(r)-Number(r?.expense||0)),0));
    const priorChannel=round(prior.reduce((t,r)=>t+recordChannelSales(r),0));
    const priorOrders=prior.reduce((t,r)=>t+Number(r?.orders||0),0);
    const channelDiff=round(sales-channelSales);

    if(byId('daySales')){
      byId('daySales').textContent=money(sales);
      byId('daySales').title='Total de Vendas = soma exclusiva do Resumo Financeiro.';
    }
    if(byId('aSales'))byId('aSales').textContent=money(round(priorSales+sales));
    if(byId('dayBalance')){byId('dayBalance').textContent=money(result);setToneSafe(byId('dayBalance'),result)}
    if(byId('aBalance')){const total=round(priorResult+result);byId('aBalance').textContent=money(total);setToneSafe(byId('aBalance'),total)}

    // O painel de canais é independente: informa origem dos pedidos, não receita financeira.
    if(byId('ctVal'))byId('ctVal').textContent=money(channelSales);
    if(byId('ctQtd'))byId('ctQtd').textContent=orders+' pedidos';
    if(byId('ctMonthVal'))byId('ctMonthVal').textContent=money(round(priorChannel+channelSales));
    if(byId('ctMonthQtd'))byId('ctMonthQtd').textContent=(priorOrders+orders)+' até o dia';

    if(byId('paymentTotal')){
      byId('paymentTotal').textContent=money(sales);
      byId('paymentTotal').title='Venda oficial do fechamento, calculada pelas formas de pagamento.';
    }
    if(byId('paymentDiff')){
      byId('paymentDiff').textContent=money(channelDiff);
      byId('paymentDiff').title='Comparação somente demonstrativa entre o Resumo Financeiro e os canais. Não entra em Venda, Resultado ou Ticket.';
      byId('paymentDiff').classList.remove('positive','negative');
    }

    document.querySelectorAll('.cash-conference-item').forEach(item=>{
      const label=item.querySelector('span');
      const text=label?.textContent?.trim();
      if(text==='Pagamentos informados'||text==='Venda do Resumo Financeiro')label.textContent='Venda do Resumo Financeiro';
      if(text==='Diferença pagamentos × vendas'||text==='Diferença resumo × canais'||text==='Diferença resumo × canais (demonstrativo)')label.textContent='Diferença resumo × canais (demonstrativo)';
    });

    const status=byId('automaticConferenceStatus');
    if(status){
      status.classList.remove('positive','negative');
      status.textContent=(sales||channelSales||orders||expenses)
        ? '✓ Resumo financeiro calculado • canais apenas demonstrativos'
        : 'Aguardando os lançamentos do fechamento';
    }
    const detail=byId('automaticConferenceDetail');
    if(detail)detail.textContent='Venda oficial: '+money(sales)+' • Vendas por canal (demonstrativo): '+money(channelSales)+' • Diferença demonstrativa: '+money(channelDiff);
  }

  function fixDailyReport(){
    try{
      const date=byId('dailyReportDate')?.value||((typeof isoToday==='function')?isoToday():'');
      const record=(typeof load==='function'?load():[]).map(normalizeRecord).find(r=>r?.date===date);
      if(!record)return;
      const sales=recordFinancialSales(record);
      const expenses=round(Number(record.expense||0));
      const result=round(sales-expenses);
      if(byId('drSales'))byId('drSales').textContent=money(sales);
      if(byId('drResult')){byId('drResult').textContent=money(result);setToneSafe(byId('drResult'),result)}
      document.querySelectorAll('#dailyFinancialRows .data-row').forEach(row=>{
        const label=row.querySelector('span');
        const amount=row.querySelector('b');
        const extra=row.querySelector('span:last-child');
        const text=label?.textContent?.trim();
        if(text==='Total informado em pagamentos'||text==='Total de vendas (Resumo Financeiro)'){
          label.textContent='Total de vendas (Resumo Financeiro)';
          if(amount)amount.textContent=money(sales);
          if(extra)extra.textContent='Venda oficial';
        }
        if(text==='Resultado do dia'&&amount)amount.textContent=money(result);
      });
    }catch{}
  }

  function fixMonthlyReport(){
    try{
      const ym=byId('monthPicker')?.value||((typeof monthNow==='function')?monthNow():'');
      const month=(typeof monthRecords==='function'?monthRecords(ym):[]).map(normalizeRecord);
      const sales=round(month.reduce((t,r)=>t+recordFinancialSales(r),0));
      const expenses=round(month.reduce((t,r)=>t+Number(r?.expense||0),0));
      const result=round(sales-expenses);
      const channelValue=round(month.reduce((t,r)=>t+recordChannelSales(r),0));
      const channelOrders=month.reduce((t,r)=>t+Number(r?.orders||0),0);

      if(byId('mSales'))byId('mSales').textContent=money(sales);
      if(byId('mRes')){byId('mRes').textContent=money(result);setToneSafe(byId('mRes'),result)}

      // O TOTAL da tabela de canais deve somar apenas os próprios canais.
      const channelRow=byId('monthlyChannelsTable')?.querySelector('tr.report-total-row:last-child');
      if(channelRow?.cells?.length>=4){
        channelRow.cells[1].textContent=String(channelOrders);
        channelRow.cells[2].textContent=money(channelValue);
        channelRow.cells[3].textContent=money(channelOrders?channelValue/channelOrders:0);
      }

      document.querySelectorAll('#monthlyPaymentsTable tr').forEach(row=>{
        const label=row.cells?.[0];
        const amount=row.cells?.[1]?.querySelector('b')||row.cells?.[1];
        const text=label?.textContent?.trim();
        if(text==='Total informado em pagamentos'||text==='Total de vendas (Resumo Financeiro)'){
          label.textContent='Total de vendas (Resumo Financeiro)';
          if(amount)amount.textContent=money(sales);
        }
      });
    }catch{}
  }

  // Diferença entre canais e resumo é apenas conferência demonstrativa e não bloqueia salvamento.
  if(typeof buildSaveWarnings==='function'){
    buildSaveWarnings=function(record){
      const warnings=[];
      if(record?.date>isoToday())warnings.push('• A data selecionada está no futuro.');
      if(record?.cashCountVerified&&Math.abs(Number(record.cashDifference||0))>=0.01){
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
      queueMicrotask(()=>queueMicrotask(updateClosingFinancialTotals));
      return out;
    };
  }

  if(typeof refreshDailyReport==='function'){
    const previous=refreshDailyReport;
    refreshDailyReport=function(){
      const out=previous.apply(this,arguments);
      fixDailyReport();
      queueMicrotask(fixDailyReport);
      return out;
    };
  }

  if(typeof refreshMonthly==='function'){
    const previous=refreshMonthly;
    refreshMonthly=function(){
      const out=previous.apply(this,arguments);
      fixMonthlyReport();
      queueMicrotask(fixMonthlyReport);
      return out;
    };
  }

  // Este módulo carrega por último entre as regras financeiras. Reaplica a regra canônica
  // após os listeners legados para impedir que um cálculo antigo sobrescreva a tela.
  function enforceAfterLegacyHandlers(){
    queueMicrotask(()=>queueMicrotask(updateClosingFinancialTotals));
    setTimeout(updateClosingFinancialTotals,0);
  }
  document.addEventListener('input',enforceAfterLegacyHandlers);
  document.addEventListener('change',enforceAfterLegacyHandlers);

  window.addEventListener('pageshow',()=>setTimeout(()=>{
    updateClosingFinancialTotals();
    fixDailyReport();
    fixMonthlyReport();
  },0));

  window.XBFinancialSalesCanonical=Object.freeze({
    update:updateClosingFinancialTotals,
    fixDailyReport,
    fixMonthlyReport
  });

  setTimeout(()=>{
    updateClosingFinancialTotals();
    fixDailyReport();
    fixMonthlyReport();
  },0);
})();
