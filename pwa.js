/* X-Burguer Caixa — registro PWA isolado v4.18.2 */
(function(){
  if(!('serviceWorker' in navigator))return;

  async function registerPWA(){
    const expectedScope=new URL('/xburguer-caixa/',location.origin).href;
    const expectedScriptPath='/xburguer-caixa/service-worker.js';

    try{
      const registrations=await navigator.serviceWorker.getRegistrations();

      for(const old of registrations){
        if(old.scope!==expectedScope)continue;

        const scriptUrl=
          old.active?.scriptURL ||
          old.waiting?.scriptURL ||
          old.installing?.scriptURL ||
          '';

        if(scriptUrl && new URL(scriptUrl).pathname!==expectedScriptPath){
          await old.unregister();
        }
      }

      const reg=await navigator.serviceWorker.register(
        '/xburguer-caixa/service-worker.js?v=4.18.2',
        {
          scope:'/xburguer-caixa/',
          updateViaCache:'none'
        }
      );

      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready.catch(()=>{});
      document.documentElement.dataset.pwaReady='true';
    }catch(err){
      document.documentElement.dataset.pwaReady='false';
      console.warn('PWA Caixa:',err);
    }
  }

  /* O script fica no fim do body, então registrar imediatamente ajuda navegadores
     de tablet a reconhecerem a instalação como PWA real, e não como simples atalho. */
  registerPWA();
})();
