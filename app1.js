document.querySelectorAll('.app-logo').forEach(el=>el.src=LOGO);

const SUPABASE_URL="https://trnngxezppeembrvxkhh.supabase.co";
const SUPABASE_KEY="sb_publishable_KkX5GldnP36X1MYLRSoN8w_9t47dNxV";
const SESSION_KEY='xburguer_supabase_session_v1';
const LEGACY_DRAFT_KEY='xburguer_draft_v2';
const DRAFT_PREFIX='xburguer_draft_v3:';
const BACKUP_KEY='xburguer_last_backup';
const channels=['Hot','Mr. Burguer','WhatsApp','Mesa','Retirada','Entregas'];
let expenseRows=0;
let cloudData=[];
let authSession=null;
let currentUser=null;
let currentProfile=null;
let activeClosingDate=null;
let formDirty=false;
let draftTimer=null;
let saveInProgress=false;
let deleteInProgress=false;
let cloudLoadPromise=null;
let manualSyncInProgress=false;
let lastSyncAt=null;

const $=id=>document.getElementById(id);
const n=id=>Number($(id)?.value||0);
const br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const monthNow=()=>isoToday().slice(0,7);
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function toast(msg,type='ok'){$('toast').textContent=msg;$('toast').className='toast show'+(type==='error'?' error':'');clearTimeout(window.__toast);window.__toast=setTimeout(()=>$('toast').className='toast',3000)}
let confirmResolver=null;

function closeConfirmModal(answer=false){
  const layer=$('confirmLayer');
  if(!layer||layer.hidden)return;
  layer.classList.add('closing');
  const resolver=confirmResolver;
  confirmResolver=null;
  setTimeout(()=>{
    layer.hidden=true;
    layer.classList.remove('closing');
    document.body.classList.remove('modal-open');
    if(resolver)resolver(answer);
  },160);
}

function openConfirmModal({title='Confirmar ação',message='Deseja continuar?',note='Esta ação não pode ser desfeita.',confirmText='Confirmar',cancelText='Cancelar',badge='Confirmação'}={}){
  const layer=$('confirmLayer');
  // Impede que duplo clique ou duas ações simultâneas substituam a confirmação já aberta.
  if(confirmResolver || !layer.hidden)return Promise.resolve(false);
  $('confirmTitle').textContent=title;
  $('confirmMessage').textContent=message;
  $('confirmNote').textContent=note;
  $('confirmBadge').textContent=badge;
  $('confirmOkBtn').textContent=confirmText;
  $('confirmCancelBtn').textContent=cancelText;
  layer.hidden=false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>$('confirmOkBtn').focus());
  return new Promise(resolve=>{confirmResolver=resolve});
}

function load(){return cloudData}

function saveData(data){cloudData=Array.isArray(data)?data:[]}

function setTone(el,value){el.classList.remove('positive','negative');el.classList.add(value<0?'negative':'positive')}

function setCloudStatus(text,state='online'){
  const el=$('cloudStatus'); if(!el)return;
  el.textContent=text; el.className='badge cloud-badge '+state;
}

function formatSyncTime(date){
  if(!date)return'Ainda não';
  return date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function countLocalDrafts(){
  let count=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(DRAFT_PREFIX))count++;
    }
  }catch{}
  return count;
}

function updateSyncUi(){
  const text=lastSyncAt?formatSyncTime(lastSyncAt):'Ainda não';
  if($('lastSync'))$('lastSync').textContent=text;
  if($('syncInfo'))$('syncInfo').textContent=lastSyncAt?'Última sincronização: '+text:'Aguardando sincronização';
  if($('draftCount'))$('draftCount').textContent=countLocalDrafts();
}

function sessionStore(remember){
  return remember?localStorage:sessionStorage;
}

function clearStoredSessions(){
  localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);
}

function persistSession(session,remember){
  clearStoredSessions();
  if(!session)return;
  const target=sessionStore(remember);
  target.setItem(SESSION_KEY,JSON.stringify(session));
}

function readStoredSession(){
  for(const store of [localStorage,sessionStorage]){
    try{const s=JSON.parse(store.getItem(SESSION_KEY)||'null');if(s?.refresh_token)return {session:s,remember:store===localStorage}}catch{}
  }
  return null;
}

async function fetchWithTimeout(url,options={},timeout=20000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{...options,signal:controller.signal})}
  catch(err){
    if(err?.name==='AbortError')throw new Error('A conexão demorou demais. Verifique a internet e tente novamente.');
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
  }finally{clearTimeout(timer)}
}

async function authFetch(path,body){
  const res=await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/${path}`,{
    method:'POST',
    headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(body||{})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    const code=data.error_code||data.code||'';
    if(code==='invalid_credentials')throw new Error('Senha incorreta.');
    if(code==='email_not_confirmed')throw new Error('O acesso ainda não foi liberado no servidor.');
    throw new Error(data.msg||data.message||data.error_description||'Falha na autenticação.');
  }
  return data;
}

function normalizeSession(data){
  if(!data?.access_token)return null;
  return {
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    token_type:data.token_type||'bearer',
    expires_at:data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600),
    user:data.user||null
  };
}

async function refreshAuthSession(remember=true){
  if(!authSession?.refresh_token)throw new Error('Sessão expirada.');
  const data=await authFetch('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token});
  authSession=normalizeSession(data);
  currentUser=authSession.user;
  persistSession(authSession,remember);
  return authSession;
}

async function ensureAccessToken(){
  if(!authSession)throw new Error('Faça login novamente.');
  if(Number(authSession.expires_at||0)<Math.floor(Date.now()/1000)+60){
    const remembered=!!localStorage.getItem(SESSION_KEY);
    await refreshAuthSession(remembered);
  }
  return authSession.access_token;
}

async function sbRest(path,options={},retry=true){
  const token=await ensureAccessToken();
  const headers={
    'apikey':SUPABASE_KEY,
    'Authorization':`Bearer ${token}`,
    'Content-Type':'application/json',
    ...(options.headers||{})
  };
  const res=await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
  if(res.status===401 && retry && authSession?.refresh_token){
    const remembered=!!localStorage.getItem(SESSION_KEY);
    await refreshAuthSession(remembered);
    return sbRest(path,options,false);
  }
  const text=await res.text();
  let data=null;
  if(text){try{data=JSON.parse(text)}catch{data=text}}
  if(!res.ok){
    if(res.status===403)throw new Error('Acesso ao banco negado. Atualize a página e entre novamente.');
    if(res.status===404)throw new Error('Recurso do banco não encontrado.');
    const msg=(data&&typeof data==='object'&&(data.message||data.details||data.hint))||`Erro ${res.status} ao acessar o banco.`;
    throw new Error(msg);
  }
  return data;
}

function cloudToRecord(c){
  const channelMap=new Map((c.channel_sales||[]).map(x=>[x.channel_name,x]));
  const mappedChannels=channels.map(name=>{
    const x=channelMap.get(name)||{};
    return {name,q:Number(x.order_count||0),v:Number(x.amount||0)};
  });
  const onlineMap=new Map((c.online_orders||[]).map(x=>[x.platform,x]));
  const anota=onlineMap.get('Anota Aí')||{},aiq=onlineMap.get('Aiqfome')||{};
  const breadMap=new Map((c.bread_controls||[]).map(x=>[x.bread_type,x]));
  const ideal=breadMap.get('Pão Ideal')||{},gourmet=breadMap.get('Pão Gourmet')||{};
  const sales=Number(c.total_sales||0),expense=Number(c.total_expenses||0);
  const paymentTotal=Number(c.cash_sales||0)+Number(c.store_card_sales||0)+Number(c.pix_app_sales||0)+Number(c.delivery_card_sales||0);
  return {
    _id:c.id,
    status:c.status||'closed',
    date:c.business_date,
    resp:c.responsible_name||'',
    opening:Number(c.opening_balance||0),
    cash:Number(c.cash_sales||0),
    cardOut:Number(c.store_card_sales||0),
    onlinePayment:Number(c.pix_app_sales||0),
    deliveryCard:Number(c.delivery_card_sales||0),
    cashOut:Number(c.cash_withdrawn_for_expenses||0),
    countedCash:Number(c.counted_cash||0),
    expectedCash:Number(c.expected_cash||0),
    cashDifference:Number(c.cash_difference||0),
    paymentTotal,
    paymentDifference:paymentTotal-sales,
    sales,
    orders:mappedChannels.reduce((a,x)=>a+x.q,0),
    expense,
    result:Number(c.result||0),
    balance:Number(c.result||0),
    channels:mappedChannels,
    online:{
      anotaQtd:Number(anota.order_count||0),anotaVal:Number(anota.amount||0),
      aiqQtd:Number(aiq.order_count||0),aiqVal:Number(aiq.amount||0),
      orders:Number(anota.order_count||0)+Number(aiq.order_count||0),
      value:Number(anota.amount||0)+Number(aiq.amount||0)
    },
    expenses:(c.expenses||[]).map(x=>({d:x.description||'',val:Number(x.amount||0)})),
    obs:c.observations||'',
    breads:{
      idealStart:Number(ideal.opening_stock||0),idealProd:Number(ideal.production||0),
      idealOut:Number(ideal.out_qty||0),idealFinal:Number(ideal.closing_stock||0),
      gourmetStart:Number(gourmet.opening_stock||0),gourmetProd:Number(gourmet.production||0),
      gourmetOut:Number(gourmet.out_qty||0),gourmetFinal:Number(gourmet.closing_stock||0)
    },
    savedAt:c.updated_at||c.created_at||''
  };
}

async function loadCloudData(){
  if(cloudLoadPromise)return cloudLoadPromise;
  cloudLoadPromise=(async()=>{
    setCloudStatus('● Sincronizando...','syncing');
    try{
      const select='*,channel_sales(channel_name,order_count,amount),bread_controls(bread_type,opening_stock,production,out_qty,closing_stock),online_orders(platform,order_count,amount),expenses(description,amount)';
      const rows=await sbRest(`cash_closings?select=${encodeURIComponent(select)}&order=business_date.asc`);
      cloudData=(rows||[]).map(cloudToRecord);
      lastSyncAt=new Date();
      setCloudStatus('● Banco na nuvem','online');
      updateSyncUi();
      return cloudData;
    }catch(err){
      setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
      throw err;
    }finally{
      cloudLoadPromise=null;
    }
  })();
  return cloudLoadPromise;
}

async function loadProfile(){
  if(!currentUser?.id)return null;
  const rows=await sbRest(`profiles?select=full_name,role,active&id=eq.${encodeURIComponent(currentUser.id)}&limit=1`);
  currentProfile=rows?.[0]||null;
  if(currentProfile && currentProfile.active===false)throw new Error('Este usuário está desativado.');
  const email=currentUser.email||'Usuário';
  $('userName').textContent=currentProfile?.full_name||email.split('@')[0];
  const roleLabel={admin:'Administrador',manager:'Gerente',operator:'Operador'}[currentProfile?.role]||'Usuário';
  $('userRole').textContent=roleLabel;
  return currentProfile;
}

async function loginCloud(email,password,remember){
  const data=await authFetch('token?grant_type=password',{email,password});
  authSession=normalizeSession(data);
  if(!authSession?.access_token)throw new Error('O servidor não retornou uma sessão válida.');
  currentUser=authSession.user;
  await loadProfile();
  await loadCloudData();
  persistSession(authSession,remember);
}

async function saveRecordCloud(rec){
  const payload={...rec,status:rec.status||'closed'};
  const result=await sbRest('rpc/save_cash_closing',{
    method:'POST',
    headers:{'Prefer':'return=representation'},
    body:JSON.stringify({p_record:payload})
  });
  return result;
}

function makeChannels(){let html='';channels.forEach((name,i)=>{html+=`<div class="channel-row"><b>${escapeHtml(name)}</b><input id="q${i}" type="number" min="0" step="1" placeholder="Qtd" aria-label="Quantidade do dia - ${escapeHtml(name)}"><input id="v${i}" type="number" min="0" step="0.01" placeholder="R$" aria-label="Valor do dia - ${escapeHtml(name)}"><span class="month-qty" id="cq${i}">0</span><span class="month-value money" id="cv${i}">R$ 0,00</span></div>`});$('channels').innerHTML=html;channels.forEach((_,i)=>['q'+i,'v'+i].forEach(id=>$(id).addEventListener('input',onFormInput)))}
