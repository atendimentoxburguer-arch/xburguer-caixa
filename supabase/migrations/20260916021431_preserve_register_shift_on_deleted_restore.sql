-- X-Burguer Caixa — restauração fiel do fechamento excluído.
-- Preserva register_name e shift_name do registro original no recovery payload.

create or replace function public.restore_deleted_cash_closing(p_recovery_id uuid)
returns uuid
language plpgsql
set search_path to 'public', 'private'
as $function$
declare
  v_payload jsonb;
  v_checksum text;
  v_actual_checksum text;
  v_closing jsonb;
  v_record jsonb;
  v_result uuid;
begin
  if auth.uid() is null or not private.is_active_user() or not private.can_manage() then
    raise exception 'permission denied';
  end if;

  select payload, checksum_sha256
  into v_payload, v_checksum
  from public.deleted_closing_recovery
  where id = p_recovery_id;

  if v_payload is null then
    raise exception 'recovery record not found';
  end if;

  v_actual_checksum := encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
  if v_checksum is null or v_checksum !~ '^[0-9a-f]{64}$' or v_checksum <> v_actual_checksum then
    raise exception 'recovery checksum mismatch';
  end if;

  v_closing := v_payload->'closing';
  if v_closing is null or jsonb_typeof(v_closing) <> 'object' then
    raise exception 'invalid recovery payload';
  end if;

  v_record := jsonb_build_object(
    'date', v_closing->>'business_date',
    'register_name', coalesce(nullif(v_closing->>'register_name',''),'Caixa Principal'),
    'shift_name', coalesce(nullif(v_closing->>'shift_name',''),'Dia'),
    'resp', v_closing->>'responsible_name',
    'status', coalesce(v_closing->>'status','closed'),
    'opening', coalesce((v_closing->>'opening_balance')::numeric,0),
    'cash', coalesce((v_closing->>'cash_sales')::numeric,0),
    'deliveryCash', coalesce((v_closing->>'delivery_cash_sales')::numeric,0),
    'cardOut', coalesce((v_closing->>'store_card_sales')::numeric,0),
    'onlinePayment', coalesce((v_closing->>'pix_app_sales')::numeric,0),
    'deliveryCard', coalesce((v_closing->>'delivery_card_sales')::numeric,0),
    'cashOut', coalesce((v_closing->>'cash_withdrawn_for_expenses')::numeric,0),
    'cashCountVerified', coalesce((v_closing->>'cash_count_verified')::boolean,false),
    'countedCash', coalesce((v_closing->>'counted_cash')::numeric,0),
    'obs', v_closing->>'observations',
    'channels', coalesce((select jsonb_agg(jsonb_build_object('name',x->>'channel_name','q',coalesce((x->>'order_count')::integer,0),'v',coalesce((x->>'amount')::numeric,0))) from jsonb_array_elements(coalesce(v_payload->'channel_sales','[]'::jsonb)) x),'[]'::jsonb),
    'online', jsonb_build_object(
      'anotaQtd', coalesce((select (x->>'order_count')::integer from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Anota Aí' limit 1),0),
      'anotaVal', coalesce((select (x->>'amount')::numeric from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Anota Aí' limit 1),0),
      'aiqQtd', coalesce((select (x->>'order_count')::integer from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Aiqfome' limit 1),0),
      'aiqVal', coalesce((select (x->>'amount')::numeric from jsonb_array_elements(coalesce(v_payload->'online_orders','[]'::jsonb)) x where x->>'platform'='Aiqfome' limit 1),0)
    ),
    'breads', jsonb_build_object(
      'idealStart', coalesce((select (x->>'opening_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Ideal' limit 1),0),
      'idealFinal', coalesce((select (x->>'closing_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Ideal' limit 1),0),
      'gourmetStart', coalesce((select (x->>'opening_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Gourmet' limit 1),0),
      'gourmetFinal', coalesce((select (x->>'closing_stock')::integer from jsonb_array_elements(coalesce(v_payload->'bread_controls','[]'::jsonb)) x where x->>'bread_type'='Pão Gourmet' limit 1),0)
    ),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('d',x->>'description','val',coalesce((x->>'amount')::numeric,0))) from jsonb_array_elements(coalesce(v_payload->'expenses','[]'::jsonb)) x),'[]'::jsonb)
  );

  v_result := public.save_cash_closing(v_record);
  return v_result;
end;
$function$;
