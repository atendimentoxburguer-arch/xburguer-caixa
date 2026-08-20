/* X-Burguer Caixa — registro e instalação PWA v4.14.2 */
(function(){
  let installPrompt=null;
  let installButton=null;

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  }

  function removeInstallButton(){
    if(installButton){installButton.remove();installButton=null;}
  }

  function ensureInstallButton(){
    if(isStandalone()||installButton||!installPrompt)return;
    installButton=document.createElement('button');
    installButton.type='button';
    installButton.textContent='Instalar X-Burguer Caixa';
    installButton.setAttribute('aria-label','Instalar aplicativo X-Burguer Caixa');
    Object.assign(installButton.style,{
      position:'fixed',right:'18px',bottom:'18px',zIndex:'9999',
      border:'0',borderRadius:'14px',padding:'13px 17px',
      background:'#12293D',color:'#fff',fontWeight:'800',fontSize:'14px',
      boxShadow:'0 10px 28px rgba(18,41,61,.28)',cursor:'pointer'
    });
    installButton.addEventListener('click',async()=>{
      if(!installPrompt)return;
      installButton.disabled=true;
      try{
        await installPrompt.prompt();
        await installPrompt.userChoice.catch(()=>null);
      }finally{
        installPrompt=null;
        removeInstallButton();
      }
    });
    document.body.appendChild(installButton);
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    ensureInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    removeInstallButton();
  });

  if('serviceWorker' in navigator){
    window.addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register('./sw.js?v=4.14.2',{scope:'./',updateViaCache:'none'});
        await reg.update().catch(()=>{});
        await navigator.serviceWorker.ready.catch(()=>{});
      }catch(err){console.warn('PWA Caixa:',err)}
    });
  }
})();
