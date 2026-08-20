/* X-Burguer Caixa — formatação monetária BRL v4.14.0 */
(function(){
  const nativeValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  if(!nativeValue?.get||!nativeValue?.set)return;

  const exactMoneyIds=new Set([
    'opening','cash','cardOut','online','deliveryCard','cashOut','countedCash',
    'anotaVal','aiqVal'
  ]);

  const isMoneyId=id=>exactMoneyIds.has(id)||/^v\d+$/.test(id)||/^ev\d+$/.test(id);
  const rawHost=document.createElement('div');
  rawHost.id='currencyRawFields';
  rawHost.hidden=true;
  rawHost.style.display='none';
  document.body.appendChild(rawHost);

  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});

  function parseTyped(value){
    let s=String(value??'').trim();
    if(!s)return '';
    s=s.replace(/R\$/gi,'').replace(/\s+/g,'');
    if(!s)return '';

    // Com vírgula, interpreta no padrão brasileiro: 1.234,56.
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');

    // Valores financeiros deste sistema são sempre iguais ou maiores que zero.
    s=s.replace(/[^0-9.]/g,'');
    const firstDot=s.indexOf('.');
    if(firstDot>=0)s=s.slice(0,firstDot+1)+s.slice(firstDot+1).replace(/\./g,'');
    const n=Number(s);
    return Number.isFinite(n)&&n>=0?String(n):'';
  }

  function formatBRL(raw){
    if(raw===''||raw===null||raw===undefined)return '';
    const n=Number(raw);
    return Number.isFinite(n)?brl.format(n):'';
  }

  function editable(raw){
    if(raw===''||raw===null||raw===undefined)return '';
    const n=Number(raw);
    if(!Number.isFinite(n))return '';
    return String(Math.max(0,n)).replace('.',',');
  }

  function decorate(original){
    if(!(original instanceof HTMLInputElement))return;
    const id=original.id||'';
    if(!isMoneyId(id)||original.dataset.currencyRaw==='1')return;

    const parent=original.parentNode;
    if(!parent)return;

    const proxy=document.createElement('input');
    proxy.type='text';
    proxy.inputMode='decimal';
    proxy.autocomplete='off';
    proxy.enterKeyHint='done';
    proxy.id=id+'__brl';
    proxy.className=(original.className?original.className+' ':'')+'currency-proxy';
    proxy.placeholder='R$';
    proxy.setAttribute('aria-label',original.getAttribute('aria-label')||'Valor em reais');
    proxy.dataset.currencyFor=id;
    proxy.disabled=original.disabled;

    const initial=nativeValue.get.call(original);
    proxy.value=formatBRL(initial);

    parent.replaceChild(proxy,original);
    rawHost.appendChild(original);
    original.dataset.currencyRaw='1';

    // Mantém o ID original como fonte numérica para todo o código já existente.
    Object.defineProperty(original,'value',{
      configurable:true,
      enumerable:true,
      get(){return nativeValue.get.call(original)},
      set(v){
        nativeValue.set.call(original,v==null?'':String(v));
        if(document.activeElement!==proxy)proxy.value=formatBRL(nativeValue.get.call(original));
      }
    });

    proxy.addEventListener('focus',()=>{
      proxy.value=editable(nativeValue.get.call(original));
      requestAnimationFrame(()=>{
        try{proxy.setSelectionRange(proxy.value.length,proxy.value.length)}catch{}
      });
    });

    proxy.addEventListener('input',()=>{
      const raw=parseTyped(proxy.value);
      nativeValue.set.call(original,raw);
      original.dispatchEvent(new Event('input',{bubbles:true}));
    });

    proxy.addEventListener('blur',()=>{
      const raw=parseTyped(proxy.value);
      nativeValue.set.call(original,raw);
      proxy.value=formatBRL(raw);
      original.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function scan(root=document){
    if(root instanceof HTMLInputElement)decorate(root);
    root.querySelectorAll?.('input[id]').forEach(decorate);
  }

  scan(document);

  // Vendas por canal e despesas são criadas dinamicamente.
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      mutation.addedNodes.forEach(node=>{
        if(node.nodeType===1)scan(node);
      });
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.XBurguerCurrency={
    refresh(){
      document.querySelectorAll('.currency-proxy').forEach(proxy=>{
        const original=document.getElementById(proxy.dataset.currencyFor);
        if(original&&document.activeElement!==proxy)proxy.value=formatBRL(nativeValue.get.call(original));
      });
    }
  };
})();
