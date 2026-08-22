/* X-Burguer Caixa — registro único e resiliente do PWA */
(function(){
  'use strict';

  const REVISION='native-4';
  const SCOPE='/xburguer-caixa/';
  const SCRIPT_PATH=SCOPE+'service-worker.js';
  let pending=null;

  async function register(){
    if(!('serviceWorker' in navigator))return null;
    if(pending)return pending;

    pending=(async()=>{
      const expectedScope=new URL(SCOPE,location.origin).href;
      const registrations=await navigator.serviceWorker.getRegistrations();

      for(const old of registrations){
        if(old.scope!==expectedScope)continue;
        const scriptUrl=
          old.active?.scriptURL ||
          old.waiting?.scriptURL ||
          old.installing?.scriptURL ||
          '';
        if(scriptUrl && new URL(scriptUrl).pathname!==SCRIPT_PATH){
          await old.unregister();
        }
      }

      const reg=await navigator.serviceWorker.register(
        SCRIPT_PATH+'?v='+REVISION,
        {scope:SCOPE,updateViaCache:'none'}
      );
      await reg.update().catch(()=>{});
      return reg;
    })();

    try{return await pending}
    finally{pending=null}
  }

  window.XBRegisterPWA=register;
  window.addEventListener('load',()=>{
    register().catch(err=>console.warn('PWA Caixa:',err));
  },{once:true});
})();
