create or replace function public.enforce_single_xburguer_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(new.email,'')) <> 'xburguer@xburguer.com' then
    raise exception 'Cadastro de novos usuarios desativado para este sistema';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_single_xburguer_user() from public, anon, authenticated;

drop trigger if exists restrict_xburguer_auth_users on auth.users;
create trigger restrict_xburguer_auth_users
before insert on auth.users
for each row execute function public.enforce_single_xburguer_user();
