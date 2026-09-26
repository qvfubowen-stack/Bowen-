/**
 * Phase 3.5 / C —— 生成旧站资产清单 data/legacy-site/assets.json
 * ---------------------------------------------------------------------
 * 运行顺序：crawl → download → extract-legacy-products → match → 本脚本
 *   （产品图复用状态来自 D 的匹配结论，因此匹配要先跑）
 *
 * 需求书要求的字段全部在这里产出：
 *   source_url, asset_url, local_file, asset_type, page_title, page_category,
 *   possible_bowen_no, possible_product_name, reuse_status
 * 另附证据字段，便于人工复核。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPage } from './lib/classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');

function main() {
  const crawlPath = path.join(SITE_DIR, 'crawl', 'pages.json');
  const dlPath = path.join(SITE_DIR, 'downloads.json');
  if (!fs.existsSync(dlPath)) throw new Error('缺少 downloads.json，请先运行 download-legacy-assets.mjs');

  const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
  const downloads = JSON.parse(fs.readFileSync(dlPath, 'utf8'));

  const matchingPath = path.join(SITE_DIR, 'product-image-matching.json');
  const matching = fs.existsSync(matchingPath) ? JSON.parse(fs.readFileSync(matchingPath, 'utf8')) : null;

  const legacyProductsPath = path.join(SITE_DIR, 'legacy-products.json');
  const legacyProducts = fs.existsSync(legacyProductsPath) ? JSON.parse(fs.readFileSync(legacyProductsPath, 'utf8')) : null;

  // 页面索引：url -> 页面记录 + 分类
  const pageIndex = new Map();
  for (const p of crawl.pages) {
    const cls = classifyPage(p);
    pageIndex.set(p.url, { ...p, fine: cls.fine, coarse: cls.coarse, evidence: cls.evidence });
  }

  // 图片匹配结论：image_url -> 匹配结果（取优先级最高的一条）
  const matchByImage = new Map();
  if (matching) {
    const rank = { auto_match: 0, review_required: 1, not_recommended: 2 };
    for (const r of matching.image_rows) {
      const prev = matchByImage.get(r.image_url);
      if (!prev || (rank[r.reuse_status] ?? 9) < (rank[prev.reuse_status] ?? 9)) matchByImage.set(r.image_url, r);
    }
  }
  // 旧站产品页：url -> 该页结构化字段
  const legacyPageById = new Map();
  if (legacyProducts) for (const lp of legacyProducts.products) legacyPageById.set(lp.source_url, lp);

  const assets = downloads.assets.map((a) => {
    const sourceUrls = a.source_pages || [];
    const primaryUrl = sourceUrls[0] || null;
    const page = primaryUrl ? pageIndex.get(primaryUrl) : null;

    // page_category 直接采用分类器给出的结论（单一事实来源）。
    // 早期版本在这里按另一套优先级重新推断，导致同一素材在
    // 「按目录统计」与「按页面类别统计」两处归类不一致。
    const pageCategory = a.page_category || 'other';

    // 产品图：带上候选 Bowen No. 与产品名（来自匹配结论或旧站页面自述）
    const m = matchByImage.get(a.asset_url) || null;
    const lp = primaryUrl ? legacyPageById.get(primaryUrl) : null;
    const possibleBowen = (m && m.matched_bowen_no)
      || (m && m.legacy_bowen_nos ? String(m.legacy_bowen_nos).split(' / ')[0] : '')
      || (lp && lp.bowen_nos.length ? lp.bowen_nos[0] : '')
      || '';
    const possibleProduct = (m && m.matched_product_name_en)
      || (m && m.product_name_zh)
      || (lp && lp.product_name_zh)
      || '';

    // 复用状态：素材分类先给出基线，产品图由 D 的匹配结论覆盖
    let reuse = a.classified_reuse || 'review_required';
    let sizeNote = null;
    // 下载后拿到的真实尺寸可以补一条客观证据：极小图必然是图标/项目符号，不是照片
    if (a.asset_type === 'image' && a.width && a.height && (a.width <= 64 || a.height <= 64)) {
      reuse = 'not_recommended';
      sizeNote = `实测尺寸 ${a.width}x${a.height}（≤64px），属图标/项目符号类装饰件`;
    }
    if (m) reuse = m.reuse_status;
    else if (a.subdir === 'images/products' && !sizeNote) reuse = 'review_required';

    return {
      // ---- 需求书要求字段 ----
      source_url: primaryUrl,
      asset_url: a.asset_url,
      local_file: a.local_file,
      asset_type: a.asset_type,
      page_title: page ? page.title : null,
      page_category: pageCategory,
      possible_bowen_no: possibleBowen || null,
      possible_product_name: possibleProduct || null,
      reuse_status: reuse,
      // ---- 证据与可追溯性 ----
      source_pages: sourceUrls,
      page_fine_category: page ? page.fine : null,
      legacy_page_id: m ? m.legacy_page_id : (lp ? lp.legacy_page_id : null),
      match_method: m ? m.match_method : null,
      matched_product_id: m ? m.matched_product_id : null,
      matched_product_name_en: m ? m.matched_product_name_en : null,
      matched_product_type: m ? m.matched_product_type : null,
      match_reason: m ? m.reason : null,
      classification_evidence: sizeNote
        ? `${a.classification_evidence || ''}；${sizeNote}`.replace(/^；/, '')
        : (a.classification_evidence || null),
      format: a.format,
      width: a.width,
      height: a.height,
      bytes: a.bytes,
      sha256: a.sha256,
      download_status: a.download_status,
      http_status: a.http_status,
      error: a.error,
    };
  });

  const ok = assets.filter((a) => a.download_status === 'ok');
  const byStatus = ok.reduce((m, a) => { m[a.reuse_status] = (m[a.reuse_status] || 0) + 1; return m; }, {});
  const byType = ok.reduce((m, a) => { m[a.asset_type] = (m[a.asset_type] || 0) + 1; return m; }, {});
  const byCategory = ok.reduce((m, a) => { m[a.page_category] = (m[a.page_category] || 0) + 1; return m; }, {});
  const byDir = ok.reduce((m, a) => { const d = a.local_file.split('/').slice(0, -1).join('/'); m[d] = (m[d] || 0) + 1; return m; }, {});

  const out = {
    generated_at: new Date().toISOString(),
    phase: 'Phase 3.5 — qfbowen.com 现有官网资产迁移审计',
    source_site: crawl.origin,
    field_spec: ['source_url', 'asset_url', 'local_file', 'asset_type', 'page_title', 'page_category',
      'possible_bowen_no', 'possible_product_name', 'reuse_status'],
    field_notes: {
      source_url: '该素材出现在哪个旧站页面（首次发现的页面）',
      page_category: '来源页面的栏目类别（product / certificate / factory / company / contact / news / other）',
      local_file: '本地相对路径。目录即"复用归属桶"，与 page_category 在少数情况下不同——'
        + '被判定为站点外壳或纯装饰的素材会归入 images/other（not_recommended），但仍保留其来源页面类别。',
      possible_bowen_no: '仅当有编号证据时填写，否则为 null。绝不猜测。',
      reuse_status: 'auto_match / review_required / not_recommended，含义见 reuse_status_values',
    },
    reuse_status_values: {
      auto_match: '旧站页面写明的编号在当前数据库唯一命中，可自动对应',
      review_required: '证据不足或有歧义，必须人工确认，程序未自动绑定',
      not_recommended: '不建议迁移（模板装饰、图标、二维码等）',
    },
    summary: {
      discovered_asset_urls: downloads.discovered_asset_count,
      downloaded_ok: ok.length,
      download_failed: assets.length - ok.length,
      total_bytes: ok.reduce((s, a) => s + (a.bytes || 0), 0),
      by_reuse_status: byStatus,
      by_asset_type: byType,
      by_page_category: byCategory,
      by_directory: byDir,
    },
    assets,
  };
  fs.writeFileSync(path.join(SITE_DIR, 'assets.json'), JSON.stringify(out, null, 2));

  console.log(`assets.json — ${assets.length} 条（下载成功 ${ok.length}）`);
  console.log('reuse_status:', JSON.stringify(byStatus));
  console.log('page_category:', JSON.stringify(byCategory));
  console.log('directory:', JSON.stringify(byDir));
}

main();
