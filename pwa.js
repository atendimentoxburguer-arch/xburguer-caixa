(function(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=4.13.0',{scope:'./'});
      reg.update().catch(()=>{});
    }catch{}
  });
})();
