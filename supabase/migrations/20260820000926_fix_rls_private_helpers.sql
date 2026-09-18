create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.active = true
      and lower(coalesce(u.email,'')) = lower('xburguer@xburguer.com')
  );
$$;

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;
$$;

create or replace function private.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_user_role() in ('admin','manager'), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_user_role() = 'admin', false);
$$;

create or replace function private.can_edit_closing(target_closing uuid)
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
      and (c.status <> 'reviewed' or private.can_manage())
  );
$$;

revoke all on function private.is_active_user() from public, anon;
revoke all on function private.current_user_role() from public, anon;
revoke all on function private.can_manage() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.can_edit_closing(uuid) from public, anon;
grant execute on function private.is_active_user() to authenticated, service_role;
grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.can_manage() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.can_edit_closing(uuid) to authenticated, service_role;

-- Profiles
alter policy profiles_select on public.profiles
using (id = (select auth.uid()));

alter policy profiles_update_admin on public.profiles
using (private.is_active_user() and private.is_admin())
with check (private.is_active_user() and private.is_admin());

-- Cash closings
alter policy closings_select on public.cash_closings
using (private.is_active_user());

alter policy closings_insert on public.cash_closings
with check (private.is_active_user() and created_by = (select auth.uid()));

alter policy closings_update on public.cash_closings
using (private.is_active_user() and (status <> 'reviewed'::public.closing_status or private.can_manage()))
with check (private.is_active_user() and (status <> 'reviewed'::public.closing_status or private.can_manage()));

alter policy closings_delete on public.cash_closings
using (private.is_active_user() and private.is_admin());

-- Channel sales
alter policy channel_sales_select on public.channel_sales
using (private.is_active_user());
alter policy channel_sales_insert on public.channel_sales
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy channel_sales_update on public.channel_sales
using (private.is_active_user() and private.can_edit_closing(closing_id))
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy channel_sales_delete on public.channel_sales
using (private.is_active_user() and private.can_edit_closing(closing_id));

-- Bread controls
alter policy bread_controls_select on public.bread_controls
using (private.is_active_user());
alter policy bread_controls_insert on public.bread_controls
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy bread_controls_update on public.bread_controls
using (private.is_active_user() and private.can_edit_closing(closing_id))
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy bread_controls_delete on public.bread_controls
using (private.is_active_user() and private.can_edit_closing(closing_id));

-- Online orders
alter policy online_orders_select on public.online_orders
using (private.is_active_user());
alter policy online_orders_insert on public.online_orders
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy online_orders_update on public.online_orders
using (private.is_active_user() and private.can_edit_closing(closing_id))
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy online_orders_delete on public.online_orders
using (private.is_active_user() and private.can_edit_closing(closing_id));

-- Expenses
alter policy expenses_select on public.expenses
using (private.is_active_user());
alter policy expenses_insert on public.expenses
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy expenses_update on public.expenses
using (private.is_active_user() and private.can_edit_closing(closing_id))
with check (private.is_active_user() and private.can_edit_closing(closing_id));
alter policy expenses_delete on public.expenses
using (private.is_active_user() and private.can_edit_closing(closing_id));

-- Audit log
alter policy audit_logs_select on public.audit_logs
using (private.is_active_user() and private.can_manage());
