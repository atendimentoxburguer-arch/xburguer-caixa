drop policy if exists cash_backup_snapshots_insert on public.cash_backup_snapshots;
drop policy if exists cash_backup_snapshots_update on public.cash_backup_snapshots;
drop policy if exists cash_backup_snapshots_delete on public.cash_backup_snapshots;

create policy cash_backup_snapshots_insert on public.cash_backup_snapshots
  for insert to authenticated
  with check (
    private.is_active_user()
    and created_by = auth.uid()
    and snapshot_day = current_date
  );

create policy cash_backup_snapshots_update on public.cash_backup_snapshots
  for update to authenticated
  using (private.is_active_user() and snapshot_day = current_date)
  with check (
    private.is_active_user()
    and created_by = auth.uid()
    and snapshot_day = current_date
  );

create policy cash_backup_snapshots_delete on public.cash_backup_snapshots
  for delete to authenticated
  using (private.is_active_user() and snapshot_day < current_date - 30);

alter function public.create_cash_snapshot() security invoker;
revoke all on function public.create_cash_snapshot() from public;
revoke all on function public.create_cash_snapshot() from anon;
grant execute on function public.create_cash_snapshot() to authenticated;
