const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('tema do bootstrap acompanha o manifesto oficial', () => {
  const index = read('index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const match = index.match(/<meta name="theme-color" content="([^"]+)">/);
  assert.ok(match, 'index.html precisa declarar theme-color');
  assert.equal(match[1], manifest.theme_color);
});

test('escape HTML de boletos mantém entidade de aspas completa', () => {
  const bills = read('bills.js');
  assert.match(bills, /&quot;/);
  assert.doesNotMatch(bills, /&quot(?!;)/);
});

test('camadas legadas de login permanecem removidas do runtime e do repositório', () => {
  const caixa = read('caixa.html');
  const legacy = [
    'login-alignment.css',
    'login-dual-panel.css',
    'login-final-polish.css',
    'login-modern.css',
    'login-transitions.css'
  ];
  for (const name of legacy) {
    assert.equal(caixa.includes(name), false, `${name} não deve voltar ao runtime`);
    assert.equal(fs.existsSync(path.join(root, name)), false, `${name} deve permanecer removido`);
  }
});

test('helper PWA legado permanece fora do runtime e do repositório', () => {
  const caixa = read('caixa.html');
  const index = read('index.html');
  assert.equal(caixa.includes('install-helper.js'), false);
  assert.equal(index.includes('install-helper.js'), false);
  assert.equal(fs.existsSync(path.join(root, 'install-helper.js')), false);
});

test('workflow principal usa a mesma geração auditada do checkout', () => {
  const workflow = read('.github/workflows/validar-isolamento.yml');
  assert.match(workflow, /actions\/checkout@v7/);
  assert.doesNotMatch(workflow, /actions\/checkout@v4/);
});

test('função de lembretes não devolve detalhes internos de configuração', () => {
  const edge = read('supabase/functions/bill-reminders/index.ts');
  assert.doesNotMatch(edge, /detail\s*:\s*configError\.message/);
  assert.match(edge, /timingSafeEqual/);
});

test('sessão persistida minimiza credenciais e força renovação após recarregar', () => {
  const app = read('app1.js');
  const start = app.indexOf('function sessionForStorage');
  const end = app.indexOf('async function fetchWithTimeout');
  assert.ok(start >= 0 && end > start, 'bloco de persistência de sessão precisa existir');
  const block = app.slice(start, end);
  assert.match(block, /refresh_token:String\(session\.refresh_token\)/);
  assert.match(block, /expires_at:0/);
  assert.match(block, /user:sessionUser\(session\.user\)/);
  assert.doesNotMatch(block, /access_token\s*:/);
  assert.match(app, /user:sessionUser\(data\.user\)/);
});

