/* X-Burguer Caixa — trava de identidade em tempo de execução */
(function(){
  'use strict';

  const APP='X-Burguer Caixa';
  const EXPECTED_PATH='/xburguer-caixa/';
  const EXPECTED_SUPABASE_HOST='trnngxezppeembrvxkhh.supabase.co';
  let blocked=false;
  let blockReason='';

  function renderBlocked(){
    if(!blocked||!document.body||document.getElementById('xbIdentityBlock'))return;
    const layer=document.createElement('div');
    layer.id='xbIdentityBlock';
    layer.setAttribute('role','alert');
    layer.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#f3f8fa;color:#12293d;font-family:system-ui,-apple-system,sans-serif';
    layer.innerHTML='<div style="max-width:620px;background:#fff;border:1px solid #d7e5eb;border-radius:18px;padding:24px;box-shadow:0 18px 60px rgba(18,41,61,.18)"><strong style="display:block;font-size:20px;margin-bottom:10px">Proteção do X-Burguer Caixa</strong><p style="margin:0;line-height:1.55">O aplicativo bloqueou a inicialização porque detectou uma configuração que não pertence ao Caixa.</p><p style="margin:10px 0 0;font-size:12px;color:#5f7787">'+String(blockReason).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})+'</p></div>';
    document.body.appendChild(layer);
  }

  function block(reason){
    blocked=true;
    blockReason=reason||'Identidade do aplicativo inválida.';
    window.__XB_IDENTITY_BLOCKED__=true;
    document.documentElement.dataset.xbIdentity='blocked';
    console.error(APP+': '+blockReason);
    if(document.body)renderBlocked();
    else document.addEventListener('DOMContentLoaded',renderBlocked,{once:true});
  }

  function validateSupabaseUrl(value){
    let url;
    try{url=new URL(typeof value==='string'?value:(value&&value.url)||'',location.href)}catch{return true;}
    if(url.hostname.endsWith('.supabase.co')&&url.hostname!==EXPECTED_SUPABASE_HOST){
      block('Tentativa de conexão com um projeto Supabase diferente do projeto oficial do Caixa.');
      throw new Error('Conexão bloqueada pela proteção de identidade do X-Burguer Caixa.');
    }
    return true;
  }

  if(location.hostname==='atendimentoxburguer-arch.github.io'&&!location.pathname.startsWith(EXPECTED_PATH)){
    block('O Caixa foi aberto fora do caminho oficial '+EXPECTED_PATH+'.');
  }

  const nativeFetch=window.fetch&&window.fetch.bind(window);
  if(nativeFetch){
    window.fetch=function(input,init){
      validateSupabaseUrl(typeof input==='string'?input:input&&input.url);
      if(blocked)return Promise.reject(new Error('Aplicativo bloqueado pela proteção de identidade.'));
      return nativeFetch(input,init);
    };
  }

  const NativeWebSocket=window.WebSocket;
  if(NativeWebSocket){
    function GuardedWebSocket(url,protocols){
      validateSupabaseUrl(url);
      if(blocked)throw new Error('Aplicativo bloqueado pela proteção de identidade.');
      return protocols===undefined?new NativeWebSocket(url):new NativeWebSocket(url,protocols);
    }
    GuardedWebSocket.prototype=NativeWebSocket.prototype;
    try{Object.setPrototypeOf(GuardedWebSocket,NativeWebSocket)}catch{}
    window.WebSocket=GuardedWebSocket;
  }

  window.XBIdentityGuard=Object.freeze({
    app:'caixa',
    expectedPath:EXPECTED_PATH,
    expectedSupabaseHost:EXPECTED_SUPABASE_HOST,
    validateSupabaseUrl,
    isBlocked:function(){return blocked;}
  });

  if(!blocked)document.documentElement.dataset.xbIdentity='caixa-ok';
})();
