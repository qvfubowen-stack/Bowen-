/**
 * 数据仓储接口（Repository）
 * ===========================================================================
 * 这一层的作用：把「页面要什么数据」和「数据存在哪里」彻底分开。
 *
 * 现状（Phase 3 原型）：由 JsonProductRepository 实现，数据来自构建期生成的 JSON。
 * 未来（接入 PostgreSQL / Supabase）：新增一个 SupabaseProductRepository 实现同一接口，
 *                                    在 getRepository() 里切换即可。
 *
 * ⚠️ 关于「换成 Supabase 要改多少」的诚实说明
 * ---------------------------------------------------------------------------
 * 只改 getRepository() 的实现类**是必要但不充分**的。接入真实数据库时至少要同时处理：
 *   1. 本文件所有方法**已经是 async**，所以页面层不用改（这是本设计的主要收益）。
 *   2. getMakeSummaries() 现在是在 Node 里遍历全部 application 聚合出来的；
 *      真库里应改成 SQL 聚合视图或物化视图，否则会把全表拉到应用层。
 *   3. 分页：listProducts() 现在在内存里 slice；真库里必须变成 LIMIT/OFFSET，
 *      并返回真实 total（COUNT 查询）。
 *   4. OE 搜索：现在是对 oe_index 全表做 includes() 模糊匹配；
 *      真库里应使用索引列精确匹配 + 前缀匹配，并考虑 pg_trgm 或全文检索。
 *   5. 缓存与失效：现在是进程内 memo；真库里要决定用 Next 的 fetch 缓存、
 *      unstable_cache、还是显式 revalidate。
 *   6. 鉴权与限流：RFQ 提交、后台查询需要服务端会话与速率限制，这一层现在没有。
 *   7. 构建期渲染：20 个产品页在 build 时静态生成；真库里要考虑 ISR 或按需渲染，
 *      否则构建会随产品量线性变慢。
 *   8. 站点静态事实（site-facts）现在来自 JSON 文件；真库里应改为 settings 表或环境配置。
 *
 * 详见 docs/supabase-migration-boundary.md。
 */

import type {
  CategorySummary,
  MakeSummary,
  OeSearchHit,
  Product,
  ProductApplication,
  ProductFilters,
  ProductListResult,
} from './types';

/** 管理体系认证（逐字来自宣传手册 P12 与证书原图） */
export interface CertificationFact {
  standard: string;
  system: string;
  scope: string;
  scope_exclusion: string | null;
  certification_body: string | null;
  iatf_certificate_no: string | null;
  nqa_certificate_no: string | null;
  /** ISO 证书编号（IATF 用上面两个字段） */
  certificate_no?: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  surveillance: string | null;
  /** 证书图片路径；手册未附图片时为 null */
  image: string | null;
  /**
   * Phase 4.1 业务规则：**只有存在证书图片的认证才在公开网站展示**。
   * is_public === false 的条目只是内部证据，页面不得展示、
   * 也不得写进元描述或结构化数据。
   */
  is_public: boolean;
  /** is_public === false 时说明为什么（内部记录，不上页面） */
  public_hide_reason: string | null;
  evidence: string;
}

/** 资质荣誉（宣传手册 P13） */
export interface HonorFact {
  name: string;
  name_zh: string;
  /** certificate = 证书；public_list = 公示名单（不是管理体系认证证书） */
  document_kind: 'certificate' | 'public_list';
  certificate_no: string | null;
  entry_no?: string | null;
  issue_date: string | null;
  validity: string | null;
  image: string | null;
  is_public: boolean;
  evidence: string;
}

/** 站点级静态事实（公司规模、联系方式、认证等），与产品数据分开管理 */
export interface SiteFacts {
  company: {
    /** 正式英文全称（宣传手册 P3 / P14） */
    legal_name_en: string;
    /** 正式中文名称（宣传手册 P1 / P3 / P14） */
    legal_name_zh: string;
    brand_name: string;
    since_year: number;
    /** 建设工厂并扩大经营规模的年份 */
    factory_built_year: number;
    email: string;
    /** 手册原样号码，不带国家码 */
    tel_national: string;
    /** 展示用格式 */
    tel_display: string;
    /** tel: 链接用格式 */
    tel_href: string;
    /** 国内平台（1688）—— 必须明确标注为中国国内平台，不是海外官网 */
    domestic_marketplace_url: string;
    domestic_marketplace_label: string;
    domestic_marketplace_note: string;
    manufacturing_base_m2: number;
    production_workshop_m2: number;
    temperature_controlled_workshop_m2: number;
    production_equipment_count: number;
    rd_projects: number;
    patents: number;
    software_copyrights: number;
    /** 内部证据清单（含 ISO 14001 / ISO 45001）—— **页面不得直接展示** */
    certifications: string[];
    /** 内部完整标准号 —— **页面不得直接展示** */
    certification_standards: string[];
    /** 只有内部资料、手册没有证书图片的认证（当前为 ISO 两项） */
    internal_only_certifications: string[];
    /**
     * ★ 允许公开的认证（当前只有 IATF 16949：有证书图片）。
     * 页面只能用这一组字段，见 website/tools/verify-public-surface.mjs。
     */
    public_certifications: string[];
    public_certification_standards: string[];
    /** 已由业务方确认可对外公开的街道地址 */
    address_en: string;
    postal_code: string;
    country: string;
    /** 地址来源说明（内部字段，不入页面） */
    address_evidence: string;
    product_range: string[];
    evidence_source: string;
  };
  /** 管理体系认证明细 */
  certifications_detail?: CertificationFact[];
  honors?: HonorFact[];
  prototype_product_ids?: string[];
  prototype_product_count?: number;
  site_product_count?: number;
  generated_from?: string;
  generated_at?: string;
}

/** OE 搜索结果（保留 Product + 命中的 Application 上下文） */
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

export interface DatasetStats {
  productCount: number;
  applicationCount: number;
  oeIndexCount: number;
  publishedCount: number;
  distinctOeCount: number;
}

/**
 * 产品数据仓储。
 *
 * 所有方法都是 async —— 即使当前 JSON 实现是同步就能算完的。
 * 这样做的代价是多一层 Promise；收益是接入真实数据库时页面层**不需要改**。
 */
export interface ProductRepository {
  // ---- 产品 ----
  /** 网站可见产品（prototype_candidate + searchable_noindex，排除 blocked） */
  getPublishedProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  getProductByBowen(bowenNo: string): Promise<Product | null>;
  listProducts(filters: ProductFilters): Promise<ProductListResult>;

  // ---- 应用/适配 ----
  /** 产品的全部 application（含 blocked / needs_review，供内部审计用） */
  getApplicationsForProduct(productId: string): Promise<ProductApplication[]>;
  /** 只含可对外展示的 application（排除 blocked 与 needs_review） */
  getDisplayApplications(productId: string): Promise<ProductApplication[]>;

  // ---- OE 搜索 ----
  searchByOe(rawQuery: string): Promise<OeSearchResult>;
  searchByBowen(rawQuery: string): Promise<Product[]>;

  // ---- 汇总（用于导航/筛选器）----
  getCategorySummaries(): Promise<CategorySummary[]>;
  getProductTypeOptions(): Promise<{ value: string; label: string; count: number }[]>;
  getMakeSummaries(): Promise<MakeSummary[]>;

  // ---- 站点事实与统计 ----
  getSiteFacts(): Promise<SiteFacts>;
  getDatasetStats(): Promise<DatasetStats>;
}

/**
 * 当前使用的仓储实现。
 * 接入 Supabase 时，只改这一个函数（换成 SupabaseProductRepository 实例），
 * 页面层与 API 层都不需要改 —— 但请同时处理上面列出的 8 项配套工作。
 */
let repository: ProductRepository | null = null;

export function setRepository(repo: ProductRepository): void {
  repository = repo;
}

export function getRepository(): ProductRepository {
  if (!repository) {
    throw new Error(
      '数据仓储尚未初始化。请在 src/lib/db.ts 中注册实现（见 registerDefaultRepository）。',
    );
  }
  return repository;
}
