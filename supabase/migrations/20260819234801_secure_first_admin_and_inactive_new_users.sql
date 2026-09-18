create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from public.profiles) into is_first;

  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::public.app_role else 'operator'::public.app_role end,
    is_first
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true);
$$;

revoke all on function public.is_active_user() from public, anon, authenticated;

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.can_manage());

-- Closings
drop policy if exists closings_select on public.cash_closings;
create policy closings_select on public.cash_closings
for select to authenticated
using (public.is_active_user());

drop policy if exists closings_insert on public.cash_closings;
create policy closings_insert on public.cash_closings
for insert to authenticated
with check (public.is_active_user() and created_by = (select auth.uid()));

drop policy if exists closings_update on public.cash_closings;
create policy closings_update on public.cash_closings
for update to authenticated
using (public.is_active_user() and (status <> 'reviewed' or public.can_manage()))
with check (public.is_active_user() and (status <> 'reviewed' or public.can_manage()));

drop policy if exists closings_delete on public.cash_closings;
create policy closings_delete on public.cash_closings
for delete to authenticated
using (public.is_active_user() and public.is_admin());

-- Child table select policies
drop policy if exists channel_sales_select on public.channel_sales;
create policy channel_sales_select on public.channel_sales for select to authenticated using (public.is_active_user());
drop policy if exists bread_controls_select on public.bread_controls;
create policy bread_controls_select on public.bread_controls for select to authenticated using (public.is_active_user());
drop policy if exists online_orders_select on public.online_orders;
create policy online_orders_select on public.online_orders for select to authenticated using (public.is_active_user());
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (public.is_active_user());

-- Child table writes also require an active user
drop policy if exists channel_sales_insert on public.channel_sales;
create policy channel_sales_insert on public.channel_sales for insert to authenticated with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists channel_sales_update on public.channel_sales;
create policy channel_sales_update on public.channel_sales for update to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id)) with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists channel_sales_delete on public.channel_sales;
create policy channel_sales_delete on public.channel_sales for delete to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id));

drop policy if exists bread_controls_insert on public.bread_controls;
create policy bread_controls_insert on public.bread_controls for insert to authenticated with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists bread_controls_update on public.bread_controls;
create policy bread_controls_update on public.bread_controls for update to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id)) with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists bread_controls_delete on public.bread_controls;
create policy bread_controls_delete on public.bread_controls for delete to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id));

drop policy if exists online_orders_insert on public.online_orders;
create policy online_orders_insert on public.online_orders for insert to authenticated with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists online_orders_update on public.online_orders;
create policy online_orders_update on public.online_orders for update to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id)) with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists online_orders_delete on public.online_orders;
create policy online_orders_delete on public.online_orders for delete to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id)) with check (public.is_active_user() and public.can_edit_closing(closing_id));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_active_user() and public.can_edit_closing(closing_id));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select to authenticated using (public.is_active_user() and public.can_manage());
