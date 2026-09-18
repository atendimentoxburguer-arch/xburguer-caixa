-- X-Burguer Caixa — otimizações de RLS e índice para notificações.

create index if not exists bill_notification_log_subscription_idx
on public.bill_notification_log(subscription_id);

drop policy if exists bills_select_active on public.bills;
create policy bills_select_active on public.bills for select to authenticated
using ((select private.is_active_user()));

drop policy if exists bills_insert_active on public.bills;
create policy bills_insert_active on public.bills for insert to authenticated
with check (
  (select private.is_active_user())
  and coalesce(created_by,(select auth.uid()))=(select auth.uid())
);

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
