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

async function selectDate(page,date){
  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill(date);
  await page.locator('#date').dispatchEvent('change');
}

async function money(page,id,value){
  await page.locator(`#${id}__brl`).fill(String(value));
}

async function confirmIfNeeded(page){
  const layer=page.locator('#confirmLayer');
  if(await layer.isVisible())await page.locator('#confirmOkBtn').click();
}

async function saveFinancialClosingWithoutBread(page,{date,resp}){
  await selectDate(page,date);
  await page.locator('#resp').fill(resp);
  await money(page,'cash',10);
  await page.locator('#q0').fill('1');
  await money(page,'v0',10);
  await page.locator('#saveTopBtn').click();
  await confirmIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});
}

async function saveBreadClosing(page,{date,resp,idealStart,gourmetStart,idealFinal,gourmetFinal}){
  await selectDate(page,date);
  await page.locator('#resp').fill(resp);
  if(idealStart!==undefined)await page.locator('#idealStart').fill(String(idealStart));
  if(gourmetStart!==undefined)await page.locator('#gourmetStart').fill(String(gourmetStart));
  await page.locator('#idealProd').fill(String(idealFinal));
  await page.locator('#gourmetProd').fill(String(gourmetFinal));
  await money(page,'cash',10);
  await page.locator('#q0').fill('1');
  await money(page,'v0',10);
  await page.locator('#saveTopBtn').click();
  await confirmIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});
}

test('fechamentos antigos sem pães não travam o primeiro estoque real em zero',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await saveFinancialClosingWithoutBread(page,{date:'2026-08-30',resp:'Fechamento antigo sem pães'});
  await saveFinancialClosingWithoutBread(page,{date:'2026-08-31',resp:'Outro fechamento antigo sem pães'});

  await selectDate(page,'2026-09-01');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#idealStart')).toHaveValue('');
  await expect(page.locator('#gourmetStart')).toHaveValue('');
  await expect(page.locator('.bread-note')).toContainText('Primeiro controle disponível');

  const noHistory=await page.evaluate(()=>window.XBBreadStock.automaticOpening('2026-09-01'));
  expect(noHistory).toBeNull();

  await saveBreadClosing(page,{
    date:'2026-09-01',resp:'Primeiro controle real',idealStart:100,gourmetStart:50,idealFinal:30,gourmetFinal:20
  });

  await selectDate(page,'2026-09-02');
  await expect(page.locator('#idealStart')).toHaveValue('30');
  await expect(page.locator('#gourmetStart')).toHaveValue('20');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);
});

test('saldo anterior é sugerido, pode receber reabastecimento e o saldo final continua a cadeia',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await selectDate(page,'2026-09-01');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);

  await saveBreadClosing(page,{
    date:'2026-09-01',resp:'Pães dia 01',idealStart:100,gourmetStart:50,idealFinal:30,gourmetFinal:20
  });

  await selectDate(page,'2026-09-02');
  await expect(page.locator('#idealStart')).toHaveValue('30');
  await expect(page.locator('#gourmetStart')).toHaveValue('20');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('.bread-note')).toContainText('estoque final de 01/09/2026');
  await expect(page.locator('.bread-note')).toContainText('reabastecimento');

  await page.locator('#idealStart').fill('100');
  await page.locator('#gourmetStart').fill('60');
  const replenishedRecord=await page.evaluate(()=>currentRecord('2026-09-02').breads);
  expect(replenishedRecord.idealStart).toBe(100);
  expect(replenishedRecord.gourmetStart).toBe(60);

  await saveBreadClosing(page,{
    date:'2026-09-02',resp:'Pães dia 02 com reabastecimento',idealStart:100,gourmetStart:60,idealFinal:25,gourmetFinal:15
  });

  await selectDate(page,'2026-09-02');
  await expect(page.locator('#idealStart')).toHaveValue('100');
  await expect(page.locator('#gourmetStart')).toHaveValue('60');
  await expect(page.locator('#idealProd')).toHaveValue('25');
  await expect(page.locator('#gourmetProd')).toHaveValue('15');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);

  await selectDate(page,'2026-09-05');
  await expect(page.locator('#idealStart')).toHaveValue('25');
  await expect(page.locator('#gourmetStart')).toHaveValue('15');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('.bread-note')).toContainText('02/09/2026');

  await saveBreadClosing(page,{
    date:'2026-09-05',resp:'Pães dia 05',idealStart:25,gourmetStart:15,idealFinal:18,gourmetFinal:9
  });

  await selectDate(page,'2026-10-01');
  await expect(page.locator('#idealStart')).toHaveValue('18');
  await expect(page.locator('#gourmetStart')).toHaveValue('9');
  await expect(page.locator('#idealStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('#gourmetStart')).toHaveJSProperty('readOnly',false);
  await expect(page.locator('.bread-note')).toContainText('05/09/2026');
});
