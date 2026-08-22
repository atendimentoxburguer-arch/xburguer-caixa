function validateRecord(rec){
  if(!rec.date)return'Defina a data do fechamento.';
  if(!rec.resp)return'Informe o responsável pelo fechamento.';
  const quantities=[...rec.channels.map(c=>c.q),rec.online.anotaQtd,rec.online.aiqQtd,rec.breads.idealStart,rec.breads.idealProd,rec.breads.gourmetStart,rec.breads.gourmetProd];
  if(quantities.some(v=>!Number.isFinite(v)||v<0||!Number.isInteger(v)))return'As quantidades devem ser números inteiros iguais ou maiores que zero.';
  const values=[rec.opening,rec.cash,rec.cardOut,rec.onlinePayment,rec.deliveryCard,rec.cashOut,rec.countedCash,...rec.channels.map(c=>c.v),rec.online.anotaVal,rec.online.aiqVal,...rec.expenses.map(e=>e.val)];
  if(values.some(v=>!Number.isFinite(v)||v<0))return'Os valores financeiros não podem ser negativos.';
  if(rec.expenses.some(e=>e.val>0&&!e.d))return'Informe a descrição de toda despesa que possui valor.';
  return true;
}

function buildSaveWarnings(rec){
  const warnings=[];
  if(rec.date>isoToday())warnings.push('• A data selecionada está no futuro.');
  if(Math.abs(Number(rec.paymentDifference||0))>=0.01)warnings.push('• Pagamentos × vendas estão diferentes em '+br(rec.paymentDifference)+'.');
  const countedRaw=String($('countedCash')?.value||'').trim();
  if(Math.abs(Number(rec.expectedCash||0))>=0.01&&!countedRaw){
    warnings.push('• O dinheiro contado no caixa ainda não foi informado.');
  }else if(countedRaw&&Math.abs(Number(rec.cashDifference||0))>=0.01){
    warnings.push('• O caixa físico tem diferença de '+br(rec.cashDifference)+'.');
  }
  return warnings;
}

function setClosingFormBusy(busy){
  document.querySelectorAll('#fechamento input,#fechamento textarea,#fechamento button').forEach(el=>el.disabled=busy);
}

async function saveDay(){
  if(saveInProgress)return;
  flushDraft(activeClosingDate);
  const rec=currentRecord(activeClosingDate),valid=validateRecord(rec);
  if(valid!==true){toast(valid,'error');return}
  if(rec.sales===0&&rec.orders===0&&rec.expense===0){
    const emptyOk=await openConfirmModal({title:'Salvar fechamento',message:'Este fechamento está sem movimento. Deseja salvar mesmo assim?',note:'Você pode cancelar para preencher os dados antes de salvar.',confirmText:'Salvar mesmo assim',badge:'Confirmação'});
    if(!emptyOk)return;
  }
  const saveWarnings=buildSaveWarnings(rec);
  if(saveWarnings.length){
    const warningOk=await openConfirmModal({
      title:'Conferência antes de salvar',
      message:saveWarnings.join('\n'),
      note:'Revise os pontos acima. Se estiverem corretos, você ainda pode salvar o fechamento.',
      confirmText:'Salvar mesmo assim',
      badge:'Atenção'
    });
    if(!warningOk)return;
  }
  const exists=load().some(r=>r.date===rec.date);
  if(exists){
    const replaceOk=await openConfirmModal({title:'Substituir fechamento',message:'Já existe um fechamento nesta data. Deseja substituir os dados salvos no banco?',note:'O fechamento anterior dessa data será atualizado.',confirmText:'Substituir',badge:'Atualização'});
    if(!replaceOk)return;
  }
  saveInProgress=true;
  setClosingFormBusy(true);
  try{
    setCloudStatus('● Salvando...','syncing');
    setDraftBadge('Salvando na nuvem...','syncing');
    await saveRecordCloud(rec);
    await loadCloudData();
    removeDraft(rec.date);
    formDirty=false;
    const fresh=load().find(r=>r.date===rec.date);
    if(fresh&&activeClosingDate===rec.date)populateForm(fresh,{source:'saved'});
    refreshAll();
    toast('Fechamento salvo e conferido na nuvem!');
  }catch(err){
    formDirty=true;
    saveDraft(rec.date,{silent:true});
    setDraftBadge('Falha ao salvar • rascunho local preservado','error');
    setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
    toast(err.message||'Não foi possível salvar no banco. Seus dados ficaram preservados neste computador.','error');
  }finally{
    saveInProgress=false;
    setClosingFormBusy(false);
  }
}

async function deleteRecord(date){
  if(deleteInProgress)return;
  const r=load().find(x=>x.date===date);
  if(!r)return;
  const ok=await openConfirmModal({title:'Excluir fechamento',message:`Deseja excluir o fechamento de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}?`,note:'Esta ação não pode ser desfeita.',confirmText:'Excluir',badge:'Exclusão'});
  if(!ok)return;
  deleteInProgress=true;
  try{
    setCloudStatus('● Excluindo...','syncing');
    await sbRest(`cash_closings?id=eq.${encodeURIComponent(r._id)}`,{method:'DELETE'});
    await loadCloudData();
    removeDraft(date);
    if(activeClosingDate===date){resetFormFields(date);formDirty=false;setDraftBadge('Fechamento excluído • formulário limpo','clean')}
    refreshAll();
    toast('Fechamento excluído do banco.');
  }catch(err){
    setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
    toast(err.message||'Não foi possível excluir este fechamento.','error');
  }finally{deleteInProgress=false}
}

function editRecord(date){flushDraft(activeClosingDate);activeClosingDate=date;$('date').value=date;loadBestRecordForDate(date,{notify:false});navigate('fechamento')}

function drawChart(targetId,records){const month=records.map(normalize);const max=Math.max(...month.flatMap(r=>[Number(r.sales||0),Number(r.expense||0)]),1);const steps=[max,max*.75,max*.5,max*.25,0];let bars='';const ym=month[0]?.date?.slice(0,7)||($('monthPicker').value||monthNow());for(let d=1;d<=31;d++){const ds=`${ym}-${String(d).padStart(2,'0')}`,r=month.find(x=>x.date===ds),s=Number(r?.sales||0),e=Number(r?.expense||0);bars+=`<div class="day-col" title="Dia ${d}: vendas ${br(s)} | despesas ${br(e)}"><div class="bar-pair"><div class="bar-sales" style="height:${Math.round(s/max*100)}%"></div><div class="bar-exp" style="height:${Math.round(e/max*100)}%"></div></div><div class="day-label">${d}</div></div>`}$(targetId).innerHTML=`<div class="chart-wrap"><div class="chart-y">${steps.map(x=>`<span>${x>=1000?(x/1000).toFixed(1)+'k':Math.round(x)}</span>`).join('')}</div><div class="chart-area"><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div><div class="bars">${bars}</div></div></div>`}

function refreshDashboard(){const ym=monthNow(),month=monthRecords(ym).map(normalize),sum=f=>month.reduce((a,r)=>a+Number(f(r)||0),0),sales=sum(r=>r.sales),exp=sum(r=>r.expense),orders=sum(r=>r.orders),days=month.filter(r=>r.sales||r.orders||r.expense).length,result=sales-exp;$('dashMonth').textContent=new Date(ym+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});$('dSales').textContent=br(sales);$('dExp').textContent=br(exp);$('dRes').textContent=br(result);setTone($('dRes'),result);$('dResultHint').textContent=result>0?'Resultado positivo':result<0?'Resultado negativo':'Sem movimento';$('dTicket').textContent=br(orders?sales/orders:0);$('dDays').textContent=days+' dias com movimento';$('dOrders').textContent=orders+' pedidos';$('dCash').textContent=br(sum(r=>r.cash));$('dCard').textContent=br(sum(r=>(r.cardOut||0)+(r.deliveryCard||0)));$('dPix').textContent=br(sum(r=>r.onlinePayment));drawChart('chart',month);const all=load().map(normalize),last=all.at(-1);if(last){$('lastSaveBadge').textContent='Último: '+new Date(last.date+'T12:00:00').toLocaleDateString('pt-BR');$('lastClosing').className='';$('lastClosing').innerHTML=`<div class="data-row"><span>Data</span><b>${new Date(last.date+'T12:00:00').toLocaleDateString('pt-BR')}</b><span></span></div><div class="data-row"><span>Responsável</span><b>${escapeHtml(last.resp||'—')}</b><span></span></div><div class="data-row"><span>Vendas</span><b class="money">${br(last.sales)}</b><span>${last.orders||0} pedidos</span></div><div class="data-row"><span>Resultado</span><b class="${last.result<0?'negative':'positive'}">${br(last.result)}</b><span></span></div>`}else{$('lastSaveBadge').textContent='Nenhum fechamento salvo';$('lastClosing').className='empty';$('lastClosing').textContent='Ainda não há fechamentos salvos.'}}

function refreshHistory(){const ym=$('historyMonth').value,q=$('historySearch').value.trim().toLowerCase();let data=load().map(normalize).slice().reverse();if(ym)data=data.filter(r=>r.date.startsWith(ym));if(q)data=data.filter(r=>(r.resp||'').toLowerCase().includes(q)||(r.obs||'').toLowerCase().includes(q));$('historyCount').textContent=data.length+' registros';$('historyTable').innerHTML=data.length?data.map(r=>`<tr><td>${new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>${escapeHtml(r.resp||'—')}</td><td>${br(r.sales)}</td><td>${br(r.expense)}</td><td class="${r.result<0?'negative':'positive'}"><b>${br(r.result)}</b></td><td>${r.orders||0}</td><td class="${r.cashDifference<0?'negative':r.cashDifference>0?'positive':''}">${br(r.cashDifference||0)}</td><td>${escapeHtml(r.obs||'')}</td><td><div class="table-actions"><button class="link-btn" onclick="editRecord('${r.date}')">Editar</button><button class="link-btn danger" onclick="deleteRecord('${r.date}')">Excluir</button></div></td></tr>`).join(''):`<tr><td colspan="9"><div class="empty">Nenhum fechamento encontrado.</div></td></tr>`}

function setReportMode(mode,scroll=true){
  const daily=mode==='daily';
  $('dailyReportTab').classList.toggle('active',daily);$('monthlyReportTab').classList.toggle('active',!daily);
  $('dailyReportPanel').classList.toggle('hidden',!daily);$('monthlyReportPanel').classList.toggle('hidden',daily);
  $('dailyReportActions').classList.toggle('hidden',!daily);$('monthlyReportActions').classList.toggle('hidden',daily);
  if(daily)refreshDailyReport();else refreshMonthly();
  if(scroll)window.scrollTo({top:0,behavior:'smooth'});
}

function reportDateBr(date){return date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}

function reportValueRow(label,value,extra=''){return `<div class="data-row"><span>${label}</span><b class="${Number(value)<0?'negative':'money'}">${br(value)}</b><span>${extra}</span></div>`}
