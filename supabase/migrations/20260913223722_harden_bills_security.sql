drop policy if exists bills_select_active on public.bills;
create policy bills_select_active on public.bills for select to authenticated
using (private.is_active_user());

drop policy if exists bills_insert_active on public.bills;
create policy bills_insert_active on public.bills for insert to authenticated
with check (private.is_active_user() and coalesce(created_by,auth.uid())=auth.uid());

drop policy if exists bills_update_active on public.bills;
create policy bills_update_active on public.bills for update to authenticated
using (private.is_active_user())
with check (private.is_active_user());

drop policy if exists bill_push_select_own on public.bill_push_subscriptions;
create policy bill_push_select_own on public.bill_push_subscriptions for select to authenticated
using (private.is_active_user() and user_id=auth.uid());

drop policy if exists bill_push_insert_own on public.bill_push_subscriptions;
create policy bill_push_insert_own on public.bill_push_subscriptions for insert to authenticated
with check (private.is_active_user() and user_id=auth.uid());

drop policy if exists bill_push_update_own on public.bill_push_subscriptions;
create policy bill_push_update_own on public.bill_push_subscriptions for update to authenticated
using (private.is_active_user() and user_id=auth.uid())
with check (private.is_active_user() and user_id=auth.uid());

drop policy if exists bill_notification_log_deny_authenticated on public.bill_notification_log;
create policy bill_notification_log_deny_authenticated on public.bill_notification_log
for all to authenticated using (false) with check (false);

drop trigger if exists bills_reset_reopened_notifications on public.bills;

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

drop function if exists public.xb_bills_reset_reopened_notifications();

drop function if exists public.xb_is_active_cash_user();

create trigger bills_reset_reopened_notifications
after update of status on public.bills
for each row execute function private.xb_bills_reset_reopened_notifications();
