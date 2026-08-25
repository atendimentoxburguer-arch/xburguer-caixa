/* X-Burguer Caixa — regras de negócio canônicas v4.18.2
   Módulo puro: não acessa DOM, rede, localStorage ou Supabase. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.XBBusinessRules=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='4.18.2';
  const num=value=>{
    const n=Number(value??0);
    return Number.isFinite(n)?n:0;
  };
  const roundMoney=value=>Math.round((num(value)+Number.EPSILON)*100)/100;

  function paymentTotal(record={}){
    return roundMoney(
      num(record.cash)+
      num(record.deliveryCash)+
      num(record.cardOut)+
      num(record.onlinePayment)+
      num(record.deliveryCard)
    );
  }

  function expectedCash(record={}){
    return roundMoney(num(record.cash)+num(record.deliveryCash)-num(record.cashOut));
  }

  function nextOpeningBalance(previousRecord={}){
    return Math.max(0,roundMoney(
      num(previousRecord.opening)+
      num(previousRecord.cash)+
      num(previousRecord.deliveryCash)-
      num(previousRecord.cashOut)
    ));
  }

  function isFirstDayOfMonth(date){
    return /^\d{4}-\d{2}-01$/.test(String(date||''));
  }

  function financialSummaryTotal(record={}){
    return paymentTotal(record);
  }

  function channelSales(record={}){
    if(Array.isArray(record.channels)){
      return roundMoney(record.channels.reduce((total,item)=>total+num(item?.v),0));
    }
    return roundMoney(record.sales);
  }

  function channelOrders(record={}){
    if(Array.isArray(record.channels)){
      return record.channels.reduce((total,item)=>total+Math.max(0,Math.trunc(num(item?.q))),0);
    }
    return Math.max(0,Math.trunc(num(record.orders)));
  }

  function expenseTotal(record={}){
    if(Array.isArray(record.expenses)){
      return roundMoney(record.expenses.reduce((total,item)=>total+num(item?.val),0));
    }
    return roundMoney(record.expense);
  }

  function breadState(startValue,finalValue){
    const start=Math.trunc(num(startValue));
    const final=Math.trunc(num(finalValue));
    return {start,final,production:start-final,out:0};
  }

  function canonicalBread(breads={},prefix='ideal'){
    const start=Math.trunc(num(breads?.[prefix+'Start']));
    const rawFinal=breads?.[prefix+'Final'];
    const hasFinal=rawFinal!==undefined&&rawFinal!==null&&rawFinal!=='';
    const final=hasFinal
      ? Math.trunc(num(rawFinal))
      : start-Math.trunc(num(breads?.[prefix+'Prod']));
    return breadState(start,final);
  }

  function normalizeBreads(breads={}){
    const ideal=canonicalBread(breads,'ideal');
    const gourmet=canonicalBread(breads,'gourmet');
    return {
      ...breads,
      idealStart:ideal.start,
      idealFinal:ideal.final,
      idealProd:ideal.production,
      idealOut:0,
      gourmetStart:gourmet.start,
      gourmetFinal:gourmet.final,
      gourmetProd:gourmet.production,
      gourmetOut:0
    };
  }

  function applyCashVerification(record={},verifiedOverride){
    const out={...record};
    const expected=expectedCash(out);
    let verified=verifiedOverride;
    if(verified===undefined){
      verified=out.cashCountVerified!==undefined
        ? !!out.cashCountVerified
        : num(out.countedCash)!==0;
    }
    out.cashCountVerified=!!verified;
    out.expectedCash=expected;
    if(out.cashCountVerified){
      out.countedCash=roundMoney(out.countedCash);
      out.cashDifference=roundMoney(num(out.countedCash)-expected);
    }else{
      out.countedCash=0;
      out.cashDifference=0;
    }
    return out;
  }

  function normalizeRecord(record={},options={}){
    if(!record||typeof record!=='object')return record;
    let out={...record};

    out.opening=roundMoney(out.opening);
    out.cash=roundMoney(out.cash);
    out.deliveryCash=roundMoney(out.deliveryCash);
    out.cardOut=roundMoney(out.cardOut);
    out.onlinePayment=roundMoney(out.onlinePayment??out.pix??out.online);
    out.deliveryCard=roundMoney(out.deliveryCard);
    out.cashOut=roundMoney(out.cashOut);

    if(Array.isArray(out.channels)){
      out.channels=out.channels.map(item=>({
        ...item,
        q:Math.max(0,Math.trunc(num(item?.q))),
        v:roundMoney(item?.v)
      }));
    }
    if(Array.isArray(out.expenses)){
      out.expenses=out.expenses.map(item=>({...item,val:roundMoney(item?.val)}));
    }

    out.sales=channelSales(out);
    out.orders=channelOrders(out);
    out.expense=expenseTotal(out);
    out.result=roundMoney(out.sales-out.expense);
    out.balance=out.result;
    out.paymentTotal=paymentTotal(out);
    out.paymentDifference=roundMoney(out.paymentTotal-out.sales);
    out.summaryTotal=financialSummaryTotal(out);
    out.breads=normalizeBreads(out.breads||{});
    out=applyCashVerification(out,options.cashCountVerified);
    return out;
  }

  function validateCanonicalRecord(record={}){
    const r=normalizeRecord(record,{cashCountVerified:record.cashCountVerified});
    const money=[r.opening,r.cash,r.deliveryCash,r.cardOut,r.onlinePayment,r.deliveryCard,r.cashOut,r.countedCash];
    if(money.some(value=>!Number.isFinite(value)||value<0))return'Os valores financeiros não podem ser negativos.';

    for(const [label,prefix] of [['Pão Ideal','ideal'],['Pão Gourmet','gourmet']]){
      const b=canonicalBread(r.breads,prefix);
      if(b.start<0||b.final<0)return`O estoque do ${label} não pode ser negativo.`;
      if(b.final>b.start)return`O estoque final do ${label} não pode ser maior que o estoque inicial.`;
    }
    return true;
  }

  function aggregate(records=[]){
    return records.map(r=>normalizeRecord(r,{cashCountVerified:r?.cashCountVerified})).reduce((acc,r)=>{
      acc.opening=roundMoney(acc.opening+r.opening);
      acc.cash=roundMoney(acc.cash+r.cash);
      acc.deliveryCash=roundMoney(acc.deliveryCash+r.deliveryCash);
      acc.cardOut=roundMoney(acc.cardOut+r.cardOut);
      acc.onlinePayment=roundMoney(acc.onlinePayment+r.onlinePayment);
      acc.deliveryCard=roundMoney(acc.deliveryCard+r.deliveryCard);
      acc.sales=roundMoney(acc.sales+r.sales);
      acc.expense=roundMoney(acc.expense+r.expense);
      acc.result=roundMoney(acc.result+r.result);
      acc.paymentTotal=roundMoney(acc.paymentTotal+r.paymentTotal);
      acc.summaryTotal=roundMoney(acc.summaryTotal+r.summaryTotal);
      acc.orders+=r.orders;
      return acc;
    },{opening:0,cash:0,deliveryCash:0,cardOut:0,onlinePayment:0,deliveryCard:0,sales:0,expense:0,result:0,paymentTotal:0,summaryTotal:0,orders:0});
  }

  return {
    VERSION,
    num,
    roundMoney,
    paymentTotal,
    expectedCash,
    nextOpeningBalance,
    isFirstDayOfMonth,
    financialSummaryTotal,
    channelSales,
    channelOrders,
    expenseTotal,
    breadState,
    canonicalBread,
    normalizeBreads,
    applyCashVerification,
    normalizeRecord,
    validateCanonicalRecord,
    aggregate
  };
});
