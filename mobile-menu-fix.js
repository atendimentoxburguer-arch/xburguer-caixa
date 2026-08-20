/* X-Burguer Caixa — controlador definitivo do menu móvel v4.12.2 */
(function(){
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('overlay');
  const menuToggle=document.getElementById('menuToggle');
  const nav=document.getElementById('nav') || document.querySelector('.nav');
  if(!sidebar||!overlay||!menuToggle||!nav)return;

  const isMobile=()=>window.matchMedia('(max-width: 900px)').matches;
  let opened=false;

  function applyClosed(){
    opened=false;
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('mobile-menu-open');
    menuToggle.setAttribute('aria-expanded','false');
    if(isMobile()){
      sidebar.style.setProperty('transform','translate3d(-110%,0,0)','important');
      sidebar.style.setProperty('visibility','hidden','important');
      sidebar.style.setProperty('pointer-events','none','important');
      overlay.style.setProperty('opacity','0','important');
      overlay.style.setProperty('visibility','hidden','important');
      overlay.style.setProperty('pointer-events','none','important');
    }else{
      sidebar.style.removeProperty('transform');
      sidebar.style.removeProperty('visibility');
      sidebar.style.removeProperty('pointer-events');
      overlay.style.removeProperty('opacity');
      overlay.style.removeProperty('visibility');
      overlay.style.removeProperty('pointer-events');
    }
  }

  function applyOpen(){
    if(!isMobile())return;
    opened=true;
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('mobile-menu-open');
    menuToggle.setAttribute('aria-expanded','true');
    sidebar.style.setProperty('transform','translate3d(0,0,0)','important');
    sidebar.style.setProperty('visibility','visible','important');
    sidebar.style.setProperty('pointer-events','auto','important');
    overlay.style.setProperty('opacity','1','important');
    overlay.style.setProperty('visibility','visible','important');
    overlay.style.setProperty('pointer-events','auto','important');
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

  // Captura antes do manipulador antigo do sistema e assume o controle no celular/tablet.
  menuToggle.addEventListener('click',toggleMenu,true);

  // Tocar fora fecha imediatamente.
  ['pointerdown','touchstart','click'].forEach(type=>{
    overlay.addEventListener(type,e=>{
      if(!isMobile())return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      applyClosed();
    },{capture:true,passive:false});
  });

  // Ao escolher qualquer seção, deixa o clique original navegar e recolhe logo depois.
  nav.querySelectorAll('button[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!isMobile())return;
      requestAnimationFrame(applyClosed);
    },true);
  });

  // Botão X independente e sempre clicável.
  let closeBtn=sidebar.querySelector('.mobile-menu-close');
  if(!closeBtn){
    closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.className='mobile-menu-close';
    closeBtn.setAttribute('aria-label','Fechar menu');
    closeBtn.innerHTML='&times;';
    sidebar.appendChild(closeBtn);
  }

  ['pointerdown','touchstart','click'].forEach(type=>{
    closeBtn.addEventListener(type,e=>{
      if(!isMobile())return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      applyClosed();
    },{capture:true,passive:false});
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&opened)applyClosed();
  });

  window.addEventListener('orientationchange',()=>setTimeout(applyClosed,80));
  window.addEventListener('resize',()=>{
    if(!isMobile())applyClosed();
  });
  window.addEventListener('pageshow',()=>{
    if(isMobile())applyClosed();
  });

  // Estado inicial no iPhone/tablet é sempre fechado.
  if(isMobile())applyClosed();
})();
