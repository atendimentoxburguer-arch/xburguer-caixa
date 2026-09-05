function addExpenseRow(desc='',val=0){expenseRows++;const idx=expenseRows;const row=document.createElement('div');row.className='expense-row';row.dataset.idx=idx;row.innerHTML=`<span class="expense-index">${idx}</span><input id="ed${idx}" placeholder="Descrição / fornecedor / destino" value="${escapeHtml(desc)}"><input id="ev${idx}" type="number" step="0.01" min="0" placeholder="R$" value="${Number(val||0) ? Number(val) : ''}"><button class="icon-btn" type="button" title="Remover">×</button>`;row.querySelectorAll('input').forEach(el=>el.addEventListener('input',onFormInput));row.querySelector('button').addEventListener('click',async()=>{
  const idx=row.dataset.idx;
  const desc=$('ed'+idx)?.value.trim();
  const val=n('ev'+idx);
  const detalhe=desc||val?`Deseja excluir esta despesa${desc?' — '+desc:''}${val?' ('+br(val)+')':''}?`:'Deseja excluir esta linha de despesa?';
  const ok=await openConfirmModal({title:'Excluir despesa',message:detalhe,note:'Esta linha será removida do fechamento atual.',confirmText:'Excluir',badge:'Exclusão'});
  if(!ok)return;
  row.remove();renumberExpenseRows();formDirty=true;calc();scheduleDraftSave();toast('Linha de despesa removida.');
});$('expenses').appendChild(row)}

function makeExpenses(count=14){$('expenses').innerHTML='';expenseRows=0;for(let i=0;i<count;i++)addExpenseRow();renumberExpenseRows()}

function renumberExpenseRows(){[...document.querySelectorAll('#expenses .expense-row')].forEach((row,i)=>{const badge=row.querySelector('.expense-index');if(badge)badge.textContent=i+1})}

function getExpenses(){return [...document.querySelectorAll('#expenses .expense-row')].map(row=>{const idx=row.dataset.idx;return{d:$('ed'+idx)?.value.trim()||'',val:n('ev'+idx)}}).filter(e=>e.d||e.val)}

function currentRecord(dateOverride=null){
  const q=channels.map((_,i)=>n('q'+i)),v=channels.map((_,i)=>n('v'+i));
  const expenses=getExpenses();
  const orders=q.reduce((a,b)=>a+b,0),channelSales=v.reduce((a,b)=>a+b,0),expense=expenses.reduce((a,e)=>a+e.val,0);
  const opening=n('opening'),cash=n('cash'),deliveryCash=n('deliveryCash'),cashOut=n('cashOut');
  const paymentTotal=cash+deliveryCash+n('cardOut')+n('online')+n('deliveryCard');
  const sales=paymentTotal;
  const expectedCash=opening+cash+deliveryCash-cashOut;
  const countedRaw=String($('countedCash')?.value??'').trim();
  const cashCountVerified=countedRaw!=='';
  const countedCash=cashCountVerified?n('countedCash'):0;
  const cashDifference=cashCountVerified?countedCash-expectedCash:0;
  const result=sales-expense;
  const recordDate=dateOverride||activeClosingDate||$('date').value||isoToday();
  const record={date:recordDate,resp:$('resp').value.trim(),opening,cash,deliveryCash,cardOut:n('cardOut'),onlinePayment:n('online'),deliveryCard:n('deliveryCard'),cashOut,countedCash,cashCountVerified,expectedCash,cashDifference,paymentTotal,paymentDifference:paymentTotal-channelSales,summaryTotal:paymentTotal,sales,channelSales,salesBasis:'financial-summary',orders,expense,result,balance:result,channels:channels.map((name,i)=>({name,q:q[i],v:v[i]})),online:{anotaQtd:n('anotaQtd'),anotaVal:n('anotaVal'),aiqQtd:n('aiqQtd'),aiqVal:n('aiqVal'),orders:n('anotaQtd')+n('aiqQtd'),value:n('anotaVal')+n('aiqVal')},expenses,obs:$('obs').value.trim(),breads:{idealStart:n('idealStart'),idealProd:n('idealProd'),idealOut:0,idealFinal:n('idealStart')-n('idealProd'),gourmetStart:n('gourmetStart'),gourmetProd:n('gourmetProd'),gourmetOut:0,gourmetFinal:n('gourmetStart')-n('gourmetProd')},savedAt:new Date().toISOString()};
  return window.XBBusinessRules?.normalizeRecord
    ? window.XBBusinessRules.normalizeRecord(record,{cashCountVerified})
    : record;
}

function monthRecords(ym){return load().filter(r=>(r.date||'').startsWith(ym))}

function normalize(r){
  if(!r)return r;
  if(window.XBBusinessRules?.normalizeRecord){
    return window.XBBusinessRules.normalizeRecord(r,{cashCountVerified:r.cashCountVerified});
  }
  if(r.onlinePayment===undefined)r.onlinePayment=r.pix??r.online??0;
  if(r.cardOut===undefined)r.cardOut=r.card??0;
  if(r.deliveryCash===undefined)r.deliveryCash=0;
  r.paymentTotal=Number(r.cash||0)+Number(r.deliveryCash||0)+Number(r.cardOut||0)+Number(r.onlinePayment||0)+Number(r.deliveryCard||0);
  r.channelSales=Array.isArray(r.channels)?r.channels.reduce((a,c)=>a+Number(c?.v||0),0):Number(r.channelSales||0);
  r.sales=r.paymentTotal;
  r.salesBasis='financial-summary';
  r.orders=Array.isArray(r.channels)?r.channels.reduce((a,c)=>a+Math.max(0,Math.trunc(Number(c?.q||0))),0):Math.max(0,Math.trunc(Number(r.orders||0)));
  r.expense=Array.isArray(r.expenses)?r.expenses.reduce((a,e)=>a+Number(e?.val||0),0):Number(r.expense||0);
  r.result=r.sales-r.expense;
  r.balance=r.result;
  r.paymentDifference=r.paymentTotal-r.channelSales;
  r.summaryTotal=r.paymentTotal;
  r.expectedCash=Number(r.opening||0)+Number(r.cash||0)+Number(r.deliveryCash||0)-Number(r.cashOut||0);
  if(r.cashCountVerified===undefined)r.cashCountVerified=Number(r.countedCash||0)!==0;
  if(r.cashCountVerified)r.cashDifference=Number(r.countedCash||0)-r.expectedCash;
  else{r.countedCash=0;r.cashDifference=0}
  if(!r.breads)r.breads={};
  if(r.breads.idealOut===undefined)r.breads.idealOut=0;
  if(r.breads.gourmetOut===undefined)r.breads.gourmetOut=0;
  if(r.breads.idealFinal===undefined)r.breads.idealFinal=Number(r.breads.idealStart||0)-Number(r.breads.idealProd||0);
  if(r.breads.gourmetFinal===undefined)r.breads.gourmetFinal=Number(r.breads.gourmetStart||0)-Number(r.breads.gourmetProd||0);
  return r;
}

function calc(){
  const channelSales=channels.reduce((a,_,i)=>a+n('v'+i),0),orders=channels.reduce((a,_,i)=>a+n('q'+i),0),expense=getExpenses().reduce((a,e)=>a+e.val,0);
  const onlinePeriod=n('anotaVal')+n('aiqVal'),onlineOrders=n('anotaQtd')+n('aiqQtd');
  const paymentTotal=n('cash')+n('deliveryCash')+n('cardOut')+n('online')+n('deliveryCard');
  const sales=paymentTotal;
  const paymentDiff=sales-channelSales;
  const expectedCash=n('opening')+n('cash')+n('deliveryCash')-n('cashOut');
  const countedRaw=String($('countedCash')?.value??'').trim();
  const cashDiff=countedRaw?n('countedCash')-expectedCash:0;
  const result=sales-expense;
  $('ctQtd').textContent=orders+' pedidos';$('ctVal').textContent=br(channelSales);$('dayExp').textContent=br(expense);$('expenseTotal').textContent=br(expense);$('daySales').textContent=br(sales);$('dayBalance').textContent=br(result);setTone($('dayBalance'),result);
  $('periodOrders').textContent=onlineOrders+' pedidos';$('periodValue').textContent=br(onlinePeriod);$('paymentTotal').textContent=br(sales);$('paymentDiff').textContent=br(paymentDiff);$('paymentDiff').classList.remove('positive','negative');
  if(countedRaw){$('cashDiff').textContent=br(cashDiff);setTone($('cashDiff'),cashDiff)}else{$('cashDiff').textContent='—';$('cashDiff').classList.remove('positive','negative')}
  const selectedDate=$('date').value||isoToday(),ym=selectedDate.slice(0,7),month=monthRecords(ym).filter(r=>r.date!==selectedDate).map(normalize),priorMonth=month.filter(r=>r.date<selectedDate);
  const sum=f=>priorMonth.reduce((a,r)=>a+Number(f(r)||0),0);
  channels.forEach((_,i)=>{
    const priorQtd=priorMonth.reduce((a,r)=>a+Number(r.channels?.[i]?.q||0),0);
    const priorVal=priorMonth.reduce((a,r)=>a+Number(r.channels?.[i]?.v||0),0);
    $('cq'+i).textContent=(priorQtd+n('q'+i))+' pedidos';
    $('cv'+i).textContent=br(priorVal+n('v'+i));
  });
  $('ctMonthQtd').textContent=(priorMonth.reduce((a,r)=>a+Number(r.orders||0),0)+orders)+' até o dia';
  $('ctMonthVal').textContent=br(priorMonth.reduce((a,r)=>a+Number(r.channelSales||0),0)+channelSales);
  const expenseAccum=sum(r=>r.expense)+expense,cashOutAccum=sum(r=>r.cashOut)+n('cashOut');
  $('aOpening').textContent=br(n('opening'));$('aCash').textContent=br(sum(r=>r.cash)+n('cash'));if($('aDeliveryCash'))$('aDeliveryCash').textContent=br(sum(r=>r.deliveryCash)+n('deliveryCash'));$('aCardOut').textContent=br(sum(r=>r.cardOut)+n('cardOut'));$('aOnline').textContent=br(sum(r=>r.onlinePayment)+n('online'));$('aDeliveryCard').textContent=br(sum(r=>r.deliveryCard)+n('deliveryCard'));$('aExpense').textContent=br(expenseAccum);$('aCashOut').textContent=br(cashOutAccum);$('expenseMonthTotal').textContent=br(expenseAccum);$('aSales').textContent=br(sum(r=>r.sales)+sales);$('aBalance').textContent=br(sum(r=>r.result)+result);setTone($('aBalance'),sum(r=>r.result)+result);
  const priorOnline=priorMonth.reduce((a,r)=>a+Number(r.online?.value||0),0);const priorOnlineQ=priorMonth.reduce((a,r)=>a+Number(r.online?.orders||0),0);$('onlineTotalVal').textContent=br(priorOnline+onlinePeriod);$('onlineTotalQtd').textContent=(priorOnlineQ+onlineOrders)+' pedidos';
}

function draftKey(date){return DRAFT_PREFIX+date}

function readDraft(date){
  if(!date)return null;
  try{return JSON.parse(localStorage.getItem(draftKey(date))||'null')}catch{return null}
}

function removeDraft(date){
  if(!date)return;
  try{localStorage.removeItem(draftKey(date));updateSyncUi()}catch{}
}

function migrateLegacyDraft(){
  let raw=null;
  try{raw=localStorage.getItem(LEGACY_DRAFT_KEY)}catch{return false}
  if(!raw)return true;

  let legacy=null;
  try{legacy=JSON.parse(raw)}catch{
    try{localStorage.removeItem(LEGACY_DRAFT_KEY)}catch{}
    return false;
  }
  if(!legacy?.date){
    try{localStorage.removeItem(LEGACY_DRAFT_KEY)}catch{}
    return false;
  }

  try{
    const target=draftKey(legacy.date);
    if(!localStorage.getItem(target))localStorage.setItem(target,JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    return true;
  }catch(err){
    console.warn('X-Burguer Caixa: rascunho legado preservado porque a migração local falhou.',err);
    return false;
  }
}

function draftIsNewer(draft,saved){
  if(!draft)return false;
  if(!saved)return true;
  const d=Date.parse(draft.savedAt||0),s=Date.parse(saved.savedAt||0);
  return Number.isFinite(d)&&(!Number.isFinite(s)||d>s+500);
}

function setDraftBadge(text,state=''){
  const el=$('draftBadge');if(!el)return;
  el.textContent=text;
  el.dataset.state=state;
}

function saveDraft(date=activeClosingDate,{silent=false}={}){
  if(!date)return false;
  try{
    const record=currentRecord(date);
    localStorage.setItem(draftKey(date),JSON.stringify(record));
    updateSyncUi();
    if(!silent)setDraftBadge('Rascunho salvo automaticamente','draft');
    return true;
  }catch{
    if(!silent)setDraftBadge('Não foi possível salvar o rascunho local','error');
    return false;
  }
}

function scheduleDraftSave(){
  clearTimeout(draftTimer);
  draftTimer=setTimeout(()=>{draftTimer=null;saveDraft(activeClosingDate)},180);
}

function flushDraft(date=activeClosingDate){
  clearTimeout(draftTimer);draftTimer=null;
  if(formDirty&&date)saveDraft(date,{silent:true});
}

function onFormInput(){
  formDirty=true;
  calc();
  scheduleDraftSave();
}

function resetFormFields(date){
  const targetDate=date||isoToday();
  $('resp').value='';
  ['opening','cash','deliveryCash','cardOut','online','deliveryCard','cashOut','countedCash','anotaVal','aiqVal'].forEach(id=>{if($(id))$(id).value=''});
  ['idealStart','idealProd','gourmetStart','gourmetProd','anotaQtd','aiqQtd'].forEach(id=>$(id).value='');
  $('obs').value='';
  channels.forEach((_,i)=>{$('q'+i).value='';$('v'+i).value=''});
  makeExpenses(14);
  $('date').value=targetDate;
  activeClosingDate=targetDate;
  calc();
}

function clearForm(keepDate=true){
  const date=keepDate?($('date').value||activeClosingDate||isoToday()):isoToday();
  clearTimeout(draftTimer);draftTimer=null;
  removeDraft(date);
  resetFormFields(date);
  formDirty=false;
  setDraftBadge('Formulário limpo • pronto para preencher','clean');
}

function populateForm(rec,{source='saved'}={}){
  const r=normalize(rec);if(!r)return false;
  clearTimeout(draftTimer);draftTimer=null;
  const date=r.date||isoToday();
  resetFormFields(date);
  $('resp').value=r.resp||'';
  $('opening').value=r.opening||'';$('cash').value=r.cash||'';if($('deliveryCash'))$('deliveryCash').value=r.deliveryCash||'';$('cardOut').value=r.cardOut||'';$('online').value=r.onlinePayment||'';$('deliveryCard').value=r.deliveryCard||'';$('cashOut').value=r.cashOut||'';$('countedCash').value=r.cashCountVerified?(r.countedCash??0):'';
  channels.forEach((_,i)=>{$('q'+i).value=r.channels?.[i]?.q||'';$('v'+i).value=r.channels?.[i]?.v||''});
  $('anotaQtd').value=r.online?.anotaQtd||'';$('anotaVal').value=r.online?.anotaVal||'';$('aiqQtd').value=r.online?.aiqQtd||'';$('aiqVal').value=r.online?.aiqVal||'';
  $('idealStart').value=r.breads?.idealStart||'';$('idealProd').value=r.breads?.idealProd||'';$('gourmetStart').value=r.breads?.gourmetStart||'';$('gourmetProd').value=r.breads?.gourmetProd||'';
  $('obs').value=r.obs||'';
  makeExpenses(Math.max(14,r.expenses?.length||0));
  (r.expenses||[]).forEach((e,i)=>{const row=[...document.querySelectorAll('#expenses .expense-row')][i];if(row){const idx=row.dataset.idx;$('ed'+idx).value=e.d||'';$('ev'+idx).value=e.val||''}});
  calc();
  formDirty=source==='draft';
  setDraftBadge(source==='draft'?'Rascunho desta data recuperado':'Fechamento salvo carregado',source);
  return true;
}

function loadBestRecordForDate(date,{notify=false}={}){
  if(!date)return 'empty';
  const saved=load().map(normalize).find(r=>r.date===date)||null;
  const draft=readDraft(date);
  if(draftIsNewer(draft,saved)){
    populateForm(draft,{source:'draft'});
    if(notify)toast('Rascunho de '+reportDateBr(date)+' recuperado.');
    return 'draft';
  }
  if(saved){
    if(draft)removeDraft(date);
    populateForm(saved,{source:'saved'});
    if(notify)toast('Fechamento de '+reportDateBr(date)+' carregado.');
    return 'saved';
  }
  if(draft){
    populateForm(draft,{source:'draft'});
    if(notify)toast('Rascunho de '+reportDateBr(date)+' recuperado.');
    return 'draft';
  }
  resetFormFields(date);
  formDirty=false;
  setDraftBadge('Novo fechamento • campos limpos','new');
  if(notify)toast('Novo dia selecionado. Campos limpos para o fechamento.');
  return 'empty';
}

function handleClosingDateChange(){
  const selected=$('date').value;
  const previous=activeClosingDate||isoToday();
  if(!selected){
    $('date').value=previous;
    toast('A data do fechamento não pode ficar vazia.','error');
    return;
  }
  if(selected===previous){calc();return}
  if(formDirty)flushDraft(previous);
  activeClosingDate=selected;
  loadBestRecordForDate(selected,{notify:true});
  $('date').classList.remove('date-switched');
  void $('date').offsetWidth;
  $('date').classList.add('date-switched');
}

function loadIntoForm(rec){return populateForm(rec,{source:'saved'})}

function restoreInitialClosing(){
  migrateLegacyDraft();
  const date=$('date').value||isoToday();
  activeClosingDate=date;
  return loadBestRecordForDate(date,{notify:false});
}
