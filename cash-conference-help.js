/* X-Burguer Caixa — conferência simplificada do dinheiro em espécie v4.17.3 */
(function(){
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
  const num=id=>Number(document.getElementById(id)?.value||0);
  const hasValue=id=>String(document.getElementById(id)?.value??'').trim()!=='';

  function visibleElement(id){
    const raw=document.getElementById(id);
    if(raw?.closest('.cash-conference-item'))return raw;
    return document.getElementById(id+'__brl')||raw;
  }

  function getItem(id){
    return visibleElement(id)?.closest('.cash-conference-item')||document.getElementById(id)?.closest('.cash-conference-item')||null;
  }

  function setLabel(id,text){
    const item=getItem(id);
    const label=item?.querySelector('span');
    if(label)label.textContent=text;
  }

  function addHelp(id,text){
    const item=getItem(id);
    if(!item)return null;
    let help=item.querySelector('.cash-conference-help[data-help="main"]');
    if(!help){
      help=document.createElement('small');
      help.className='cash-conference-help';
      help.dataset.help='main';
      item.appendChild(help);
    }
    help.textContent=text;
    return item;
  }

  function expectedCashNow(){
    // Regra simplificada solicitada para a operação da loja:
    // somente vendas em dinheiro menos retiradas para despesas.
    // O saldo inicial NÃO entra na conferência física.
    return num('cash')-num('cashOut');
  }

  function patchRecord(rec){
    if(!rec)return rec;
    const expected=Number(rec.cash||0)-Number(rec.cashOut||0);
    rec.expectedCash=expected;
    rec.cashDifference=Number(rec.countedCash||0)-expected;
    return rec;
  }

  // Garante que rascunhos e novos salvamentos usem a nova regra.
  const originalCurrentRecord=window.currentRecord;
  if(typeof originalCurrentRecord==='function'){
    window.currentRecord=function(dateOverride=null){
      return patchRecord(originalCurrentRecord(dateOverride));
    };
  }

  // Ao carregar registros antigos, apresenta a conferência segundo a regra atual.
  const originalNormalize=window.normalize;
  if(typeof originalNormalize==='function'){
    window.normalize=function(record){
      return patchRecord(originalNormalize(record));
    };
  }

  function update(){
    const cashItem=getItem('cashDiff');
    const diffEl=document.getElementById('cashDiff');
    const expectedEl=document.getElementById('cashExpectedHelp');
    const statusEl=document.getElementById('cashConferenceStatus');
    if(!cashItem||!diffEl||!expectedEl||!statusEl)return;

    const expected=expectedCashNow();
    expectedEl.textContent='Esperado na gaveta: '+brl.format(expected)+'  •  V. Dinheiro − retiradas';

    cashItem.classList.remove('is-ok','is-short','is-over');

    if(!hasValue('countedCash')){
      diffEl.textContent='—';
      diffEl.className='';
      statusEl.textContent='Aguardando contagem da gaveta';
      return;
    }

    const diff=num('countedCash')-expected;
    diffEl.textContent=brl.format(diff);
    if(typeof window.setTone==='function')window.setTone(diffEl,diff);

    if(Math.abs(diff)<0.005){
      cashItem.classList.add('is-ok');
      statusEl.textContent='✓ Dinheiro conferido';
    }else if(diff<0){
      cashItem.classList.add('is-short');
      statusEl.textContent='Falta '+brl.format(Math.abs(diff));
    }else{
      cashItem.classList.add('is-over');
      statusEl.textContent='Sobra '+brl.format(diff);
    }
  }

  // O cálculo principal continua cuidando de vendas, despesas e pagamentos.
  // Depois dele, corrigimos apenas a conferência física para a nova regra.
  const originalCalc=window.calc;
  if(typeof originalCalc==='function'){
    window.calc=function(){
      const result=originalCalc.apply(this,arguments);
      update();
      return result;
    };
  }

  function setup(){
    const grid=document.querySelector('.cash-conference-grid');
    if(!grid)return;

    const title=document.querySelector('.cash-conference-title');
    if(title)title.textContent='Conferência do dinheiro em espécie';

    setLabel('countedCash','Dinheiro contado na gaveta');
    setLabel('paymentTotal','Pagamentos informados');
    setLabel('paymentDiff','Diferença pagamentos × vendas');
    setLabel('cashDiff','Diferença do dinheiro em espécie');
    setLabel('dayBalance','Resultado do dia');

    addHelp('countedCash','Digite somente as notas e moedas encontradas fisicamente na gaveta ao final do dia.');
    addHelp('paymentTotal','Soma das formas de pagamento informadas: dinheiro, cartões e Pix/apps.');
    addHelp('paymentDiff','R$ 0,00 significa que as formas de pagamento batem com o total de vendas.');
    const cashItem=addHelp('cashDiff','Compara o dinheiro contado com V. Dinheiro (Caixa) − dinheiro retirado para despesas. O Saldo Inicial não entra nesta conferência.');
    addHelp('dayBalance','Resultado do dia = total de vendas − despesas registradas.');

    if(cashItem&&!document.getElementById('cashExpectedHelp')){
      const expected=document.createElement('small');
      expected.id='cashExpectedHelp';
      expected.className='cash-conference-help cash-conference-formula';
      cashItem.appendChild(expected);
    }
    if(cashItem&&!document.getElementById('cashConferenceStatus')){
      const status=document.createElement('span');
      status.id='cashConferenceStatus';
      status.className='cash-conference-status';
      status.textContent='Aguardando contagem da gaveta';
      cashItem.appendChild(status);
    }

    update();
  }

  function boot(){
    setup();
    ['cash','cashOut','countedCash'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        el.addEventListener('input',()=>setTimeout(update,0));
        el.addEventListener('change',()=>setTimeout(update,0));
      }
    });

    document.addEventListener('input',e=>{
      const id=e.target?.id||'';
      if(['cash__brl','cashOut__brl','countedCash__brl'].includes(id))setTimeout(update,0);
    });

    const diff=document.getElementById('cashDiff');
    if(diff)new MutationObserver(()=>setTimeout(update,0)).observe(diff,{childList:true,characterData:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
