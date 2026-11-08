/* ============================================================
   LUNETTE — Carrito, favoritos, pedidos y componentes
   ============================================================ */

const LF_CART_KEY = 'lunette_cart_v1';
const LF_FAVS_KEY = 'lunette_favs_v1';
const LF_ORDERS_KEY = 'lunette_orders_v1';

function lfMoney(value) {
  return 'Q' + Number(value || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function lfRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function lfWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function lfCart() {
  return lfRead(LF_CART_KEY, []);
}

function lfSaveCart(cart) {
  lfWrite(LF_CART_KEY, cart);
  lfRefreshCartUI();
  document.dispatchEvent(new CustomEvent('lf:cart'));
}

function lfFavs() {
  return lfRead(LF_FAVS_KEY, []);
}

function lfSaveFavs(favs) {
  lfWrite(LF_FAVS_KEY, favs);
  lfRefreshBadges();
  document.dispatchEvent(new CustomEvent('lf:favs'));
}

function lfOrders() {
  return lfRead(LF_ORDERS_KEY, []);
}

function lfSaveOrder(order) {
  const orders = lfOrders();
  orders.unshift(order);
  lfWrite(LF_ORDERS_KEY, orders);
}

function lfCartKey(id, size) {
  return String(id) + '::' + String(size || 'Única');
}

function lfCartCount() {
  return lfCart().reduce((total, line) => total + Number(line.qty || 0), 0);
}

function lfCartSubtotal() {
  return lfCart().reduce((total, line) => {
    const product = lunetteProductById(line.id);
    return total + (product ? product.price * line.qty : 0);
  }, 0);
}

function lfShipping(subtotal) {
  if (subtotal <= 0) return 0;
  return subtotal >= LUNETTE_STORE.freeShippingFrom ? 0 : LUNETTE_STORE.shipping;
}

function lfCartTotal() {
  const subtotal = lfCartSubtotal();
  return subtotal + lfShipping(subtotal);
}

function lfIsFavorite(id) {
  return lfFavs().includes(Number(id));
}

function lfToggleFavorite(id) {
  const productId = Number(id);
  const favs = lfFavs();
  const index = favs.indexOf(productId);
  if (index >= 0) {
    favs.splice(index, 1);
    lfSaveFavs(favs);
    lfToast('Eliminado de favoritos', 'info');
    return false;
  }
  favs.push(productId);
  lfSaveFavs(favs);
  lfToast('Guardado en favoritos ♥', 'success');
  return true;
}

function lfAddToCart(id, size, qty) {
  const product = lunetteProductById(id);
  if (!product) return;
  const chosenSize = size || product.sizes[0] || 'Única';
  const amount = Math.max(1, Number(qty) || 1);
  const key = lfCartKey(product.id, chosenSize);
  const cart = lfCart();
  const existing = cart.find(line => line.key === key);

  if (existing) {
    existing.qty += amount;
  } else {
    cart.push({ key, id: product.id, size: chosenSize, qty: amount });
  }

  lfSaveCart(cart);
  lfToast(product.name + ' agregado al carrito', 'success');
  lfOpenCart();
}

function lfUpdateQty(key, delta) {
  const cart = lfCart();
  const line = cart.find(item => item.key === key);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    lfSaveCart(cart.filter(item => item.key !== key));
    return;
  }
  lfSaveCart(cart);
}

function lfRemoveLine(key) {
  lfSaveCart(lfCart().filter(item => item.key !== key));
  lfToast('Producto eliminado', 'info');
}

function lfClearCart() {
  lfSaveCart([]);
}

function lfInitPetals() {
  if (document.querySelector('.petal-layer')) return;
  const layer = document.createElement('div');
  layer.className = 'petal-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const colors = [
    'var(--accent)', 'var(--primary)', 'var(--primary-dark)',
    'var(--primary-hover)', 'var(--accent-soft)'
  ];

  for (let index = 0; index < 20; index++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    const width = 40 + Math.random() * 30;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const animation = 'pd' + (1 + Math.floor(Math.random() * 10));
    const duration = 18 + Math.random() * 18;
    const delay = Math.random() * -36;
    const left = 2 + Math.random() * 96;
    Object.assign(petal.style, {
      width: width + 'px',
      height: (width * 1.3) + 'px',
      left: left + '%',
      background: `radial-gradient(ellipse at 30% 30%, ${color}, transparent 70%)`,
      animation: `${animation} ${duration}s ease-in-out infinite`,
      animationDelay: delay + 's'
    });
    layer.appendChild(petal);
  }
}

function lfToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" type="button" aria-label="Cerrar">×</button>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all .3s ease';
    window.setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function lfProductCard(product) {
  const badge = lunetteBadge(product);
  const fav = lfIsFavorite(product.id);
  const tint = Number(product.tint || 0);
  const image = lfProductImages(product)[0] || product.image;
  const oldPrice = product.oldPrice
    ? `<span class="lf-old-price">${lfMoney(product.oldPrice)}</span>`
    : '';

  return `
    <article class="product-card">
      <div class="product-card-image">
        <a href="${lunetteProductUrl(product)}" class="lf-card-image-link" aria-label="Ver ${product.name}">
          <img src="${image}" alt="${product.name}" loading="lazy" decoding="async" style="filter:hue-rotate(${tint}deg) saturate(1.08);">
        </a>
        <button class="favorite-btn ${fav ? 'active' : ''}" type="button"
                data-lf-fav="${product.id}" aria-label="${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
          ${fav ? '♥' : '♡'}
        </button>
        ${badge ? `<span class="badge ${badge.className} status-badge">${badge.label}</span>` : ''}
      </div>
      <div class="product-card-body">
        <h3><a href="${lunetteProductUrl(product)}">${product.name}</a></h3>
        <div class="product-sku">${product.sku}</div>
        <div class="category">${lunetteCategoryBySlug(product.category)?.name || product.category} · ${product.colors[0]}</div>
        <div class="price-row">
          <div>
            <div class="price">${lfMoney(product.price)} ${oldPrice}</div>
            <span class="price-label">Precio</span>
          </div>
          <div class="lf-rating">★ ${product.rating.toFixed(1)}</div>
        </div>
        <button class="btn btn-primary btn-sm btn-block lf-card-add" type="button"
                data-lf-add="${product.id}">Agregar al carrito</button>
      </div>
    </article>
  `;
}

function lfRenderGrid(container, products, emptyText) {
  if (!container) return;
  if (!products.length) {
    container.innerHTML = `
      <div class="catalog-empty" style="grid-column:1/-1;">
        <div class="empty-icon">♡</div>
        <h3>No encontramos productos</h3>
        <p>${emptyText || 'Prueba con otros filtros o categorías.'}</p>
      </div>
    `;
    return;
  }
  container.innerHTML = products.map(lfProductCard).join('');
}

function lfNavHTML() {
  const page = document.body.dataset.page || '';
  const isCatalog = page === 'catalog' || page === 'product';
  return `
    <nav class="navbar" id="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="navbar-logo"><span>ღ Lunette</span></a>
        <button class="menu-toggle" id="menuToggle" type="button" aria-label="Menú">≡</button>
        <div class="navbar-links" id="navbarLinks">
          <a href="index.html" class="${page === 'home' ? 'active' : ''}">Inicio</a>
          <a href="catalogo.html" class="${isCatalog ? 'active' : ''}">Catálogo</a>
          <a href="index.html#como-comprar">Cómo comprar</a>
          <a href="index.html#contacto">Contacto</a>
        </div>
        <div class="navbar-actions">
          <a class="btn-icon ${page === 'favorites' ? 'lf-icon-active' : ''}" href="favoritos.html" title="Favoritos" aria-label="Favoritos">
            ♡<span class="lf-count" data-fav-count hidden>0</span>
          </a>
          <a class="btn-icon ${page === 'account' ? 'lf-icon-active' : ''}" href="portal.html" aria-label="Iniciar sesión" style="background:#f7a8c4;color:#fff;padding:6px 12px;border-radius:999px;font-size:.85rem;text-decoration:none;width:auto;height:auto;">Login</a>
          <button class="btn-icon ${page === 'cart' ? 'lf-icon-active' : ''}" type="button" data-open-cart title="Carrito" aria-label="Abrir carrito">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M5.5 8.5h13l-1 11h-11l-1-11Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>
            </svg>
            <span class="lf-count" data-cart-count hidden>0</span>
          </button>
        </div>
      </div>
    </nav>
  `;
}

function lfFooterHTML() {
  const contact = [];
  if (LUNETTE_STORE.city) contact.push(`<p>◎ ${LUNETTE_STORE.city}, Guatemala</p>`);
  if (LUNETTE_STORE.email) contact.push(`<p>✉ <a href="mailto:${LUNETTE_STORE.email}">${LUNETTE_STORE.email}</a></p>`);
  if (LUNETTE_STORE.instagram && LUNETTE_STORE.instagramUrl) contact.push(`<p>♡ <a href="${LUNETTE_STORE.instagramUrl}" target="_blank" rel="noopener">${LUNETTE_STORE.instagram}</a></p>`);
  if (LUNETTE_STORE.whatsapp) contact.push(`<p><a href="${lfWhatsAppUrl('¡Hola Lunette! Quiero información sobre sus productos 🎀')}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a></p>`);
  if (LUNETTE_STORE.hours) contact.push(`<p>◷ ${LUNETTE_STORE.hours}</p>`);
  if (!contact.length) contact.push('<p>Muy pronto podrás escribirnos por WhatsApp e Instagram.</p>');

  return `
    <footer class="footer footer-accent" id="contacto">
      <div class="footer-inner">
        <div>
          <div class="footer-logo">ღ Lunette</div>
          <p class="text-serif-italic">Moda y accesorios Y2K / Coquette en Guatemala. Piezas cute para tu día a día, envíos a todo el país.</p>
        </div>
        <div>
          <h4>Explorar</h4>
          <a href="catalogo.html">Catálogo</a><br>
          <a href="catalogo.html?categoria=tops">Tops</a><br>
          <a href="catalogo.html?categoria=faldas">Faldas</a><br>
          <a href="catalogo.html?categoria=outfits">Outfits</a>
        </div>
        <div>
          <h4>Ayuda</h4>
          <a href="faq.html">Preguntas frecuentes</a><br>
          <a href="index.html#como-comprar">Cómo comprar</a><br>
          <a href="politicas.html">Envíos y cambios</a><br>
          <a href="terminos.html">Términos</a><br>
          <a href="privacidad.html">Privacidad</a>
        </div>
        <div>
          <h4>Contacto</h4>
          ${contact.join('')}
        </div>
      </div>
      <div class="footer-bottom footer-bottom-dark">
        <p>© 2026 Lunette - Guatemala. Todos los derechos reservados.</p>
        <p class="devgt-credit">Desarrollado por <strong>DevGT</strong></p>
      </div>
    </footer>
  `;
}

function lfDrawerHTML() {
  return `
    <div class="lf-overlay" id="lfCartOverlay" hidden></div>
    <aside class="lf-drawer" id="lfCartDrawer" aria-hidden="true" aria-label="Carrito de compras">
      <div class="lf-drawer-head">
        <h3>Tu carrito <span data-cart-count>0</span></h3>
        <button class="lf-drawer-close" type="button" data-close-cart aria-label="Cerrar">×</button>
      </div>
      <div class="lf-drawer-body" id="lfDrawerBody"></div>
      <div class="lf-drawer-foot" id="lfDrawerFoot"></div>
    </aside>
  `;
}

function lfCartLine(line) {
  const product = lunetteProductById(line.id);
  if (!product) return '';
  const image = lfProductImages(product)[0] || product.image;
  return `
    <div class="lf-cart-line">
      <img src="${image}" alt="${product.name}" loading="lazy" decoding="async" style="filter:hue-rotate(${Number(product.tint || 0)}deg);">
      <div class="lf-cart-line-info">
        <a href="${lunetteProductUrl(product)}">${product.name}</a>
        <span>Talla ${line.size}</span>
        <strong>${lfMoney(product.price)}</strong>
      </div>
      <div class="lf-cart-line-actions">
        <div class="lf-qty">
          <button type="button" data-lf-qty="-1" data-key="${line.key}" aria-label="Quitar uno">−</button>
          <span>${line.qty}</span>
          <button type="button" data-lf-qty="1" data-key="${line.key}" aria-label="Agregar uno">+</button>
        </div>
        <button class="lf-remove" type="button" data-lf-remove="${line.key}">Eliminar</button>
      </div>
    </div>
  `;
}

function lfRenderCartDrawer() {
  const body = document.getElementById('lfDrawerBody');
  const foot = document.getElementById('lfDrawerFoot');
  if (!body || !foot) return;
  const cart = lfCart();
  if (!cart.length) {
    body.innerHTML = `
      <div class="lf-empty-cart">
        <div class="lf-empty-icon">🛍</div>
        <h4>Tu carrito está vacío</h4>
        <p>Agrega tus piezas favoritas y vuelve por aquí.</p>
        <a href="catalogo.html" class="btn btn-primary btn-sm">Explorar catálogo</a>
      </div>
    `;
    foot.innerHTML = '';
    return;
  }

  body.innerHTML = cart.map(lfCartLine).join('');
  const subtotal = lfCartSubtotal();
  const shipping = lfShipping(subtotal);
  foot.innerHTML = `
    <div class="lf-summary-line"><span>Subtotal</span><strong>${lfMoney(subtotal)}</strong></div>
    <div class="lf-summary-line"><span>Envío</span><strong>${shipping ? lfMoney(shipping) : 'Gratis'}</strong></div>
    <div class="lf-summary-line lf-summary-total"><span>Total</span><strong>${lfMoney(subtotal + shipping)}</strong></div>
    <a href="carrito.html" class="btn btn-primary btn-block">Ir al carrito</a>
    <button class="lf-continue" type="button" data-close-cart>seguir comprando</button>
  `;
}

function lfOpenCart() {
  lfRenderCartDrawer();
  const overlay = document.getElementById('lfCartOverlay');
  const drawer = document.getElementById('lfCartDrawer');
  if (!overlay || !drawer) return;
  overlay.hidden = false;
  window.requestAnimationFrame(() => overlay.classList.add('open'));
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lf-no-scroll');
}

function lfCloseCart() {
  const overlay = document.getElementById('lfCartOverlay');
  const drawer = document.getElementById('lfCartDrawer');
  if (overlay) {
    overlay.classList.remove('open');
    window.setTimeout(() => { overlay.hidden = true; }, 220);
  }
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('lf-no-scroll');
}

function lfRefreshBadges() {
  const cartCount = lfCartCount();
  const favCount = lfFavs().length;
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    if (el.tagName === 'SPAN' && el.classList.contains('lf-count')) {
      el.textContent = cartCount;
      el.hidden = cartCount === 0;
    } else {
      el.textContent = cartCount;
    }
  });
  document.querySelectorAll('[data-fav-count]').forEach(el => {
    el.textContent = favCount;
    el.hidden = favCount === 0;
  });
}

function lfRefreshCartUI() {
  lfRefreshBadges();
  lfRenderCartDrawer();
}

function lfWhatsAppUrl(message) {
  const number = String(LUNETTE_STORE.whatsapp || '').replace(/\D/g, '');
  if (!number) return null;
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
}

function lfOrderMessage(order) {
  const lines = [
    '¡Hola Lunette! Quiero confirmar este pedido:',
    '',
    'Pedido: ' + order.code,
    ...order.items.map(item => `• ${item.name} · Talla ${item.size} · x${item.qty} · ${lfMoney(item.price * item.qty)}`),
    '',
    'Subtotal: ' + lfMoney(order.subtotal),
    'Envío: ' + (order.shipping ? lfMoney(order.shipping) : 'Gratis'),
    'Total: ' + lfMoney(order.total),
    '',
    'Datos de entrega:',
    'Nombre: ' + order.customer.name,
    'Teléfono: ' + order.customer.phone,
    'Correo: ' + (order.customer.email || '—'),
    'Dirección: ' + order.customer.address,
    'Ciudad: ' + order.customer.city,
    'Pago: ' + order.customer.payment,
    order.customer.notes ? 'Notas: ' + order.customer.notes : ''
  ].filter(Boolean);
  return lines.join('\n');
}

function lfChrome() {
  const navHost = document.querySelector('[data-lf-nav]');
  const footerHost = document.querySelector('[data-lf-footer]');
  const cartHost = document.querySelector('[data-lf-cart]');
  if (navHost) navHost.innerHTML = lfNavHTML();
  if (footerHost) footerHost.innerHTML = lfFooterHTML();
  if (cartHost) cartHost.innerHTML = lfDrawerHTML();
  lfRefreshCartUI();
  lfBindChrome();
}

function lfBindChrome() {
  const toggle = document.getElementById('menuToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.getElementById('navbarLinks')?.classList.toggle('open');
    });
  }

  const overlay = document.getElementById('lfCartOverlay');
  if (overlay) overlay.addEventListener('click', lfCloseCart);

  document.querySelectorAll('[data-open-cart]').forEach(btn => {
    btn.addEventListener('click', lfOpenCart);
  });
  document.querySelectorAll('[data-close-cart]').forEach(btn => {
    btn.addEventListener('click', lfCloseCart);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') lfCloseCart();
  });
}

async function lfInit() {
  lfInitPetals();
  try {
    if (typeof lfLoadStoreSettings === 'function') {
      await Promise.race([
        lfLoadStoreSettings(),
        new Promise(resolve => window.setTimeout(resolve, 4000))
      ]);
    }
  } catch (error) {
    console.warn('No se pudo cargar la configuración de la tienda; se usan los valores locales.', error);
  }
  lfChrome();
  try {
    if (typeof lfLoadRemoteCatalog === 'function') {
      await lfLoadRemoteCatalog();
    }
  } catch (error) {
    console.warn('No se pudo cargar el catálogo remoto; se usan los datos locales.', error);
  }
  document.dispatchEvent(new CustomEvent('lf:ready'));
}

document.addEventListener('click', event => {
  const fav = event.target.closest('[data-lf-fav]');
  if (fav) {
    event.preventDefault();
    lfToggleFavorite(fav.dataset.lfFav);
    return;
  }

  const add = event.target.closest('[data-lf-add]');
  if (add) {
    event.preventDefault();
    lfAddToCart(add.dataset.lfAdd);
    return;
  }

  const remove = event.target.closest('[data-lf-remove]');
  if (remove) {
    event.preventDefault();
    lfRemoveLine(remove.dataset.lfRemove);
    return;
  }

  const qty = event.target.closest('[data-lf-qty]');
  if (qty) {
    event.preventDefault();
    lfUpdateQty(qty.dataset.key, Number(qty.dataset.lfQty));
    return;
  }

  if (event.target.closest('[data-open-cart]')) {
    event.preventDefault();
    lfOpenCart();
    return;
  }

  if (event.target.closest('[data-close-cart]')) {
    event.preventDefault();
    lfCloseCart();
  }
});

document.addEventListener('lf:cart', lfRefreshCartUI);
document.addEventListener('lf:favs', () => {
  document.querySelectorAll('[data-lf-fav]').forEach(button => {
    const active = lfIsFavorite(button.dataset.lfFav);
    button.classList.toggle('active', active);
    button.textContent = active ? '♥' : '♡';
    button.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Agregar a favoritos');
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', lfInit);
} else {
  lfInit();
}
