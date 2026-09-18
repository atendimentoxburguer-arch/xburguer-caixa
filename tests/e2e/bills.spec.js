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
    return window.XBBillLogic.addDaysISO(base,offset);
  },days);
}

async function createBill(page,{supplier,description='',amount,due,notes=''}){
  await page.locator('#billSupplier').fill(supplier);
  await page.locator('#billDescription').fill(description);
  await page.locator('#billAmount').fill(String(amount));
  await page.locator('#billDueDate').fill(due);
  if(notes)await page.locator('#billNotes').fill(notes);
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#toast')).toContainText('Boleto cadastrado',{timeout:5000});
}

test('cadastra boleto e classifica aviso de 3 dias',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,3);

  await createBill(page,{supplier:'Fornecedor E2E',description:'Conta de teste',amount:125.50,due});

  const item=page.locator('.bill-item').filter({hasText:'Fornecedor E2E'});
  await expect(item).toBeVisible();
  await expect(item.locator('.bill-state')).toHaveText('Vence em 3 dias');
  await expect(page.locator('#billsNavBadge')).toHaveText('1');
});

test('pagamento remove boleto da fila de atenção e preserva histórico',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,0);

  await createBill(page,{supplier:'Boleto do dia',amount:300,due});
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

  await createBill(page,{supplier:'Fornecedor original',amount:80,due});

  await page.locator('.bill-item').filter({hasText:'Fornecedor original'}).locator('[data-bill-action="edit"]').click();
  await page.locator('#billSupplier').fill('Fornecedor corrigido');
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#toast')).toContainText('Boleto atualizado',{timeout:5000});

  const stored=await page.evaluate(()=>window.XBBills.rows());
  expect(stored).toHaveLength(1);
  expect(stored[0].supplier).toBe('Fornecedor corrigido');
});

test('busca, ordena e agrupa boletos sem perder os registros',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due2=await datePlus(page,2);
  const due5=await datePlus(page,5);
  const due10=await datePlus(page,10);

  await createBill(page,{supplier:'Internet Rápida',description:'Fibra',amount:220,due:due5,notes:'Loja Centro'});
  await createBill(page,{supplier:'Água Municipal',description:'Água',amount:90,due:due2});
  await createBill(page,{supplier:'Aluguel',description:'Ponto comercial',amount:1500,due:due10});

  await page.locator('#billsSearch').fill('centro');
  await expect(page.locator('.bill-item')).toHaveCount(1);
  await expect(page.locator('.bill-item')).toContainText('Internet Rápida');

  await page.locator('#billsClearSearch').click();
  await page.locator('#billsSort').selectOption('supplier_asc');
  await page.locator('#billsGroup').selectOption('supplier');

  const groupNames=await page.locator('.bill-group-head strong').allTextContents();
  expect(groupNames).toEqual(['Água Municipal','Aluguel','Internet Rápida']);
  await expect(page.locator('#billsResultSummary')).toContainText('3 de 3');

  const stored=await page.evaluate(()=>window.XBBills.rows());
  expect(stored).toHaveLength(3);
});

test('duplicar boleto cria nova conta com vencimento no mês seguinte',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,12);
  await createBill(page,{supplier:'Fornecedor recorrente',description:'Mensalidade',amount:450,due});

  const original=page.locator('.bill-item').filter({hasText:'Fornecedor recorrente'});
  await original.locator('[data-bill-action="duplicate"]').click();
  await expect(page.locator('#billSupplier')).toHaveValue('Fornecedor recorrente');
  const expected=await page.evaluate(value=>window.XBBillLogic.addMonthsISO(value,1),due);
  await expect(page.locator('#billDueDate')).toHaveValue(expected);
  await page.locator('#billForm').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#toast')).toContainText('Boleto cadastrado',{timeout:5000});

  const stored=await page.evaluate(()=>window.XBBills.rows());
  expect(stored).toHaveLength(2);
  expect(stored[0].id).not.toBe(stored[1].id);
});

test('logout limpa cache de boletos e valores financeiros visíveis',async({page})=>{
  await openCleanApp(page);await login(page);
  await page.locator('[data-page="boletos"]').click();
  const due=await datePlus(page,5);
  await createBill(page,{supplier:'Cache sensível',description:'Não deve permanecer após sair',amount:77,due});
  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#cash__brl').fill('99');
  await page.evaluate(()=>{if(authSession)authSession.access_token=''});
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginScreen')).not.toHaveClass(/hidden/);
  const state=await page.evaluate(()=>({
    billCache:localStorage.getItem('xburguer_bills_cache_v1'),
    billRows:window.XBBills.rows().length,
    cash:document.getElementById('cash')?.value||''
  }));
  expect(state.billCache).toBeNull();
  expect(state.billRows).toBe(0);
  expect(state.cash).toBe('');
});
