alter table public.cash_closings
  add column if not exists cash_count_verified boolean not null default false;

update public.cash_closings
set cash_count_verified = true
where counted_cash <> 0;

update public.cash_closings
set cash_difference = 0
where cash_count_verified = false;

create or replace function public.save_cash_closing(p_record jsonb)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_date date;
  v_register text := coalesce(nullif(btrim(p_record->>'register_name'),''),'Caixa Principal');
  v_shift text := coalesce(nullif(btrim(p_record->>'shift_name'),''),'Dia');
  v_status public.closing_status := coalesce(nullif(p_record->>'status',''),'closed')::public.closing_status;
  v_resp text := btrim(coalesce(p_record->>'resp',''));
  v_opening numeric := coalesce((p_record->>'opening')::numeric,0);
  v_cash numeric := coalesce((p_record->>'cash')::numeric,0);
  v_store_card numeric := coalesce((p_record->>'cardOut')::numeric,0);
  v_pix_app numeric := coalesce((p_record->>'onlinePayment')::numeric,0);
  v_delivery_card numeric := coalesce((p_record->>'deliveryCard')::numeric,0);
  v_cash_out numeric := coalesce((p_record->>'cashOut')::numeric,0);
  v_cash_verified boolean := coalesce((p_record->>'cashCountVerified')::boolean,false);
  v_counted numeric := coalesce((p_record->>'countedCash')::numeric,0);
  v_expected numeric;
  v_cash_diff numeric;
  v_sales numeric := 0;
  v_expenses numeric := 0;
  v_result numeric := 0;
  ch jsonb;
  ex jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'invalid closing payload';
  end if;

  begin
    v_date := nullif(p_record->>'date','')::date;
  exception when others then
    raise exception 'invalid business date';
  end;

  if v_date is null then
    raise exception 'business date is required';
  end if;
  if v_resp = '' then
    raise exception 'responsible name is required';
  end if;

  if least(v_opening,v_cash,v_store_card,v_pix_app,v_delivery_card,v_cash_out,v_counted) < 0 then
    raise exception 'financial values cannot be negative';
  end if;

  for ch in select value from jsonb_array_elements(coalesce(p_record->'channels','[]'::jsonb))
  loop
    if coalesce((ch->>'q')::integer,0) < 0 or coalesce((ch->>'v')::numeric,0) < 0 then
      raise exception 'channel values cannot be negative';
    end if;
    v_sales := v_sales + coalesce((ch->>'v')::numeric,0);
  end loop;

  for ex in select value from jsonb_array_elements(coalesce(p_record->'expenses','[]'::jsonb))
  loop
    if coalesce((ex->>'val')::numeric,0) < 0 then
      raise exception 'expense values cannot be negative';
    end if;
    if coalesce((ex->>'val')::numeric,0) > 0 and btrim(coalesce(ex->>'d','')) = '' then
      raise exception 'expense description is required';
    end if;
    v_expenses := v_expenses + coalesce((ex->>'val')::numeric,0);
  end loop;

  v_expected := v_cash - v_cash_out;
  if v_cash_verified then
    v_cash_diff := v_counted - v_expected;
  else
    v_counted := 0;
    v_cash_diff := 0;
  end if;
  v_result := v_sales - v_expenses;

  select id into v_id
  from public.cash_closings
  where business_date = v_date and register_name = v_register and shift_name = v_shift
  limit 1;

  if v_id is null then
    insert into public.cash_closings (
      business_date, register_name, shift_name, responsible_name, status,
      opening_balance, cash_sales, store_card_sales, pix_app_sales, delivery_card_sales,
      cash_withdrawn_for_expenses, counted_cash, expected_cash, cash_difference, cash_count_verified,
      total_sales, total_expenses, result, observations, created_by, updated_by
    ) values (
      v_date, v_register, v_shift, v_resp, v_status,
      v_opening, v_cash, v_store_card, v_pix_app, v_delivery_card,
      v_cash_out, v_counted, v_expected, v_cash_diff, v_cash_verified,
      v_sales, v_expenses, v_result, nullif(p_record->>'obs',''), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.cash_closings set
      responsible_name = v_resp,
      status = v_status,
      opening_balance = v_opening,
      cash_sales = v_cash,
      store_card_sales = v_store_card,
      pix_app_sales = v_pix_app,
      delivery_card_sales = v_delivery_card,
      cash_withdrawn_for_expenses = v_cash_out,
      counted_cash = v_counted,
      expected_cash = v_expected,
      cash_difference = v_cash_diff,
      cash_count_verified = v_cash_verified,
      total_sales = v_sales,
      total_expenses = v_expenses,
      result = v_result,
      observations = nullif(p_record->>'obs',''),
      updated_by = auth.uid()
    where id = v_id;
  end if;

  delete from public.channel_sales where closing_id = v_id;
  for ch in select value from jsonb_array_elements(coalesce(p_record->'channels','[]'::jsonb))
  loop
    insert into public.channel_sales (closing_id, channel_name, order_count, amount)
    values (
      v_id,
      coalesce(nullif(btrim(ch->>'name'),''),'Canal'),
      coalesce((ch->>'q')::integer,0),
      coalesce((ch->>'v')::numeric,0)
    );
  end loop;

  delete from public.bread_controls where closing_id = v_id;
  insert into public.bread_controls (closing_id, bread_type, opening_stock, production, out_qty, closing_stock)
  values
    (v_id,'Pão Ideal',
      coalesce((p_record#>>'{breads,idealStart}')::integer,0),
      coalesce((p_record#>>'{breads,idealProd}')::integer,0),
      coalesce((p_record#>>'{breads,idealOut}')::integer,0),
      coalesce((p_record#>>'{breads,idealFinal}')::integer,0)),
    (v_id,'Pão Gourmet',
      coalesce((p_record#>>'{breads,gourmetStart}')::integer,0),
      coalesce((p_record#>>'{breads,gourmetProd}')::integer,0),
      coalesce((p_record#>>'{breads,gourmetOut}')::integer,0),
      coalesce((p_record#>>'{breads,gourmetFinal}')::integer,0));

  delete from public.online_orders where closing_id = v_id;
  insert into public.online_orders (closing_id, platform, order_count, amount)
  values
    (v_id,'Anota Aí',
      coalesce((p_record#>>'{online,anotaQtd}')::integer,0),
      coalesce((p_record#>>'{online,anotaVal}')::numeric,0)),
    (v_id,'Aiqfome',
      coalesce((p_record#>>'{online,aiqQtd}')::integer,0),
      coalesce((p_record#>>'{online,aiqVal}')::numeric,0));

  delete from public.expenses where closing_id = v_id;
  for ex in select value from jsonb_array_elements(coalesce(p_record->'expenses','[]'::jsonb))
  loop
    if btrim(coalesce(ex->>'d','')) <> '' or coalesce((ex->>'val')::numeric,0) <> 0 then
      insert into public.expenses (closing_id, description, amount)
      values (v_id, btrim(coalesce(ex->>'d','')), coalesce((ex->>'val')::numeric,0));
    end if;
  end loop;

  return v_id;
end;
$function$;
