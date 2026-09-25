import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: {
    default: 'Bowen — Automotive Thermostat Manufacturer',
    template: '%s | Bowen',
  },
  description:
    'Bowen is an automotive thermostat manufacturer supplying importers, wholesalers and aftermarket distributors. Search by OE number, Bowen No., vehicle or engine.',
  robots: { index: false, follow: false }, // 原型阶段不收录
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1b2b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
