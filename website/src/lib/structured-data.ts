/**
 * JSON-LD 结构化数据
 * ===========================================================================
 * 只生成**有据可查**的字段。明确不生成：
 *   - Offer / price / priceCurrency（本站不做线上报价，没有价格）
 *   - aggregateRating / review（没有真实评价）
 *   - 库存可售状态、GTIN、品牌授权（业务方未确认）
 *   - 任何「适配结论」——适配关系一律附带 "confirm before ordering" 口径
 *
 * 所有输出都经过 safeJsonLd() 转义后再内联，避免 </script> 注入。
 */
import { absoluteUrl, getSiteOrigin, getSiteUrl } from './site-url';

/** 组织信息最小子集（只允许公开字段） */
export interface OrganizationFacts {
  legal_name_en: string;
  brand_name: string;
  email: string;
  tel_display: string;
  address_en: string;
  country: string;
  postal_code: string;
  since_year: number;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface ProductSchemaInput {
  product_id: string;
  bowen_no: string | null;
  product_type: string | null;
  product_name_en: string;
  /** 站点相对路径，例如 /assets/products/bw-3005.jpg；null = 没有可靠图片，则不输出 image */
  image_path: string | null;
  /** 有据可查的主要 OE 参考（数量由调用方限制，避免堆砌） */
  oe_references: string[];
  /** 已核实的产品页路径 */
  path: string;
  /** 站点已有的应用条数（数字，不是结论） */
  application_count: number;
}

/**
 * JSON-LD 安全序列化。
 * 之所以必须做：结构化数据写在 <script> 里，一旦某个字段含有 "</script>"
 * 就能提前闭合标签并注入脚本。这里把 <、>、& 与行分隔符全部转成 \uXXXX。
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** 直接给 <script> 用的 props，保证全站只有一种内联方式 */
export function jsonLdScriptProps(data: unknown): {
  type: 'application/ld+json';
  dangerouslySetInnerHTML: { __html: string };
} {
  return { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: safeJsonLd(data) } };
}

/** Organization —— 只写已确认的公司事实 */
export function organizationSchema(facts: OrganizationFacts): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${getSiteUrl()}/#organization`,
    name: facts.legal_name_en,
    alternateName: facts.brand_name,
    url: getSiteUrl(),
    email: facts.email,
    telephone: facts.tel_display,
    foundingDate: String(facts.since_year),
    address: {
      '@type': 'PostalAddress',
      streetAddress: facts.address_en,
      addressLocality: 'Qufu',
      addressRegion: 'Shandong',
      postalCode: facts.postal_code,
      addressCountry: facts.country,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: facts.email,
        telephone: facts.tel_display,
        availableLanguage: ['en'],
      },
    ],
  };
}

/** WebSite —— 站点级搜索入口（站内 OE 搜索，不是第三方搜索引擎） */
export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${getSiteUrl()}/#website`,
    name: 'Bowen — Automotive Thermostat Manufacturer',
    url: getSiteUrl(),
    inLanguage: 'en',
    publisher: { '@id': `${getSiteUrl()}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getSiteUrl()}/oe-search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** BreadcrumbList */
export function breadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Product —— 目录型产品条目。
 * 刻意不包含 offers / aggregateRating / review / gtin / 库存字段。
 */
export function productSchema(input: ProductSchemaInput): Record<string, unknown> {
  const bowen = (input.bowen_no ?? '').trim();
  const typeLabel = input.product_type
    ? input.product_type.replace(/([a-z])([A-Z])/g, '$1 $2')
    : null;

  const name = bowen
    ? `Bowen No. ${bowen}${typeLabel ? ` — ${typeLabel}` : ''}`
    : `${input.product_name_en}`.trim();

  const description = [
    typeLabel ? `${typeLabel} supplied by Bowen.` : 'Automotive component supplied by Bowen.',
    bowen ? `Bowen No. ${bowen}.` : '',
    input.oe_references.length
      ? `Cross-referenced OE numbers: ${input.oe_references.slice(0, 6).join(', ')}.`
      : '',
    input.application_count > 0
      ? `${input.application_count} recorded vehicle application${input.application_count === 1 ? '' : 's'} in our product data.`
      : '',
    'Fitment must be confirmed with Bowen before ordering.',
  ].filter(Boolean).join(' ');

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: absoluteUrl(input.path),
    category: typeLabel ?? 'Automotive parts',
    manufacturer: {
      '@type': 'Organization',
      name: 'Qufu Bowen Auto Parts Manufacturing Co., Ltd.',
      url: getSiteUrl(),
    },
  };

  if (bowen) schema.sku = bowen;
  if (input.image_path) schema.image = [absoluteUrl(input.image_path)];
  if (input.product_name_en) schema.alternateName = input.product_name_en;

  return schema;
}

/** 站点默认分享图路径（静态素材，见 public/og-image.png） */
export const DEFAULT_OG_IMAGE = '/og-image.png';
export { getSiteOrigin };
