/* X-Burguer Caixa — ajuda visual da conferência v4.17.2 */
(function(){
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
  const num=id=>Number(document.getElementById(id)?.value||0);
  const hasValue=id=>String(document.getElementById(id)?.value??'').trim()!=='';

  function visibleElement(id){
    const raw=document.getElementById(id);
    if(raw?.closest('.cash-conference-item'))return raw;
    return document.getElementById(id+'__brl')||raw;
  }

  function addHelp(id,text,extraClass=''){
    const el=visibleElement(id);
    const item=el?.closest('.cash-conference-item');
    if(!item||item.querySelector('.cash-conference-help'))return item;
    const help=document.createElement('small');
    help.className='cash-conference-help'+(extraClass?' '+extraClass:'');
    help.textContent=text;
    item.appendChild(help);
    return item;
  }

  function setup(){
    if(!document.querySelector('.cash-conference-grid'))return;

    addHelp('countedCash','Informe somente o dinheiro físico encontrado na gaveta.');
    addHelp('paymentTotal','Soma do dinheiro, cartões e Pix/apps informados acima.');
    addHelp('paymentDiff','R$ 0,00 significa que as formas de pagamento batem com o total de vendas.');
    const cashItem=addHelp('cashDiff','Compara o dinheiro contado com o valor que deveria estar na gaveta.');
    addHelp('dayBalance','Resultado = total de vendas − despesas registradas no dia.');

    if(cashItem&&!document.getElementById('cashExpectedHelp')){
      const expected=document.createElement('small');
      expected.id='cashExpectedHelp';
      expected.className='cash-conference-help';
      cashItem.appendChild(expected);
    }
    if(cashItem&&!document.getElementById('cashConferenceStatus')){
      const status=document.createElement('span');
      status.id='cashConferenceStatus';
      status.className='cash-conference-status';
      status.textContent='Aguardando contagem';
      cashItem.appendChild(status);
    }

    update();
  }

  function update(){
    const cashItem=document.getElementById('cashDiff')?.closest('.cash-conference-item');
    const expectedEl=document.getElementById('cashExpectedHelp');
    const statusEl=document.getElementById('cashConferenceStatus');
    if(!cashItem||!expectedEl||!statusEl)return;

    const expected=num('opening')+num('cash')-num('cashOut');
    expectedEl.textContent='Esperado na gaveta: '+brl.format(expected);

    cashItem.classList.remove('is-ok','is-short','is-over');
    if(!hasValue('countedCash')){
      statusEl.textContent='Aguardando contagem';
      return;
    }

    const diff=num('countedCash')-expected;
    if(Math.abs(diff)<0.005){
      cashItem.classList.add('is-ok');
      statusEl.textContent='✓ Caixa conferido';
    }else if(diff<0){
      cashItem.classList.add('is-short');
      statusEl.textContent='Falta '+brl.format(Math.abs(diff));
    }else{
      cashItem.classList.add('is-over');
      statusEl.textContent='Sobra '+brl.format(diff);
    }
  }

  function boot(){
    setup();
    ['opening','cash','cashOut','countedCash'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener('input',()=>setTimeout(update,0));el.addEventListener('change',()=>setTimeout(update,0));}
    });
    document.addEventListener('input',e=>{
      const id=e.target?.id||'';
      if(['opening__brl','cash__brl','cashOut__brl','countedCash__brl'].includes(id))setTimeout(update,0);
    });
    const diff=document.getElementById('cashDiff');
    if(diff)new MutationObserver(update).observe(diff,{childList:true,characterData:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
