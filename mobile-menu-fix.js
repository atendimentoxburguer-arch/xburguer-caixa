/* X-Burguer Caixa — controlador do menu móvel v4.12.3 */
(function(){
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('overlay');
  const menuToggle=document.getElementById('menuToggle');
  const nav=document.getElementById('nav') || document.querySelector('.nav');
  const brand=sidebar?.querySelector('.brand');
  if(!sidebar||!overlay||!menuToggle||!nav)return;

  const isMobile=()=>window.matchMedia('(max-width: 900px)').matches;
  const CLOSE_MS=330;
  let opened=false;
  let closeTimer=null;

  function clearCloseTimer(){
    if(closeTimer){clearTimeout(closeTimer);closeTimer=null;}
  }

  function applyClosed(immediate=false){
    clearCloseTimer();
    opened=false;
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('mobile-menu-open');
    menuToggle.setAttribute('aria-expanded','false');

    if(!isMobile()){
      sidebar.style.removeProperty('transform');
      sidebar.style.removeProperty('visibility');
      sidebar.style.removeProperty('pointer-events');
      overlay.style.removeProperty('opacity');
      overlay.style.removeProperty('visibility');
      overlay.style.removeProperty('pointer-events');
      return;
    }

    sidebar.style.setProperty('pointer-events','none','important');
    sidebar.style.setProperty('transform','translate3d(-108%,0,0)','important');
    overlay.style.setProperty('pointer-events','none','important');
    overlay.style.setProperty('opacity','0','important');

    const finish=()=>{
      if(opened)return;
      sidebar.style.setProperty('visibility','hidden','important');
      overlay.style.setProperty('visibility','hidden','important');
    };

    if(immediate)finish();
    else closeTimer=setTimeout(finish,CLOSE_MS);
  }

  function applyOpen(){
    if(!isMobile())return;
    clearCloseTimer();
    opened=true;
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('mobile-menu-open');
    menuToggle.setAttribute('aria-expanded','true');

    sidebar.style.setProperty('visibility','visible','important');
    sidebar.style.setProperty('pointer-events','auto','important');
    overlay.style.setProperty('visibility','visible','important');
    overlay.style.setProperty('pointer-events','auto','important');

    requestAnimationFrame(()=>{
      sidebar.style.setProperty('transform','translate3d(0,0,0)','important');
      overlay.style.setProperty('opacity','1','important');
    });
  }

  function toggleMenu(e){
    if(!isMobile())return;
    if(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
    opened ? applyClosed() : applyOpen();
  }

  menuToggle.setAttribute('aria-controls','sidebar');
  menuToggle.setAttribute('aria-expanded','false');
  menuToggle.addEventListener('click',toggleMenu,true);

  // Fecha ao tocar fora somente após o clique ser concluído.
  // Isso evita o sumiço brusco no touchstart/pointerdown do iPhone.
  overlay.addEventListener('click',e=>{
    if(!isMobile()||!opened)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyClosed(false);
  },true);

  // Ao escolher uma seção, dá um pequeno retorno visual antes de recolher.
  nav.querySelectorAll('button[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!isMobile())return;
      setTimeout(()=>applyClosed(false),70);
    },true);
  });

  // Botão X dentro do cabeçalho do menu para ficar sempre alinhado.
  let closeBtn=sidebar.querySelector('.mobile-menu-close');
  if(!closeBtn){
    closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.className='mobile-menu-close';
    closeBtn.setAttribute('aria-label','Fechar menu');
    closeBtn.innerHTML='<span aria-hidden="true">×</span>';
  }
  if(brand && closeBtn.parentElement!==brand)brand.appendChild(closeBtn);

  closeBtn.addEventListener('click',e=>{
    if(!isMobile())return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyClosed(false);
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&opened)applyClosed(false);
  });

  window.addEventListener('orientationchange',()=>setTimeout(()=>applyClosed(true),100));
  window.addEventListener('resize',()=>{
    if(!isMobile())applyClosed(true);
  });
  window.addEventListener('pageshow',()=>{
    if(isMobile())applyClosed(true);
  });

  if(isMobile())applyClosed(true);
})();
