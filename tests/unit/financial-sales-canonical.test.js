const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../../business-rules.js');

test('venda oficial usa resumo financeiro e canais ficam demonstrativos',()=>{
  const record=rules.normalizeRecord({
    cash:100,
    deliveryCash:50,
    cardOut:200,
    onlinePayment:30,
    deliveryCard:20,
    channels:[
      {name:'Hot',q:2,v:500},
      {name:'Mesa',q:1,v:100}
    ],
    expenses:[{d:'Despesa',val:40}],
    breads:{}
  });

  assert.equal(record.sales,400);
  assert.equal(record.paymentTotal,400);
  assert.equal(record.summaryTotal,400);
  assert.equal(record.channelSales,600);
  assert.equal(record.paymentDifference,-200);
  assert.equal(record.result,360);
  assert.equal(record.orders,3);
});

test('agregado financeiro nunca soma vendas por canal como receita',()=>{
  const total=rules.aggregate([
    {cash:100,channels:[{q:1,v:500}],expenses:[{d:'x',val:20}],breads:{}},
    {cardOut:200,channels:[{q:2,v:50}],expenses:[{d:'y',val:30}],breads:{}}
  ]);

  assert.equal(total.sales,300);
  assert.equal(total.channelSales,550);
  assert.equal(total.expense,50);
  assert.equal(total.result,250);
  assert.equal(total.paymentTotal,300);
  assert.equal(total.orders,3);
});
