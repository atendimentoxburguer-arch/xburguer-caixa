/* X-Burguer Caixa — proteção contra incorporação/clickjacking. */
(function(){
  'use strict';
  if(window.top===window.self)return;
  document.documentElement.innerHTML='<head><meta charset="utf-8"><title>X-Burguer Caixa</title></head><body><p>Abertura incorporada bloqueada por segurança.</p></body>';
  throw new Error('X-Burguer Caixa: execução em frame bloqueada.');
})();
