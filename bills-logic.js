/* X-Burguer Caixa — regras puras de boletos v2 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.XBBillLogic=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const DAY_MS=86400000;
  const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
  const PRIORITY_WEIGHT={overdue:0,today:1,d1:2,d2:3,d3:4,upcoming:5,paid:6,cancelled:7,invalid:8};

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

  function addDaysISO(value,days){
    const serial=dateSerial(value);
    if(!Number.isFinite(serial))return '';
    const date=new Date((serial+Number(days||0))*DAY_MS);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  }

  function addMonthsISO(value,months){
    const text=normalizeDate(value);
    if(!text)return '';
    const [y,m,d]=text.split('-').map(Number);
    const first=new Date(Date.UTC(y,m-1+Number(months||0),1));
    const year=first.getUTCFullYear(),month=first.getUTCMonth();
    const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    const day=Math.min(d,lastDay);
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function foldText(value){
    return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
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

  function matchesSearch(bill,query){
    const needle=foldText(query);
    if(!needle)return true;
    const amount=Number(bill?.amount||0);
    const haystack=[
      bill?.supplier,bill?.description,bill?.digitable_line,bill?.notes,bill?.due_date,
      Number.isFinite(amount)?amount.toFixed(2):'',
      Number.isFinite(amount)?amount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''
    ].map(foldText).join(' | ');
    return haystack.includes(needle);
  }

  function inDateRange(bill,from,to){
    const due=normalizeDate(bill?.due_date);
    if(!due)return !from&&!to;
    const start=normalizeDate(from),end=normalizeDate(to);
    if(start&&due<start)return false;
    if(end&&due>end)return false;
    return true;
  }

  function filterBills(rows,options={},today=todayLocal()){
    const list=Array.isArray(rows)?rows:[];
    const filter=String(options.filter||'pending');
    return list.filter(item=>{
      const status=String(item?.status||'pending');
      const state=stateForBill(item,today);
      let accepted=true;
      if(filter==='pending')accepted=status==='pending';
      else if(filter==='attention')accepted=status==='pending'&&['overdue','today','d1','d2','d3'].includes(state.key);
      else if(filter==='overdue')accepted=status==='pending'&&state.key==='overdue';
      else if(filter==='today')accepted=status==='pending'&&state.key==='today';
      else if(filter==='week')accepted=status==='pending'&&Number.isFinite(state.days)&&state.days>=0&&state.days<=7;
      else if(filter==='paid')accepted=status==='paid';
      else if(filter==='cancelled')accepted=status==='cancelled';
      else if(filter==='all')accepted=true;
      if(!accepted)return false;
      if(!matchesSearch(item,options.query))return false;
      if(!inDateRange(item,options.from,options.to))return false;
      return true;
    });
  }

  function compareDate(a,b,direction=1){
    const da=normalizeDate(a?.due_date),db=normalizeDate(b?.due_date);
    if(!da&&!db)return 0;if(!da)return 1;if(!db)return -1;
    return da.localeCompare(db)*direction;
  }

  function compareSupplier(a,b,direction=1){
    return String(a?.supplier||'').localeCompare(String(b?.supplier||''),'pt-BR',{sensitivity:'base'})*direction;
  }

  function sortBills(rows,today=todayLocal(),mode='priority'){
    const list=[...(Array.isArray(rows)?rows:[])];
    return list.sort((a,b)=>{
      let diff=0;
      if(mode==='due_asc')diff=compareDate(a,b,1);
      else if(mode==='due_desc')diff=compareDate(a,b,-1);
      else if(mode==='supplier_asc')diff=compareSupplier(a,b,1);
      else if(mode==='supplier_desc')diff=compareSupplier(a,b,-1);
      else if(mode==='amount_desc')diff=(Number(b?.amount||0)-Number(a?.amount||0));
      else if(mode==='amount_asc')diff=(Number(a?.amount||0)-Number(b?.amount||0));
      else if(mode==='created_desc')diff=String(b?.created_at||'').localeCompare(String(a?.created_at||''));
      else if(mode==='created_asc')diff=String(a?.created_at||'').localeCompare(String(b?.created_at||''));
      else{
        const sa=stateForBill(a,today),sb=stateForBill(b,today);
        diff=(PRIORITY_WEIGHT[sa.key]??9)-(PRIORITY_WEIGHT[sb.key]??9);
        if(!diff)diff=compareDate(a,b,1);
      }
      if(diff)return diff;
      const supplier=compareSupplier(a,b,1);if(supplier)return supplier;
      return String(a?.id||'').localeCompare(String(b?.id||''));
    });
  }

  function monthKey(value){
    const text=normalizeDate(value);
    return text?text.slice(0,7):'';
  }

  function monthLabel(value){
    const key=String(value||'').length===7?String(value):monthKey(value);
    if(!/^\d{4}-\d{2}$/.test(key))return 'Sem data';
    const [year,month]=key.split('-').map(Number);
    const label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
    return label.charAt(0).toUpperCase()+label.slice(1);
  }

  function groupDescriptor(bill,today,mode){
    const status=String(bill?.status||'pending');
    const state=stateForBill(bill,today);
    if(mode==='none')return {key:'all',label:'Todos os boletos',tone:'neutral',rank:0};
    if(mode==='supplier'){
      const supplier=String(bill?.supplier||'Sem fornecedor').trim()||'Sem fornecedor';
      return {key:`supplier:${foldText(supplier)}`,label:supplier,tone:'neutral',rank:0};
    }
    if(mode==='month'){
      const key=monthKey(bill?.due_date);
      const rank=key?Number(key.replace('-','')):999999;
      return {key:`month:${key||'invalid'}`,label:monthLabel(key),tone:'neutral',rank};
    }
    if(mode==='status'){
      if(status==='paid')return {key:'status:paid',label:'Pagos',tone:'paid',rank:2};
      if(status==='cancelled')return {key:'status:cancelled',label:'Cancelados',tone:'muted',rank:3};
      return {key:'status:pending',label:'Pendentes',tone:'neutral',rank:1};
    }

    if(status==='paid')return {key:'due:paid',label:'Pagos',tone:'paid',rank:900000};
    if(status==='cancelled')return {key:'due:cancelled',label:'Cancelados',tone:'muted',rank:900001};
    if(state.key==='invalid')return {key:'due:invalid',label:'Sem data válida',tone:'danger',rank:899999};
    if(state.key==='overdue')return {key:'due:overdue',label:'Atrasados',tone:'danger',rank:0};
    if(state.days===0)return {key:'due:today',label:'Hoje',tone:'danger',rank:1};
    if(state.days===1)return {key:'due:tomorrow',label:'Amanhã',tone:'warning',rank:2};
    if(state.days>=2&&state.days<=3)return {key:'due:next3',label:'Próximos 3 dias',tone:'warning',rank:3};
    if(state.days>=4&&state.days<=7)return {key:'due:next7',label:'Próximos 7 dias',tone:'neutral',rank:4};
    const key=monthKey(bill?.due_date);
    const rank=10000+(key?Number(key.replace('-','')):999999);
    return {key:`due:month:${key||'invalid'}`,label:monthLabel(key),tone:'neutral',rank};
  }

  function groupBills(rows,today=todayLocal(),mode='due'){
    const groups=new Map();
    for(const item of Array.isArray(rows)?rows:[]){
      const descriptor=groupDescriptor(item,today,mode);
      if(!groups.has(descriptor.key))groups.set(descriptor.key,{...descriptor,items:[],total:0,count:0});
      const group=groups.get(descriptor.key);
      group.items.push(item);group.count+=1;group.total+=Number(item?.amount||0);
    }
    const result=[...groups.values()];
    if(mode==='supplier')result.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{sensitivity:'base'}));
    else result.sort((a,b)=>a.rank-b.rank||a.label.localeCompare(b.label,'pt-BR',{sensitivity:'base'}));
    return result;
  }

  function summarize(rows,today=todayLocal()){
    const list=Array.isArray(rows)?rows:[];
    const pending=list.filter(item=>String(item?.status||'pending')==='pending');
    const states=pending.map(item=>({item,state:stateForBill(item,today)}));
    const attention=states.filter(({state})=>['overdue','today','d1','d2','d3'].includes(state.key));
    const next7=states.filter(({state})=>Number.isFinite(state.days)&&state.days>=0&&state.days<=7);
    const overdue=states.filter(({state})=>state.key==='overdue');
    const todayRows=states.filter(({state})=>state.key==='today');
    const paid=list.filter(item=>item?.status==='paid');
    return {
      pendingCount:pending.length,
      pendingAmount:pending.reduce((sum,item)=>sum+Number(item?.amount||0),0),
      attentionCount:attention.length,
      attentionAmount:attention.reduce((sum,{item})=>sum+Number(item?.amount||0),0),
      overdueCount:overdue.length,
      overdueAmount:overdue.reduce((sum,{item})=>sum+Number(item?.amount||0),0),
      dueTodayCount:todayRows.length,
      dueTodayAmount:todayRows.reduce((sum,{item})=>sum+Number(item?.amount||0),0),
      next7Count:next7.length,
      next7Amount:next7.reduce((sum,{item})=>sum+Number(item?.amount||0),0),
      paidCount:paid.length,
      paidAmount:paid.reduce((sum,item)=>sum+Number(item?.paid_amount??item?.amount??0),0),
      cancelledCount:list.filter(item=>item?.status==='cancelled').length
    };
  }

  return {
    normalizeDate,todayLocal,dateSerial,daysUntil,addDaysISO,addMonthsISO,foldText,
    stateForBill,reminderMessage,validateDraft,matchesSearch,inDateRange,filterBills,
    sortBills,monthKey,monthLabel,groupBills,summarize
  };
});
