import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { getSiteFacts } from '@/lib/db';
import { DEFAULT_OG_IMAGE, jsonLdScriptProps, organizationSchema, webSiteSchema } from '@/lib/structured-data';
import { absoluteUrl, canonicalFor, getSiteUrl, robotsMetadata } from '@/lib/site-url';

/**
 * 收录开关（Phase 5）：
 *   SITE_INDEXING_ENABLED 默认 false → 全站 noindex, nofollow，且 next.config.ts
 *   会同时下发 X-Robots-Tag。只有正式环境显式设置为 true 才允许收录，
 *   绝不会因为代码合并而自动开放。
 *   功能页（/rfq、/oe-search、/blog）在各自 page.tsx 里单独覆盖为不允许收录。
 */
const SITE_DESCRIPTION =
  'Qufu Bowen Auto Parts Manufacturing Co., Ltd. is an automotive thermostat manufacturer supplying '
  + 'importers, wholesalers and aftermarket distributors. Search by OE number, Bowen No. or the '
  + 'vehicle/application text recorded in the product data.';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'Bowen — Automotive Thermostat Manufacturer',
    template: '%s | Bowen',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Bowen',
  robots: robotsMetadata(),
  alternates: canonicalFor('/'),
  openGraph: {
    type: 'website',
    siteName: 'Bowen — Automotive Thermostat Manufacturer',
    title: 'Bowen — Automotive Thermostat Manufacturer',
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    locale: 'en',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Bowen — automotive thermostat manufacturer' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bowen — Automotive Thermostat Manufacturer',
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1b2b',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 公司资料只在 site-facts.json 维护一份，页头/页脚共享同一来源。
  // ⚠️ Phase 4.1：SiteHeader 是客户端组件，它的 props 会被序列化进页面 HTML。
  // 因此这里只挑出页头/页脚真正要用的字段（显式白名单），
  // 绝不把整个 company 对象传下去 —— 否则内部认证清单（含无证书图片的 ISO 两项）、
  // internal_only_certifications、address_evidence 等内部字段会随页面源码发给客户。
  const c = (await getSiteFacts()).company;

  const headerCompany = {
    legal_name_en: c.legal_name_en,
    email: c.email,
    tel_display: c.tel_display,
    tel_href: c.tel_href,
    since_year: c.since_year,
  };

  const footerCompany = {
    legal_name_en: c.legal_name_en,
    legal_name_zh: c.legal_name_zh,
    email: c.email,
    tel_display: c.tel_display,
    tel_href: c.tel_href,
    since_year: c.since_year,
    address_en: c.address_en,
    domestic_marketplace_url: c.domestic_marketplace_url,
    domestic_marketplace_label: c.domestic_marketplace_label,
    domestic_marketplace_note: c.domestic_marketplace_note,
  };

  // 站点级结构化数据：只写已确认的公司事实与站内搜索入口。
  // 注意：organizationSchema 的入参是显式白名单对象，不会把 site-facts 的
  // 内部字段（certifications / evidence / internal_only_certifications）带出去。
  const organizationLd = organizationSchema({
    legal_name_en: c.legal_name_en,
    brand_name: c.brand_name,
    email: c.email,
    tel_display: c.tel_display,
    address_en: c.address_en,
    country: c.country,
    postal_code: c.postal_code,
    since_year: c.since_year,
  });
  const webSiteLd = webSiteSchema();

  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#main">Skip to content</a>
        <SiteHeader company={headerCompany} />
        <main id="main">{children}</main>
        <SiteFooter company={footerCompany} />
        <script {...jsonLdScriptProps([organizationLd, webSiteLd])} />
      </body>
    </html>
  );
}
