/* X-Burguer Caixa — proteção de operações críticas v4.18.3 */
(function(){
  function operationInProgress(){
    return !!(saveInProgress||deleteInProgress||manualSyncInProgress||importInProgress);
  }

  const logoutBtn=document.getElementById('logoutBtn');
  if(logoutBtn){
    logoutBtn.addEventListener('click',e=>{
      if(!operationInProgress())return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toast('Aguarde a operação atual terminar antes de sair do sistema.','error');
    },true);
  }

  window.addEventListener('beforeunload',e=>{
    if(!operationInProgress())return;
    e.preventDefault();
    e.returnValue='';
  });

  window.addEventListener('pageshow',()=>{
    try{window.XBurguerCurrency?.refresh?.()}catch{}
  });
})();
