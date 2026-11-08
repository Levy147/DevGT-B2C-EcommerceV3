-- ============================================================
-- Lunette — Actualización para una base ya existente
-- Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → Run
-- Si instalas desde cero, no lo necesitas: usa schema.sql,
-- seed.sql y orders.sql (ya incluyen estos cambios).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Múltiples imágenes por producto
-- ------------------------------------------------------------

alter table public.products
  add column if not exists images jsonb default '[]'::jsonb;

-- Copia la imagen principal al arreglo para productos existentes.
update public.products
set images = jsonb_build_array(image)
where (images is null or images = '[]'::jsonb)
  and coalesce(image, '') <> '';

-- ------------------------------------------------------------
-- 2. Configuración pública de la tienda
--    (envío, contacto y datos bancarios)
-- ------------------------------------------------------------

create table if not exists public.store_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz default now()
);

alter table public.store_settings enable row level security;

insert into public.store_settings (key, value) values
  ('shipping_fee', '25'),
  ('free_shipping_from', '500'),
  ('whatsapp', ''),
  ('email', ''),
  ('instagram', ''),
  ('instagram_url', ''),
  ('tiktok', ''),
  ('hours', ''),
  ('bank_name', ''),
  ('bank_account', ''),
  ('bank_holder', ''),
  ('bank_note', '')
on conflict (key) do nothing;

drop policy if exists "store_settings_admin_all" on public.store_settings;
create policy "store_settings_admin_all"
on public.store_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "store_settings_read" on public.store_settings;
create policy "store_settings_read"
on public.store_settings for select
using (true);

grant select, insert, update, delete on public.store_settings to authenticated;
grant select on public.store_settings to anon;

-- ------------------------------------------------------------
-- 3. Cuenta administradora
--    La cuenta debe existir en Authentication → Users (o créala
--    desde portal.html → "Crear una"). Luego cambia el correo:
-- ------------------------------------------------------------

-- update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';

-- Si la cuenta existía antes del trigger de perfiles:
-- insert into public.profiles (id, email, role)
-- select id, email, 'admin' from auth.users where email = 'tu-correo@ejemplo.com'
-- on conflict (id) do update set role = 'admin';
