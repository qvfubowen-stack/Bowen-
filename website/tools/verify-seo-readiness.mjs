#!/usr/bin/env node
/**
 * Phase 5 — SEO 就绪验收
 * ===========================================================================
 * 三段检查：
 *   A. 源码层：唯一 URL 来源、无硬编码 localhost、sitemap/robots 存在、
 *      结构化数据不含虚假字段、环境变量模板不含真实密钥。
 *   B. 预览配置（默认交付配置：SITE_INDEXING_ENABLED=false，未配置域名）：
 *      robots.txt 全站 Disallow、sitemap 为空、页面全部 noindex、没有 localhost 的 canonical。
 *   C. 正式索引配置（SITE_INDEXING_ENABLED=true + https 正式域名）：
 *      robots 放行公开内容、sitemap 页面/产品数量正确且只含公开产品、
 *      canonical 指向正式域名、结构化数据合法且无虚假价格/评分/库存。
 *
 * 用法：
 *   node tools/verify-seo-readiness.mjs                 # 自己起两个 dev 服务器（串行）
 *   BASE_URL=http://127.0.0.1:3100 node tools/verify-seo-readiness.mjs
 *     ↑ 只跑 A + B（C 段需要 SITE_INDEXING_ENABLED=true 的服务器，脚本会跳过并说明）
 *
 * 注意：C 段必须用**独立的服务器进程**，因为 NEXT_PUBLIC_SITE_URL / SITE_INDEXING_ENABLED
 *       是进程启动时读入的；脚本会在 B 段服务器退出后再启动 C 段服务器（串行，避免争抢 .next）。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  WEBSITE_ROOT,
  createChecker,
  ensureServer,
  getHtml,
  pickNonPublicProduct,
  pickRfqFixture,
  readCanonical,
  readJsonLd,
  readMetaRobots,
  readPublicProductSet,
} from './lib/verify-helpers.mjs';

const { check, checkAsync, section, summary } = createChecker(
  '博文外贸独立站 — SEO 就绪验收（Phase 5）',
);

const PROD_SITE_URL = 'https://www.bowen-tech.cn';
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT ?? 3520);
const INDEX_PORT = Number(process.env.INDEX_PORT ?? 3521);
const EXTERNAL_BASE = (process.env.BASE_URL ?? '').trim();

const FIXTURE = pickRfqFixture();
const NON_PUBLIC = pickNonPublicProduct();
const PUBLIC = readPublicProductSet();

console.log(`公开产品（独立复算）：${PUBLIC.publicProducts.length} 个`
  + `（全部记录 ${PUBLIC.all.length} 个，非公开 ${PUBLIC.nonPublicProducts.length} 个）`);
console.log(`测试用公开产品：${FIXTURE.product_id}；测试用非公开产品：${NON_PUBLIC.product_id}`);

// ===========================================================================
section('A. 源码层：唯一 URL 来源与 SEO 基础文件');
// ===========================================================================

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SRC_FILES = walk(path.join(WEBSITE_ROOT, 'src'));
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(WEBSITE_ROOT, p).replace(/\\/g, '/');

/**
 * 去掉注释后再做"源码里有没有硬编码/虚假字段"的判断。
 * 源码注释里为了说明"为什么不能写 localhost""为什么不写价格字段"，
 * 必然会提到这些词；注释不会渲染给客户，也不参与运行，不该算命中。
 * 与 tools/verify-public-surface.mjs 使用同一套剥离规则，保持两个守卫口径一致。
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
/** 源码（去注释） */
const SRC_TEXT = new Map(SRC_FILES.map((f) => [f, stripComments(read(f))]));

check('src 下没有硬编码 localhost / 127.0.0.1（不含注释）', () => {
  const hits = [];
  for (const f of SRC_FILES) {
    SRC_TEXT.get(f).split(/\r?\n/).forEach((line, i) => {
      if (/localhost|127\.0\.0\.1/.test(line)) hits.push(`${rel(f)}:${i + 1} ${line.trim().slice(0, 80)}`);
    });
  }
  return hits.length === 0
    ? { ok: true, detail: '唯一来源是 website/config/site-env.mjs' }
    : hits.join(' | ');
});

check('站点地址唯一来源 config/site-env.mjs 存在且定义了本地默认值', () => {
  const f = path.join(WEBSITE_ROOT, 'config', 'site-env.mjs');
  if (!fs.existsSync(f)) return '缺少 website/config/site-env.mjs';
  const text = read(f);
  return /LOCAL_SITE_URL = 'http:\/\/127\.0\.0\.1:3000'/.test(text)
    ? { ok: true, detail: '本地默认值只出现一次' }
    : '未找到 LOCAL_SITE_URL 定义';
});

check('src/lib/site-url.ts 存在并导出 canonical / robots 判定', () => {
  const f = path.join(WEBSITE_ROOT, 'src', 'lib', 'site-url.ts');
  if (!fs.existsSync(f)) return '缺少 src/lib/site-url.ts';
  const t = read(f);
  const need = ['export function getSiteUrl', 'export function absoluteUrl', 'export function isIndexingEnabled', 'export function canonicalFor', 'export function robotsMetadata'];
  const missing = need.filter((n) => !t.includes(n));
  return missing.length === 0 ? { ok: true, detail: need.length + ' 个导出都在' } : `缺少 ${missing.join(', ')}`;
});

check('src/app/robots.ts 存在，且预览环境全站 Disallow', () => {
  const f = path.join(WEBSITE_ROOT, 'src', 'app', 'robots.ts');
  if (!fs.existsSync(f)) return '缺少 src/app/robots.ts';
  const t = read(f);
  return t.includes('disallow') && t.includes("isIndexingEnabled")
    ? { ok: true, detail: '按收录开关分支' }
    : 'robots.ts 没有按收录开关分支';
});

check('src/app/sitemap.ts 存在，且不硬编码任何产品 ID', () => {
  const f = path.join(WEBSITE_ROOT, 'src', 'app', 'sitemap.ts');
  if (!fs.existsSync(f)) return '缺少 src/app/sitemap.ts';
  const t = read(f);
  if (/BW-\d/i.test(t)) return 'sitemap.ts 里出现了硬编码 Bowen No.';
  return t.includes('getPublishedProducts()')
    ? { ok: true, detail: '产品清单来自仓储方法 getPublishedProducts()' }
    : 'sitemap.ts 没有调用仓储方法生成产品清单';
});

check('sitemap.ts 覆盖 8 个公开页面', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'app', 'sitemap.ts'));
  const need = ["'/'", "'/products'", "'/about'", "'/factory'", "'/quality'", "'/contact'", "'/privacy'", "'/terms'"];
  const missing = need.filter((n) => !t.includes(n));
  return missing.length === 0 ? { ok: true, detail: '首页/产品/关于/工厂/质量/联系/隐私/条款' } : `缺少 ${missing.join(', ')}`;
});

check('sitemap.ts 不包含 RFQ / OE 搜索 / API / Blog', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'app', 'sitemap.ts'));
  const bad = ["'/rfq'", "'/oe-search'", "'/api'", "'/blog'"].filter((n) => t.includes(n));
  return bad.length === 0 ? { ok: true, detail: '0 命中' } : `出现了 ${bad.join(', ')}`;
});

check('sitemap.ts 在未开启收录 / 未配置域名时返回空数组', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'app', 'sitemap.ts'));
  return /if \(!isIndexingEnabled\(\) \|\| isLocalFallbackUrl\(\)\) return \[\]/.test(t)
    ? { ok: true, detail: '宁可空 sitemap，也不写 localhost' }
    : '缺少空数组的短路条件';
});

check('根 layout 的 robots 由收录开关决定，不是写死的 index: true', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'app', 'layout.tsx'));
  if (/robots:\s*\{\s*index:\s*true/.test(t)) return 'layout 写死了 index: true';
  return /robots:\s*robotsMetadata\(\)/.test(t) ? { ok: true, detail: 'robots: robotsMetadata()' } : '没有使用 robotsMetadata()';
});

check('功能页（rfq / oe-search / blog）单独声明不参与索引', () => {
  const files = ['rfq', 'oe-search', 'blog'].map((s) => path.join(WEBSITE_ROOT, 'src', 'app', '(site)', s, 'page.tsx'));
  const missing = files.filter((f) => !/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(read(f)));
  return missing.length === 0 ? { ok: true, detail: '3 个功能页都已声明' } : missing.map(rel).join(', ');
});

check('公开页面都通过 canonicalFor() 生成 canonical', () => {
  const files = [
    'src/app/layout.tsx',
    'src/app/(site)/page.tsx',
    'src/app/(site)/products/page.tsx',
    'src/app/(site)/about/page.tsx',
    'src/app/(site)/factory/page.tsx',
    'src/app/(site)/quality/page.tsx',
    'src/app/(site)/contact/page.tsx',
    'src/app/(site)/privacy/page.tsx',
    'src/app/(site)/terms/page.tsx',
    'src/app/(site)/products/[id]/page.tsx',
  ].map((p) => path.join(WEBSITE_ROOT, p));
  const missing = files.filter((f) => !read(f).includes('canonicalFor('));
  return missing.length === 0 ? { ok: true, detail: `${files.length} 个文件` } : missing.map(rel).join(', ');
});

check('结构化数据不含价格 / 库存 / 评分 / 评论 / GTIN（不含注释）', () => {
  const raw = read(path.join(WEBSITE_ROOT, 'src', 'lib', 'structured-data.ts'));
  const code = stripComments(raw);
  const bad = ['offers', 'priceCurrency', 'aggregateRating', 'reviewCount', 'availability', 'gtin', 'InStock']
    .filter((k) => new RegExp(k, 'i').test(code));
  return bad.length === 0
    ? { ok: true, detail: '代码里 0 命中（注释里解释"刻意不生成"不算）' }
    : `发现 ${bad.join(', ')}`;
});

check('结构化数据实现了 Organization / WebSite / BreadcrumbList / Product', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'lib', 'structured-data.ts'));
  const need = ['organizationSchema', 'webSiteSchema', 'breadcrumbSchema', 'productSchema', 'safeJsonLd'];
  const missing = need.filter((n) => !t.includes(`export function ${n}`));
  return missing.length === 0 ? { ok: true, detail: need.join(', ') } : `缺少 ${missing.join(', ')}`;
});

check('JSON-LD 输出做了转义（防止 </script> 注入）', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'lib', 'structured-data.ts'));
  return t.includes('\\\\u003c') && t.includes('\\\\u003e')
    ? { ok: true, detail: 'safeJsonLd 把 < > & 转成 \\uXXXX' }
    : 'safeJsonLd 没有做尖括号转义';
});

check('页脚包含 Privacy Policy 与 Terms of Use 链接', () => {
  const t = read(path.join(WEBSITE_ROOT, 'src', 'components', 'SiteFooter.tsx'));
  return t.includes('href="/privacy"') && t.includes('href="/terms"')
    ? { ok: true, detail: '两条链接都在' }
    : '缺少其中一条链接';
});

check('.env.example 只有变量名与安全示例，不含密钥样式字符串', () => {
  const f = path.join(WEBSITE_ROOT, '.env.example');
  if (!fs.existsSync(f)) return '缺少 website/.env.example';
  const text = read(f);
  const suspicious = text
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+\s*=\s*\S+/.test(line))
    .filter((line) => /re_[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]{10,}|[a-f0-9]{40,}/.test(line));
  return suspicious.length === 0
    ? { ok: true, detail: '所有赋值行都是空值或说明性示例' }
    : suspicious.join(' | ');
});

check('仓库里没有提交任何真实密钥样式字符串', () => {
  const dirs = ['src', 'config', 'tools'].map((d) => path.join(WEBSITE_ROOT, d));
  const files = [];
  const collect = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) collect(p);
      else if (/\.(ts|tsx|mjs|js|json|sql|md)$/.test(e.name)) files.push(p);
    }
  };
  for (const d of dirs) collect(d);
  const hits = [];
  for (const f of files) {
    const text = read(f);
    if (/re_[A-Za-z0-9]{20,}/.test(text)) hits.push(`${rel(f)} (resend 样式)`);
    if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(text)) hits.push(`${rel(f)} (jwt 样式)`);
  }
  return hits.length === 0 ? { ok: true, detail: `扫描 ${files.length} 个文件` } : hits.join(', ');
});

check('next.config.ts 在"开启收录但没有正式域名"时直接构建失败', () => {
  const t = read(path.join(WEBSITE_ROOT, 'next.config.ts'));
  return t.includes('validateSiteEnv') && /check\.errors\.length > 0/.test(t) && t.includes('throw new Error')
    ? { ok: true, detail: '构建期硬校验' }
    : 'next.config.ts 缺少收录配置的硬校验';
});

// ===========================================================================
section('B. 预览配置：必须完全不可收录（默认交付配置）');
// ===========================================================================
let preview = null;
let index = null;
let networkOk = true;

try {
  if (EXTERNAL_BASE) {
    preview = { base: EXTERNAL_BASE.replace(/\/+$/, ''), external: true, stop: async () => {} };
    console.log(`\n复用已有服务器：${preview.base}（仅跑 A + B 段）`);
  } else {
    preview = await ensureServer({
      port: PREVIEW_PORT,
      env: { SITE_INDEXING_ENABLED: 'false', NEXT_PUBLIC_SITE_URL: '' },
      label: 'seo-preview',
    });
    console.log(`\n预览服务器就绪：${preview.base}`);
  }

  await checkAsync('robots.txt 全站 Disallow，且不指向任何 sitemap', async () => {
    const r = await fetch(`${preview.base}/robots.txt`);
    const text = await r.text();
    const okStatus = r.status === 200;
    const disallowAll = /Disallow:\s*\/\s*$/m.test(text);
    const noSitemap = !/Sitemap:/i.test(text);
    return okStatus && disallowAll && noSitemap
      ? { ok: true, detail: text.replace(/\s+/g, ' ').trim().slice(0, 80) }
      : `status=${r.status} disallowAll=${disallowAll} noSitemap=${noSitemap} :: ${text.slice(0, 120)}`;
  });

  await checkAsync('sitemap.xml 不包含任何 URL，也不包含 localhost', async () => {
    const r = await fetch(`${preview.base}/sitemap.xml`);
    const text = await r.text();
    const urls = (text.match(/<url>/g) ?? []).length;
    const bad = /localhost|127\.0\.0\.1/.test(text);
    return r.status === 200 && urls === 0 && !bad
      ? { ok: true, detail: '空 urlset' }
      : `status=${r.status} urls=${urls} localhost=${bad} :: ${text.slice(0, 160)}`;
  });

  const PREVIEW_PAGES = ['/', '/products', `/products/${FIXTURE.product_id}`, '/about', '/factory', '/quality', '/contact', '/privacy', '/terms', '/rfq', '/oe-search'];

  for (const p of PREVIEW_PAGES) {
    await checkAsync(`${p} 带 noindex 且没有 localhost canonical`, async () => {
      const r = await getHtml(`${preview.base}${p}`);
      if (r.status !== 200) return `status=${r.status}`;
      const meta = readMetaRobots(r.text) ?? '';
      const header = r.headers.get('x-robots-tag') ?? '';
      const canonical = readCanonical(r.text);
      const problems = [];
      if (!/noindex/i.test(meta)) problems.push(`meta robots="${meta}"`);
      if (!/noindex/i.test(header)) problems.push(`x-robots-tag="${header}"`);
      // 未配置正式域名时**不输出** canonical；一旦输出就绝不能是本地地址
      if (canonical && /localhost|127\.0\.0\.1/.test(canonical)) problems.push(`canonical=${canonical}`);
      return problems.length === 0
        ? { ok: true, detail: `meta="${meta}", canonical=${canonical ?? '(未输出，符合预期)'}` }
        : problems.join('; ');
    });
  }

  await checkAsync('预览环境页面不含中文工作表名 / 内部字段', async () => {
    const r = await getHtml(`${preview.base}/products/${FIXTURE.product_id}`);
    const bad = ['工作表', '综合产品信息表', 'source_sheets', 'source_row', 'product_type_evidence', 'review_required', 'unresolved', 'How this classification was made']
      .filter((k) => r.text.includes(k));
    return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
  });

  await checkAsync('产品页有 title 与 meta description', async () => {
    const r = await getHtml(`${preview.base}/products/${FIXTURE.product_id}`);
    const title = (r.text.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '';
    const desc = (r.text.match(/<meta name="description" content="([^"]*)"/) ?? [])[1] ?? '';
    return title.includes(FIXTURE.bowen_no ?? '') && desc.length > 40
      ? { ok: true, detail: `title="${title}", description=${desc.length} 字符` }
      : `title="${title}", description=${desc.length} 字符`;
  });

  await checkAsync('产品页 JSON-LD 是合法 JSON，且无价格/评分/库存字段', async () => {
    const r = await getHtml(`${preview.base}/products/${FIXTURE.product_id}`);
    const blocks = readJsonLd(r.text);
    if (blocks.length === 0) return '没有 JSON-LD';
    const parsed = [];
    for (const b of blocks) {
      try { parsed.push(JSON.parse(b)); } catch (e) { return `JSON-LD 解析失败: ${e.message}`; }
    }
    const flat = JSON.stringify(parsed);
    const bad = ['"offers"', '"price"', 'aggregateRating', '"review"', 'availability', 'gtin']
      .filter((k) => flat.includes(k));
    return bad.length === 0
      ? { ok: true, detail: `${blocks.length} 个 JSON-LD 块，字段白名单通过` }
      : `出现虚假字段 ${bad.join(', ')}`;
  });

  await checkAsync('JSON-LD 原始文本里没有未转义的 < （防注入）', async () => {
    const r = await getHtml(`${preview.base}/products/${FIXTURE.product_id}`);
    const bad = readJsonLd(r.text).filter((b) => b.includes('<'));
    return bad.length === 0 ? { ok: true, detail: '全部 < 已转义为 \\u003c' } : `${bad.length} 个块含裸 <`;
  });

  await checkAsync('不存在的产品 URL 返回 404', async () => {
    const r = await getHtml(`${preview.base}/products/BW-DOES-NOT-EXIST-9999`);
    return r.status === 404 ? { ok: true, detail: 'status=404' } : `status=${r.status}`;
  });

  await checkAsync(`无图/非公开产品 ${NON_PUBLIC.product_id} 返回 404`, async () => {
    const r = await getHtml(`${preview.base}/products/${NON_PUBLIC.product_id}`);
    return r.status === 404
      ? { ok: true, detail: 'status=404（未公开产品不可访问）' }
      : `status=${r.status}（不应可访问）`;
  });

  await checkAsync('预览环境不输出 HSTS', async () => {
    const r = await getHtml(`${preview.base}/`);
    return r.headers.get('strict-transport-security') === null ? true : '预览环境不应下发 HSTS';
  });
} catch (err) {
  networkOk = false;
  console.error(`\nB 段执行出错: ${err.message}`);
} finally {
  if (preview && !preview.external) await preview.stop();
}

// ===========================================================================
section('C. 正式索引配置：robots / sitemap / canonical / 结构化数据');
// ===========================================================================
if (!networkOk) {
  console.log('跳过 C 段：B 段失败。');
} else if (EXTERNAL_BASE) {
  console.log('跳过 C 段：使用了 BASE_URL，无法切换到 SITE_INDEXING_ENABLED=true 的独立进程。');
  console.log('如需完整验收，请直接运行 node tools/verify-seo-readiness.mjs（不加 BASE_URL）。');
} else {
  try {
    index = await ensureServer({
      port: INDEX_PORT,
      env: { SITE_INDEXING_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: PROD_SITE_URL },
      label: 'seo-index',
    });
    console.log(`\n索引配置服务器就绪：${index.base}（SITE_INDEXING_ENABLED=true, NEXT_PUBLIC_SITE_URL=${PROD_SITE_URL}）`);

    await checkAsync('robots.txt 放行公开内容并指向正式 sitemap', async () => {
      const r = await fetch(`${index.base}/robots.txt`);
      const text = await r.text();
      const problems = [];
      if (!/Allow:\s*\//.test(text)) problems.push('缺少 Allow: /');
      for (const p of ['/api/', '/rfq', '/oe-search', '/blog']) {
        if (!text.includes(`Disallow: ${p}`)) problems.push(`缺少 Disallow: ${p}`);
      }
      if (!text.includes(`Sitemap: ${PROD_SITE_URL}/sitemap.xml`)) problems.push('sitemap 地址不是正式域名');
      if (/localhost|127\.0\.0\.1/.test(text)) problems.push('出现本地地址');
      return problems.length === 0 ? { ok: true, detail: text.replace(/\s+/g, ' ').trim().slice(0, 140) } : problems.join('; ');
    });

    let sitemapUrls = [];
    await checkAsync('sitemap.xml 是合法 XML 且不含 localhost', async () => {
      const r = await fetch(`${index.base}/sitemap.xml`);
      const text = await r.text();
      if (r.status !== 200) return `status=${r.status}`;
      sitemapUrls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const bad = sitemapUrls.filter((u) => /localhost|127\.0\.0\.1/.test(u));
      if (sitemapUrls.length === 0) return 'sitemap 为空';
      if (bad.length) return `含本地地址 ${bad.slice(0, 3).join(', ')}`;
      return { ok: true, detail: `${sitemapUrls.length} 条 URL` };
    });

    await checkAsync(`sitemap 产品数量等于公开产品数量（${PUBLIC.publicProducts.length}）`, async () => {
      const productUrls = sitemapUrls.filter((u) => u.includes('/products/'));
      const expected = PUBLIC.publicProducts.length;
      if (productUrls.length !== expected) return `sitemap ${productUrls.length} vs 公开集合 ${expected}`;
      const ids = productUrls.map((u) => decodeURIComponent(u.split('/products/')[1]));
      const missing = PUBLIC.publicProducts.filter((p) => !ids.includes(p.product_id)).slice(0, 3).map((p) => p.product_id);
      const extra = ids.filter((id) => !PUBLIC.isPublic(PUBLIC.all.find((p) => p.product_id === id)));
      if (missing.length) return `缺少 ${missing.join(', ')}`;
      if (extra.length) return `多出未公开产品 ${extra.slice(0, 3).join(', ')}`;
      return { ok: true, detail: `${productUrls.length} 个产品页，与仓储公开集合一致` };
    });

    await checkAsync('sitemap 不包含无图产品的 URL', async () => {
      const ids = sitemapUrls.filter((u) => u.includes('/products/'))
        .map((u) => decodeURIComponent(u.split('/products/')[1]));
      const bad = ids.filter((id) => !PUBLIC.imageMap[id]).slice(0, 5);
      return bad.length === 0
        ? { ok: true, detail: `${ids.length} 个产品都有可靠主图` }
        : `出现无图产品 ${bad.join(', ')}`;
    });

    await checkAsync('sitemap 不含 RFQ / OE 搜索 / API / Blog', async () => {
      const bad = sitemapUrls.filter((u) => /\/(rfq|oe-search|api|blog)(\/|$|\?)/.test(u));
      return bad.length === 0 ? { ok: true, detail: '0 命中' } : bad.slice(0, 5).join(', ');
    });

    await checkAsync('sitemap 包含 8 个公开页面（首页与 canonical 写法一致）', async () => {
      const need = [
        PROD_SITE_URL,
        ...['/products', '/about', '/factory', '/quality', '/contact', '/privacy', '/terms'].map((p) => `${PROD_SITE_URL}${p}`),
      ];
      const missing = need.filter((u) => !sitemapUrls.includes(u));
      return missing.length === 0 ? { ok: true, detail: '8 个页面都在' } : `缺少 ${missing.join(', ')}`;
    });

    await checkAsync('sitemap 每条 URL 都唯一（无重复 canonical 目标）', async () => {
      const unique = new Set(sitemapUrls);
      return unique.size === sitemapUrls.length
        ? { ok: true, detail: `${unique.size} 条全部唯一` }
        : `重复 ${sitemapUrls.length - unique.size} 条`;
    });

    await checkAsync('公开页面 canonical 指向正式域名', async () => {
      const cases = [
        // Next 会把 canonical: '/' 归一化为 origin 本身（无尾斜杠），sitemap 已按同样写法输出
        ['/', PROD_SITE_URL],
        ['/products', `${PROD_SITE_URL}/products`],
        [`/products/${FIXTURE.product_id}`, `${PROD_SITE_URL}/products/${FIXTURE.product_id}`],
        ['/about', `${PROD_SITE_URL}/about`],
        ['/privacy', `${PROD_SITE_URL}/privacy`],
        ['/terms', `${PROD_SITE_URL}/terms`],
      ];
      const problems = [];
      for (const [p, expected] of cases) {
        const r = await getHtml(`${index.base}${p}`);
        const canonical = readCanonical(r.text);
        if (canonical !== expected) problems.push(`${p}: ${canonical} ≠ ${expected}`);
      }
      return problems.length === 0
        ? { ok: true, detail: `${cases.length} 个页面 canonical 全部正确` }
        : problems.join('; ');
    });

    await checkAsync('产品页 canonical 与自身 URL 一一对应（每个产品唯一）', async () => {
      const sample = PUBLIC.publicProducts.slice(0, 4);
      const problems = [];
      for (const p of sample) {
        const r = await getHtml(`${index.base}/products/${p.product_id}`);
        const canonical = readCanonical(r.text);
        const expected = `${PROD_SITE_URL}/products/${p.product_id}`;
        if (canonical !== expected) problems.push(`${p.product_id}: ${canonical}`);
      }
      return problems.length === 0
        ? { ok: true, detail: `抽查 ${sample.length} 个产品，canonical 各自唯一` }
        : problems.join('; ');
    });

    await checkAsync('公开页面 meta robots 允许索引', async () => {
      const r = await getHtml(`${index.base}/`);
      const meta = readMetaRobots(r.text) ?? '';
      const header = r.headers.get('x-robots-tag');
      if (/noindex/i.test(meta)) return `首页仍然是 noindex: ${meta}`;
      if (header && /noindex/i.test(header)) return `首页响应头仍然 noindex: ${header}`;
      return { ok: true, detail: `meta="${meta}", header=${header ?? '(未下发)'}` };
    });

    for (const p of ['/rfq', '/oe-search', '/blog']) {
      await checkAsync(`${p} 在允许收录的环境下仍然 noindex`, async () => {
        const r = await getHtml(`${index.base}${p}`);
        const meta = readMetaRobots(r.text) ?? '';
        return /noindex/i.test(meta) ? { ok: true, detail: `meta="${meta}"` } : `meta="${meta}"`;
      });
    }

    await checkAsync('首页 JSON-LD 含 Organization + WebSite 且 url 为正式域名', async () => {
      const r = await getHtml(`${index.base}/`);
      const blocks = readJsonLd(r.text);
      const parsed = blocks.map((b) => { try { return JSON.parse(b); } catch { return null; } });
      const flat = JSON.stringify(parsed);
      if (flat.includes('"Organization"') && flat.includes('"WebSite"') && flat.includes(PROD_SITE_URL)) {
        return { ok: true, detail: `${blocks.length} 个块，含 Organization/WebSite` };
      }
      return `缺少必要类型或域名: ${flat.slice(0, 160)}`;
    });

    await checkAsync('产品页 JSON-LD 含 Product 与 BreadcrumbList，且 sku/manufacturer 正确', async () => {
      const r = await getHtml(`${index.base}/products/${FIXTURE.product_id}`);
      const blocks = readJsonLd(r.text);
      const parsed = blocks.map((b) => { try { return JSON.parse(b); } catch { return null; } });
      const flat = JSON.stringify(parsed);
      const problems = [];
      if (!flat.includes('"Product"')) problems.push('缺少 Product');
      if (!flat.includes('"BreadcrumbList"')) problems.push('缺少 BreadcrumbList');
      if (FIXTURE.bowen_no && !flat.includes(`"sku":"${FIXTURE.bowen_no}"`)) problems.push('sku 不是 Bowen No.');
      if (!flat.includes('Qufu Bowen Auto Parts Manufacturing Co., Ltd.')) problems.push('缺少 manufacturer');
      if (/aggregateRating|"offers"|"price"/.test(flat)) problems.push('出现虚假字段');
      return problems.length === 0
        ? { ok: true, detail: `${blocks.length} 个块` }
        : problems.join('; ');
    });

    await checkAsync('索引环境的页面里没有中文工作表名或内部字段', async () => {
      const r = await getHtml(`${index.base}/products/${FIXTURE.product_id}`);
      const bad = ['工作表', '综合产品信息表', 'source_sheets', 'product_type_evidence', 'review_required', 'unresolved']
        .filter((k) => r.text.includes(k));
      return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
    });

    await checkAsync('索引配置（正式 https 域名）下发 HSTS，且不带 includeSubDomains/preload', async () => {
      const r = await getHtml(`${index.base}/`);
      const hsts = r.headers.get('strict-transport-security');
      // 注意：这里是通过 http://127.0.0.1 访问的本地服务器，浏览器会忽略明文 HTTP 上的 HSTS，
      // 因此本机无法端到端验证"强制 HTTPS"的效果；这里验证的是**配置正确性**：
      // 只有「已确认 https 正式域名 + 已开启收录」这一种配置才会生成该响应头。
      if (!hsts) return '索引配置应该下发 HSTS，但响应头缺失';
      if (/includeSubDomains|preload/i.test(hsts)) return `HSTS 不应带 includeSubDomains/preload: ${hsts}`;
      return { ok: true, detail: `${hsts}（仅在该配置下出现）` };
    });
  } catch (err) {
    console.error(`\nC 段执行出错: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (index) await index.stop();
  }
}

process.exitCode = summary() ? (process.exitCode ?? 0) : 1;
