-- X-Burguer Caixa — boletos, inscrições Push e fila de lembretes.
-- Não contém chaves privadas. O VAPID privado e o segredo do agendador devem ser
-- cadastrados somente no banco de produção, fora do repositório.

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  supplier text not null check (length(trim(supplier)) between 1 and 120),
  description text not null default '' check (length(description) <= 180),
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  digitable_line text not null default '' check (length(digitable_line) <= 160),
  notes text not null default '' check (length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  reminder_enabled boolean not null default true,
  paid_at timestamptz,
  paid_date date,
  paid_amount numeric(12,2) check (paid_amount is null or paid_amount >= 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_paid_consistency check (
    status <> 'paid' or (paid_at is not null and paid_date is not null and paid_amount is not null)
  )
);

create index if not exists bills_due_status_idx on public.bills(status,due_date);
create index if not exists bills_updated_idx on public.bills(updated_at desc);

create table if not exists public.bill_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text not null default 'Dispositivo' check (length(device_name) <= 100),
  user_agent text not null default '' check (length(user_agent) <= 700),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bill_push_user_enabled_idx on public.bill_push_subscriptions(user_id,enabled);

create table if not exists public.bill_notification_log (
  id bigint generated always as identity primary key,
  bill_id uuid not null references public.bills(id) on delete cascade,
  subscription_id uuid not null references public.bill_push_subscriptions(id) on delete cascade,
  due_date date not null,
  reminder_days smallint not null check (reminder_days in (0,1,2,3)),
  sent_at timestamptz not null default now(),
  unique (bill_id,subscription_id,due_date,reminder_days)
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.bill_push_config (
  singleton boolean primary key default true check (singleton),
  vapid_subject text,
  vapid_public_key text,
  vapid_private_key text,
  cron_secret_hash text,
  updated_at timestamptz not null default now()
);
revoke all on private.bill_push_config from public, anon, authenticated;

create or replace function public.xb_bills_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end;
$$;

create or replace function public.xb_bill_push_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger bills_touch_updated_at
before update on public.bills
for each row execute function public.xb_bills_touch_updated_at();

create or replace trigger bill_push_touch_updated_at
before update on public.bill_push_subscriptions
for each row execute function public.xb_bill_push_touch_updated_at();

alter table public.bills enable row level security;
alter table public.bills force row level security;
alter table public.bill_push_subscriptions enable row level security;
alter table public.bill_push_subscriptions force row level security;
alter table public.bill_notification_log enable row level security;
alter table public.bill_notification_log force row level security;

drop policy if exists bills_select_active on public.bills;
create policy bills_select_active on public.bills for select to authenticated
using ((select private.is_active_user()));

drop policy if exists bills_insert_active on public.bills;
create policy bills_insert_active on public.bills for insert to authenticated
with check ((select private.is_active_user()) and coalesce(created_by,(select auth.uid()))=(select auth.uid()));

drop policy if exists bills_update_active on public.bills;
create policy bills_update_active on public.bills for update to authenticated
using ((select private.is_active_user()))
with check ((select private.is_active_user()));

drop policy if exists bill_push_select_own on public.bill_push_subscriptions;
create policy bill_push_select_own on public.bill_push_subscriptions for select to authenticated
using ((select private.is_active_user()) and user_id=(select auth.uid()));

drop policy if exists bill_push_insert_own on public.bill_push_subscriptions;
create policy bill_push_insert_own on public.bill_push_subscriptions for insert to authenticated
with check ((select private.is_active_user()) and user_id=(select auth.uid()));

drop policy if exists bill_push_update_own on public.bill_push_subscriptions;
create policy bill_push_update_own on public.bill_push_subscriptions for update to authenticated
using ((select private.is_active_user()) and user_id=(select auth.uid()))
with check ((select private.is_active_user()) and user_id=(select auth.uid()));

drop policy if exists bill_notification_log_deny_authenticated on public.bill_notification_log;
create policy bill_notification_log_deny_authenticated on public.bill_notification_log
for all to authenticated using (false) with check (false);

revoke all on public.bills from anon;
revoke all on public.bill_push_subscriptions from anon;
revoke all on public.bill_notification_log from anon, authenticated;
grant select,insert,update on public.bills to authenticated;
grant select,insert,update on public.bill_push_subscriptions to authenticated;
grant all on public.bills, public.bill_push_subscriptions, public.bill_notification_log to service_role;
grant usage,select on sequence public.bill_notification_log_id_seq to service_role;

create or replace function public.get_bill_push_config()
returns table (
  vapid_subject text,
  vapid_public_key text,
  vapid_private_key text,
  cron_secret_hash text
)
language plpgsql
stable
security definer
set search_path = public, private, auth
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  return query
  select c.vapid_subject,c.vapid_public_key,c.vapid_private_key,c.cron_secret_hash
  from private.bill_push_config c
  where c.singleton=true
  limit 1;
end;
$$;
revoke all on function public.get_bill_push_config() from public, anon, authenticated;
grant execute on function public.get_bill_push_config() to service_role;

create or replace function public.list_due_bill_notification_targets()
returns table (
  bill_id uuid,
  supplier text,
  description text,
  amount numeric,
  due_date date,
  reminder_days integer,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  device_name text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  local_today date := timezone('America/Sao_Paulo',now())::date;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  return query
  select
    b.id,
    b.supplier,
    b.description,
    b.amount,
    b.due_date,
    (b.due_date-local_today)::integer,
    s.id,
    s.endpoint,
    s.p256dh,
    s.auth,
    s.device_name
  from public.bills b
  cross join public.bill_push_subscriptions s
  where b.status='pending'
    and b.reminder_enabled=true
    and s.enabled=true
    and (b.due_date-local_today) in (0,1,2,3)
    and not exists (
      select 1 from public.bill_notification_log l
      where l.bill_id=b.id
        and l.subscription_id=s.id
        and l.due_date=b.due_date
        and l.reminder_days=(b.due_date-local_today)::integer
    )
  order by b.due_date,b.supplier,s.created_at;
end;
$$;
revoke all on function public.list_due_bill_notification_targets() from public, anon, authenticated;
grant execute on function public.list_due_bill_notification_targets() to service_role;

create or replace function public.record_bill_notification(
  p_bill_id uuid,
  p_subscription_id uuid,
  p_due_date date,
  p_reminder_days integer
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  insert into public.bill_notification_log(bill_id,subscription_id,due_date,reminder_days)
  values(p_bill_id,p_subscription_id,p_due_date,p_reminder_days)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_bill_notification(uuid,uuid,date,integer) from public, anon, authenticated;
grant execute on function public.record_bill_notification(uuid,uuid,date,integer) to service_role;

create or replace function private.xb_bills_reset_reopened_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status='pending' and old.status is distinct from 'pending' then
    delete from public.bill_notification_log
    where bill_id=new.id and due_date=new.due_date;
  end if;
  return new;
end;
$$;

revoke all on function private.xb_bills_reset_reopened_notifications() from public, anon, authenticated;

create or replace trigger bills_reset_reopened_notifications
after update of status on public.bills
for each row execute function private.xb_bills_reset_reopened_notifications();

create index if not exists bill_notification_log_subscription_idx
on public.bill_notification_log(subscription_id);
