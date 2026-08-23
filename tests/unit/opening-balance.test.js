const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../../business-rules.js');

test('saldo inicial do próximo dia soma saldo anterior, dinheiro caixa e entregas e subtrai retiradas',()=>{
  assert.equal(rules.nextOpeningBalance({opening:100,cash:250,deliveryCash:80,cashOut:130}),300);
});

test('saldo inicial automático nunca fica negativo',()=>{
  assert.equal(rules.nextOpeningBalance({opening:50,cash:20,deliveryCash:10,cashOut:200}),0);
});

test('dia 01 é identificado como início manual do mês',()=>{
  assert.equal(rules.isFirstDayOfMonth('2026-09-01'),true);
  assert.equal(rules.isFirstDayOfMonth('2026-09-02'),false);
});
