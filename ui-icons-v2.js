(function(){
  'use strict';

  const ICONS={
    dashboard:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4z"/><path d="M14 4h6v4h-6z"/><path d="M14 12h6v8h-6z"/><path d="M4 14h6v6H4z"/></svg>',
    fechamento:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6"/><path d="m9 13 1.6 1.6L15 10.2"/></svg>',
    historico:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.2 1.8"/></svg>',
    mensal:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M22 20H2"/><path d="m4 8 5-3 5 4 6-5"/></svg>',
    boletos:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6"/><path d="M10 16h4"/><path d="m15.5 18.5 1.2 1.2 2.3-2.7"/></svg>',
    backup:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 18H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 8.2 4.5 4.5 0 0 1 18.5 17H17"/><path d="M12 11v9"/><path d="m8.8 16.8 3.2 3.2 3.2-3.2"/></svg>'
  };

  const EYE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.4-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.4 5.5-9.2 5.5S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  const EYE_OFF='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16"/><path d="M10.6 6.7A9 9 0 0 1 12 6.5c5.8 0 9.2 5.5 9.2 5.5a13.3 13.3 0 0 1-2.3 2.9"/><path d="M6.2 8.1A14.1 14.1 0 0 0 2.8 12s3.4 5.5 9.2 5.5a9.4 9.4 0 0 0 3.2-.6"/><path d="M10.3 10.3a2.5 2.5 0 0 0 3.4 3.4"/></svg>';

  function polishNav(root=document){
    root.querySelectorAll('.nav button[data-page]').forEach(button=>{
      const page=button.dataset.page;
      const icon=button.querySelector('.ico');
      if(!icon||!ICONS[page]||icon.dataset.refinedIcon==='1')return;
      icon.innerHTML=ICONS[page];
      icon.dataset.refinedIcon='1';
    });
  }

  function syncEye(){
    const input=document.getElementById('loginPass');
    const button=document.getElementById('togglePass');
    if(!input||!button)return;
    const visible=input.type==='text';
    button.innerHTML=visible?EYE_OFF:EYE;
    button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
  }

  function polishLogin(){
    const card=document.getElementById('loginForm');
    if(!card)return;

    if(!card.querySelector('.login-card-brand-mini')){
      const brand=document.createElement('div');
      brand.className='login-card-brand-mini';
      brand.innerHTML='<img src="icons/xburguer-caixa-rounded-192-v3.png" alt="Logo X-Burguer" width="48" height="48" decoding="async"><div><strong>X-Burguer</strong><span>Controle de Caixa</span></div>';
      card.insertBefore(brand,card.firstChild);
    }

    const toggle=document.getElementById('togglePass');
    if(toggle&&!toggle.dataset.refinedEye){
      toggle.dataset.refinedEye='1';
      toggle.addEventListener('click',()=>setTimeout(syncEye,0));
    }
    syncEye();
  }

  function init(){
    polishNav();
    polishLogin();

    const nav=document.getElementById('nav');
    if(nav){
      const observer=new MutationObserver(()=>polishNav(nav));
      observer.observe(nav,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
