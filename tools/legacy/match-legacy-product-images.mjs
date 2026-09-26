/**
 * Phase 3.5 / D —— 产品图片匹配
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/match-legacy-product-images.mjs
 *
 * 产物：
 *   data/legacy-site/product-image-matching.json   完整匹配结论（含证据链）
 *   review/legacy-product-image-mapping.xlsx       业务方人工确认表（带下拉菜单）
 *
 * 对应关系只认旧站页面写明的编号，见 lib/match.mjs 的规则说明。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeXlsx, STYLE } from '../lib/xlsx-writer.mjs';
import { buildMatchDb, matchLegacyProduct } from './lib/match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');
const REVIEW = path.join(ROOT, 'review');

function main() {
  const legacy = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'legacy-products.json'), 'utf8'));
  const downloads = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'downloads.json'), 'utf8'));
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/v2/products.json'), 'utf8'));
  const oeIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/v2/product-oe-search-index.json'), 'utf8'));

  const db = buildMatchDb(products, oeIndex);
  const downloadByUrl = new Map(downloads.assets.map((a) => [a.asset_url, a]));

  const rows = [];
  const pageSummaries = [];

  for (const lp of legacy.products) {
    const m = matchLegacyProduct(db, lp);
    const imageUrls = lp.detail_image_urls || [];

    pageSummaries.push({
      legacy_page_id: lp.legacy_page_id,
      source_url: lp.source_url,
      product_name_zh: lp.product_name_zh,
      bowen_nos: lp.bowen_nos,
      oe_numbers: lp.oe_numbers,
      image_count: imageUrls.length,
      ...m,
    });

    for (const imgUrl of imageUrls) {
      const d = downloadByUrl.get(imgUrl) || null;
      rows.push({
        legacy_page_id: lp.legacy_page_id,
        source_url: lp.source_url,
        product_name_zh: lp.product_name_zh,
        legacy_bowen_nos: (lp.bowen_nos || []).join(' / '),
        legacy_oe_numbers: (lp.oe_numbers || []).join(' / '),
        legacy_vehicles: (lp.vehicles || []).join(' / '),
        image_url: imgUrl,
        local_file: d && d.local_file ? d.local_file : '',
        image_size: d && d.width ? `${d.width}x${d.height}` : '',
        image_bytes: d ? d.bytes : 0,
        image_sha256: d ? d.sha256 : '',
        ...m,
      });
    }
  }

  // 同一张图被多个页面引用时，按 (image_url, matched_product_id) 去重，避免审核表出现重复待办
  const seen = new Set();
  const dedupRows = [];
  for (const r of rows) {
    const k = `${r.image_url}::${r.matched_product_id || ''}::${r.reuse_status}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedupRows.push(r);
  }

  const autoMatched = dedupRows.filter((r) => r.reuse_status === 'auto_match');
  const reviewRequired = dedupRows.filter((r) => r.reuse_status === 'review_required');

  const out = {
    generated_at: new Date().toISOString(),
    rules: {
      priority: ['Bowen No. (旧站规格表「博文编号」)', '产品编号', 'OE Number', '产品标题', '原网页 URL'],
      never: '禁止只根据图片外观猜产品；无法可靠对应一律 review_required，绝不自动绑定。',
      auto_match_conditions: [
        '旧站页面写明博文编号，且在冻结数据库中唯一命中产品；或',
        '旧站页面写明的 OEM 号码在当前数据库中唯一命中一个产品（非共享 OE）。',
      ],
    },
    legacy_product_page_count: legacy.products.length,
    legacy_product_image_count: dedupRows.length,
    auto_match_image_count: autoMatched.length,
    review_required_image_count: reviewRequired.length,
    matched_legacy_page_count: pageSummaries.filter((p) => p.matched_product_id).length,
    page_summaries: pageSummaries,
    image_rows: dedupRows,
  };
  fs.writeFileSync(path.join(SITE_DIR, 'product-image-matching.json'), JSON.stringify(out, null, 2));

  buildXlsx(dedupRows, pageSummaries, legacy);
  console.log(`legacy product pages : ${legacy.products.length}`);
  console.log(`legacy product images: ${dedupRows.length}`);
  console.log(`  auto_match         : ${autoMatched.length}`);
  console.log(`  review_required    : ${reviewRequired.length}`);
  return out;
}

function buildXlsx(rows, pageSummaries, legacy) {
  const STATUS_OPTS = ['auto_match', 'review_required', 'not_recommended'];
  const USABLE_OPTS = ['可用', '不可用', '需重新拍摄', '需修图后再用', '待确认'];

  const detailRows = rows.map((r) => [
    r.legacy_page_id,
    r.source_url,
    r.product_name_zh || '',
    r.legacy_bowen_nos || '',
    r.legacy_oe_numbers || '',
    r.legacy_vehicles || '',
    r.image_url,
    r.local_file || '',
    r.image_size || '',
    r.match_method,
    r.matched_bowen_no || '',
    r.matched_product_id || '',
    r.matched_product_name_en || '',
    r.matched_product_type || '',
    r.reuse_status,
    r.reason,
    '',                       // 人工确认 Bowen No.
    '',                       // 人工确认 product_id
    '',                       // 是否可用于英文站（下拉）
    '',                       // 备注
  ].map((v, i) => {
    if (i === 16) return { v, style: STYLE.MANUAL };
    if (i === 17) return { v, style: STYLE.MANUAL };
    if (i === 18) return { v, style: STYLE.MANUAL_LIST };
    if (i === 19) return { v, style: STYLE.MANUAL };
    if (i === 14) return { v, style: v === 'auto_match' ? STYLE.BODY : STYLE.WARN };
    return { v };
  }));

  const summaryRows = pageSummaries.map((p) => [
    p.legacy_page_id,
    p.source_url,
    p.product_name_zh || '',
    (p.bowen_nos || []).join(' / '),
    (p.oe_numbers || []).join(' / '),
    p.image_count,
    p.match_method,
    p.matched_bowen_no || '',
    p.matched_product_id || '',
    p.matched_product_name_en || '',
    p.reuse_status,
    p.reason,
    '',   // 人工确认
    '',   // 备注
  ]);

  const noDataPages = legacy.products.filter((p) => !p.bowen_nos.length && !p.oe_numbers.length);

  writeXlsx(path.join(REVIEW, 'legacy-product-image-mapping.xlsx'), [
    {
      name: '填表说明',
      title: '旧站产品图片 → Bowen No. → 当前产品数据库 匹配确认表（填表说明）',
      autoFilter: false,
      columns: [{ title: '项目', width: 30 }, { title: '说明', width: 110 }],
      rows: [
        ['这个文件是做什么的', 'Phase 3.5 从旧站 www.qfbowen.com 抓取了产品图片，需要业务方确认「这张图对应现在数据库里的哪个产品」。'],
        ['匹配依据（优先级）', '① 旧站规格表里的「博文编号」 ② 产品编号 ③ OEM/OE 号码 ④ 产品标题 ⑤ 原网页 URL。'],
        ['为什么不能全自动', '按项目铁律：禁止只根据图片外观猜产品。旧站只有部分产品页写了「博文编号」，其余页面没有任何编号信息。'],
        ['auto_match 是什么意思', '旧站页面自己写明了编号，且在当前数据库里唯一命中——可以自动对应，但仍建议抽查确认。'],
        ['review_required 是什么意思', '旧站页面没写编号、或编号/OE 命中多个产品（数据库里确实存在共享 OE）——必须人工裁决，程序不会自动绑定。'],
        ['怎么填', '在「人工确认 Bowen No.」「人工确认 product_id」「是否可用于英文站」「备注」四列填写（黄色=手填，绿色=下拉）。填完放回 review/ 并告知。'],
        ['颜色约定', '🔵 表头（别动）｜🟡 手工填写｜🟢 下拉选择｜🔴 auto_match 状态（重点核对）'],
        ['统计', `旧站产品详情页 ${legacy.products.length} 个；产品图片 ${rows.length} 张；自动匹配 ${rows.filter((r) => r.reuse_status === 'auto_match').length} 张；需人工确认 ${rows.filter((r) => r.reuse_status === 'review_required').length} 张。`],
        ['重要', '本阶段只做匹配建议，**不会**替换任何网页内容，也**不会**修改现有 Prototype。'],
      ],
    },
    {
      name: '图片匹配审核',
      title: `旧站产品图片匹配审核（${rows.length} 张，自动匹配 ${rows.filter((r) => r.reuse_status === 'auto_match').length} / 待确认 ${rows.filter((r) => r.reuse_status === 'review_required').length}）`,
      notes: ['「是否可用于英文站」有下拉菜单。程序未自动绑定任何不确定的图片。'],
      freeze: { row: 3, col: 3 },
      autoFilter: true,
      columns: [
        { title: '旧站页面ID', width: 11 },
        { title: '旧站页面URL', width: 44 },
        { title: '旧站产品名(中文)', width: 20 },
        { title: '旧站博文编号', width: 16 },
        { title: '旧站OEM号码', width: 30 },
        { title: '旧站适用车型', width: 30 },
        { title: '图片URL', width: 52 },
        { title: '本地文件', width: 40 },
        { title: '图片尺寸', width: 12 },
        { title: '匹配方式', width: 22 },
        { title: '建议Bowen No.', width: 15 },
        { title: '建议product_id', width: 16 },
        { title: '建议产品英文名', width: 26 },
        { title: '建议产品类型', width: 20 },
        { title: '当前复用状态', width: 17 },
        { title: '判定依据', width: 56 },
        { title: '人工确认Bowen No.', width: 18, style: STYLE.MANUAL },
        { title: '人工确认product_id', width: 18, style: STYLE.MANUAL },
        { title: '是否可用于英文站', width: 18, style: STYLE.MANUAL_LIST },
        { title: '备注', width: 30, style: STYLE.MANUAL },
      ],
      rows: detailRows,
      validations: [
        { sqref: `S4:S${3 + detailRows.length + 200}`, values: USABLE_OPTS, promptTitle: '是否可用于英文站', prompt: '请选择该图片在英文站的使用结论' },
      ],
    },
    {
      name: '按旧站页面汇总',
      title: `按旧站产品详情页汇总（${pageSummaries.length} 个页面）`,
      freeze: { row: 2, col: 2 },
      autoFilter: true,
      columns: [
        { title: '旧站页面ID', width: 11 },
        { title: '旧站页面URL', width: 44 },
        { title: '旧站产品名(中文)', width: 20 },
        { title: '旧站博文编号', width: 16 },
        { title: '旧站OEM号码', width: 34 },
        { title: '图片数', width: 9 },
        { title: '匹配方式', width: 22 },
        { title: '匹配Bowen No.', width: 15 },
        { title: '匹配product_id', width: 16 },
        { title: '匹配产品英文名', width: 26 },
        { title: '复用状态', width: 17 },
        { title: '判定依据', width: 56 },
        { title: '人工裁决', width: 20, style: STYLE.MANUAL },
        { title: '备注', width: 30, style: STYLE.MANUAL },
      ],
      rows: summaryRows,
    },
    {
      name: '无编号页面',
      title: `旧站无任何编号信息的页面（${noDataPages.length} 个）— 无法可靠对应，必须人工确认`,
      notes: ['这些页面只有详情图与中文标题，没有「博文编号」也没有 OEM 号码。按铁律不得自动绑定。'],
      freeze: { row: 3, col: 0 },
      autoFilter: true,
      columns: [
        { title: '旧站页面ID', width: 11 },
        { title: '旧站页面URL', width: 44 },
        { title: '旧站产品名(中文)', width: 20 },
        { title: '发布时间', width: 13 },
        { title: '详情图片数', width: 11 },
        { title: '首张图片URL', width: 56 },
        { title: '人工确认Bowen No.', width: 20, style: STYLE.MANUAL },
        { title: '人工确认product_id', width: 20, style: STYLE.MANUAL },
        { title: '备注', width: 30, style: STYLE.MANUAL },
      ],
      rows: noDataPages.map((p) => [
        p.legacy_page_id, p.source_url, p.product_name_zh || '', p.published_at || '',
        p.detail_image_urls.length, p.detail_image_urls[0] || '', '', '', '',
      ]),
    },
  ]);

  console.log(`review/legacy-product-image-mapping.xlsx — ${rows.length} 张图片 / ${pageSummaries.length} 个页面 / ${noDataPages.length} 个无编号页面`);
}

main();
