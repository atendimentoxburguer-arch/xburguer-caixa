/* X-Burguer Caixa — Boletos e notificações v1 */
(function(){
  'use strict';

  const logic=window.XBBillLogic;
  if(!logic){console.error('X-Burguer Caixa: bills-logic.js não foi carregado.');return;}

  const VAPID_PUBLIC_KEY='BG_MKawNAMFlSovH1o7WkzZdKZX099oJdE8usdPOeVU7neKTw_1wlME9amL8b2wK11fd4TRfegsl541oBE2e8Mo';
  const CACHE_KEY='xburguer_bills_cache_v1';
  const E2E_KEY='xb_e2e_bills_v1';
  const E2E_PUSH_KEY='xb_e2e_bills_push_v1';
  let rows=[];
  let activeFilter='pending';
  let editingId=null;
  let loading=false;

  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBr=value=>value?new Date(String(value).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';

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
      <div class="page-head">
        <div><h2>Boletos e contas a pagar</h2><p class="sub">Cadastre vencimentos e acompanhe os avisos de 3, 2, 1 dia e do próprio vencimento.</p></div>
        <span class="badge" id="billsPageBadge">Nenhuma urgência</span>
      </div>

      <div class="cards bills-cards">
        <div class="card"><div class="label">Total pendente</div><div class="num" id="billsPendingValue">R$ 0,00</div><div class="hint" id="billsPendingCount">0 boletos</div></div>
        <div class="card bills-card-alert"><div class="label">Próximos / atrasados</div><div class="num" id="billsAttention">0</div><div class="hint">Atenção em até 3 dias</div></div>
        <div class="card bills-card-today"><div class="label">Vencem hoje</div><div class="num" id="billsToday">0</div><div class="hint">Pagamento pendente</div></div>
        <div class="card"><div class="label">Atrasados</div><div class="num" id="billsOverdue">0</div><div class="hint">Ainda não marcados como pagos</div></div>
      </div>

      <div class="panel bills-device-panel">
        <div class="bills-device-copy"><h3>Notificações neste dispositivo</h3><p>Ative para receber alertas do sistema no celular, tablet ou computador. O navegador solicitará sua permissão.</p><span class="bills-device-status" id="billsDeviceStatus" data-state="idle">Verificando notificações...</span></div>
        <button class="btn" id="billsEnablePush" type="button">Ativar notificações</button>
      </div>

      <div class="panel">
        <div class="section-bar dark">Cadastrar boleto</div>
        <div class="bill-edit-banner" id="billEditBanner">Editando boleto existente. Salve para confirmar as alterações.</div>
        <form id="billForm" class="bills-form">
          <div><label for="billSupplier">Fornecedor *</label><input id="billSupplier" maxlength="120" required placeholder="Ex.: Equatorial"></div>
          <div><label for="billDescription">Descrição</label><input id="billDescription" maxlength="180" placeholder="Ex.: Energia elétrica"></div>
          <div><label for="billAmount">Valor *</label><input id="billAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="R$"></div>
          <div><label for="billDueDate">Vencimento *</label><input id="billDueDate" type="date" required></div>
          <div class="wide"><label for="billLine">Linha digitável / código</label><input id="billLine" maxlength="160" autocomplete="off" placeholder="Opcional"></div>
          <div class="wide"><label for="billNotes">Observações</label><textarea id="billNotes" maxlength="500" placeholder="Informações adicionais"></textarea></div>
          <div class="bills-form-actions"><button class="btn outline hidden" id="billCancelEdit" type="button">Cancelar edição</button><button class="btn" id="billSaveBtn" type="submit">Cadastrar boleto</button></div>
        </form>
      </div>

      <div class="panel">
        <div class="bills-toolbar"><div><div class="section-bar sand" style="margin:0">Boletos cadastrados</div><div class="bills-sync-note" id="billsSyncNote">Aguardando sincronização</div></div><div class="bills-filters" role="group" aria-label="Filtrar boletos"><button class="bill-filter active" type="button" data-bill-filter="pending">Pendentes</button><button class="bill-filter" type="button" data-bill-filter="attention">Atenção</button><button class="bill-filter" type="button" data-bill-filter="paid">Pagos</button><button class="bill-filter" type="button" data-bill-filter="all">Todos</button></div></div>
        <div id="billsList" class="bills-list"></div>
      </div>`;
    wrap.appendChild(section);
  }

  function readCache(){try{const data=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
  function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}}
  function readE2E(){try{const data=JSON.parse(localStorage.getItem(E2E_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
  function writeE2E(data){localStorage.setItem(E2E_KEY,JSON.stringify(data))}

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

  function clearForm(){
    editingId=null;byId('billForm').reset();byId('billDueDate').value=logic.todayLocal();
    byId('billEditBanner').classList.remove('show');byId('billCancelEdit').classList.add('hidden');byId('billSaveBtn').textContent='Cadastrar boleto';
  }

  function startEdit(id){
    const item=rows.find(row=>row.id===id);if(!item)return;
    editingId=id;byId('billSupplier').value=item.supplier||'';byId('billDescription').value=item.description||'';byId('billAmount').value=Number(item.amount||0)||'';byId('billDueDate').value=item.due_date||'';byId('billLine').value=item.digitable_line||'';byId('billNotes').value=item.notes||'';
    byId('billEditBanner').classList.add('show');byId('billCancelEdit').classList.remove('hidden');byId('billSaveBtn').textContent='Salvar alterações';
    byId('billSupplier').focus();window.scrollTo({top:Math.max(0,byId('billForm').getBoundingClientRect().top+window.scrollY-110),behavior:'smooth'});
  }

  function filteredRows(){
    const today=logic.todayLocal();
    if(activeFilter==='all')return rows;
    if(activeFilter==='paid')return rows.filter(item=>item.status==='paid');
    if(activeFilter==='attention')return rows.filter(item=>item.status==='pending'&&['overdue','today','d1','d2','d3'].includes(logic.stateForBill(item,today).key));
    return rows.filter(item=>(item.status||'pending')==='pending');
  }

  function render(){
    const today=logic.todayLocal();
    const summary=logic.summarize(rows,today);
    byId('billsPendingValue').textContent=money(summary.pendingAmount);byId('billsPendingCount').textContent=`${summary.pendingCount} boleto${summary.pendingCount===1?'':'s'}`;byId('billsAttention').textContent=String(summary.attentionCount);byId('billsToday').textContent=String(summary.dueTodayCount);byId('billsOverdue').textContent=String(summary.overdueCount);
    byId('billsPageBadge').textContent=summary.attentionCount?`${summary.attentionCount} conta${summary.attentionCount===1?'':'s'} exigindo atenção`:'Nenhuma urgência';
    const navBadge=byId('billsNavBadge');if(navBadge){navBadge.textContent=String(summary.attentionCount);navBadge.hidden=!summary.attentionCount}

    const list=logic.sortBills(filteredRows(),today);
    byId('billsList').innerHTML=list.length?list.map(item=>{
      const state=logic.stateForBill(item,today);
      const paid=item.status==='paid';const cancelled=item.status==='cancelled';
      const subtitle=[item.description,item.digitable_line?`Linha: ${item.digitable_line}`:'',item.notes].filter(Boolean).join(' • ');
      const paidText=paid?`Pago em ${dateBr(item.paid_date||item.paid_at)}`:'';
      return `<article class="bill-item" data-bill-id="${esc(item.id)}"><div class="bill-main"><b>${esc(item.supplier||'Fornecedor')}</b><small>${esc(subtitle||'Sem observações')}</small></div><div class="bill-value"><b>${money(item.amount)}</b><small>${paidText?esc(paidText):'Valor do boleto'}</small></div><div class="bill-due"><span class="bill-state" data-tone="${esc(state.tone)}">${esc(state.label)}</span><small>Vencimento ${dateBr(item.due_date)}</small></div><div class="bill-actions"><button type="button" data-bill-action="edit">Editar</button>${!paid&&!cancelled?'<button class="primary" type="button" data-bill-action="paid">Marcar pago</button><button class="danger" type="button" data-bill-action="cancel">Cancelar</button>':'<button type="button" data-bill-action="reopen">Reabrir</button>'}</div></article>`;
    }).join(''):'<div class="bills-empty">Nenhum boleto encontrado neste filtro.</div>';
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
    const ok=await openConfirmModal({title:'Marcar boleto como pago',message:`Confirmar pagamento de ${money(item.amount)} para ${item.supplier}?`,note:'O boleto deixará de gerar avisos de vencimento.',confirmText:'Confirmar pagamento',badge:'Pagamento'});if(!ok)return;
    const now=new Date().toISOString();
    await apiPatch(item.id,{status:'paid',paid_at:now,paid_date:logic.todayLocal(),paid_amount:Number(item.amount||0)});toast('Pagamento registrado.');await refreshBills({silent:true});
  }

  async function cancelBill(item){
    const ok=await openConfirmModal({title:'Cancelar boleto',message:`Cancelar o boleto de ${item.supplier}?`,note:'O registro será mantido no histórico e deixará de gerar notificações.',confirmText:'Cancelar boleto',badge:'Cancelamento'});if(!ok)return;
    await apiPatch(item.id,{status:'cancelled'});toast('Boleto cancelado.');await refreshBills({silent:true});
  }

  async function reopenBill(item){
    await apiPatch(item.id,{status:'pending',paid_at:null,paid_date:null,paid_amount:null});toast('Boleto reaberto.');await refreshBills({silent:true});
  }

  async function handleListClick(event){
    const action=event.target.closest('[data-bill-action]');if(!action)return;
    const card=action.closest('[data-bill-id]'),item=rows.find(row=>row.id===card?.dataset.billId);if(!item)return;
    try{
      if(action.dataset.billAction==='edit')return startEdit(item.id);
      action.disabled=true;
      if(action.dataset.billAction==='paid')await markPaid(item);
      if(action.dataset.billAction==='cancel')await cancelBill(item);
      if(action.dataset.billAction==='reopen')await reopenBill(item);
    }catch(error){toast(error?.message||'Não foi possível atualizar o boleto.','error')}
    finally{action.disabled=false}
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
    byId('billForm').addEventListener('submit',saveBill);byId('billCancelEdit').addEventListener('click',clearForm);byId('billsList').addEventListener('click',handleListClick);byId('billsEnablePush').addEventListener('click',enablePush);
    document.querySelectorAll('[data-bill-filter]').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.billFilter;document.querySelectorAll('[data-bill-filter]').forEach(item=>item.classList.toggle('active',item===button));render()}));
  }

  injectNav();injectPage();
  try{pageCfg.boletos=['Boletos','Contas a pagar e lembretes de vencimento']}catch{}
  bind();clearForm();rows=readCache();render();refreshDeviceStatus();

  const originalShowApp=typeof showApp==='function'?showApp:null;
  if(originalShowApp){showApp=function(){const result=originalShowApp.apply(this,arguments);setTimeout(()=>{refreshBills({silent:true});refreshDeviceStatus();const params=new URLSearchParams(location.search);if(params.get('open')==='bills')try{navigate('boletos')}catch{}},50);return result}}

  navigator.serviceWorker?.addEventListener?.('message',event=>{if(event.data?.type==='XB_OPEN_BILLS'){try{navigate('boletos')}catch{}refreshBills({silent:true})}});

  window.XBBills={
    refresh:refreshBills,
    rows:()=>structuredClone(rows),
    stateForBill:logic.stateForBill,
    resetE2E(){localStorage.removeItem(E2E_KEY);localStorage.removeItem(E2E_PUSH_KEY);rows=[];render();clearForm()}
  };
})();
