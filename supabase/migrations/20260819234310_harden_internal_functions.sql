alter function public.set_updated_at() set search_path = public;

revoke all on function public.current_user_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.can_manage() from public, anon, authenticated;
revoke all on function public.can_edit_closing(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.write_audit_log() from public, anon, authenticated;

grant execute on function public.current_user_role() to postgres;
grant execute on function public.is_admin() to postgres;
grant execute on function public.can_manage() to postgres;
grant execute on function public.can_edit_closing(uuid) to postgres;
grant execute on function public.handle_new_user() to postgres;
grant execute on function public.write_audit_log() to postgres;
