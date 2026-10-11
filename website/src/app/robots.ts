import type { MetadataRoute } from 'next';

import { absoluteUrl, isIndexingEnabled } from '@/lib/site-url';

export const dynamic = 'force-static';

/**
 * robots.txt
 * ===========================================================================
 * 预览环境（SITE_INDEXING_ENABLED 未开启，即默认值）：
 *   全站 Disallow，配合响应头 X-Robots-Tag: noindex, nofollow 与页面 meta robots，
 *   三重保证预览站点不会被收录。
 *
 * 正式索引环境（SITE_INDEXING_ENABLED=true 且域名是 https）：
 *   允许公开内容，指向正式 sitemap；/api、/rfq、/oe-search、/blog 不参与收录。
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexingEnabled()) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/rfq',
          '/oe-search',
          '/blog',
          // Next.js 构建产物与静态资源目录不需要抓取
          '/_next/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
