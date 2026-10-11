/**
 * 站点图片访问层（唯一读取图片映射的地方）
 * ===========================================================================
 * 页面组件**不**直接 import 图片 JSON，也不手写图片路径。
 *
 * 数据来源（构建期生成，见 tools/p4-build-site-assets.mjs）：
 *   src/data/product-images.json   product_id → /assets/products/...（只含可靠主图）
 *   src/data/site-media.json       公司 / 工厂 / 证书图片清单（含 alt 与手册页码）
 *
 * 重要：产品图只包含 data/processed/product-image-map.json 中
 *   mapping_status === 'exact' && is_primary_image === true
 * 的记录。没有条目的产品返回 null，由页面走 fallback —— 绝不猜测性绑定图片。
 */
import productImagesJson from '@/data/product-images.json';
import siteMediaJson from '@/data/site-media.json';

const PRODUCT_IMAGES = productImagesJson.images as Record<string, string>;

/** 产品主图；没有可靠图片时返回 null（页面必须容忍 null） */
export function productImageSrc(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return PRODUCT_IMAGES[productId] ?? null;
}

/**
 * 产品图 alt 文本：使用 Bowen No. + 已核实的产品名称。
 * 两者都缺失时退回一个不含猜测内容的通用描述。
 */
export function productImageAlt(
  bowenNo: string | null | undefined,
  productNameEn: string | null | undefined,
): string {
  const bowen = (bowenNo ?? '').trim();
  const name = (productNameEn ?? '').trim();
  if (bowen && name) return `Bowen No. ${bowen} — ${name}`;
  if (bowen) return `Bowen No. ${bowen} — automotive thermostat part`;
  if (name) return `Bowen product — ${name}`;
  return 'Bowen product';
}

export interface SiteImage {
  src: string;
  alt: string;
  caption: string;
  brochure_page: number;
  source_object: string;
  width: number;
  height: number;
  source_sha256: string;
  source_evidence: string;
}

export interface SiteMedia {
  generated_at: string;
  source: Record<string, string>;
  counts: { company: number; factory: number; certificates: number; total: number };
  company: SiteImage[];
  factory: SiteImage[];
  certificates: SiteImage[];
}

/** 公司 / 工厂 / 证书图片清单（全部来自宣传手册 PDF） */
export const siteMedia = siteMediaJson as unknown as SiteMedia;

/** 按站点文件名取一张手册图；找不到返回 null */
export function factoryImage(file: string): SiteImage | null {
  return siteMedia.factory.find((i) => i.src.endsWith(`/${file}`)) ?? null;
}

export function companyImage(file: string): SiteImage | null {
  return siteMedia.company.find((i) => i.src.endsWith(`/${file}`)) ?? null;
}

export function certificateImage(file: string): SiteImage | null {
  return siteMedia.certificates.find((i) => i.src.endsWith(`/${file}`)) ?? null;
}
