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
- Checkout con datos de entrega, preventa Temu (8–30 días hábiles) y comprobante de pago opcional.
- Seguimiento de pedido por código (`seguimiento.html`) con transportadora y enlace de guía.
- Favoritos sin necesidad de crear cuenta.
- Portal de administración (`portal.html`) con login Supabase, CRUD de productos
  y categorías, visibilidad, stock y configuración de la tienda.
- Panel de pedidos con filtros, detalle, historial, cambio de estado/pago,
  transportadora, código y enlace de guía, notas de seguimiento y comprobante.
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
5. `supabase/storage-products.sql` — bucket público `productos` para subir las
   fotos desde el portal (lectura pública, escritura solo admin).
6. `supabase/orders-v2.sql` — idempotencia, límite anti-spam por teléfono,
   bitácora inmutable de eventos y límites al bucket `comprobantes`.
7. `supabase/delivery-mode.sql` — modo preventa Temu (sin pago contra entrega),
   columnas `carrier` y `tracking_url`, historial de guías, `track_order` v2 y
   tabla privada `product_costs` para costos internos.

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
- Cambiar estado del pedido y del pago, y guardar transportadora, código y
  enlace de guía (Forza, CPS u otro courier).
- Agregar una nota manual al historial (por ejemplo, “En aduana” o una segunda
  guía si Temu divide el pedido en varios paquetes).
- Abrir el comprobante con una URL firmada (bucket privado `comprobantes`).
- Copiar el código o abrir el seguimiento público.

El cambio de estado, pago o guía queda registrado automáticamente en
`order_events`.

### Modo Temu

La tienda trabaja como preventa: el cliente paga, se compra en Temu y el
paquete llega directo a su dirección por un courier local.

| Etapa real | Estado en el portal |
|---|---|
| Pedido pagado en Temu | `confirmado` |
| Almacén prepara / recoge / empaca | `pedido_proveedor` |
| Vuelo, aduana, bodega LATAM | `en_camino` + nota |
| Forza / CPS en ruta | `en_camino` + transportadora y guía |
| Entregado | `entregado` |

Tiempo estimado: **8 a 30 días hábiles** (normalmente 2 a 4 semanas). Si Temu
divide el pedido en varios paquetes, guarda la guía principal en los campos de
envío y registra las demás con una **nota de historial**. El cliente ve la
transportadora y el enlace de rastreo, no el proveedor.

---

## Imágenes de producto

En el portal (`portal.html`) cada producto tiene un recuadro **“Subir fotos del
producto”**: toca y elige una o varias fotos desde el celular o la computadora.
Se suben a Supabase Storage (bucket público `productos`) y quedan listas; la
primera foto es la principal. Puedes quitar cualquiera con la **×** sobre la
miniatura.

Las fotos se **optimizan automáticamente** antes de subirlas: se reducen a un
máximo de 1600 px y se convierten a WebP (~500 KB), así rinde mucho más el
almacenamiento. Formatos: JPG, PNG, WEBP, GIF o AVIF, hasta 25 MB por foto
original (los GIF se suben sin cambios para conservar la animación). Las fotos
HEIC del iPhone deben convertirse a JPG.

Si prefieres, en **Opciones avanzadas** también puedes pegar URLs directamente.
Para **Google Drive**:

1. Sube la foto y compártela como "Cualquier persona con el enlace".
2. Copia el link normal (`https://drive.google.com/file/d/.../view`).
3. Pégalo tal cual en el portal: la tienda lo convierte a URL directa.

La primera imagen del arreglo es la principal. Si una URL falla, la tarjeta cae
en la imagen de la categoría.

---

## Pagos

**No se construye una pasarela propia.** Se usa un proveedor externo y el flujo
es manual: el cliente paga primero y luego se compra el pedido al proveedor.

- Transferencia bancaria o depósito: el cliente puede subir un comprobante al
  bucket privado `comprobantes` de Supabase Storage o enviarlo después.
- Tarjeta: el cliente elige **“Tarjeta (link de pago)”**. Al confirmar se le
  indica que recibirá el link por WhatsApp. **No se ofrece pago contra entrega**
  en modo Temu.
- Para cobrar con tarjeta se usa **Recurrente** (Guatemala, 4.5% + Q2 en cuenta
  comercial, links de pago, API y ACH). Crea el link en su dashboard por el total
  exacto del pedido.
- En el portal, abre el pedido y pega la URL en **Link de pago (Recurrente)**.
  El estado pasa a `link_enviado` y el cliente ve un botón **“Pagar con tarjeta”**
  en `seguimiento.html`. Usa **Copiar** para enviar el link por WhatsApp.
- Cuando el pago se acredite, marca el pedido como `pagado` y continúa a
  `confirmado` / `pedido_proveedor`.

Más adelante se puede automatizar con una Edge Function y webhooks de Recurrente
(crear el link y marcar `pagado` automáticamente). Nunca uses la llave
`service_role` en el navegador.

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

La página `mis-pedidos.html` muestra los pedidos guardados en el dispositivo y
consulta su estado real en Supabase. Para pedidos hechos en otro dispositivo se
busca por código (redirige a `seguimiento.html`).

### Idempotencia y anti-spam

- Cada confirmación de checkout envía un `idempotency_key`; si la misma
  confirmación se reintenta, `create_order` devuelve el pedido existente en vez
  de duplicarlo.
- `create_order` limita a 3 pedidos por número de teléfono cada 10 minutos.
- El formulario incluye un campo honeypot y un tiempo mínimo de espera.
- `order_events` es una bitácora inmutable: solo se insertan eventos (los
  triggers registran cambios de estado y de pago); el admin no puede editarlos
  ni borrarlos.
