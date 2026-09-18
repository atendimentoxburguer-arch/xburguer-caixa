create or replace function public.delete_cash_closing(p_id uuid)
returns boolean
language plpgsql
set search_path to 'public','private'
as $$
declare
  v_deleted uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.is_admin() then
    raise exception 'permission denied';
  end if;
  if p_id is null then
    raise exception 'closing id is required';
  end if;

  perform set_config('xburguer.delete_rpc','on',true);

  delete from public.cash_closings
  where id = p_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception 'closing not found';
  end if;
  return true;
end;
$$;

revoke all on function public.delete_cash_closing(uuid) from public;
revoke all on function public.delete_cash_closing(uuid) from anon;
grant execute on function public.delete_cash_closing(uuid) to authenticated;

drop policy if exists closings_delete on public.cash_closings;
create policy closings_delete on public.cash_closings
for delete to authenticated
using (
  private.is_active_user()
  and private.is_admin()
  and coalesce(current_setting('xburguer.delete_rpc',true),'') = 'on'
);
