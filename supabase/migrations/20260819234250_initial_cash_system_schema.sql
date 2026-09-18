create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','manager','operator');
create type public.closing_status as enum ('draft','closed','reviewed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin','manager'), false);
$$;

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  register_name text not null default 'Caixa Principal',
  shift_name text not null default 'Dia',
  responsible_name text not null default '',
  status public.closing_status not null default 'draft',
  opening_balance numeric(12,2) not null default 0,
  cash_sales numeric(12,2) not null default 0,
  store_card_sales numeric(12,2) not null default 0,
  pix_app_sales numeric(12,2) not null default 0,
  delivery_card_sales numeric(12,2) not null default 0,
  cash_withdrawn_for_expenses numeric(12,2) not null default 0,
  counted_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  cash_difference numeric(12,2) not null default 0,
  total_sales numeric(12,2) not null default 0,
  total_expenses numeric(12,2) not null default 0,
  result numeric(12,2) not null default 0,
  observations text,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid default auth.uid() references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_date, register_name, shift_name)
);

create trigger cash_closings_set_updated_at
before update on public.cash_closings
for each row execute function public.set_updated_at();

create table public.channel_sales (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.cash_closings(id) on delete cascade,
  channel_name text not null,
  order_count integer not null default 0 check (order_count >= 0),
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (closing_id, channel_name)
);

create trigger channel_sales_set_updated_at
before update on public.channel_sales
for each row execute function public.set_updated_at();

create table public.bread_controls (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.cash_closings(id) on delete cascade,
  bread_type text not null,
  opening_stock integer not null default 0,
  production integer not null default 0,
  out_qty integer not null default 0,
  closing_stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (closing_id, bread_type)
);

create trigger bread_controls_set_updated_at
before update on public.bread_controls
for each row execute function public.set_updated_at();

create table public.online_orders (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.cash_closings(id) on delete cascade,
  platform text not null,
  order_count integer not null default 0 check (order_count >= 0),
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (closing_id, platform)
);

create trigger online_orders_set_updated_at
before update on public.online_orders
for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.cash_closings(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.can_edit_closing(target_closing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cash_closings c
    where c.id = target_closing
      and (c.status <> 'reviewed' or public.can_manage())
  );
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  payload jsonb;
begin
  if tg_op = 'DELETE' then
    row_id := old.id;
    payload := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    row_id := new.id;
    payload := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    row_id := new.id;
    payload := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, row_id, payload);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_cash_closings
after insert or update or delete on public.cash_closings
for each row execute function public.write_audit_log();

create trigger audit_channel_sales
after insert or update or delete on public.channel_sales
for each row execute function public.write_audit_log();

create trigger audit_bread_controls
after insert or update or delete on public.bread_controls
for each row execute function public.write_audit_log();

create trigger audit_online_orders
after insert or update or delete on public.online_orders
for each row execute function public.write_audit_log();

create trigger audit_expenses
after insert or update or delete on public.expenses
for each row execute function public.write_audit_log();

create index cash_closings_business_date_idx on public.cash_closings (business_date desc);
create index cash_closings_status_idx on public.cash_closings (status);
create index channel_sales_closing_idx on public.channel_sales (closing_id);
create index bread_controls_closing_idx on public.bread_controls (closing_id);
create index online_orders_closing_idx on public.online_orders (closing_id);
create index expenses_closing_idx on public.expenses (closing_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.profiles enable row level security;
alter table public.cash_closings enable row level security;
alter table public.channel_sales enable row level security;
alter table public.bread_controls enable row level security;
alter table public.online_orders enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.can_manage());

create policy profiles_update_admin on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy closings_select on public.cash_closings
for select to authenticated
using (true);

create policy closings_insert on public.cash_closings
for insert to authenticated
with check (created_by = auth.uid());

create policy closings_update on public.cash_closings
for update to authenticated
using (status <> 'reviewed' or public.can_manage())
with check (status <> 'reviewed' or public.can_manage());

create policy closings_delete on public.cash_closings
for delete to authenticated
using (public.is_admin());

create policy channel_sales_select on public.channel_sales
for select to authenticated using (true);
create policy channel_sales_insert on public.channel_sales
for insert to authenticated with check (public.can_edit_closing(closing_id));
create policy channel_sales_update on public.channel_sales
for update to authenticated using (public.can_edit_closing(closing_id)) with check (public.can_edit_closing(closing_id));
create policy channel_sales_delete on public.channel_sales
for delete to authenticated using (public.can_edit_closing(closing_id));

create policy bread_controls_select on public.bread_controls
for select to authenticated using (true);
create policy bread_controls_insert on public.bread_controls
for insert to authenticated with check (public.can_edit_closing(closing_id));
create policy bread_controls_update on public.bread_controls
for update to authenticated using (public.can_edit_closing(closing_id)) with check (public.can_edit_closing(closing_id));
create policy bread_controls_delete on public.bread_controls
for delete to authenticated using (public.can_edit_closing(closing_id));

create policy online_orders_select on public.online_orders
for select to authenticated using (true);
create policy online_orders_insert on public.online_orders
for insert to authenticated with check (public.can_edit_closing(closing_id));
create policy online_orders_update on public.online_orders
for update to authenticated using (public.can_edit_closing(closing_id)) with check (public.can_edit_closing(closing_id));
create policy online_orders_delete on public.online_orders
for delete to authenticated using (public.can_edit_closing(closing_id));

create policy expenses_select on public.expenses
for select to authenticated using (true);
create policy expenses_insert on public.expenses
for insert to authenticated with check (public.can_edit_closing(closing_id));
create policy expenses_update on public.expenses
for update to authenticated using (public.can_edit_closing(closing_id)) with check (public.can_edit_closing(closing_id));
create policy expenses_delete on public.expenses
for delete to authenticated using (public.can_edit_closing(closing_id));

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.can_manage());

grant usage on schema public to authenticated;
grant select on public.profiles, public.cash_closings, public.channel_sales, public.bread_controls, public.online_orders, public.expenses to authenticated;
grant insert, update, delete on public.cash_closings, public.channel_sales, public.bread_controls, public.online_orders, public.expenses to authenticated;
grant update on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;
