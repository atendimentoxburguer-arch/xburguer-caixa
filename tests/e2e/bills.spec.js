const {test,expect}=require('@playwright/test');

async function openCleanApp(page){
  await page.goto('/caixa.html?e2e=1');
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true&&!!window.XBBills);
  await page.evaluate(()=>{window.XBE2E.reset();window.XBBills.resetE2E()});
  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true&&!!window.XBBills);
}

async function login(page){
  await page.locator('#loginPass').fill('teste-e2e');
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
}

async function datePlus(page,days){
  return await page.evaluate(offset=>{
    const base=window.XBBillLogic.todayLocal();
    const [year,month,day]=base.split('-').map(Number);
    const date=new Date(year,month-1,day+offset,12,0,0);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  },days);
}

test('cadastra boleto e classifica aviso de 3 dias',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,3);

  await page.locator('#billSupplier').fill('Fornecedor E2E');
  await page.locator('#billDescription').fill('Conta de teste');
  await page.locator('#billAmount').fill('125.50');
  await page.locator('#billDueDate').fill(due);
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());

  await expect(page.locator('#toast')).toContainText('Boleto cadastrado',{timeout:5000});
  const item=page.locator('.bill-item').filter({hasText:'Fornecedor E2E'});
  await expect(item).toBeVisible();
  await expect(item.locator('.bill-state')).toHaveText('Vence em 3 dias');
  await expect(page.locator('#billsNavBadge')).toHaveText('1');
});

test('pagamento remove boleto da fila de atenção e preserva histórico',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,0);

  await page.locator('#billSupplier').fill('Boleto do dia');
  await page.locator('#billAmount').fill('300');
  await page.locator('#billDueDate').fill(due);
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('.bill-item').filter({hasText:'Boleto do dia'}).locator('.bill-state')).toHaveText('Vence hoje');

  await page.locator('.bill-item').filter({hasText:'Boleto do dia'}).locator('[data-bill-action="paid"]').click();
  await expect(page.locator('#confirmLayer')).toBeVisible();
  await page.locator('#confirmOkBtn').click();
  await expect(page.locator('#toast')).toContainText('Pagamento registrado',{timeout:5000});
  await expect(page.locator('#billsNavBadge')).toBeHidden();

  await page.locator('[data-bill-filter="paid"]').click();
  const paid=page.locator('.bill-item').filter({hasText:'Boleto do dia'});
  await expect(paid).toBeVisible();
  await expect(paid.locator('.bill-state')).toHaveText('Pago');
});

test('edição mantém o mesmo boleto sem duplicar cadastro',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,8);

  await page.locator('#billSupplier').fill('Fornecedor original');
  await page.locator('#billAmount').fill('80');
  await page.locator('#billDueDate').fill(due);
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());

  await page.locator('.bill-item').filter({hasText:'Fornecedor original'}).locator('[data-bill-action="edit"]').click();
  await page.locator('#billSupplier').fill('Fornecedor corrigido');
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#toast')).toContainText('Boleto atualizado',{timeout:5000});

  const stored=await page.evaluate(()=>window.XBBills.rows());
  expect(stored).toHaveLength(1);
  expect(stored[0].supplier).toBe('Fornecedor corrigido');
});
