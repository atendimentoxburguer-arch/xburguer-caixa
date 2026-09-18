create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists cash_closings_created_by_idx on public.cash_closings(created_by);
create index if not exists cash_closings_updated_by_idx on public.cash_closings(updated_by);
create index if not exists cash_closings_approved_by_idx on public.cash_closings(approved_by);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.can_manage());

drop policy if exists closings_insert on public.cash_closings;
create policy closings_insert on public.cash_closings
for insert to authenticated
with check (created_by = (select auth.uid()));
