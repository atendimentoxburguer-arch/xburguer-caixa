update public.cash_closings c
set
  expected_cash = c.cash_sales - c.cash_withdrawn_for_expenses,
  cash_difference = c.counted_cash - (c.cash_sales - c.cash_withdrawn_for_expenses),
  total_sales = coalesce((select sum(cs.amount) from public.channel_sales cs where cs.closing_id=c.id),0),
  total_expenses = coalesce((select sum(e.amount) from public.expenses e where e.closing_id=c.id),0),
  result = coalesce((select sum(cs.amount) from public.channel_sales cs where cs.closing_id=c.id),0)
         - coalesce((select sum(e.amount) from public.expenses e where e.closing_id=c.id),0),
  updated_at = now();
