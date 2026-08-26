/* X-Burguer Caixa — estabilidade funcional consolidada v4.18.3 */
const XB_APP_VERSION='4.18.3';
window.XB_APP_VERSION=XB_APP_VERSION;
let xbAuthRefreshPromise=null;

function xbIsNetworkError(err){
  const msg=String(err?.message||err||'').toLowerCase();
  return !navigator.onLine ||
    msg.includes('não foi possível conectar') ||
    msg.includes('demorou demais') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed');
}
window.xbIsNetworkError=xbIsNetworkError;

/* Impede duas renovações do mesmo refresh token ao mesmo tempo e não destrói
   a sessão por causa de uma queda temporária de internet. */
refreshAuthSession=async function(remember=true){
  if(xbAuthRefreshPromise)return xbAuthRefreshPromise;
  xbAuthRefreshPromise=(async()=>{
    if(!authSession?.refresh_token)throw new Error('Sessão expirada. Entre novamente.');
    try{
      const data=await authFetch('token?grant_type=refresh_token',{refresh_token:authSession.refresh_token});
      const refreshed=normalizeSession(data);
      if(!refreshed?.access_token)throw new Error('O servidor não retornou uma sessão válida.');
      authSession=refreshed;
      currentUser=authSession.user;
      persistSession(authSession,remember);
      try{
        if(typeof realtimeClient!=='undefined'&&realtimeClient?.realtime&&authSession.access_token){
          realtimeClient.realtime.setAuth(authSession.access_token);
        }
      }catch{}
      return authSession;
    }catch(err){
      if(xbIsNetworkError(err))throw err;
      try{clearStoredSessions()}catch{}
      authSession=null;currentUser=null;currentProfile=null;
      throw new Error('Sua sessão expirou. Entre novamente para continuar.');
    }finally{
      xbAuthRefreshPromise=null;
    }
  })();
  return xbAuthRefreshPromise;
};

/* Busca todos os fechamentos em páginas. Evita o limite padrão da API
   truncar o histórico depois de muitos meses/anos de uso. */
loadCloudData=function(){
  if(cloudLoadPromise)return cloudLoadPromise;
  cloudLoadPromise=(async()=>{
    setCloudStatus('● Sincronizando...','syncing');
    try{
      const select='*,channel_sales(channel_name,order_count,amount),bread_controls(bread_type,opening_stock,production,out_qty,closing_stock),online_orders(platform,order_count,amount),expenses(description,amount)';
      const pageSize=500;
      let offset=0;
      const all=[];
      while(true){
        const rows=await sbRest(`cash_closings?select=${encodeURIComponent(select)}&order=business_date.asc&limit=${pageSize}&offset=${offset}`);
        const batch=Array.isArray(rows)?rows:[];
        all.push(...batch);
        if(batch.length<pageSize)break;
        offset+=pageSize;
      }
      cloudData=all.map(cloudToRecord);
      lastSyncAt=new Date();
      setCloudStatus('● Banco na nuvem','online');
      updateSyncUi();
      return cloudData;
    }catch(err){
      setCloudStatus(navigator.onLine?'● Erro de sincronização':'● Sem internet','error');
      throw err;
    }finally{
      cloudLoadPromise=null;
    }
  })();
  return cloudLoadPromise;
};

function xbApplyCashRule(rec){
  if(!rec)return rec;
  if(window.XBBusinessRules?.applyCashVerification){
    return window.XBBusinessRules.applyCashVerification(rec,rec.cashCountVerified);
  }
  const expected=Math.round((Number(rec.opening||0)+Number(rec.cash||0)+Number(rec.deliveryCash||0)-Number(rec.cashOut||0))*100)/100;
  rec.expectedCash=expected;
  if(rec.cashCountVerified){
    rec.cashDifference=Math.round((Number(rec.countedCash||0)-expected)*100)/100;
  }else{
    rec.countedCash=0;
    rec.cashDifference=0;
  }
  return rec;
}

/* Regra oficial da conferência física:
   Saldo Inicial + Dinheiro (Caixa) + Dinheiro (Entregas) - retiradas.
   O saldo inicial é dinheiro físico disponível, mas nunca é venda. */
const xbOriginalCurrentRecord=currentRecord;
currentRecord=function(dateOverride=null){
  return xbApplyCashRule(xbOriginalCurrentRecord(dateOverride));
};

const xbOriginalNormalize=normalize;
normalize=function(record){
  return xbApplyCashRule(xbOriginalNormalize(record));
};

const xbOriginalCalc=calc;
calc=function(){
  const result=xbOriginalCalc.apply(this,arguments);
  const diffEl=$('cashDiff');
  if(diffEl){
    const countedRaw=String($('countedCash')?.value??'').trim();
    if(!countedRaw){
      diffEl.textContent='—';
      diffEl.classList.remove('positive','negative');
    }else{
      const expected=n('opening')+n('cash')+n('deliveryCash')-n('cashOut');
      const diff=n('countedCash')-expected;
      diffEl.textContent=br(diff);
      setTone(diffEl,diff);
    }
  }
  return result;
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

/* Backup de contingência; backup-protection.js substitui esta rotina pela versão SHA-256. */
exportJSON=function(){
  const data={version:XB_APP_VERSION,exportedAt:new Date().toISOString(),records:load()};
  download(`xburguer-backup-${isoToday()}.json`,JSON.stringify(data,null,2),'application/json');
  const now=new Date().toLocaleString('pt-BR');
  localStorage.setItem(BACKUP_KEY,now);
  refreshBackup();
  toast('Backup JSON exportado.');
};

/* Safari/iOS pode cancelar downloads quando o Object URL é revogado cedo demais. */
download=function(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
};

/* Valida todo o backup antes de enviá-lo ao banco. */
validateBackupRecords=function(records){
  if(!Array.isArray(records))return'O arquivo não contém uma lista de fechamentos.';
  if(records.length>10000)return'O backup possui registros demais para uma única importação.';
  const dates=new Set();
  const validMoney=v=>v===undefined||v===null||v===''||(Number.isFinite(Number(v))&&Number(v)>=0);
  const validQty=v=>v===undefined||v===null||v===''||(Number.isInteger(Number(v))&&Number(v)>=0);

  for(let i=0;i<records.length;i++){
    const r=records[i];
    if(!r||typeof r!=='object'||Array.isArray(r))return`Registro ${i+1} do backup é inválido.`;

    const date=String(r.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return`Registro ${i+1} está sem uma data válida.`;
    const parsed=new Date(date+'T12:00:00');
    if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return`Registro ${i+1} possui uma data inexistente.`;
    if(dates.has(date))return`O backup possui mais de um fechamento para ${date}. Remova a duplicidade antes de importar.`;
    dates.add(date);

    if(!String(r.resp||'').trim())return`Registro ${i+1} está sem responsável.`;

    const moneyFields=['opening','cash','deliveryCash','cardOut','onlinePayment','deliveryCard','cashOut','countedCash','sales','expense'];
    for(const key of moneyFields){
      if(!validMoney(r[key]))return`Registro ${i+1} possui valor financeiro inválido em ${key}.`;
    }

    const recordChannels=Array.isArray(r.channels)?r.channels:[];
    for(const c of recordChannels){
      if(!validQty(c?.q)||!validMoney(c?.v))return`Registro ${i+1} possui dados inválidos em vendas por canal.`;
    }

    const online=r.online||{};
    for(const key of ['anotaQtd','aiqQtd']){
      if(!validQty(online[key]))return`Registro ${i+1} possui quantidade online inválida.`;
    }
    for(const key of ['anotaVal','aiqVal']){
      if(!validMoney(online[key]))return`Registro ${i+1} possui valor online inválido.`;
    }

    const breads=r.breads||{};
    for(const key of ['idealStart','idealFinal','idealProd','idealOut','gourmetStart','gourmetFinal','gourmetProd','gourmetOut']){
      if(!validQty(breads[key]))return`Registro ${i+1} possui quantidade de pão inválida.`;
    }
    for(const prefix of ['ideal','gourmet']){
      const start=Number(breads[prefix+'Start']||0);
      const final=breads[prefix+'Final'];
      if(final!==undefined&&final!==null&&final!==''&&Number(final)>start)return`Registro ${i+1} possui estoque final maior que o estoque inicial.`;
    }

    const expenses=Array.isArray(r.expenses)?r.expenses:[];
    for(const e of expenses){
      if(!validMoney(e?.val))return`Registro ${i+1} possui despesa com valor inválido.`;
      if(Number(e?.val||0)>0&&!String(e?.d||'').trim())return`Registro ${i+1} possui despesa sem descrição.`;
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
  const moneyIds=['opening','cash','deliveryCash','cardOut','online','deliveryCard','cashOut','countedCash','anotaVal','aiqVal'];
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
