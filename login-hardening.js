/* X-Burguer Caixa — reforço de login v4.18.3 */
(function(){
  'use strict';

  const form=document.getElementById('loginForm');
  const pass=document.getElementById('loginPass');
  const toggle=document.getElementById('togglePass');
  const errorBox=document.getElementById('loginError');
  const remember=document.getElementById('rememberMe');
  const loginBtn=form?.querySelector('.login-btn');
  const logoutBtn=document.getElementById('logoutBtn');
  if(!form||!pass||!toggle||!errorBox||!loginBtn)return;

  let loginBusy=false;
  let capsEl=document.getElementById('loginCaps');
  if(!capsEl){
    capsEl=document.createElement('div');
    capsEl.id='loginCaps';
    capsEl.className='login-caps';
    capsEl.textContent='Caps Lock está ativado.';
    const passwordField=pass.closest('.login-field');
    passwordField?.insertAdjacentElement('afterend',capsEl);
  }

  const title=document.querySelector('.login-title');
  const subtitle=document.querySelector('.login-subtitle');
  const demo=document.querySelector('.login-demo');
  if(title)title.textContent='Bem-vindo de volta';
  if(subtitle)subtitle.textContent='Acesse seu painel para registrar, conferir e acompanhar o caixa com segurança.';
  if(demo)demo.textContent='Acesso protegido • Uso interno X-Burguer';

  errorBox.setAttribute('role','alert');
  errorBox.setAttribute('aria-live','polite');
  errorBox.setAttribute('aria-atomic','true');
  pass.setAttribute('aria-describedby','loginError loginCaps');
  toggle.setAttribute('aria-controls','loginPass');
  toggle.setAttribute('aria-pressed','false');
  toggle.textContent='Mostrar';
  loginBtn.textContent='ENTRAR NO SISTEMA';

  function hideError(){
    errorBox.classList.remove('is-visible');
    errorBox.style.display='none';
    pass.removeAttribute('aria-invalid');
  }

  function showError(message){
    errorBox.textContent=String(message||'Não foi possível entrar no sistema.');
    errorBox.classList.add('is-visible');
    errorBox.style.display='flex';
    pass.setAttribute('aria-invalid','true');
  }

  function setBusy(busy,label='ENTRANDO...'){
    loginBusy=!!busy;
    loginBtn.disabled=loginBusy;
    toggle.disabled=loginBusy;
    loginBtn.classList.toggle('is-loading',loginBusy);
    loginBtn.textContent=loginBusy?label:'ENTRAR NO SISTEMA';
    form.setAttribute('aria-busy',loginBusy?'true':'false');
  }

  function resetPasswordVisibility(){
    pass.type='password';
    toggle.textContent='Mostrar';
    toggle.setAttribute('aria-label','Mostrar senha');
    toggle.setAttribute('aria-pressed','false');
  }

  function isNetworkMessage(message){
    return /internet|conex[aã]o|servidor|demorou demais|network|failed to fetch|fetch failed/i.test(String(message||''));
  }

  function friendlyAuthMessage(err){
    const raw=String(err?.message||'').trim();
    const msg=raw.toLowerCase();
    if(/invalid login credentials|invalid_credentials|senha incorreta|invalid password/.test(msg))return'Senha incorreta. Confira a senha e tente novamente.';
    if(/email_not_confirmed|email not confirmed|acesso ainda n[aã]o foi liberado/.test(msg))return'O acesso deste usuário ainda não foi liberado no servidor.';
    if(/too many|rate limit|429|muitas tentativas|muitas solicita/.test(msg))return'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.';
    if(/sess[aã]o expirada|refresh token|invalid.*token|jwt.*expir/.test(msg))return'Sua sessão expirou. Digite a senha novamente para continuar.';
    if(/demorou demais|timeout/.test(msg))return'O servidor demorou para responder. Verifique a internet e tente novamente.';
    if(isNetworkMessage(raw))return'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    if(/usu[aá]rio.*desativado|user.*disabled/.test(msg))return'Este acesso está desativado. Procure o responsável pelo sistema.';
    if(raw&&raw.length<=180&&!/[{}<>]/.test(raw))return raw;
    return'Não foi possível entrar no sistema. Tente novamente.';
  }

  function updateCaps(e){
    const on=!!e?.getModifierState?.('CapsLock');
    capsEl.classList.toggle('is-visible',on);
  }

  pass.addEventListener('input',()=>{
    hideError();
    capsEl.classList.remove('is-visible');
  },true);
  pass.addEventListener('keydown',updateCaps,true);
  pass.addEventListener('keyup',updateCaps,true);
  pass.addEventListener('blur',()=>capsEl.classList.remove('is-visible'),true);
  pass.addEventListener('invalid',e=>{
    e.preventDefault();
    showError('Digite a senha para entrar no sistema.');
    pass.focus();
  },true);

  toggle.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const willShow=pass.type==='password';
    pass.type=willShow?'text':'password';
    toggle.textContent=willShow?'Ocultar':'Mostrar';
    toggle.setAttribute('aria-label',willShow?'Ocultar senha':'Mostrar senha');
    toggle.setAttribute('aria-pressed',willShow?'true':'false');
    pass.focus({preventScroll:true});
  },true);

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    if(loginBusy)return;

    const password=pass.value;
    if(!password){
      showError('Digite a senha para entrar no sistema.');
      pass.focus();
      return;
    }
    if(!navigator.onLine){
      showError('Você está sem internet. Conecte-se para validar o acesso.');
      return;
    }

    hideError();
    setBusy(true);
    try{
      await loginCloud('xburguer@xburguer.com',password,!!remember?.checked);
      restoreInitialClosing();
      refreshAll();
      showApp();
      pass.value='';
      resetPasswordVisibility();
      toast('Login realizado. Dados sincronizados.');
      if(typeof startRealtimeSync==='function')startRealtimeSync(true).catch(()=>{});
    }catch(err){
      try{clearStoredSessions()}catch{}
      try{authSession=null;currentUser=null;currentProfile=null;cloudData=[]}catch{}
      showError(friendlyAuthMessage(err));
      try{setCloudStatus('● Falha no login','error')}catch{}
      pass.focus({preventScroll:true});
    }finally{
      setBusy(false);
    }
  },true);

  logoutBtn?.addEventListener('click',()=>{
    resetPasswordVisibility();
    hideError();
    capsEl.classList.remove('is-visible');
    setBusy(false);
  });

  /* Evita que uma sessão revogada/expirada deixe a interface aberta sem conseguir sincronizar. */
  if(typeof refreshAuthSession==='function'){
    const originalRefresh=refreshAuthSession;
    refreshAuthSession=async function(...args){
      try{
        return await originalRefresh(...args);
      }catch(err){
        const msg=String(err?.message||'');
        const expired=/sess[aã]o expirada|refresh token|invalid.*token|jwt.*expir|senha incorreta|invalid credentials/i.test(msg);
        if(expired&&!isNetworkMessage(msg)){
          try{clearStoredSessions()}catch{}
          try{authSession=null;currentUser=null;currentProfile=null;cloudData=[]}catch{}
          const screen=document.getElementById('loginScreen');
          screen?.classList.remove('hidden','leaving');
          showError('Sua sessão expirou. Digite a senha novamente para continuar.');
          resetPasswordVisibility();
          setBusy(false);
          try{setCloudStatus('● Sessão expirada','error')}catch{}
        }
        throw err;
      }
    };
  }

  window.XBLoginHardening={
    version:'4.18.3',
    friendlyAuthMessage,
    showError,
    hideError,
    setBusy,
    resetPasswordVisibility
  };
})();
