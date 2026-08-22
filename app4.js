function refreshDailyReport(){
  const date=$('dailyReportDate').value||isoToday(),rec=load().map(normalize).find(r=>r.date===date);
  $('dailyReportEmpty').classList.toggle('hidden',!!rec);$('dailyReportContent').classList.toggle('hidden',!rec);$('dailyReportEditBtn').disabled=!rec;
  if(!rec)return;
  const r=rec,expenses=Array.isArray(r.expenses)?r.expenses:[],paymentTotal=Number(r.paymentTotal??((r.cash||0)+(r.cardOut||0)+(r.onlinePayment||0)+(r.deliveryCard||0))),expectedCash=Number(r.expectedCash??((r.opening||0)+(r.cash||0)-(r.cashOut||0))),cashDiff=Number(r.cashDifference??((r.countedCash||0)-expectedCash)),paymentDiff=Number(r.paymentDifference??(paymentTotal-(r.sales||0)));
  $('drSales').textContent=br(r.sales);$('drOrders').textContent=(r.orders||0)+' pedidos';$('drExpenses').textContent=br(r.expense);$('drExpenseCount').textContent=expenses.length+' lançamentos';$('drResult').textContent=br(r.result);setTone($('drResult'),r.result);$('drCashDiff').textContent=br(cashDiff);setTone($('drCashDiff'),cashDiff);$('drCashStatus').textContent=cashDiff===0?'Caixa conferido':cashDiff>0?'Sobra de caixa':'Falta de caixa';
  $('drDate').textContent=reportDateBr(r.date);$('drResponsible').textContent=r.resp||'—';
  $('dailyFinancialRows').innerHTML=[
    reportValueRow('Saldo inicial',r.opening),reportValueRow('Vendas em dinheiro',r.cash),reportValueRow('Cartão — loja',r.cardOut),reportValueRow('Pix / app',r.onlinePayment),reportValueRow('Cartão — entregas',r.deliveryCard),reportValueRow('Total informado em pagamentos',paymentTotal,paymentDiff===0?'Conferido':`Dif. ${br(paymentDiff)}`),reportValueRow('Despesas do dia',r.expense,'Saída'),reportValueRow('Dinheiro retirado p/ despesas',r.cashOut,'Saída do caixa'),reportValueRow('Dinheiro esperado',expectedCash),reportValueRow('Dinheiro contado',r.countedCash),reportValueRow('Diferença do caixa',cashDiff,cashDiff===0?'Conferido':cashDiff>0?'Sobra':'Falta'),reportValueRow('Resultado do dia',r.result)
  ].join('');
  const rChannels=channels.map((name,i)=>{const c=r.channels?.[i]||{},q=Number(c.q||0),v=Number(c.v||0);return `<tr><td><b>${escapeHtml(c.name||name)}</b></td><td>${q}</td><td>${br(v)}</td><td>${br(q?v/q:0)}</td></tr>`});
  const cq=(r.channels||[]).reduce((a,c)=>a+Number(c.q||0),0),cv=(r.channels||[]).reduce((a,c)=>a+Number(c.v||0),0);rChannels.push(`<tr class="report-total-row"><td>TOTAL</td><td>${cq}</td><td>${br(cv)}</td><td>${br(cq?cv/cq:0)}</td></tr>`);$('dailyChannelsTable').innerHTML=rChannels.join('');
  const online=r.online||{};$('dailyOnlineTable').innerHTML=`<tr><td>Anota Aí</td><td>${Number(online.anotaQtd||0)}</td><td>${br(online.anotaVal||0)}</td></tr><tr><td>Aiqfome</td><td>${Number(online.aiqQtd||0)}</td><td>${br(online.aiqVal||0)}</td></tr><tr class="report-total-row"><td>TOTAL</td><td>${Number(online.anotaQtd||0)+Number(online.aiqQtd||0)}</td><td>${br(Number(online.anotaVal||0)+Number(online.aiqVal||0))}</td></tr>`;
  const b=r.breads||{};$('dailyBreadTable').innerHTML=`<tr><td>Pão Ideal</td><td>${Number(b.idealStart||0)}</td><td>${Number(b.idealProd||0)}</td></tr><tr><td>Pão Gourmet</td><td>${Number(b.gourmetStart||0)}</td><td>${Number(b.gourmetProd||0)}</td></tr>`;
  $('dailyExpensesTable').innerHTML=expenses.length?expenses.map((e,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(e.d||'—')}</td><td>${br(e.val||0)}</td></tr>`).join('')+`<tr class="report-total-row"><td colspan="2">TOTAL</td><td>${br(r.expense)}</td></tr>`:`<tr><td colspan="3"><div class="empty">Nenhuma despesa registrada neste dia.</div></td></tr>`;
  $('dailyObservation').textContent=r.obs||'Sem observações.';
}

function refreshMonthly(){
  const ym=$('monthPicker').value||monthNow(),month=monthRecords(ym).map(normalize).sort((a,b)=>a.date.localeCompare(b.date)),sum=f=>month.reduce((a,r)=>a+Number(f(r)||0),0),sales=sum(r=>r.sales),exp=sum(r=>r.expense),result=sales-exp,orders=sum(r=>r.orders),days=month.filter(r=>r.sales||r.orders||r.expense).length,dt=new Date(ym+'-01T12:00:00'),name=dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),expenses=month.flatMap(r=>(r.expenses||[]).map(e=>({date:r.date,...e}))),last=month.at(-1);
  $('mSales').textContent=br(sales);$('mOrders').textContent=orders+' pedidos';$('mExp').textContent=br(exp);$('mExpenseCount').textContent=expenses.length+' lançamentos';$('mRes').textContent=br(result);setTone($('mRes'),result);$('mResHint').textContent=result>0?'Resultado positivo':result<0?'Resultado negativo':'Sem movimento';$('mAvg').textContent=br(days?sales/days:0);$('mDays').textContent=days+' dias com movimento';$('mCash').textContent=br(sum(r=>r.cash));$('mCard').textContent=br(sum(r=>(r.cardOut||0)+(r.deliveryCard||0)));$('mOnline').textContent=br(sum(r=>r.onlinePayment));$('monthTitle').textContent=name.charAt(0).toUpperCase()+name.slice(1);$('extractTitle').textContent='Extrato diário detalhado — '+name;
  $('monthlyChannelsTable').innerHTML=channels.map((name,i)=>{const q=month.reduce((a,r)=>a+Number(r.channels?.[i]?.q||0),0),v=month.reduce((a,r)=>a+Number(r.channels?.[i]?.v||0),0);return `<tr><td><b>${escapeHtml(name)}</b></td><td>${q}</td><td>${br(v)}</td><td>${br(q?v/q:0)}</td></tr>`}).join('')+`<tr class="report-total-row"><td>TOTAL</td><td>${orders}</td><td>${br(sales)}</td><td>${br(orders?sales/orders:0)}</td></tr>`;
  const payments=[['Dinheiro',sum(r=>r.cash)],['Cartão — loja',sum(r=>r.cardOut)],['Cartão — entregas',sum(r=>r.deliveryCard)],['Pix / app',sum(r=>r.onlinePayment)],['Total informado em pagamentos',sum(r=>Number(r.paymentTotal??((r.cash||0)+(r.cardOut||0)+(r.onlinePayment||0)+(r.deliveryCard||0))))],['Despesas',exp],['Dinheiro retirado p/ despesas',sum(r=>r.cashOut)],['Diferenças de caixa (líquido)',sum(r=>r.cashDifference)]];$('monthlyPaymentsTable').innerHTML=payments.map(([l,v])=>`<tr><td>${l}</td><td class="${Number(v)<0?'negative':''}"><b>${br(v)}</b></td></tr>`).join('');
  const anotaQ=sum(r=>r.online?.anotaQtd),anotaV=sum(r=>r.online?.anotaVal),aiqQ=sum(r=>r.online?.aiqQtd),aiqV=sum(r=>r.online?.aiqVal);$('monthlyOnlineTable').innerHTML=`<tr><td>Anota Aí</td><td>${anotaQ}</td><td>${br(anotaV)}</td></tr><tr><td>Aiqfome</td><td>${aiqQ}</td><td>${br(aiqV)}</td></tr><tr class="report-total-row"><td>TOTAL</td><td>${anotaQ+aiqQ}</td><td>${br(anotaV+aiqV)}</td></tr>`;
  $('monthlyBreadTable').innerHTML=`<tr><td>Pão Ideal</td><td>${sum(r=>r.breads?.idealProd)}</td></tr><tr><td>Pão Gourmet</td><td>${sum(r=>r.breads?.gourmetProd)}</td></tr>`;
  $('monthTable').innerHTML=month.length?month.map(r=>`<tr><td>${reportDateBr(r.date)}</td><td>${escapeHtml(r.resp||'—')}</td><td>${br(r.sales)}</td><td>${br(r.cash)}</td><td>${br(r.cardOut)}</td><td>${br(r.deliveryCard)}</td><td>${br(r.onlinePayment)}</td><td>${br(r.expense)}</td><td>${br(r.cashOut)}</td><td class="${r.result<0?'negative':'positive'}"><b>${br(r.result)}</b></td><td>${r.orders||0}</td><td class="${r.cashDifference<0?'negative':r.cashDifference>0?'positive':''}">${br(r.cashDifference||0)}</td><td>${escapeHtml(r.obs||'')}</td></tr>`).join(''):`<tr><td colspan="13"><div class="empty">Nenhum fechamento registrado neste mês.</div></td></tr>`;
  $('monthlyExpensesTable').innerHTML=expenses.length?expenses.map(e=>`<tr><td>${reportDateBr(e.date)}</td><td>${escapeHtml(e.d||'—')}</td><td>${br(e.val||0)}</td></tr>`).join('')+`<tr class="report-total-row"><td colspan="2">TOTAL DE DESPESAS</td><td>${br(exp)}</td></tr>`:`<tr><td colspan="3"><div class="empty">Nenhuma despesa registrada neste mês.</div></td></tr>`;
  drawChart('monthChart',month);
}

function printActiveReport(){window.print()}

function refreshBackup(){
  $('storageRecords').textContent=load().length;
  $('lastBackup').textContent=localStorage.getItem(BACKUP_KEY)||'Nunca';
  updateSyncUi();
}

function refreshAll(){refreshDashboard();refreshHistory();refreshDailyReport();refreshMonthly();refreshBackup();calc()}

const pageCfg={dashboard:['Dashboard','Visão geral do seu negócio'],fechamento:['Fechamento do Dia','Registre e confira o caixa diário'],historico:['Histórico','Consulte e ajuste fechamentos'],mensal:['Relatórios','Relatório diário e mensal detalhado'],backup:['Backup','Exportação e restauração de dados']};

function navigate(page){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$(page).classList.remove('hidden');$('topTitle').textContent=pageCfg[page][0];$('topSub').textContent=pageCfg[page][1];closeMenu();if(page==='historico')refreshHistory();if(page==='mensal'){refreshDailyReport();refreshMonthly();}if(page==='backup')refreshBackup();window.scrollTo({top:0,behavior:'smooth'})}

function openMenu(){$('sidebar').classList.add('open');$('overlay').classList.add('show')}function closeMenu(){$('sidebar').classList.remove('open');$('overlay').classList.remove('show')}

async function manualSync(){
  if(manualSyncInProgress)return;
  if(!authSession){toast('Entre no sistema para sincronizar.','error');return}
  manualSyncInProgress=true;
  if($('syncBtn'))$('syncBtn').disabled=true;
  if($('syncBackupBtn'))$('syncBackupBtn').disabled=true;
  if(formDirty)flushDraft(activeClosingDate);
  try{
    setCloudStatus('● Sincronizando...','syncing');
    await loadCloudData();
    // Não sobrescreve o formulário enquanto existem alterações locais não salvas.
    if(!formDirty)loadBestRecordForDate(activeClosingDate||$('date').value||isoToday(),{notify:false});
    refreshAll();
    toast(formDirty?'Nuvem sincronizada. Seu rascunho atual foi mantido.':'Dados sincronizados com sucesso.');
  }catch(err){
    setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
    toast(err.message||'Não foi possível sincronizar agora.','error');
  }finally{
    manualSyncInProgress=false;
    if($('syncBtn'))$('syncBtn').disabled=false;
    if($('syncBackupBtn'))$('syncBackupBtn').disabled=false;
  }
}

function exportJSON(){const data={version:4.11,exportedAt:new Date().toISOString(),records:load()};download(`xburguer-backup-${isoToday()}.json`,JSON.stringify(data,null,2),'application/json');const now=new Date().toLocaleString('pt-BR');localStorage.setItem(BACKUP_KEY,now);refreshBackup();toast('Backup JSON exportado.')}

function exportCSV(){const rows=[['Data','Responsável','Vendas','Despesas','Dinheiro retirado p/ despesas','Resultado','Pedidos','Dinheiro','Cartões','Pix/App','Diferença Caixa','Pão Ideal Est. inicial','Pão Ideal Produção','Pão Gourmet Est. inicial','Pão Gourmet Produção','Observações'],...load().map(normalize).map(r=>[r.date,r.resp,r.sales,r.expense,r.cashOut||0,r.result,r.orders,r.cash,(r.cardOut||0)+(r.deliveryCard||0),r.onlinePayment,r.cashDifference,r.breads?.idealStart||0,r.breads?.idealProd||0,r.breads?.gourmetStart||0,r.breads?.gourmetProd||0,r.obs])];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');download(`xburguer-caixa-${isoToday()}.csv`,csv,'text/csv;charset=utf-8');toast('Planilha CSV exportada.')}

function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

function validateBackupRecords(records){
  if(!Array.isArray(records))return'O arquivo não contém uma lista de fechamentos.';
  for(let i=0;i<records.length;i++){
    const r=records[i];
    if(!r||typeof r!=='object')return`Registro ${i+1} do backup é inválido.`;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')))return`Registro ${i+1} está sem uma data válida.`;
  }
  return true;
}
