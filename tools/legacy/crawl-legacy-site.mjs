/**
 * Phase 3.5 / A —— 抓取 www.qfbowen.com 全部公开页面
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/crawl-legacy-site.mjs
 *
 * 产物：
 *   data/legacy-site/crawl/html/<name>.html   每个公开页面的原始 HTML
 *   data/legacy-site/crawl/pages.json         每个页面的结构化元数据
 *   data/legacy-site/crawl/probes.json        站点级探测（robots/sitemap/HTTPS/响应头）
 *
 * 合规边界（硬编码，不靠自觉）：
 *   - 只发 GET，不带 Cookie、不带认证，不提交任何表单（/gbook 只读不写）。
 *   - 只跟随站内公开 HTML 链接；不触碰 /admin、登录、验证码相关路径。
 *   - 限速 + 有限重试，避免影响旧站正常访问。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpGet, pooledMap } from './lib/http.mjs';
import { parsePage } from './lib/html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'legacy-site', 'crawl');
const HTML_DIR = path.join(OUT, 'html');

const ORIGIN = 'http://www.qfbowen.com';
const MAX_PAGES = Number(process.env.BOWEN_CRAWL_MAX || 600);
// 断点续抓：设置 BOWEN_CRAWL_RESUME=1 时，读取已有 pages.json，
// 把已抓页面直接算作已访问，并从它们记录的站内链接继续 BFS——不重复请求旧站。
const RESUME = process.env.BOWEN_CRAWL_RESUME === '1';
const CONCURRENCY = 3;
const DELAY_MS = 220;

// 只允许抓这些路径形态的 HTML 页面
const PAGE_RE = /^\/($|(about|list|content|gbook)\/\?[0-9_]+\.html)/i;
// 明确排除（后台 / 资源 / 检索类），保证不越界
const BLOCK_RE = /^\/(admin|manage|login|search|Templates|upLoad|upfile|editor|api|App_)/i;

function urlToName(u) {
  const { pathname, search } = new URL(u);
  if (pathname === '/' && !search) return 'home';
  const seg = pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
  const q = search.replace(/[?=]/g, '').replace(/\.html$/i, '').replace(/[^0-9a-z_]/gi, '');
  return `${seg}${q ? '_' + q : ''}` || 'page';
}

function isInternalHtml(u) {
  try {
    const url = new URL(u);
    if (!/^(www\.)?qfbowen\.com$/i.test(url.hostname)) return false;
    if (BLOCK_RE.test(url.pathname)) return false;
    return PAGE_RE.test(url.pathname + url.search);
  } catch { return false; }
}

function normalizeForVisit(u) {
  const url = new URL(u);
  url.hash = '';
  url.hostname = 'www.qfbowen.com';
  url.protocol = 'http:';
  return url.href;
}

async function main() {
  fs.mkdirSync(HTML_DIR, { recursive: true });

  // ---------- 站点级探测（G 技术审计用） ----------
  const probes = { generated_at: new Date().toISOString(), origin: ORIGIN, endpoints: {}, homeHeaders: null };
  for (const p of ['/robots.txt', '/sitemap.xml', '/Sitemap.xml']) {
    const r = await httpGet(ORIGIN + p, { retries: 2, timeoutMs: 25000 });
    probes.endpoints[p] = { status: r.status, bytes: r.bytes, error: r.error };
  }
  {
    const r = await httpGet(ORIGIN + '/', { retries: 2 });
    probes.homeHeaders = { status: r.status, contentType: r.contentType, bytes: r.bytes, error: r.error };
  }

  // ---------- BFS ----------
  const visited = new Map();   // url -> pageRecord
  const discoveredAssets = new Set();
  const queue = [];
  const queued = new Set();
  const failed = [];
  let fetched = 0;

  const pagesFile = path.join(OUT, 'pages.json');
  let resumedFrom = 0;

  if (RESUME && fs.existsSync(pagesFile)) {
    const prev = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
    for (const p of prev.pages) visited.set(p.url, p);
    for (const a of prev.discovered_assets || []) discoveredAssets.add(a);
    for (const f of prev.failed_or_skipped || []) failed.push(f);
    resumedFrom = visited.size;
    // 从已抓页面的站内链接里，挑出还没抓过的继续排队
    for (const p of visited.values()) {
      for (const l of p.internalLinks || []) {
        if (visited.has(l) || queued.has(l)) continue;
        if (!isInternalHtml(l)) continue;
        queued.add(l);
        queue.push(l);
      }
    }
  }

  // 始终保证首页在队列里（首次运行或续抓都成立）
  const homeUrl = normalizeForVisit(ORIGIN + '/');
  if (!visited.has(homeUrl) && !queued.has(homeUrl)) { queued.add(homeUrl); queue.push(homeUrl); }

  console.log(`start: resumed=${resumedFrom} pages, queue=${queue.length}, max=${MAX_PAGES}`);

  while (queue.length && visited.size < MAX_PAGES) {
    const batch = [];
    while (queue.length && batch.length < CONCURRENCY) batch.push(queue.shift());

    const results = await pooledMap(batch, async (target) => {
      const res = await httpGet(target, { retries: 3, backoffMs: 800, timeoutMs: 45000 });
      return { target, res };
    }, { concurrency: CONCURRENCY, delayMs: DELAY_MS });

    for (const item of results) {
      if (!item || item.__error) { failed.push({ url: item && item.item, error: item && item.__error }); continue; }
      const { target, res } = item;
      fetched++;

      // 旧站的 404 是自定义页（约 1231 字节，HTTP 404）——不当作页面收录
      if (!res.ok || res.status !== 200 || !/html/i.test(res.contentType)) {
        failed.push({ url: target, status: res.status, bytes: res.bytes, error: res.error });
        continue;
      }
      if (visited.has(target)) continue;

      const parsed = parsePage(res.text, target);
      // 首页会出现好几个 URL 变体指向同一内容，用 title+正文长度做轻量去重标记
      const record = {
        url: target,
        name: urlToName(target),
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        metaKeywords: parsed.metaKeywords,
        metaRobots: parsed.metaRobots,
        canonical: parsed.canonical,
        h1: parsed.headings.h1,
        h2: parsed.headings.h2,
        h3: parsed.headings.h3,
        textLength: parsed.textLength,
        text: parsed.text,
        htmlBytes: parsed.htmlBytes,
        discoveredFrom: null,
        imageUrls: [...new Set(parsed.images.map((i) => i.abs))],
        documentUrls: [...new Set(parsed.links.filter((l) => l.isDocument && l.abs).map((l) => l.abs))],
        videoUrls: [...new Set([...parsed.videos.map((v) => v.abs).filter(Boolean),
          ...parsed.links.filter((l) => l.isVideo && l.abs).map((l) => l.abs)])],
        externalLinks: [...new Set(parsed.links.filter((l) => l.external && l.abs).map((l) => l.abs))],
        stylesheets: parsed.stylesheets,
        scripts: parsed.scripts,
        beacons: parsed.beacons,
        internalLinks: [...new Set(parsed.links.filter((l) => l.abs && isInternalHtml(l.abs)).map((l) => normalizeForVisit(l.abs)))],
      };
      visited.set(target, record);

      fs.writeFileSync(path.join(HTML_DIR, record.name + '.html'), res.buffer);

      for (const a of [...record.imageUrls, ...record.documentUrls, ...record.videoUrls]) discoveredAssets.add(a);

      // 入队新链接
      for (const l of record.internalLinks) {
        if (visited.has(l) || queued.has(l)) continue;
        queued.add(l);
        queue.push(l);
      }
      if (fetched % 10 === 0) process.stdout.write(`  ...pages=${visited.size} queue=${queue.length}\n`);
    }
  }

  // discoveredFrom 回填：谁先链到谁
  for (const rec of visited.values()) {
    for (const l of rec.internalLinks) {
      const t = visited.get(l);
      if (t && !t.discoveredFrom) t.discoveredFrom = rec.url;
    }
  }

  const pages = [...visited.values()].sort((a, b) => a.url.localeCompare(b.url));
  fs.writeFileSync(pagesFile, JSON.stringify({
    generated_at: new Date().toISOString(),
    origin: ORIGIN,
    page_count: pages.length,
    resumed_from: resumedFrom,
    fetch_attempts: fetched,
    // 队列是否被上限截断：不为 0 说明站内还有未抓页面，报告里必须如实说明
    queue_remaining_at_cap: queue.length,
    crawl_complete: queue.length === 0,
    failed_or_skipped: failed,
    discovered_asset_url_count: discoveredAssets.size,
    discovered_assets: [...discoveredAssets].sort(),
    pages,
  }, null, 2));

  fs.writeFileSync(path.join(OUT, 'probes.json'), JSON.stringify(probes, null, 2));

  console.log(`\nDONE pages=${pages.length} assets=${discoveredAssets.size} attempts=${fetched} skipped=${failed.length}`);
  if (queue.length) console.log(`WARNING 仍在 ${MAX_PAGES} 页上限处停止，队列还剩 ${queue.length} 个链接（需继续续抓）`);
  console.log(`html  -> ${HTML_DIR}`);
  console.log(`pages -> ${pagesFile}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
