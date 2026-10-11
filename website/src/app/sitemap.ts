import type { MetadataRoute } from 'next';

import { getPublishedProducts } from '@/lib/db';
import { absoluteUrl, getSiteUrl, isIndexingEnabled, isLocalFallbackUrl } from '@/lib/site-url';

export const dynamic = 'force-static';

/**
 * sitemap.xml
 * ===========================================================================
 * 只包含"确实可以公开"的内容：
 *   - 首页、产品列表、About Bowen、Factory、Quality、Contact、Privacy、Terms
 *   - 公开产品详情页（清单由仓储方法 getPublishedProducts() 生成，绝不硬编码 ID）
 *
 * 明确不包含：
 *   - 无可靠主图的产品（仓储层已经过滤，见 JsonProductRepository.isPublic）
 *   - draft / blocked / 需要人工复核 / unresolved 的记录
 *   - /rfq、/oe-search（含查询结果）、/api
 *   - 隐藏的 Blog 入口
 *   - 没有证书图片的证书页面
 *   - 任何 localhost 或中文旧站 URL
 *
 * 收录开关关闭（默认）或站点地址仍是本地默认值时返回**空数组**：
 *   宁可输出空 sitemap，也不允许把 localhost 写进公开的 sitemap。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingEnabled() || isLocalFallbackUrl()) return [];

  const lastModified = new Date();

  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/products', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/factory', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/quality', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
  ];

  const products = await getPublishedProducts();

  return [
    ...staticPages.map((page) => ({
      // 首页刻意不带尾斜杠：Next 会把 canonical: '/' 归一化成 origin 本身，
      // sitemap 必须与 canonical 完全一致，否则同一页会出现两种写法。
      url: page.path === '/' ? getSiteUrl() : absoluteUrl(page.path),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${encodeURIComponent(product.product_id)}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
