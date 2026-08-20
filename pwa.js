/* X-Burguer Caixa — aplicativo instalável/PWA v4.15.0 */
(function(){
  function markStandalone(){
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    document.documentElement.classList.toggle('app-installed',standalone);
  }

  markStandalone();
  try{
    window.matchMedia('(display-mode: standalone)').addEventListener('change',markStandalone);
  }catch{}

  if(!('serviceWorker' in navigator))return;

  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/xburguer-caixa/sw.js?v=4.15.0',{
        scope:'/xburguer-caixa/',
        updateViaCache:'none'
      });
      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready;
    }catch(err){
      console.warn('X-Burguer Caixa PWA:',err);
    }
  });

  /*
   * Não interceptar beforeinstallprompt.
   * Chrome/Edge podem exibir o instalador nativo na barra de endereço.
   */
})();
