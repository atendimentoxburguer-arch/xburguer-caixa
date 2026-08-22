/* X-Burguer Caixa — estrutura e resumo do controle de pães */
(function(){
  'use strict';

  const byId=id=>document.getElementById(id);
  const qty=id=>Number(byId(id)?.value||0);

  function ensureResult(row,id,label){
    if(!row)return null;
    let value=byId(id);
    if(value)return value;
    const box=document.createElement('div');
    box.className='bread-result';
    box.innerHTML=`<span>${label}</span><b id="${id}">0</b>`;
    row.appendChild(box);
    return byId(id);
  }

  function ensureBreadUi(){
    const idealStart=byId('idealStart');
    const gourmetStart=byId('gourmetStart');
    if(!idealStart||!gourmetStart)return false;

    const panel=idealStart.closest('.panel');
    const head=panel?.querySelector('.bread-row.head');
    if(head)head.innerHTML='<span>Tipo de pão</span><span>Est. inicial</span><span>Est. final</span><span>Produção</span><span>Acum. mês</span>';

    const idealRow=idealStart.closest('.bread-row');
    const gourmetRow=gourmetStart.closest('.bread-row');
    ensureResult(idealRow,'idealFinal','Produção');
    ensureResult(idealRow,'idealMonth','Acum. mês');
    ensureResult(gourmetRow,'gourmetFinal','Produção');
    ensureResult(gourmetRow,'gourmetMonth','Acum. mês');

    [['idealProd','Pão Ideal'],['gourmetProd','Pão Gourmet']].forEach(([id,name])=>{
      const input=byId(id);
      const label=input?.closest('.bread-cell')?.querySelector('span');
      if(label)label.textContent='Est. final';
      if(input){input.placeholder='Qtd';input.setAttribute('aria-label','Estoque final do '+name);}
    });

    const note=panel?.querySelector('.bread-note');
    if(note)note.textContent='Informe o estoque inicial e o estoque final. A produção é calculada automaticamente: estoque inicial − estoque final. O acumulado mensal soma as produções do mês.';
    return true;
  }

  function updateBreadSummary(){
    if(!ensureBreadUi())return;
    const selectedDate=byId('date')?.value||((typeof isoToday==='function')?isoToday():'');
    const ym=selectedDate.slice(0,7);
    let prior=[];
    try{prior=monthRecords(ym).map(normalize).filter(r=>String(r.date||'')<selectedDate)}catch{}

    const pairs=[
      {prefix:'ideal',start:'idealStart',final:'idealProd',production:'idealFinal',month:'idealMonth'},
      {prefix:'gourmet',start:'gourmetStart',final:'gourmetProd',production:'gourmetFinal',month:'gourmetMonth'}
    ];

    pairs.forEach(item=>{
      const start=qty(item.start);
      const final=qty(item.final);
      const hasStart=String(byId(item.start)?.value??'').trim()!=='';
      const hasFinal=String(byId(item.final)?.value??'').trim()!=='';
      const production=hasStart&&hasFinal?start-final:0;
      const output=byId(item.production);
      if(output)output.textContent=production;
      output?.parentElement?.classList.toggle('negative-stock',production<0);
      const previous=prior.reduce((sum,r)=>sum+Number(r.breads?.[item.prefix+'Prod']||0),0);
      const month=byId(item.month);
      if(month)month.textContent=previous+production;
    });
  }

  if(typeof calc==='function'){
    const previousCalc=calc;
    calc=function(){
      const result=previousCalc.apply(this,arguments);
      updateBreadSummary();
      return result;
    };
  }

  ['idealStart','idealProd','gourmetStart','gourmetProd'].forEach(id=>byId(id)?.addEventListener('input',updateBreadSummary));
  ensureBreadUi();
  updateBreadSummary();
})();
