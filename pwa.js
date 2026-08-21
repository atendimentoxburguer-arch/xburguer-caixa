/* X-Burguer Caixa — registro PWA isolado v4.18.2 + correção tablet */
(function(){
  'use strict';
  const VERSION='4.18.2';
  const RELOAD_KEY='xb_pwa_controller_reload_tabletfix';
  if(!('serviceWorker' in navigator)){
    document.documentElement.dataset.pwaReady='unsupported';
    return;
  }

  async function registerPWA(){
    const expectedScope=new URL('/xburguer-caixa/',location.origin).href;
    const expectedScriptPath='/xburguer-caixa/service-worker.js';

    try{
      const registrations=await navigator.serviceWorker.getRegistrations();
      for(const old of registrations){
        if(old.scope!==expectedScope)continue;
        const scriptUrl=old.active?.scriptURL||old.waiting?.scriptURL||old.installing?.scriptURL||'';
        if(scriptUrl&&new URL(scriptUrl).pathname!==expectedScriptPath)await old.unregister();
      }

      const reg=await navigator.serviceWorker.register(
        '/xburguer-caixa/service-worker.js?v='+VERSION,
        {scope:'/xburguer-caixa/',updateViaCache:'none'}
      );
      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready;

      document.documentElement.dataset.pwaReady='true';
      document.documentElement.dataset.swControlled=navigator.serviceWorker.controller?'true':'false';

      if(!navigator.serviceWorker.controller&&!sessionStorage.getItem(RELOAD_KEY)){
        sessionStorage.setItem(RELOAD_KEY,'1');
        let reloaded=false;
        const reloadOnce=()=>{
          if(reloaded)return;
          reloaded=true;
          location.replace('/xburguer-caixa/');
        };
        navigator.serviceWorker.addEventListener('controllerchange',reloadOnce,{once:true});
        setTimeout(()=>{if(navigator.serviceWorker.controller)reloadOnce();},1200);
      }

      window.XBPWAState=Object.freeze({
        version:VERSION,
        scope:reg.scope,
        controlled:()=>!!navigator.serviceWorker.controller
      });
    }catch(err){
      document.documentElement.dataset.pwaReady='false';
      document.documentElement.dataset.swControlled='false';
      console.warn('PWA Caixa:',err);
    }
  }

  registerPWA();
})();
