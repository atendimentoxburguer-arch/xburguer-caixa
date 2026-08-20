/* X-Burguer Caixa — registro PWA v4.14.3 */
(function(){
  if(!('serviceWorker' in navigator))return;

  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/xburguer-caixa/sw.js?v=4.14.3',{
        scope:'/xburguer-caixa/',
        updateViaCache:'none'
      });
      await reg.update().catch(()=>{});
      await navigator.serviceWorker.ready.catch(()=>{});
    }catch(err){
      console.warn('PWA Caixa:',err);
    }
  });

  /*
   * Não interceptamos beforeinstallprompt.
   * Assim Chrome/Edge podem exibir o ícone nativo de instalação
   * diretamente na barra de endereço, como no outro sistema.
   */
})();
