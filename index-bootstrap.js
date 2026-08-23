/* X-Burguer Caixa — bootstrap inicial compatível com CSP */
(async function(){
  'use strict';
  try{
    await Promise.race([
      Promise.resolve(window.XBRegisterPWA?.()),
      new Promise(resolve=>setTimeout(resolve,2500))
    ]);
  }catch(error){
    console.warn('PWA Caixa:',error);
  }
  location.replace('/xburguer-caixa/caixa.html?app=caixa');
})();
