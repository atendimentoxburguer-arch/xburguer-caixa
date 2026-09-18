revoke all privileges on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

revoke execute on function public.restore_deleted_cash_closing(uuid) from public;
revoke execute on function public.restore_deleted_cash_closing(uuid) from anon;
grant execute on function public.restore_deleted_cash_closing(uuid) to authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;

revoke execute on function private.xb_cascade_next_opening_balance() from public;
revoke execute on function private.xb_cascade_next_opening_balance() from anon;
revoke execute on function private.xb_cascade_next_opening_balance() from authenticated;
revoke execute on function private.xb_enforce_automatic_opening_balance() from public;
revoke execute on function private.xb_enforce_automatic_opening_balance() from anon;
revoke execute on function private.xb_enforce_automatic_opening_balance() from authenticated;
revoke execute on function private.xb_expected_opening_balance(date,text,text) from public;
revoke execute on function private.xb_expected_opening_balance(date,text,text) from anon;
revoke execute on function private.xb_expected_opening_balance(date,text,text) from authenticated;
revoke execute on function private.xb_guard_opening_chain_delete() from public;
revoke execute on function private.xb_guard_opening_chain_delete() from anon;
revoke execute on function private.xb_guard_opening_chain_delete() from authenticated;
