create or replace function public.save_cash_closing(p_record jsonb)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_date date;
  v_register text := coalesce(nullif(btrim(p_record->>'register_name'),''),'Caixa Principal');
  v_shift text := coalesce(nullif(btrim(p_record->>'shift_name'),''),'Dia');
  v_status public.closing_status := coalesce(nullif(p_record->>'status',''),'closed')::public.closing_status;
  v_resp text := btrim(coalesce(p_record->>'resp',''));
  v_opening numeric := coalesce((p_record->>'opening')::numeric,0);
  v_cash numeric := coalesce((p_record->>'cash')::numeric,0);
  v_delivery_cash numeric := coalesce((p_record->>'deliveryCash')::numeric,0);
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
  v_ideal_start integer := coalesce((p_record#>>'{breads,idealStart}')::integer,0);
  v_ideal_legacy_prod integer := coalesce((p_record#>>'{breads,idealProd}')::integer,0);
  v_ideal_final integer;
  v_ideal_prod integer;
  v_gourmet_start integer := coalesce((p_record#>>'{breads,gourmetStart}')::integer,0);
  v_gourmet_legacy_prod integer := coalesce((p_record#>>'{breads,gourmetProd}')::integer,0);
  v_gourmet_final integer;
  v_gourmet_prod integer;
  v_anota_q integer := coalesce((p_record#>>'{online,anotaQtd}')::integer,0);
  v_anota_v numeric := coalesce((p_record#>>'{online,anotaVal}')::numeric,0);
  v_aiq_q integer := coalesce((p_record#>>'{online,aiqQtd}')::integer,0);
  v_aiq_v numeric := coalesce((p_record#>>'{online,aiqVal}')::numeric,0);
  ch jsonb;
  ex jsonb;
begin
  if auth.uid() is null or not private.is_active_user() then
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

  if v_date is null then raise exception 'business date is required'; end if;
  if v_resp = '' then raise exception 'responsible name is required'; end if;
  if least(v_opening,v_cash,v_delivery_cash,v_store_card,v_pix_app,v_delivery_card,v_cash_out,v_counted) < 0 then
    raise exception 'financial values cannot be negative';
  end if;

  if nullif(p_record#>>'{breads,idealFinal}','') is not null then
    v_ideal_final := (p_record#>>'{breads,idealFinal}')::integer;
  else
    v_ideal_final := v_ideal_start - v_ideal_legacy_prod;
  end if;
  if nullif(p_record#>>'{breads,gourmetFinal}','') is not null then
    v_gourmet_final := (p_record#>>'{breads,gourmetFinal}')::integer;
  else
    v_gourmet_final := v_gourmet_start - v_gourmet_legacy_prod;
  end if;

  if least(v_ideal_start,v_ideal_final,v_gourmet_start,v_gourmet_final) < 0 then
    raise exception 'bread stock quantities cannot be negative';
  end if;
  if v_ideal_final > v_ideal_start then raise exception 'Pão Ideal closing stock cannot exceed opening stock'; end if;
  if v_gourmet_final > v_gourmet_start then raise exception 'Pão Gourmet closing stock cannot exceed opening stock'; end if;

  v_ideal_prod := v_ideal_start - v_ideal_final;
  v_gourmet_prod := v_gourmet_start - v_gourmet_final;

  if least(v_anota_q,v_aiq_q) < 0 or least(v_anota_v,v_aiq_v) < 0 then
    raise exception 'online order values cannot be negative';
  end if;

  for ch in select value from jsonb_array_elements(coalesce(p_record->'channels','[]'::jsonb)) loop
    if coalesce((ch->>'q')::integer,0) < 0 or coalesce((ch->>'v')::numeric,0) < 0 then
      raise exception 'channel values cannot be negative';
    end if;
    v_sales := v_sales + coalesce((ch->>'v')::numeric,0);
  end loop;

  for ex in select value from jsonb_array_elements(coalesce(p_record->'expenses','[]'::jsonb)) loop
    if coalesce((ex->>'val')::numeric,0) < 0 then raise exception 'expense values cannot be negative'; end if;
    if coalesce((ex->>'val')::numeric,0) > 0 and btrim(coalesce(ex->>'d','')) = '' then
      raise exception 'expense description is required';
    end if;
    v_expenses := v_expenses + coalesce((ex->>'val')::numeric,0);
  end loop;

  v_expected := v_cash + v_delivery_cash - v_cash_out;
  if v_cash_verified then
    v_cash_diff := v_counted - v_expected;
  else
    v_counted := 0;
    v_cash_diff := 0;
  end if;
  v_result := v_sales - v_expenses;

  perform set_config('xburguer.save_rpc','on',true);

  select id into v_id
  from public.cash_closings
  where business_date = v_date and register_name = v_register and shift_name = v_shift
  limit 1;

  if v_id is null then
    insert into public.cash_closings (
      business_date, register_name, shift_name, responsible_name, status,
      opening_balance, cash_sales, delivery_cash_sales, store_card_sales, pix_app_sales, delivery_card_sales,
      cash_withdrawn_for_expenses, counted_cash, expected_cash, cash_difference, cash_count_verified,
      total_sales, total_expenses, result, observations, created_by, updated_by
    ) values (
      v_date, v_register, v_shift, v_resp, v_status,
      v_opening, v_cash, v_delivery_cash, v_store_card, v_pix_app, v_delivery_card,
      v_cash_out, v_counted, v_expected, v_cash_diff, v_cash_verified,
      v_sales, v_expenses, v_result, nullif(p_record->>'obs',''), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.cash_closings set
      responsible_name = v_resp,
      status = v_status,
      opening_balance = v_opening,
      cash_sales = v_cash,
      delivery_cash_sales = v_delivery_cash,
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
  for ch in select value from jsonb_array_elements(coalesce(p_record->'channels','[]'::jsonb)) loop
    insert into public.channel_sales (closing_id, channel_name, order_count, amount)
    values (v_id,coalesce(nullif(btrim(ch->>'name'),''),'Canal'),coalesce((ch->>'q')::integer,0),coalesce((ch->>'v')::numeric,0));
  end loop;

  delete from public.bread_controls where closing_id = v_id;
  insert into public.bread_controls (closing_id, bread_type, opening_stock, production, out_qty, closing_stock)
  values
    (v_id,'Pão Ideal',v_ideal_start,v_ideal_prod,0,v_ideal_final),
    (v_id,'Pão Gourmet',v_gourmet_start,v_gourmet_prod,0,v_gourmet_final);

  delete from public.online_orders where closing_id = v_id;
  insert into public.online_orders (closing_id, platform, order_count, amount)
  values
    (v_id,'Anota Aí',v_anota_q,v_anota_v),
    (v_id,'Aiqfome',v_aiq_q,v_aiq_v);

  delete from public.expenses where closing_id = v_id;
  for ex in select value from jsonb_array_elements(coalesce(p_record->'expenses','[]'::jsonb)) loop
    if btrim(coalesce(ex->>'d','')) <> '' or coalesce((ex->>'val')::numeric,0) <> 0 then
      insert into public.expenses (closing_id, description, amount)
      values (v_id,btrim(coalesce(ex->>'d','')),coalesce((ex->>'val')::numeric,0));
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.save_cash_closing(jsonb) from public;
revoke all on function public.save_cash_closing(jsonb) from anon;
grant execute on function public.save_cash_closing(jsonb) to authenticated;

create or replace function public.delete_cash_closing(p_id uuid)
returns boolean
language plpgsql
set search_path to 'public','private'
as $$
declare v_deleted uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.is_admin() then raise exception 'permission denied'; end if;
  if p_id is null then raise exception 'closing id is required'; end if;
  perform set_config('xburguer.delete_rpc','on',true);
  perform set_config('xburguer.save_rpc','on',true);
  delete from public.cash_closings where id=p_id returning id into v_deleted;
  if v_deleted is null then raise exception 'closing not found'; end if;
  return true;
end;
$$;

create or replace function public.create_cash_snapshot()
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_payload jsonb;
  v_count integer;
  v_checksum text;
begin
  if auth.uid() is null or not private.is_active_user() then raise exception 'authentication required'; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cash_closing',to_jsonb(c),
      'channel_sales',coalesce((select jsonb_agg(to_jsonb(x) order by x.channel_name) from public.channel_sales x where x.closing_id=c.id),'[]'::jsonb),
      'bread_controls',coalesce((select jsonb_agg(to_jsonb(x) order by x.bread_type) from public.bread_controls x where x.closing_id=c.id),'[]'::jsonb),
      'online_orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.platform) from public.online_orders x where x.closing_id=c.id),'[]'::jsonb),
      'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.expenses x where x.closing_id=c.id),'[]'::jsonb)
    ) order by c.business_date,c.register_name,c.shift_name
  ),'[]'::jsonb) into v_payload from public.cash_closings c;
  v_count := jsonb_array_length(v_payload);
  v_checksum := encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  perform set_config('xburguer.snapshot_rpc','on',true);
  insert into public.cash_backup_snapshots(snapshot_day,created_at,created_by,record_count,payload,checksum_sha256)
  values(current_date,now(),auth.uid(),v_count,v_payload,v_checksum)
  on conflict(snapshot_day) do update set
    created_at=excluded.created_at,created_by=excluded.created_by,record_count=excluded.record_count,payload=excluded.payload,checksum_sha256=excluded.checksum_sha256
  returning id into v_id;
  delete from public.cash_backup_snapshots where snapshot_day < current_date-30;
  return v_id;
end;
$$;

-- Fechamentos: leitura continua direta; gravação só pelo RPC oficial.
drop policy if exists closings_insert on public.cash_closings;
create policy closings_insert on public.cash_closings for insert to authenticated
with check ((select private.is_active_user()) and created_by=(select auth.uid()) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

drop policy if exists closings_update on public.cash_closings;
create policy closings_update on public.cash_closings for update to authenticated
using ((select private.is_active_user()) and ((status <> 'reviewed'::public.closing_status) or private.can_manage()) and coalesce(current_setting('xburguer.save_rpc',true),'')='on')
with check ((select private.is_active_user()) and ((status <> 'reviewed'::public.closing_status) or private.can_manage()) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

-- Filhos do fechamento: somente a transação de save_cash_closing pode gravar.
drop policy if exists channel_sales_insert on public.channel_sales;
create policy channel_sales_insert on public.channel_sales for insert to authenticated with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists channel_sales_update on public.channel_sales;
create policy channel_sales_update on public.channel_sales for update to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on') with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists channel_sales_delete on public.channel_sales;
create policy channel_sales_delete on public.channel_sales for delete to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

drop policy if exists bread_controls_insert on public.bread_controls;
create policy bread_controls_insert on public.bread_controls for insert to authenticated with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists bread_controls_update on public.bread_controls;
create policy bread_controls_update on public.bread_controls for update to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on') with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists bread_controls_delete on public.bread_controls;
create policy bread_controls_delete on public.bread_controls for delete to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

drop policy if exists online_orders_insert on public.online_orders;
create policy online_orders_insert on public.online_orders for insert to authenticated with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists online_orders_update on public.online_orders;
create policy online_orders_update on public.online_orders for update to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on') with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists online_orders_delete on public.online_orders;
create policy online_orders_delete on public.online_orders for delete to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on') with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce(current_setting('xburguer.save_rpc',true),'')='on');

-- Snapshots: somente create_cash_snapshot pode alterá-los.
drop policy if exists cash_backup_snapshots_insert on public.cash_backup_snapshots;
create policy cash_backup_snapshots_insert on public.cash_backup_snapshots for insert to authenticated with check ((select private.is_active_user()) and created_by=(select auth.uid()) and snapshot_day=current_date and coalesce(current_setting('xburguer.snapshot_rpc',true),'')='on');
drop policy if exists cash_backup_snapshots_update on public.cash_backup_snapshots;
create policy cash_backup_snapshots_update on public.cash_backup_snapshots for update to authenticated using ((select private.is_active_user()) and snapshot_day=current_date and coalesce(current_setting('xburguer.snapshot_rpc',true),'')='on') with check ((select private.is_active_user()) and created_by=(select auth.uid()) and snapshot_day=current_date and coalesce(current_setting('xburguer.snapshot_rpc',true),'')='on');
drop policy if exists cash_backup_snapshots_delete on public.cash_backup_snapshots;
create policy cash_backup_snapshots_delete on public.cash_backup_snapshots for delete to authenticated using ((select private.is_active_user()) and snapshot_day < current_date-30 and coalesce(current_setting('xburguer.snapshot_rpc',true),'')='on');
