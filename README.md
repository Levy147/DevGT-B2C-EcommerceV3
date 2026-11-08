# Lunette

**Tienda de moda y accesorios Y2K / Coquette** — sitio estático para Guatemala.

> Tops, faldas, hoodies, bolsas, accesorios y outfits. Envíos a todo el país.

---

## Descripción

Lunette es una tienda en línea construida con HTML, CSS y JavaScript puro. No requiere instalación de dependencias ni servidor para funcionar: todo se ejecuta en el navegador y el carrito, los favoritos y el historial de pedidos se guardan en `localStorage`.

### Funcionalidades

- Catálogo con búsqueda y filtros por categoría, color, talla y precio.
- Orden por precio, nombre o valoración.
- Detalle de producto con galería de varias imágenes, selector de talla y cantidad.
- Carrito lateral y página de carrito con resumen.
- Checkout con datos de entrega, preventa y comprobante de pago opcional.
- Seguimiento de pedido por código (`seguimiento.html`).
- Favoritos sin necesidad de crear cuenta.
- Portal de administración (`portal.html`) con login Supabase, CRUD de productos
  y categorías, visibilidad, stock y configuración de la tienda.
- Panel de pedidos con filtros, detalle, historial, cambio de estado/pago,
  código de seguimiento y comprobante.
- Imágenes por producto usando URLs externas (incluye links de Google Drive).
- Páginas de FAQ, envíos y cambios, términos y privacidad.
- Diseño responsive con la paleta rosa/azul del tema boutique.

---

## Uso

Abre `index.html` en el navegador o publica la carpeta en cualquier hosting estático (GitHub Pages, Netlify, Vercel).

```bash
# Servidor local opcional
python -m http.server 8000
```

Luego visita `http://localhost:8000`.

---

## Estructura

```
index.html              Landing page
catalogo.html           Catálogo con filtros
Producto.html           Detalle de producto
carrito.html            Carrito y checkout
favoritos.html          Productos guardados
seguimiento.html        Seguimiento de pedido
portal.html             Panel de administración
calculadora.html        Calculadora de precios (interna)
faq.html                Preguntas frecuentes
politicas.html          Envíos y cambios
terminos.html           Términos y condiciones
privacidad.html         Aviso de privacidad
public/css/             Estilos del tema y ajustes de Lunette
public/js/              Datos, carrito y render de páginas
public/img/lunette/     Ilustraciones y recursos de marca
supabase/               Esquema, seed, pedidos y actualización SQL
```

---

## Base de datos (Supabase)

Ejecuta los scripts **en este orden** en Supabase → SQL Editor:

1. `supabase/schema.sql` — categorías, productos y perfiles con RLS.
2. `supabase/seed.sql` — catálogo demo (20 productos).
3. `supabase/orders.sql` — pedidos, seguimiento, comprobantes y configuración.
4. `supabase/upgrade.sql` — **solo si tu base ya existía** antes de esta versión
   (agrega `products.images` y la lectura pública de `store_settings`).

La URL y la llave pública (`anon` / `publishable`) se configuran en
`public/js/lunette-data.js`. **No uses la llave `service_role` en el navegador.**

---

## Cuentas y permisos

El portal usa Supabase Auth y valida el rol desde `profiles`.

1. Abre `portal.html` y crea una cuenta con "¿No tienes cuenta? Crear una"
   (o créala en Supabase → Authentication → Users).
2. En Supabase → SQL Editor, promueve esa cuenta a administrador:

```sql
update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
```

3. Vuelve a entrar al portal. Las cuentas sin rol `admin` no pueden administrar
   el catálogo. Los clientes de la tienda **no necesitan cuenta**: carrito,
   favoritos y pedidos locales viven en `localStorage`.

---

## Configuración de la tienda

Los valores editables (envío, contacto y banco) se leen desde la tabla
`public.store_settings`. Si la tabla no está disponible, la tienda usa los
valores locales de `lunette-data.js`.

Puedes editarlos desde **portal.html → Configuración de la tienda** o
directamente en Supabase → Table Editor → `store_settings`.

Claves disponibles:

| Clave | Uso |
|---|---|
| `shipping_fee` | Costo de envío en quetzales |
| `free_shipping_from` | Monto mínimo para envío gratis |
| `whatsapp` | Número internacional, sin espacios (ej. `50255555555`) |
| `email`, `instagram`, `instagram_url`, `tiktok`, `hours` | Contacto del footer |
| `bank_name`, `bank_account`, `bank_holder`, `bank_note` | Datos para transferencia/depósito |

El checkout **revalida precios, tallas y envío en el servidor** con la función
`create_order`, así que esos valores deben coincidir con `store_settings`.

### Panel de pedidos

En la primera sección del portal aparecen los últimos 200 pedidos. Puedes buscar
por código, cliente o teléfono, filtrar por estado y abrir el detalle para:

- Ver datos del cliente, productos, totales e historial de estados.
- Cambiar estado del pedido y del pago, y guardar el código de seguimiento.
- Abrir el comprobante con una URL firmada (bucket privado `comprobantes`).
- Copiar el código o abrir el seguimiento público.

El cambio de estado queda registrado automáticamente en `order_events`.

---

## Imágenes de producto

En el portal (`portal.html`) cada producto tiene:

- **Imagen principal (URL)** — se usa en tarjetas, carrito y como primera foto.
- **Imágenes adicionales** — una URL por línea; aparecen en la galería del detalle.

Puedes usar cualquier URL pública. Para **Google Drive**:

1. Sube la foto y compártela como "Cualquier persona con el enlace".
2. Copia el link normal (`https://drive.google.com/file/d/.../view`).
3. Pégalo tal cual en el portal: la tienda lo convierte a URL directa.

La primera imagen del arreglo es la principal. Si una URL falla, la tarjeta cae
en la imagen de la categoría.

---

## Pagos

**No hay pasarela de pagos integrada.** El flujo actual es manual:

- Transferencia bancaria, depósito o pago contra entrega.
- El cliente puede subir un comprobante a Supabase Storage (bucket privado
  `comprobantes`) o enviarlo después.
- El pedido queda en estado `pendiente` hasta que un administrador lo confirme.

Para cobrar con tarjeta haría falta integrar un proveedor (Stripe, PayPal,
Recurrente, etc.) con claves secretas y un backend/Edge Function; eso no se
incluye en este repo estático.

---

## Persistencia

| Clave | Contenido |
|---|---|
| `lunette_cart_v1` | Carrito |
| `lunette_favs_v1` | Favoritos |
| `lunette_orders_v1` | Pedidos confirmados (copia local) |
| `lunette_calc_history_v1` | Historial de la calculadora |

Los pedidos se guardan en Supabase (`orders`, `order_items`, `order_events`) y
también en local como respaldo. El seguimiento público se consulta por código.
