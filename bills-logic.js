/* X-Burguer Caixa — regras puras de boletos v1 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.XBBillLogic=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const DAY_MS=86400000;
  const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;

  function normalizeDate(value){
    const text=String(value||'').slice(0,10);
    return ISO_DATE.test(text)?text:'';
  }

  function todayLocal(now=new Date()){
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }

  function dateSerial(value){
    const text=normalizeDate(value);
    if(!text)return NaN;
    const [y,m,d]=text.split('-').map(Number);
    return Date.UTC(y,m-1,d)/DAY_MS;
  }

  function daysUntil(dueDate,today=todayLocal()){
    const due=dateSerial(dueDate),base=dateSerial(today);
    if(!Number.isFinite(due)||!Number.isFinite(base))return NaN;
    return Math.round(due-base);
  }

  function stateForBill(bill,today=todayLocal()){
    const status=String(bill?.status||'pending');
    if(status==='paid')return {key:'paid',label:'Pago',tone:'paid',days:null};
    if(status==='cancelled')return {key:'cancelled',label:'Cancelado',tone:'muted',days:null};
    const days=daysUntil(bill?.due_date,today);
    if(!Number.isFinite(days))return {key:'invalid',label:'Data inválida',tone:'danger',days:null};
    if(days<0)return {key:'overdue',label:`Atrasado ${Math.abs(days)} dia${Math.abs(days)===1?'':'s'}`,tone:'danger',days};
    if(days===0)return {key:'today',label:'Vence hoje',tone:'danger',days};
    if(days===1)return {key:'d1',label:'Vence amanhã',tone:'warning',days};
    if(days===2)return {key:'d2',label:'Vence em 2 dias',tone:'warning',days};
    if(days===3)return {key:'d3',label:'Vence em 3 dias',tone:'warning',days};
    return {key:'upcoming',label:`Vence em ${days} dias`,tone:'neutral',days};
  }

  function reminderMessage(bill,today=todayLocal()){
    const state=stateForBill(bill,today);
    const supplier=String(bill?.supplier||'Boleto').trim()||'Boleto';
    const amount=Number(bill?.amount||0);
    const value=amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const lead=state.key==='today'?'Vence hoje':state.key==='d1'?'Vence amanhã':state.key==='d2'?'Vence em 2 dias':state.key==='d3'?'Vence em 3 dias':state.label;
    return {title:`${lead} • ${supplier}`,body:`${value}${bill?.description?` — ${String(bill.description).trim()}`:''}`,state};
  }

  function validateDraft(draft){
    if(!String(draft?.supplier||'').trim())return 'Informe o fornecedor.';
    const amount=Number(draft?.amount||0);
    if(!Number.isFinite(amount)||amount<=0)return 'Informe um valor maior que zero.';
    if(!normalizeDate(draft?.due_date))return 'Informe uma data de vencimento válida.';
    const line=String(draft?.digitable_line||'').replace(/\s/g,'');
    if(line&&line.length<10)return 'A linha digitável parece incompleta.';
    return true;
  }

  function sortBills(rows,today=todayLocal()){
    const weight={overdue:0,today:1,d1:2,d2:3,d3:4,upcoming:5,paid:6,cancelled:7,invalid:8};
    return [...(Array.isArray(rows)?rows:[])].sort((a,b)=>{
      const sa=stateForBill(a,today),sb=stateForBill(b,today);
      const diff=(weight[sa.key]??9)-(weight[sb.key]??9);
      if(diff)return diff;
      const byDate=String(a?.due_date||'').localeCompare(String(b?.due_date||''));
      if(byDate)return byDate;
      return String(a?.supplier||'').localeCompare(String(b?.supplier||''),'pt-BR');
    });
  }

  function summarize(rows,today=todayLocal()){
    const list=Array.isArray(rows)?rows:[];
    const pending=list.filter(item=>String(item?.status||'pending')==='pending');
    const states=pending.map(item=>stateForBill(item,today));
    return {
      pendingCount:pending.length,
      pendingAmount:pending.reduce((sum,item)=>sum+Number(item?.amount||0),0),
      attentionCount:states.filter(item=>['overdue','today','d1','d2','d3'].includes(item.key)).length,
      overdueCount:states.filter(item=>item.key==='overdue').length,
      dueTodayCount:states.filter(item=>item.key==='today').length,
      paidCount:list.filter(item=>item?.status==='paid').length
    };
  }

  return {normalizeDate,todayLocal,daysUntil,stateForBill,reminderMessage,validateDraft,sortBills,summarize};
});
