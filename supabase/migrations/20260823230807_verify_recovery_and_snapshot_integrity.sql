create or replace function public.restore_deleted_cash_closing(p_recovery_id uuid)
returns uuid
language plpgsql
set search_path to 'public','private'
as $$
declare
  v_payload jsonb;
  v_checksum text;
  v_actual_checksum text;
  v_closing jsonb;
  v_record jsonb;
  v_result uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.can_manage() then
    raise exception 'permission denied';
  end if;

  select payload, checksum_sha256
  into v_payload, v_checksum
  from public.deleted_closing_recovery
  where id = p_recovery_id;

  if v_payload is null then
    raise exception 'recovery record not found';
  end if;

  v_actual_checksum := encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  if v_checksum is null or v_checksum !~ '^[0-9a-f]{64}$' or v_checksum <> v_actual_checksum then
    raise exception 'recovery checksum mismatch';
  end if;

  v_closing := v_payload->'closing';
  if v_closing is null or jsonb_typeof(v_closing) <> 'object' then
    raise exception 'invalid recovery payload';
  end if;

  v_record := jsonb_build_object(
    'date', v_closing->>'business_date',
    'resp', v_closing->>'responsible_name',
    'status', coalesce(v_closing->>'status','closed'),
    'opening', coalesce((v_closing->>'opening_balance')::numeric,0),
    'cash', coalesce((v_closing->>'cash_sales')::numeric,0),
    'deliveryCash', coalesce((v_closing->>'delivery_cash_sales')::numeric,0),
    'cardOut', coalesce((v_closing->>'store_card_sales')::numeric,0),
    'onlinePayment', coalesce((v_closing->>'pix_app_sales')::numeric,0),
    'deliveryCard', coalesce((v_closing->>'delivery_card_sales')::numeric,0),
    'cashOut', coalesce((v_closing->>'cash_withdrawn_for_expenses')::numeric,0),
    'cashCountVerified', coalesce((v_closing->>'cash_count_verified')::boolean,false),
    'countedCash', coalesce((v_closing->>'counted_cash')::numeric,0),
    'obs', v_closing->>'observations',
    'channels', coalesce((select jsonb_agg(jsonb_build_object('name',x->>'channel_name','q',coalesce((x->>'order_count')::integer,0),'v',coalesce((x->>'amount')::numeric,0))) from jsonb_array_elements(coalesce(v_payload->'channel_sales','[]'::jsonb)) x),'[]'::jsonb),
    'online', jsonb_build_object(
      'anotaQtd', coalesce((select (x->>'order_count')::integer from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Anota Aí' limit 1),0),
      'anotaVal', coalesce((select (x->>'amount')::numeric from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Anota Aí' limit 1),0),
      'aiqQtd', coalesce((select (x->>'order_count')::integer from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Aiqfome' limit 1),0),
      'aiqVal', coalesce((select (x->>'amount')::numeric from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Aiqfome' limit 1),0)
    ),
    'breads', jsonb_build_object(
      'idealStart', coalesce((select (x->>'opening_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Ideal' limit 1),0),
      'idealFinal', coalesce((select (x->>'closing_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Ideal' limit 1),0),
      'gourmetStart', coalesce((select (x->>'opening_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Gourmet' limit 1),0),
      'gourmetFinal', coalesce((select (x->>'closing_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Gourmet' limit 1),0)
    ),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('d',x->>'description','val',coalesce((x->>'amount')::numeric,0))) from jsonb_array_elements(coalesce(v_payload->'expenses','[]'::jsonb)) x),'[]'::jsonb)
  );

  v_result := public.save_cash_closing(v_record);
  return v_result;
end;
$$;

revoke execute on function public.restore_deleted_cash_closing(uuid) from public;
revoke execute on function public.restore_deleted_cash_closing(uuid) from anon;
grant execute on function public.restore_deleted_cash_closing(uuid) to authenticated;

alter table public.cash_backup_snapshots
  add column if not exists checksum_sha256 text;

update public.cash_backup_snapshots
set checksum_sha256 = encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex')
where checksum_sha256 is null;

alter table public.cash_backup_snapshots
  alter column checksum_sha256 set not null;

alter table public.cash_backup_snapshots
  drop constraint if exists cash_backup_snapshots_checksum_sha256_check;
alter table public.cash_backup_snapshots
  add constraint cash_backup_snapshots_checksum_sha256_check
  check (checksum_sha256 ~ '^[0-9a-f]{64}$');

alter table public.cash_backup_snapshots
  drop constraint if exists cash_backup_snapshots_record_count_matches_payload;
alter table public.cash_backup_snapshots
  add constraint cash_backup_snapshots_record_count_matches_payload
  check (record_count = jsonb_array_length(payload));

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
  if auth.uid() is null or not private.is_active_user() then
    raise exception 'authentication required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cash_closing', to_jsonb(c),
      'channel_sales', coalesce((select jsonb_agg(to_jsonb(x) order by x.channel_name) from public.channel_sales x where x.closing_id = c.id), '[]'::jsonb),
      'bread_controls', coalesce((select jsonb_agg(to_jsonb(x) order by x.bread_type) from public.bread_controls x where x.closing_id = c.id), '[]'::jsonb),
      'online_orders', coalesce((select jsonb_agg(to_jsonb(x) order by x.platform) from public.online_orders x where x.closing_id = c.id), '[]'::jsonb),
      'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.expenses x where x.closing_id = c.id), '[]'::jsonb)
    ) order by c.business_date, c.register_name, c.shift_name
  ), '[]'::jsonb)
  into v_payload
  from public.cash_closings c;

  v_count := jsonb_array_length(v_payload);
  v_checksum := encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');

  insert into public.cash_backup_snapshots (snapshot_day, created_at, created_by, record_count, payload, checksum_sha256)
  values (current_date, now(), auth.uid(), v_count, v_payload, v_checksum)
  on conflict (snapshot_day) do update set
    created_at = excluded.created_at,
    created_by = excluded.created_by,
    record_count = excluded.record_count,
    payload = excluded.payload,
    checksum_sha256 = excluded.checksum_sha256
  returning id into v_id;

  delete from public.cash_backup_snapshots
  where snapshot_day < current_date - 30;

  return v_id;
end;
$$;

revoke all on function public.create_cash_snapshot() from public;
revoke all on function public.create_cash_snapshot() from anon;
grant execute on function public.create_cash_snapshot() to authenticated;

create or replace function public.delete_cash_closing(p_id uuid)
returns boolean
language plpgsql
set search_path to 'public','private'
as $$
declare
  v_deleted uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.is_admin() then
    raise exception 'permission denied';
  end if;
  if p_id is null then
    raise exception 'closing id is required';
  end if;

  delete from public.cash_closings
  where id = p_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception 'closing not found';
  end if;
  return true;
end;
$$;

revoke all on function public.delete_cash_closing(uuid) from public;
revoke all on function public.delete_cash_closing(uuid) from anon;
grant execute on function public.delete_cash_closing(uuid) to authenticated;
