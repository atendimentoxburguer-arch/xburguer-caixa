/* X-Burguer Caixa — estabilidade funcional v4.14.1 */
const XB_APP_VERSION='4.14.1';
window.XB_APP_VERSION=XB_APP_VERSION;
let xbAuthRefreshPromise=null;

/* Impede duas renovações do mesmo refresh token ao mesmo tempo. */
refreshAuthSession=async function(remember=true){
  if(xbAuthRefreshPromise)return xbAuthRefreshPromise;
  xbAuthRefreshPromise=(async()=>{
    if(!authSession?.refresh_token)throw new Error('Sessão expirada. Entre novamente.');
    try{
      const data=await authFetch('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token});
      authSession=normalizeSession(data);
      currentUser=authSession.user;
      persistSession(authSession,remember);
      try{
        if(typeof realtimeClient!=='undefined'&&realtimeClient?.realtime&&authSession.access_token){
          realtimeClient.realtime.setAuth(authSession.access_token);
        }
      }catch{}
      return authSession;
    }catch(err){
      try{clearStoredSessions()}catch{}
      authSession=null;currentUser=null;currentProfile=null;
      throw new Error('Sua sessão expirou. Entre novamente para continuar.');
    }finally{
      xbAuthRefreshPromise=null;
    }
  })();
  return xbAuthRefreshPromise;
};

/* Bloqueia também os campos visuais formatados em Real durante gravações. */
setClosingFormBusy=function(busy){
  document.querySelectorAll('#fechamento input,#fechamento textarea,#fechamento button,#currencyRawFields input').forEach(el=>{
    el.disabled=!!busy;
  });
};

/* Gráfico usa a quantidade real de dias do mês. */
drawChart=function(targetId,records){
  const month=records.map(normalize);
  const ym=month[0]?.date?.slice(0,7)||($('monthPicker')?.value||monthNow());
  const [year,monthNumber]=ym.split('-').map(Number);
  const daysInMonth=(year&&monthNumber)?new Date(year,monthNumber,0).getDate():31;
  const max=Math.max(...month.flatMap(r=>[Number(r.sales||0),Number(r.expense||0)]),1);
  const steps=[max,max*.75,max*.5,max*.25,0];
  let bars='';
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${ym}-${String(d).padStart(2,'0')}`;
    const r=month.find(x=>x.date===ds),s=Number(r?.sales||0),e=Number(r?.expense||0);
    bars+=`<div class="day-col" title="Dia ${d}: vendas ${br(s)} | despesas ${br(e)}"><div class="bar-pair"><div class="bar-sales" style="height:${Math.round(s/max*100)}%"></div><div class="bar-exp" style="height:${Math.round(e/max*100)}%"></div></div><div class="day-label">${d}</div></div>`;
  }
  const target=$(targetId);
  if(!target)return;
  target.innerHTML=`<div class="chart-wrap"><div class="chart-y">${steps.map(x=>`<span>${x>=1000?(x/1000).toFixed(1)+'k':Math.round(x)}</span>`).join('')}</div><div class="chart-area"><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div><div class="bars">${bars}</div></div></div>`;
};

/* Backup sempre identifica a versão real que o gerou. */
exportJSON=function(){
  const data={version:XB_APP_VERSION,exportedAt:new Date().toISOString(),records:load()};
  download(`xburguer-backup-${isoToday()}.json`,JSON.stringify(data,null,2),'application/json');
  const now=new Date().toLocaleString('pt-BR');
  localStorage.setItem(BACKUP_KEY,now);
  refreshBackup();
  toast('Backup JSON exportado.');
};

/* Valida o arquivo inteiro antes de iniciar uma restauração. */
validateBackupRecords=function(records){
  if(!Array.isArray(records))return'O arquivo não contém uma lista de fechamentos.';
  if(records.length>10000)return'O backup possui registros demais para uma única importação.';
  const dates=new Set();
  for(let i=0;i<records.length;i++){
    const r=records[i];
    if(!r||typeof r!=='object'||Array.isArray(r))return`Registro ${i+1} do backup é inválido.`;
    const date=String(r.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return`Registro ${i+1} está sem uma data válida.`;
    const parsed=new Date(date+'T12:00:00');
    if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return`Registro ${i+1} possui uma data inexistente.`;
    if(dates.has(date))return`O backup possui mais de um fechamento para ${date}. Remova a duplicidade antes de importar.`;
    dates.add(date);
    const moneyFields=['opening','cash','cardOut','onlinePayment','deliveryCard','cashOut','countedCash','sales','expense'];
    for(const key of moneyFields){
      if(r[key]!==undefined&&r[key]!==null&&r[key]!==''&&(!Number.isFinite(Number(r[key]))||Number(r[key])<0))return`Registro ${i+1} possui valor financeiro inválido em ${key}.`;
    }
  }
  return true;
};

function xbApplyVersionAndHealth(){
  document.documentElement.dataset.appVersion=XB_APP_VERSION;
  document.querySelectorAll('.reconcile').forEach(item=>{
    const label=item.querySelector('span');
    const value=item.querySelector('b');
    if(label&&value&&label.textContent.trim()==='Versão')value.textContent=XB_APP_VERSION;
  });
  const syncBtn=document.getElementById('syncBtn');
  if(syncBtn)syncBtn.hidden=true;
  const backupSync=document.getElementById('syncBackupBtn');
  if(backupSync){
    backupSync.hidden=true;
    const card=backupSync.closest('.backup-card');
    if(card){
      const title=card.querySelector('h3');
      const p=card.querySelector('p');
      if(title)title.textContent='Sincronização automática';
      if(p)p.textContent='Os fechamentos são atualizados automaticamente pela nuvem e em tempo real entre os aparelhos conectados.';
    }
  }
}

const xbOriginalRefreshBackup=refreshBackup;
refreshBackup=function(){
  xbOriginalRefreshBackup();
  xbApplyVersionAndHealth();
};

/* Proteções e teclado adequados para valores e quantidades. */
(function hardenInputs(){
  const moneyIds=['opening','cash','cardOut','online','deliveryCard','cashOut','countedCash','anotaVal','aiqVal'];
  moneyIds.forEach(id=>{
    const el=$(id);if(!el)return;
    el.min='0';el.step='0.01';el.inputMode='decimal';
  });
  const qtyIds=['idealStart','idealProd','idealOut','gourmetStart','gourmetProd','gourmetOut','anotaQtd','aiqQtd'];
  qtyIds.forEach(id=>{
    const el=$(id);if(!el)return;
    el.min='0';el.step='1';el.inputMode='numeric';
  });
  xbApplyVersionAndHealth();
})();
