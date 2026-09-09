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

async function openClosing(page,date){
  await page.locator('[data-page="fechamento"]').click();
  await page.locator('#date').fill(date);
  await page.locator('#date').dispatchEvent('change');
}

async function fillMoney(page,id,value){
  await page.locator(`#${id}__brl`).fill(String(value));
}

async function saveSimpleClosing(page,date,value=25){
  await openClosing(page,date);
  await page.locator('#resp').fill('Teste Resiliência');
  await fillMoney(page,'cash',value);
  await page.locator('#q0').fill('1');
  await fillMoney(page,'v0',value);
  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo',{timeout:5000});
}

test('salvamento confirmado não vira falha quando apenas a releitura cai',async({page})=>{
  await openCleanApp(page);
  await login(page);
  const date='2026-08-17';

  await openClosing(page,date);
  await page.locator('#resp').fill('Gravação Confirmada');
  await fillMoney(page,'cash',35);
  await page.locator('#q0').fill('1');
  await fillMoney(page,'v0',35);
  await page.evaluate(()=>window.XBE2E.failNextLoad('Falha E2E depois da gravação.'));

  await page.locator('#saveTopBtn').click();
  await expect(page.locator('#toast')).toContainText('salvo na nuvem',{timeout:5000});
  await expect(page.locator('#draftBadge')).toContainText('atualização pendente');

  const result=await page.evaluate(target=>({
    records:window.XBE2E.records(),
    draft:localStorage.getItem('xburguer_draft_v3:'+target)
  }),date);
  expect(result.records).toHaveLength(1);
  expect(result.records[0].resp).toBe('Gravação Confirmada');
  expect(result.draft).toBeNull();
});

test('exclusão confirmada continua excluída quando apenas a releitura cai',async({page})=>{
  await openCleanApp(page);
  await login(page);
  const date='2026-08-16';
  await saveSimpleClosing(page,date,28);

  await page.locator('[data-page="historico"]').click();
  await page.locator('#historyMonth').fill('2026-08');
  await page.locator('#historyMonth').dispatchEvent('change');
  await expect(page.locator('#historyTable [data-delete-date]')).toBeVisible();
  await page.evaluate(()=>window.XBE2E.failNextLoad('Falha E2E depois da exclusão.'));
  await page.locator('#historyTable [data-delete-date]').click();
  await expect(page.locator('#confirmLayer')).not.toHaveAttribute('hidden','');
  await page.locator('#confirmOkBtn').click();

  await expect(page.locator('#toast')).toContainText('excluído na nuvem',{timeout:5000});
  expect(await page.evaluate(()=>window.XBE2E.records().length)).toBe(0);
  await expect(page.locator('#historyTable')).toContainText('Nenhum fechamento encontrado');
});

test('restauração confirmada não é anunciada como desfeita se a releitura falhar',async({page})=>{
  await openCleanApp(page);
  await login(page);
  await page.locator('[data-page="backup"]').click();

  const legacyRecord={
    date:'2026-08-15',
    resp:'Backup Confirmado',
    cash:42,
    channels:[{name:'Hot',q:1,v:42}],
    expenses:[],
    breads:{idealStart:0,idealFinal:0,gourmetStart:0,gourmetFinal:0}
  };
  await page.locator('#importFile').setInputFiles({
    name:'backup-legado-resiliencia.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify([legacyRecord]))
  });
  await expect(page.locator('#backupImportHint')).toContainText('Backup antigo compatível',{timeout:5000});
  await page.evaluate(()=>window.XBE2E.failNextLoad('Falha E2E depois da restauração.'));

  await page.locator('#importBtn').click();
  await expect(page.locator('#confirmLayer')).not.toHaveAttribute('hidden','');
  await page.locator('#confirmOkBtn').click();

  await expect(page.locator('#toast')).toContainText('Backup restaurado na nuvem',{timeout:5000});
  const records=await page.evaluate(()=>window.XBE2E.records());
  expect(records).toHaveLength(1);
  expect(records[0].date).toBe('2026-08-15');
  expect(records[0].resp).toBe('Backup Confirmado');
  expect(records[0].sales).toBe(42);
});
