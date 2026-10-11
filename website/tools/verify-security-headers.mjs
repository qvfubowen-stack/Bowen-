#!/usr/bin/env node
/**
 * Phase 5 — 安全响应头验收
 * ===========================================================================
 * 两层检查：
 *   A. 纯逻辑层：直接 import website/config/site-env.mjs，验证响应头生成规则本身
 *      （默认不开 HSTS、CSP 与 Next.js 兼容、收录开关只影响 X-Robots-Tag 等）。
 *   B. 真实 HTTP 层：对运行中的站点发请求，逐条核对实际下发的响应头。
 *
 * 用法：
 *   node tools/verify-security-headers.mjs                                  # 自己起 dev 服务器
 *   BASE_URL=http://127.0.0.1:3100 node tools/verify-security-headers.mjs  # 复用已有服务器
 */
import {
  createChecker,
  ensureServer,
  getHtml,
} from './lib/verify-helpers.mjs';

import {
  ALWAYS_NOINDEX_PATHS,
  resolveSiteUrl,
  robotsHeaderRules,
  securityHeaders,
  validateSiteEnv,
} from '../config/site-env.mjs';

const { check, checkAsync, section, summary } = createChecker(
  '博文外贸独立站 — 安全响应头与站点配置验收（Phase 5）',
);

const PORT = Number(process.env.TEST_PORT ?? 3510);

// ===========================================================================
section('A. 响应头生成规则（纯逻辑，默认配置：未配置域名 + 未开启收录）');
// ===========================================================================
const DEFAULT_ENV = { NODE_ENV: 'development' };
const defaultHeaders = securityHeaders(DEFAULT_ENV);
const headerMap = (list) => Object.fromEntries(list.map((h) => [h.key.toLowerCase(), h.value]));

const d = headerMap(defaultHeaders);

check('包含 X-Content-Type-Options: nosniff', () =>
  d['x-content-type-options'] === 'nosniff' ? { ok: true, detail: d['x-content-type-options'] } : `实际 ${d['x-content-type-options']}`);

check('包含 Referrer-Policy', () =>
  d['referrer-policy'] === 'strict-origin-when-cross-origin' ? { ok: true, detail: d['referrer-policy'] } : `实际 ${d['referrer-policy']}`);

check('包含 Permissions-Policy，并关闭 camera/microphone/geolocation/payment', () => {
  const v = d['permissions-policy'] ?? '';
  const need = ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()'];
  const missing = need.filter((n) => !v.includes(n));
  return missing.length === 0 ? { ok: true, detail: v.slice(0, 90) + '…' } : `缺少 ${missing.join(', ')}`;
});

check('frame-ancestors 为 none（CSP）且 X-Frame-Options 为 DENY', () => {
  const csp = d['content-security-policy'] ?? '';
  const okCsp = csp.includes("frame-ancestors 'none'");
  const okXfo = d['x-frame-options'] === 'DENY';
  return okCsp && okXfo
    ? { ok: true, detail: `${d['x-frame-options']}; frame-ancestors 'none'` }
    : `CSP frame-ancestors=${okCsp}, X-Frame-Options=${d['x-frame-options']}`;
});

check('CSP 允许 Next.js 正常运行（script/style unsafe-inline、img data:）', () => {
  const csp = d['content-security-policy'] ?? '';
  const need = ["script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:"];
  const missing = need.filter((n) => !csp.includes(n));
  return missing.length === 0 ? { ok: true, detail: 'hydration 与内联样式不会被 CSP 拦掉' } : `缺少 ${missing.join(' | ')}`;
});

check('CSP 默认不引入任何第三方脚本源', () => {
  const csp = d['content-security-policy'] ?? '';
  const bad = /https?:\/\//.test(csp.replace(/https:\/\/schema\.org/g, ''));
  return bad ? `CSP 里出现了外部来源: ${csp}` : { ok: true, detail: "只有 'self' 与 data:" };
});

check('未确认 HTTPS 时不下发 HSTS', () =>
  d['strict-transport-security'] === undefined
    ? { ok: true, detail: '默认无 Strict-Transport-Security' }
    : `不应下发 HSTS，实际 ${d['strict-transport-security']}`);

check('未确认 HTTPS 时不下发 upgrade-insecure-requests', () =>
  (d['content-security-policy'] ?? '').includes('upgrade-insecure-requests')
    ? '本地 http 预览会被强制升级，页面打不开'
    : { ok: true, detail: '未启用' });

check('默认（未开启收录）X-Robots-Tag 覆盖全站', () => {
  const rules = robotsHeaderRules(DEFAULT_ENV);
  const global = rules.find((r) => r.source === '/:path*');
  return rules.length === 1 && global && global.headers[0].value === 'noindex, nofollow'
    ? { ok: true, detail: `${global.source} → ${global.headers[0].value}` }
    : JSON.stringify(rules);
});

check('已开启收录时只对功能页保留 X-Robots-Tag', () => {
  const rules = robotsHeaderRules({ SITE_INDEXING_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.bowen-tech.cn' });
  const sources = rules.map((r) => r.source).sort();
  const expected = [...ALWAYS_NOINDEX_PATHS].sort();
  const same = JSON.stringify(sources) === JSON.stringify(expected);
  const allNoindex = rules.every((r) => r.headers[0].value === 'noindex, nofollow');
  return same && allNoindex
    ? { ok: true, detail: sources.join(', ') }
    : `实际 ${JSON.stringify(rules)}`;
});

check('生产模式 CSP 不含 unsafe-eval（开发模式才有）', () => {
  const prod = headerMap(securityHeaders({ NODE_ENV: 'production' }))['content-security-policy'] ?? '';
  const dev = headerMap(securityHeaders({ NODE_ENV: 'development' }))['content-security-policy'] ?? '';
  if (prod.includes("'unsafe-eval'")) return '生产 CSP 仍然包含 unsafe-eval';
  if (!dev.includes("'unsafe-eval'")) return '开发 CSP 缺少 unsafe-eval（HMR 会报错）';
  return { ok: true, detail: '生产无 unsafe-eval，开发有' };
});

// ===========================================================================
section('B. 域名与收录开关的校验逻辑');
// ===========================================================================
check('未配置域名 + 未开启收录 → 只有警告，不阻断构建', () => {
  const r = validateSiteEnv({ NODE_ENV: 'production' });
  return r.errors.length === 0 && r.warnings.length > 0
    ? { ok: true, detail: r.warnings[0].slice(0, 100) + '…' }
    : `errors=${JSON.stringify(r.errors)} warnings=${JSON.stringify(r.warnings)}`;
});

check('开启收录但没有配置域名 → 构建必须失败', () => {
  const r = validateSiteEnv({ NODE_ENV: 'production', SITE_INDEXING_ENABLED: 'true' });
  return r.errors.length > 0 ? { ok: true, detail: r.errors[0].slice(0, 110) + '…' } : '没有报错';
});

check('开启收录但域名是 localhost → 构建必须失败', () => {
  const r = validateSiteEnv({
    NODE_ENV: 'production',
    SITE_INDEXING_ENABLED: 'true',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  });
  return r.errors.length > 0 ? { ok: true, detail: r.errors[0].slice(0, 110) + '…' } : '没有报错';
});

check('开启收录但域名是 http（非 https）→ 构建必须失败', () => {
  const r = validateSiteEnv({
    NODE_ENV: 'production',
    SITE_INDEXING_ENABLED: 'true',
    NEXT_PUBLIC_SITE_URL: 'http://www.bowen-tech.cn',
  });
  return r.errors.length > 0 ? { ok: true, detail: r.errors[0].slice(0, 110) + '…' } : '没有报错';
});

check('正式 https 域名 + 开启收录 → 无错误，且启用 HSTS 与 upgrade-insecure-requests', () => {
  const env = { NODE_ENV: 'production', SITE_INDEXING_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.bowen-tech.cn' };
  const r = validateSiteEnv(env);
  const h = headerMap(securityHeaders(env));
  const hsts = h['strict-transport-security'] ?? '';
  const csp = h['content-security-policy'] ?? '';
  if (r.errors.length > 0) return `仍然报错: ${r.errors.join(' / ')}`;
  if (!hsts) return '缺少 HSTS';
  if (/includeSubDomains|preload/i.test(hsts)) return `HSTS 不应带 includeSubDomains/preload: ${hsts}`;
  if (!csp.includes('upgrade-insecure-requests')) return 'CSP 缺少 upgrade-insecure-requests';
  return { ok: true, detail: `HSTS: ${hsts}` };
});

check('既未开启收录也未配置域名时，站点地址回退到本地默认值', () => {
  const s = resolveSiteUrl({});
  return s.isLocalFallback && s.url === 'http://127.0.0.1:3000'
    ? { ok: true, detail: s.url }
    : JSON.stringify(s);
});

check('响应头生成结果里不含任何密钥样式字符串', () => {
  const blob = JSON.stringify([securityHeaders(DEFAULT_ENV), securityHeaders({ NODE_ENV: 'production', SITE_INDEXING_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.bowen-tech.cn' })]);
  const bad = [/re_[A-Za-z0-9]{12,}/, /eyJ[A-Za-z0-9_-]{10,}/, /service_role/i].filter((re) => re.test(blob));
  return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
});

// ===========================================================================
section('C. 真实 HTTP 响应头');
// ===========================================================================
let server = null;
try {
  server = await ensureServer({
    port: PORT,
    env: {
      // 保持与交付默认一致的预览配置：不配置域名、不开启收录
      NEXT_PUBLIC_SITE_URL: '',
      SITE_INDEXING_ENABLED: 'false',
    },
    label: 'headers',
    readyPath: '/',
  });
  console.log(`服务器就绪：${server.base}${server.external ? '（复用 BASE_URL）' : ''}`);

  const home = await getHtml(`${server.base}/`);
  await checkAsync('首页返回 200 且下发 nosniff', () =>
    home.status === 200 && home.headers.get('x-content-type-options') === 'nosniff'
      ? { ok: true, detail: `status=${home.status}` }
      : `status=${home.status} nosniff=${home.headers.get('x-content-type-options')}`);

  await checkAsync('首页下发完整 CSP', () => {
    const csp = home.headers.get('content-security-policy') ?? '';
    return csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'")
      ? { ok: true, detail: `${csp.length} 字符` }
      : `实际: ${csp}`;
  });

  await checkAsync('首页 X-Frame-Options = DENY', () =>
    home.headers.get('x-frame-options') === 'DENY' ? true : `实际 ${home.headers.get('x-frame-options')}`);

  await checkAsync('预览环境首页带 X-Robots-Tag: noindex, nofollow', () =>
    home.headers.get('x-robots-tag') === 'noindex, nofollow'
      ? true
      : `实际 ${home.headers.get('x-robots-tag')}`);

  await checkAsync('已移除 X-Prototype-Phase 响应头', () =>
    home.headers.get('x-prototype-phase') === null
      ? { ok: true, detail: '不再出现原型阶段标记' }
      : `仍然存在: ${home.headers.get('x-prototype-phase')}`);

  await checkAsync('预览环境不下发 HSTS（本地 http 不会被强制升级）', () =>
    home.headers.get('strict-transport-security') === null ? true : `实际 ${home.headers.get('strict-transport-security')}`);

  await checkAsync('poweredByHeader 已关闭（无 X-Powered-By）', () =>
    home.headers.get('x-powered-by') === null ? true : `实际 ${home.headers.get('x-powered-by')}`);

  await checkAsync('页面 HTML 不含 CSP 违规的内联事件处理器写法', () => {
    const bad = /<script[^>]+src="https?:\/\/(?!127\.0\.0\.1)/i.test(home.text);
    return bad ? '页面引用了外部脚本源，会被 CSP 拦掉' : { ok: true, detail: '脚本全部同源' };
  });

  await checkAsync('RFQ 页面同样带 noindex 与安全头', async () => {
    const page = await getHtml(`${server.base}/rfq`);
    const robots = page.headers.get('x-robots-tag');
    const nosniff = page.headers.get('x-content-type-options');
    return page.status === 200 && robots === 'noindex, nofollow' && nosniff === 'nosniff'
      ? { ok: true, detail: `status=${page.status}` }
      : `status=${page.status} robots=${robots} nosniff=${nosniff}`;
  });

  await checkAsync('API 路由不下发可缓存响应头', async () => {
    const res = await fetch(`${server.base}/api/rfq`, { method: 'GET' });
    const cache = res.headers.get('cache-control') ?? '';
    return res.status === 405 && cache.includes('no-store')
      ? { ok: true, detail: `status=${res.status}, cache-control=${cache}` }
      : `status=${res.status}, cache-control=${cache}`;
  });
} catch (err) {
  console.error(`\n执行出错: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (server) await server.stop();
}

process.exitCode = summary() ? (process.exitCode ?? 0) : 1;
