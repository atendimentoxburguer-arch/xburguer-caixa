const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../../business-rules.js');

test('pagamentos e resumo financeiro não tratam saldo inicial como venda',()=>{
  const record={opening:50,cash:60,deliveryCash:20,cardOut:20,onlinePayment:0,deliveryCard:0,cashOut:10};
  assert.equal(rules.paymentTotal(record),100);
  assert.equal(rules.financialSummaryTotal(record),100);
});

test('dinheiro esperado inclui saldo inicial sem transformá-lo em venda',()=>{
  const record={opening:50,cash:60,deliveryCash:20,cashOut:10};
  assert.equal(rules.expectedCash(record),120);
  assert.equal(rules.nextOpeningBalance(record),120);
});

test('conferência física usa saldo inicial e respeita contagem opcional',()=>{
  const base={opening:500,cash:60,deliveryCash:20,cashOut:10,countedCash:570};
  const verified=rules.applyCashVerification(base,true);
  assert.equal(verified.expectedCash,570);
  assert.equal(verified.cashDifference,0);
  assert.equal(verified.cashCountVerified,true);

  const optional=rules.applyCashVerification({...base,countedCash:999},false);
  assert.equal(optional.expectedCash,570);
  assert.equal(optional.countedCash,0);
  assert.equal(optional.cashDifference,0);
});

test('produção de pão é estoque inicial menos estoque final',()=>{
  assert.deepEqual(rules.breadState(100,80),{start:100,final:80,production:20,out:0});
  const normalized=rules.normalizeBreads({idealStart:100,idealFinal:80,gourmetStart:50,gourmetFinal:35});
  assert.equal(normalized.idealProd,20);
  assert.equal(normalized.gourmetProd,15);
  assert.equal(normalized.idealOut,0);
  assert.equal(normalized.gourmetOut,0);
});

test('backup legado de pão continua compatível',()=>{
  const ideal=rules.canonicalBread({idealStart:100,idealProd:25},'ideal');
  assert.equal(ideal.final,75);
  assert.equal(ideal.production,25);
});

test('normalização calcula vendas, resultado e pagamentos sem saldo inicial',()=>{
  const record=rules.normalizeRecord({
    opening:50,
    cash:60,deliveryCash:20,cardOut:20,onlinePayment:0,deliveryCard:0,cashOut:10,
    countedCash:120,cashCountVerified:true,
    channels:[{name:'Hot',q:2,v:100}],
    expenses:[{d:'Gás',val:30}],
    breads:{idealStart:100,idealFinal:80,gourmetStart:50,gourmetFinal:40}
  },{cashCountVerified:true});
  assert.equal(record.sales,100);
  assert.equal(record.orders,2);
  assert.equal(record.expense,30);
  assert.equal(record.result,70);
  assert.equal(record.paymentTotal,100);
  assert.equal(record.paymentDifference,0);
  assert.equal(record.summaryTotal,100);
  assert.equal(record.expectedCash,120);
  assert.equal(record.cashDifference,0);
});

test('validação canônica rejeita estoque final maior que inicial',()=>{
  const result=rules.validateCanonicalRecord({
    channels:[],expenses:[],breads:{idealStart:10,idealFinal:11,gourmetStart:0,gourmetFinal:0}
  });
  assert.match(result,/estoque final do Pão Ideal/i);
});

test('agregação mensal mantém saldo inicial separado das vendas e pagamentos',()=>{
  const total=rules.aggregate([
    {opening:50,cash:100,channels:[{q:1,v:100}],expenses:[],breads:{}},
    {opening:30,deliveryCash:40,cardOut:60,channels:[{q:2,v:100}],expenses:[{d:'x',val:20}],breads:{}}
  ]);
  assert.equal(total.opening,80);
  assert.equal(total.sales,200);
  assert.equal(total.orders,3);
  assert.equal(total.expense,20);
  assert.equal(total.result,180);
  assert.equal(total.paymentTotal,200);
  assert.equal(total.summaryTotal,200);
});
