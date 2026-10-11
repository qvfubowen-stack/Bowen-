/**
 * JSON 仓储实现（Phase 3 原型使用）
 * ===========================================================================
 * 数据来自构建期生成的文件：
 *   website/src/data/products.json        ← tools/build-product-db-v2.mjs 产出
 *   website/src/data/applications.json
 *   website/src/data/oe-index.json
 *   website/src/data/site-facts.json
 *   website/src/data/product-images.json  ← 可靠主图映射（Phase 4.1 准入规则）
 *
 * 所有方法都声明为 async（符合 ProductRepository 接口），
 * 内部同步计算后直接返回。这样将来换 Supabase 实现时页面层无需改动。
 *
 * 这里是**唯一** import JSON 数据文件的地方。页面组件绝不直接 import 数据文件。
 *
 * ⚠️ Phase 4.1 — 公开产品准入规则（双重保障）
 * ---------------------------------------------------------------------------
 * 权威判定在数据生成阶段完成（tools/lib/publication-gate.mjs），
 * website/src/data/*.json 里**只应该**包含满足条件的公开产品。
 * 但页面层仍然在仓储这一层再查一次「有没有可靠主图」：
 * 只要 data 被手工改动、或将来换数据库实现漏了过滤，
 * 首页 / 列表 / 分类统计 / 品牌筛选 / OE 搜索 / Bowen 搜索 / 详情页 / RFQ / 静态参数
 * 全部走同一组方法，因此不会出现「列表里没有、详情页还能打开」的不一致。
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
} from '../types';
import type { DatasetStats, OeSearchResult, ProductRepository, SiteFacts } from '../repository';
import { looksLikeOeQuery, normalizeOeInput } from '../oe-normalize';
import { productImageSrc } from '../media';

interface Dataset {
  products: Product[];
  applications: ProductApplication[];
  oeIndex: OeIndexEntry[];
  facts: SiteFacts;
}

let cached: Dataset | null = null;

function loadDataset(): Dataset {
  if (cached) return cached;
  cached = {
    products: productsJson as unknown as Product[],
    applications: applicationsJson as unknown as ProductApplication[],
    oeIndex: oeIndexJson as unknown as OeIndexEntry[],
    facts: siteFactsJson as unknown as SiteFacts,
  };
  return cached;
}

// ---------------------------------------------------------------------------
// 分类文案（V1 只有 4 个分类；节温器不再区分 Insert / Assembly）
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, { en: string; zh: string; description: string }> = {
  thermostats: {
    en: 'Thermostats',
    zh: '节温器',
    description:
      'Our core product line. Thermostats and thermostat housings for passenger cars and light '
      + 'commercial vehicles, supplied by Bowen number.',
  },
  'temperature-sensors': {
    en: 'Temperature Sensors',
    zh: '温度传感器',
    description: 'Coolant temperature sensors listed against the same vehicle applications as our thermostats.',
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

// ---------------------------------------------------------------------------
// 车型品牌（中英别名合并）
// ---------------------------------------------------------------------------
/**
 * 业务要求：英文页面上的品牌名必须用**明确的中英别名表**合并展示，
 * 不能把「大众」和「Volkswagen」算成两个品牌。
 * 别名只用于匹配原始 application 文本；显示一律用 canonical 名称。
 * 不新增原始文本里没有出现的品牌。
 */
const MAKE_ALIAS_GROUPS: { canonical: string; aliases: string[] }[] = [
  { canonical: 'Volkswagen', aliases: ['Volkswagen', 'VW', '大众', '一汽大众', '一汽-大众', '上汽大众'] },
  { canonical: 'Audi', aliases: ['Audi', '奥迪'] },
  { canonical: 'BMW', aliases: ['BMW', '宝马'] },
  { canonical: 'Mercedes-Benz', aliases: ['Mercedes', 'Mercedes-Benz', 'Benz', '奔驰'] },
  { canonical: 'Porsche', aliases: ['Porsche', '保时捷'] },
  { canonical: 'Skoda', aliases: ['Skoda', '斯柯达'] },
  { canonical: 'SEAT', aliases: ['SEAT'] },
  { canonical: 'Opel', aliases: ['Opel', 'Vauxhall', '欧宝'] },
  { canonical: 'Buick', aliases: ['Buick', '别克'] },
  { canonical: 'Chevrolet', aliases: ['Chevrolet', '雪佛兰'] },
  { canonical: 'Cadillac', aliases: ['Cadillac', '凯迪拉克'] },
  { canonical: 'GMC', aliases: ['GMC'] },
  { canonical: 'Ford', aliases: ['Ford', '福特'] },
  { canonical: 'Lincoln', aliases: ['Lincoln', '林肯'] },
  { canonical: 'Chrysler', aliases: ['Chrysler', '克莱斯勒'] },
  { canonical: 'Dodge', aliases: ['Dodge', '道奇'] },
  { canonical: 'Jeep', aliases: ['Jeep', '吉普'] },
  { canonical: 'Fiat', aliases: ['Fiat', '菲亚特'] },
  { canonical: 'Lancia', aliases: ['Lancia'] },
  { canonical: 'Peugeot', aliases: ['Peugeot', '标致'] },
  { canonical: 'Citroen', aliases: ['Citroen', 'Citroën', '雪铁龙'] },
  { canonical: 'Renault', aliases: ['Renault', '雷诺'] },
  { canonical: 'Volvo', aliases: ['Volvo', '沃尔沃'] },
  { canonical: 'Saab', aliases: ['Saab'] },
  { canonical: 'Toyota', aliases: ['Toyota', '丰田'] },
  { canonical: 'Lexus', aliases: ['Lexus', '雷克萨斯'] },
  { canonical: 'Honda', aliases: ['Honda', '本田'] },
  { canonical: 'Acura', aliases: ['Acura', '讴歌'] },
  { canonical: 'Nissan', aliases: ['Nissan', '日产'] },
  { canonical: 'Infiniti', aliases: ['Infiniti', '英菲尼迪'] },
  { canonical: 'Mazda', aliases: ['Mazda', '马自达'] },
  { canonical: 'Mitsubishi', aliases: ['Mitsubishi', '三菱'] },
  { canonical: 'Subaru', aliases: ['Subaru', '斯巴鲁'] },
  { canonical: 'Suzuki', aliases: ['Suzuki', '铃木'] },
  { canonical: 'Isuzu', aliases: ['Isuzu', '五十铃'] },
  { canonical: 'Hyundai', aliases: ['Hyundai', '现代'] },
  { canonical: 'Kia', aliases: ['Kia', '起亚'] },
  { canonical: 'Daewoo', aliases: ['Daewoo', '大宇'] },
  { canonical: 'SsangYong', aliases: ['SsangYong', '双龙'] },
  { canonical: 'Land Rover', aliases: ['Land Rover', 'LandRover', '路虎'] },
  { canonical: 'Jaguar', aliases: ['Jaguar', '捷豹'] },
  { canonical: 'Mini', aliases: ['Mini'] },
  { canonical: 'BYD', aliases: ['BYD', '比亚迪'] },
  { canonical: 'Geely', aliases: ['Geely', '吉利'] },
  { canonical: 'Chery', aliases: ['Chery', '奇瑞'] },
  { canonical: 'Great Wall', aliases: ['Great Wall', '长城'] },
  { canonical: 'Haval', aliases: ['Haval', '哈弗'] },
  { canonical: 'WEY', aliases: ['WEY'] },
  { canonical: 'Changan', aliases: ['Changan', '长安'] },
  { canonical: 'Dongfeng', aliases: ['Dongfeng', '东风'] },
  { canonical: 'FAW', aliases: ['FAW', '一汽'] },
  { canonical: 'Roewe', aliases: ['Roewe', '荣威'] },
  { canonical: 'MG', aliases: ['MG', '名爵'] },
  { canonical: 'Maxus', aliases: ['Maxus', '上汽大通'] },
  { canonical: 'Trumpchi', aliases: ['Trumpchi', '传祺'] },
  { canonical: 'Brilliance', aliases: ['Brilliance', '中华'] },
  { canonical: 'JAC', aliases: ['JAC', '江淮'] },
  { canonical: 'Zotye', aliases: ['Zotye', '众泰'] },
  { canonical: 'Lifan', aliases: ['Lifan', '力帆'] },
  { canonical: 'Haima', aliases: ['Haima', '海马'] },
  { canonical: 'Cummins', aliases: ['Cummins', '康明斯'] },
  { canonical: 'Perkins', aliases: ['Perkins'] },
  { canonical: 'Deutz', aliases: ['Deutz'] },
  { canonical: 'MAN', aliases: ['MAN'] },
  { canonical: 'Scania', aliases: ['Scania'] },
  { canonical: 'Iveco', aliases: ['Iveco'] },
  { canonical: 'Yuchai', aliases: ['Yuchai', '玉柴'] },
  { canonical: 'Weichai', aliases: ['Weichai', '潍柴'] },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface MakeMatcher {
  canonical: string;
  aliases: string[];
  /** 拉丁字母别名用词边界匹配，避免 VW 命中别的词 */
  latinRe: RegExp | null;
  cjkAliases: string[];
}

const MAKE_MATCHERS: MakeMatcher[] = MAKE_ALIAS_GROUPS.map((g) => {
  const latin = g.aliases.filter((a) => /^[\x20-\x7e]+$/.test(a)).map((a) => a.toUpperCase());
  const cjk = g.aliases.filter((a) => /[\u4e00-\u9fff]/.test(a));
  return {
    canonical: g.canonical,
    aliases: g.aliases,
    latinRe: latin.length
      ? new RegExp(`(^|[^A-Z0-9])(${latin.map(escapeRe).join('|')})([^A-Z0-9]|$)`)
      : null,
    cjkAliases: cjk,
  };
});

/** 原始 application 文本是否属于某个品牌 */
function makeMatches(m: MakeMatcher, hayUpper: string): boolean {
  if (m.latinRe && m.latinRe.test(hayUpper)) return true;
  return m.cjkAliases.some((a) => hayUpper.includes(a));
}

/** 用户在 URL / 表单里给出的品牌值 → 对应的 matcher（支持中文别名与 canonical 名） */
function resolveMake(value: string): MakeMatcher | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  for (const m of MAKE_MATCHERS) {
    if (m.canonical.toUpperCase() === upper) return m;
    if (m.aliases.some((a) => a.toUpperCase() === upper)) return m;
  }
  return null;
}

export class JsonProductRepository implements ProductRepository {
  // ------------------------------------------------------------ 准入规则
  /**
   * 公开准入（Phase 4.1）：状态允许 + 未 blocked + 有可靠主图。
   * 有可靠主图 = website/src/data/product-images.json 里有该 product_id
   * （该文件只由 tools/lib/publication-gate.mjs 的发布集合生成：
   *  mapping_status === 'exact' 且 is_primary_image === true）。
   */
  private isPublic(product: Product): boolean {
    if (product.blocked) return false;
    if (product.status !== 'prototype_candidate' && product.status !== 'searchable_noindex') return false;
    return productImageSrc(product.product_id) !== null;
  }

  // ------------------------------------------------------------------ 产品
  async getPublishedProducts(): Promise<Product[]> {
    const { products } = loadDataset();
    return products
      .filter((p) => this.isPublic(p))
      .sort((a, b) => {
        if (a.prototype_rank && b.prototype_rank) return a.prototype_rank - b.prototype_rank;
        if (a.prototype_rank) return -1;
        if (b.prototype_rank) return 1;
        return (a.bowen_no ?? '').localeCompare(b.bowen_no ?? '', undefined, { numeric: true });
      });
  }

  async getProductById(id: string): Promise<Product | null> {
    const { products } = loadDataset();
    const found = products.find((p) => p.product_id === id) ?? null;
    // 无可靠主图 / 状态不允许的产品，详情页必须 404（不能显示 fallback 占位图）
    if (!found || !this.isPublic(found)) return null;
    return found;
  }

  async getProductByBowen(bowenNo: string): Promise<Product | null> {
    const key = String(bowenNo ?? '').trim().toUpperCase();
    const { products } = loadDataset();
    const found = products.find((p) => (p.bowen_no ?? '').toUpperCase() === key) ?? null;
    if (!found || !this.isPublic(found)) return null;
    return found;
  }

  async listProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
    const dataset = loadDataset();
    const { q = '', type = '', make = '', engine = '', page = 1, pageSize = 12 } = filters;

    const appsByProduct = new Map<string, ProductApplication[]>();
    for (const a of dataset.applications) {
      if (a.blocked || a.needs_review) continue;
      if (!appsByProduct.has(a.product_id)) appsByProduct.set(a.product_id, []);
      appsByProduct.get(a.product_id)!.push(a);
    }

    const published = await this.getPublishedProducts();
    let items = published.map((p) => ({ product: p, apps: appsByProduct.get(p.product_id) ?? [] }));

    const oeKey = looksLikeOeQuery(q) ? normalizeOeInput(q) : '';
    const makeMatcher = resolveMake(make);

    items = items.filter(({ product, apps }) => {
      if (type && product.product_type !== type) return false;
      if (make || engine) {
        const hay = apps.map((a) => a.vehicle_application_raw.toUpperCase()).join(' ');
        // 品牌：用别名表匹配（中英文写法算同一个品牌）
        if (make && !(makeMatcher ? makeMatches(makeMatcher, hay) : hay.includes(make.toUpperCase()))) return false;
        // engine 参数保留为「application 原文自由文本搜索」，
        // 不再声称它是已确认的发动机代号（Phase 4.1）。
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

  // ------------------------------------------------------------------ 应用
  async getApplicationsForProduct(productId: string): Promise<ProductApplication[]> {
    const { applications } = loadDataset();
    return applications
      .filter((a) => a.product_id === productId)
      .sort((a, b) => a.source_sheet.localeCompare(b.source_sheet) || a.source_row - b.source_row);
  }

  async getDisplayApplications(productId: string): Promise<ProductApplication[]> {
    // 只对公开产品返回 application —— 避免无图产品通过 application 关联间接外露
    if (!(await this.getProductById(productId))) return [];
    const apps = await this.getApplicationsForProduct(productId);
    return apps.filter((a) => !a.blocked && !a.needs_review);
  }

  // ------------------------------------------------------------------ 搜索
  async searchByOe(rawQuery: string): Promise<OeSearchResult> {
    const dataset = loadDataset();
    const query = String(rawQuery ?? '').trim();
    const key = normalizeOeInput(query);
    const empty: OeSearchResult = {
      query, normalizedQuery: key, hits: [], exactHits: [], partialHits: [], totalProducts: 0,
    };
    if (!key) return empty;

    const publicIds = new Set((await this.getPublishedProducts()).map((p) => p.product_id));
    const productById = new Map(dataset.products.map((p) => [p.product_id, p]));
    const appById = new Map(dataset.applications.map((a) => [a.application_id, a]));

    const toHit = (entry: OeIndexEntry): OeSearchHit | null => {
      if (!publicIds.has(entry.product_id)) return null;
      const product = productById.get(entry.product_id);
      const application = appById.get(entry.application_id);
      if (!product || !application) return null;
      if (application.blocked || application.needs_review) return null;
      return { oe_number_raw: entry.oe_number_raw, oe_search_key: entry.oe_search_key, product, application };
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

  async searchByBowen(rawQuery: string): Promise<Product[]> {
    const q = String(rawQuery ?? '').trim().toUpperCase().replace(/\s+/g, '');
    if (!q) return [];
    const published = await this.getPublishedProducts();
    return published.filter((p) => (p.bowen_no ?? '').toUpperCase().replace(/\s+/g, '').includes(q));
  }

  // ------------------------------------------------------------------ 汇总
  async getCategorySummaries(): Promise<CategorySummary[]> {
    const products = await this.getPublishedProducts();
    const order = ['thermostats', 'temperature-sensors', 'automotive-switches', 'related-cooling-parts'];

    return order
      .map((category) => {
        const inCat = products.filter((p) => p.website_category === category);
        const subMap = new Map<string, number>();
        for (const p of inCat) {
          if (p.switch_subcategory) {
            subMap.set(p.switch_subcategory, (subMap.get(p.switch_subcategory) ?? 0) + 1);
          }
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

  async getProductTypeOptions(): Promise<{ value: string; label: string; count: number }[]> {
    const products = (await this.getPublishedProducts()).filter((p) => p.product_type);
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.product_type!, (counts.get(p.product_type!) ?? 0) + 1);
    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2'), count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 车型品牌汇总（数量只统计公开产品）。
   * Phase 4.1：不再返回 sampleEngines —— 自动提取的发动机标签不对外展示。
   * 品牌使用中英别名表合并，避免「大众 / Volkswagen」被算成两个品牌。
   */
  async getMakeSummaries(): Promise<MakeSummary[]> {
    const products = await this.getPublishedProducts();
    const appsByProduct = new Map<string, ProductApplication[]>();
    for (const a of loadDataset().applications) {
      if (a.blocked || a.needs_review) continue;
      if (!appsByProduct.has(a.product_id)) appsByProduct.set(a.product_id, []);
      appsByProduct.get(a.product_id)!.push(a);
    }

    const map = new Map<string, { products: Set<string>; apps: number; aliases: string[] }>();
    for (const p of products) {
      const apps = appsByProduct.get(p.product_id) ?? [];
      for (const a of apps) {
        const hay = a.vehicle_application_raw.toUpperCase();
        for (const m of MAKE_MATCHERS) {
          if (!makeMatches(m, hay)) continue;
          if (!map.has(m.canonical)) map.set(m.canonical, { products: new Set(), apps: 0, aliases: m.aliases });
          const rec = map.get(m.canonical)!;
          rec.products.add(p.product_id);
          rec.apps += 1;
        }
      }
    }

    return [...map.entries()]
      .map(([make, rec]) => ({
        make,
        aliases: rec.aliases,
        productCount: rec.products.size,
        applicationCount: rec.apps,
      }))
      .sort((a, b) => b.productCount - a.productCount || a.make.localeCompare(b.make));
  }

  // ------------------------------------------------------------------ 事实
  async getSiteFacts(): Promise<SiteFacts> {
    return loadDataset().facts;
  }

  async getDatasetStats(): Promise<DatasetStats> {
    const d = loadDataset();
    const published = await this.getPublishedProducts();
    const publicIds = new Set(published.map((p) => p.product_id));
    // 统计口径与公开产品集合一致（首页数字不能和列表/搜索打架）
    const apps = d.applications.filter((a) => publicIds.has(a.product_id));
    const appIds = new Set(apps.map((a) => a.application_id));
    const oe = d.oeIndex.filter((e) => appIds.has(e.application_id));
    return {
      productCount: published.length,
      applicationCount: apps.length,
      oeIndexCount: oe.length,
      publishedCount: published.length,
      distinctOeCount: new Set(oe.map((e) => e.oe_search_key)).size,
    };
  }
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------
function productMatchesQuery(p: Product, apps: ProductApplication[], q: string): boolean {
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
