-- X-Burguer Caixa — agendamento diário dos lembretes de boletos.
-- O segredo em texto puro fica no Supabase Vault com o nome
-- bill_reminders_cron_secret. Nenhum segredo é versionado neste arquivo.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.invoke_bill_reminders()
returns bigint
language plpgsql
security definer
set search_path = private, vault, extensions, public
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name='bill_reminders_cron_secret'
  limit 1;

  if coalesce(v_secret,'')='' then
    raise exception 'bill_reminders_cron_secret is not configured';
  end if;

  select net.http_post(
    url := 'https://trnngxezppeembrvxkhh.supabase.co/functions/v1/bill-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',v_secret
    ),
    body := '{}'::jsonb
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_bill_reminders() from public, anon, authenticated;
grant execute on function private.invoke_bill_reminders() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='bill-reminders-daily';

-- PostgreSQL/Supabase cron usa UTC. 12:00 UTC corresponde a 09:00 em Brasília.
select cron.schedule(
  'bill-reminders-daily',
  '0 12 * * *',
  $$select private.invoke_bill_reminders();$$
);
