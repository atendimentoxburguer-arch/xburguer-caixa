create or replace function private.xb_expected_opening_balance(
  p_business_date date,
  p_register_name text,
  p_shift_name text
)
returns numeric
language sql
stable
set search_path = public, private
as $$
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
  where c.business_date = p_business_date - 1
    and c.register_name = p_register_name
    and c.shift_name = p_shift_name
  limit 1
$$;

create or replace function private.xb_enforce_automatic_opening_balance()
returns trigger
language plpgsql
set search_path = public, private
as $$
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

  if v_opening is null then
    raise exception 'Salve primeiro o fechamento do dia anterior para calcular o Saldo Inicial automaticamente.';
  end if;

  new.opening_balance := v_opening;
  return new;
end;
$$;

drop trigger if exists xb_enforce_automatic_opening_balance on public.cash_closings;
create trigger xb_enforce_automatic_opening_balance
before insert or update on public.cash_closings
for each row
execute function private.xb_enforce_automatic_opening_balance();

create or replace function private.xb_cascade_next_opening_balance()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_next_date date := new.business_date + 1;
  v_opening numeric;
begin
  if v_next_date < date '2026-08-24'
     or extract(day from v_next_date)::integer = 1 then
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
$$;

drop trigger if exists xb_cascade_next_opening_balance on public.cash_closings;
create trigger xb_cascade_next_opening_balance
after insert or update of opening_balance, cash_sales, delivery_cash_sales, cash_withdrawn_for_expenses
on public.cash_closings
for each row
execute function private.xb_cascade_next_opening_balance();

create or replace function private.xb_guard_opening_chain_delete()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if exists (
    select 1
    from public.cash_closings c
    where c.business_date = old.business_date + 1
      and c.register_name = old.register_name
      and c.shift_name = old.shift_name
      and c.business_date >= date '2026-08-24'
      and extract(day from c.business_date)::integer <> 1
  ) then
    raise exception 'Não é possível excluir este fechamento enquanto existir o fechamento do dia seguinte, pois o Saldo Inicial depende dele.';
  end if;

  return old;
end;
$$;

drop trigger if exists opening_chain_guard_delete on public.cash_closings;
create trigger opening_chain_guard_delete
before delete on public.cash_closings
for each row
execute function private.xb_guard_opening_chain_delete();

create or replace function public.restore_cash_backup(p_records jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  rec jsonb;
  restored integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'backup payload must be an array';
  end if;
  if jsonb_array_length(p_records) > 10000 then
    raise exception 'backup contains too many records';
  end if;

  for rec in
    select value
    from jsonb_array_elements(p_records)
    order by value->>'date',
             coalesce(value->>'register_name',''),
             coalesce(value->>'shift_name','')
  loop
    perform public.save_cash_closing(rec);
    restored := restored + 1;
  end loop;

  return restored;
end;
$$;
