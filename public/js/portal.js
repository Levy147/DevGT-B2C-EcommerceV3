/* ============================================================
   Lunette — Portal de administración
   Requiere: @supabase/supabase-js + public/js/lunette-data.js
   ============================================================ */

(function () {
  'use strict';

  const state = {
    client: null,
    session: null,
    profile: null,
    categories: [],
    products: [],
    orders: [],
    ordersError: '',
    settings: {},
    settingsError: '',
    editingId: null,
    currentOrderId: null,
    filter: '',
    categoryFilter: '',
    orderFilter: '',
    orderStatusFilter: '',
    busy: false,
    uploading: false
  };

  const PRODUCT_IMAGE_BUCKET = 'productos';
  const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 1600;
  const IMAGE_QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];
  const TARGET_IMAGE_BYTES = 500 * 1024;
  const PRODUCT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

  let els = {};
  let uploadStatusTimer = null;

  /* ─── Utilidades ─── */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function splitLines(value) {
    return String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
  }

  function splitCommas(value) {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  function setBusy(busy) {
    state.busy = busy;
    document.body.style.cursor = busy ? 'progress' : '';
  }

  function showLoginMessage(text, type) {
    els.loginMessage.textContent = text;
    els.loginMessage.className = 'portal-message' + (type ? ' ' + type : '');
    els.loginMessage.hidden = false;
  }

  function hideLoginMessage() {
    els.loginMessage.hidden = true;
  }

  function message(text, type) {
    els.appMessage.textContent = text;
    els.appMessage.className = 'portal-message' + (type ? ' ' + type : '');
    els.appMessage.hidden = false;
    clearTimeout(message.timer);
    message.timer = setTimeout(() => { els.appMessage.hidden = true; }, 5000);
  }

  const ORDER_STATUS = {
    pendiente: 'Pedido recibido',
    confirmado: 'Confirmado',
    pedido_proveedor: 'Pedido al proveedor',
    en_camino: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };

  const PAYMENT_STATUS = {
    pendiente: 'Pendiente',
    link_enviado: 'Link de pago enviado',
    comprobante_enviado: 'Comprobante recibido',
    pagado: 'Pagado',
    contra_entrega: 'Contra entrega',
    reembolsado: 'Reembolsado'
  };

  const ORDER_TONE = {
    pendiente: 'warning',
    confirmado: 'info',
    pedido_proveedor: 'info',
    en_camino: 'info',
    entregado: 'ok',
    cancelado: 'danger'
  };

  const PAYMENT_TONE = {
    pendiente: 'warning',
    link_enviado: 'info',
    comprobante_enviado: 'info',
    pagado: 'ok',
    contra_entrega: 'info',
    reembolsado: 'danger'
  };

  /* ─── Vistas ─── */

  function showLogin() {
    els.appView.hidden = true;
    els.loginView.hidden = false;
    els.loginForm.hidden = false;
    els.signupForm.hidden = true;
    els.toggleSignup.textContent = '¿No tienes cuenta? Crear una';
    els.userEmail.textContent = '';
    state.session = null;
    state.profile = null;
    state.products = [];
    state.categories = [];
    state.orders = [];
    state.ordersError = '';
    state.settings = {};
    state.settingsError = '';
    state.currentOrderId = null;
  }

  function showApp(session) {
    els.loginView.hidden = true;
    els.appView.hidden = false;
    els.userEmail.textContent = session.user.email || '';
  }

  async function handleSession(session) {
    state.session = session;
    const { data, error } = await state.client
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      showLogin();
      showLoginMessage('No se pudo verificar tu cuenta: ' + error.message, 'error');
      return;
    }

    if (!data || data.role !== 'admin') {
      await state.client.auth.signOut();
      showLogin();
      showLoginMessage(
        'Tu cuenta no tiene permisos de administrador. Ejecuta el SQL del final de supabase/schema.sql con tu correo y vuelve a entrar.',
        'error'
      );
      return;
    }

    state.profile = data;
    showApp(session);
    await loadAll();
  }

  /* ─── Datos ─── */

  async function loadAll() {
    setBusy(true);
    const [categoriesResult, productsResult, ordersResult, settingsResult] = await Promise.all([
      state.client.from('categories').select('*').order('sort_order', { ascending: true }),
      state.client.from('products').select('*').order('id', { ascending: true }),
      state.client
        .from('orders')
        .select('*, order_items(*), order_events(*)')
        .order('created_at', { ascending: false })
        .limit(200),
      state.client.from('store_settings').select('key,value')
    ]);
    setBusy(false);

    if (categoriesResult.error) {
      message('No se pudieron cargar las categorías: ' + categoriesResult.error.message, 'error');
      return;
    }
    if (productsResult.error) {
      message('No se pudieron cargar los productos: ' + productsResult.error.message, 'error');
      return;
    }

    state.categories = categoriesResult.data || [];
    state.products = productsResult.data || [];
    state.orders = ordersResult.error ? [] : (ordersResult.data || []);
    state.ordersError = ordersResult.error ? ordersResult.error.message : '';

    state.settings = {};
    state.settingsError = settingsResult.error ? settingsResult.error.message : '';
    if (!settingsResult.error) {
      (settingsResult.data || []).forEach(row => {
        state.settings[row.key] = row.value;
      });
    }

    renderAll();
  }

  async function loadOrders() {
    setBusy(true);
    const { data, error } = await state.client
      .from('orders')
      .select('*, order_items(*), order_events(*)')
      .order('created_at', { ascending: false })
      .limit(200);
    setBusy(false);

    state.orders = error ? [] : (data || []);
    state.ordersError = error ? error.message : '';
    renderStats();
    renderOrders();
    message(error ? 'No se pudieron cargar los pedidos: ' + error.message : 'Pedidos actualizados.', error ? 'error' : 'ok');
  }

  function renderAll() {
    renderStats();
    fillOrderStatusFilter();
    fillCategorySelects();
    renderTable();
    renderCategories();
    renderOrders();
    renderSettings();
  }

  function renderStats() {
    const total = state.products.length;
    const active = state.products.filter(product => product.active).length;
    const categories = state.categories.length;
    const hidden = total - active;
    const orders = state.orders.length;
    const pendingOrders = state.orders.filter(order => order.status === 'pendiente').length;

    els.stats.innerHTML = [
      statCard(total, 'Productos'),
      statCard(active, 'Visibles'),
      statCard(hidden, 'Ocultos'),
      statCard(categories, 'Categorías'),
      statCard(orders, 'Pedidos'),
      statCard(pendingOrders, 'Pedidos pendientes')
    ].join('');
  }

  function statCard(value, label) {
    return '<div class="portal-stat"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></div>';
  }

  function categoryById(id) {
    return state.categories.find(category => String(category.id) === String(id)) || null;
  }

  function fillCategorySelects() {
    const formValue = els.fieldCategory.value;
    els.fieldCategory.innerHTML = '<option value="">Sin categoría</option>' +
      state.categories.map(category =>
        '<option value="' + category.id + '">' + escapeHtml(category.name) + '</option>'
      ).join('');
    els.fieldCategory.value = formValue;

    const filterValue = state.categoryFilter;
    els.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>' +
      state.categories.map(category =>
        '<option value="' + category.id + '">' + escapeHtml(category.name) + '</option>'
      ).join('');
    els.categoryFilter.value = filterValue;
  }

  function filteredProducts() {
    const search = state.filter.trim().toLowerCase();
    return state.products.filter(product => {
      const category = categoryById(product.category_id);
      const haystack = [product.name, product.sku, category ? category.name : '']
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesCategory = !state.categoryFilter || String(product.category_id) === state.categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }

  function renderTable() {
    const products = filteredProducts();

    if (!products.length) {
      els.productsBody.innerHTML = '<tr><td colspan="8" class="portal-empty">' +
        (state.products.length ? 'No hay resultados para tu búsqueda.' : 'No hay productos todavía.') +
        '</td></tr>';
    } else {
      els.productsBody.innerHTML = products.map(productRow).join('');
    }

    els.emptyState.hidden = state.products.length > 0;
  }

  function productRow(product) {
    const category = categoryById(product.category_id);
    const thumb = product.image
      ? '<img src="' + escapeHtml(lfImageUrl(product.image)) + '" alt="">'
      : '<span>' + escapeHtml(String(product.name || '?').charAt(0)) + '</span>';

    return '<tr>' +
      '<td><div class="portal-thumb">' + thumb + '</div></td>' +
      '<td><div class="portal-name">' + escapeHtml(product.name) + '</div>' +
        '<div class="portal-sku">' + escapeHtml(product.sku || 'Sin SKU') + '</div></td>' +
      '<td>' + escapeHtml(product.sku || '—') + '</td>' +
      '<td>' + escapeHtml(category ? category.name : '—') + '</td>' +
      '<td>Q ' + Number(product.price || 0).toFixed(2) + '</td>' +
      '<td>' + Number(product.stock || 0) + '</td>' +
      '<td><label class="portal-switch">' +
        '<input type="checkbox" data-action="toggle" data-id="' + product.id + '"' + (product.active ? ' checked' : '') + '>' +
        (product.active ? 'Sí' : 'No') +
      '</label></td>' +
      '<td><div class="portal-row-actions">' +
        '<button type="button" data-action="edit" data-id="' + product.id + '">Editar</button>' +
        '<button type="button" class="delete" data-action="delete" data-id="' + product.id + '">Eliminar</button>' +
      '</div></td>' +
    '</tr>';
  }

  function renderCategories() {
    if (!state.categories.length) {
      els.categoriesList.innerHTML = '<span class="portal-muted">Sin categorías todavía.</span>';
      return;
    }
    els.categoriesList.innerHTML = state.categories.map(category =>
      '<span class="portal-chip">' +
        escapeHtml(category.emoji || '♡') + ' ' + escapeHtml(category.name) +
        ' <button type="button" data-action="delete-category" data-id="' + category.id + '" title="Eliminar categoría">×</button>' +
      '</span>'
    ).join('');
  }

  /* ─── Pedidos ─── */

  function fillOrderStatusFilter() {
    const value = state.orderStatusFilter;
    els.orderStatusFilter.innerHTML = '<option value="">Todos los estados</option>' +
      Object.entries(ORDER_STATUS).map(([key, label]) =>
        '<option value="' + key + '">' + escapeHtml(label) + '</option>'
      ).join('');
    els.orderStatusFilter.value = value;
  }

  function filteredOrders() {
    const search = state.orderFilter.trim().toLowerCase();
    return state.orders.filter(order => {
      const haystack = [
        order.code,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
        order.carrier,
        order.tracking_code
      ].join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = !state.orderStatusFilter || order.status === state.orderStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  function statusChip(label, tone) {
    return '<span class="portal-status is-' + (tone || 'info') + '">' + escapeHtml(label) + '</span>';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-GT', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function money(value) {
    return 'Q ' + Number(value || 0).toFixed(2);
  }

  function renderOrders() {
    if (state.ordersError) {
      els.ordersBody.innerHTML = '<tr><td colspan="6" class="portal-empty">' +
        'No se pudieron cargar los pedidos: ' + escapeHtml(state.ordersError) +
        '</td></tr>';
      els.ordersEmptyState.hidden = true;
      return;
    }

    if (!state.orders.length) {
      els.ordersBody.innerHTML = '';
      els.ordersEmptyState.hidden = false;
      return;
    }

    els.ordersEmptyState.hidden = true;
    const orders = filteredOrders();
    if (!orders.length) {
      els.ordersBody.innerHTML = '<tr><td colspan="6" class="portal-empty">' +
        'No hay pedidos que coincidan con el filtro.</td></tr>';
    } else {
      els.ordersBody.innerHTML = orders.map(orderRow).join('');
    }
  }

  function orderRow(order) {
    const orderLabel = ORDER_STATUS[order.status] || order.status || '—';
    const paymentLabel = PAYMENT_STATUS[order.payment_status] || order.payment_status || '—';
    return '<tr>' +
      '<td><div class="portal-name">' + escapeHtml(order.code) + '</div>' +
        '<div class="portal-sku">' + escapeHtml(formatDate(order.created_at)) + '</div></td>' +
      '<td><div class="portal-name">' + escapeHtml(order.customer_name) + '</div>' +
        '<div class="portal-sku">' + escapeHtml(order.customer_phone) + '</div></td>' +
      '<td>' + escapeHtml(money(order.total)) + '</td>' +
      '<td>' + statusChip(paymentLabel, PAYMENT_TONE[order.payment_status]) + '</td>' +
      '<td>' + statusChip(orderLabel, ORDER_TONE[order.status]) + '</td>' +
      '<td><div class="portal-row-actions">' +
        '<button type="button" data-action="view-order" data-id="' + order.id + '">Ver detalle</button>' +
      '</div></td>' +
    '</tr>';
  }

  function orderStatusOptions(selected) {
    return Object.entries(ORDER_STATUS).map(([key, label]) =>
      '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
    ).join('');
  }

  function paymentStatusOptions(selected) {
    return Object.entries(PAYMENT_STATUS).map(([key, label]) =>
      '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' +
        escapeHtml(label) + '</option>'
    ).join('');
  }

  function openOrderModal(order) {
    if (!order) return;
    state.currentOrderId = order.id;
    els.orderModalTitle.textContent = 'Pedido ' + order.code;

    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const events = Array.isArray(order.order_events) ? order.order_events.slice().reverse() : [];
    const proof = order.payment_proof_path
      ? '<button type="button" class="portal-btn ghost" data-action="view-proof" data-path="' +
          escapeHtml(order.payment_proof_path) + '">Ver comprobante</button>'
      : '<span class="portal-muted">Sin comprobante</span>';
    const trackingUrl = safeUrl(order.tracking_url);
    const paymentLink = safeUrl(order.payment_link);

    const itemRows = items.length
      ? items.map(item =>
          '<tr>' +
            '<td>' + escapeHtml(item.product_name) + '</td>' +
            '<td>' + escapeHtml(item.size || '—') + '</td>' +
            '<td>' + escapeHtml(item.color || '—') + '</td>' +
            '<td>' + Number(item.qty || 0) + '</td>' +
            '<td>' + escapeHtml(money(item.unit_price)) + '</td>' +
            '<td>' + escapeHtml(money(item.line_total)) + '</td>' +
          '</tr>'
        ).join('')
      : '<tr><td colspan="6" class="portal-muted">Sin productos registrados.</td></tr>';

    const eventRows = events.length
      ? events.map(event =>
          '<li><strong>' + escapeHtml(ORDER_STATUS[event.status] || event.status || '—') + '</strong>' +
            '<span>' + escapeHtml(formatDateTime(event.created_at)) + '</span>' +
            (event.note ? '<p>' + escapeHtml(event.note) + '</p>' : '') +
          '</li>'
        ).join('')
      : '<li class="portal-muted">Sin historial todavía.</li>';

    els.orderDetail.innerHTML =
      '<div class="portal-order-grid">' +
        '<div class="portal-order-block">' +
          '<h3>Cliente</h3>' +
          '<dl class="portal-kv">' +
            '<dt>Nombre</dt><dd>' + escapeHtml(order.customer_name) + '</dd>' +
            '<dt>Teléfono</dt><dd><a href="tel:' + escapeHtml(order.customer_phone) + '">' + escapeHtml(order.customer_phone) + '</a></dd>' +
            '<dt>Correo</dt><dd>' + escapeHtml(order.customer_email || '—') + '</dd>' +
            '<dt>Ciudad</dt><dd>' + escapeHtml(order.customer_city) + '</dd>' +
            '<dt>Dirección</dt><dd>' + escapeHtml(order.customer_address) + '</dd>' +
          '</dl>' +
          '<h3>Pago</h3>' +
          '<dl class="portal-kv">' +
            '<dt>Método</dt><dd>' + escapeHtml(order.payment_method || '—') + '</dd>' +
            '<dt>Estado</dt><dd>' + statusChip(PAYMENT_STATUS[order.payment_status] || order.payment_status || '—', PAYMENT_TONE[order.payment_status]) + '</dd>' +
            '<dt>Link de pago</dt><dd>' + (paymentLink
              ? '<a href="' + escapeHtml(paymentLink) + '" target="_blank" rel="noopener">Abrir link</a> ' +
                '<button type="button" class="portal-btn ghost" data-action="copy-payment-link" data-link="' +
                escapeHtml(paymentLink) + '">Copiar</button>'
              : '—') + '</dd>' +
            '<dt>Referencia</dt><dd>' + escapeHtml(order.payment_reference || '—') + '</dd>' +
            '<dt>Comprobante</dt><dd>' + proof + '</dd>' +
          '</dl>' +
          (order.notes ? '<h3>Nota del cliente</h3><p class="portal-order-note">' + escapeHtml(order.notes) + '</p>' : '') +
        '</div>' +
        '<div class="portal-order-block">' +
          '<h3>Envío</h3>' +
          '<dl class="portal-kv">' +
            '<dt>Transportadora</dt><dd>' + escapeHtml(order.carrier || '—') + '</dd>' +
            '<dt>Guía</dt><dd>' + escapeHtml(order.tracking_code || '—') + '</dd>' +
            '<dt>Rastreo</dt><dd>' + (trackingUrl
              ? '<a href="' + escapeHtml(trackingUrl) + '" target="_blank" rel="noopener">Abrir enlace</a>'
              : '—') + '</dd>' +
          '</dl>' +
          '<h3>Resumen</h3>' +
          '<dl class="portal-kv">' +
            '<dt>Subtotal</dt><dd>' + escapeHtml(money(order.subtotal)) + '</dd>' +
            '<dt>Envío</dt><dd>' + escapeHtml(money(order.shipping)) + '</dd>' +
            '<dt>Total</dt><dd><strong>' + escapeHtml(money(order.total)) + '</strong></dd>' +
            '<dt>Creado</dt><dd>' + escapeHtml(formatDateTime(order.created_at)) + '</dd>' +
            '<dt>Actualizado</dt><dd>' + escapeHtml(formatDateTime(order.updated_at)) + '</dd>' +
          '</dl>' +
          '<h3>Actualizar pedido</h3>' +
          '<form id="orderUpdateForm" class="portal-order-form" data-id="' + order.id + '">' +
            '<label>Estado del pedido<select name="status">' + orderStatusOptions(order.status) + '</select></label>' +
            '<label>Estado del pago<select name="payment_status">' + paymentStatusOptions(order.payment_status) + '</select></label>' +
            '<label>Link de pago (Recurrente)<input name="payment_link" type="url" value="' + escapeHtml(order.payment_link || '') + '" placeholder="https://...">' +
              '<small class="portal-muted">Crea el link por el total exacto y pégalo aquí. El cliente lo verá en su seguimiento.</small></label>' +
            '<label>Transportadora<input name="carrier" value="' + escapeHtml(order.carrier || '') + '" placeholder="Forza Delivery Express / CPS Lastmile"></label>' +
            '<label>Código de guía<input name="tracking_code" value="' + escapeHtml(order.tracking_code || '') + '" placeholder="Ej. FD42971984F"></label>' +
            '<label>Enlace de rastreo<input name="tracking_url" type="url" value="' + escapeHtml(order.tracking_url || '') + '" placeholder="https://..."></label>' +
            '<label>Nota para el historial<textarea name="tracking_note" rows="2" placeholder="Ej. En aduana / Paquete 2: CPS 947218629"></textarea></label>' +
            '<div class="portal-order-form-actions">' +
              '<button type="submit" class="portal-btn primary">Guardar cambios</button>' +
              '<button type="button" class="portal-btn ghost" data-action="copy-code" data-code="' + escapeHtml(order.code) + '">Copiar código</button>' +
              '<a class="portal-btn ghost" href="seguimiento.html?code=' + encodeURIComponent(order.code) + '" target="_blank" rel="noopener">Ver seguimiento</a>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="portal-order-block">' +
        '<h3>Productos</h3>' +
        '<div class="portal-table-wrap">' +
          '<table class="portal-order-items">' +
            '<thead><tr><th>Producto</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>' +
            '<tbody>' + itemRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="portal-order-block">' +
        '<h3>Historial</h3>' +
        '<ol class="portal-order-events">' + eventRows + '</ol>' +
      '</div>';

    els.orderModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeOrderModal() {
    els.orderModal.hidden = true;
    document.body.style.overflow = '';
    state.currentOrderId = null;
    els.orderDetail.innerHTML = '';
  }

  async function saveOrderChanges(event) {
    event.preventDefault();
    if (state.busy) return;

    const form = event.target;
    const id = form.dataset.id;
    const status = form.elements.status.value;
    const paymentStatus = form.elements.payment_status.value;
    const paymentLink = form.elements.payment_link.value.trim();
    const carrier = form.elements.carrier.value.trim();
    const trackingCode = form.elements.tracking_code.value.trim();
    const trackingUrl = form.elements.tracking_url.value.trim();
    const trackingNote = form.elements.tracking_note.value.trim();
    const nextPaymentStatus = paymentLink && paymentStatus === 'pendiente'
      ? 'link_enviado'
      : paymentStatus;

    setBusy(true);
    const { error } = await state.client
      .from('orders')
      .update({
        status,
        payment_status: nextPaymentStatus,
        payment_link: paymentLink,
        carrier,
        tracking_code: trackingCode,
        tracking_url: trackingUrl
      })
      .eq('id', id);

    if (error) {
      setBusy(false);
      message('No se pudo actualizar el pedido: ' + error.message, 'error');
      return;
    }

    if (trackingNote) {
      const { error: noteError } = await state.client
        .from('order_events')
        .insert({ order_id: id, status, note: trackingNote });
      if (noteError) {
        setBusy(false);
        message('Pedido actualizado, pero no se pudo guardar la nota: ' + noteError.message, 'error');
        await loadOrders();
        return;
      }
    }

    setBusy(false);
    await loadOrders();
    const updated = state.orders.find(order => String(order.id) === String(id));
    if (updated) openOrderModal(updated);
    else closeOrderModal();
    message('Pedido actualizado correctamente.', 'ok');
  }

  async function viewProof(path) {
    if (!path) return;
    setBusy(true);
    const { data, error } = await state.client.storage
      .from('comprobantes')
      .createSignedUrl(path, 600);
    setBusy(false);

    if (error) {
      message('No se pudo abrir el comprobante: ' + error.message, 'error');
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function copyCode(code) {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      message('Código copiado: ' + code, 'ok');
    } catch (error) {
      window.prompt('Copia el código del pedido:', code);
    }
  }

  async function copyPaymentLink(link) {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      message('Link de pago copiado.', 'ok');
    } catch (error) {
      window.prompt('Copia el link de pago:', link);
    }
  }

  /* ─── Configuración de la tienda ─── */

  const SETTING_FIELDS = [
    ['shipping_fee', 'setShippingFee'],
    ['free_shipping_from', 'setFreeShippingFrom'],
    ['whatsapp', 'setWhatsapp'],
    ['email', 'setEmail'],
    ['instagram', 'setInstagram'],
    ['instagram_url', 'setInstagramUrl'],
    ['tiktok', 'setTiktok'],
    ['hours', 'setHours'],
    ['bank_name', 'setBankName'],
    ['bank_account', 'setBankAccount'],
    ['bank_holder', 'setBankHolder'],
    ['bank_note', 'setBankNote']
  ];

  function renderSettings() {
    const settings = state.settings || {};
    SETTING_FIELDS.forEach(([key, elementKey]) => {
      const input = els[elementKey];
      if (input) input.value = settings[key] == null ? '' : String(settings[key]);
    });

    if (state.settingsError) {
      els.settingsStatus.textContent =
        'No se pudo cargar la configuración: ' + state.settingsError +
        ' Verifica que hayas ejecutado supabase/orders.sql o supabase/upgrade.sql.';
      els.settingsStatus.hidden = false;
    } else {
      els.settingsStatus.hidden = true;
      els.settingsStatus.textContent = '';
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (state.busy) return;

    const shipping = els.setShippingFee.value.trim();
    const freeFrom = els.setFreeShippingFrom.value.trim();

    if (shipping !== '' && (!Number.isFinite(Number(shipping)) || Number(shipping) < 0)) {
      message('El costo de envío debe ser un número mayor o igual a 0.', 'error');
      return;
    }
    if (freeFrom !== '' && (!Number.isFinite(Number(freeFrom)) || Number(freeFrom) < 0)) {
      message('El monto para envío gratis debe ser un número mayor o igual a 0.', 'error');
      return;
    }

    const values = {
      shipping_fee: shipping,
      free_shipping_from: freeFrom,
      whatsapp: els.setWhatsapp.value.trim(),
      email: els.setEmail.value.trim(),
      instagram: els.setInstagram.value.trim(),
      instagram_url: els.setInstagramUrl.value.trim(),
      tiktok: els.setTiktok.value.trim(),
      hours: els.setHours.value.trim(),
      bank_name: els.setBankName.value.trim(),
      bank_account: els.setBankAccount.value.trim(),
      bank_holder: els.setBankHolder.value.trim(),
      bank_note: els.setBankNote.value.trim()
    };

    const now = new Date().toISOString();
    const rows = Object.entries(values).map(([key, value]) => ({ key, value, updated_at: now }));

    setBusy(true);
    const { error } = await state.client
      .from('store_settings')
      .upsert(rows, { onConflict: 'key' });
    setBusy(false);

    if (error) {
      message('No se pudo guardar la configuración: ' + error.message, 'error');
      return;
    }

    state.settings = values;
    state.settingsError = '';
    renderSettings();
    message('Configuración guardada. La tienda la usará al recargar.', 'ok');
  }

  /* ─── Formulario de producto ─── */

  function openProductForm(product) {
    state.editingId = product ? product.id : null;
    els.modalTitle.textContent = product ? 'Editar producto' : 'Nuevo producto';
    els.productId.value = product ? product.id : '';
    els.fieldName.value = product ? product.name : '';
    els.fieldSku.value = product ? (product.sku || '') : (() => {
      const nums = state.products.map(p => parseInt(String(p.sku || '').replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      return 'LNT-' + String(next).padStart(3, '0');
    })();
    els.fieldPrice.value = product ? product.price : '';
    els.fieldOldPrice.value = product && product.old_price != null ? product.old_price : '';
    els.fieldBadge.value = product ? (product.badge || '') : '';
    els.fieldRating.value = product ? (product.rating != null ? product.rating : 5) : 5;
    els.fieldReviews.value = product ? (product.reviews || 0) : 0;
    els.fieldStock.value = product ? (product.stock || 0) : 0;
    els.fieldTint.value = product ? (product.tint || 0) : 0;
    const productImages = product && Array.isArray(product.images) ? product.images : [];
    const mainImage = product ? (product.image || productImages[0] || '') : '';
    els.fieldImage.value = mainImage;
    els.fieldImages.value = productImages.filter(url => url && url !== mainImage).join('\n');
    els.fieldDescription.value = product ? (product.description || '') : '';
    els.fieldDetails.value = product && Array.isArray(product.details) ? product.details.join('\n') : '';
    els.fieldSizes.value = product && Array.isArray(product.sizes) ? product.sizes.join(', ') : '';
    els.fieldColors.value = product && Array.isArray(product.colors) ? product.colors.join(', ') : '';
    els.fieldActive.checked = product ? Boolean(product.active) : true;
    fillCategorySelects();
    els.fieldCategory.value = product && product.category_id ? String(product.category_id) : '';
    updatePreview();
    renderGallery();
    setUploadStatus('');
    els.productModal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.fieldName.focus(), 40);
  }

  function closeProductForm() {
    els.productModal.hidden = true;
    document.body.style.overflow = '';
    state.editingId = null;
    els.productForm.reset();
    setUploadStatus('');
    els.fieldUploads.value = '';
    renderGallery();
    updatePreview();
  }

  function updatePreview() {
    const source = lfImageUrl(els.fieldImage.value.trim());
    if (source) {
      els.imagePreview.src = source;
      els.imagePreview.hidden = false;
    } else {
      els.imagePreview.removeAttribute('src');
      els.imagePreview.hidden = true;
    }
  }

  /* ─── Fotos del producto (Storage) ─── */

  function setUploadStatus(text, isError) {
    if (!els.uploadStatus) return;
    els.uploadStatus.textContent = text || '';
    els.uploadStatus.hidden = !text;
    els.uploadStatus.classList.toggle('error', Boolean(isError));
    if (uploadStatusTimer) {
      window.clearTimeout(uploadStatusTimer);
      uploadStatusTimer = null;
    }
  }

  function isPlaceholderImage(url) {
    return /(^|\/)public\/img\/lunette\/[^/]+\.svg$/i.test(String(url || '').trim());
  }

  function currentImageUrls() {
    const urls = [];
    const main = els.fieldImage.value.trim();
    if (main) urls.push(main);
    splitLines(els.fieldImages.value).forEach(url => {
      if (!urls.includes(url)) urls.push(url);
    });
    return urls;
  }

  function renderGallery() {
    if (!els.imageGallery) return;
    const urls = currentImageUrls();
    if (!urls.length) {
      els.imageGallery.hidden = true;
      els.imageGallery.innerHTML = '';
      return;
    }
    els.imageGallery.hidden = false;
    els.imageGallery.innerHTML = urls.map((url, index) =>
      '<div class="portal-gallery-item">' +
        '<img src="' + escapeHtml(lfImageUrl(url)) + '" alt="Foto ' + (index + 1) + '" loading="lazy">' +
        (index === 0 ? '<span class="portal-gallery-badge">Principal</span>' : '') +
        '<button type="button" data-action="remove-image" data-index="' + index + '" aria-label="Quitar foto">×</button>' +
      '</div>'
    ).join('');
  }

  function removeImageAt(index) {
    const urls = currentImageUrls();
    if (index < 0 || index >= urls.length) return;
    urls.splice(index, 1);
    els.fieldImage.value = urls[0] || '';
    els.fieldImages.value = urls.slice(1).join('\n');
    renderGallery();
    updatePreview();
  }

  function productImageExt(file) {
    const name = String(file.name || '');
    const dot = name.lastIndexOf('.');
    let ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
    if (ext === 'jpeg') ext = 'jpg';
    if (ext) return ext;
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif'
    };
    return map[file.type] || '';
  }

  function loadImageSource(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file).catch(() => loadImageElement(file));
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  /* Reduce el peso de la foto en el navegador antes de subirla:
     máximo 1600 px y calidad WebP, apuntando a ~500 KB. */
  async function compressImage(file) {
    if (file.type === 'image/gif') return file;

    let source;
    try {
      source = await loadImageSource(file);
    } catch (error) {
      return file;
    }

    const width = source.width || source.naturalWidth || 0;
    const height = source.height || source.naturalHeight || 0;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    if (typeof source.close === 'function') source.close();

    let best = null;
    for (const quality of IMAGE_QUALITY_STEPS) {
      let blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (!blob) break;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_IMAGE_BYTES) {
        best = blob;
        break;
      }
    }

    if (!best || best.size >= file.size) return file;

    const extensionByType = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
    const extension = extensionByType[best.type] || 'webp';
    const baseName = String(file.name || 'foto').replace(/\.[^.]+$/, '');
    return new File([best], baseName + '.' + extension, {
      type: best.type,
      lastModified: Date.now()
    });
  }

  async function handleImageUploads(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || state.uploading) return;

    if (!state.client) {
      setUploadStatus('Inicia sesión para subir fotos.', true);
      return;
    }

    state.uploading = true;
    const skipped = [];
    let uploaded = 0;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const ext = productImageExt(file);
      if (ext === 'heic' || ext === 'heif') {
        skipped.push(file.name + ' (HEIC no compatible, usa JPG)');
        continue;
      }
      if (!PRODUCT_IMAGE_EXTENSIONS.includes(ext)) {
        skipped.push(file.name + ' (formato no compatible)');
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        skipped.push(file.name + ' (más de 25 MB)');
        continue;
      }

      setUploadStatus('Optimizando y subiendo ' + (index + 1) + ' de ' + files.length + '…');
      try {
        const prepared = await compressImage(file);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          skipped.push(file.name + ' (supera el límite de 8 MB)');
          continue;
        }
        const preparedExt = productImageExt(prepared);
        const safeExt = preparedExt === 'jpeg' ? 'jpg' : preparedExt;
        const path = 'products/' + Date.now() + '-' +
          Math.random().toString(36).slice(2, 8) + '.' + safeExt;
        const { error } = await state.client.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .upload(path, prepared, {
            cacheControl: '3600',
            contentType: prepared.type || file.type || undefined,
            upsert: false
          });
        if (error) throw error;

        const { data } = state.client.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .getPublicUrl(path);

        if (data && data.publicUrl) {
          const currentMain = els.fieldImage.value.trim();
          if (!currentMain || isPlaceholderImage(currentMain)) {
            els.fieldImage.value = data.publicUrl;
          } else {
            const extras = splitLines(els.fieldImages.value);
            extras.push(data.publicUrl);
            els.fieldImages.value = extras.join('\n');
          }
          uploaded += 1;
          renderGallery();
          updatePreview();
        }
      } catch (error) {
        skipped.push(file.name + ' (' + (error.message || 'error al subir') + ')');
      }
    }

    state.uploading = false;

    if (skipped.length) {
      setUploadStatus('Algunas fotos no se subieron: ' + skipped.join(', '), true);
    } else if (uploaded) {
      setUploadStatus('¡Listo! ' + uploaded + ' foto' + (uploaded === 1 ? '' : 's') + ' agregada' + (uploaded === 1 ? '' : 's') + '.', false);
      uploadStatusTimer = window.setTimeout(() => setUploadStatus(''), 5000);
    } else {
      setUploadStatus('No se subió ninguna foto.', true);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (state.busy || state.uploading) return;

    const mainImage = lfImageUrl(els.fieldImage.value.trim());
    const extraImages = splitLines(els.fieldImages.value).map(lfImageUrl).filter(Boolean);
    const images = [...new Set([mainImage, ...extraImages].filter(Boolean))];

    const payload = {
      name: els.fieldName.value.trim(),
      sku: els.fieldSku.value.trim() || null,
      slug: slugify(els.fieldName.value),
      category_id: els.fieldCategory.value ? Number(els.fieldCategory.value) : null,
      price: Number(els.fieldPrice.value) || 0,
      old_price: els.fieldOldPrice.value ? Number(els.fieldOldPrice.value) : null,
      badge: els.fieldBadge.value || '',
      rating: Number(els.fieldRating.value) || 0,
      reviews: Number(els.fieldReviews.value) || 0,
      stock: Number(els.fieldStock.value) || 0,
      tint: Number(els.fieldTint.value) || 0,
      image: images[0] || '',
      images: images,
      description: els.fieldDescription.value.trim(),
      details: splitLines(els.fieldDetails.value),
      sizes: splitCommas(els.fieldSizes.value),
      colors: splitCommas(els.fieldColors.value),
      active: els.fieldActive.checked
    };

    if (!payload.name) {
      message('El nombre es obligatorio.', 'error');
      return;
    }

    setBusy(true);
    let error;
    if (state.editingId) {
      ({ error } = await state.client.from('products').update(payload).eq('id', state.editingId));
    } else {
      ({ error } = await state.client.from('products').insert(payload));
    }
    setBusy(false);

    if (error) {
      message('No se pudo guardar: ' + error.message, 'error');
      return;
    }

    closeProductForm();
    message('Producto guardado correctamente.', 'ok');
    await loadAll();
  }

  async function deleteProduct(id) {
    if (!window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    const { error } = await state.client.from('products').delete().eq('id', id);
    if (error) {
      message('No se pudo eliminar: ' + error.message, 'error');
      return;
    }
    message('Producto eliminado.', 'ok');
    await loadAll();
  }

  async function toggleProduct(id, active) {
    const { error } = await state.client.from('products').update({ active }).eq('id', id);
    if (error) {
      message('No se pudo cambiar la visibilidad: ' + error.message, 'error');
      await loadAll();
      return;
    }
    const product = state.products.find(item => String(item.id) === String(id));
    if (product) product.active = active;
    renderStats();
    renderTable();
    message(active ? 'Producto visible en la tienda.' : 'Producto oculto de la tienda.', 'ok');
  }

  /* ─── Categorías ─── */

  async function addCategory(event) {
    event.preventDefault();
    if (state.busy) return;

    const name = els.catName.value.trim();
    const slug = slugify(els.catSlug.value) || slugify(name);
    if (!name || !slug) {
      message('El nombre de la categoría es obligatorio.', 'error');
      return;
    }

    const payload = {
      slug: slug,
      name: name,
      emoji: els.catEmoji.value.trim() || '♡',
      blurb: els.catBlurb.value.trim(),
      image: els.catImage.value.trim(),
      sort_order: state.categories.length
    };

    setBusy(true);
    const { error } = await state.client.from('categories').insert(payload);
    setBusy(false);

    if (error) {
      message('No se pudo crear la categoría: ' + error.message, 'error');
      return;
    }

    els.categoryForm.reset();
    els.categoryForm.hidden = true;
    message('Categoría creada.', 'ok');
    await loadAll();
  }

  async function deleteCategory(id) {
    if (!window.confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return;
    const { error } = await state.client.from('categories').delete().eq('id', id);
    if (error) {
      message('No se pudo eliminar la categoría: ' + error.message, 'error');
      return;
    }
    message('Categoría eliminada.', 'ok');
    await loadAll();
  }

  /* ─── Importar catálogo demo ─── */

  async function importDemo() {
    if (!window.confirm('Se importarán las categorías y los 20 productos demo. ¿Continuar?')) return;
    if (typeof LUNETTE_CATEGORIES === 'undefined' || typeof LUNETTE_PRODUCTS === 'undefined') {
      message('No se encontraron los datos demo.', 'error');
      return;
    }

    setBusy(true);
    try {
      const categoryRows = LUNETTE_CATEGORIES.map((category, index) => ({
        slug: category.slug,
        name: category.name,
        emoji: category.emoji,
        blurb: category.blurb,
        image: category.image,
        sort_order: index
      }));

      let { error } = await state.client
        .from('categories')
        .upsert(categoryRows, { onConflict: 'slug', ignoreDuplicates: true });
      if (error) throw error;

      const { data: categories, error: categoriesError } = await state.client
        .from('categories')
        .select('id, slug');
      if (categoriesError) throw categoriesError;

      const categoryMap = new Map((categories || []).map(category => [category.slug, category.id]));

      const productRows = LUNETTE_PRODUCTS.map(product => ({
        sku: product.sku,
        name: product.name,
        slug: slugify(product.name),
        category_id: categoryMap.get(product.category) || null,
        price: product.price,
        old_price: product.oldPrice != null ? product.oldPrice : null,
        badge: product.badge || '',
        rating: product.rating,
        reviews: product.reviews,
        description: product.description,
        details: product.details,
        sizes: product.sizes,
        colors: product.colors,
        image: product.image,
        images: product.images && product.images.length ? product.images : [product.image],
        tint: product.tint,
        stock: 0,
        active: true
      }));

      ({ error } = await state.client
        .from('products')
        .upsert(productRows, { onConflict: 'sku', ignoreDuplicates: true }));
      if (error) throw error;

      message('Catálogo demo importado correctamente.', 'ok');
      await loadAll();
    } catch (error) {
      message('No se pudo importar: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  /* ─── Sesión ─── */

  async function login(event) {
    event.preventDefault();
    if (state.busy) return;
    hideLoginMessage();

    setBusy(true);
    const { data, error } = await state.client.auth.signInWithPassword({
      email: els.loginEmail.value.trim(),
      password: els.loginPassword.value
    });
    setBusy(false);

    if (error) {
      showLoginMessage(error.message, 'error');
      return;
    }
    if (data.session) await handleSession(data.session);
  }

  async function signup(event) {
    event.preventDefault();
    if (state.busy) return;
    hideLoginMessage();

    setBusy(true);
    const { data, error } = await state.client.auth.signUp({
      email: els.signupEmail.value.trim(),
      password: els.signupPassword.value
    });
    setBusy(false);

    if (error) {
      showLoginMessage(error.message, 'error');
      return;
    }

    if (data.session) {
      await state.client.auth.signOut();
      showLoginMessage(
        'Cuenta creada. Ahora hazla admin con el SQL de supabase/schema.sql y vuelve a entrar.',
        'ok'
      );
    } else {
      showLoginMessage('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.', 'ok');
    }
  }

  async function logout() {
    await state.client.auth.signOut();
    showLogin();
    hideLoginMessage();
  }

  /* ─── Eventos ─── */

  function bindEvents() {
    els.loginForm.addEventListener('submit', login);
    els.signupForm.addEventListener('submit', signup);
    els.logoutBtn.addEventListener('click', logout);

    els.toggleSignup.addEventListener('click', () => {
      const showSignup = els.signupForm.hidden;
      els.signupForm.hidden = !showSignup;
      els.loginForm.hidden = showSignup;
      els.toggleSignup.textContent = showSignup
        ? '¿Ya tienes cuenta? Iniciar sesión'
        : '¿No tienes cuenta? Crear una';
      hideLoginMessage();
    });

    els.newProductBtn.addEventListener('click', () => openProductForm(null));
    els.closeModal.addEventListener('click', closeProductForm);
    els.cancelModal.addEventListener('click', closeProductForm);
    els.productForm.addEventListener('submit', saveProduct);
    els.fieldImage.addEventListener('input', () => {
      updatePreview();
      renderGallery();
    });
    els.fieldImages.addEventListener('input', renderGallery);
    els.fieldUploads.addEventListener('change', handleImageUploads);
    els.imageGallery.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="remove-image"]');
      if (button) removeImageAt(Number(button.dataset.index));
    });

    els.searchInput.addEventListener('input', () => {
      state.filter = els.searchInput.value;
      renderTable();
    });
    els.categoryFilter.addEventListener('change', () => {
      state.categoryFilter = els.categoryFilter.value;
      renderTable();
    });

    els.productsBody.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'edit') {
        const product = state.products.find(item => String(item.id) === String(button.dataset.id));
        if (product) openProductForm(product);
      } else if (button.dataset.action === 'delete') {
        deleteProduct(button.dataset.id);
      }
    });

    els.productsBody.addEventListener('change', event => {
      const input = event.target.closest('input[data-action="toggle"]');
      if (!input) return;
      toggleProduct(input.dataset.id, input.checked);
    });

    els.newCategoryBtn.addEventListener('click', () => {
      els.categoryForm.hidden = !els.categoryForm.hidden;
      if (!els.categoryForm.hidden) els.catName.focus();
    });
    els.categoryForm.addEventListener('submit', addCategory);
    els.categoriesList.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="delete-category"]');
      if (button) deleteCategory(button.dataset.id);
    });

    els.importDemoBtn.addEventListener('click', importDemo);
    els.settingsForm.addEventListener('submit', saveSettings);

    els.orderSearchInput.addEventListener('input', () => {
      state.orderFilter = els.orderSearchInput.value;
      renderOrders();
    });
    els.orderStatusFilter.addEventListener('change', () => {
      state.orderStatusFilter = els.orderStatusFilter.value;
      renderOrders();
    });
    els.refreshOrdersBtn.addEventListener('click', loadOrders);
    els.ordersBody.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="view-order"]');
      if (!button) return;
      const order = state.orders.find(item => String(item.id) === String(button.dataset.id));
      if (order) openOrderModal(order);
    });
    els.closeOrderModal.addEventListener('click', closeOrderModal);
    els.orderModal.addEventListener('click', event => {
      if (event.target === els.orderModal) closeOrderModal();
    });
    els.orderDetail.addEventListener('submit', event => {
      if (event.target.id === 'orderUpdateForm') saveOrderChanges(event);
    });
    els.orderDetail.addEventListener('click', event => {
      const proofButton = event.target.closest('button[data-action="view-proof"]');
      if (proofButton) {
        viewProof(proofButton.dataset.path);
        return;
      }
      const copyButton = event.target.closest('button[data-action="copy-code"]');
      if (copyButton) {
        copyCode(copyButton.dataset.code);
        return;
      }
      const copyLinkButton = event.target.closest('button[data-action="copy-payment-link"]');
      if (copyLinkButton) copyPaymentLink(copyLinkButton.dataset.link);
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!els.orderModal.hidden) closeOrderModal();
      else if (!els.productModal.hidden) closeProductForm();
    });
  }

  /* ─── Init ─── */

  function init() {
    els = {
      loginView: document.getElementById('loginView'),
      appView: document.getElementById('appView'),
      loginForm: document.getElementById('loginForm'),
      signupForm: document.getElementById('signupForm'),
      loginEmail: document.getElementById('loginEmail'),
      loginPassword: document.getElementById('loginPassword'),
      signupEmail: document.getElementById('signupEmail'),
      signupPassword: document.getElementById('signupPassword'),
      loginMessage: document.getElementById('loginMessage'),
      toggleSignup: document.getElementById('toggleSignup'),
      userEmail: document.getElementById('userEmail'),
      logoutBtn: document.getElementById('logoutBtn'),
      appMessage: document.getElementById('appMessage'),
      stats: document.getElementById('stats'),
      orderSearchInput: document.getElementById('orderSearchInput'),
      orderStatusFilter: document.getElementById('orderStatusFilter'),
      refreshOrdersBtn: document.getElementById('refreshOrdersBtn'),
      ordersBody: document.getElementById('ordersBody'),
      ordersEmptyState: document.getElementById('ordersEmptyState'),
      orderModal: document.getElementById('orderModal'),
      orderModalTitle: document.getElementById('orderModalTitle'),
      closeOrderModal: document.getElementById('closeOrderModal'),
      orderDetail: document.getElementById('orderDetail'),
      searchInput: document.getElementById('searchInput'),
      categoryFilter: document.getElementById('categoryFilter'),
      newProductBtn: document.getElementById('newProductBtn'),
      productsBody: document.getElementById('productsBody'),
      emptyState: document.getElementById('emptyState'),
      importDemoBtn: document.getElementById('importDemoBtn'),
      categoriesList: document.getElementById('categoriesList'),
      newCategoryBtn: document.getElementById('newCategoryBtn'),
      categoryForm: document.getElementById('categoryForm'),
      catSlug: document.getElementById('catSlug'),
      catName: document.getElementById('catName'),
      catEmoji: document.getElementById('catEmoji'),
      catBlurb: document.getElementById('catBlurb'),
      catImage: document.getElementById('catImage'),
      settingsForm: document.getElementById('settingsForm'),
      settingsStatus: document.getElementById('settingsStatus'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      setShippingFee: document.getElementById('setShippingFee'),
      setFreeShippingFrom: document.getElementById('setFreeShippingFrom'),
      setWhatsapp: document.getElementById('setWhatsapp'),
      setEmail: document.getElementById('setEmail'),
      setInstagram: document.getElementById('setInstagram'),
      setInstagramUrl: document.getElementById('setInstagramUrl'),
      setTiktok: document.getElementById('setTiktok'),
      setHours: document.getElementById('setHours'),
      setBankName: document.getElementById('setBankName'),
      setBankAccount: document.getElementById('setBankAccount'),
      setBankHolder: document.getElementById('setBankHolder'),
      setBankNote: document.getElementById('setBankNote'),
      productModal: document.getElementById('productModal'),
      modalTitle: document.getElementById('modalTitle'),
      closeModal: document.getElementById('closeModal'),
      cancelModal: document.getElementById('cancelModal'),
      productForm: document.getElementById('productForm'),
      productId: document.getElementById('productId'),
      fieldName: document.getElementById('fieldName'),
      fieldSku: document.getElementById('fieldSku'),
      fieldCategory: document.getElementById('fieldCategory'),
      fieldPrice: document.getElementById('fieldPrice'),
      fieldOldPrice: document.getElementById('fieldOldPrice'),
      fieldBadge: document.getElementById('fieldBadge'),
      fieldRating: document.getElementById('fieldRating'),
      fieldReviews: document.getElementById('fieldReviews'),
      fieldStock: document.getElementById('fieldStock'),
      fieldTint: document.getElementById('fieldTint'),
      fieldImage: document.getElementById('fieldImage'),
      fieldImages: document.getElementById('fieldImages'),
      fieldDescription: document.getElementById('fieldDescription'),
      fieldDetails: document.getElementById('fieldDetails'),
      fieldSizes: document.getElementById('fieldSizes'),
      fieldColors: document.getElementById('fieldColors'),
      fieldActive: document.getElementById('fieldActive'),
      imagePreview: document.getElementById('imagePreview'),
      fieldUploads: document.getElementById('fieldUploads'),
      uploadStatus: document.getElementById('uploadStatus'),
      imageGallery: document.getElementById('imageGallery')
    };

    bindEvents();

    if (!window.supabase) {
      showLoginMessage('No se pudo cargar Supabase. Revisa tu conexión a internet.', 'error');
      return;
    }

    if (!LUNETTE_SUPABASE.url || !LUNETTE_SUPABASE.anonKey) {
      showLoginMessage(
        'Falta configurar Supabase. Abre public/js/lunette-data.js y completa url y anonKey.',
        'error'
      );
      els.loginForm.querySelector('button[type="submit"]').disabled = true;
      return;
    }

    state.client = window.supabase.createClient(LUNETTE_SUPABASE.url, LUNETTE_SUPABASE.anonKey);

    state.client.auth.getSession().then(({ data }) => {
      if (data.session) {
        handleSession(data.session);
      } else {
        showLogin();
      }
    });

    state.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') showLogin();
    });
  }

  init();
})();
