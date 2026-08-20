(function(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js?v=4.12.9',{scope:'./'}).catch(()=>{});
  });
})();
