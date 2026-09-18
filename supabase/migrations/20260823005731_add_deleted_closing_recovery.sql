create table if not exists public.deleted_closing_recovery (
  id uuid primary key default gen_random_uuid(),
  original_closing_id uuid not null,
  business_date date not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  payload jsonb not null
);

alter table public.deleted_closing_recovery enable row level security;

create index if not exists deleted_closing_recovery_deleted_at_idx on public.deleted_closing_recovery(deleted_at desc);
create index if not exists deleted_closing_recovery_business_date_idx on public.deleted_closing_recovery(business_date desc);

revoke all on public.deleted_closing_recovery from anon;
revoke insert, update, delete on public.deleted_closing_recovery from authenticated;
grant select on public.deleted_closing_recovery to authenticated;

drop policy if exists deleted_closing_recovery_select on public.deleted_closing_recovery;
create policy deleted_closing_recovery_select
on public.deleted_closing_recovery
for select
to authenticated
using (private.is_active_user() and private.can_manage());

create or replace function private.capture_deleted_cash_closing()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'closing', to_jsonb(old),
    'channel_sales', coalesce((select jsonb_agg(to_jsonb(x) order by x.channel_name) from public.channel_sales x where x.closing_id = old.id),'[]'::jsonb),
    'bread_controls', coalesce((select jsonb_agg(to_jsonb(x) order by x.bread_type) from public.bread_controls x where x.closing_id = old.id),'[]'::jsonb),
    'online_orders', coalesce((select jsonb_agg(to_jsonb(x) order by x.platform) from public.online_orders x where x.closing_id = old.id),'[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.expenses x where x.closing_id = old.id),'[]'::jsonb)
  );

  insert into public.deleted_closing_recovery(original_closing_id,business_date,deleted_by,payload)
  values (old.id, old.business_date, auth.uid(), v_payload);

  return old;
end;
$$;

revoke all on function private.capture_deleted_cash_closing() from public, anon, authenticated;

drop trigger if exists protect_deleted_cash_closing on public.cash_closings;
create trigger protect_deleted_cash_closing
before delete on public.cash_closings
for each row execute function private.capture_deleted_cash_closing();

create or replace function public.restore_deleted_cash_closing(p_recovery_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_payload jsonb;
  v_closing jsonb;
  v_record jsonb;
  v_result uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.can_manage() then
    raise exception 'permission denied';
  end if;

  select payload into v_payload
  from public.deleted_closing_recovery
  where id = p_recovery_id;

  if v_payload is null then
    raise exception 'recovery record not found';
  end if;

  v_closing := v_payload->'closing';
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

revoke all on function public.restore_deleted_cash_closing(uuid) from anon;
grant execute on function public.restore_deleted_cash_closing(uuid) to authenticated;
