create or replace function private.capture_deleted_cash_closing()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions'
as $$
declare
  v_payload jsonb;
  v_checksum text;
begin
  v_payload := jsonb_build_object(
    'closing', to_jsonb(old),
    'channel_sales', coalesce((select jsonb_agg(to_jsonb(x) order by x.channel_name) from public.channel_sales x where x.closing_id = old.id),'[]'::jsonb),
    'bread_controls', coalesce((select jsonb_agg(to_jsonb(x) order by x.bread_type) from public.bread_controls x where x.closing_id = old.id),'[]'::jsonb),
    'online_orders', coalesce((select jsonb_agg(to_jsonb(x) order by x.platform) from public.online_orders x where x.closing_id = old.id),'[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from public.expenses x where x.closing_id = old.id),'[]'::jsonb)
  );

  v_checksum := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.deleted_closing_recovery(
    original_closing_id,
    business_date,
    deleted_by,
    payload,
    checksum_sha256
  ) values (
    old.id,
    old.business_date,
    auth.uid(),
    v_payload,
    v_checksum
  );

  return old;
end;
$$;
