/* X-Burguer Caixa — conferência automática visual v4.18.1 */
(function(){
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});

  function parseMoneyValue(value){
    let s=String(value??'').trim();
    if(!s)return 0;
    s=s.replace(/R\$/gi,'').replace(/\s+/g,'');
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    s=s.replace(/[^0-9.-]/g,'');
    const n=Number(s);
    return Number.isFinite(n)?n:0;
  }

  function num(id){
    const raw=document.getElementById(id);
    const rawValue=String(raw?.value??'').trim();
    if(rawValue!==''){
      const direct=Number(rawValue);
      if(Number.isFinite(direct))return direct;
      const parsed=parseMoneyValue(rawValue);
      if(Number.isFinite(parsed))return parsed;
    }
    const proxy=document.getElementById(id+'__brl');
    return parseMoneyValue(proxy?.value||'');
  }

  const hasValue=id=>String(document.getElementById(id)?.value??document.getElementById(id+'__brl')?.value??'').trim()!=='';
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
  const money=value=>typeof br==='function'?br(value):brl.format(value);

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

  function expectedCashNow(){return num('cash')+num('deliveryCash')-num('cashOut');}
  function salesNow(){
    try{return channels.reduce((total,_,i)=>total+num('v'+i),0)}catch{return 0}
  }
  function paymentNow(){return num('cash')+num('deliveryCash')+num('cardOut')+num('online')+num('deliveryCard');}
  function summaryBlockTotalNow(){return num('opening')+paymentNow();}

  /* O Resumo financeiro e Vendas por canal são totais independentes.
     O Total de Vendas Geral visual soma todos os valores positivos do bloco 1:
     saldo inicial + dinheiro de caixa + dinheiro de entregas + cartões + Pix/apps.
     Despesas e retiradas ficam fora. O total de canais continua exclusivo do bloco 2. */
  function summaryMonthToDate(){
    const selectedDate=document.getElementById('date')?.value||((typeof isoToday==='function')?isoToday():'');
    if(!selectedDate)return summaryBlockTotalNow();
    const ym=selectedDate.slice(0,7);
    let previous=0;
    try{
      const prior=monthRecords(ym).map(normalize).filter(r=>String(r.date||'')<selectedDate);
      previous=prior.reduce((total,r)=>total+
        Number(r.opening||0)+
        Number(r.cash||0)+
        Number(r.deliveryCash||0)+
        Number(r.cardOut||0)+
        Number(r.onlinePayment||0)+
        Number(r.deliveryCard||0),0);
    }catch{}
    return previous+summaryBlockTotalNow();
  }

  function updateSeparatedSalesTotals(){
    setText(document.getElementById('daySales'),money(summaryBlockTotalNow()));
    setText(document.getElementById('aSales'),money(summaryMonthToDate()));
  }

  function ensureAutomaticSummary(){
    const title=document.querySelector('.cash-conference-title');
    if(!title)return null;
    let summary=document.getElementById('automaticConferenceSummary');
    if(!summary){
      summary=document.createElement('div');
      summary.id='automaticConferenceSummary';
      summary.className='automatic-conference-summary';
      summary.innerHTML='<div class="automatic-conference-status" id="automaticConferenceStatus">Aguardando lançamentos</div><div class="automatic-conference-detail" id="automaticConferenceDetail"></div>';
      title.insertAdjacentElement('afterend',summary);
    }
    return summary;
  }

  function updateAutomaticSummary(){
    const summary=ensureAutomaticSummary();
    const status=document.getElementById('automaticConferenceStatus');
    const detail=document.getElementById('automaticConferenceDetail');
    if(!summary||!status||!detail)return;

    const sales=salesNow();
    const payments=paymentNow();
    const diff=payments-sales;
    const expected=expectedCashNow();
    summary.classList.remove('is-ok','is-alert','is-empty');

    if(Math.abs(sales)<0.005&&Math.abs(payments)<0.005){
      summary.classList.add('is-empty');
      setText(status,'Aguardando os lançamentos do fechamento');
    }else if(Math.abs(diff)<0.005){
      summary.classList.add('is-ok');
      setText(status,'✓ Vendas e pagamentos conferidos automaticamente');
    }else{
      summary.classList.add('is-alert');
      setText(status,diff>0
        ? 'Atenção: pagamentos estão '+brl.format(Math.abs(diff))+' acima das vendas'
        : 'Atenção: faltam '+brl.format(Math.abs(diff))+' nas formas de pagamento');
    }

    setText(detail,'Vendas por canal: '+brl.format(sales)+' • Formas de pagamento: '+brl.format(payments)+' • Dinheiro previsto após retiradas: '+brl.format(expected));
  }

  function updatePhysicalCheck(){
    const cashItem=getItem('cashDiff');
    const diffEl=document.getElementById('cashDiff');
    const expectedEl=document.getElementById('cashExpectedHelp');
    const statusEl=document.getElementById('cashConferenceStatus');
    if(!cashItem||!diffEl||!expectedEl||!statusEl)return;

    const expected=expectedCashNow();
    setText(expectedEl,'Previsto pelas informações acima: '+brl.format(expected)+' • Dinheiro caixa + dinheiro entregas − retiradas');
    cashItem.classList.remove('is-ok','is-short','is-over');

    if(!hasValue('countedCash')){
      setText(diffEl,'—');
      diffEl.classList.remove('positive','negative');
      setText(statusEl,'Contagem física não informada • opcional');
      return;
    }

    const diff=num('countedCash')-expected;
    setText(diffEl,brl.format(diff));
    if(typeof window.setTone==='function')window.setTone(diffEl,diff);

    if(Math.abs(diff)<0.005){
      cashItem.classList.add('is-ok');
      setText(statusEl,'✓ Dinheiro físico conferido');
    }else if(diff<0){
      cashItem.classList.add('is-short');
      setText(statusEl,'Falta '+brl.format(Math.abs(diff))+' na gaveta');
    }else{
      cashItem.classList.add('is-over');
      setText(statusEl,'Sobra '+brl.format(diff)+' na gaveta');
    }
  }

  function update(){
    updateSeparatedSalesTotals();
    updateAutomaticSummary();
    updatePhysicalCheck();
  }

  function setup(){
    const grid=document.querySelector('.cash-conference-grid');
    if(!grid)return;

    const title=document.querySelector('.cash-conference-title');
    if(title)setText(title,'Conferência automática do fechamento');

    setLabel('countedCash','Contagem física da gaveta — opcional');
    setLabel('paymentTotal','Pagamentos informados — automático');
    setLabel('paymentDiff','Diferença formas de pagamento × vendas por canal — automático');
    setLabel('cashDiff','Diferença física — somente se contar a gaveta');
    setLabel('dayBalance','Resultado do dia — automático');

    addHelp('countedCash','Preencha apenas se quiser comparar o dinheiro real da gaveta com o valor previsto pelo sistema.');
    addHelp('paymentTotal','Calculado automaticamente somando dinheiro do caixa, dinheiro das entregas, cartões e Pix/apps. O saldo inicial não entra nessa conferência.');
    addHelp('paymentDiff','R$ 0,00 significa que as formas de pagamento batem com o total de Vendas por canal.');
    const cashItem=addHelp('cashDiff','Essa verificação é opcional. Sem contagem física, o fechamento financeiro continua funcionando normalmente.');
    addHelp('dayBalance','Calculado automaticamente: total de vendas por canal − despesas registradas no dia.');

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
      status.textContent='Contagem física não informada • opcional';
      cashItem.appendChild(status);
    }

    ensureAutomaticSummary();
    update();
  }

  function boot(){
    setup();

    if(typeof window.calc==='function'&&!window.calc.__xbSummaryTotalFixed){
      const previousCalc=window.calc;
      const wrappedCalc=function(){
        const result=previousCalc.apply(this,arguments);
        queueMicrotask(updateSeparatedSalesTotals);
        return result;
      };
      wrappedCalc.__xbSummaryTotalFixed=true;
      window.calc=wrappedCalc;
    }

    document.addEventListener('input',()=>setTimeout(update,0));
    document.addEventListener('change',()=>setTimeout(update,0));
    ['paymentTotal','paymentDiff','daySales','dayBalance','ctVal','aSales','ctMonthVal'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)new MutationObserver(()=>setTimeout(update,0)).observe(el,{childList:true,characterData:true,subtree:true});
    });
    window.addEventListener('pageshow',()=>setTimeout(update,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
