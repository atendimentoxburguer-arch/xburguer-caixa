const test=require('node:test');
const assert=require('node:assert/strict');
const bills=require('../../bills-logic.js');

test('calcula corretamente os avisos de 3, 2, 1 e 0 dias',()=>{
  const today='2026-09-13';
  assert.equal(bills.stateForBill({status:'pending',due_date:'2026-09-16'},today).key,'d3');
  assert.equal(bills.stateForBill({status:'pending',due_date:'2026-09-15'},today).key,'d2');
  assert.equal(bills.stateForBill({status:'pending',due_date:'2026-09-14'},today).key,'d1');
  assert.equal(bills.stateForBill({status:'pending',due_date:'2026-09-13'},today).key,'today');
  assert.equal(bills.stateForBill({status:'pending',due_date:'2026-09-12'},today).key,'overdue');
});

test('boleto pago não volta para a fila de vencimento',()=>{
  const state=bills.stateForBill({status:'paid',due_date:'2026-09-13'},'2026-09-13');
  assert.equal(state.key,'paid');
  assert.equal(state.days,null);
});

test('resumo conta pendências e atenção sem misturar pagos',()=>{
  const rows=[
    {status:'pending',due_date:'2026-09-13',amount:100},
    {status:'pending',due_date:'2026-09-16',amount:200},
    {status:'pending',due_date:'2026-09-20',amount:300},
    {status:'paid',due_date:'2026-09-12',amount:400}
  ];
  const summary=bills.summarize(rows,'2026-09-13');
  assert.equal(summary.pendingCount,3);
  assert.equal(summary.pendingAmount,600);
  assert.equal(summary.attentionCount,2);
  assert.equal(summary.dueTodayCount,1);
  assert.equal(summary.paidCount,1);
});

test('valida fornecedor, valor e vencimento',()=>{
  assert.equal(bills.validateDraft({supplier:'',amount:10,due_date:'2026-09-20'}),'Informe o fornecedor.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:0,due_date:'2026-09-20'}),'Informe um valor maior que zero.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:10,due_date:''}),'Informe uma data de vencimento válida.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:10,due_date:'2026-09-20'}),true);
});
