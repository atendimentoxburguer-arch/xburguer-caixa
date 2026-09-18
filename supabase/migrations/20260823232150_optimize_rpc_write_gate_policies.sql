drop policy if exists closings_delete on public.cash_closings;
create policy closings_delete on public.cash_closings
for delete to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin())
  and coalesce((select current_setting('xburguer.delete_rpc',true)),'')='on'
);

drop policy if exists closings_insert on public.cash_closings;
create policy closings_insert on public.cash_closings
for insert to authenticated
with check (
  (select private.is_active_user())
  and created_by=(select auth.uid())
  and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on'
);

drop policy if exists closings_update on public.cash_closings;
create policy closings_update on public.cash_closings
for update to authenticated
using (
  (select private.is_active_user())
  and ((status <> 'reviewed'::public.closing_status) or (select private.can_manage()))
  and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on'
)
with check (
  (select private.is_active_user())
  and ((status <> 'reviewed'::public.closing_status) or (select private.can_manage()))
  and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on'
);

drop policy if exists channel_sales_insert on public.channel_sales;
create policy channel_sales_insert on public.channel_sales for insert to authenticated
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists channel_sales_update on public.channel_sales;
create policy channel_sales_update on public.channel_sales for update to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on')
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists channel_sales_delete on public.channel_sales;
create policy channel_sales_delete on public.channel_sales for delete to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');

drop policy if exists bread_controls_insert on public.bread_controls;
create policy bread_controls_insert on public.bread_controls for insert to authenticated
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists bread_controls_update on public.bread_controls;
create policy bread_controls_update on public.bread_controls for update to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on')
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists bread_controls_delete on public.bread_controls;
create policy bread_controls_delete on public.bread_controls for delete to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');

drop policy if exists online_orders_insert on public.online_orders;
create policy online_orders_insert on public.online_orders for insert to authenticated
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists online_orders_update on public.online_orders;
create policy online_orders_update on public.online_orders for update to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on')
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists online_orders_delete on public.online_orders;
create policy online_orders_delete on public.online_orders for delete to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on')
with check ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated
using ((select private.is_active_user()) and private.can_edit_closing(closing_id) and coalesce((select current_setting('xburguer.save_rpc',true)),'')='on');

drop policy if exists cash_backup_snapshots_insert on public.cash_backup_snapshots;
create policy cash_backup_snapshots_insert on public.cash_backup_snapshots for insert to authenticated
with check ((select private.is_active_user()) and created_by=(select auth.uid()) and snapshot_day=current_date and coalesce((select current_setting('xburguer.snapshot_rpc',true)),'')='on');
drop policy if exists cash_backup_snapshots_update on public.cash_backup_snapshots;
create policy cash_backup_snapshots_update on public.cash_backup_snapshots for update to authenticated
using ((select private.is_active_user()) and snapshot_day=current_date and coalesce((select current_setting('xburguer.snapshot_rpc',true)),'')='on')
with check ((select private.is_active_user()) and created_by=(select auth.uid()) and snapshot_day=current_date and coalesce((select current_setting('xburguer.snapshot_rpc',true)),'')='on');
drop policy if exists cash_backup_snapshots_delete on public.cash_backup_snapshots;
create policy cash_backup_snapshots_delete on public.cash_backup_snapshots for delete to authenticated
using ((select private.is_active_user()) and snapshot_day < current_date-30 and coalesce((select current_setting('xburguer.snapshot_rpc',true)),'')='on');
