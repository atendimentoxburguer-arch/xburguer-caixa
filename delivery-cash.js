/* X-Burguer Caixa — campo Dinheiro (Entregas) v4.18.3
   As regras financeiras vivem no núcleo (app1–app4 + business-rules).
   Este módulo cuida somente da compatibilidade visual do campo dinâmico. */
(function(){
  'use strict';

  const byId=id=>document.getElementById(id);

  function ensureDeliveryCashField(){
    const existing=byId('deliveryCash');
    if(existing)return existing;

    const cash=byId('cash');
    const row=cash?.closest('.data-row');
    if(!row)return null;

    const deliveryRow=document.createElement('div');
    deliveryRow.className='data-row';
    deliveryRow.innerHTML='<span>Dinheiro (Entregas)</span><input id="deliveryCash" type="number" min="0" step="0.01" inputmode="decimal" placeholder="R$" aria-label="Dinheiro recebido nas entregas"><span class="money" id="aDeliveryCash">R$ 0,00</span>';
    row.insertAdjacentElement('afterend',deliveryRow);
    return byId('deliveryCash');
  }

  function fixBreadPlaceholders(){
    [['idealStart','idealProd'],['gourmetStart','gourmetProd']].forEach(([startId,finalId])=>{
      const start=byId(startId),final=byId(finalId);
      if(start)start.placeholder='Qtd';
      if(final){
        final.placeholder='Qtd';
        if(String(start?.value??'').trim()===''&&String(final.value??'').trim()==='0')final.value='';
      }
    });
  }

  ensureDeliveryCashField();
  fixBreadPlaceholders();

  setTimeout(()=>{
    ensureDeliveryCashField();
    fixBreadPlaceholders();
    try{window.XBurguerCurrency?.refresh?.()}catch{}
    try{calc()}catch{}
  },0);

  window.XBDeliveryCash={ensureField:ensureDeliveryCashField};
})();
