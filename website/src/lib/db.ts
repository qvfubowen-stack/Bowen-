/**
 * 数据访问层 —— 页面的唯一数据入口
 * ===========================================================================
 * 设计目标：让页面代码完全不知道数据存在哪里。
 *
 * 现在（Phase 3 原型）：从本地 JSON 读取（构建期静态数据，零数据库依赖）。
 * 未来（Phase 4+）：把下面 `loadDataset()` 换成 SQL / Supabase 查询即可，
 *                  导出的函数签名与返回类型都不用改。
 *
 * 唯一改动点已标注在 `loadDataset()`。
 */
import 'server-only';

import productsJson from '@/data/products.json';
import applicationsJson from '@/data/applications.json';
import oeIndexJson from '@/data/oe-index.json';
import siteFactsJson from '@/data/site-facts.json';

import type {
  CategorySummary,
  MakeSummary,
  OeIndexEntry,
  OeSearchHit,
  Product,
  ProductApplication,
  ProductFilters,
  ProductListResult,
} from './types';

// ---------------------------------------------------------------------------
// 数据集装载
// ---------------------------------------------------------------------------

export interface Dataset {
  products: Product[];
  applications: ProductApplication[];
  oeIndex: OeIndexEntry[];
  facts: typeof siteFactsJson;
}

let cached: Dataset | null = null;

/**
 * ★ 未来替换点 ★
 * 换成 PostgreSQL / Supabase 时，把函数体改成：
 *   const products = await sql`select * from products where status in (...)`;
 * 并让调用方 await（其余页面逻辑不变，因为它们只依赖下面导出的查询函数）。
 */
function loadDataset(): Dataset {
  if (cached) return cached;
  cached = {
    products: productsJson as unknown as Product[],
    applications: applicationsJson as unknown as ProductApplication[],
    oeIndex: oeIndexJson as unknown as OeIndexEntry[],
    facts: siteFactsJson,
  };
  return cached;
}

// ---------------------------------------------------------------------------
// OE 标准化（与数据库构建脚本 tools/build-product-db-v2.mjs 的 oeSearchKey 保持一致）
// ---------------------------------------------------------------------------
/** 忽略大小写、空格、短横线、斜线 */
export function normalizeOeInput(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/[-‐‑‒–—―]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^A-Z0-9.]/g, '');
}

/** 输入看起来像不像一个 OE 号（用来决定搜索走 OE 通道还是关键词通道） */
export function looksLikeOeQuery(raw: string): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  if (t.length < 4 || t.length > 30) return false;
  return /[0-9]/.test(t) && /^[A-Za-z0-9\s\-/._]+$/.test(t);
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

/** 网站可见的产品：原型候选 + 可搜索。blocked / draft 一律不出现在前台。 */
export function getPublishedProducts(): Product[] {
  const { products } = loadDataset();
  return products
    .filter((p) => p.status === 'prototype_candidate' || p.status === 'searchable_noindex')
    .filter((p) => !p.blocked)
    .sort((a, b) => {
      if (a.prototype_rank && b.prototype_rank) return a.prototype_rank - b.prototype_rank;
      if (a.prototype_rank) return -1;
      if (b.prototype_rank) return 1;
      return (a.bowen_no ?? '').localeCompare(b.bowen_no ?? '', undefined, { numeric: true });
    });
}

export function getProductById(id: string): Product | null {
  const { products } = loadDataset();
  return products.find((p) => p.product_id === id) ?? null;
}

export function getProductByBowen(bowen: string): Product | null {
  const key = String(bowen ?? '').trim().toUpperCase();
  const { products } = loadDataset();
  return products.find((p) => (p.bowen_no ?? '').toUpperCase() === key) ?? null;
}

/** 产品详情页用的 applications（含 blocked，但页面会明确分区展示） */
export function getApplicationsForProduct(productId: string): ProductApplication[] {
  const { applications } = loadDataset();
  return applications
    .filter((a) => a.product_id === productId)
    .sort((a, b) => a.source_sheet.localeCompare(b.source_sheet) || a.source_row - b.source_row);
}

/** 只有干净、可对外的 applications 才用于展示表格 */
export function getDisplayApplications(productId: string): ProductApplication[] {
  return getApplicationsForProduct(productId).filter((a) => !a.blocked && !a.needs_review);
}

// ---------------------------------------------------------------------------
// OE 搜索
// ---------------------------------------------------------------------------

export interface OeSearchResult {
  query: string;
  normalizedQuery: string;
  hits: OeSearchHit[];
  /** 精确匹配（用户输入与 normalized OE 完全一致） */
  exactHits: OeSearchHit[];
  /** 前缀/包含匹配，仅在精确匹配为空时提供，并明确标注 */
  partialHits: OeSearchHit[];
  totalProducts: number;
}

export function searchByOe(rawQuery: string): OeSearchResult {
  const dataset = loadDataset();
  const query = String(rawQuery ?? '').trim();
  const key = normalizeOeInput(query);
  const empty: OeSearchResult = {
    query, normalizedQuery: key, hits: [], exactHits: [], partialHits: [], totalProducts: 0,
  };
  if (!key) return empty;

  const productById = new Map(dataset.products.map((p) => [p.product_id, p]));
  const appById = new Map(dataset.applications.map((a) => [a.application_id, a]));

  const toHit = (entry: OeIndexEntry): OeSearchHit | null => {
    const product = productById.get(entry.product_id);
    const application = appById.get(entry.application_id);
    if (!product || !application) return null;
    if (product.blocked || product.status === 'draft' || product.status === 'blocked') return null;
    if (application.blocked || application.needs_review) return null;
    return {
      oe_number_raw: entry.oe_number_raw,
      oe_search_key: entry.oe_search_key,
      product,
      application,
    };
  };

  const exact: OeSearchHit[] = [];
  const partial: OeSearchHit[] = [];
  const seenExact = new Set<string>();
  const seenPartial = new Set<string>();

  for (const entry of dataset.oeIndex) {
    if (entry.oe_search_key === key) {
      const hit = toHit(entry);
      if (hit && !seenExact.has(hit.application.application_id + '|' + hit.oe_search_key)) {
        seenExact.add(hit.application.application_id + '|' + hit.oe_search_key);
        exact.push(hit);
      }
    } else if (entry.oe_search_key.includes(key) || key.includes(entry.oe_search_key)) {
      const hit = toHit(entry);
      if (hit && !seenPartial.has(hit.application.application_id + '|' + hit.oe_search_key)) {
        seenPartial.add(hit.application.application_id + '|' + hit.oe_search_key);
        partial.push(hit);
      }
    }
  }

  const hits = exact.length ? exact : partial;
  return {
    query,
    normalizedQuery: key,
    hits,
    exactHits: exact,
    partialHits: exact.length ? [] : partial.slice(0, 60),
    totalProducts: new Set(hits.map((h) => h.product.product_id)).size,
  };
}

/** 按 Bowen No. 搜索 */
export function searchByBowen(rawQuery: string): Product[] {
  const q = String(rawQuery ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return [];
  return getPublishedProducts().filter((p) => (p.bowen_no ?? '').toUpperCase().replace(/\s+/g, '').includes(q));
}

// ---------------------------------------------------------------------------
// 产品列表 / 筛选
// ---------------------------------------------------------------------------

function productMatchesQuery(p: Product, apps: ProductApplication[], q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toUpperCase();
  if (!needle) return true;
  if ((p.bowen_no ?? '').toUpperCase().includes(needle)) return true;
  if ((p.product_type ?? '').toUpperCase().includes(needle)) return true;
  for (const a of apps) {
    if (a.oe_numbers_raw.toUpperCase().includes(needle)) return true;
    if (a.oe_number_normalized.some((n) => n.includes(needle))) return true;
    if (a.vehicle_application_raw.toUpperCase().includes(needle)) return true;
  }
  return false;
}

export function listProducts(filters: ProductFilters = {}): ProductListResult {
  const dataset = loadDataset();
  const { q = '', type = '', make = '', engine = '', page = 1, pageSize = 12 } = filters;

  const appsByProduct = new Map<string, ProductApplication[]>();
  for (const a of dataset.applications) {
    if (a.blocked || a.needs_review) continue;
    if (!appsByProduct.has(a.product_id)) appsByProduct.set(a.product_id, []);
    appsByProduct.get(a.product_id)!.push(a);
  }

  let items = getPublishedProducts().map((p) => ({ product: p, apps: appsByProduct.get(p.product_id) ?? [] }));

  // OE 归一化搜索：如果输入像 OE 号，同时按标准化键匹配
  const oeKey = looksLikeOeQuery(q) ? normalizeOeInput(q) : '';

  items = items.filter(({ product, apps }) => {
    if (type && product.product_type !== type) return false;
    if (type && !product.product_type) return false;
    if (make || engine) {
      const hay = apps.map((a) => a.vehicle_application_raw.toUpperCase()).join(' ');
      if (make && !hay.includes(make.toUpperCase())) return false;
      if (engine && !hay.includes(engine.toUpperCase())) return false;
    }
    if (!q) return true;
    if (productMatchesQuery(product, apps, q)) return true;
    if (oeKey && apps.some((a) => a.oe_number_normalized.some((n) => n.includes(oeKey)))) return true;
    return false;
  });

  const total = items.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    items: items.slice(start, start + pageSize).map((x) => x.product),
    total,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// 分类与筛选选项
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, { en: string; zh: string; description: string }> = {
  thermostats: {
    en: 'Thermostats',
    zh: '节温器',
    description:
      'Our core product line. Thermostats, thermostat inserts and thermostat assemblies for passenger cars and light commercial vehicles.',
  },
  'temperature-sensors': {
    en: 'Temperature Sensors',
    zh: '温度传感器',
    description: 'Coolant temperature sensors matched to the same engine applications as our thermostats.',
  },
  'automotive-switches': {
    en: 'Automotive Switches',
    zh: '汽车开关',
    description: 'Thermal switches, oil pressure warning switches, brake light switches and reverse light switches.',
  },
  'related-cooling-parts': {
    en: 'Related Cooling Parts',
    zh: '冷却系统相关件',
    description: 'Coolant pipe flanges and related cooling system components.',
  },
};

const SWITCH_SUBCATEGORY_LABELS: Record<string, { en: string; zh: string }> = {
  'thermal-switches': { en: 'Thermal Switches', zh: '热敏开关' },
  'oil-pressure-warning-switches': { en: 'Oil Pressure Warning Switches', zh: '机油压力报警器' },
  'brake-light-switches': { en: 'Brake Light Switches', zh: '刹车灯开关' },
  'reverse-light-switches': { en: 'Reverse Light Switches', zh: '倒车灯开关' },
};

export function getCategorySummaries(): CategorySummary[] {
  const products = getPublishedProducts();
  const order = ['thermostats', 'temperature-sensors', 'automotive-switches', 'related-cooling-parts'];

  return order
    .map((category) => {
      const inCat = products.filter((p) => p.website_category === category);
      const subMap = new Map<string, number>();
      for (const p of inCat) {
        if (p.switch_subcategory) subMap.set(p.switch_subcategory, (subMap.get(p.switch_subcategory) ?? 0) + 1);
      }
      const label = CATEGORY_LABELS[category] ?? { en: category, zh: category, description: '' };
      return {
        category,
        labelEn: label.en,
        labelZh: label.zh,
        description: label.description,
        productCount: inCat.length,
        subcategories: subMap.size
          ? [...subMap.entries()].map(([key, count]) => ({
            key,
            labelEn: SWITCH_SUBCATEGORY_LABELS[key]?.en ?? key,
            labelZh: SWITCH_SUBCATEGORY_LABELS[key]?.zh ?? key,
            productCount: count,
          }))
          : undefined,
      };
    })
    // 规划要求：数据不足的类别不要强行展示空分类
    .filter((c) => c.productCount > 0);
}

export function getProductTypeOptions(): { value: string; label: string; count: number }[] {
  const products = getPublishedProducts().filter((p) => p.product_type);
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.product_type!, (counts.get(p.product_type!) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2'), count }))
    .sort((a, b) => b.count - a.count);
}

/** 从车型/发动机原文里提取可用于筛选的品牌线索（只按原文中真实出现的写法） */
const MAKE_HINTS = [
  'Volkswagen', 'Audi', 'BMW', 'Mercedes', 'Benz', 'Porsche', 'Skoda', 'SEAT', 'Opel', 'Vauxhall',
  'Buick', 'Chevrolet', 'Cadillac', 'GMC', 'Ford', 'Lincoln', 'Chrysler', 'Dodge', 'Jeep', 'Fiat', 'Lancia',
  'Peugeot', 'Citroen', 'Renault', 'Volvo', 'Saab', 'Toyota', 'Lexus', 'Honda', 'Acura', 'Nissan', 'Infiniti',
  'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Isuzu', 'Hyundai', 'Kia', 'Daewoo', 'SsangYong',
  'Land Rover', 'Jaguar', 'Mini', 'BYD', 'Geely', 'Chery', 'Great Wall', 'Haval', 'WEY', 'Changan',
  'Dongfeng', 'FAW', 'Roewe', 'MG', 'Maxus', 'Trumpchi', 'Brilliance', 'JAC', 'Zotye', 'Lifan', 'Haima',
  'Cummins', 'Perkins', 'Deutz', 'MAN', 'Scania', 'Iveco', 'Isuzu', 'Yuchai', 'Weichai',
  // 中文原始写法（保留，因为 Excel 原文就是中文）
  '大众', '奥迪', '宝马', '奔驰', '保时捷', '斯柯达', '别克', '雪佛兰', '凯迪拉克', '福特', '林肯',
  '克莱斯勒', '道奇', '吉普', '菲亚特', '标致', '雪铁龙', '雷诺', '沃尔沃', '丰田', '雷克萨斯',
  '本田', '日产', '英菲尼迪', '马自达', '三菱', '斯巴鲁', '铃木', '五十铃', '现代', '起亚',
  '大宇', '双龙', '路虎', '捷豹', '比亚迪', '吉利', '奇瑞', '长城', '哈弗', '长安', '东风',
  '一汽', '荣威', '名爵', '传祺', '中华', '江淮', '众泰', '力帆', '海马', '康明斯', '玉柴', '潍柴',
];

export function getMakeSummaries(): MakeSummary[] {
  const products = getPublishedProducts();
  const appsByProduct = new Map<string, ProductApplication[]>();
  for (const a of loadDataset().applications) {
    if (a.blocked || a.needs_review) continue;
    if (!appsByProduct.has(a.product_id)) appsByProduct.set(a.product_id, []);
    appsByProduct.get(a.product_id)!.push(a);
  }

  const map = new Map<string, { products: Set<string>; apps: number; engines: Set<string> }>();
  for (const p of products) {
    const apps = appsByProduct.get(p.product_id) ?? [];
    for (const a of apps) {
      const hay = a.vehicle_application_raw.toUpperCase();
      // 提取原文里出现的发动机样式 token，用于「Find by Application」展示
      const engines = (a.vehicle_application_raw.match(/\b[A-Z][A-Z0-9]{2,11}\b/g) ?? [])
        .filter((t) => /[0-9]/.test(t) && /[A-Z]/.test(t))
        .slice(0, 4);
      for (const hint of MAKE_HINTS) {
        if (hay.includes(hint.toUpperCase())) {
          if (!map.has(hint)) map.set(hint, { products: new Set(), apps: 0, engines: new Set() });
          const rec = map.get(hint)!;
          rec.products.add(p.product_id);
          rec.apps += 1;
          for (const e of engines) rec.engines.add(e);
        }
      }
    }
  }

  return [...map.entries()]
    .map(([make, rec]) => ({
      make,
      productCount: rec.products.size,
      applicationCount: rec.apps,
      sampleEngines: [...rec.engines].slice(0, 6),
    }))
    .sort((a, b) => b.productCount - a.productCount || a.make.localeCompare(b.make));
}

/** 站点级静态事实（全部来自项目资料，禁止编造） */
export function getSiteFacts() {
  return loadDataset().facts;
}

export function getDatasetStats() {
  const d = loadDataset();
  return {
    productCount: d.products.length,
    applicationCount: d.applications.length,
    oeIndexCount: d.oeIndex.length,
    publishedCount: getPublishedProducts().length,
    distinctOeCount: new Set(d.oeIndex.map((e) => e.oe_search_key)).size,
  };
}
