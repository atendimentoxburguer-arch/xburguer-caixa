create table if not exists public.deleted_closing_recovery (
  id uuid primary key default gen_random_uuid(),
  original_closing_id uuid not null,
  business_date date not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  payload jsonb not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source text not null default 'cash_closings_before_delete'
);

create index if not exists deleted_closing_recovery_date_idx
  on public.deleted_closing_recovery (business_date, deleted_at desc);
create index if not exists deleted_closing_recovery_original_id_idx
  on public.deleted_closing_recovery (original_closing_id, deleted_at desc);

alter table public.deleted_closing_recovery enable row level security;

drop policy if exists deleted_closing_recovery_select on public.deleted_closing_recovery;
create policy deleted_closing_recovery_select
  on public.deleted_closing_recovery
  for select
  to authenticated
  using (private.is_active_user() and private.can_manage());

revoke all on public.deleted_closing_recovery from anon;
revoke insert, update, delete, truncate, references, trigger on public.deleted_closing_recovery from authenticated;
grant select on public.deleted_closing_recovery to authenticated;

create or replace function public.capture_deleted_cash_closing()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
  v_checksum text;
begin
  v_payload := jsonb_build_object(
    'cash_closing', to_jsonb(old),
    'channel_sales', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.channel_sales x where x.closing_id = old.id), '[]'::jsonb),
    'bread_controls', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.bread_controls x where x.closing_id = old.id), '[]'::jsonb),
    'online_orders', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.online_orders x where x.closing_id = old.id), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.expenses x where x.closing_id = old.id), '[]'::jsonb)
  );

  v_checksum := encode(digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.deleted_closing_recovery (
    original_closing_id, business_date, deleted_by, payload, checksum_sha256
  ) values (
    old.id, old.business_date, auth.uid(), v_payload, v_checksum
  );

  return old;
end;
$$;

revoke all on function public.capture_deleted_cash_closing() from public, anon, authenticated;

drop trigger if exists protect_deleted_cash_closing on public.cash_closings;
create trigger protect_deleted_cash_closing
before delete on public.cash_closings
for each row execute function public.capture_deleted_cash_closing();
