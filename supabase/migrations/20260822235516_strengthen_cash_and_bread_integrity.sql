alter table public.cash_closings
  drop constraint if exists cash_closings_nonnegative_values;

alter table public.cash_closings
  add constraint cash_closings_nonnegative_values check (
    opening_balance >= 0 and
    cash_sales >= 0 and
    delivery_cash_sales >= 0 and
    store_card_sales >= 0 and
    pix_app_sales >= 0 and
    delivery_card_sales >= 0 and
    cash_withdrawn_for_expenses >= 0 and
    counted_cash >= 0 and
    total_sales >= 0 and
    total_expenses >= 0
  );

alter table public.bread_controls
  drop constraint if exists bread_controls_stock_consistency;

alter table public.bread_controls
  add constraint bread_controls_stock_consistency check (
    closing_stock <= opening_stock and
    production = opening_stock - closing_stock and
    out_qty = 0
  );
