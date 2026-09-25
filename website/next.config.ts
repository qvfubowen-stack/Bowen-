import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 原型阶段：不做搜索引擎收录（尚未上线，也没有 SEO 页面）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Prototype-Phase', value: 'phase-3-ui-prototype' },
        ],
      },
    ];
  },
};

export default nextConfig;
