/* X-Burguer Caixa — Dashboard financeiro coerente com o Resumo Financeiro */
(function(){
  'use strict';

  const rules=window.XBBusinessRules;
  const byId=id=>document.getElementById(id);
  const round=n=>rules?.roundMoney?rules.roundMoney(n):Math.round((Number(n||0)+Number.EPSILON)*100)/100;
  const money=n=>typeof br==='function'?br(n):Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const financialSales=record=>{
    if(rules?.financialSummaryTotal)return round(rules.financialSummaryTotal(record||{}));
    if(Number.isFinite(Number(record?.summaryTotal)))return round(record.summaryTotal);
    if(Number.isFinite(Number(record?.paymentTotal)))return round(record.paymentTotal);
    return round(Number(record?.cash||0)+Number(record?.deliveryCash||0)+Number(record?.cardOut||0)+Number(record?.onlinePayment||0)+Number(record?.deliveryCard||0));
  };

  function drawFinancialChart(targetId,records){
    const month=records.map(r=>typeof normalize==='function'?normalize(r):r);
    const ym=month[0]?.date?.slice(0,7)||(byId('monthPicker')?.value||((typeof monthNow==='function')?monthNow():''));
    const [year,monthNumber]=String(ym||'').split('-').map(Number);
    const daysInMonth=(year&&monthNumber)?new Date(year,monthNumber,0).getDate():31;
    const max=Math.max(...month.flatMap(r=>[financialSales(r),Number(r?.expense||0)]),1);
    const steps=[max,max*.75,max*.5,max*.25,0];
    let bars='';
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${ym}-${String(d).padStart(2,'0')}`;
      const r=month.find(x=>x.date===ds);
      const s=r?financialSales(r):0;
      const e=Number(r?.expense||0);
      bars+=`<div class="day-col" title="Dia ${d}: vendas ${money(s)} | despesas ${money(e)}"><div class="bar-pair"><div class="bar-sales" style="height:${Math.round(s/max*100)}%"></div><div class="bar-exp" style="height:${Math.round(e/max*100)}%"></div></div><div class="day-label">${d}</div></div>`;
    }
    const target=byId(targetId);
    if(target)target.innerHTML=`<div class="chart-wrap"><div class="chart-y">${steps.map(x=>`<span>${x>=1000?(x/1000).toFixed(1)+'k':Math.round(x)}</span>`).join('')}</div><div class="chart-area"><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div><div class="bars">${bars}</div></div></div>`;
  }

  function updateDashboardFinancial(){
    try{
      const ym=(typeof monthNow==='function')?monthNow():'';
      const month=(typeof monthRecords==='function'?monthRecords(ym):[]).map(r=>typeof normalize==='function'?normalize(r):r);
      const sum=f=>month.reduce((a,r)=>a+Number(f(r)||0),0);
      const sales=round(sum(r=>financialSales(r)));
      const expenses=round(sum(r=>r.expense));
      const orders=sum(r=>r.orders);
      const result=round(sales-expenses);
      const days=month.filter(r=>financialSales(r)||r.orders||r.expense).length;

      if(byId('dSales')){
        byId('dSales').textContent=money(sales);
        byId('dSales').title='Total de vendas = soma das formas de pagamento dos fechamentos do mês.';
      }
      if(byId('dExp'))byId('dExp').textContent=money(expenses);
      if(byId('dRes')){
        byId('dRes').textContent=money(result);
        if(typeof setTone==='function')setTone(byId('dRes'),result);
      }
      if(byId('dResultHint'))byId('dResultHint').textContent=result>0?'Resultado positivo':result<0?'Resultado negativo':'Sem movimento';
      if(byId('dTicket'))byId('dTicket').textContent=money(orders?sales/orders:0);
      if(byId('dDays'))byId('dDays').textContent=days+' dias com movimento';
      if(byId('dOrders'))byId('dOrders').textContent=orders+' pedidos';
      if(byId('dCash'))byId('dCash').textContent=money(sum(r=>Number(r.cash||0)+Number(r.deliveryCash||0)));
      if(byId('dCard'))byId('dCard').textContent=money(sum(r=>Number(r.cardOut||0)+Number(r.deliveryCard||0)));
      if(byId('dPix'))byId('dPix').textContent=money(sum(r=>r.onlinePayment));
      drawFinancialChart('chart',month);

      const all=(typeof load==='function'?load():[]).map(r=>typeof normalize==='function'?normalize(r):r);
      const last=all.at(-1);
      if(last&&byId('lastClosing')){
        const lastSales=financialSales(last);
        byId('lastClosing').className='';
        byId('lastClosing').innerHTML=`<div class="data-row"><span>Data</span><b>${new Date(last.date+'T12:00:00').toLocaleDateString('pt-BR')}</b><span></span></div><div class="data-row"><span>Responsável</span><b>${typeof escapeHtml==='function'?escapeHtml(last.resp||'—'):(last.resp||'—')}</b><span></span></div><div class="data-row"><span>Vendas</span><b class="money">${money(lastSales)}</b><span>${last.orders||0} pedidos</span></div><div class="data-row"><span>Resultado</span><b class="${(lastSales-Number(last.expense||0))<0?'negative':'positive'}">${money(round(lastSales-Number(last.expense||0)))}</b><span></span></div>`;
      }
    }catch{}
  }

  if(typeof refreshDashboard==='function'){
    const previous=refreshDashboard;
    refreshDashboard=function(){
      const out=previous.apply(this,arguments);
      updateDashboardFinancial();
      queueMicrotask(updateDashboardFinancial);
      return out;
    };
  }

  window.addEventListener('pageshow',()=>setTimeout(updateDashboardFinancial,0));
  window.XBDashboardFinancial=Object.freeze({update:updateDashboardFinancial});
  setTimeout(updateDashboardFinancial,0);
})();
