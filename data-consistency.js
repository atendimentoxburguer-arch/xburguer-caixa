/* X-Burguer Caixa — normalização canônica das regras atuais de dados */
(function(){
  'use strict';

  if(typeof normalize!=='function')return;

  const previousNormalize=normalize;

  function normalizeBread(breads,prefix){
    const start=Number(breads[prefix+'Start']||0);
    const storedFinal=breads[prefix+'Final'];
    const hasStoredFinal=storedFinal!==undefined&&storedFinal!==null&&storedFinal!=='';
    const legacyProduction=Number(breads[prefix+'Prod']||0);
    const final=hasStoredFinal?Number(storedFinal||0):start-legacyProduction;

    breads[prefix+'Start']=start;
    breads[prefix+'Final']=final;
    breads[prefix+'Prod']=start-final;
    breads[prefix+'Out']=0;
  }

  normalize=function(record){
    const normalized=previousNormalize(record);
    if(!normalized)return normalized;

    normalized.deliveryCash=Number(normalized.deliveryCash||0);
    const breads=normalized.breads||(normalized.breads={});
    normalizeBread(breads,'ideal');
    normalizeBread(breads,'gourmet');

    return normalized;
  };
})();
