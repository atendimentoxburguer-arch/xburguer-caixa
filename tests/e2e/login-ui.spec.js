const {test,expect}=require('@playwright/test');

async function openCleanLogin(page){
  await page.goto('/caixa.html?e2e=1');
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await page.evaluate(()=>window.XBE2E.reset());
  await page.reload();
  await page.waitForFunction(()=>window.__XB_E2E_READY__===true);
  await expect(page.locator('#loginScreen')).not.toHaveClass(/hidden/);
}

test('login moderno mantém acessibilidade, lembrar sessão e entrada funcional',async({page})=>{
  await openCleanLogin(page);

  await expect(page.locator('.login-btn')).toHaveText('ENTRAR NO SISTEMA');
  await expect(page.locator('#loginError')).toHaveAttribute('role','alert');
  await expect(page.locator('#togglePass')).toHaveAttribute('aria-pressed','false');

  await page.locator('#loginPass').fill('teste-e2e');
  await page.locator('#togglePass').click();
  await expect(page.locator('#loginPass')).toHaveAttribute('type','text');
  await expect(page.locator('#togglePass')).toHaveText('Ocultar');
  await expect(page.locator('#togglePass')).toHaveAttribute('aria-pressed','true');

  await page.locator('#togglePass').click();
  await expect(page.locator('#loginPass')).toHaveAttribute('type','password');
  await page.locator('#rememberMe').check();
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());

  await expect(page.locator('#loginScreen')).toHaveClass(/hidden/,{timeout:5000});
  const savedSession=await page.evaluate(()=>localStorage.getItem('xburguer_supabase_session_v1'));
  expect(savedSession).toBeTruthy();
});

test('erro de autenticação é apresentado de forma clara e permite nova tentativa',async({page})=>{
  await openCleanLogin(page);

  await page.evaluate(()=>{
    loginCloud=async()=>{throw new Error('Invalid login credentials')};
  });

  await page.locator('#loginPass').fill('senha-invalida');
  await page.locator('#loginForm').evaluate(form=>form.requestSubmit());

  await expect(page.locator('#loginError')).toBeVisible();
  await expect(page.locator('#loginError')).toContainText('Senha incorreta');
  await expect(page.locator('#loginPass')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('.login-btn')).toBeEnabled();
  await expect(page.locator('.login-btn')).toHaveText('ENTRAR NO SISTEMA');

  await page.locator('#loginPass').fill('nova-tentativa');
  await expect(page.locator('#loginError')).not.toBeVisible();
});

test('versão exibida no login acompanha a versão atual do sistema',async({page})=>{
  await openCleanLogin(page);
  const pseudo=await page.locator('.login-demo').evaluate(el=>getComputedStyle(el,'::after').content);
  expect(pseudo).toContain('4.18.3');
});
