/* X-Burguer Caixa — Dinheiro (Entregas) + ajustes de campos de pães */
(function(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const value=id=>Number(byId(id)?.value||0);
  const fmt=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  function ensureDeliveryCashField(){
    if(byId('deliveryCash'))return byId('deliveryCash');
    const cash=byId('cash');
    const row=cash?.closest('.data-row');
    if(!row)return null;

    const deliveryRow=document.createElement('div');
    deliveryRow.className='data-row';
    deliveryRow.innerHTML='<span>Dinheiro (Entregas)</span><input id="deliveryCash" type="number" min="0" step="0.01" inputmode="decimal" placeholder="R$"><span class="money" id="aDeliveryCash">R$ 0,00</span>';
    row.insertAdjacentElement('afterend',deliveryRow);
    const input=byId('deliveryCash');
    if(input&&typeof onFormInput==='function')input.addEventListener('input',onFormInput);
    return input;
  }

  function fixBreadPlaceholders(){
    [['idealStart','idealProd'],['gourmetStart','gourmetProd']].forEach(([startId,finalId])=>{
      const start=byId(startId),final=byId(finalId);
      if(start)start.placeholder='Qtd';
      if(final){
        final.placeholder='Qtd';
        if(String(start?.value??'').trim()===''&&String(final.value??'').trim()==='0')final.value='';
      }
    });
  }

  ensureDeliveryCashField();
  fixBreadPlaceholders();

  if(typeof cloudToRecord==='function'){
    const previous=cloudToRecord;
    cloudToRecord=function(row){
      const record=previous(row);
      if(!record)return record;
      record.deliveryCash=Number(row?.delivery_cash_sales||0);
      record.paymentTotal=Number(record.cash||0)+Number(record.deliveryCash||0)+Number(record.cardOut||0)+Number(record.onlinePayment||0)+Number(record.deliveryCard||0);
      record.paymentDifference=record.paymentTotal-Number(record.sales||0);
      return record;
    };
  }

  if(typeof normalize==='function'){
    const previous=normalize;
    normalize=function(record){
      const normalized=previous(record);
      if(!normalized)return normalized;
      normalized.deliveryCash=Number(normalized.deliveryCash||0);
      normalized.paymentTotal=Number(normalized.cash||0)+Number(normalized.deliveryCash||0)+Number(normalized.cardOut||0)+Number(normalized.onlinePayment||0)+Number(normalized.deliveryCard||0);
      normalized.paymentDifference=normalized.paymentTotal-Number(normalized.sales||0);
      const expected=Number(normalized.cash||0)+Number(normalized.deliveryCash||0)-Number(normalized.cashOut||0);
      normalized.expectedCash=expected;
      if(normalized.cashCountVerified||Number(normalized.countedCash||0)!==0)normalized.cashDifference=Number(normalized.countedCash||0)-expected;
      return normalized;
    };
  }

  if(typeof currentRecord==='function'){
    const previous=currentRecord;
    currentRecord=function(dateOverride=null){
      const record=previous(dateOverride);
      if(!record)return record;
      record.deliveryCash=value('deliveryCash');
      record.paymentTotal=Number(record.cash||0)+Number(record.deliveryCash||0)+Number(record.cardOut||0)+Number(record.onlinePayment||0)+Number(record.deliveryCard||0);
      record.paymentDifference=record.paymentTotal-Number(record.sales||0);
      record.expectedCash=Number(record.cash||0)+Number(record.deliveryCash||0)-Number(record.cashOut||0);
      if(record.cashCountVerified||String(byId('countedCash')?.value??'').trim()!=='')record.cashDifference=Number(record.countedCash||0)-record.expectedCash;
      return record;
    };
  }

  if(typeof resetFormFields==='function'){
    const previous=resetFormFields;
    resetFormFields=function(date){
      const result=previous(date);
      const input=ensureDeliveryCashField();
      if(input)input.value='';
      fixBreadPlaceholders();
      return result;
    };
  }

  if(typeof populateForm==='function'){
    const previous=populateForm;
    populateForm=function(record,options={}){
      const normalized=record?normalize(record):record;
      const result=previous(record,options);
      const input=ensureDeliveryCashField();
      if(input)input.value=Number(normalized?.deliveryCash||0)?String(Number(normalized.deliveryCash)):'';
      try{window.XBurguerCurrency?.refresh?.()}catch{}
      fixBreadPlaceholders();
      try{calc()}catch{}
      return result;
    };
  }

  if(typeof validateRecord==='function'){
    const previous=validateRecord;
    validateRecord=function(record){
      const amount=Number(record?.deliveryCash||0);
      if(!Number.isFinite(amount)||amount<0)return'O valor de Dinheiro (Entregas) não pode ser negativo.';
      return previous(record);
    };
  }

  function updateDeliveryTotals(){
    ensureDeliveryCashField();
    const delivery=value('deliveryCash');
    const paymentTotal=value('cash')+delivery+value('cardOut')+value('online')+value('deliveryCard');
    let channelSales=0;
    try{channelSales=channels.reduce((total,_,i)=>total+value('v'+i),0)}catch{}

    if(byId('paymentTotal'))byId('paymentTotal').textContent=fmt(paymentTotal);
    if(byId('paymentDiff')){
      const diff=paymentTotal-channelSales;
      byId('paymentDiff').textContent=fmt(diff);
      if(typeof setTone==='function')setTone(byId('paymentDiff'),-Math.abs(diff));
      if(Math.abs(diff)<0.005)byId('paymentDiff').className='positive';
    }

    const selectedDate=byId('date')?.value||((typeof isoToday==='function')?isoToday():'');
    const ym=selectedDate.slice(0,7);
    let prior=[];
    try{prior=monthRecords(ym).map(normalize).filter(r=>String(r.date||'')<selectedDate)}catch{}
    const previousDelivery=prior.reduce((total,r)=>total+Number(r.deliveryCash||0),0);
    if(byId('aDeliveryCash'))byId('aDeliveryCash').textContent=fmt(previousDelivery+delivery);

    const todaySummary=value('opening')+paymentTotal;
    const previousSummary=prior.reduce((total,r)=>total+
      Number(r.opening||0)+Number(r.cash||0)+Number(r.deliveryCash||0)+Number(r.cardOut||0)+Number(r.onlinePayment||0)+Number(r.deliveryCard||0),0);
    if(byId('daySales'))byId('daySales').textContent=fmt(todaySummary);
    if(byId('aSales'))byId('aSales').textContent=fmt(previousSummary+todaySummary);

    const expected=value('cash')+delivery-value('cashOut');
    const countedRaw=String(byId('countedCash')?.value??'').trim();
    if(byId('cashDiff')){
      if(!countedRaw){
        byId('cashDiff').textContent='—';
        byId('cashDiff').classList.remove('positive','negative');
      }else{
        const diff=value('countedCash')-expected;
        byId('cashDiff').textContent=fmt(diff);
        if(typeof setTone==='function')setTone(byId('cashDiff'),diff);
      }
    }
  }

  if(typeof calc==='function'){
    const previous=calc;
    calc=function(){
      const result=previous.apply(this,arguments);
      updateDeliveryTotals();
      fixBreadPlaceholders();
      return result;
    };
  }

  if(typeof refreshDashboard==='function'){
    const previous=refreshDashboard;
    refreshDashboard=function(){
      const result=previous.apply(this,arguments);
      try{
        const month=monthRecords(monthNow()).map(normalize);
        const cashTotal=month.reduce((total,r)=>total+Number(r.cash||0)+Number(r.deliveryCash||0),0);
        if(byId('dCash'))byId('dCash').textContent=fmt(cashTotal);
      }catch{}
      return result;
    };
  }

  if(typeof refreshDailyReport==='function'){
    const previous=refreshDailyReport;
    refreshDailyReport=function(){
      const result=previous.apply(this,arguments);
      const date=byId('dailyReportDate')?.value||isoToday();
      const record=load().map(normalize).find(r=>r.date===date);
      const container=byId('dailyFinancialRows');
      if(record&&container){
        const existing=[...container.querySelectorAll('.data-row')].find(row=>row.querySelector('span')?.textContent?.trim()==='Dinheiro — entregas');
        if(existing)existing.remove();
        const cashRow=[...container.querySelectorAll('.data-row')].find(row=>row.querySelector('span')?.textContent?.trim()==='Vendas em dinheiro');
        if(cashRow)cashRow.insertAdjacentHTML('afterend',reportValueRow('Dinheiro — entregas',record.deliveryCash||0));
      }
      return result;
    };
  }

  if(typeof refreshMonthly==='function'){
    const previous=refreshMonthly;
    refreshMonthly=function(){
      const result=previous.apply(this,arguments);
      const ym=byId('monthPicker')?.value||monthNow();
      const month=monthRecords(ym).map(normalize);
      const delivery=month.reduce((total,r)=>total+Number(r.deliveryCash||0),0);
      const cashTotal=month.reduce((total,r)=>total+Number(r.cash||0)+Number(r.deliveryCash||0),0);
      if(byId('mCash'))byId('mCash').textContent=fmt(cashTotal);
      const table=byId('monthlyPaymentsTable');
      if(table){
        const existing=[...table.querySelectorAll('tr')].find(row=>row.querySelector('td')?.textContent?.trim()==='Dinheiro — entregas');
        if(existing)existing.remove();
        const cashRow=[...table.querySelectorAll('tr')].find(row=>row.querySelector('td')?.textContent?.trim()==='Dinheiro');
        if(cashRow)cashRow.insertAdjacentHTML('afterend',`<tr><td>Dinheiro — entregas</td><td><b>${fmt(delivery)}</b></td></tr>`);
      }
      return result;
    };
  }

  const exportWithDelivery=function(){
    const rows=[
      ['Data','Responsável','Vendas por canal','Despesas','Dinheiro retirado p/ despesas','Resultado','Pedidos','Saldo inicial','Dinheiro caixa','Dinheiro entregas','Cartão loja','Cartão entregas','Pix/App','Diferença Caixa','Pão Ideal Est. inicial','Pão Ideal Est. final','Pão Ideal Produção','Pão Gourmet Est. inicial','Pão Gourmet Est. final','Pão Gourmet Produção','Observações'],
      ...load().map(normalize).map(r=>{
        const b=r.breads||{};
        const idealFinal=Number(b.idealFinal??(Number(b.idealStart||0)-Number(b.idealProd||0)));
        const gourmetFinal=Number(b.gourmetFinal??(Number(b.gourmetStart||0)-Number(b.gourmetProd||0)));
        return [r.date,r.resp,r.sales,r.expense,r.cashOut||0,r.result,r.orders,r.opening||0,r.cash||0,r.deliveryCash||0,r.cardOut||0,r.deliveryCard||0,r.onlinePayment||0,r.cashDifference,b.idealStart||0,idealFinal,Number(b.idealStart||0)-idealFinal,b.gourmetStart||0,gourmetFinal,Number(b.gourmetStart||0)-gourmetFinal,r.obs];
      })
    ];
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
    download(`xburguer-caixa-${isoToday()}.csv`,csv,'text/csv;charset=utf-8');
    toast('Planilha CSV exportada.');
  };
  if(typeof exportCSV==='function')exportCSV=exportWithDelivery;

  if(typeof validateBackupRecords==='function'){
    const previous=validateBackupRecords;
    validateBackupRecords=function(records){
      const base=previous(records);
      if(base!==true)return base;
      for(let i=0;i<records.length;i++){
        const amount=records[i]?.deliveryCash;
        if(amount!==undefined&&amount!==null&&amount!==''&&(!Number.isFinite(Number(amount))||Number(amount)<0))return`Registro ${i+1} possui valor inválido em Dinheiro (Entregas).`;
      }
      return true;
    };
  }

  document.addEventListener('input',event=>{
    if(event.target?.id==='deliveryCash')queueMicrotask(updateDeliveryTotals);
  });

  setTimeout(()=>{
    ensureDeliveryCashField();
    fixBreadPlaceholders();
    try{exportCSV=exportWithDelivery}catch{}
    try{updateDeliveryTotals()}catch{}
  },0);
})();
