/* X-Burguer Caixa — registro PWA isolado v4.16.3 */
(function(){
  if(!('serviceWorker' in navigator))return;

  window.addEventListener('load',async()=>{
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
        '/xburguer-caixa/service-worker.js?v=4.16.3',
        {
          scope:'/xburguer-caixa/',
          updateViaCache:'none'
        }
      );

      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready.catch(()=>{});
    }catch(err){
      console.warn('PWA Caixa:',err);
    }
  });
})();
