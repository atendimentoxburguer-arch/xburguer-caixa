create or replace function private.xb_enforce_automatic_opening_balance()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_opening numeric;
begin
  if new.business_date >= date '2026-08-24'
     and extract(day from new.business_date)::integer <> 1 then
    v_opening := private.xb_expected_opening_balance(
      new.business_date,
      new.register_name,
      new.shift_name
    );

    -- Se houver um fechamento anterior salvo no mesmo mês, o saldo inicial
    -- é sempre derivado dele. Caso contrário permanece manual.
    if v_opening is not null then
      new.opening_balance := v_opening;
    end if;
  end if;

  -- Campos derivados da gaveta são sempre recalculados junto com o saldo inicial.
  new.expected_cash := round(
    new.opening_balance
    + new.cash_sales
    + new.delivery_cash_sales
    - new.cash_withdrawn_for_expenses,
    2
  );

  if coalesce(new.cash_count_verified, false) then
    new.cash_difference := round(new.counted_cash - new.expected_cash, 2);
  else
    new.counted_cash := 0;
    new.cash_difference := 0;
  end if;

  return new;
end;
$function$;

create or replace function private.xb_cascade_next_opening_balance()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
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
      expected_cash = round(v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses, 2),
      cash_difference = case
        when cash_count_verified then round(counted_cash - (v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses), 2)
        else 0
      end,
      updated_by = coalesce(auth.uid(), updated_by)
  where business_date = v_next_date
    and register_name = new.register_name
    and shift_name = new.shift_name
    and (
      opening_balance is distinct from v_opening
      or expected_cash is distinct from round(v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses, 2)
      or cash_difference is distinct from case
        when cash_count_verified then round(counted_cash - (v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses), 2)
        else 0
      end
    );

  return null;
end;
$function$;

create or replace function private.xb_repair_opening_after_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
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

  -- Se não houver mais base anterior no mês, o próximo registro passa a ser
  -- o primeiro disponível e preserva o saldo inicial manual já informado.
  if v_opening is null then
    return null;
  end if;

  update public.cash_closings
  set opening_balance = v_opening,
      expected_cash = round(v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses, 2),
      cash_difference = case
        when cash_count_verified then round(counted_cash - (v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses), 2)
        else 0
      end,
      updated_by = coalesce(auth.uid(), updated_by)
  where business_date = v_next_date
    and register_name = old.register_name
    and shift_name = old.shift_name
    and (
      opening_balance is distinct from v_opening
      or expected_cash is distinct from round(v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses, 2)
      or cash_difference is distinct from case
        when cash_count_verified then round(counted_cash - (v_opening + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses), 2)
        else 0
      end
    );

  return null;
end;
$function$;

-- Reafirma todos os campos derivados existentes com a regra canônica.
update public.cash_closings
set expected_cash = round(opening_balance + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses, 2),
    counted_cash = case when cash_count_verified then counted_cash else 0 end,
    cash_difference = case
      when cash_count_verified then round(counted_cash - (opening_balance + cash_sales + delivery_cash_sales - cash_withdrawn_for_expenses), 2)
      else 0
    end;
