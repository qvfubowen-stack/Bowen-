import type { MetadataRoute } from 'next';

/**
 * Web App Manifest
 * ===========================================================================
 * 只声明站点自身的展示信息与小图标，不做离线缓存、不申请任何权限。
 * 当前站点是 B2B 目录 + RFQ，不需要 PWA 的离线能力，因此刻意不注册 service worker。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bowen — Automotive Thermostat Manufacturer',
    short_name: 'Bowen',
    description:
      'Qufu Bowen Auto Parts Manufacturing Co., Ltd. — automotive thermostats, temperature sensors '
      + 'and switches. Search by OE number or Bowen No. and send a request for quotation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b1b2b',
    lang: 'en',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
