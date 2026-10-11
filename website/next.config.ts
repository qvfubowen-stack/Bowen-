import type { NextConfig } from 'next';

import {
  resolveSiteUrl,
  robotsHeaderRules,
  securityHeaders,
  validateProductionReadiness,
  validateSiteEnv,
} from './config/site-env.mjs';

/**
 * Phase 5 / 5.1 — 站点配置
 * ===========================================================================
 * 1. 安全响应头由 website/config/site-env.mjs 统一生成（与页面 metadata 共用同一份判定）。
 * 2. 收录开关 SITE_INDEXING_ENABLED 默认 false：
 *      false → 全站 X-Robots-Tag: noindex, nofollow
 *      true  → 只有功能页（/api、/rfq、/oe-search、/blog）保留 noindex
 * 3. X-Prototype-Phase 已在 Phase 5 移除（原型标记不应出现在正式响应里）。
 * 4. 配置自检：SITE_INDEXING_ENABLED=true 但没有正式 https 域名时**直接构建失败**，
 *    避免"没域名却放开了收录"。
 * 5. Phase 5.1：在**托管生产环境**（VERCEL_ENV=production）下做生产就绪硬保护 ——
 *    缺少 Supabase / Resend / RFQ_IP_HASH_SECRET / Turnstile 密钥，
 *    或驱动被解析成 json / memory / mock / unconfigured 时，构建与启动都直接失败。
 *    本地与 Preview 不受影响（仍可用 json + mock，默认 noindex）。
 *    错误信息只包含变量名，绝不包含变量值。
 */

const env = process.env;
const check = validateSiteEnv(env);
const readiness = validateProductionReadiness(env);

// next.config.ts 在一次构建里会被多个 worker 各加载一次，用 globalThis 去重，
// 避免同一句警告在构建日志里刷 5 遍。
const globalFlags = globalThis as typeof globalThis & { __bowenSiteEnvLogged?: boolean };
if (!globalFlags.__bowenSiteEnvLogged) {
  globalFlags.__bowenSiteEnvLogged = true;
  for (const warning of check.warnings) {
    console.warn(`[bowen-site-env] ${warning}`);
  }
  const site = resolveSiteUrl(env);
  if (!site.valid) {
    console.warn(
      '[bowen-site-env] NEXT_PUBLIC_SITE_URL is not configured: canonical tags are omitted and the '
      + 'sitemap stays empty. Set it before the production deployment.',
    );
  }
  if (readiness.enabled) {
    console.log(
      `[bowen-site-env] managed production detected: store=${readiness.resolved.storeDriver}, `
      + `mail=${readiness.resolved.mailDriver}, turnstile=${readiness.resolved.turnstileSiteKeyConfigured && readiness.resolved.turnstileSecretKeyConfigured}`,
    );
  } else {
    for (const warning of readiness.warnings) {
      console.warn(`[bowen-production] ${warning}`);
    }
  }
}

if (check.errors.length > 0) {
  throw new Error(
    `[bowen-site-env] invalid site configuration:\n  - ${check.errors.join('\n  - ')}`,
  );
}

// 生产就绪硬保护：只在明确的托管生产环境生效（本地 / Preview 不阻断）
if (readiness.errors.length > 0) {
  throw new Error(
    '[bowen-production] production environment is not ready:\n  - '
    + readiness.errors.join('\n  - ')
    + '\n(refusing to build or start: production must not silently fall back to JSON, memory, mock or unconfigured drivers)',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(env),
      },
      {
        // API 响应永远不要被缓存
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
      ...robotsHeaderRules(env),
    ];
  },
};

export default nextConfig;
