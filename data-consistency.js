/* X-Burguer Caixa — normalização das regras atuais de dados */
(function(){
  'use strict';

  if(typeof normalize!=='function')return;

  const previousNormalize=normalize;
  normalize=function(record){
    const normalized=previousNormalize(record);
    if(!normalized)return normalized;

    const breads=normalized.breads||(normalized.breads={});
    breads.idealOut=0;
    breads.gourmetOut=0;
    breads.idealFinal=Number(breads.idealStart||0)-Number(breads.idealProd||0);
    breads.gourmetFinal=Number(breads.gourmetStart||0)-Number(breads.gourmetProd||0);

    return normalized;
  };
})();
