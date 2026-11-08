/* ============================================================
   LUNETTE — Render de páginas
   ============================================================ */

function lfPageName() {
  return document.body.dataset.page || '';
}

function lfStars(rating) {
  const full = Math.round(rating || 0);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function lfProductImageStyle(product) {
  return `filter:hue-rotate(${Number(product.tint || 0)}deg) saturate(1.08);`;
}

/* ─── Home ─── */
function lfRenderHome() {
  const hero = document.getElementById('heroCarousel');
  if (hero) {
    const picks = LUNETTE_PRODUCTS.filter(p => p.badge === 'best' || p.badge === 'new').slice(0, 3);
    hero.innerHTML = `
      <div class="hc-slides">
        ${picks.map((product, index) => {
          const image = lfProductImages(product)[0] || product.image;
          return `
          <a href="${lunetteProductUrl(product)}" class="hc-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <img src="${image}" alt="${product.name}" loading="lazy" decoding="async" style="${lfProductImageStyle(product)}">
            <div class="hc-overlay">
              <span class="hc-badge">${lunetteCategoryBySlug(product.category)?.name || product.category}</span>
              <h3 class="hc-name">${product.name}</h3>
              <p class="hc-price">${lfMoney(product.price)}</p>
            </div>
          </a>
        `;
        }).join('')}
      </div>
      <div class="hc-dots">
        ${picks.map((_, index) => `<button class="hc-dot ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Slide ${index + 1}"></button>`).join('')}
      </div>
    `;

    const slides = hero.querySelectorAll('.hc-slide');
    const dots = hero.querySelectorAll('.hc-dot');
    let current = 0;
    const goTo = index => {
      slides.forEach(slide => slide.classList.remove('active'));
      dots.forEach(dot => dot.classList.remove('active'));
      slides[index]?.classList.add('active');
      dots[index]?.classList.add('active');
      current = index;
    };
    dots.forEach(dot => dot.addEventListener('click', () => goTo(Number(dot.dataset.index))));
    if (slides.length > 1) {
      window.setInterval(() => goTo((current + 1) % slides.length), 4200);
    }
  }

  const featured = document.getElementById('featuredSlider');
  if (featured) {
    const picks = LUNETTE_PRODUCTS.filter(p => p.badge === 'best' || p.badge === 'new').slice(0, 6);
    lfRenderGrid(featured, picks);
  }

  const categories = document.getElementById('homeCategories');
  if (categories) {
    categories.innerHTML = LUNETTE_CATEGORIES.map(category => `
      <a href="catalogo.html?categoria=${category.slug}" class="card category-card">
        <div class="lf-category-media"><img src="${lfImageUrl(category.image)}" alt="${category.name}" loading="lazy" decoding="async"></div>
        <div class="category-card-footer">
          <h3>${category.emoji} ${category.name}</h3>
          <p>${category.blurb}</p>
        </div>
      </a>
    `).join('');
  }

  const arrivals = document.getElementById('homeProducts');
  if (arrivals) {
    lfRenderGrid(arrivals, LUNETTE_PRODUCTS.slice(0, 8));
  }

  const contactText = document.getElementById('homeContactText');
  const contactButtons = document.getElementById('homeContactButtons');
  if (contactText && contactButtons) {
    const waUrl = LUNETTE_STORE.whatsapp
      ? lfWhatsAppUrl('¡Hola Lunette! Quiero información sobre sus productos 🎀')
      : null;
    const igUrl = LUNETTE_STORE.instagram && LUNETTE_STORE.instagramUrl
      ? LUNETTE_STORE.instagramUrl
      : null;

    contactText.textContent = (waUrl || igUrl)
      ? 'Escríbenos y te ayudamos a encontrar tu outfit ideal, o revisa las preguntas frecuentes.'
      : 'Muy pronto podrás escribirnos por WhatsApp e Instagram. Mientras tanto, explora el catálogo y revisa las preguntas frecuentes.';

    const extraButtons = [];
    if (waUrl) extraButtons.push(`<a href="${waUrl}" class="btn btn-primary btn-lg" target="_blank" rel="noopener">WhatsApp</a>`);
    if (igUrl) extraButtons.push(`<a href="${igUrl}" class="btn btn-secondary btn-lg" target="_blank" rel="noopener">${LUNETTE_STORE.instagram}</a>`);
    contactButtons.insertAdjacentHTML('afterbegin', extraButtons.join(''));
  }
}

function lfBindHomeSlider() {
  const track = document.getElementById('featuredSlider');
  const prev = document.getElementById('featuredPrev');
  const next = document.getElementById('featuredNext');
  if (!track) return;
  const step = 304;
  prev?.addEventListener('click', () => track.scrollBy({ left: -step, behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: step, behavior: 'smooth' }));
}

/* ─── Catalog ─── */
const lfCatalogState = {
  category: '',
  color: '',
  size: '',
  min: '',
  max: '',
  query: '',
  sort: 'default'
};

let lfFiltersStaticsBound = false;

function lfReadCatalogParams() {
  const params = new URLSearchParams(window.location.search);
  lfCatalogState.category = params.get('categoria') || '';
  lfCatalogState.color = params.get('color') || '';
  lfCatalogState.size = params.get('talla') || '';
  lfCatalogState.query = params.get('buscar') || '';
  lfCatalogState.min = params.get('min') || '';
  lfCatalogState.max = params.get('max') || '';
}

function lfSyncCatalogParams() {
  const params = new URLSearchParams();
  if (lfCatalogState.category) params.set('categoria', lfCatalogState.category);
  if (lfCatalogState.color) params.set('color', lfCatalogState.color);
  if (lfCatalogState.size) params.set('talla', lfCatalogState.size);
  if (lfCatalogState.query) params.set('buscar', lfCatalogState.query);
  if (lfCatalogState.min) params.set('min', lfCatalogState.min);
  if (lfCatalogState.max) params.set('max', lfCatalogState.max);
  const query = params.toString();
  const url = window.location.pathname + (query ? '?' + query : '');
  window.history.replaceState(null, '', url);
}

function lfBuildCatalogFilters() {
  const categoryHost = document.getElementById('filterCategorias');
  if (categoryHost) {
    categoryHost.innerHTML = `
      <button class="filter-category-btn ${!lfCatalogState.category ? 'active' : ''}" data-cat="">Todas</button>
      ${LUNETTE_CATEGORIES.map(category => `
        <button class="filter-category-btn ${lfCatalogState.category === category.slug ? 'active' : ''}" data-cat="${category.slug}">
          ${category.emoji} ${category.name}
        </button>
      `).join('')}
    `;
  }

  const colorHost = document.getElementById('filterColores');
  if (colorHost) {
    const colorMap = {
      'Rosa': '#f9a8d4', 'Blanco': '#ffffff', 'Negro': '#27272a', 'Marfil': '#f5f0df',
      'Lavanda': '#c4b5fd', 'Plateado': '#cbd5e1', 'Dorado': '#e6c56a', 'Cereza': '#be123c',
      'Denim claro': '#93c5fd', 'Denim rosa': '#f9a8d4', 'Lila': '#d8b4fe', 'Magenta': '#db2777',
      'Rosa pastel': '#fbcfe8', 'Rosa metal': '#e879f9', 'Perla': '#f1f5f9', 'Rojo': '#dc2626'
    };
    colorHost.innerHTML = LUNETTE_COLORS.map(color => `
      <button class="color-swatch ${lfCatalogState.color === color ? 'active' : ''}"
              data-color="${color}" title="${color}" aria-label="${color}"
              style="background:${colorMap[color] || '#f9a8d4'};"></button>
    `).join('');
  }

  const sizeHost = document.getElementById('filterTallas');
  if (sizeHost) {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'Única'];
    sizeHost.innerHTML = sizes.map(size => `
      <button class="size-chip ${lfCatalogState.size === size ? 'active' : ''}" data-size="${size}">${size}</button>
    `).join('');
  }

  const search = document.getElementById('catalogSearch');
  if (search) search.value = lfCatalogState.query;
  const min = document.getElementById('precioMin');
  if (min) min.value = lfCatalogState.min;
  const max = document.getElementById('precioMax');
  if (max) max.value = lfCatalogState.max;
  const sort = document.getElementById('sortSelect');
  if (sort) sort.value = lfCatalogState.sort;

  document.querySelectorAll('[data-cat]').forEach(button => {
    button.addEventListener('click', () => {
      lfCatalogState.category = button.dataset.cat;
      document.querySelectorAll('[data-cat]').forEach(btn => btn.classList.toggle('active', btn === button));
      lfApplyCatalogFilters();
    });
  });

  document.querySelectorAll('[data-color]').forEach(button => {
    button.addEventListener('click', () => {
      const color = button.dataset.color;
      lfCatalogState.color = lfCatalogState.color === color ? '' : color;
      document.querySelectorAll('[data-color]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === lfCatalogState.color);
      });
      lfApplyCatalogFilters();
    });
  });

  document.querySelectorAll('[data-size]').forEach(button => {
    button.addEventListener('click', () => {
      const size = button.dataset.size;
      lfCatalogState.size = lfCatalogState.size === size ? '' : size;
      document.querySelectorAll('[data-size]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === lfCatalogState.size);
      });
      lfApplyCatalogFilters();
    });
  });

  if (lfFiltersStaticsBound) return;
  lfFiltersStaticsBound = true;

  search?.addEventListener('input', () => {
    lfCatalogState.query = search.value.trim();
    lfApplyCatalogFilters();
  });

  min?.addEventListener('input', () => {
    lfCatalogState.min = min.value;
    lfApplyCatalogFilters();
  });
  max?.addEventListener('input', () => {
    lfCatalogState.max = max.value;
    lfApplyCatalogFilters();
  });

  sort?.addEventListener('change', () => {
    lfCatalogState.sort = sort.value;
    lfApplyCatalogFilters();
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    Object.assign(lfCatalogState, { category: '', color: '', size: '', min: '', max: '', query: '', sort: 'default' });
    lfBuildCatalogFilters();
    lfApplyCatalogFilters();
  });

  document.getElementById('applyFilters')?.addEventListener('click', lfApplyCatalogFilters);

  const toggle = document.getElementById('filtersToggle');
  const sidebar = document.getElementById('filtersSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('lf-open'));
  }
}

function lfApplyCatalogFilters() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  let products = LUNETTE_PRODUCTS.slice();
  const state = lfCatalogState;

  if (state.category) products = products.filter(p => p.category === state.category);
  if (state.color) products = products.filter(p => p.colors.includes(state.color));
  if (state.size) products = products.filter(p => p.sizes.includes(state.size));
  if (state.min !== '') products = products.filter(p => p.price >= Number(state.min));
  if (state.max !== '') products = products.filter(p => p.price <= Number(state.max));

  if (state.query) {
    const query = state.query.toLowerCase();
    products = products.filter(product => {
      const category = lunetteCategoryBySlug(product.category)?.name || '';
      return [product.name, product.description, product.sku, category, ...product.colors]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  if (state.sort === 'precio-asc') products.sort((a, b) => a.price - b.price);
  if (state.sort === 'precio-desc') products.sort((a, b) => b.price - a.price);
  if (state.sort === 'nombre') products.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === 'rating') products.sort((a, b) => b.rating - a.rating);

  lfRenderGrid(grid, products, 'Prueba con otra categoría, color o rango de precio.');
  const count = document.getElementById('resultCount');
  if (count) {
    count.textContent = `Mostrando ${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
  }
  lfSyncCatalogParams();
}

function lfRenderCatalog() {
  lfReadCatalogParams();
  lfBuildCatalogFilters();
  lfApplyCatalogFilters();
}

/* ─── Product detail ─── */
function lfRenderProductDetail() {
  const host = document.getElementById('productDetail');
  if (!host) return;

  const params = new URLSearchParams(window.location.search);
  const product = lunetteProductById(params.get('id') || params.get('producto'));

  if (!product) {
    host.innerHTML = `
      <div class="catalog-empty" style="grid-column:1/-1;">
        <div class="empty-icon">♡</div>
        <h3>No encontramos ese producto</h3>
        <p>Puede que ya no esté disponible. Mira el resto de la colección.</p>
        <a href="catalogo.html" class="btn btn-primary" style="margin-top:18px;">Ver catálogo</a>
      </div>
    `;
    return;
  }

  document.title = product.name + ' · Lunette';
  const category = lunetteCategoryBySlug(product.category);
  const badge = lunetteBadge(product);
  const favorite = lfIsFavorite(product.id);
  const images = lfProductImages(product);
  const mainImage = images[0] || product.image;
  const oldPrice = product.oldPrice
    ? `<span class="lf-detail-old">${lfMoney(product.oldPrice)}</span>`
    : '';

  host.innerHTML = `
    <div class="product-gallery">
      <div class="product-main-image">
        <img id="lfMainImage" src="${mainImage}" alt="${product.name}" decoding="async" style="${lfProductImageStyle(product)}">
      </div>
      <div class="product-thumbnails">
        ${images.map((image, index) => `
          <button class="product-thumbnail ${index === 0 ? 'active' : ''}" type="button"
                  data-lf-gallery="${image}" aria-label="Ver imagen ${index + 1}">
            <img src="${image}" alt="${product.name} ${index + 1}" loading="lazy" decoding="async" style="${lfProductImageStyle(product)}">
          </button>
        `).join('')}
      </div>
    </div>

    <div class="product-info">
      <div class="product-category">${category?.emoji || '♡'} ${category?.name || product.category}</div>
      <h1>${product.name}</h1>
      <div class="product-sku">${product.sku}</div>
      ${badge ? `<span class="badge ${badge.className}">${badge.label}</span>` : ''}

      <div class="lf-detail-rating">
        <span>${lfStars(product.rating)}</span>
        ${product.rating.toFixed(1)} · ${product.reviews} reseñas
      </div>

      <div class="lf-detail-price-row">
        <div class="product-price">${lfMoney(product.price)}</div>
        ${oldPrice}
      </div>
      <div class="product-price-sub">Precio en quetzales · Envío ${lfMoney(LUNETTE_STORE.shipping)}</div>

      <p class="product-description">${product.description}</p>

      <div class="product-meta">
        <span class="product-meta-item">✦ ${product.colors.join(' / ')}</span>
        <span class="product-meta-item">♡ ${product.sizes.join(' · ')}</span>
      </div>

      <div class="lf-option-label">Talla <span>${product.sizes.length > 1 ? 'Elige la tuya' : 'Talla única'}</span></div>
      <div class="lf-size-row" id="lfSizeRow">
        ${product.sizes.map((size, index) => `
          <button class="lf-size-pill ${index === 0 ? 'active' : ''}" type="button" data-size="${size}">${size}</button>
        `).join('')}
      </div>

      <div class="lf-option-label">Cantidad</div>
      <div class="lf-detail-actions">
        <div class="lf-qty">
          <button type="button" id="lfQtyMinus" aria-label="Quitar uno">−</button>
          <span id="lfQtyValue">1</span>
          <button type="button" id="lfQtyPlus" aria-label="Agregar uno">+</button>
        </div>
        <button class="btn btn-primary" type="button" id="lfDetailAdd">Agregar al carrito</button>
        <button class="lf-fav-detail ${favorite ? 'active' : ''}" type="button" id="lfDetailFav" aria-label="Favorito">
          ${favorite ? '♥' : '♡'}
        </button>
      </div>

      <div class="lf-ship-note">
        <strong>Envío gratis</strong> en compras desde ${lfMoney(LUNETTE_STORE.freeShippingFrom)}. Entregas en ${LUNETTE_STORE.city} y departamentos.
      </div>

      <div class="lf-option-label" style="margin-top:24px;">Detalles</div>
      <ul class="lf-detail-list">
        ${product.details.map(detail => `<li>${detail}</li>`).join('')}
      </ul>
    </div>
  `;

  let quantity = 1;
  const qtyValue = document.getElementById('lfQtyValue');
  document.getElementById('lfQtyMinus')?.addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    qtyValue.textContent = quantity;
  });
  document.getElementById('lfQtyPlus')?.addEventListener('click', () => {
    quantity = Math.min(99, quantity + 1);
    qtyValue.textContent = quantity;
  });

  document.querySelectorAll('#lfSizeRow .lf-size-pill').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#lfSizeRow .lf-size-pill').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  document.querySelectorAll('[data-lf-gallery]').forEach(button => {
    button.addEventListener('click', () => {
      const mainImageEl = document.getElementById('lfMainImage');
      if (mainImageEl) mainImageEl.src = button.dataset.lfGallery;
      document.querySelectorAll('[data-lf-gallery]').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  document.getElementById('lfDetailAdd')?.addEventListener('click', () => {
    const size = document.querySelector('#lfSizeRow .lf-size-pill.active')?.dataset.size || product.sizes[0];
    lfAddToCart(product.id, size, quantity);
  });

  document.getElementById('lfDetailFav')?.addEventListener('click', function () {
    const active = lfToggleFavorite(product.id);
    this.classList.toggle('active', active);
    this.textContent = active ? '♥' : '♡';
  });

  const relatedIds = [];
  LUNETTE_PRODUCTS
    .filter(item => item.category === product.category && item.id !== product.id)
    .forEach(item => relatedIds.push(item.id));
  LUNETTE_PRODUCTS
    .filter(item => item.id !== product.id && !relatedIds.includes(item.id))
    .forEach(item => relatedIds.push(item.id));

  const related = relatedIds.slice(0, 4).map(lunetteProductById);
  lfRenderGrid(document.getElementById('relatedGrid'), related);
}

/* ─── Cart page ─── */
function lfRenderCartPage() {
  const host = document.getElementById('lfCartContent');
  if (!host) return;
  const cart = lfCart();

  if (!cart.length) {
    host.innerHTML = `
      <div class="catalog-empty" style="padding:60px 24px;">
        <div class="empty-icon">🛍</div>
        <h3>Tu carrito está vacío</h3>
        <p>Agrega tus piezas favoritas para comenzar tu pedido.</p>
        <a href="catalogo.html" class="btn btn-primary" style="margin-top:18px;">Explorar catálogo</a>
      </div>
    `;
    return;
  }

  const subtotal = lfCartSubtotal();
  const shipping = lfShipping(subtotal);
  const total = subtotal + shipping;
  const missing = Math.max(0, LUNETTE_STORE.freeShippingFrom - subtotal);
  const progress = Math.min(100, (subtotal / LUNETTE_STORE.freeShippingFrom) * 100);

  host.innerHTML = `
    <div class="lf-cart-layout">
      <div>
        <div class="lf-cart-table">
          <div class="lf-cart-table-head">
            <span>Producto</span><span>Precio</span><span>Total</span>
          </div>
          ${cart.map(line => {
            const product = lunetteProductById(line.id);
            if (!product) return '';
            const image = lfProductImages(product)[0] || product.image;
            return `
              <div class="lf-cart-row">
                <div class="lf-cart-product">
                  <img src="${image}" alt="${product.name}" loading="lazy" decoding="async" style="${lfProductImageStyle(product)}">
                  <div>
                    <a href="${lunetteProductUrl(product)}">${product.name}</a>
                    <span>Talla ${line.size} · ${product.sku}</span>
                    <div class="lf-qty" style="margin-top:8px;">
                      <button type="button" data-lf-qty="-1" data-key="${line.key}" aria-label="Quitar uno">−</button>
                      <span>${line.qty}</span>
                      <button type="button" data-lf-qty="1" data-key="${line.key}" aria-label="Agregar uno">+</button>
                    </div>
                  </div>
                </div>
                <div class="lf-cart-row-price">${lfMoney(product.price)}</div>
                <div class="lf-cart-row-total">
                  ${lfMoney(product.price * line.qty)}
                  <button class="lf-remove" type="button" data-lf-remove="${line.key}">Eliminar</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="lf-checkout">
          <h3>Datos de entrega</h3>
          <p>Completa tus datos para registrar tu pedido. Te contactaremos para coordinar el pago y la entrega.</p>
          <form id="lfCheckoutForm" novalidate>
            <div class="lf-form-grid">
              <div class="form-group lf-full">
                <label for="lfName">Nombre completo *</label>
                <input type="text" id="lfName" name="name" required placeholder="Tu nombre">
              </div>
              <div class="form-group">
                <label for="lfPhone">Teléfono / WhatsApp *</label>
                <input type="tel" id="lfPhone" name="phone" required placeholder="5555 5555">
              </div>
              <div class="form-group">
                <label for="lfEmail">Correo electrónico</label>
                <input type="email" id="lfEmail" name="email" placeholder="tu@correo.com">
              </div>
              <div class="form-group lf-full">
                <label for="lfAddress">Dirección de entrega *</label>
                <input type="text" id="lfAddress" name="address" required placeholder="Zona, calle, número de casa">
              </div>
              <div class="form-group">
                <label for="lfCity">Ciudad / Departamento *</label>
                <input type="text" id="lfCity" name="city" required placeholder="Guatemala">
              </div>
              <div class="form-group">
                <label for="lfPayment">Método de pago *</label>
                <select id="lfPayment" name="payment" required>
                  <option value="Transferencia bancaria">Transferencia bancaria</option>
                  <option value="Pago contra entrega">Pago contra entrega</option>
                  <option value="Depósito">Depósito</option>
                </select>
              </div>
              <div class="form-group" id="lfReferenceGroup">
                <label for="lfReference">Referencia de pago</label>
                <input type="text" id="lfReference" name="payment_reference" placeholder="Número de boleta o transferencia">
              </div>
              <div class="lf-full">
                <div class="lf-payment-info" id="lfPaymentInfo"></div>
              </div>
              <div class="form-group lf-full" id="lfProofGroup">
                <label for="lfProof">Comprobante de pago (opcional)</label>
                <input type="file" id="lfProof" name="proof" accept="image/*,application/pdf">
                <p class="lf-free-note" style="margin:6px 0 0;">Puedes subirlo ahora o enviarlo después por WhatsApp.</p>
              </div>
              <div class="form-group lf-full">
                <label for="lfNotes">Notas del pedido</label>
                <textarea id="lfNotes" name="notes" placeholder="Referencias de entrega, horario, etc."></textarea>
              </div>
              <div class="lf-full">
                <label class="lf-preorder" for="lfPreorder">
                  <input type="checkbox" id="lfPreorder" name="preorder" required>
                  <span>Entiendo que este pedido es una <strong>preventa</strong> con entrega estimada de <strong>20 a 40 días hábiles</strong>. Acepto que no hay cambios por talla y que el reembolso solo aplica si el producto no llega o llega dañado.</span>
                </label>
              </div>
              <div class="lf-full">
                <div class="lf-checkout-error" id="lfCheckoutError" hidden></div>
                <button class="btn btn-primary btn-block" id="lfCheckoutSubmit" type="submit">Confirmar pedido</button>
                <p class="lf-free-note" style="margin:10px 0 0;">Al confirmar registramos tu pedido en nuestro sistema y te contactamos para coordinar el pago.</p>
              </div>
            </div>
          </form>
          <div class="lf-success" id="lfOrderSuccess" hidden></div>
        </div>
      </div>

      <aside class="lf-cart-summary">
        <h3>Resumen del pedido</h3>
        <div class="lf-summary-line"><span>Subtotal</span><strong>${lfMoney(subtotal)}</strong></div>
        <div class="lf-summary-line"><span>Envío</span><strong>${shipping ? lfMoney(shipping) : 'Gratis'}</strong></div>
        <div class="lf-summary-line lf-summary-total"><span>Total</span><strong>${lfMoney(total)}</strong></div>
        ${missing > 0
          ? `<div class="lf-freebar"><span style="width:${progress}%"></span></div>
             <p class="lf-free-note">Te faltan <strong>${lfMoney(missing)}</strong> para envío gratis.</p>`
          : `<p class="lf-free-note">¡Felicidades! Tienes envío gratis.</p>`}
        <div class="lf-summary-line"><span>Productos</span><strong>${lfCartCount()}</strong></div>
        <p class="lf-free-note">Al confirmar registramos tu pedido y coordinamos el pago y la entrega contigo. Te contactaremos al teléfono que indiques.</p>
        <a href="catalogo.html" class="btn btn-secondary btn-block btn-sm">Seguir comprando</a>
      </aside>
    </div>
  `;

  const paymentSelect = document.getElementById('lfPayment');
  const paymentInfo = document.getElementById('lfPaymentInfo');
  const proofGroup = document.getElementById('lfProofGroup');
  const referenceGroup = document.getElementById('lfReferenceGroup');
  const bank = LUNETTE_STORE.bank || {};

  const updatePaymentInfo = () => {
    const method = paymentSelect.value;
    const isCod = method === 'Pago contra entrega';
    proofGroup.hidden = isCod;
    referenceGroup.hidden = isCod;
    if (isCod) {
      paymentInfo.innerHTML = '<strong>Pago contra entrega:</strong> pagas al recibir tu pedido. Te llamaremos para confirmar la entrega.';
      return;
    }
    const label = method === 'Depósito' ? 'depósito' : 'transferencia';
    if (bank.account) {
      paymentInfo.innerHTML = `<strong>Datos para ${label}:</strong><br>${bank.bank || ''} · ${bank.account}<br>Titular: ${bank.holder || '—'}<br>${bank.note || 'Envía tu comprobante al confirmar el pedido.'}`;
    } else {
      paymentInfo.innerHTML = `<strong>Pago por ${label}:</strong> al confirmar el pedido te enviaremos los datos bancarios para completar el pago.`;
    }
  };
  paymentSelect?.addEventListener('change', updatePaymentInfo);
  updatePaymentInfo();

  document.getElementById('lfCheckoutForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = document.getElementById('lfCheckoutError');
    const submitBtn = document.getElementById('lfCheckoutSubmit');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const customer = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      address: String(data.get('address') || '').trim(),
      city: String(data.get('city') || '').trim(),
      payment: String(data.get('payment') || '').trim(),
      paymentReference: String(data.get('payment_reference') || '').trim(),
      notes: String(data.get('notes') || '').trim()
    };
    const cartItems = lfCart().map(line => {
      const product = lunetteProductById(line.id);
      return {
        id: line.id,
        name: product ? product.name : 'Producto',
        size: line.size,
        qty: line.qty,
        price: product ? product.price : 0
      };
    });
    if (!cartItems.length) return;

    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando pedido…';

    let result = null;
    try {
      const client = await lfGetSupabaseClient();
      if (!client) throw new Error('Supabase no está disponible');
      const { data: rpcData, error } = await client.rpc('create_order', {
        payload: {
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email,
          customer_address: customer.address,
          customer_city: customer.city,
          payment_method: customer.payment,
          payment_reference: customer.paymentReference,
          notes: customer.notes,
          preorder_accepted: true,
          items: cartItems.map(item => ({
            product_id: Number(item.id),
            size: item.size,
            qty: Number(item.qty)
          }))
        }
      });
      if (error) throw error;
      result = rpcData;
    } catch (error) {
      console.error('No se pudo registrar el pedido en Supabase:', error);
      errorBox.textContent = 'No pudimos registrar tu pedido en este momento. Revisa tu conexión e inténtalo de nuevo.';
      errorBox.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar pedido';
      return;
    }

    const proofFile = document.getElementById('lfProof')?.files?.[0];
    if (result?.code && proofFile) {
      try {
        const client = await lfGetSupabaseClient();
        if (client) {
          const ext = (proofFile.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `orders/${result.code}/${Date.now()}.${ext}`;
          const { error: uploadError } = await client.storage
            .from('comprobantes')
            .upload(path, proofFile, { upsert: true, contentType: proofFile.type || undefined });
          if (uploadError) throw uploadError;
          await client.rpc('attach_payment_proof', {
            p_code: result.code,
            p_path: path,
            p_reference: customer.paymentReference
          });
        }
      } catch (error) {
        console.warn('No se pudo subir el comprobante:', error);
      }
    }

    const order = {
      code: result?.code || 'LNT-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      items: cartItems,
      subtotal: Number(result?.subtotal ?? subtotal),
      shipping: Number(result?.shipping ?? shipping),
      total: Number(result?.total ?? total),
      customer,
      status: result?.status || 'pendiente'
    };

    lfSaveOrder(order);
    lfWrite(LF_CART_KEY, []);
    lfRefreshBadges();
    lfRenderCartDrawer();

    const success = document.getElementById('lfOrderSuccess');
    const waUrl = lfWhatsAppUrl(lfOrderMessage(order));
    success.innerHTML = `
      <h3>¡Pedido registrado! 🎀</h3>
      <p>Guarda tu número de pedido:</p>
      <div class="lf-order-code">${order.code}</div>
      <p>Te contactaremos para confirmar el pago y la entrega.</p>
      <p class="lf-free-note">Preventa con entrega estimada de 20 a 40 días hábiles.</p>
      <div class="lf-success-actions">
        <a class="btn btn-primary" href="seguimiento.html?code=${encodeURIComponent(order.code)}">Seguir mi pedido</a>
        ${waUrl ? `<a class="btn btn-secondary" href="${waUrl}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}
        <a class="btn btn-secondary" href="catalogo.html">Seguir comprando</a>
      </div>
    `;
    success.hidden = false;
    form.remove();
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lfToast('Pedido registrado correctamente', 'success');
  });
}

/* ─── Favorites page ─── */
function lfRenderFavorites() {
  const grid = document.getElementById('favoritesGrid');
  if (!grid) return;
  const favorites = LUNETTE_PRODUCTS.filter(product => lfIsFavorite(product.id));
  if (!favorites.length) {
    grid.innerHTML = `
      <div class="catalog-empty" style="grid-column:1/-1;">
        <div class="empty-icon">♡</div>
        <h3>Todavía no tienes favoritos</h3>
        <p>Toca el corazón en cualquier producto para guardarlo aquí.</p>
        <a href="catalogo.html" class="btn btn-primary" style="margin-top:18px;">Descubrir productos</a>
      </div>
    `;
    return;
  }
  lfRenderGrid(grid, favorites);
}

/* ─── Tracking page ─── */
const LF_ORDER_STATUS = {
  pendiente: { label: 'Pedido recibido', icon: '1', note: 'Recibimos tu pedido y estamos revisando los detalles.' },
  confirmado: { label: 'Confirmado', icon: '2', note: 'Confirmamos tu pedido y el pago.' },
  pedido_proveedor: { label: 'Pedido al proveedor', icon: '3', note: 'Estamos comprando tu producto.' },
  en_camino: { label: 'En camino', icon: '4', note: 'Tu pedido va en camino.' },
  entregado: { label: 'Entregado', icon: '5', note: '¡Disfruta tu pedido!' },
  cancelado: { label: 'Cancelado', icon: '×', note: 'El pedido fue cancelado.' }
};

const LF_PAYMENT_STATUS = {
  pendiente: 'Pendiente de pago',
  comprobante_enviado: 'Comprobante recibido',
  pagado: 'Pagado',
  contra_entrega: 'Pago contra entrega',
  reembolsado: 'Reembolsado'
};

function lfTrackingStatusHTML(status) {
  if (status === 'cancelado') {
    return '<div class="lf-track-cancelled">Este pedido fue cancelado.</div>';
  }
  const steps = ['pendiente', 'confirmado', 'pedido_proveedor', 'en_camino', 'entregado'];
  const currentIndex = Math.max(0, steps.indexOf(status));
  return `
    <div class="lf-track-timeline">
      ${steps.map((step, index) => {
        const meta = LF_ORDER_STATUS[step];
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
        return `
          <div class="lf-track-step ${state}">
            <span class="lf-track-dot">${index < currentIndex ? '✓' : meta.icon}</span>
            <div>
              <strong>${meta.label}</strong>
              <p>${meta.note}</p>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function lfTrackingResultHTML(order) {
  const status = LF_ORDER_STATUS[order.status] || LF_ORDER_STATUS.pendiente;
  const payment = LF_PAYMENT_STATUS[order.payment_status] || order.payment_status;
  const created = order.created_at
    ? new Date(order.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const items = (order.items || []).map(item => `
    <div class="lf-track-item">
      <span>${item.product_name}${item.size ? ` · Talla ${item.size}` : ''} × ${item.qty}</span>
      <strong>${lfMoney(Number(item.line_total))}</strong>
    </div>
  `).join('');
  const events = (order.events || []).slice().reverse().map(event => `
    <li>
      <span>${event.created_at ? new Date(event.created_at).toLocaleString('es-GT') : ''}</span>
      <strong>${(LF_ORDER_STATUS[event.status] || {}).label || event.status}</strong>
      ${event.note ? `<p>${event.note}</p>` : ''}
    </li>
  `).join('');

  return `
    <div class="lf-track-card">
      <div class="lf-track-head">
        <div>
          <span class="lf-track-label">Pedido</span>
          <h2>${order.code}</h2>
          <p>Creado el ${created}</p>
        </div>
        <span class="lf-track-badge">${status.label}</span>
      </div>

      <div class="lf-track-meta">
        <div><span>Pago</span><strong>${payment}</strong></div>
        <div><span>Método</span><strong>${order.payment_method || '—'}</strong></div>
        ${order.tracking_code ? `<div><span>Guía</span><strong>${order.tracking_code}</strong></div>` : ''}
        <div><span>Entrega</span><strong>${order.customer_city || '—'}</strong></div>
      </div>

      ${lfTrackingStatusHTML(order.status)}

      <div class="lf-track-grid">
        <div>
          <h3>Productos</h3>
          ${items || '<p class="lf-free-note">Sin productos.</p>'}
          <div class="lf-track-totals">
            <div><span>Subtotal</span><strong>${lfMoney(Number(order.subtotal))}</strong></div>
            <div><span>Envío</span><strong>${Number(order.shipping) ? lfMoney(Number(order.shipping)) : 'Gratis'}</strong></div>
            <div class="lf-track-total"><span>Total</span><strong>${lfMoney(Number(order.total))}</strong></div>
          </div>
        </div>
        <div>
          <h3>Historial</h3>
          <ul class="lf-track-events">${events || '<li><span>Sin eventos todavía.</span></li>'}</ul>
        </div>
      </div>

      <p class="lf-track-note">¿Dudas con tu pedido? Escríbenos y comparte tu código <strong>${order.code}</strong>.</p>
    </div>
  `;
}

async function lfLoadTracking(code) {
  const resultHost = document.getElementById('lfTrackResult');
  if (!resultHost) return;
  resultHost.innerHTML = '<p class="lf-track-loading">Buscando tu pedido…</p>';
  try {
    const client = await lfGetSupabaseClient();
    if (!client) throw new Error('Supabase no está disponible');
    const { data, error } = await client.rpc('track_order', { p_code: code });
    if (error) throw error;
    if (!data) {
      resultHost.innerHTML = `
        <div class="catalog-empty" style="padding:40px 24px;">
          <div class="empty-icon">🔎</div>
          <h3>No encontramos ese pedido</h3>
          <p>Revisa que el código esté completo (ej. LNT-AB12CD34) e inténtalo de nuevo.</p>
        </div>
      `;
      return;
    }
    resultHost.innerHTML = lfTrackingResultHTML(data);
  } catch (error) {
    console.error('No se pudo consultar el pedido:', error);
    resultHost.innerHTML = '<div class="lf-track-error">No pudimos consultar tu pedido en este momento. Inténtalo de nuevo más tarde.</div>';
  }
}

function lfRenderTracking() {
  const host = document.getElementById('lfTrackingContent');
  if (!host) return;
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase();

  host.innerHTML = `
    <form class="lf-track-search" id="lfTrackForm">
      <label for="lfTrackCode">Número de pedido</label>
      <div class="lf-track-search-row">
        <input type="text" id="lfTrackCode" name="code" placeholder="LNT-XXXXXXXX" autocomplete="off" required>
        <button class="btn btn-primary" type="submit">Consultar</button>
      </div>
    </form>
    <div id="lfTrackResult" class="lf-track-result"></div>
  `;
  document.getElementById('lfTrackCode').value = code;

  document.getElementById('lfTrackForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('code') || '').trim().toUpperCase();
    if (!value) return;
    window.location.href = 'seguimiento.html?code=' + encodeURIComponent(value);
  });

  if (code) lfLoadTracking(code);
}

/* ─── Init ─── */
function lfRenderCurrentPage() {
  switch (lfPageName()) {
    case 'home':
      lfRenderHome();
      lfBindHomeSlider();
      break;
    case 'catalog':
      lfRenderCatalog();
      break;
    case 'product':
      lfRenderProductDetail();
      break;
    case 'cart':
      lfRenderCartPage();
      break;
    case 'favorites':
      lfRenderFavorites();
      break;
    case 'tracking':
      lfRenderTracking();
      break;
  }
}

function lfPagesInit() {
  lfRenderCurrentPage();
  document.addEventListener('lf:cart', () => {
    if (lfPageName() === 'cart') lfRenderCartPage();
  });
  document.addEventListener('lf:favs', () => {
    if (lfPageName() === 'favorites') lfRenderFavorites();
  });
}

document.addEventListener('lf:ready', lfPagesInit, { once: true });
