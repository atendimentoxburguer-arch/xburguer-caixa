const {test,expect}=require('@playwright/test');

async function openCleanApp(page){
  await page.goto('/caixa.html?e2e=1');
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await page.evaluate(()=>window.XBE2E.reset());
  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
}

async function login(page){
  await page.locator('#loginPass').fill('teste-e2e');
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
}

async function appToday(page){
  return page.evaluate(()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
}

test('valores brasileiros com ponto de milhar não perdem magnitude',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await page.locator('[data-page="fechamento"]').click();

  const cash=page.locator('#cash__brl');
  await cash.fill('1.234');
  await cash.blur();
  expect(await page.evaluate(()=>document.getElementById('cash').value)).toBe('1234');
  await expect(cash).toHaveValue(/1\.234,00/);

  await cash.fill('1.234,56');
  await cash.blur();
  expect(await page.evaluate(()=>document.getElementById('cash').value)).toBe('1234.56');
  await expect(cash).toHaveValue(/1\.234,56/);

  const parsed=await page.evaluate(()=>({
    decimal:window.XBurguerCurrency.parse('12.34'),
    thousands:window.XBurguerCurrency.parse('1.234.567'),
    brazilian:window.XBurguerCurrency.parse('9.876,54')
  }));
  expect(parsed).toEqual({decimal:'12.34',thousands:'1234567',brazilian:'9876.54'});
});

test('relatório mensal preserva pedidos quando contagem física é opcional',async({page})=>{
  await openCleanApp(page);
  await login(page);
  const date=await appToday(page);
  const month=date.slice(0,7);

  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill(date);
  await page.locator('#date').dispatchEvent('change');
  await page.locator('#resp').fill('Auditoria Mensal');
  await page.locator('#cash__brl').fill('100');
  await page.locator('#q0').fill('3');
  await page.locator('#v0__brl').fill('250');
  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await page.locator('[data-page="mensal"]').click();
  await page.locator('#monthlyReportTab').click();
  await page.locator('#monthPicker').fill(month);
  await page.locator('#monthPicker').dispatchEvent('change');

  const row=page.locator('#monthTable tr').first();
  await expect(row.locator('td').nth(11)).toHaveText('3');
  await expect(row.locator('td').nth(12)).toHaveText('—');
  const channelTotal=page.locator('#monthlyChannelsTable tr.report-total-row').last();
  await expect(channelTotal.locator('td').nth(2)).toContainText('250,00');
  await expect(page.locator('#mSales')).toContainText('100,00');
});

test('falha ao migrar rascunho legado preserva a cópia antiga',async({page})=>{
  await openCleanApp(page);
  await login(page);

  const result=await page.evaluate(()=>{
    const legacy={date:'2026-09-01',resp:'Rascunho protegido',cash:123,savedAt:new Date().toISOString()};
    localStorage.setItem(LEGACY_DRAFT_KEY,JSON.stringify(legacy));
    const proto=Storage.prototype;
    const previousSet=proto.setItem;
    proto.setItem=function(key,value){
      if(String(key).startsWith(DRAFT_PREFIX))throw new DOMException('Quota cheia','QuotaExceededError');
      return previousSet.call(this,key,value);
    };
    let migrated;
    try{migrated=migrateLegacyDraft()}
    finally{proto.setItem=previousSet}
    return {
      migrated,
      legacy:JSON.parse(localStorage.getItem(LEGACY_DRAFT_KEY)||'null'),
      target:localStorage.getItem(draftKey(legacy.date))
    };
  });

  expect(result.migrated).toBe(false);
  expect(result.legacy.resp).toBe('Rascunho protegido');
  expect(result.target).toBeNull();
});
