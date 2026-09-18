const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sw = fs.readFileSync(path.join(__dirname, '..', '..', 'service-worker.js'), 'utf8');

test('clique em notificação preserva o destino de boletos em janela já aberta', () => {
  assert.match(sw, /const target = new URL\(event\.notification\.data\?\.url \|\| "\.\/caixa\.html\?open=bills"/);
  assert.match(sw, /typeof client\.navigate === "function"/);
  assert.match(sw, /await client\.navigate\(target\)/);
  assert.match(sw, /targetClient\.postMessage\(\{ type: "XB_OPEN_BILLS", billId \}\)/);
});

test('service worker mantém fallback para abrir uma nova janela', () => {
  assert.match(sw, /self\.clients\.openWindow\(target\)/);
});


test('cache do PWA normaliza query strings e remove entradas legadas duplicadas', () => {
  assert.match(sw, /function cacheKeyForRequest\(request\)/);
  assert.match(sw, /url\.search = ""/);
  assert.match(sw, /url\.hash = ""/);
  assert.match(sw, /cache\.put\(cacheKeyForRequest\(request\), response\.clone\(\)\)/);
  assert.match(sw, /cache\.match\(cacheKeyForRequest\(request\)\)/);
  assert.match(sw, /Boolean\(url\.search \|\| url\.hash\)/);
});
