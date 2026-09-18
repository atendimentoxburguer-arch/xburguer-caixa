create or replace function private.xb_expected_opening_balance(
  p_business_date date,
  p_register_name text,
  p_shift_name text
)
returns numeric
language sql
stable
set search_path to 'public','private'
as $function$
  select greatest(
    0::numeric,
    round(
      c.opening_balance
      + c.cash_sales
      + c.delivery_cash_sales
      - c.cash_withdrawn_for_expenses,
      2
    )
  )
  from public.cash_closings c
  where c.business_date >= date_trunc('month', p_business_date)::date
    and c.business_date < p_business_date
    and c.register_name = p_register_name
    and c.shift_name = p_shift_name
  order by c.business_date desc
  limit 1
$function$;

create or replace function private.xb_enforce_automatic_opening_balance()
returns trigger
language plpgsql
set search_path to 'public','private'
as $function$
declare
  v_opening numeric;
begin
  if new.business_date < date '2026-08-24'
     or extract(day from new.business_date)::integer = 1 then
    return new;
  end if;

  v_opening := private.xb_expected_opening_balance(
    new.business_date,
    new.register_name,
    new.shift_name
  );

  -- Se este for o primeiro fechamento salvo do mês, não há base anterior:
  -- o Saldo Inicial permanece manual.
  if v_opening is null then
    return new;
  end if;

  new.opening_balance := v_opening;
  return new;
end;
$function$;

create or replace function private.xb_cascade_next_opening_balance()
returns trigger
language plpgsql
set search_path to 'public','private'
as $function$
declare
  v_next_date date;
  v_opening numeric;
begin
  if new.business_date < date '2026-08-24' then
    return null;
  end if;

  select min(c.business_date)
    into v_next_date
  from public.cash_closings c
  where c.business_date > new.business_date
    and c.business_date < (date_trunc('month', new.business_date) + interval '1 month')::date
    and c.register_name = new.register_name
    and c.shift_name = new.shift_name;

  if v_next_date is null then
    return null;
  end if;

  v_opening := greatest(
    0::numeric,
    round(
      new.opening_balance
      + new.cash_sales
      + new.delivery_cash_sales
      - new.cash_withdrawn_for_expenses,
      2
    )
  );

  update public.cash_closings
  set opening_balance = v_opening,
      updated_by = coalesce(auth.uid(), updated_by)
  where business_date = v_next_date
    and register_name = new.register_name
    and shift_name = new.shift_name
    and opening_balance is distinct from v_opening;

  return null;
end;
$function$;

create or replace function private.xb_repair_opening_after_delete()
returns trigger
language plpgsql
set search_path to 'public','private'
as $function$
declare
  v_next_date date;
  v_opening numeric;
begin
  select min(c.business_date)
    into v_next_date
  from public.cash_closings c
  where c.business_date > old.business_date
    and c.business_date < (date_trunc('month', old.business_date) + interval '1 month')::date
    and c.register_name = old.register_name
    and c.shift_name = old.shift_name;

  if v_next_date is null then
    return null;
  end if;

  v_opening := private.xb_expected_opening_balance(
    v_next_date,
    old.register_name,
    old.shift_name
  );

  -- Se o fechamento removido era a única base anterior do mês,
  -- o próximo registro passa a ser o primeiro disponível e mantém seu saldo manual.
  if v_opening is null then
    return null;
  end if;

  update public.cash_closings
  set opening_balance = v_opening,
      updated_by = coalesce(auth.uid(), updated_by)
  where business_date = v_next_date
    and register_name = old.register_name
    and shift_name = old.shift_name
    and opening_balance is distinct from v_opening;

  return null;
end;
$function$;

drop trigger if exists opening_chain_guard_delete on public.cash_closings;
drop trigger if exists xb_repair_opening_after_delete on public.cash_closings;
create trigger xb_repair_opening_after_delete
after delete on public.cash_closings
for each row execute function private.xb_repair_opening_after_delete();

revoke all on function private.xb_repair_opening_after_delete() from public;
revoke all on function private.xb_repair_opening_after_delete() from anon;
revoke all on function private.xb_repair_opening_after_delete() from authenticated;
