const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');

test('login, fechamento, persistência, relatório, edição e backup',async({page})=>{
  await page.addInitScript(()=>localStorage.clear());
  await page.goto('/caixa.html?e2e=1');
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#xbIdentityBlock')).toHaveCount(0);

  await page.locator('#loginPass').fill('teste-e2e');
  await page.locator('#rememberMe').check();
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});

  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill('2026-08-22');
  await page.locator('#date').dispatchEvent('change');
  await page.locator('#resp').fill('Teste Automatizado');
  await page.locator('#opening').fill('50');
  await page.locator('#cash').fill('60');
  await page.locator('#deliveryCash').fill('20');
  await page.locator('#cardOut').fill('20');
  await page.locator('#cashOut').fill('10');
  await page.locator('#countedCash').fill('70');
  await page.locator('#q0').fill('1');
  await page.locator('#v0').fill('100');
  await page.locator('#idealStart').fill('100');
  await page.locator('#idealProd').fill('80');
  await page.locator('#gourmetStart').fill('50');
  await page.locator('#gourmetProd').fill('40');

  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  const saved=await page.evaluate(()=>window.XBE2E.records());
  expect(saved).toHaveLength(1);
  expect(saved[0].sales).toBe(100);
  expect(saved[0].paymentTotal).toBe(100);
  expect(saved[0].expectedCash).toBe(70);
  expect(saved[0].cashDifference).toBe(0);
  expect(saved[0].breads.idealProd).toBe(20);
  expect(saved[0].breads.idealFinal).toBe(80);
  await expect(page.locator('#daySales')).toContainText('150,00');

  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
  await page.locator('[data-page="fechamento"]').click();
  await expect(page.locator('#resp')).toHaveValue('Teste Automatizado');
  await expect(page.locator('#v0')).toHaveValue('100');

  await page.locator('[data-page="mensal"]').click();
  await page.locator('#dailyReportDate').fill('2026-08-22');
  await page.locator('#dailyReportDate').dispatchEvent('change');
  await expect(page.locator('#dailyReportPanel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#dailyReportPanel')).toContainText('100,00');

  await page.locator('#dailyReportEditBtn').click();
  await expect(page.locator('#fechamento')).not.toHaveClass(/hidden/);
  await page.locator('#resp').fill('Teste Editado');
  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#confirmLayer')).not.toHaveAttribute('hidden','');
  await page.locator('#confirmOkBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});
  const edited=await page.evaluate(()=>window.XBE2E.records());
  expect(edited[0].resp).toBe('Teste Editado');

  await page.locator('[data-page="backup"]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportJsonBtn').click();
  const download=await downloadPromise;
  const path=await download.path();
  const raw=JSON.parse(await fs.readFile(path,'utf8'));
  expect(raw.format).toBe('xburguer-caixa-backup-v2');
  expect(raw.recordCount).toBe(1);
  const checksum=crypto.createHash('sha256').update(JSON.stringify(raw.records)).digest('hex');
  expect(raw.integrity.checksum).toBe(checksum);
});
