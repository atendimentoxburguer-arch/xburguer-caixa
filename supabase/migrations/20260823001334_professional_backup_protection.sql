create table if not exists public.backup_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exported_at timestamptz not null default now(),
  record_count integer not null check (record_count >= 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  app_version text not null default '',
  format_version text not null default 'xburguer-caixa-backup-v2'
);

create index if not exists backup_exports_exported_at_idx on public.backup_exports (exported_at desc);

alter table public.backup_exports enable row level security;
drop policy if exists backup_exports_select on public.backup_exports;
drop policy if exists backup_exports_insert on public.backup_exports;
create policy backup_exports_select on public.backup_exports
  for select to authenticated
  using (private.is_active_user());
create policy backup_exports_insert on public.backup_exports
  for insert to authenticated
  with check (private.is_active_user() and user_id = auth.uid());

create table if not exists public.cash_backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_day date not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  record_count integer not null default 0 check (record_count >= 0),
  payload jsonb not null default '[]'::jsonb check (jsonb_typeof(payload) = 'array')
);

create index if not exists cash_backup_snapshots_created_at_idx on public.cash_backup_snapshots (created_at desc);
alter table public.cash_backup_snapshots enable row level security;
drop policy if exists cash_backup_snapshots_select on public.cash_backup_snapshots;
create policy cash_backup_snapshots_select on public.cash_backup_snapshots
  for select to authenticated
  using (private.is_active_user());

create or replace function public.create_cash_snapshot()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_payload jsonb;
  v_count integer;
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

  insert into public.cash_backup_snapshots (snapshot_day, created_at, created_by, record_count, payload)
  values (current_date, now(), auth.uid(), v_count, v_payload)
  on conflict (snapshot_day) do update set
    created_at = excluded.created_at,
    created_by = excluded.created_by,
    record_count = excluded.record_count,
    payload = excluded.payload
  returning id into v_id;

  delete from public.cash_backup_snapshots
  where snapshot_day < current_date - 30;

  return v_id;
end;
$$;

revoke all on function public.create_cash_snapshot() from public;
grant execute on function public.create_cash_snapshot() to authenticated;
