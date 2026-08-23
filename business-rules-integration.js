/* X-Burguer Caixa — integração da arquitetura de regras v4.18.2 */
(function(){
  'use strict';
  const rules=window.XBBusinessRules;
  if(!rules)throw new Error('X-Burguer Caixa: módulo de regras de negócio não carregado.');

  if(typeof cloudToRecord==='function'){
    const previous=cloudToRecord;
    cloudToRecord=function(row){
      const record=previous(row);
      return rules.normalizeRecord(record,{cashCountVerified:!!row?.cash_count_verified});
    };
  }

  if(typeof normalize==='function'){
    const previous=normalize;
    normalize=function(record){
      const base=previous(record);
      if(!base)return base;
      return rules.normalizeRecord(base,{cashCountVerified:base.cashCountVerified});
    };
  }

  if(typeof currentRecord==='function'){
    const previous=currentRecord;
    currentRecord=function(dateOverride=null){
      const base=previous(dateOverride);
      if(!base)return base;
      const countedRaw=String(document.getElementById('countedCash')?.value??'').trim();
      return rules.normalizeRecord(base,{cashCountVerified:countedRaw!==''});
    };
  }

  if(typeof validateRecord==='function'){
    const previous=validateRecord;
    validateRecord=function(record){
      const base=previous(record);
      if(base!==true)return base;
      return rules.validateCanonicalRecord(record);
    };
  }

  window.XBArchitecture=Object.freeze({
    version:'1',
    appVersion:rules.VERSION,
    layers:Object.freeze(['ui','business-rules','persistence','backup','realtime']),
    rules
  });
})();
