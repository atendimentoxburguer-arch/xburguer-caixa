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
  await page.locator('#rememberMe').check();
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

async function confirmSaveWarningIfNeeded(page){
  const layer=page.locator('#confirmLayer');
  if(await layer.isVisible())await page.locator('#confirmOkBtn').click();
}

async function saveClosing(page,{date,resp,opening,cash,delivery,cashOut,sales}){
  await selectDate(page,date);
  await page.locator('#resp').fill(resp);
  if(opening!==undefined)await money(page,'opening',opening);
  await money(page,'cash',cash);
  await money(page,'deliveryCash',delivery);
  await money(page,'cashOut',cashOut);
  await page.locator('#q0').fill('1');
  await money(page,'v0',sales);
  await page.locator('#saveTopBtn').click();
  await confirmSaveWarningIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});
}

test('saldo inicial fica fora das vendas e permanece no dinheiro físico e no próximo dia',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await selectDate(page,'2026-09-01');

  await page.locator('#resp').fill('Teste financeiro');
  await money(page,'opening',100);
  await money(page,'cash',250);
  await money(page,'deliveryCash',80);
  await money(page,'cashOut',130);
  await page.locator('#q0').fill('1');
  await money(page,'v0',330);
  await money(page,'countedCash',300);

  await expect(page.locator('#daySales')).toHaveText('R$ 330,00');
  await expect(page.locator('#aSales')).toHaveText('R$ 330,00');
  await expect(page.locator('#paymentTotal')).toHaveText('R$ 330,00');
  await expect(page.locator('#cashDiff')).toHaveText('R$ 0,00');

  const record=await page.evaluate(()=>currentRecord('2026-09-01'));
  expect(record.sales).toBe(330);
  expect(record.paymentTotal).toBe(330);
  expect(record.expectedCash).toBe(300);
  expect(record.cashDifference).toBe(0);

  await page.locator('#saveTopBtn').click();
  await confirmSaveWarningIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await selectDate(page,'2026-09-02');
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('300');
});

test('dia 01 é manual e dias seguintes recebem saldo inicial automático',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await saveClosing(page,{
    date:'2026-09-01',resp:'Abertura Setembro',opening:100,cash:250,delivery:80,cashOut:130,sales:330
  });

  await selectDate(page,'2026-09-02');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',true);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('300');

  await page.locator('#resp').fill('Dia 02');
  await money(page,'cash',100);
  await money(page,'deliveryCash',50);
  await money(page,'cashOut',75);
  await page.locator('#q0').fill('1');
  await money(page,'v0',150);
  await page.locator('#saveTopBtn').click();
  await confirmSaveWarningIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await selectDate(page,'2026-09-03');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',true);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('375');

  await selectDate(page,'2026-10-01');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',false);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('');
});

test('permite pular dias e usa o último fechamento anterior salvo no mês',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await saveClosing(page,{
    date:'2026-09-01',resp:'Dia 01',opening:100,cash:250,delivery:80,cashOut:130,sales:330
  });

  await selectDate(page,'2026-09-05');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',true);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('300');

  await page.locator('#resp').fill('Dia 05');
  await money(page,'cash',100);
  await money(page,'deliveryCash',50);
  await money(page,'cashOut',75);
  await page.locator('#q0').fill('1');
  await money(page,'v0',150);
  await page.locator('#saveTopBtn').click();
  await confirmSaveWarningIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await selectDate(page,'2026-09-10');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',true);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('375');
});

test('primeiro fechamento salvo do mês pode ter saldo inicial manual mesmo fora do dia 01',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await selectDate(page,'2026-11-05');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',false);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('');

  await page.locator('#resp').fill('Primeiro registro novembro');
  await money(page,'opening',200);
  await money(page,'cash',80);
  await money(page,'deliveryCash',20);
  await money(page,'cashOut',50);
  await page.locator('#q0').fill('1');
  await money(page,'v0',100);
  await page.locator('#saveTopBtn').click();
  await confirmSaveWarningIfNeeded(page);
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  await selectDate(page,'2026-11-20');
  await expect(page.locator('#opening__brl')).toHaveJSProperty('readOnly',true);
  expect(await page.evaluate(()=>document.getElementById('opening').value)).toBe('250');
});
