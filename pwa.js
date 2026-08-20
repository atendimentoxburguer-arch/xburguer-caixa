/* X-Burguer Caixa — registro PWA v4.14.0 */
(function(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=4.14.0',{scope:'./',updateViaCache:'none'});
      await reg.update().catch(()=>{});
    }catch{}
  });
})();
