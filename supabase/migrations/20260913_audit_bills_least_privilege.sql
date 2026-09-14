-- X-Burguer Caixa — revisão geral 2026-09-13.
-- Endurece privilégios da área de boletos e garante que um boleto
-- reagendado/reaberto possa voltar a gerar os lembretes corretos.

-- O frontend não exclui boletos nem inscrições Push fisicamente.
-- Remover DELETE do papel autenticado reduz a superfície de escrita;
-- cancelamento/reabertura continuam sendo UPDATEs protegidos por RLS.
revoke delete on table public.bills from authenticated;
revoke delete on table public.bill_push_subscriptions from authenticated;

-- Funções de trigger não precisam ser chamáveis pelo cliente.
revoke execute on function public.xb_bills_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.xb_bill_push_touch_updated_at() from public, anon, authenticated;

-- Mantém o estado de pagamento coerente também no banco: um boleto só pode
-- carregar dados de pagamento quando estiver efetivamente marcado como pago.
alter table public.bills
  drop constraint if exists bills_paid_consistency;

alter table public.bills
  drop constraint if exists bills_payment_state_consistency;

alter table public.bills
  add constraint bills_payment_state_consistency check (
    (
      status = 'paid'
      and paid_at is not null
      and paid_date is not null
      and paid_amount is not null
    )
    or
    (
      status <> 'paid'
      and paid_at is null
      and paid_date is null
      and paid_amount is null
    )
  );

-- Ao mudar o vencimento ou reabrir um boleto, remove a deduplicação antiga.
-- Isso evita que um lembrete já enviado para uma data anterior impeça o
-- aviso correto caso o boleto seja reagendado e depois volte à mesma data.
create or replace function private.xb_bills_reset_reopened_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'pending'
     and (
       old.status is distinct from 'pending'
       or new.due_date is distinct from old.due_date
     ) then
    delete from public.bill_notification_log
    where bill_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.xb_bills_reset_reopened_notifications() from public, anon, authenticated;

drop trigger if exists bills_reset_reopened_notifications on public.bills;
create trigger bills_reset_reopened_notifications
after update of status, due_date on public.bills
for each row execute function private.xb_bills_reset_reopened_notifications();
