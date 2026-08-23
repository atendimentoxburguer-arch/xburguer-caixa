/* X-Burguer Caixa — segurança adicional v4.18.2 */
(function(){
  'use strict';

  const SECURITY_REVISION='security-1';

  if(typeof deleteRecord==='function'){
    deleteRecord=async function(date){
      if(deleteInProgress)return;
      const record=load().find(item=>item.date===date);
      if(!record)return;

      const ok=await openConfirmModal({
        title:'Excluir fechamento',
        message:`Deseja excluir o fechamento de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}?`,
        note:'Antes da exclusão, o banco cria uma cópia de recuperação protegida por SHA-256.',
        confirmText:'Excluir',
        badge:'Exclusão'
      });
      if(!ok)return;

      deleteInProgress=true;
      try{
        setCloudStatus('● Excluindo...','syncing');
        await sbRest('rpc/delete_cash_closing',{
          method:'POST',
          headers:{'Prefer':'return=representation'},
          body:JSON.stringify({p_id:record._id})
        });
        await loadCloudData();
        removeDraft(date);
        if(activeClosingDate===date){
          resetFormFields(date);
          formDirty=false;
          setDraftBadge('Fechamento excluído • formulário limpo','clean');
        }
        refreshAll();
        toast('Fechamento excluído com cópia de recuperação protegida.');
      }catch(err){
        setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
        toast(err?.message||'Não foi possível excluir este fechamento.','error');
      }finally{
        deleteInProgress=false;
      }
    };
  }

  window.XBSecurity=Object.freeze({
    revision:SECURITY_REVISION,
    deleteViaRpc:true,
    recoveryChecksum:'SHA-256'
  });
})();
