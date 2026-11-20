-- ============================================================
-- Lunette — Modo Temu: preventa, guías y costos privados
-- Ejecutar después de supabase/orders-v2.sql
-- Supabase → SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. Modo de entrega de la tienda
--    local    = dropshipping local, entrega 24-72h, permite COD
--    preorder = preventa (Temu), 8-30 días hábiles, sin COD
-- ------------------------------------------------------------
insert into public.store_settings (key, value)
values ('delivery_mode', 'preorder')
on conflict (key) do update set value = 'preorder';

alter table public.orders
  add column if not exists delivery_mode text not null default 'preorder';
alter table public.orders
  alter column delivery_mode set default 'preorder';

-- ------------------------------------------------------------
-- 1.1 Datos de la guía del courier local (Forza, CPS, etc.)
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists carrier text not null default '',
  add column if not exists tracking_url text not null default '',
  add column if not exists payment_link text not null default '';

-- ------------------------------------------------------------
-- 2. Costos y proveedor por producto (privado, solo admin)
--    Se guardan en una tabla aparte para que el catálogo público
--    nunca exponga el costo ni el proveedor.
-- ------------------------------------------------------------
create table if not exists public.product_costs (
  product_id bigint primary key references public.products(id) on delete cascade,
  cost numeric(10,2) not null default 0 check (cost >= 0),
  supplier text not null default '',
  updated_at timestamptz default now()
);

alter table public.product_costs enable row level security;

drop policy if exists "product_costs_admin_all" on public.product_costs;
create policy "product_costs_admin_all"
on public.product_costs for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists product_costs_updated_at on public.product_costs;
create trigger product_costs_updated_at
before update on public.product_costs
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.product_costs to authenticated;

-- ------------------------------------------------------------
-- 2.1 Registrar también los cambios de guía en el historial
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

  if new.tracking_code is distinct from old.tracking_code
     or new.carrier is distinct from old.carrier
     or new.tracking_url is distinct from old.tracking_url then
    insert into public.order_events (order_id, status, note)
    values (
      new.id,
      new.status,
      'Guía: ' || coalesce(nullif(new.carrier, ''), 'courier')
        || ' · ' || coalesce(nullif(new.tracking_code, ''), 'sin código')
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. create_order v3: respeta el modo de entrega
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
  v_delivery_mode text := 'preorder';
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

  select coalesce(nullif(value, ''), 'preorder') into v_delivery_mode
  from public.store_settings where key = 'delivery_mode';
  v_delivery_mode := coalesce(v_delivery_mode, 'preorder');
  if v_delivery_mode not in ('local', 'preorder') then
    v_delivery_mode := 'preorder';
  end if;

  if v_delivery_mode = 'preorder' then
    if coalesce((payload->>'preorder_accepted')::boolean, false) is not true then
      raise exception 'Debes aceptar las condiciones de preventa';
    end if;
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
     ('Transferencia bancaria', 'Depósito', 'Tarjeta (link de pago)', 'Pago contra entrega') then
    raise exception 'Método de pago inválido';
  end if;

  if v_delivery_mode = 'preorder'
     and payload->>'payment_method' = 'Pago contra entrega' then
    raise exception 'El pago contra entrega no está disponible para preventa';
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
      status, preorder_accepted, idempotency_key, delivery_mode
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
      'pendiente',
      case when v_delivery_mode = 'preorder' then true else false end,
      v_idempotency,
      v_delivery_mode
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
    'payment_status', v_payment_status,
    'delivery_mode', v_delivery_mode
  );
end;
$$;

grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. track_order v2: incluye transportadora y enlace de guía
-- ------------------------------------------------------------
create or replace function public.track_order(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_events jsonb;
begin
  select * into v_order
  from public.orders
  where upper(code) = upper(trim(p_code));

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', product_name,
    'size', size,
    'qty', qty,
    'unit_price', unit_price,
    'line_total', line_total
  ) order by id), '[]'::jsonb)
  into v_items
  from public.order_items
  where order_id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'status', status,
    'note', note,
    'created_at', created_at
  ) order by created_at), '[]'::jsonb)
  into v_events
  from public.order_events
  where order_id = v_order.id;

  return jsonb_build_object(
    'code', v_order.code,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'subtotal', v_order.subtotal,
    'shipping', v_order.shipping,
    'total', v_order.total,
    'delivery_mode', v_order.delivery_mode,
    'carrier', v_order.carrier,
    'tracking_code', v_order.tracking_code,
    'tracking_url', v_order.tracking_url,
    'payment_link', v_order.payment_link,
    'created_at', v_order.created_at,
    'customer_name', v_order.customer_name,
    'customer_city', v_order.customer_city,
    'items', v_items,
    'events', v_events
  );
end;
$$;

grant execute on function public.track_order(text) to anon, authenticated;

-- Refresca el esquema expuesto por PostgREST (columnas nuevas).
notify pgrst, 'reload schema';
