/* X-Burguer Caixa — Boletos e notificações v2 */
(function(){
  'use strict';

  const logic=window.XBBillLogic;
  if(!logic){console.error('X-Burguer Caixa: bills-logic.js não foi carregado.');return;}

  const VAPID_PUBLIC_KEY='BHpQG83aS2LXf3bHpBj82NE9eEHXwB9Fd6aFqe2rXnGkfKdZEYl-avtSodQ8Lm6IXSWMcTaD2CqiibbyZir0TWw';
  const CACHE_KEY='xburguer_bills_cache_v1';
  const E2E_KEY='xb_e2e_bills_v1';
  const E2E_PUSH_KEY='xb_e2e_bills_push_v1';
  const UI_KEY='xburguer_bills_ui_v2';

  let rows=[];
  let activeFilter='pending';
  let editingId=null;
  let loading=false;
  let searchQuery='';
  let dateFrom='';
  let dateTo='';
  let pendingFocusId='';

  const savedUi=readUi();
  let sortMode=savedUi.sortMode||'priority';
  let groupMode=savedUi.groupMode||'due';

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBr=value=>value?new Date(String(value).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
  const dateLong=value=>value?new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(value).slice(0,10)+'T12:00:00')):'Sem data';

  function readUi(){try{const data=JSON.parse(localStorage.getItem(UI_KEY)||'{}');return data&&typeof data==='object'?data:{}}catch{return{}}}
  function saveUi(){try{localStorage.setItem(UI_KEY,JSON.stringify({sortMode,groupMode}))}catch{}}
  function readCache(){try{const data=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
  function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}}
  function readE2E(){try{const data=JSON.parse(localStorage.getItem(E2E_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
  function writeE2E(data){localStorage.setItem(E2E_KEY,JSON.stringify(data))}

  function injectNav(){
    if(document.querySelector('[data-page="boletos"]'))return;
    const nav=byId('nav');if(!nav)return;
    const button=document.createElement('button');
    button.type='button';button.dataset.page='boletos';
    button.innerHTML='<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/><circle cx="17" cy="17" r="3"/><path d="M17 15.5V17l1 1"/></svg></span><div><strong>Boletos</strong><span>Contas e vencimentos</span></div><span id="billsNavBadge" class="bills-nav-badge" hidden>0</span>';
    const backup=nav.querySelector('[data-page="backup"]');
    nav.insertBefore(button,backup||null);
    button.addEventListener('click',()=>{
      try{navigate('boletos')}catch{}
      refreshBills();
    });
  }

  function injectPage(){
    if(byId('boletos'))return;
    const wrap=document.querySelector('.page-wrap');if(!wrap)return;
    const section=document.createElement('section');
    section.id='boletos';section.className='page hidden';
    section.innerHTML=`
      <div class="page-head bills-page-head">
        <div><h2>Boletos e contas a pagar</h2><p class="sub">Organize por vencimento, fornecedor, valor ou status e encontre rapidamente o que precisa pagar.</p></div>
        <span class="badge" id="billsPageBadge">Nenhuma urgência</span>
      </div>

      <div class="cards bills-cards" aria-label="Resumo dos boletos">
        <button type="button" class="card bills-summary-card" data-bill-quick-filter="pending"><div class="label">Total pendente</div><div class="num" id="billsPendingValue">R$ 0,00</div><div class="hint" id="billsPendingCount">0 boletos</div></button>
        <button type="button" class="card bills-summary-card bills-card-alert" data-bill-quick-filter="attention"><div class="label">Exigem atenção</div><div class="num" id="billsAttention">0</div><div class="hint" id="billsAttentionValue">R$ 0,00 até D-3 / atrasados</div></button>
        <button type="button" class="card bills-summary-card bills-card-today" data-bill-quick-filter="today"><div class="label">Vencem hoje</div><div class="num" id="billsToday">0</div><div class="hint" id="billsTodayValue">R$ 0,00 pendentes</div></button>
        <button type="button" class="card bills-summary-card bills-card-overdue" data-bill-quick-filter="overdue"><div class="label">Atrasados</div><div class="num" id="billsOverdue">0</div><div class="hint" id="billsOverdueValue">R$ 0,00 em aberto</div></button>
        <button type="button" class="card bills-summary-card" data-bill-quick-filter="week"><div class="label">Próximos 7 dias</div><div class="num" id="billsNext7">0</div><div class="hint" id="billsNext7Value">R$ 0,00 a vencer</div></button>
      </div>

      <div class="panel bills-device-panel">
        <div class="bills-device-copy"><h3>Notificações neste dispositivo</h3><p>Receba alertas de vencimento no celular, tablet ou computador, mesmo sem deixar esta tela aberta.</p><span class="bills-device-status" id="billsDeviceStatus" data-state="idle">Verificando notificações...</span></div>
        <button class="btn" id="billsEnablePush" type="button">Ativar notificações</button>
      </div>

      <div class="panel bills-form-panel">
        <div class="section-bar dark">Cadastrar boleto</div>
        <div class="bill-edit-banner" id="billEditBanner"><span id="billEditBannerText">Editando boleto existente. Salve para confirmar as alterações.</span></div>
        <form id="billForm" class="bills-form">
          <div><label for="billSupplier">Fornecedor *</label><input id="billSupplier" list="billSupplierList" maxlength="120" required autocomplete="organization" placeholder="Ex.: Equatorial"><datalist id="billSupplierList"></datalist></div>
          <div><label for="billDescription">Descrição</label><input id="billDescription" maxlength="180" placeholder="Ex.: Energia elétrica"></div>
          <div><label for="billAmount">Valor *</label><input id="billAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="R$"></div>
          <div class="bill-date-input"><label for="billDueDate">Vencimento *</label><input id="billDueDate" type="date" required><div class="bill-date-shortcuts" aria-label="Atalhos de vencimento"><button type="button" data-bill-due-offset="0">Hoje</button><button type="button" data-bill-due-offset="3">+3 dias</button><button type="button" data-bill-due-offset="7">+7 dias</button></div></div>
          <div class="wide"><label for="billLine">Linha digitável / código</label><input id="billLine" maxlength="160" autocomplete="off" placeholder="Opcional — você poderá copiar com um clique"></div>
          <div class="wide"><label for="billNotes">Observações</label><textarea id="billNotes" maxlength="500" placeholder="Ex.: referente ao mês, unidade, contrato ou outra informação"></textarea></div>
          <div class="bills-form-actions"><button class="btn outline hidden" id="billCancelEdit" type="button">Cancelar</button><button class="btn" id="billSaveBtn" type="submit">Cadastrar boleto</button></div>
        </form>
      </div>

      <div class="panel bills-list-panel">
        <div class="bills-toolbar">
          <div class="bills-title-block"><div class="section-bar sand" style="margin:0">Boletos cadastrados</div><div class="bills-sync-note" id="billsSyncNote">Aguardando sincronização</div></div>
          <div class="bills-result-summary" id="billsResultSummary" aria-live="polite">0 boletos</div>
        </div>

        <div class="bills-search-row">
          <div class="bills-search-box"><label class="sr-only" for="billsSearch">Buscar boletos</label><input id="billsSearch" type="search" autocomplete="off" placeholder="Buscar por fornecedor, descrição, código, observação ou valor"><button type="button" id="billsClearSearch" aria-label="Limpar busca" title="Limpar busca">×</button></div>
          <label class="bills-select-field"><span>Ordenar por</span><select id="billsSort"><option value="priority">Prioridade / vencimento</option><option value="due_asc">Vencimento: mais próximo</option><option value="due_desc">Vencimento: mais distante</option><option value="supplier_asc">Fornecedor: A → Z</option><option value="supplier_desc">Fornecedor: Z → A</option><option value="amount_desc">Valor: maior primeiro</option><option value="amount_asc">Valor: menor primeiro</option><option value="created_desc">Cadastro: mais recente</option><option value="created_asc">Cadastro: mais antigo</option></select></label>
          <label class="bills-select-field"><span>Agrupar por</span><select id="billsGroup"><option value="due">Vencimento / urgência</option><option value="month">Mês do vencimento</option><option value="supplier">Fornecedor</option><option value="status">Status</option><option value="none">Sem agrupamento</option></select></label>
        </div>

        <div class="bills-date-row">
          <div class="bills-date-range"><label for="billsDateFrom"><span>Vencimento de</span><input id="billsDateFrom" type="date"></label><span class="bills-date-separator">até</span><label for="billsDateTo"><span>até</span><input id="billsDateTo" type="date"></label></div>
          <button type="button" class="bill-clear-filters" id="billsClearFilters">Limpar filtros</button>
        </div>

        <div class="bills-filters" role="group" aria-label="Filtrar boletos por situação">
          <button class="bill-filter active" type="button" data-bill-filter="pending">Pendentes <span data-bill-count="pending">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="attention">Atenção <span data-bill-count="attention">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="overdue">Atrasados <span data-bill-count="overdue">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="today">Hoje <span data-bill-count="today">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="week">7 dias <span data-bill-count="week">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="paid">Pagos <span data-bill-count="paid">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="cancelled">Cancelados <span data-bill-count="cancelled">0</span></button>
          <button class="bill-filter" type="button" data-bill-filter="all">Todos <span data-bill-count="all">0</span></button>
        </div>
        <div id="billsList" class="bills-list"></div>
      </div>`;
    wrap.appendChild(section);
  }

  function clearSensitiveCache(){
    try{localStorage.removeItem(CACHE_KEY)}catch{}
    rows=[];editingId=null;pendingFocusId='';
    activeFilter='pending';searchQuery='';dateFrom='';dateTo='';
    try{clearForm();render()}catch{}
  }

  async function apiList(){
    if(window.__XB_E2E__)return readE2E();
    return await sbRest('bills?select=*&order=due_date.asc,created_at.desc');
  }

  async function apiCreate(payload){
    if(window.__XB_E2E__){
      const data=readE2E();
      const now=new Date().toISOString();
      const item={id:crypto.randomUUID(),status:'pending',paid_at:null,paid_date:null,paid_amount:null,created_at:now,updated_at:now,...payload};
      data.push(item);writeE2E(data);return [item];
    }
    return await sbRest('bills',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
  }

  async function apiPatch(id,patch){
    if(window.__XB_E2E__){
      const data=readE2E();const index=data.findIndex(item=>item.id===id);
      if(index<0)throw new Error('Boleto de teste não encontrado.');
      data[index]={...data[index],...patch,updated_at:new Date().toISOString()};writeE2E(data);return [data[index]];
    }
    return await sbRest(`bills?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
  }

  function billDraft(){return{
    supplier:byId('billSupplier').value.trim(),
    description:byId('billDescription').value.trim(),
    amount:Number(byId('billAmount').value||0),
    due_date:byId('billDueDate').value,
    digitable_line:byId('billLine').value.trim(),
    notes:byId('billNotes').value.trim()
  }}

  function showFormBanner(text){
    byId('billEditBannerText').textContent=text;
    byId('billEditBanner').classList.add('show');
    byId('billCancelEdit').classList.remove('hidden');
  }

  function clearForm(){
    editingId=null;byId('billForm').reset();byId('billDueDate').value=logic.todayLocal();
    byId('billEditBanner').classList.remove('show');byId('billCancelEdit').classList.add('hidden');byId('billSaveBtn').textContent='Cadastrar boleto';
  }

  function fillForm(item,dueDate){
    byId('billSupplier').value=item.supplier||'';
    byId('billDescription').value=item.description||'';
    byId('billAmount').value=Number(item.amount||0)||'';
    byId('billDueDate').value=dueDate||item.due_date||'';
    byId('billLine').value=item.digitable_line||'';
    byId('billNotes').value=item.notes||'';
  }

  function scrollToForm(){
    byId('billSupplier').focus();
    window.scrollTo({top:Math.max(0,byId('billForm').getBoundingClientRect().top+window.scrollY-110),behavior:'smooth'});
  }

  function startEdit(id){
    const item=rows.find(row=>row.id===id);if(!item)return;
    editingId=id;fillForm(item);
    showFormBanner(`Editando ${item.supplier||'boleto existente'}. Salve para confirmar as alterações.`);
    byId('billSaveBtn').textContent='Salvar alterações';scrollToForm();
  }

  function duplicateBill(item){
    editingId=null;
    const nextDue=logic.addMonthsISO(item.due_date,1)||logic.todayLocal();
    fillForm(item,nextDue);
    showFormBanner(`Nova conta baseada em ${item.supplier||'boleto anterior'}. Confira o vencimento antes de cadastrar.`);
    byId('billSaveBtn').textContent='Cadastrar cópia';scrollToForm();
  }

  function populateSupplierList(){
    const list=byId('billSupplierList');if(!list)return;
    const suppliers=[...new Set(rows.map(item=>String(item?.supplier||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    list.innerHTML=suppliers.map(name=>`<option value="${esc(name)}"></option>`).join('');
  }

  function dateTile(value){
    const text=logic.normalizeDate(value);if(!text)return {weekday:'—',day:'--',month:'Sem data'};
    const date=new Date(text+'T12:00:00');
    const weekday=new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(date).replace('.','').toUpperCase();
    const day=String(date.getDate()).padStart(2,'0');
    const month=new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit'}).format(date).replace('.','');
    return {weekday,day,month};
  }

  function linePreview(value){
    const text=String(value||'').trim();
    if(text.length<=34)return text;
    return `${text.slice(0,20)}…${text.slice(-10)}`;
  }

  function currentRows(){
    const filtered=logic.filterBills(rows,{filter:activeFilter,query:searchQuery,from:dateFrom,to:dateTo},logic.todayLocal());
    return logic.sortBills(filtered,logic.todayLocal(),sortMode);
  }

  function filterCount(filter){
    return logic.filterBills(rows,{filter},logic.todayLocal()).length;
  }

  function updateFilterButtons(){
    document.querySelectorAll('[data-bill-filter]').forEach(button=>button.classList.toggle('active',button.dataset.billFilter===activeFilter));
    document.querySelectorAll('[data-bill-count]').forEach(el=>{el.textContent=String(filterCount(el.dataset.billCount))});
  }

  function renderBill(item,today){
    const state=logic.stateForBill(item,today);
    const paid=item.status==='paid',cancelled=item.status==='cancelled';
    const tile=dateTile(item.due_date);
    const paidText=paid?`Pago em ${dateBr(item.paid_date||item.paid_at)}${item.paid_amount!=null?` • ${money(item.paid_amount)}`:''}`:'';
    const created=item.created_at?`Cadastrado ${dateBr(item.created_at)}`:'';
    const code=item.digitable_line?`<button type="button" class="bill-code" data-bill-action="copy" title="Copiar linha digitável"><span>${esc(linePreview(item.digitable_line))}</span><b>Copiar código</b></button>`:'';
    const notes=item.notes?`<p class="bill-notes">${esc(item.notes)}</p>`:'';
    return `<article class="bill-item" data-bill-id="${esc(item.id)}" data-bill-state="${esc(state.key)}">
      <div class="bill-date-tile"><span>${esc(tile.weekday)}</span><strong>${esc(tile.day)}</strong><small>${esc(tile.month)}</small></div>
      <div class="bill-main">
        <div class="bill-title-line"><b>${esc(item.supplier||'Fornecedor')}</b><span class="bill-state" data-tone="${esc(state.tone)}">${esc(state.label)}</span></div>
        <div class="bill-description">${esc(item.description||'Sem descrição')}</div>
        <div class="bill-meta"><span title="${esc(dateLong(item.due_date))}">Vencimento ${dateBr(item.due_date)}</span>${created?`<span>${esc(created)}</span>`:''}${paidText?`<span class="bill-paid-meta">${esc(paidText)}</span>`:''}</div>
        ${code}${notes}
      </div>
      <div class="bill-value"><small>Valor</small><b>${money(item.amount)}</b></div>
      <div class="bill-actions">
        <button type="button" data-bill-action="edit">Editar</button>
        <button type="button" data-bill-action="duplicate">Duplicar</button>
        ${!paid&&!cancelled?'<button class="primary" type="button" data-bill-action="paid">Marcar pago</button><button class="danger" type="button" data-bill-action="cancel">Cancelar</button>':'<button type="button" data-bill-action="reopen">Reabrir</button>'}
      </div>
    </article>`;
  }

  function renderGroups(list,today){
    if(!list.length)return '<div class="bills-empty"><b>Nenhum boleto encontrado.</b><span>Tente trocar o filtro, limpar a busca ou ajustar o período.</span></div>';
    const groups=logic.groupBills(list,today,groupMode);
    return groups.map(group=>{
      const heading=groupMode==='none'?'':`<div class="bill-group-head" data-tone="${esc(group.tone)}"><div><strong>${esc(group.label)}</strong><span>${group.count} ${group.count===1?'conta':'contas'}</span></div><b>${money(group.total)}</b></div>`;
      return `<section class="bill-group" data-bill-group="${esc(group.key)}">${heading}<div class="bill-group-items">${group.items.map(item=>renderBill(item,today)).join('')}</div></section>`;
    }).join('');
  }

  function focusPendingBill(){
    if(!pendingFocusId)return;
    const target=[...byId('billsList').querySelectorAll('[data-bill-id]')].find(el=>el.dataset.billId===pendingFocusId);
    if(!target)return;
    const id=pendingFocusId;pendingFocusId='';
    setTimeout(()=>{target.classList.add('bill-focus');target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.classList.remove('bill-focus'),2600)},80);
    return id;
  }

  function render(){
    const today=logic.todayLocal();
    const summary=logic.summarize(rows,today);
    byId('billsPendingValue').textContent=money(summary.pendingAmount);
    byId('billsPendingCount').textContent=`${summary.pendingCount} boleto${summary.pendingCount===1?'':'s'}`;
    byId('billsAttention').textContent=String(summary.attentionCount);
    byId('billsAttentionValue').textContent=`${money(summary.attentionAmount)} até D-3 / atrasados`;
    byId('billsToday').textContent=String(summary.dueTodayCount);
    byId('billsTodayValue').textContent=`${money(summary.dueTodayAmount)} pendentes`;
    byId('billsOverdue').textContent=String(summary.overdueCount);
    byId('billsOverdueValue').textContent=`${money(summary.overdueAmount)} em aberto`;
    byId('billsNext7').textContent=String(summary.next7Count);
    byId('billsNext7Value').textContent=`${money(summary.next7Amount)} a vencer`;
    byId('billsPageBadge').textContent=summary.attentionCount?`${summary.attentionCount} conta${summary.attentionCount===1?'':'s'} exigindo atenção`:'Nenhuma urgência';
    const navBadge=byId('billsNavBadge');if(navBadge){navBadge.textContent=String(summary.attentionCount);navBadge.hidden=!summary.attentionCount}

    populateSupplierList();updateFilterButtons();
    const list=currentRows();
    const shownTotal=list.reduce((sum,item)=>sum+Number(item?.amount||0),0);
    const result=byId('billsResultSummary');
    if(result)result.textContent=`${list.length} de ${rows.length} • ${money(shownTotal)}`;
    byId('billsList').innerHTML=renderGroups(list,today);
    focusPendingBill();
  }

  function setActiveFilter(filter){
    activeFilter=filter||'pending';render();
  }

  async function refreshBills({silent=false}={}){
    if(loading)return;loading=true;
    const sync=byId('billsSyncNote');if(sync)sync.textContent='Sincronizando...';
    try{
      if(!window.__XB_E2E__&&!authSession){rows=readCache();render();if(sync)sync.textContent='Entre no sistema para sincronizar';return}
      const data=await apiList();rows=Array.isArray(data)?data:[];writeCache(rows);render();if(sync)sync.textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    }catch(error){
      rows=readCache();render();if(sync)sync.textContent=rows.length?'Mostrando último cache disponível':'Falha ao carregar boletos';
      if(!silent)toast(error?.message||'Não foi possível carregar os boletos.','error');
    }finally{loading=false}
  }

  async function saveBill(event){
    event.preventDefault();
    if(!window.__XB_E2E__&&!authSession){toast('Entre no sistema para cadastrar boletos.','error');return}
    const draft=billDraft(),valid=logic.validateDraft(draft);if(valid!==true){toast(valid,'error');return}
    const button=byId('billSaveBtn');button.disabled=true;
    try{
      if(editingId){await apiPatch(editingId,draft);toast('Boleto atualizado.')}else{await apiCreate(draft);toast('Boleto cadastrado.');}
      clearForm();await refreshBills({silent:true});
    }catch(error){toast(error?.message||'Não foi possível salvar o boleto.','error')}
    finally{button.disabled=false}
  }

  async function markPaid(item){
    const ok=await openConfirmModal({title:'Marcar boleto como pago',message:`Confirmar pagamento de ${money(item.amount)} para ${item.supplier}?`,note:`Vencimento: ${dateBr(item.due_date)}. O boleto deixará de gerar avisos.`,confirmText:'Confirmar pagamento',badge:'Pagamento'});if(!ok)return;
    const now=new Date().toISOString();
    await apiPatch(item.id,{status:'paid',paid_at:now,paid_date:logic.todayLocal(),paid_amount:Number(item.amount||0)});toast('Pagamento registrado.');await refreshBills({silent:true});
  }

  async function cancelBill(item){
    const ok=await openConfirmModal({title:'Cancelar boleto',message:`Cancelar o boleto de ${item.supplier}?`,note:'O registro continuará no histórico e deixará de gerar notificações.',confirmText:'Cancelar boleto',badge:'Cancelamento'});if(!ok)return;
    await apiPatch(item.id,{status:'cancelled'});toast('Boleto cancelado.');await refreshBills({silent:true});
  }

  async function reopenBill(item){
    const ok=await openConfirmModal({title:'Reabrir boleto',message:`Reabrir o boleto de ${item.supplier}?`,note:'Ele voltará para os pendentes e poderá gerar lembretes de vencimento novamente.',confirmText:'Reabrir boleto',badge:'Reabertura'});if(!ok)return;
    await apiPatch(item.id,{status:'pending',paid_at:null,paid_date:null,paid_amount:null});toast('Boleto reaberto.');await refreshBills({silent:true});
  }

  async function copyLine(item){
    const text=String(item?.digitable_line||'').trim();if(!text)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
      }
      toast('Código do boleto copiado.');
    }catch{toast('Não foi possível copiar o código.','error')}
  }

  async function handleListClick(event){
    const action=event.target.closest('[data-bill-action]');if(!action)return;
    const card=action.closest('[data-bill-id]'),item=rows.find(row=>row.id===card?.dataset.billId);if(!item)return;
    try{
      if(action.dataset.billAction==='edit')return startEdit(item.id);
      if(action.dataset.billAction==='duplicate')return duplicateBill(item);
      if(action.dataset.billAction==='copy')return copyLine(item);
      action.disabled=true;
      if(action.dataset.billAction==='paid')await markPaid(item);
      if(action.dataset.billAction==='cancel')await cancelBill(item);
      if(action.dataset.billAction==='reopen')await reopenBill(item);
    }catch(error){toast(error?.message||'Não foi possível atualizar o boleto.','error')}
    finally{action.disabled=false}
  }

  function applyDueOffset(offset){byId('billDueDate').value=logic.addDaysISO(logic.todayLocal(),Number(offset||0))}

  function clearViewFilters(){
    activeFilter='pending';searchQuery='';dateFrom='';dateTo='';
    byId('billsSearch').value='';byId('billsDateFrom').value='';byId('billsDateTo').value='';render();
  }

  function openFromNotification(billId=''){
    activeFilter='all';searchQuery='';dateFrom='';dateTo='';
    if(byId('billsSearch'))byId('billsSearch').value='';
    if(byId('billsDateFrom'))byId('billsDateFrom').value='';
    if(byId('billsDateTo'))byId('billsDateTo').value='';
    pendingFocusId=String(billId||'');
    try{navigate('boletos')}catch{}
    refreshBills({silent:true});
  }

  function urlBase64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
  }

  function deviceName(){
    const ua=navigator.userAgent||'';
    if(/iPad/i.test(ua))return'iPad';if(/iPhone/i.test(ua))return'iPhone';if(/Android/i.test(ua)&&/Mobile/i.test(ua))return'Celular Android';if(/Android/i.test(ua))return'Tablet Android';if(/Windows/i.test(ua))return'Computador Windows';if(/Macintosh/i.test(ua))return'Computador Mac';return'Dispositivo';
  }

  function setDeviceStatus(text,state='idle'){const el=byId('billsDeviceStatus');if(!el)return;el.textContent=text;el.dataset.state=state}

  async function refreshDeviceStatus(){
    if(window.__XB_E2E__){const enabled=localStorage.getItem(E2E_PUSH_KEY)==='1';setDeviceStatus(enabled?'Notificações ativadas neste dispositivo':'Notificações não ativadas',enabled?'enabled':'idle');return}
    if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){setDeviceStatus('Este navegador não oferece Push Web','error');byId('billsEnablePush').disabled=true;return}
    if(Notification.permission==='denied'){setDeviceStatus('Notificações bloqueadas no navegador','error');return}
    try{const reg=await navigator.serviceWorker.getRegistration('/xburguer-caixa/');const sub=await reg?.pushManager?.getSubscription();setDeviceStatus(sub&&Notification.permission==='granted'?'Notificações ativadas neste dispositivo':'Notificações não ativadas',sub?'enabled':'idle')}catch{setDeviceStatus('Não foi possível verificar a inscrição','error')}
  }

  async function enablePush(){
    const button=byId('billsEnablePush');button.disabled=true;
    try{
      if(window.__XB_E2E__){localStorage.setItem(E2E_PUSH_KEY,'1');await refreshDeviceStatus();toast('Notificações de teste ativadas.');return}
      if(!authSession)throw new Error('Entre no sistema antes de ativar as notificações.');
      if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Este navegador não oferece suporte a notificações Push.');
      let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('A permissão de notificações não foi concedida.');
      const reg=window.XBRegisterPWA?await window.XBRegisterPWA():await navigator.serviceWorker.ready;
      let subscription=await reg.pushManager.getSubscription();
      if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const json=subscription.toJSON(),keys=json.keys||{};
      if(!keys.p256dh||!keys.auth)throw new Error('O navegador não retornou as chaves da inscrição Push.');
      await sbRest('bill_push_subscriptions?on_conflict=endpoint',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:currentUser.id,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth:keys.auth,device_name:deviceName(),user_agent:navigator.userAgent,enabled:true,last_seen_at:new Date().toISOString()})});
      setDeviceStatus('Notificações ativadas neste dispositivo','enabled');toast('Notificações ativadas com sucesso.');
    }catch(error){setDeviceStatus(error?.message||'Falha ao ativar notificações','error');toast(error?.message||'Não foi possível ativar as notificações.','error')}
    finally{button.disabled=false}
  }

  function bind(){
    byId('billForm').addEventListener('submit',saveBill);
    byId('billCancelEdit').addEventListener('click',clearForm);
    byId('billsList').addEventListener('click',handleListClick);
    byId('billsEnablePush').addEventListener('click',enablePush);
    byId('billsClearSearch').addEventListener('click',()=>{searchQuery='';byId('billsSearch').value='';render();byId('billsSearch').focus()});
    byId('billsClearFilters').addEventListener('click',clearViewFilters);
    byId('billsSearch').addEventListener('input',event=>{searchQuery=event.target.value;render()});
    byId('billsDateFrom').addEventListener('change',event=>{dateFrom=event.target.value;if(dateFrom&&dateTo&&dateFrom>dateTo){dateTo=dateFrom;byId('billsDateTo').value=dateTo}render()});
    byId('billsDateTo').addEventListener('change',event=>{dateTo=event.target.value;if(dateFrom&&dateTo&&dateFrom>dateTo){dateFrom=dateTo;byId('billsDateFrom').value=dateFrom}render()});
    byId('billsSort').value=sortMode;byId('billsSort').addEventListener('change',event=>{sortMode=event.target.value;saveUi();render()});
    byId('billsGroup').value=groupMode;byId('billsGroup').addEventListener('change',event=>{groupMode=event.target.value;saveUi();render()});
    document.querySelectorAll('[data-bill-filter]').forEach(button=>button.addEventListener('click',()=>setActiveFilter(button.dataset.billFilter)));
    document.querySelectorAll('[data-bill-quick-filter]').forEach(button=>button.addEventListener('click',()=>setActiveFilter(button.dataset.billQuickFilter)));
    document.querySelectorAll('[data-bill-due-offset]').forEach(button=>button.addEventListener('click',()=>applyDueOffset(button.dataset.billDueOffset)));
  }

  injectNav();injectPage();
  try{pageCfg.boletos=['Boletos','Contas a pagar, filtros e lembretes de vencimento']}catch{}
  bind();clearForm();rows=readCache();render();refreshDeviceStatus();

  const originalShowApp=typeof showApp==='function'?showApp:null;
  if(originalShowApp){showApp=function(){const result=originalShowApp.apply(this,arguments);setTimeout(()=>{refreshBills({silent:true});refreshDeviceStatus();const params=new URLSearchParams(location.search);if(params.get('open')==='bills')openFromNotification(params.get('bill')||'')},50);return result}}

  navigator.serviceWorker?.addEventListener?.('message',event=>{if(event.data?.type==='XB_OPEN_BILLS')openFromNotification(event.data?.billId||'')});

  window.XBBills={
    refresh:refreshBills,
    rows:()=>structuredClone(rows),
    stateForBill:logic.stateForBill,
    setFilter:setActiveFilter,
    clearSensitiveCache,
    resetE2E(){localStorage.removeItem(E2E_KEY);localStorage.removeItem(E2E_PUSH_KEY);rows=[];activeFilter='pending';searchQuery='';dateFrom='';dateTo='';render();clearForm()}
  };
})();
