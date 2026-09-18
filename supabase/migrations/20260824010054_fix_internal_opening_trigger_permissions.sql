alter function private.xb_enforce_automatic_opening_balance() security definer;
alter function private.xb_cascade_next_opening_balance() security definer;
alter function private.xb_repair_opening_after_delete() security definer;

revoke all on function private.xb_enforce_automatic_opening_balance() from public, anon, authenticated;
revoke all on function private.xb_cascade_next_opening_balance() from public, anon, authenticated;
revoke all on function private.xb_repair_opening_after_delete() from public, anon, authenticated;
revoke all on function private.xb_expected_opening_balance(date,text,text) from public, anon, authenticated;
