/* X-Burguer Caixa — correção robusta do menu móvel v4.12.1 */
(function(){
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('overlay');
  const menuToggle=document.getElementById('menuToggle');
  const nav=document.getElementById('nav');
  if(!sidebar||!overlay||!menuToggle||!nav)return;

  const isMobile=()=>window.matchMedia('(max-width: 900px)').matches;

  function lockBody(){
    if(isMobile()&&sidebar.classList.contains('open')){
      document.body.classList.add('mobile-menu-open');
    }else{
      document.body.classList.remove('mobile-menu-open');
    }
  }

  function closeMobileMenu(){
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('mobile-menu-open');
    menuToggle.setAttribute('aria-expanded','false');
  }

  function afterToggle(){
    window.setTimeout(()=>{
      menuToggle.setAttribute('aria-expanded',sidebar.classList.contains('open')?'true':'false');
      lockBody();
    },0);
  }

  menuToggle.setAttribute('aria-controls','sidebar');
  menuToggle.setAttribute('aria-expanded',sidebar.classList.contains('open')?'true':'false');
  menuToggle.addEventListener('click',afterToggle);

  // Fecha ao tocar fora do painel, com capture para funcionar mesmo se outro handler falhar.
  overlay.addEventListener('click',closeMobileMenu,true);
  overlay.addEventListener('touchend',closeMobileMenu,{passive:true,capture:true});

  // No celular/tablet, selecionar qualquer seção sempre recolhe o menu.
  nav.querySelectorAll('button[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(isMobile())window.setTimeout(closeMobileMenu,0);
    });
  });

  // Botão X próprio do menu móvel.
  let closeBtn=sidebar.querySelector('.mobile-menu-close');
  if(!closeBtn){
    closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.className='mobile-menu-close';
    closeBtn.setAttribute('aria-label','Fechar menu');
    closeBtn.textContent='×';
    const brand=sidebar.querySelector('.brand');
    if(brand)brand.appendChild(closeBtn);
    else sidebar.prepend(closeBtn);
  }
  closeBtn.addEventListener('click',closeMobileMenu);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&sidebar.classList.contains('open'))closeMobileMenu();
  });

  // Evita estado travado ao girar o iPhone/iPad ou mudar de breakpoint.
  window.addEventListener('resize',()=>{
    if(!isMobile())closeMobileMenu();
    else lockBody();
  });
  window.addEventListener('orientationchange',()=>window.setTimeout(closeMobileMenu,120));

  // Se a página voltar do cache do Safari, nunca mantém o drawer preso.
  window.addEventListener('pageshow',e=>{
    if(e.persisted)closeMobileMenu();
  });

  lockBody();
})();
