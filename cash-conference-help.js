/* X-Burguer Caixa — ajuda visual da conferência v4.18.0 */
(function(){
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
  const num=id=>Number(document.getElementById(id)?.value||0);
  const hasValue=id=>String(document.getElementById(id)?.value??'').trim()!=='';
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};

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
    if(label)setText(label,text);
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
    setText(help,text);
    return item;
  }

  function expectedCashNow(){return num('cash')-num('cashOut');}

  function update(){
    const cashItem=getItem('cashDiff');
    const diffEl=document.getElementById('cashDiff');
    const expectedEl=document.getElementById('cashExpectedHelp');
    const statusEl=document.getElementById('cashConferenceStatus');
    if(!cashItem||!diffEl||!expectedEl||!statusEl)return;

    const expected=expectedCashNow();
    setText(expectedEl,'Esperado na gaveta: '+brl.format(expected)+' • V. Dinheiro − retiradas');
    cashItem.classList.remove('is-ok','is-short','is-over');

    if(!hasValue('countedCash')){
      setText(diffEl,'—');
      diffEl.classList.remove('positive','negative');
      setText(statusEl,'Aguardando contagem da gaveta');
      return;
    }

    const diff=num('countedCash')-expected;
    setText(diffEl,brl.format(diff));
    if(typeof window.setTone==='function')window.setTone(diffEl,diff);

    if(Math.abs(diff)<0.005){
      cashItem.classList.add('is-ok');
      setText(statusEl,'✓ Dinheiro conferido');
    }else if(diff<0){
      cashItem.classList.add('is-short');
      setText(statusEl,'Falta '+brl.format(Math.abs(diff)));
    }else{
      cashItem.classList.add('is-over');
      setText(statusEl,'Sobra '+brl.format(diff));
    }
  }

  function setup(){
    const grid=document.querySelector('.cash-conference-grid');
    if(!grid)return;

    const title=document.querySelector('.cash-conference-title');
    if(title)setText(title,'Conferência do dinheiro em espécie');

    setLabel('countedCash','Dinheiro contado na gaveta');
    setLabel('paymentTotal','Pagamentos informados');
    setLabel('paymentDiff','Diferença pagamentos × vendas');
    setLabel('cashDiff','Diferença do dinheiro físico');
    setLabel('dayBalance','Resultado do dia');

    addHelp('countedCash','Informe somente as notas e moedas realmente encontradas na gaveta.');
    addHelp('paymentTotal','Soma de dinheiro, cartões e Pix/apps informados no resumo financeiro.');
    addHelp('paymentDiff','R$ 0,00 significa que as formas de pagamento batem com o total de vendas.');
    const cashItem=addHelp('cashDiff','Compara o dinheiro contado com V. Dinheiro (Caixa) menos as retiradas para despesas. O Saldo Inicial não entra nesta conferência.');
    addHelp('dayBalance','Resultado = total de vendas − despesas registradas no dia.');

    if(cashItem&&!document.getElementById('cashExpectedHelp')){
      const expected=document.createElement('small');
      expected.id='cashExpectedHelp';
      expected.className='cash-conference-help cash-expected-help';
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
      if(el){el.addEventListener('input',()=>setTimeout(update,0));el.addEventListener('change',()=>setTimeout(update,0));}
    });
    document.addEventListener('input',e=>{
      const id=e.target?.id||'';
      if(['cash__brl','cashOut__brl','countedCash__brl'].includes(id))setTimeout(update,0);
    });
    const diff=document.getElementById('cashDiff');
    if(diff)new MutationObserver(()=>setTimeout(update,0)).observe(diff,{childList:true,characterData:true,subtree:true});
    window.addEventListener('pageshow',()=>setTimeout(update,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
