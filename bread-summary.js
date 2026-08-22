/* X-Burguer Caixa — resultados automáticos do controle de pães */
(function(){
  const byId=id=>document.getElementById(id);
  const qty=id=>Number(byId(id)?.value||0);

  function ensureResult(row,id,label){
    if(!row||byId(id))return;
    const box=document.createElement('div');
    box.className='bread-result';
    box.innerHTML=`<span>${label}</span><b id="${id}">0</b>`;
    row.appendChild(box);
  }

  function ensureBreadUi(){
    const idealStart=byId('idealStart');
    const gourmetStart=byId('gourmetStart');
    if(!idealStart||!gourmetStart)return false;

    const panel=idealStart.closest('.panel');
    const head=panel?.querySelector('.bread-row.head');
    if(head){
      head.innerHTML='<span>Tipo de pão</span><span>Est. inicial</span><span>Produção</span><span>Est. final</span><span>Acum. mês</span>';
    }

    const idealRow=idealStart.closest('.bread-row');
    const gourmetRow=gourmetStart.closest('.bread-row');
    ensureResult(idealRow,'idealFinal','Est. final');
    ensureResult(idealRow,'idealMonth','Acum. mês');
    ensureResult(gourmetRow,'gourmetFinal','Est. final');
    ensureResult(gourmetRow,'gourmetMonth','Acum. mês');

    const note=panel?.querySelector('.bread-note');
    if(note)note.textContent='Estoque final = estoque inicial + produção. O acumulado mensal soma as produções registradas no mês.';
    return true;
  }

  function updateBreadSummary(){
    if(!ensureBreadUi())return;
    const selectedDate=byId('date')?.value||isoToday();
    const ym=selectedDate.slice(0,7);
    const prior=monthRecords(ym).map(normalize).filter(r=>String(r.date||'')<selectedDate);
    const idealProducedBefore=prior.reduce((sum,r)=>sum+Number(r.breads?.idealProd||0),0);
    const gourmetProducedBefore=prior.reduce((sum,r)=>sum+Number(r.breads?.gourmetProd||0),0);

    const idealFinal=qty('idealStart')+qty('idealProd');
    const gourmetFinal=qty('gourmetStart')+qty('gourmetProd');
    byId('idealFinal').textContent=idealFinal;
    byId('gourmetFinal').textContent=gourmetFinal;
    byId('idealMonth').textContent=idealProducedBefore+qty('idealProd');
    byId('gourmetMonth').textContent=gourmetProducedBefore+qty('gourmetProd');
  }

  if(typeof calc==='function'){
    const originalCalc=calc;
    calc=function(){
      const result=originalCalc.apply(this,arguments);
      updateBreadSummary();
      return result;
    };
  }

  if(typeof refreshDailyReport==='function'){
    const originalDaily=refreshDailyReport;
    refreshDailyReport=function(){
      const result=originalDaily.apply(this,arguments);
      const tbody=byId('dailyBreadTable');
      const date=byId('dailyReportDate')?.value||isoToday();
      const record=load().map(normalize).find(r=>r.date===date);
      if(tbody){
        const head=tbody.closest('table')?.querySelector('thead tr');
        if(head)head.innerHTML='<th>Tipo</th><th>Est. inicial</th><th>Produção</th><th>Est. final</th>';
        if(record){
          const b=record.breads||{};
          const idealFinal=Number.isFinite(Number(b.idealFinal))?Number(b.idealFinal):Number(b.idealStart||0)+Number(b.idealProd||0);
          const gourmetFinal=Number.isFinite(Number(b.gourmetFinal))?Number(b.gourmetFinal):Number(b.gourmetStart||0)+Number(b.gourmetProd||0);
          tbody.innerHTML=`<tr><td>Pão Ideal</td><td>${Number(b.idealStart||0)}</td><td>${Number(b.idealProd||0)}</td><td>${idealFinal}</td></tr><tr><td>Pão Gourmet</td><td>${Number(b.gourmetStart||0)}</td><td>${Number(b.gourmetProd||0)}</td><td>${gourmetFinal}</td></tr>`;
        }
      }
      return result;
    };
  }

  if(typeof refreshMonthly==='function'){
    const originalMonthly=refreshMonthly;
    refreshMonthly=function(){
      const result=originalMonthly.apply(this,arguments);
      const tbody=byId('monthlyBreadTable');
      const ym=byId('monthPicker')?.value||monthNow();
      const month=monthRecords(ym).map(normalize).sort((a,b)=>a.date.localeCompare(b.date));
      if(tbody){
        const head=tbody.closest('table')?.querySelector('thead tr');
        if(head)head.innerHTML='<th>Tipo</th><th>Produção acumulada</th><th>Último est. final</th>';
        const sum=fn=>month.reduce((total,r)=>total+Number(fn(r)||0),0);
        const last=month.at(-1);
        const idealFinal=last?Number(last.breads?.idealFinal??(Number(last.breads?.idealStart||0)+Number(last.breads?.idealProd||0))):0;
        const gourmetFinal=last?Number(last.breads?.gourmetFinal??(Number(last.breads?.gourmetStart||0)+Number(last.breads?.gourmetProd||0))):0;
        tbody.innerHTML=`<tr><td>Pão Ideal</td><td>${sum(r=>r.breads?.idealProd)}</td><td>${idealFinal}</td></tr><tr><td>Pão Gourmet</td><td>${sum(r=>r.breads?.gourmetProd)}</td><td>${gourmetFinal}</td></tr>`;
      }
      return result;
    };
  }

  ['idealStart','idealProd','gourmetStart','gourmetProd'].forEach(id=>{
    byId(id)?.addEventListener('input',updateBreadSummary);
  });

  ensureBreadUi();
  updateBreadSummary();
})();
