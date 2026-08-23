/* X-Burguer Caixa — ponte local para testar RPC de exclusão segura. */
(function(){
  'use strict';
  if(!window.__XB_E2E__||typeof sbRest!=='function')return;

  const previous=sbRest;
  sbRest=async function(path,options={}){
    const target=String(path||'');
    if(target.startsWith('rpc/delete_cash_closing')){
      const payload=typeof options.body==='string'?JSON.parse(options.body):options.body||{};
      const id=String(payload.p_id||'');
      if(!id)throw new Error('ID do fechamento de teste ausente.');
      return previous(`cash_closings?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
    }
    return previous(path,options);
  };
})();
