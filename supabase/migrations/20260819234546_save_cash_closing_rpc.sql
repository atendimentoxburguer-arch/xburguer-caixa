create or replace function public.save_cash_closing(p_record jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_date date := (p_record->>'date')::date;
  v_register text := coalesce(nullif(p_record->>'register_name',''),'Caixa Principal');
  v_shift text := coalesce(nullif(p_record->>'shift_name',''),'Dia');
  v_status public.closing_status := coalesce(nullif(p_record->>'status',''),'closed')::public.closing_status;
  ch jsonb;
  ex jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select id into v_id
  from public.cash_closings
  where business_date = v_date and register_name = v_register and shift_name = v_shift
  limit 1;

  if v_id is null then
    insert into public.cash_closings (
      business_date, register_name, shift_name, responsible_name, status,
      opening_balance, cash_sales, store_card_sales, pix_app_sales, delivery_card_sales,
      cash_withdrawn_for_expenses, counted_cash, expected_cash, cash_difference,
      total_sales, total_expenses, result, observations, created_by, updated_by
    ) values (
      v_date, v_register, v_shift, coalesce(p_record->>'resp',''), v_status,
      coalesce((p_record->>'opening')::numeric,0),
      coalesce((p_record->>'cash')::numeric,0),
      coalesce((p_record->>'cardOut')::numeric,0),
      coalesce((p_record->>'onlinePayment')::numeric,0),
      coalesce((p_record->>'deliveryCard')::numeric,0),
      coalesce((p_record->>'cashOut')::numeric,0),
      coalesce((p_record->>'countedCash')::numeric,0),
      coalesce((p_record->>'expectedCash')::numeric,0),
      coalesce((p_record->>'cashDifference')::numeric,0),
      coalesce((p_record->>'sales')::numeric,0),
      coalesce((p_record->>'expense')::numeric,0),
      coalesce((p_record->>'result')::numeric,0),
      nullif(p_record->>'obs',''), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.cash_closings set
      responsible_name = coalesce(p_record->>'resp',''),
      status = v_status,
      opening_balance = coalesce((p_record->>'opening')::numeric,0),
      cash_sales = coalesce((p_record->>'cash')::numeric,0),
      store_card_sales = coalesce((p_record->>'cardOut')::numeric,0),
      pix_app_sales = coalesce((p_record->>'onlinePayment')::numeric,0),
      delivery_card_sales = coalesce((p_record->>'deliveryCard')::numeric,0),
      cash_withdrawn_for_expenses = coalesce((p_record->>'cashOut')::numeric,0),
      counted_cash = coalesce((p_record->>'countedCash')::numeric,0),
      expected_cash = coalesce((p_record->>'expectedCash')::numeric,0),
      cash_difference = coalesce((p_record->>'cashDifference')::numeric,0),
      total_sales = coalesce((p_record->>'sales')::numeric,0),
      total_expenses = coalesce((p_record->>'expense')::numeric,0),
      result = coalesce((p_record->>'result')::numeric,0),
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
      coalesce(ch->>'name','Canal'),
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
    if coalesce(ex->>'d','') <> '' or coalesce((ex->>'val')::numeric,0) <> 0 then
      insert into public.expenses (closing_id, description, amount)
      values (v_id, coalesce(ex->>'d',''), coalesce((ex->>'val')::numeric,0));
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.save_cash_closing(jsonb) from public, anon;
grant execute on function public.save_cash_closing(jsonb) to authenticated;
