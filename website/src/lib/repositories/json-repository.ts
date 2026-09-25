/**
 * JSON 仓储实现（Phase 3 原型使用）
 * ===========================================================================
 * 数据来自构建期生成的文件：
 *   website/src/data/products.json        ← tools/build-product-db-v2.mjs 产出
 *   website/src/data/applications.json
 *   website/src/data/oe-index.json
 *   website/src/data/site-facts.json
 *
 * 所有方法都声明为 async（符合 ProductRepository 接口），
 * 内部同步计算后直接返回。这样将来换 Supabase 实现时页面层无需改动。
 *
 * 这里是**唯一** import JSON 数据文件的地方。页面组件绝不直接 import 数据文件。
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

/** 原文里可确认的车型品牌写法（只做匹配，不新增原文没有的品牌） */
const MAKE_HINTS = [
  'Volkswagen', 'Audi', 'BMW', 'Mercedes', 'Benz', 'Porsche', 'Skoda', 'SEAT', 'Opel', 'Vauxhall',
  'Buick', 'Chevrolet', 'Cadillac', 'GMC', 'Ford', 'Lincoln', 'Chrysler', 'Dodge', 'Jeep', 'Fiat', 'Lancia',
  'Peugeot', 'Citroen', 'Renault', 'Volvo', 'Saab', 'Toyota', 'Lexus', 'Honda', 'Acura', 'Nissan', 'Infiniti',
  'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Isuzu', 'Hyundai', 'Kia', 'Daewoo', 'SsangYong',
  'Land Rover', 'Jaguar', 'Mini', 'BYD', 'Geely', 'Chery', 'Great Wall', 'Haval', 'WEY', 'Changan',
  'Dongfeng', 'FAW', 'Roewe', 'MG', 'Maxus', 'Trumpchi', 'Brilliance', 'JAC', 'Zotye', 'Lifan', 'Haima',
  'Cummins', 'Perkins', 'Deutz', 'MAN', 'Scania', 'Iveco', 'Yuchai', 'Weichai',
  '大众', '奥迪', '宝马', '奔驰', '保时捷', '斯柯达', '别克', '雪佛兰', '凯迪拉克', '福特', '林肯',
  '克莱斯勒', '道奇', '吉普', '菲亚特', '标致', '雪铁龙', '雷诺', '沃尔沃', '丰田', '雷克萨斯',
  '本田', '日产', '英菲尼迪', '马自达', '三菱', '斯巴鲁', '铃木', '五十铃', '现代', '起亚',
  '大宇', '双龙', '路虎', '捷豹', '比亚迪', '吉利', '奇瑞', '长城', '哈弗', '长安', '东风',
  '一汽', '荣威', '名爵', '传祺', '中华', '江淮', '众泰', '力帆', '海马', '康明斯', '玉柴', '潍柴',
];

export class JsonProductRepository implements ProductRepository {
  // ------------------------------------------------------------------ 产品
  async getPublishedProducts(): Promise<Product[]> {
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

  async getProductById(id: string): Promise<Product | null> {
    const { products } = loadDataset();
    return products.find((p) => p.product_id === id) ?? null;
  }

  async getProductByBowen(bowenNo: string): Promise<Product | null> {
    const key = String(bowenNo ?? '').trim().toUpperCase();
    const { products } = loadDataset();
    return products.find((p) => (p.bowen_no ?? '').toUpperCase() === key) ?? null;
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

    items = items.filter(({ product, apps }) => {
      if (type && product.product_type !== type) return false;
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

  // ------------------------------------------------------------------ 应用
  async getApplicationsForProduct(productId: string): Promise<ProductApplication[]> {
    const { applications } = loadDataset();
    return applications
      .filter((a) => a.product_id === productId)
      .sort((a, b) => a.source_sheet.localeCompare(b.source_sheet) || a.source_row - b.source_row);
  }

  async getDisplayApplications(productId: string): Promise<ProductApplication[]> {
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

    const productById = new Map(dataset.products.map((p) => [p.product_id, p]));
    const appById = new Map(dataset.applications.map((a) => [a.application_id, a]));

    const toHit = (entry: OeIndexEntry): OeSearchHit | null => {
      const product = productById.get(entry.product_id);
      const application = appById.get(entry.application_id);
      if (!product || !application) return null;
      if (product.blocked || product.status === 'draft' || product.status === 'blocked') return null;
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

  async getMakeSummaries(): Promise<MakeSummary[]> {
    const products = await this.getPublishedProducts();
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

  // ------------------------------------------------------------------ 事实
  async getSiteFacts(): Promise<SiteFacts> {
    return loadDataset().facts;
  }

  async getDatasetStats(): Promise<DatasetStats> {
    const d = loadDataset();
    const published = await this.getPublishedProducts();
    return {
      productCount: d.products.length,
      applicationCount: d.applications.length,
      oeIndexCount: d.oeIndex.length,
      publishedCount: published.length,
      distinctOeCount: new Set(d.oeIndex.map((e) => e.oe_search_key)).size,
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
