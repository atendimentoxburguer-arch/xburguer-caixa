create or replace function private.xb_enforce_financial_totals()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.total_sales := round(
    coalesce(new.cash_sales,0)
    + coalesce(new.delivery_cash_sales,0)
    + coalesce(new.store_card_sales,0)
    + coalesce(new.pix_app_sales,0)
    + coalesce(new.delivery_card_sales,0),
    2
  );
  new.total_expenses := round(coalesce(new.total_expenses,0),2);
  new.result := round(new.total_sales-new.total_expenses,2);
  return new;
end;
$$;

drop trigger if exists xb_enforce_financial_totals on public.cash_closings;
create trigger xb_enforce_financial_totals
before insert or update of cash_sales, delivery_cash_sales, store_card_sales, pix_app_sales, delivery_card_sales, total_expenses, total_sales, result
on public.cash_closings
for each row execute function private.xb_enforce_financial_totals();
