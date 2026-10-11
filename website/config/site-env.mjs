/**
 * website/config/site-env.mjs
 * ===========================================================================
 * Phase 5 — 站点级环境逻辑（唯一来源）
 *
 * 为什么放在 config/ 下、用纯 ESM JavaScript：
 *   1. next.config.ts（构建期，Node 加载）需要它；
 *   2. src/lib/site-url.ts（运行期，页面 metadata / robots / sitemap）需要它；
 *   3. website/tools/verify-*.mjs（零依赖验收脚本）需要它。
 *   三处必须用**同一份**判定，否则会出现「页面 noindex、响应头却允许收录」这类不一致。
 *   .mjs + 同名 .d.mts 让 TypeScript 也能安全引用（tsconfig 里 allowJs=false）。
 *
 * 本文件只做纯计算：不读文件、不发请求、不写日志。env 由调用方传入。
 * ===========================================================================
 */

/** 本地/预览默认地址。正式环境必须在 NEXT_PUBLIC_SITE_URL 里给出正式地址。 */
export const LOCAL_SITE_URL = 'http://127.0.0.1:3000';

/** 索引开关的环境变量名（默认 false，绝不因为代码合并而自动开放收录） */
export const INDEXING_ENV_KEY = 'SITE_INDEXING_ENABLED';
/** 正式站点地址的环境变量名 */
export const SITE_URL_ENV_KEY = 'NEXT_PUBLIC_SITE_URL';

const asString = (v) => (typeof v === 'string' ? v.trim() : '');
const asBool = (v) => asString(v).toLowerCase() === 'true';

/**
 * 解析正式站点地址。
 * 解析失败 / 未配置时返回本地默认地址，并把 isLocalFallback 置为 true ——
 * 调用方据此决定「不允许生成 sitemap URL」「必须保持 noindex」。
 */
export function resolveSiteUrl(env = {}) {
  const raw = asString(env[SITE_URL_ENV_KEY]);
  const fallback = {
    raw,
    url: LOCAL_SITE_URL,
    origin: LOCAL_SITE_URL,
    isLocalFallback: true,
    isHttps: false,
    valid: false,
  };
  if (!raw) return fallback;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;

  const path = parsed.pathname.replace(/\/+$/, '');
  const isLocal = /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(parsed.hostname);
  return {
    raw,
    url: `${parsed.origin}${path}`,
    origin: parsed.origin,
    isLocalFallback: isLocal,
    isHttps: parsed.protocol === 'https:',
    valid: true,
  };
}

/** 收录开关：只有显式写成 true 才算开启 */
export function isIndexingEnabled(env = {}) {
  return asBool(env[INDEXING_ENV_KEY]);
}

/** 是否生产构建/运行 */
export function isProductionEnv(env = {}) {
  return asString(env.NODE_ENV) === 'production';
}

/**
 * 构建期/启动期校验。
 * errors 非空时 next.config.ts 会直接抛错（构建失败），避免「没域名却放开了收录」。
 * warnings 只是提醒，不阻断本地与预览。
 */
export function validateSiteEnv(env = {}) {
  const site = resolveSiteUrl(env);
  const indexing = isIndexingEnabled(env);
  const isProd = isProductionEnv(env);
  const errors = [];
  const warnings = [];

  if (!site.valid) {
    const msg = `${SITE_URL_ENV_KEY} is not set to a valid absolute http(s) URL.`;
    if (indexing) {
      errors.push(
        `${msg} ${INDEXING_ENV_KEY}=true requires the production site URL — refusing to enable indexing.`,
      );
    } else {
      warnings.push(`${msg} Falling back to ${LOCAL_SITE_URL}; the site stays out of search indexes.`);
    }
  } else if (indexing && site.isLocalFallback) {
    errors.push(
      `${INDEXING_ENV_KEY}=true was requested with a localhost URL (${site.url}). Refusing to publish indexable localhost canonical URLs.`,
    );
  } else if (indexing && !site.isHttps) {
    errors.push(
      `${INDEXING_ENV_KEY}=true requires an https ${SITE_URL_ENV_KEY} (got ${site.url}).`,
    );
  } else if (!indexing && isProd && !site.valid) {
    warnings.push('Production build without a site URL: canonical tags fall back to the local address and stay noindex.');
  }

  return { site, indexing, isProd, errors, warnings };
}

/**
 * 安全响应头（不含 X-Robots-Tag —— 收录开关单独处理，见 robotsHeaderRules）。
 *
 * CSP 说明（务必读完再改）：
 *   - Next.js 15 的 App Router 会在 HTML 里内联 hydration 脚本与样式，因此
 *     script-src / style-src 需要 'unsafe-inline'，否则页面直接白屏。
 *   - 开发模式还需要 'unsafe-eval'（React Refresh / HMR），生产模式不加。
 *   - Turnstile 只有在配置了 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时才放行 Cloudflare 域名，
 *     没有密钥时不放行任何第三方脚本源。
 *   - upgrade-insecure-requests 只在「已确认 HTTPS 且已允许收录」时才加，
 *     否则本地 http 预览会被强制跳 https 而打不开。
 *   - HSTS 同样只在 HTTPS + 已允许收录时启用，且**不使用** includeSubDomains / preload
 *     （业务方尚未确认所有子域都支持 HTTPS）。
 */
export function securityHeaders(env = {}) {
  const site = resolveSiteUrl(env);
  const indexing = isIndexingEnabled(env);
  const isProd = isProductionEnv(env);
  const turnstile = Boolean(asString(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];
  const frameSrc = [];
  if (!isProd) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push('ws:', 'wss:'); // dev HMR
  }
  if (turnstile) {
    scriptSrc.push('https://challenges.cloudflare.com');
    connectSrc.push('https://challenges.cloudflare.com');
    frameSrc.push('https://challenges.cloudflare.com');
  }

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src ${frameSrc.length ? frameSrc.join(' ') : "'none'"}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  if (isHttpsIndexed(site, indexing)) csp.push('upgrade-insecure-requests');

  const headers = [
    { key: 'Content-Security-Policy', value: csp.join('; ') },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: [
        'accelerometer=()',
        'autoplay=()',
        'camera=()',
        'display-capture=()',
        'encrypted-media=()',
        'fullscreen=(self)',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'payment=()',
        'usb=()',
      ].join(', '),
    },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'Origin-Agent-Cluster', value: '?1' },
  ];

  if (isHttpsIndexed(site, indexing)) {
    // 业务方上线 HTTPS 后启用。刻意不加 includeSubDomains / preload。
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' });
  }

  return headers;
}

function isHttpsIndexed(site, indexing) {
  return Boolean(indexing && site.valid && site.isHttps && !site.isLocalFallback);
}

/** 需要始终保持 noindex 的功能页（即使全站已允许收录） */
export const ALWAYS_NOINDEX_PATHS = ['/api/:path*', '/rfq', '/oe-search', '/blog'];

/**
 * X-Robots-Tag 规则。
 * 未开启收录 → 全站 noindex, nofollow。
 * 已开启收录 → 只对功能页 noindex, nofollow，公开页面不再带该响应头。
 */
export function robotsHeaderRules(env = {}) {
  const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
  if (!isIndexingEnabled(env)) {
    return [{ source: '/:path*', headers: noindex }];
  }
  return ALWAYS_NOINDEX_PATHS.map((source) => ({ source, headers: noindex }));
}

/* ===========================================================================
 * Phase 5.1 — 生产环境就绪硬保护
 * ===========================================================================
 * 为什么不能用 NODE_ENV=production 判断"真正上线"：
 *   本地 `next build` 与 Vercel Preview 也都是 NODE_ENV=production 的构建。
 *   如果按它来强制真实凭据，本地和预览就会直接构建失败。
 * 因此只在**明确的托管生产环境**里启用硬保护：目前是 Vercel Production
 *   （VERCEL_ENV=production，由 Vercel 平台自动注入，不需要人工设置）。
 *   其它平台后续接入时，在这里增加对应的环境标志即可。
 *
 * 生产环境必须满足的 11 条（缺任何一条都直接抛错，只报变量名、绝不报变量值）：
 *   1. NEXT_PUBLIC_SITE_URL 是正式 https 地址
 *   2. SUPABASE_URL 存在
 *   3. SUPABASE_SERVICE_ROLE_KEY 存在
 *   4. RFQ_STORE_DRIVER 解析结果必须是 supabase
 *   5. RESEND_API_KEY 存在
 *   6. RFQ_FROM_EMAIL 存在
 *   7. RFQ_MAIL_DRIVER 解析结果必须是 resend
 *   8. RFQ_IP_HASH_SECRET 存在
 *   9. NEXT_PUBLIC_TURNSTILE_SITE_KEY 存在
 *  10. TURNSTILE_SECRET_KEY 存在
 *  11. 两个 Turnstile key 必须成对（不允许只配一个）
 *   另外：测试用的 mock 开关（RFQ_TURNSTILE_MODE / NEXT_PUBLIC_TURNSTILE_MOCK）在生产必须关闭。
 */

/** Vercel 平台自动注入的环境标志 */
export const VERCEL_ENV_KEY = 'VERCEL_ENV';

/** 是否处于明确的托管生产环境（Vercel Production） */
export function isManagedProduction(env = {}) {
  return asString(env[VERCEL_ENV_KEY]).toLowerCase() === 'production';
}

/**
 * 存储驱动解析（与 src/lib/rfq/store.ts 的 resolveStoreDriver 保持一致）。
 * 这里是纯函数镜像：config/ 必须是零依赖的纯 JS，不能 import TS 模块。
 * 改动任何一边都必须同步另一边 —— 两侧都有自动化测试覆盖。
 */
export function resolveStoreDriverFromEnv(env = {}) {
  const raw = asString(env.RFQ_STORE_DRIVER).toLowerCase();
  if (raw === 'memory' || raw === 'json' || raw === 'supabase') return raw;
  const supabaseConfigured = Boolean(asString(env.SUPABASE_URL) && asString(env.SUPABASE_SERVICE_ROLE_KEY));
  return supabaseConfigured ? 'supabase' : 'json';
}

/**
 * 邮件驱动解析（与 src/lib/rfq/mail.ts 的 resolveMailDriver 保持一致）。
 */
export function resolveMailDriverFromEnv(env = {}) {
  const raw = asString(env.RFQ_MAIL_DRIVER).toLowerCase();
  if (raw === 'mock' || raw === 'resend') return raw;
  if (raw === 'unconfigured' || raw === 'none') return 'unconfigured';
  const resendConfigured = Boolean(asString(env.RESEND_API_KEY) && asString(env.RFQ_FROM_EMAIL));
  if (resendConfigured) return 'resend';
  return asString(env.NODE_ENV) === 'production' ? 'unconfigured' : 'mock';
}

/** Turnstile 是否在两个密钥都齐全时才视为启用 */
export function resolveTurnstileState(env = {}) {
  const site = Boolean(asString(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  const secret = Boolean(asString(env.TURNSTILE_SECRET_KEY));
  return { site, secret, paired: site === secret };
}

/**
 * 生产就绪校验。
 * 返回 { enabled, errors, warnings, resolved }。
 *   enabled=false（本地 / Preview / 其它平台）→ 不做任何强制，只给提示。
 *   enabled=true（Vercel Production）      → errors 非空时 next.config.ts 直接抛错。
 * 错误信息里**只出现变量名**，永远不出现变量值。
 */
export function validateProductionReadiness(env = {}) {
  const errors = [];
  const warnings = [];
  const enabled = isManagedProduction(env);

  const site = resolveSiteUrl(env);
  const storeDriver = resolveStoreDriverFromEnv(env);
  const mailDriver = resolveMailDriverFromEnv(env);
  const turnstile = resolveTurnstileState(env);

  const has = (key) => Boolean(asString(env[key]));

  const resolved = {
    storeDriver,
    mailDriver,
    turnstileSiteKeyConfigured: turnstile.site,
    turnstileSecretKeyConfigured: turnstile.secret,
  };

  if (!enabled) {
    // 本地与 Preview：只提示，不阻断（仍可用 json / mock，且默认 noindex）
    if (storeDriver !== 'supabase') {
      warnings.push(`Store driver resolves to "${storeDriver}" — fine for local/preview, not for production.`);
    }
    if (mailDriver !== 'resend') {
      warnings.push(`Mail driver resolves to "${mailDriver}" — local/preview only; no real email is sent.`);
    }
    return { enabled, errors, warnings, resolved };
  }

  // ---------------------------------------------------------------- 站点地址
  if (!site.valid || site.isLocalFallback) {
    errors.push(`Production requires a valid ${SITE_URL_ENV_KEY} (https, not localhost).`);
  } else if (!site.isHttps) {
    errors.push(`Production requires an https ${SITE_URL_ENV_KEY}.`);
  }

  // ---------------------------------------------------------------- 数据库
  if (!has('SUPABASE_URL')) errors.push('Production requires SUPABASE_URL.');
  if (!has('SUPABASE_SERVICE_ROLE_KEY')) errors.push('Production requires SUPABASE_SERVICE_ROLE_KEY.');
  if (storeDriver !== 'supabase') {
    errors.push(
      `Production requires RFQ_STORE_DRIVER to resolve to "supabase" (currently "${storeDriver}"); `
      + 'local JSON files and in-memory storage are not durable on Vercel.',
    );
  }

  // ---------------------------------------------------------------- 邮件
  if (!has('RESEND_API_KEY')) errors.push('Production requires RESEND_API_KEY.');
  if (!has('RFQ_FROM_EMAIL')) errors.push('Production requires RFQ_FROM_EMAIL (a verified sender address).');
  if (mailDriver !== 'resend') {
    errors.push(
      `Production requires RFQ_MAIL_DRIVER to resolve to "resend" (currently "${mailDriver}"); `
      + 'mock and unconfigured transports are not allowed in production.',
    );
  }

  // ---------------------------------------------------------------- 反滥用
  if (!has('RFQ_IP_HASH_SECRET')) {
    errors.push('Production requires RFQ_IP_HASH_SECRET (rate limiting must not fall back to a per-process key).');
  }

  // ---------------------------------------------------------------- Turnstile
  if (!has('NEXT_PUBLIC_TURNSTILE_SITE_KEY')) {
    errors.push('Production requires NEXT_PUBLIC_TURNSTILE_SITE_KEY.');
  }
  if (!has('TURNSTILE_SECRET_KEY')) {
    errors.push('Production requires TURNSTILE_SECRET_KEY.');
  }
  if (!turnstile.paired && (turnstile.site || turnstile.secret)) {
    errors.push(
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together '
      + '(only one of them is set).',
    );
  }

  // ---------------------------------------------------------------- 测试开关
  if (asString(env.RFQ_TURNSTILE_MODE).toLowerCase() === 'mock') {
    errors.push('RFQ_TURNSTILE_MODE=mock is a test-only switch and must not be enabled in production.');
  }
  if (asString(env.NEXT_PUBLIC_TURNSTILE_MOCK) === '1') {
    errors.push('NEXT_PUBLIC_TURNSTILE_MOCK=1 is a test-only switch and must not be enabled in production.');
  }

  return { enabled, errors, warnings, resolved };
}

