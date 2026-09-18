create index if not exists backup_exports_user_id_idx
  on public.backup_exports (user_id);

create index if not exists cash_backup_snapshots_created_by_idx
  on public.cash_backup_snapshots (created_by);

alter policy backup_exports_select on public.backup_exports
  using ((select private.is_active_user()));

alter policy backup_exports_insert on public.backup_exports
  with check (
    (select private.is_active_user())
    and user_id = (select auth.uid())
  );

alter policy cash_backup_snapshots_select on public.cash_backup_snapshots
  using ((select private.is_active_user()));

alter policy cash_backup_snapshots_insert on public.cash_backup_snapshots
  with check (
    (select private.is_active_user())
    and created_by = (select auth.uid())
    and snapshot_day = current_date
  );

alter policy cash_backup_snapshots_update on public.cash_backup_snapshots
  using (
    (select private.is_active_user())
    and snapshot_day = current_date
  )
  with check (
    (select private.is_active_user())
    and created_by = (select auth.uid())
    and snapshot_day = current_date
  );

alter policy cash_backup_snapshots_delete on public.cash_backup_snapshots
  using (
    (select private.is_active_user())
    and snapshot_day < current_date - 30
  );
