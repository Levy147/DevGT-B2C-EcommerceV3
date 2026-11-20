-- ============================================================
-- Lunette — Pedidos v2: idempotencia, anti-spam y bitácora inmutable
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Después de orders.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Idempotencia: una misma confirmación no crea pedidos duplicados
-- ------------------------------------------------------------

alter table public.orders add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_idx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

-- ------------------------------------------------------------
-- 2. Bitácora inmutable: order_events solo permite leer/insertar
--    (el admin ya no puede editar ni borrar eventos)
-- ------------------------------------------------------------

drop policy if exists "order_events_admin_all" on public.order_events;

drop policy if exists "order_events_admin_read" on public.order_events;
create policy "order_events_admin_read"
on public.order_events for select to authenticated
using (public.is_admin());

drop policy if exists "order_events_admin_insert" on public.order_events;
create policy "order_events_admin_insert"
on public.order_events for insert to authenticated
with check (public.is_admin());

revoke update, delete on public.order_events from authenticated;

-- ------------------------------------------------------------
-- 3. Registrar también los cambios de estado de pago
-- ------------------------------------------------------------

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, status, note)
    values (new.id, new.status, 'Estado actualizado');
  end if;

  if new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, status, note)
    values (
      new.id,
      new.status,
      'Pago: ' || coalesce(nullif(old.payment_status, ''), '—')
        || ' → ' || coalesce(nullif(new.payment_status, ''), '—')
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. create_order v2: idempotencia + límite por teléfono
-- ------------------------------------------------------------

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_code text;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_shipping_fee numeric(10,2) := 25;
  v_free_from numeric(10,2) := 500;
  v_payment_status text := 'pendiente';
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_size text;
  v_line_total numeric(10,2);
  v_items jsonb := '[]'::jsonb;
  v_count int := 0;
  v_idempotency text;
  v_existing public.orders%rowtype;
  v_recent int := 0;
begin
  if payload is null then
    raise exception 'Pedido inválido';
  end if;

  v_idempotency := nullif(trim(coalesce(payload->>'idempotency_key', '')), '');

  -- Si esta confirmación ya se registró, devolvemos el mismo pedido.
  if v_idempotency is not null then
    select * into v_existing
    from public.orders
    where idempotency_key = v_idempotency;

    if found then
      return jsonb_build_object(
        'order_id', v_existing.id,
        'code', v_existing.code,
        'subtotal', v_existing.subtotal,
        'shipping', v_existing.shipping,
        'total', v_existing.total,
        'status', v_existing.status,
        'payment_status', v_existing.payment_status,
        'duplicate', true
      );
    end if;
  end if;

  if coalesce((payload->>'preorder_accepted')::boolean, false) is not true then
    raise exception 'Debes aceptar las condiciones de preventa';
  end if;

  if payload->'items' is null
     or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'El pedido no tiene productos';
  end if;

  if coalesce(trim(payload->>'customer_name'), '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if coalesce(trim(payload->>'customer_phone'), '') = '' then
    raise exception 'El teléfono es obligatorio';
  end if;
  if coalesce(trim(payload->>'customer_address'), '') = '' then
    raise exception 'La dirección es obligatoria';
  end if;
  if coalesce(trim(payload->>'customer_city'), '') = '' then
    raise exception 'La ciudad es obligatoria';
  end if;

  if coalesce(payload->>'payment_method', '') not in
     ('Transferencia bancaria', 'Depósito', 'Pago contra entrega') then
    raise exception 'Método de pago inválido';
  end if;

  -- Anti-spam: máximo 3 pedidos por número cada 10 minutos.
  select count(*) into v_recent
  from public.orders
  where regexp_replace(customer_phone, '\D', '', 'g')
        = regexp_replace(trim(payload->>'customer_phone'), '\D', '', 'g')
    and created_at > now() - interval '10 minutes';

  if v_recent >= 3 then
    raise exception 'Recibimos varios pedidos seguidos desde este número. Espera unos minutos o escríbenos por WhatsApp.';
  end if;

  select coalesce(nullif(value, '')::numeric, 25) into v_shipping_fee
  from public.store_settings where key = 'shipping_fee';
  select coalesce(nullif(value, '')::numeric, 500) into v_free_from
  from public.store_settings where key = 'free_shipping_from';
  v_shipping_fee := coalesce(v_shipping_fee, 25);
  v_free_from := coalesce(v_free_from, 500);

  for v_item in select value from jsonb_array_elements(payload->'items')
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_product
    from public.products
    where id = coalesce((v_item->>'product_id')::bigint, -1)
      and active = true;

    if not found then
      raise exception 'Producto no disponible';
    end if;

    v_size := coalesce(v_item->>'size', '');
    if v_product.sizes is not null and array_length(v_product.sizes, 1) > 0 then
      if not (v_size = any(v_product.sizes)) then
        raise exception 'Talla no disponible para %', v_product.name;
      end if;
    end if;

    v_line_total := round(v_product.price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_count := v_count + 1;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'size', v_size,
      'qty', v_qty,
      'unit_price', v_product.price,
      'line_total', v_line_total
    ));
  end loop;

  if v_count = 0 then
    raise exception 'El pedido no tiene productos válidos';
  end if;

  v_shipping := case when v_subtotal >= v_free_from then 0 else v_shipping_fee end;
  v_total := v_subtotal + v_shipping;

  if payload->>'payment_method' = 'Pago contra entrega' then
    v_payment_status := 'contra_entrega';
  end if;

  v_code := 'LNT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  begin
    insert into public.orders (
      code, customer_name, customer_phone, customer_email,
      customer_address, customer_city, payment_method, payment_status,
      payment_reference, notes, subtotal, shipping, total,
      status, preorder_accepted, idempotency_key
    ) values (
      v_code,
      trim(payload->>'customer_name'),
      trim(payload->>'customer_phone'),
      coalesce(nullif(trim(payload->>'customer_email'), ''), ''),
      trim(payload->>'customer_address'),
      trim(payload->>'customer_city'),
      payload->>'payment_method',
      v_payment_status,
      coalesce(nullif(trim(payload->>'payment_reference'), ''), ''),
      coalesce(nullif(trim(payload->>'notes'), ''), ''),
      v_subtotal, v_shipping, v_total,
      'pendiente', true, v_idempotency
    ) returning id into v_order_id;
  exception when unique_violation then
    if v_idempotency is not null then
      select * into v_existing
      from public.orders
      where idempotency_key = v_idempotency;

      if found then
        return jsonb_build_object(
          'order_id', v_existing.id,
          'code', v_existing.code,
          'subtotal', v_existing.subtotal,
          'shipping', v_existing.shipping,
          'total', v_existing.total,
          'status', v_existing.status,
          'payment_status', v_existing.payment_status,
          'duplicate', true
        );
      end if;
    end if;
    raise;
  end;

  insert into public.order_items (order_id, product_id, product_name, size, qty, unit_price, line_total)
  select v_order_id,
         (value->>'product_id')::bigint,
         value->>'product_name',
         value->>'size',
         (value->>'qty')::int,
         (value->>'unit_price')::numeric,
         (value->>'line_total')::numeric
  from jsonb_array_elements(v_items) as item(value);

  insert into public.order_events (order_id, status, note)
  values (v_order_id, 'pendiente', 'Pedido recibido');

  return jsonb_build_object(
    'order_id', v_order_id,
    'code', v_code,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_total,
    'status', 'pendiente',
    'payment_status', v_payment_status
  );
end;
$$;

grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Límites al bucket de comprobantes (protección de storage)
-- ------------------------------------------------------------

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'comprobantes';
