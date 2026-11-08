/* ============================================================
   LUNETTE — Datos de la tienda
   Moda y accesorios Y2K / Coquette · Guatemala
   ============================================================ */

/* Configuración de Supabase.
   Pega aquí la URL y la llave pública (publishable o anon) del proyecto.
   NUNCA uses la llave service_role en el navegador. */
const LUNETTE_SUPABASE = {
  url: 'https://czqekviizatgzhwxmqls.supabase.co',
  anonKey: 'sb_publishable_hkezZJ2ZkJfXMKS9B6ovAw_a7jTvqOk'
};

const LUNETTE_STORE = {
  name: 'Lunette',
  tagline: 'cute styles · y2k vibes',
  // Valores de respaldo. En producción se sobrescriben con la tabla
  // store_settings de Supabase (envío, contacto y banco).
  // email: 'correo@lunette.com',
  // whatsapp: '50200000000', // formato internacional, sin signos ni espacios
  // instagram: '@lunette',
  // instagramUrl: 'https://instagram.com/lunette',
  // tiktok: '@lunette',
  // hours: 'Lun-Sáb: 10:00 - 19:00',
  shipping: 25,
  freeShippingFrom: 500,
  city: 'Guatemala',
  currency: 'GTQ',
  // Datos bancarios de respaldo. Se configuran en store_settings.
  bank: {
    bank: '',      // Ej. Banco Industrial
    account: '',   // Ej. 1234-56789-0
    holder: '',    // Nombre del titular
    note: ''       // Instrucción extra para el cliente
  }
};

const LUNETTE_IMG = {
  tops: 'public/img/lunette/top.svg',
  faldas: 'public/img/lunette/falda.svg',
  hoodies: 'public/img/lunette/hoodie.svg',
  accesorios: 'public/img/lunette/accesorio.svg',
  bolsas: 'public/img/lunette/bolsa.svg',
  outfits: 'public/img/lunette/outfit.svg'
};

/* Convierte links de Google Drive a una URL directa usable en <img>.
   El archivo debe estar compartido como "Cualquier persona con el enlace". */
function lfDriveId(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const pathMatch = parsed.pathname.match(/\/d\/([^/]+)/);
      if (pathMatch) return pathMatch[1];
      return parsed.searchParams.get('id') || '';
    }
    if (host === 'lh3.googleusercontent.com') {
      const pathMatch = parsed.pathname.match(/\/d\/([^/=]+)/);
      if (pathMatch) return pathMatch[1];
    }
  } catch (error) {
    return '';
  }
  return '';
}

function lfImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  const driveId = lfDriveId(value);
  if (driveId) return 'https://lh3.googleusercontent.com/d/' + driveId + '=w1600';
  return value;
}

function lfProductImages(product) {
  if (!product) return [];
  const list = [];
  if (Array.isArray(product.images)) list.push(...product.images);
  if (product.image) list.push(product.image);
  const seen = new Set();
  return list
    .map(lfImageUrl)
    .filter(url => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

let LUNETTE_CATEGORIES = [
  { slug: 'tops', name: 'Tops', emoji: '♡', blurb: 'Baby tees, encaje y mallas', image: LUNETTE_IMG.tops },
  { slug: 'faldas', name: 'Faldas', emoji: '✦', blurb: 'Mini, plisadas y denim', image: LUNETTE_IMG.faldas },
  { slug: 'hoodies', name: 'Hoodies', emoji: '☁', blurb: 'Abrigos cute y oversize', image: LUNETTE_IMG.hoodies },
  { slug: 'accesorios', name: 'Accesorios', emoji: '✧', blurb: 'Lentes, pinzas y chokers', image: LUNETTE_IMG.accesorios },
  { slug: 'bolsas', name: 'Bolsas', emoji: '♢', blurb: 'Mini bags y metálicas', image: LUNETTE_IMG.bolsas },
  { slug: 'outfits', name: 'Outfits', emoji: '✿', blurb: 'Sets listos para brillar', image: LUNETTE_IMG.outfits }
];

let LUNETTE_PRODUCTS = [
  {
    id: 1, sku: 'LNT-001', name: 'Angel Baby Top', category: 'tops', price: 145, oldPrice: 185,
    badge: 'sale', rating: 4.9, reviews: 38, image: LUNETTE_IMG.tops, tint: 0,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Rosa', 'Blanco'],
    description: 'Baby tee en algodón suavecito con lazo bordado y brillo sutil. El básico coquette que combina con todo.',
    details: ['Algodón premium', 'Detalle de lazo bordado', 'Fit entallado', 'Lavar a mano']
  },
  {
    id: 2, sku: 'LNT-002', name: 'Cherry Crush Top', category: 'tops', price: 135,
    badge: 'new', rating: 4.8, reviews: 21, image: LUNETTE_IMG.tops, tint: 320,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Cereza', 'Rosa'],
    description: 'Top de manga corta con estampado de cerezas y ribete en contraste. Dulce, fresco y muy Y2K.',
    details: ['Tela elástica', 'Estampado cherry', 'Escote redondo', 'Lavar a mano']
  },
  {
    id: 3, sku: 'LNT-003', name: 'Starlight Mesh Top', category: 'tops', price: 165,
    badge: 'best', rating: 5.0, reviews: 64, image: LUNETTE_IMG.tops, tint: 300,
    sizes: ['XS', 'S', 'M'], colors: ['Rosa', 'Plateado'],
    description: 'Top de malla con estrellas y brillos. Perfecto para una noche de fotos con flash.',
    details: ['Malla stretch', 'Aplicaciones de brillo', 'Ideal para capas', 'Disponible en 2 tonos']
  },
  {
    id: 4, sku: 'LNT-004', name: 'Coquette Lace Cami', category: 'tops', price: 155,
    badge: '', rating: 4.7, reviews: 17, image: LUNETTE_IMG.tops, tint: 15,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Rosa', 'Marfil'],
    description: 'Camisola de encaje con tirantes ajustables. Romántica, ligera y con ese aire de muñeca de porcelana.',
    details: ['Encaje suave', 'Tirantes ajustables', 'Forro interior', 'Fit relajado']
  },
  {
    id: 5, sku: 'LNT-005', name: 'Bunny Pleated Mini', category: 'faldas', price: 185,
    badge: 'new', rating: 4.9, reviews: 33, image: LUNETTE_IMG.faldas, tint: 0,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Rosa', 'Negro'],
    description: 'Falda plisada mini con cintura alta y forro. La pieza estrella de cualquier outfit coquette.',
    details: ['Plisado permanente', 'Cintura elástica', 'Forro interior', 'Largo mini']
  },
  {
    id: 6, sku: 'LNT-006', name: 'Dollhouse Denim Mini', category: 'faldas', price: 210, oldPrice: 250,
    badge: 'sale', rating: 4.8, reviews: 26, image: LUNETTE_IMG.faldas, tint: 330,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Denim claro', 'Denim rosa'],
    description: 'Mini falda de denim con bolsillos y costuras en contraste. Un clásico Y2K reinventado en rosa.',
    details: ['Denim rígido', 'Cintura alta', '5 bolsillos', 'Cierre con botón']
  },
  {
    id: 7, sku: 'LNT-007', name: 'Sugar Rush Skirt', category: 'faldas', price: 175,
    badge: 'low', rating: 4.6, reviews: 12, image: LUNETTE_IMG.faldas, tint: 40,
    sizes: ['S', 'M'], colors: ['Rosa', 'Lavanda'],
    description: 'Falda con volantes y lazo lateral. Suave como el algodón de azúcar, lista para brillar.',
    details: ['Volantes en capas', 'Lazo removible', 'Forro interior', 'Últimas piezas']
  },
  {
    id: 8, sku: 'LNT-008', name: 'Cloud Bunny Hoodie', category: 'hoodies', price: 265,
    badge: 'best', rating: 5.0, reviews: 51, image: LUNETTE_IMG.hoodies, tint: 0,
    sizes: ['S', 'M', 'L', 'XL'], colors: ['Rosa pastel', 'Blanco'],
    description: 'Hoodie oversize con orejitas de conejo y bolsillo canguro. Abrazo de peluche garantizado.',
    details: ['Felpa afelpada', 'Orejitas 3D', 'Fit oversize', 'Unisex']
  },
  {
    id: 9, sku: 'LNT-009', name: 'Y2K Cyber Hoodie', category: 'hoodies', price: 285,
    badge: 'new', rating: 4.8, reviews: 19, image: LUNETTE_IMG.hoodies, tint: 300,
    sizes: ['S', 'M', 'L', 'XL'], colors: ['Rosa', 'Negro'],
    description: 'Hoodie con gráficos pixel-art y detalles reflectantes. Nostalgia del internet de los 2000.',
    details: ['Estampado reflectante', 'Capucha forrada', 'Puños elásticos', 'Edición limitada']
  },
  {
    id: 10, sku: 'LNT-010', name: 'Soft Girl Zip Hoodie', category: 'hoodies', price: 245, oldPrice: 295,
    badge: 'sale', rating: 4.7, reviews: 22, image: LUNETTE_IMG.hoodies, tint: 15,
    sizes: ['S', 'M', 'L'], colors: ['Rosa', 'Lila'],
    description: 'Zip-up con cierre completo, capucha gigante y bolsillos. Cómodo para todos los planes cute.',
    details: ['Cierre metálico', 'Capucha doble', 'Bolsillos laterales', 'Tela suave']
  },
  {
    id: 11, sku: 'LNT-011', name: 'Heart Sunglasses', category: 'accesorios', price: 75,
    badge: 'best', rating: 4.9, reviews: 88, image: LUNETTE_IMG.accesorios, tint: 0,
    sizes: ['Única'], colors: ['Rosa', 'Rojo'],
    description: 'Lentes de corazón con acabado glossy. El accesorio viral para tus selfies.',
    details: ['Protección UV400', 'Montura flexible', 'Incluye estuche', 'Talla única']
  },
  {
    id: 12, sku: 'LNT-012', name: 'Crystal Bow Clips', category: 'accesorios', price: 55,
    badge: 'new', rating: 4.8, reviews: 41, image: LUNETTE_IMG.accesorios, tint: 20,
    sizes: ['Única'], colors: ['Rosa', 'Plateado'],
    description: 'Set de 2 pinzas con lazos de cristal. Pequeño detalle, máximo efecto coquette.',
    details: ['Set de 2 piezas', 'Cristales facetados', 'Broche seguro', 'Ideal para regalo']
  },
  {
    id: 13, sku: 'LNT-013', name: 'Pearl Choker', category: 'accesorios', price: 90,
    badge: '', rating: 4.7, reviews: 30, image: LUNETTE_IMG.accesorios, tint: 340,
    sizes: ['Única'], colors: ['Perla', 'Rosa'],
    description: 'Gargantilla de perlas con corazón de cristal. Elegante con un toque de drama.',
    details: ['Perlas sintéticas', 'Extensión ajustable', 'Corazón de cristal', 'Hipoalergénico']
  },
  {
    id: 14, sku: 'LNT-014', name: 'Star Charm Chain', category: 'accesorios', price: 65,
    badge: 'low', rating: 4.6, reviews: 14, image: LUNETTE_IMG.accesorios, tint: 310,
    sizes: ['Única'], colors: ['Plateado', 'Dorado'],
    description: 'Cadena para bolso o cinturón con estrellas metálicas. Personaliza tu look en segundos.',
    details: ['Metal baño de plata', 'Largo ajustable', 'Dijes de estrella', 'Pocas unidades']
  },
  {
    id: 15, sku: 'LNT-015', name: 'Mini Bag Coquette', category: 'bolsas', price: 195,
    badge: 'best', rating: 4.9, reviews: 47, image: LUNETTE_IMG.bolsas, tint: 0,
    sizes: ['Única'], colors: ['Rosa', 'Magenta'],
    description: 'Bolso mini con asa de lazo y cierre magnético. Solo cabe lo esencial, pero qué esencial.',
    details: ['Asa de lazo', 'Cierre magnético', 'Forro interior', 'Talla única']
  },
  {
    id: 16, sku: 'LNT-016', name: 'Metallic Y2K Shoulder Bag', category: 'bolsas', price: 225,
    badge: 'new', rating: 4.8, reviews: 23, image: LUNETTE_IMG.bolsas, tint: 15,
    sizes: ['Única'], colors: ['Rosa metal', 'Plateado'],
    description: 'Bolso de hombro metálico que refleja todos los flashes. Icónico noventas, energía 2000.',
    details: ['Acabado metálico', 'Cadena removible', 'Bolsillo interior', 'Cierre de cremallera']
  },
  {
    id: 17, sku: 'LNT-017', name: 'Bunny Backpack', category: 'bolsas', price: 240, oldPrice: 280,
    badge: 'sale', rating: 4.7, reviews: 18, image: LUNETTE_IMG.bolsas, tint: 330,
    sizes: ['Única'], colors: ['Rosa', 'Blanco'],
    description: 'Mochila con orejitas, bolsillo frontal y espalda acolchada. Cute para el día a día.',
    details: ['Orejitas 3D', 'Espalda acolchada', 'Bolsillo para laptop 13"', 'Correas ajustables']
  },
  {
    id: 18, sku: 'LNT-018', name: 'Dreamy Two-Piece Set', category: 'outfits', price: 350,
    badge: 'new', rating: 5.0, reviews: 29, image: LUNETTE_IMG.outfits, tint: 0,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Rosa', 'Lavanda'],
    description: 'Set de top y falda a juego con detalles de lazo. Outfit completo listo para tu próxima cita.',
    details: ['Incluye top y falda', 'Tejido suave', 'Detalles de lazo', 'Sets coordinados']
  },
  {
    id: 19, sku: 'LNT-019', name: 'Coquette Picnic Set', category: 'outfits', price: 320,
    badge: 'best', rating: 4.9, reviews: 35, image: LUNETTE_IMG.outfits, tint: 20,
    sizes: ['XS', 'S', 'M', 'L'], colors: ['Rosa', 'Marfil'],
    description: 'Conjunto de blusa con volantes y falda midi. Perfecto para un picnic aesthetic de domingo.',
    details: ['Blusa + falda midi', 'Volantes románticos', 'Cintura elástica', 'Tela ligera']
  },
  {
    id: 20, sku: 'LNT-020', name: 'Strawberry Lounge Set', category: 'outfits', price: 300, oldPrice: 360,
    badge: 'sale', rating: 4.8, reviews: 24, image: LUNETTE_IMG.outfits, tint: 340,
    sizes: ['S', 'M', 'L'], colors: ['Rosa', 'Cereza'],
    description: 'Set casual de top corto y short con estampado de fresas. Comodidad con actitud.',
    details: ['Top + short', 'Estampado frutal', 'Cintura ajustable', 'Algodón suave']
  }
];

let LUNETTE_COLORS = [
  'Rosa', 'Blanco', 'Negro', 'Marfil', 'Lavanda', 'Plateado',
  'Dorado', 'Cereza', 'Denim claro', 'Denim rosa', 'Lila', 'Magenta',
  'Rosa pastel', 'Rosa metal', 'Perla', 'Rojo'
];

function lunetteProductById(id) {
  return LUNETTE_PRODUCTS.find(p => p.id === Number(id)) || null;
}

function lunetteCategoryBySlug(slug) {
  return LUNETTE_CATEGORIES.find(c => c.slug === slug) || null;
}

function lunetteProductUrl(product) {
  return 'Producto.html?id=' + product.id;
}

function lunetteBadge(product) {
  const map = {
    new: { label: 'Nuevo', className: 'badge-info' },
    sale: { label: 'Oferta', className: 'badge-danger' },
    best: { label: 'Best seller', className: 'badge-success' },
    low: { label: 'Últimas piezas', className: 'badge-warning' }
  };
  return map[product.badge] || null;
}

/* ─── Catálogo remoto (Supabase) ─── */

let lunetteSupabaseClient = null;

async function lfGetSupabaseClient() {
  if (lunetteSupabaseClient) return lunetteSupabaseClient;
  if (!LUNETTE_SUPABASE.url || !LUNETTE_SUPABASE.anonKey) return null;
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  lunetteSupabaseClient = window.supabase.createClient(
    LUNETTE_SUPABASE.url,
    LUNETTE_SUPABASE.anonKey
  );
  return lunetteSupabaseClient;
}

async function lfLoadRemoteCatalog() {
  const client = await lfGetSupabaseClient();
  if (!client) return false;

  const [categoriesResult, productsResult] = await Promise.all([
    client.from('categories').select('*').order('sort_order', { ascending: true }),
    client.from('products').select('*, categories(slug)').eq('active', true).order('id', { ascending: true })
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (productsResult.error) throw productsResult.error;

  const categories = categoriesResult.data || [];
  const products = productsResult.data || [];

  if (categories.length) {
    LUNETTE_CATEGORIES = categories.map(category => ({
      slug: category.slug,
      name: category.name,
      emoji: category.emoji || '♡',
      blurb: category.blurb || '',
      image: category.image || LUNETTE_IMG[category.slug] || ''
    }));
  }

  if (products.length) {
    LUNETTE_PRODUCTS = products.map(product => {
      const categorySlug = product.categories ? product.categories.slug : '';
      const fallbackImage = LUNETTE_IMG[categorySlug] || '';
      const imageList = Array.isArray(product.images)
        ? product.images.map(lfImageUrl).filter(Boolean)
        : [];
      if (product.image) imageList.unshift(lfImageUrl(product.image));
      const images = [...new Set(imageList.filter(Boolean))];
      const image = images[0] || fallbackImage;

      return {
        id: product.id,
        sku: product.sku || ('LNT-' + product.id),
        name: product.name,
        category: categorySlug,
        price: Number(product.price),
        oldPrice: product.old_price != null ? Number(product.old_price) : undefined,
        badge: product.badge || '',
        rating: Number(product.rating || 0),
        reviews: Number(product.reviews || 0),
        image: image,
        images: images.length ? images : (fallbackImage ? [fallbackImage] : []),
        tint: Number(product.tint || 0),
        sizes: Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Única'],
        colors: Array.isArray(product.colors) && product.colors.length ? product.colors : ['Único'],
        description: product.description || '',
        details: Array.isArray(product.details) ? product.details : []
      };
    });

    const remoteColors = LUNETTE_PRODUCTS.flatMap(product => product.colors);
    LUNETTE_COLORS = [...new Set(remoteColors)];
  }

  return true;
}

/* Carga la configuración pública de la tienda (envío, contacto y banco)
   desde la tabla store_settings. Si falla, se usan los valores locales. */
async function lfLoadStoreSettings() {
  const client = await lfGetSupabaseClient();
  if (!client) return false;

  const { data, error } = await client.from('store_settings').select('key, value');
  if (error) throw error;

  const settings = {};
  (data || []).forEach(row => {
    if (row && row.key) settings[row.key] = row.value == null ? '' : String(row.value);
  });

  const number = (key, fallback) => {
    if (!(key in settings) || settings[key] === '') return fallback;
    const parsed = Number(settings[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  LUNETTE_STORE.shipping = number('shipping_fee', LUNETTE_STORE.shipping);
  LUNETTE_STORE.freeShippingFrom = number('free_shipping_from', LUNETTE_STORE.freeShippingFrom);

  if (settings.whatsapp) LUNETTE_STORE.whatsapp = settings.whatsapp.replace(/\D/g, '');
  if (settings.email) LUNETTE_STORE.email = settings.email;
  if (settings.instagram) LUNETTE_STORE.instagram = settings.instagram;
  if (settings.instagram_url) LUNETTE_STORE.instagramUrl = settings.instagram_url;
  if (settings.tiktok) LUNETTE_STORE.tiktok = settings.tiktok;
  if (settings.hours) LUNETTE_STORE.hours = settings.hours;

  LUNETTE_STORE.bank = LUNETTE_STORE.bank || {};
  if (settings.bank_name) LUNETTE_STORE.bank.bank = settings.bank_name;
  if (settings.bank_account) LUNETTE_STORE.bank.account = settings.bank_account;
  if (settings.bank_holder) LUNETTE_STORE.bank.holder = settings.bank_holder;
  if (settings.bank_note) LUNETTE_STORE.bank.note = settings.bank_note;

  return true;
}
