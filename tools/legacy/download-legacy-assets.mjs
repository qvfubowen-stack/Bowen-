/**
 * Phase 3.5 / B —— 下载旧站公开的真实媒体素材
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/download-legacy-assets.mjs
 *
 * 产物：
 *   data/legacy-site/images/products/      产品图
 *   data/legacy-site/images/factory/       工厂 / 设备 / 厂房
 *   data/legacy-site/images/certificates/  证书 / 荣誉
 *   data/legacy-site/images/company/       公司外景 / Logo / Banner / 联系页
 *   data/legacy-site/images/other/         其它
 *   data/legacy-site/documents/            PDF / Office 等下载文件
 *   data/legacy-site/downloads.json        每个文件的下载结果与元数据
 *
 * 命名规则：保留原始文件名；同名不同 URL 时加 URL 哈希前缀，保证可追溯。
 * 合规：只 GET 公开资源，限速，不绕任何访问控制。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpGet, pooledMap } from './lib/http.mjs';
import { classifyAsset, localFileName, classifyPage, simpleHash, ACCESS_CONTROL_RE } from './lib/classify.mjs';
import { fileInfo, sniffFormat } from './lib/media.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');
const CRAWL = path.join(SITE_DIR, 'crawl');

const CONCURRENCY = 3;
const DELAY_MS = 120;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

const IMG_RE = /\.(jpe?g|png|gif|bmp|webp|svg|ico|tiff?)(\?|#|$)/i;
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt)(\?|#|$)/i;
const VIDEO_RE = /\.(mp4|m4v|mov|avi|wmv|flv|webm|ogv|mkv)(\?|#|$)/i;

export function assetTypeOf(url) {
  if (DOC_RE.test(url)) return 'document';
  if (VIDEO_RE.test(url)) return 'video';
  if (IMG_RE.test(url)) return 'image';
  return 'unknown';
}

function main() {
  const crawl = JSON.parse(fs.readFileSync(path.join(CRAWL, 'pages.json'), 'utf8'));

  // ---- 建立"素材 → 引用页面"的反向索引（分类的唯一依据）----
  const referencing = new Map(); // assetUrl -> [{url, coarse, fine}]
  const addRef = (assetUrl, page) => {
    if (!assetUrl) return;
    if (!referencing.has(assetUrl)) referencing.set(assetUrl, []);
    const cls = classifyPage(page);
    referencing.get(assetUrl).push({ url: page.url, coarse: cls.coarse, fine: cls.fine });
  };
  for (const p of crawl.pages) {
    for (const u of p.imageUrls || []) addRef(u, p);
    for (const u of p.documentUrls || []) addRef(u, p);
    for (const u of p.videoUrls || []) addRef(u, p);
  }

  const allAssets = [...referencing.keys()].sort();
  console.log(`discovered assets: ${allAssets.length}`);

  // ---- 先分配本地路径（在下载前完成，便于查看计划）----
  const takenByDir = new Map();
  const plan = allAssets.map((assetUrl) => {
    const type = assetTypeOf(assetUrl);
    const cls = classifyAsset(assetUrl, type, referencing.get(assetUrl));
    if (!takenByDir.has(cls.subdir)) takenByDir.set(cls.subdir, new Set());
    const fileName = localFileName(assetUrl, takenByDir.get(cls.subdir));
    return { assetUrl, type, ...cls, fileName, localPath: path.join(SITE_DIR, cls.subdir, fileName) };
  });

  for (const item of plan) fs.mkdirSync(path.dirname(item.localPath), { recursive: true });

  // ---- 就地复用缓存 ----
  // 分类规则一旦修正，已下载文件的目标目录就会变。为了不重复请求旧站，
  // 这里把已存在的文件先移到临时缓存，再按"原始文件名"复用（同一 URL 的文件名唯一）。
  // 只有缓存里找不到的素材才真正发起网络请求。
  const CACHE_DIR = path.join(SITE_DIR, '.relocate-cache');
  const cacheByBase = new Map();
  const moveToCache = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { moveToCache(p); continue; }
      if (e.name.startsWith('.')) continue;
      const safe = `${simpleHash(p)}_${e.name}`;
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.renameSync(p, path.join(CACHE_DIR, safe));
      cacheByBase.set(e.name.toLowerCase(), path.join(CACHE_DIR, safe));
    }
  };
  moveToCache(path.join(SITE_DIR, 'images'));
  moveToCache(path.join(SITE_DIR, 'documents'));
  // 清空旧目录，保证不会有"上一次分类遗留"的错位文件污染统计
  for (const sub of ['images/products', 'images/factory', 'images/certificates', 'images/company', 'images/other', 'documents']) {
    const d = path.join(SITE_DIR, sub);
    fs.rmSync(d, { recursive: true, force: true });
    fs.mkdirSync(d, { recursive: true });
  }
  console.log(`reuse cache: ${cacheByBase.size} files available locally`);

  return pooledMap(plan, async (item) => {
    const rel = path.relative(SITE_DIR, item.localPath).replace(/\\/g, '/');
    const baseMeta = {
      asset_url: item.assetUrl,
      local_file: rel,
      planned_local_file: rel,
      asset_type: item.type,
      subdir: item.subdir,
      page_category: item.page_category,
      classification_evidence: item.evidence,
      classified_reuse: item.reuse,
      source_pages: referencing.get(item.assetUrl).map((r) => r.url),
    };

    // 访问控制类资源（验证码图片等）：按合规要求**不请求、不下载**，只登记在案
    if (ACCESS_CONTROL_RE.test(item.assetUrl)) {
      return {
        ...baseMeta,
        local_file: null,
        bytes: 0, format: null, width: null, height: null, sha256: null,
        download_status: 'excluded_access_control',
        http_status: 'not_requested',
        error: '访问控制类资源（验证码等），按"不绕过访问权限"的合规要求不下载',
      };
    }

    // 本地已有同一文件（分类规则调整后重跑）→ 直接复用，不再请求旧站
    const cached = cacheByBase.get(path.basename(item.localPath).toLowerCase());
    if (cached && fs.existsSync(cached)) {
      fs.copyFileSync(cached, item.localPath);
      const info = fileInfo(item.localPath);
      return { ...baseMeta, ...info, download_status: 'ok', http_status: 'reused_local', reused_local_copy: true, error: null };
    }

    const res = await httpGet(item.assetUrl, { retries: 3, backoffMs: 700, timeoutMs: 60000 });

    if (!res.ok || !res.buffer.length) {
      return {
        ...baseMeta,
        local_file: null,
        bytes: 0, format: null, width: null, height: null, sha256: null,
        download_status: 'failed',
        http_status: res.status,
        error: res.error || `HTTP ${res.status}`,
      };
    }

    if (res.buffer.length > MAX_FILE_BYTES) {
      return {
        ...baseMeta,
        local_file: null,
        bytes: res.buffer.length, format: null, width: null, height: null, sha256: null,
        download_status: 'skipped_too_large',
        http_status: res.status,
        error: `超过 ${MAX_FILE_BYTES} 字节上限`,
      };
    }

    fs.writeFileSync(item.localPath, res.buffer);
    const info = fileInfo(item.localPath);
    return {
      ...baseMeta,
      ...info,
      download_status: 'ok',
      http_status: res.status,
      reused_local_copy: false,
      error: null,
    };
  }, { concurrency: CONCURRENCY, delayMs: DELAY_MS }).then((results) => {
    const clean = results.map((r) => (r && r.__error ? { asset_url: r.item && r.item.assetUrl, download_status: 'worker_error', error: r.__error } : r));
    const ok = clean.filter((r) => r.download_status === 'ok');
    fs.writeFileSync(path.join(SITE_DIR, 'downloads.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      source: crawl.origin,
      discovered_asset_count: allAssets.length,
      downloaded_ok: ok.length,
      failed: clean.length - ok.length,
      total_bytes: ok.reduce((s, r) => s + r.bytes, 0),
      by_subdir: ok.reduce((m, r) => { m[r.subdir] = (m[r.subdir] || 0) + 1; return m; }, {}),
      assets: clean,
    }, null, 2));

    console.log(`downloaded ok: ${ok.length} / ${allAssets.length}`);
    console.log('by subdir:', JSON.stringify(ok.reduce((m, r) => { m[r.subdir] = (m[r.subdir] || 0) + 1; return m; }, {})));
    console.log(`total MB: ${(ok.reduce((s, r) => s + r.bytes, 0) / 1048576).toFixed(1)}`);
    const reused = ok.filter((r) => r.reused_local_copy).length;
    console.log(reused ? `reused from local cache: ${reused}（未重复请求旧站）` : 'reused from local cache: 0');
    const fails = clean.filter((r) => r.download_status !== 'ok');
    if (fails.length) console.log('failures sample:', fails.slice(0, 5).map((f) => `${f.asset_url} :: ${f.error}`).join('\n'));

    // 清掉临时缓存（所有文件都已按新分类就位）
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }).finally(() => {
    // 无论成功、失败还是异常，临时缓存都必须清掉——
    // 否则会残留上千个文件并被误纳入版本管理。
    if (fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  });
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
