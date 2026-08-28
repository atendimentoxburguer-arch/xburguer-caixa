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

async function fillMoney(page,id,value){
  await page.locator(`#${id}__brl`).fill(String(value));
}

test('resumo financeiro é a venda oficial e canais permanecem demonstrativos',async({page})=>{
  await openCleanApp(page);
  await login(page);

  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill('2026-08-18');
  await page.locator('#date').dispatchEvent('change');
  await page.locator('#resp').fill('Teste Separação Financeira');

  await fillMoney(page,'cash',100);
  await fillMoney(page,'cardOut',50);
  await page.locator('#q0').fill('2');
  await fillMoney(page,'v0',400);

  // A diferença proposital prova que a UI não pode usar canais como receita.
  await expect(page.locator('#daySales')).toContainText('150,00');
  await expect(page.locator('#dayBalance')).toContainText('150,00');
  await expect(page.locator('#ctVal')).toContainText('400,00');
  await expect(page.locator('.cash-conference-item')).toContainText(['Venda do Resumo Financeiro','Diferença resumo × canais (demonstrativo)']);
  await expect(page.locator('#automaticConferenceStatus')).not.toContainText('Atenção');

  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});

  const saved=await page.evaluate(()=>window.XBE2E.records()[0]);
  expect(saved.sales).toBe(150);
  expect(saved.paymentTotal).toBe(150);
  expect(saved.channelSales).toBe(400);
  expect(saved.result).toBe(150);
  expect(saved.orders).toBe(2);

  await page.locator('[data-page="dashboard"]').click();
  await expect(page.locator('#dSales')).toContainText('150,00');
  await expect(page.locator('#dRes')).toContainText('150,00');
  await expect(page.locator('#dTicket')).toContainText('75,00');

  await page.locator('[data-page="mensal"]').click();
  await page.locator('#dailyReportDate').fill('2026-08-18');
  await page.locator('#dailyReportDate').dispatchEvent('change');
  await expect(page.locator('#drSales')).toContainText('150,00');
  await expect(page.locator('#drResult')).toContainText('150,00');
  await expect(page.locator('#dailyFinancialRows')).toContainText('Total de vendas (Resumo Financeiro)');
  await expect(page.locator('#dailyFinancialRows')).toContainText('Venda oficial');

  await page.locator('#monthlyReportTab').click();
  await page.locator('#monthPicker').fill('2026-08');
  await page.locator('#monthPicker').dispatchEvent('change');
  await expect(page.locator('#mSales')).toContainText('150,00');
  await expect(page.locator('#mRes')).toContainText('150,00');
  const channelTotal=page.locator('#monthlyChannelsTable tr.report-total-row').last();
  await expect(channelTotal.locator('td').nth(2)).toContainText('400,00');
  await expect(page.locator('#monthlyPaymentsTable')).toContainText('Total de vendas (Resumo Financeiro)');
});
