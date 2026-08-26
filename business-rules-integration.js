/* X-Burguer Caixa — integração da arquitetura de regras v4.18.3 */
(function(){
  'use strict';
  const rules=window.XBBusinessRules;
  if(!rules)throw new Error('X-Burguer Caixa: módulo de regras de negócio não carregado.');

  const AUTO_OPENING_EFFECTIVE_DATE='2026-08-24';
  const byId=id=>document.getElementById(id);
  const activeDate=()=>{
    try{if(typeof activeClosingDate!=='undefined'&&activeClosingDate)return activeClosingDate}catch{}
    return byId('date')?.value||'';
  };

  function isManagedOpeningDate(date){
    const value=String(date||'');
    return value>=AUTO_OPENING_EFFECTIVE_DATE&&!rules.isFirstDayOfMonth(value);
  }

  function savedRecords(){
    try{return typeof load==='function'?(load()||[]):[]}catch{return[]}
  }

  function sameMonth(a,b){
    return String(a||'').slice(0,7)===String(b||'').slice(0,7);
  }

  function findPreviousSaved(date){
    const target=String(date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(target))return null;
    const current=findSaved(target);
    const registerName=current?.registerName||'Caixa Principal';
    const shiftName=current?.shiftName||'Dia';
    const record=savedRecords()
      .filter(item=>{
        const itemDate=String(item?.date||'');
        const itemRegister=item?.registerName||'Caixa Principal';
        const itemShift=item?.shiftName||'Dia';
        return itemDate<target&&sameMonth(itemDate,target)&&itemRegister===registerName&&itemShift===shiftName;
      })
      .sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||'')))[0]||null;
    return record?rules.normalizeRecord(record,{cashCountVerified:record.cashCountVerified}):null;
  }

  function findSaved(date){
    return savedRecords().find(item=>String(item?.date||'')===String(date||''))||null;
  }

  function setOpeningReadonly(readonly,title){
    const input=byId('opening');
    const proxy=byId('opening__brl');
    [input,proxy].filter(Boolean).forEach(el=>{
      el.readOnly=!!readonly;
      el.setAttribute('aria-readonly',readonly?'true':'false');
      el.title=title||'';
      el.dataset.openingMode=readonly?'automatic':'manual';
    });
  }

  function setOpeningValue(value){
    const input=byId('opening');
    if(!input)return;
    input.value=value===''?'':String(rules.roundMoney(value));
    try{window.XBurguerCurrency?.refresh?.()}catch{}
  }

  function applyOpeningRule(date,{preserveSavedWhenMissing=true}={}){
    const target=String(date||'');
    if(!target)return{mode:'unknown'};

    if(!isManagedOpeningDate(target)){
      const first=rules.isFirstDayOfMonth(target);
      setOpeningReadonly(false,first
        ?'Dia 01: Saldo Inicial manual. O mês começa com um novo saldo base.'
        :'Registro anterior à regra automática: Saldo Inicial preservado.');
      return{mode:first?'manual-month-start':'legacy'};
    }

    const previous=findPreviousSaved(target);
    if(previous){
      const value=rules.nextOpeningBalance(previous);
      setOpeningValue(value);
      setOpeningReadonly(true,`Automático a partir do último fechamento salvo do mês (${new Date(previous.date+'T12:00:00').toLocaleDateString('pt-BR')}): Saldo Inicial + Dinheiro do Caixa + Dinheiro das Entregas − retiradas para despesas.`);
      return{mode:'automatic',value,previousDate:previous.date};
    }

    const saved=findSaved(target);
    if(saved&&preserveSavedWhenMissing)setOpeningValue(saved.opening||0);
    setOpeningReadonly(false,'Não existe fechamento anterior salvo neste mês. Neste primeiro registro disponível, informe o Saldo Inicial manualmente.');
    return{mode:'manual-no-previous',value:saved?Number(saved.opening||0):null};
  }

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

  if(typeof resetFormFields==='function'){
    const previous=resetFormFields;
    resetFormFields=function(date){
      const result=previous(date);
      applyOpeningRule(date||activeDate());
      try{calc()}catch{}
      return result;
    };
  }

  if(typeof populateForm==='function'){
    const previous=populateForm;
    populateForm=function(record,options={}){
      const result=previous(record,options);
      const date=record?.date||activeDate();
      applyOpeningRule(date,{preserveSavedWhenMissing:true});
      try{calc()}catch{}
      return result;
    };
  }

  if(typeof currentRecord==='function'){
    const previous=currentRecord;
    currentRecord=function(dateOverride=null){
      const target=dateOverride||activeDate();
      applyOpeningRule(target,{preserveSavedWhenMissing:true});
      const base=previous(dateOverride);
      if(!base)return base;
      const countedRaw=String(byId('countedCash')?.value??'').trim();
      return rules.normalizeRecord(base,{cashCountVerified:countedRaw!==''});
    };
  }

  if(typeof validateRecord==='function'){
    const previous=validateRecord;
    validateRecord=function(record){
      const base=previous(record);
      if(base!==true)return base;
      const canonical=rules.validateCanonicalRecord(record);
      if(canonical!==true)return canonical;

      if(isManagedOpeningDate(record?.date)){
        const previousClosing=findPreviousSaved(record.date);
        if(!previousClosing)return true;
        const expected=rules.nextOpeningBalance(previousClosing);
        if(Math.abs(Number(record.opening||0)-expected)>=0.01){
          return`O Saldo Inicial desta data é automático e deve ser ${expected.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}, calculado a partir do último fechamento anterior salvo no mês.`;
        }
      }
      return true;
    };
  }

  setTimeout(()=>{
    try{applyOpeningRule(activeDate())}catch{}
  },0);

  window.XBArchitecture=Object.freeze({
    version:'1',
    appVersion:rules.VERSION,
    layers:Object.freeze(['ui','business-rules','persistence','backup','realtime']),
    openingPolicy:Object.freeze({
      effectiveDate:AUTO_OPENING_EFFECTIVE_DATE,
      dayOne:'manual',
      otherDays:'automatic-from-last-saved-in-month',
      gapsAllowed:true,
      firstSavedWithoutPrevious:'manual'
    }),
    rules
  });
})();
