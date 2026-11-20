-- ============================================================
-- Lunette — Bucket público para fotos de productos
-- Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → Run
-- (Después de schema.sql, para que exista public.is_admin())
-- ============================================================

-- 1. Bucket público (lectura para todos, escritura solo admin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Cualquiera puede ver las fotos (la tienda las muestra)
drop policy if exists "productos_public_read" on storage.objects;
create policy "productos_public_read"
on storage.objects for select
using (bucket_id = 'productos');

-- 3. Solo administradores pueden subir, reemplazar o borrar
drop policy if exists "productos_admin_insert" on storage.objects;
create policy "productos_admin_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_admin_update" on storage.objects;
create policy "productos_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'productos' and public.is_admin())
with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_admin_delete" on storage.objects;
create policy "productos_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'productos' and public.is_admin());
