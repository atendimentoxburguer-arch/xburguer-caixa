/* X-Burguer Caixa — instalação correta em tablet/mobile v4.18.2 */
(function(){
  'use strict';

  let deferredPrompt=null;
  let banner=null;
  let dismissed=false;

  const isStandalone=()=>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone===true ||
    document.referrer.startsWith('android-app://');

  const isIOS=()=>{
    const ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  };

  const isTouchDevice=()=>navigator.maxTouchPoints>0 || matchMedia('(pointer: coarse)').matches;

  function removeBanner(){
    if(banner){banner.remove();banner=null;}
  }

  function setDisplayMode(){
    document.documentElement.dataset.displayMode=isStandalone()?'standalone':'browser';
    if(isStandalone())removeBanner();
  }

  function buildBanner(){
    if(banner||dismissed||isStandalone()||!isTouchDevice())return null;

    banner=document.createElement('aside');
    banner.id='xbInstallHelper';
    banner.setAttribute('aria-live','polite');
    banner.style.cssText=[
      'position:fixed','left:50%','bottom:max(16px,env(safe-area-inset-bottom))','transform:translateX(-50%)',
      'z-index:2147483000','width:min(560px,calc(100% - 24px))','box-sizing:border-box',
      'background:#fff','border:1px solid #cbdde6','border-radius:16px','padding:14px',
      'box-shadow:0 16px 48px rgba(18,41,61,.22)','font-family:system-ui,-apple-system,sans-serif','color:#12293d'
    ].join(';');

    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:flex-start;gap:12px';

    const content=document.createElement('div');
    content.style.cssText='flex:1;min-width:0';
    content.innerHTML='<strong style="display:block;font-size:14px;line-height:1.25">Use como aplicativo no tablet</strong><p id="xbInstallText" style="margin:5px 0 0;font-size:12px;line-height:1.45;color:#526d7e"></p>';

    const close=document.createElement('button');
    close.type='button';
    close.setAttribute('aria-label','Fechar aviso de instalação');
    close.textContent='×';
    close.style.cssText='border:0;background:transparent;color:#526d7e;font-size:24px;line-height:1;padding:0 2px;cursor:pointer';
    close.addEventListener('click',()=>{dismissed=true;removeBanner();});

    row.append(content,close);
    banner.appendChild(row);

    const actions=document.createElement('div');
    actions.id='xbInstallActions';
    actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:11px';
    banner.appendChild(actions);

    document.body.appendChild(banner);
    return banner;
  }

  function button(label,handler,primary=false){
    const b=document.createElement('button');
    b.type='button';
    b.textContent=label;
    b.style.cssText='border-radius:10px;padding:9px 12px;font-weight:800;font-size:12px;cursor:pointer;border:1px solid '+(primary?'#126f9a':'#cadce5')+';background:'+(primary?'#126f9a':'#f6fafb')+';color:'+(primary?'#fff':'#274b60');
    b.addEventListener('click',handler);
    return b;
  }

  function renderInstallHelp(){
    if(isStandalone()){removeBanner();return;}
    const card=buildBanner();
    if(!card)return;

    const text=card.querySelector('#xbInstallText');
    const actions=card.querySelector('#xbInstallActions');
    if(!text||!actions)return;
    actions.innerHTML='';

    if(deferredPrompt){
      text.textContent='Instale pelo botão abaixo para abrir sem a barra do navegador. Evite usar apenas “Criar atalho”.';
      actions.appendChild(button('Instalar aplicativo',async()=>{
        const prompt=deferredPrompt;
        if(!prompt)return;
        deferredPrompt=null;
        try{
          await prompt.prompt();
          const choice=await prompt.userChoice;
          if(choice?.outcome==='accepted')removeBanner();
          else renderInstallHelp();
        }catch(_){renderInstallHelp();}
      },true));
      return;
    }

    if(isIOS()){
      text.textContent='No iPad, abra esta página no Safari e use Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone criado.';
      return;
    }

    text.textContent='No Chrome ou Samsung Internet, abra o menu do navegador e escolha “Instalar aplicativo”. Se aparecer somente “Criar atalho”, aguarde alguns segundos e tente novamente.';
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    renderInstallHelp();
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    removeBanner();
    document.documentElement.dataset.displayMode='installed';
  });

  matchMedia('(display-mode: standalone)').addEventListener?.('change',setDisplayMode);
  window.addEventListener('pageshow',setDisplayMode);

  function boot(){
    setDisplayMode();
    if(!isStandalone()&&isTouchDevice())setTimeout(renderInstallHelp,1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.XBPWAInstall=Object.freeze({
    isStandalone,
    show:renderInstallHelp
  });
})();
