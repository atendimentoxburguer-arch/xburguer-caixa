/* X-Burguer Caixa — instalação e diagnóstico em tablet/mobile v4.18.3 */
(function(){
  'use strict';

  let deferredPrompt=null;
  let banner=null;
  let dismissed=false;
  let installedRelated=false;
  let relatedChecked=false;
  const params=new URLSearchParams(location.search);
  const legacyShortcut=params.get('app')==='caixa-oficial';

  const isStandalone=()=>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone===true;

  const isIOS=()=>{
    const ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  };
  const isTouchDevice=()=>navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
  const swControlled=()=>!!navigator.serviceWorker?.controller;

  if(legacyShortcut&&!isStandalone()){
    try{history.replaceState(null,'','/xburguer-caixa/');}catch{}
    document.documentElement.dataset.legacyShortcut='true';
  }

  async function checkExistingInstall(){
    if(typeof navigator.getInstalledRelatedApps!=='function'){
      relatedChecked=true;
      return false;
    }
    try{
      const apps=await navigator.getInstalledRelatedApps();
      installedRelated=Array.isArray(apps)&&apps.length>0;
    }catch{installedRelated=false;}
    relatedChecked=true;
    document.documentElement.dataset.pwaExistingInstall=installedRelated?'true':'false';
    return installedRelated;
  }

  function removeBanner(){if(banner){banner.remove();banner=null;}}
  function setDisplayMode(){
    document.documentElement.dataset.displayMode=isStandalone()?'standalone':'browser';
    if(isStandalone())removeBanner();
  }

  function buildBanner(){
    if(banner||dismissed||isStandalone()||!isTouchDevice())return null;
    banner=document.createElement('aside');
    banner.id='xbInstallHelper';
    banner.setAttribute('aria-live','polite');
    banner.style.cssText='position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;width:min(620px,calc(100% - 24px));box-sizing:border-box;background:#fff;border:1px solid #cbdde6;border-radius:16px;padding:14px;box-shadow:0 16px 48px rgba(18,41,61,.22);font-family:system-ui,-apple-system,sans-serif;color:#12293d';
    banner.innerHTML='<div style="display:flex;align-items:flex-start;gap:12px"><div style="flex:1;min-width:0"><strong id="xbInstallTitle" style="display:block;font-size:14px;line-height:1.25">Use como aplicativo no tablet</strong><p id="xbInstallText" style="margin:5px 0 0;font-size:12px;line-height:1.45;color:#526d7e"></p><small id="xbInstallDiag" style="display:block;margin-top:7px;color:#718896;font-size:10px;line-height:1.35"></small></div><button type="button" id="xbInstallClose" aria-label="Fechar aviso" style="border:0;background:transparent;color:#526d7e;font-size:24px;line-height:1;padding:0 2px">×</button></div><div id="xbInstallActions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:11px"></div>';
    document.body.appendChild(banner);
    banner.querySelector('#xbInstallClose').addEventListener('click',()=>{dismissed=true;removeBanner();});
    return banner;
  }

  function button(label,handler,primary=false){
    const b=document.createElement('button');
    b.type='button';b.textContent=label;
    b.style.cssText='border-radius:10px;padding:9px 12px;font-weight:800;font-size:12px;cursor:pointer;border:1px solid '+(primary?'#126f9a':'#cadce5')+';background:'+(primary?'#126f9a':'#f6fafb')+';color:'+(primary?'#fff':'#274b60');
    b.addEventListener('click',handler);return b;
  }

  async function renderInstallHelp(){
    if(isStandalone()){removeBanner();return;}
    if(!relatedChecked)await checkExistingInstall();
    const card=buildBanner();if(!card)return;
    const title=card.querySelector('#xbInstallTitle');
    const text=card.querySelector('#xbInstallText');
    const diag=card.querySelector('#xbInstallDiag');
    const actions=card.querySelector('#xbInstallActions');
    actions.innerHTML='';
    diag.textContent='Service Worker: '+(swControlled()?'ativo':'aguardando')+' • Instalação PWA: '+(deferredPrompt?'disponível':'não liberada pelo Chrome');

    if(installedRelated&&!isStandalone()){
      title.textContent='Instalação antiga encontrada no tablet';
      text.textContent='O Chrome informa que o X-Burguer Caixa já está instalado, mas esta tela está aberta no navegador. Abra Configurações do Android → Apps, procure “X-Burguer Caixa” ou “X-Burguer Controle de Caixa” e desinstale essa instalação antiga. Depois volte ao Chrome para instalar novamente.';
      return;
    }

    if(legacyShortcut){
      title.textContent='Atalho antigo detectado';
      text.textContent='O ícone antigo abre somente uma aba do Chrome. Remova esse ícone da tela inicial e não use “Criar atalho”.';
    }

    if(deferredPrompt){
      if(!legacyShortcut)text.textContent='O Chrome liberou a instalação PWA correta. Use o botão abaixo para abrir o Caixa sem abas e sem barra de endereço.';
      actions.appendChild(button('Instalar aplicativo',async()=>{
        const prompt=deferredPrompt;if(!prompt)return;
        deferredPrompt=null;
        try{
          await prompt.prompt();
          const choice=await prompt.userChoice;
          if(choice?.outcome==='accepted')removeBanner();
          else setTimeout(renderInstallHelp,300);
        }catch{setTimeout(renderInstallHelp,300);}
      },true));
      return;
    }

    if(isIOS()){
      text.textContent='No iPad, abra no Safari e use Compartilhar → Adicionar à Tela de Início.';
      return;
    }

    if(!swControlled()){
      title.textContent='Preparando instalação do aplicativo';
      text.textContent='O Chrome ainda está ativando o modo aplicativo. Aguarde alguns segundos; a página poderá recarregar uma vez automaticamente.';
      return;
    }

    if(!legacyShortcut){
      title.textContent='Chrome ainda oferece somente atalho';
      text.textContent='Não escolha “Criar atalho”, pois ele abre o navegador. Se continuar assim, verifique em Configurações do Android → Apps se existe uma instalação antiga do X-Burguer Caixa e desinstale-a antes de tentar novamente.';
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();deferredPrompt=event;
    document.documentElement.dataset.installPrompt='available';
    renderInstallHelp();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;removeBanner();document.documentElement.dataset.displayMode='installed';
  });
  matchMedia('(display-mode: standalone)').addEventListener?.('change',setDisplayMode);
  navigator.serviceWorker?.addEventListener('controllerchange',()=>setTimeout(renderInstallHelp,500));
  window.addEventListener('pageshow',setDisplayMode);

  async function boot(){
    setDisplayMode();
    await checkExistingInstall();
    if(!isStandalone()&&isTouchDevice())setTimeout(renderInstallHelp,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.XBPWAInstall=Object.freeze({isStandalone,show:renderInstallHelp,legacyShortcut,checkExistingInstall});
})();
