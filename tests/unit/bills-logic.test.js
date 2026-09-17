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

test('resumo conta pendências, atenção, atrasados e próximos 7 dias sem misturar pagos',()=>{
  const rows=[
    {status:'pending',due_date:'2026-09-12',amount:50},
    {status:'pending',due_date:'2026-09-13',amount:100},
    {status:'pending',due_date:'2026-09-16',amount:200},
    {status:'pending',due_date:'2026-09-20',amount:300},
    {status:'paid',due_date:'2026-09-12',amount:400,paid_amount:390}
  ];
  const summary=bills.summarize(rows,'2026-09-13');
  assert.equal(summary.pendingCount,4);
  assert.equal(summary.pendingAmount,650);
  assert.equal(summary.attentionCount,3);
  assert.equal(summary.attentionAmount,350);
  assert.equal(summary.overdueCount,1);
  assert.equal(summary.overdueAmount,50);
  assert.equal(summary.dueTodayCount,1);
  assert.equal(summary.next7Count,3);
  assert.equal(summary.next7Amount,600);
  assert.equal(summary.paidCount,1);
  assert.equal(summary.paidAmount,390);
});

test('valida fornecedor, valor e vencimento',()=>{
  assert.equal(bills.validateDraft({supplier:'',amount:10,due_date:'2026-09-20'}),'Informe o fornecedor.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:0,due_date:'2026-09-20'}),'Informe um valor maior que zero.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:10,due_date:''}),'Informe uma data de vencimento válida.');
  assert.equal(bills.validateDraft({supplier:'Energia',amount:10,due_date:'2026-09-20'}),true);
});

test('busca ignora acentos e procura fornecedor, descrição, código e observação',()=>{
  const row={supplier:'Águas do Cerrado',description:'Conta mensal',digitable_line:'12345 67890',notes:'Unidade Centro',amount:125.5,due_date:'2026-09-20'};
  assert.equal(bills.matchesSearch(row,'aguas'),true);
  assert.equal(bills.matchesSearch(row,'mensal'),true);
  assert.equal(bills.matchesSearch(row,'67890'),true);
  assert.equal(bills.matchesSearch(row,'centro'),true);
  assert.equal(bills.matchesSearch(row,'125,50'),true);
  assert.equal(bills.matchesSearch(row,'internet'),false);
});

test('filtra por situação, pesquisa e período de vencimento',()=>{
  const today='2026-09-13';
  const rows=[
    {supplier:'Energia',status:'pending',due_date:'2026-09-12',amount:90},
    {supplier:'Internet',status:'pending',due_date:'2026-09-13',amount:100},
    {supplier:'Água',status:'pending',due_date:'2026-09-18',amount:110},
    {supplier:'Aluguel',status:'pending',due_date:'2026-09-25',amount:120},
    {supplier:'Pago',status:'paid',due_date:'2026-09-14',amount:130},
    {supplier:'Cancelado',status:'cancelled',due_date:'2026-09-15',amount:140}
  ];
  assert.deepEqual(bills.filterBills(rows,{filter:'overdue'},today).map(x=>x.supplier),['Energia']);
  assert.deepEqual(bills.filterBills(rows,{filter:'today'},today).map(x=>x.supplier),['Internet']);
  assert.deepEqual(bills.filterBills(rows,{filter:'week'},today).map(x=>x.supplier),['Internet','Água']);
  assert.deepEqual(bills.filterBills(rows,{filter:'paid'},today).map(x=>x.supplier),['Pago']);
  assert.deepEqual(bills.filterBills(rows,{filter:'all',query:'agua'},today).map(x=>x.supplier),['Água']);
  assert.deepEqual(bills.filterBills(rows,{filter:'all',from:'2026-09-14',to:'2026-09-18'},today).map(x=>x.supplier),['Água','Pago','Cancelado']);
});

test('ordena por fornecedor, valor e vencimento',()=>{
  const rows=[
    {id:'1',supplier:'Zeta',status:'pending',due_date:'2026-09-20',amount:10},
    {id:'2',supplier:'Água',status:'pending',due_date:'2026-09-18',amount:50},
    {id:'3',supplier:'Beta',status:'pending',due_date:'2026-09-19',amount:30}
  ];
  assert.deepEqual(bills.sortBills(rows,'2026-09-13','supplier_asc').map(x=>x.supplier),['Água','Beta','Zeta']);
  assert.deepEqual(bills.sortBills(rows,'2026-09-13','amount_desc').map(x=>x.amount),[50,30,10]);
  assert.deepEqual(bills.sortBills(rows,'2026-09-13','due_asc').map(x=>x.id),['2','3','1']);
});

test('agrupa por urgência, mês e fornecedor com totais',()=>{
  const today='2026-09-13';
  const rows=[
    {supplier:'Energia',status:'pending',due_date:'2026-09-12',amount:90},
    {supplier:'Energia',status:'pending',due_date:'2026-09-13',amount:100},
    {supplier:'Internet',status:'pending',due_date:'2026-09-15',amount:110},
    {supplier:'Internet',status:'pending',due_date:'2026-10-20',amount:120}
  ];
  const due=bills.groupBills(rows,today,'due');
  assert.deepEqual(due.map(group=>group.label),['Atrasados','Hoje','Próximos 3 dias','Outubro de 2026']);
  const supplier=bills.groupBills(rows,today,'supplier');
  assert.equal(supplier[0].label,'Energia');
  assert.equal(supplier[0].count,2);
  assert.equal(supplier[0].total,190);
  assert.equal(supplier[1].label,'Internet');
  const month=bills.groupBills(rows,today,'month');
  assert.equal(month[0].label,'Setembro de 2026');
  assert.equal(month[0].count,3);
});

test('duplica vencimento mensal respeitando fim do mês',()=>{
  assert.equal(bills.addMonthsISO('2026-01-31',1),'2026-02-28');
  assert.equal(bills.addMonthsISO('2026-08-31',1),'2026-09-30');
  assert.equal(bills.addDaysISO('2026-09-13',7),'2026-09-20');
});
