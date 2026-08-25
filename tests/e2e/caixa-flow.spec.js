const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const os=require('node:os');
const path=require('node:path');

async function openCleanApp(page){
  await page.goto('/caixa.html?e2e=1');
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await page.evaluate(()=>window.XBE2E.reset());
  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#xbIdentityBlock')).toHaveCount(0);
}

async function login(page){
  await page.locator('#loginPass').fill('teste-e2e');
  await page.locator('#rememberMe').check();
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
}

async function openClosing(page,date){
  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill(date);
  await page.locator('#date').dispatchEvent('change');
}

async function fillMoney(page,id,value){
  await page.locator(`#${id}__brl`).fill(String(value));
}

async function fillBalancedClosing(page,{date,resp='Teste Automatizado',value=100}){
  await openClosing(page,date);
  await page.locator('#resp').fill(resp);
  await fillMoney(page,'cash',value);
  await page.locator('#q0').fill('1');
  await fillMoney(page,'v0',value);
}

test('login, fechamento, persistência, relatório, edição e backup',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await openClosing(page,'2026-08-22');
  await page.locator('#resp').fill('Teste Automatizado');
  await fillMoney(page,'opening',50);
  await fillMoney(page,'cash',60);
  await fillMoney(page,'deliveryCash',20);
  await fillMoney(page,'cardOut',20);
  await fillMoney(page,'cashOut',10);
  await fillMoney(page,'countedCash',120);
  await page.locator('#q0').fill('1');
  await fillMoney(page,'v0',100);
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
  expect(saved[0].expectedCash).toBe(120);
  expect(saved[0].cashDifference).toBe(0);
  expect(saved[0].breads.idealProd).toBe(20);
  expect(saved[0].breads.idealFinal).toBe(80);
  await expect(page.locator('#daySales')).toContainText('100,00');

  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
  await openClosing(page,'2026-08-22');
  await expect(page.locator('#resp')).toHaveValue('Teste Automatizado');
  expect(await page.evaluate(()=>document.getElementById('v0').value)).toBe('100');

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
  const downloadPath=await download.path();
  const raw=JSON.parse(await fs.readFile(downloadPath,'utf8'));
  expect(raw.format).toBe('xburguer-caixa-backup-v2');
  expect(raw.recordCount).toBe(1);
  const checksum=crypto.createHash('sha256').update(JSON.stringify(raw.records)).digest('hex');
  expect(raw.integrity.checksum).toBe(checksum);
});

test('estoque final maior que inicial é bloqueado antes de salvar',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await openClosing(page,'2026-08-21');
  await page.locator('#resp').fill('Teste Pães');
  await page.locator('#idealStart').fill('10');
  await page.locator('#idealProd').fill('12');

  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('não pode ser maior que o estoque inicial',{timeout:5000});
  expect(await page.evaluate(()=>window.XBE2E.records().length)).toBe(0);
});

test('falha de salvamento preserva o rascunho para recuperação após reload',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await fillBalancedClosing(page,{date:'2026-08-20',resp:'Rascunho Protegido',value:35});
  await page.evaluate(()=>window.XBE2E.failNextSave('Falha E2E simulada no banco.'));

  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('Falha E2E simulada no banco.',{timeout:5000});
  expect(await page.evaluate(()=>window.XBE2E.records().length)).toBe(0);

  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
  await openClosing(page,'2026-08-20');
  await expect(page.locator('#resp')).toHaveValue('Rascunho Protegido');
  expect(await page.evaluate(()=>document.getElementById('v0').value)).toBe('35');
  await expect(page.locator('#draftBadge')).toContainText('Rascunho');
});

test('fechamento excluído pode ser restaurado pelo backup íntegro',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await fillBalancedClosing(page,{date:'2026-08-19',resp:'Teste Restauração',value:48});
  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await page.locator('[data-page="backup"]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportJsonBtn').click();
  const backupDownload=await downloadPromise;
  const backupPath=await backupDownload.path();

  await page.locator('[data-page="historico"]').click();
  await page.locator('#historyTable .link-btn.danger').click();
  await expect(page.locator('#confirmLayer')).not.toHaveAttribute('hidden','');
  await page.locator('#confirmOkBtn').click();
  await expect(page.locator('#toast')).toContainText('excluído',{timeout:5000});
  expect(await page.evaluate(()=>window.XBE2E.records().length)).toBe(0);

  await page.locator('[data-page="backup"]').click();
  await page.locator('#importFile').setInputFiles(backupPath);
  await expect(page.locator('#backupImportHint')).toContainText('Backup íntegro',{timeout:5000});
  await expect(page.locator('#importBtn')).toBeEnabled();
  await page.locator('#importBtn').click();
  await expect(page.locator('#confirmLayer')).not.toHaveAttribute('hidden','');
  await page.locator('#confirmOkBtn').click();
  await expect(page.locator('#toast')).toContainText('restaurado com sucesso',{timeout:5000});

  const restored=await page.evaluate(()=>window.XBE2E.records());
  expect(restored).toHaveLength(1);
  expect(restored[0].date).toBe('2026-08-19');
  expect(restored[0].resp).toBe('Teste Restauração');
  expect(restored[0].sales).toBe(48);
});

test('backup protegido alterado é bloqueado antes da restauração',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await page.locator('[data-page="backup"]').click();

  const fakeRecords=[{date:'2026-08-18',resp:'Arquivo Alterado'}];
  const tampered={
    format:'xburguer-caixa-backup-v2',
    version:'4.18.3',
    exportedAt:new Date().toISOString(),
    recordCount:1,
    integrity:{algorithm:'SHA-256',scope:'records-json',checksum:'0'.repeat(64)},
    records:fakeRecords
  };
  const tempPath=path.join(os.tmpdir(),`xburguer-tampered-${Date.now()}.json`);
  await fs.writeFile(tempPath,JSON.stringify(tampered),'utf8');

  try{
    await page.locator('#importFile').setInputFiles(tempPath);
    await expect(page.locator('#backupImportHint')).toContainText('SHA-256 falhou',{timeout:5000});
    await expect(page.locator('#importBtn')).toBeDisabled();
    expect(await page.evaluate(()=>window.XBE2E.records().length)).toBe(0);
  }finally{
    await fs.unlink(tempPath).catch(()=>{});
  }
});
