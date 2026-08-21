/* Compatibilidade com versões antigas do X-Burguer Caixa — v4.16.2 */
(function(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/xburguer-caixa/service-worker.js?v=4.16.2',{
        scope:'/xburguer-caixa/',
        updateViaCache:'none'
      });
      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready.catch(()=>{});
    }catch(err){
      console.warn('PWA Caixa:',err);
    }
  });
})();
