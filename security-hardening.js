/* X-Burguer Caixa — segurança adicional v4.18.3 */
(function(){
  'use strict';

  const SECURITY_REVISION='security-2';

  async function refreshAfterConfirmedWrite(){
    try{
      await loadCloudData();
      return {refreshed:true,error:null};
    }catch(error){
      setCloudStatus(navigator.onLine?'● Salvo • sincronização pendente':'● Salvo • sem internet',navigator.onLine?'syncing':'error');
      return {refreshed:false,error};
    }
  }
  window.xbRefreshAfterConfirmedWrite=refreshAfterConfirmedWrite;

  /* Uma falha ao reler o banco depois do RPC não pode ser tratada como falha da
     gravação. O rascunho só é mantido quando o próprio salvamento falha. */
  if(typeof saveDay==='function'){
    saveDay=async function(){
      if(saveInProgress)return;
      flushDraft(activeClosingDate);
      const rec=currentRecord(activeClosingDate),valid=validateRecord(rec);
      if(valid!==true){toast(valid,'error');return}
      if(rec.sales===0&&rec.orders===0&&rec.expense===0){
        const emptyOk=await openConfirmModal({title:'Salvar fechamento',message:'Este fechamento está sem movimento. Deseja salvar mesmo assim?',note:'Você pode cancelar para preencher os dados antes de salvar.',confirmText:'Salvar mesmo assim',badge:'Confirmação'});
        if(!emptyOk)return;
      }
      const saveWarnings=buildSaveWarnings(rec);
      if(saveWarnings.length){
        const warningOk=await openConfirmModal({
          title:'Conferência antes de salvar',
          message:saveWarnings.join('\n'),
          note:'Revise os pontos acima. Se estiverem corretos, você ainda pode salvar o fechamento.',
          confirmText:'Salvar mesmo assim',
          badge:'Atenção'
        });
        if(!warningOk)return;
      }
      const exists=load().some(r=>r.date===rec.date);
      if(exists){
        const replaceOk=await openConfirmModal({title:'Substituir fechamento',message:'Já existe um fechamento nesta data. Deseja substituir os dados salvos no banco?',note:'O fechamento anterior dessa data será atualizado.',confirmText:'Substituir',badge:'Atualização'});
        if(!replaceOk)return;
      }

      saveInProgress=true;
      setClosingFormBusy(true);
      try{
        setCloudStatus('● Salvando...','syncing');
        setDraftBadge('Salvando na nuvem...','syncing');
        await saveRecordCloud(rec);

        /* O RPC já confirmou a persistência. A partir daqui, o rascunho não pode
           continuar marcado como não salvo apenas porque uma nova leitura falhou. */
        removeDraft(rec.date);
        formDirty=false;

        const sync=await refreshAfterConfirmedWrite();
        if(sync.refreshed){
          const fresh=load().find(r=>r.date===rec.date);
          if(fresh&&activeClosingDate===rec.date)populateForm(fresh,{source:'saved'});
          refreshAll();
          toast('Fechamento salvo e conferido na nuvem!');
        }else{
          setDraftBadge('Fechamento salvo • atualização pendente','saved');
          toast('Fechamento salvo na nuvem. A atualização da tela ficou pendente e será retomada automaticamente.','error');
        }
      }catch(err){
        formDirty=true;
        saveDraft(rec.date,{silent:true});
        setDraftBadge('Falha ao salvar • rascunho local preservado','error');
        setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
        toast(err?.message||'Não foi possível salvar no banco. Seus dados ficaram preservados neste computador.','error');
      }finally{
        saveInProgress=false;
        setClosingFormBusy(false);
      }
    };
  }

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

        /* A exclusão já foi confirmada pelo RPC. Reflete isso localmente antes da
           releitura para que uma queda de rede posterior não mostre o registro como ativo. */
        cloudData=(load()||[]).filter(item=>item._id!==record._id);
        removeDraft(date);
        if(activeClosingDate===date){
          resetFormFields(date);
          formDirty=false;
          setDraftBadge('Fechamento excluído • formulário limpo','clean');
        }
        refreshAll();

        const sync=await refreshAfterConfirmedWrite();
        if(sync.refreshed){
          refreshAll();
          toast('Fechamento excluído com cópia de recuperação protegida.');
        }else{
          toast('Fechamento excluído na nuvem. A atualização completa da tela ficou pendente e será retomada automaticamente.','error');
        }
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
    recoveryChecksum:'SHA-256',
    postWriteRefreshResilient:true
  });
})();
