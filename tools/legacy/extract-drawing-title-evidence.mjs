/**
 * 旧站产品图 → Bowen No. 补充证据：正文图纸文件名
 * ===========================================================================
 * 背景（为什么需要这一步）
 * ---------------------------------------------------------------------------
 * Phase 3.5（`tools/legacy/match-legacy-product-images.mjs`）只依据**页面可见文本**
 * 匹配产品：旧站规格表里的「博文编号」、OEM 号码、产品标题。
 * 因此有 **520 张**产品图被判为 `review_required`，理由是
 * 「旧站页面未提供任何可核对的编号（无规格表），不得自动绑定」。
 *
 * 但旧站产品详情页的正文里还有一条**结构化证据被漏掉了**：
 * 详情图的 HTML 自带 `title` 属性，取值是**上传时的原始文件名**，
 * 而公司自己就是用产品编号来命名这些图纸的，例如：
 *
 *     <img src="/upload/image/20240402/17120219713778547.jpg" title="4004.jpg">
 *                                                              ^^^^^^^^^^  → Bowen 4004
 *
 * 本脚本把这条证据抽出来，为 `review_required` 的图片**预填候选 Bowen No.**。
 *
 * ⚠️ 定位（务必理解）
 * ---------------------------------------------------------------------------
 * 这不是「自动绑定」。文件名是**间接证据**，与「页面写明博文编号」不是一个强度。
 * 因此本脚本输出的是**候选值 + 交叉校验结果**，最终仍由人工在 XLSX 里确认。
 * 项目的铁律「无证据不绑定」继续有效——这里只是把证据补上，降低人工工作量。
 *
 * 交叉校验（本脚本会强制执行并报告）
 * ---------------------------------------------------------------------------
 * 对每一条候选，同时给出：
 *   1. 该编号在冻结产品库里的 `product_type`
 *   2. 旧站面包屑/标题给出的中文品类
 *   3. 两者是否一致
 * 若出现不一致，该行会被标记为 `category_conflict`，**不进入候选**。
 *
 * 输入（全部已存在，本脚本不联网）
 * ---------------------------------------------------------------------------
 *   data/legacy-site/crawl/html/content_*.html   旧站缓存页面（Phase 3.5 抓取结果）
 *   data/legacy-site/product-image-matching.json Phase 3.5 的匹配结论
 *   website/src/data/products.json               冻结产品库
 *   website/src/data/oe-index.json               冻结 OE 索引
 *
 * 输出
 * ---------------------------------------------------------------------------
 *   data/legacy-site/drawing-title-evidence.json            证据与统计（可 diff 审阅）
 *   review/legacy-product-image-mapping-candidates.xlsx     人工确认补充表
 *
 * 注意：**不覆盖** Phase 3.5 的 `review/legacy-product-image-mapping.xlsx`。
 *       本文件是它的补充，两表可并列使用。
 *
 * 运行：node tools/legacy/extract-drawing-title-evidence.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeXlsx, STYLE } from '../lib/xlsx-writer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const CRAWL_HTML = path.join(ROOT, 'data', 'legacy-site', 'crawl', 'html');
const MATCHING = path.join(ROOT, 'data', 'legacy-site', 'product-image-matching.json');
const EVIDENCE_OUT = path.join(ROOT, 'data', 'legacy-site', 'drawing-title-evidence.json');
const REVIEW_OUT = path.join(ROOT, 'review', 'legacy-product-image-mapping-candidates.xlsx');

const PRODUCTS = path.join(ROOT, 'website', 'src', 'data', 'products.json');
const OE_INDEX = path.join(ROOT, 'website', 'src', 'data', 'oe-index.json');

/** 旧站中文品类 → 冻结产品库的 product_type */
const CN_CATEGORY_TO_TYPE = {
  节温器: 'Thermostat',
  热敏开关: 'ThermalSwitch',
  刹车灯开关: 'BrakeLightSwitch',
  倒车灯开关: 'ReverseLightSwitch',
  水温度传感器: 'TemperatureSensor',
  机油压力报警器: 'OilPressureWarningSwitch',
};

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const products = readJson(PRODUCTS);
const oeIndex = readJson(OE_INDEX);
const matching = readJson(MATCHING);

const byBowen = new Map();
for (const p of products) byBowen.set(String(p.bowen_no), p);

const oeSet = new Set();
for (const o of oeIndex) oeSet.add(String(o.oe_normalized));

// ---------------------------------------------------------------------------
// 抽取：详情图的 title 属性
// ---------------------------------------------------------------------------
const DRAWING_IMG_RE = /<img\s+src="(\/upload\/image\/[^"]+)"\s+title="([^"]*)"/gi;
const H1_RE = /<h1 class="title3"><i><\/i>([^<]*)<\/h1>/i;

/** 从文件名里取产品编号：允许「31054 (2)」「3816高温」「3655-2」「3831A」等写法 */
function splitTitle(title) {
  const stem = String(title || '').replace(/\.(jpe?g|png|gif|webp)$/i, '').trim();
  const numeric = (stem.match(/^\d+/) || [''])[0];
  return { stem, numeric };
}

const pages = [];
for (const f of fs.readdirSync(CRAWL_HTML)) {
  const m = /^content_(\d+)\.html$/.exec(f);
  if (!m) continue;
  const pageId = Number(m[1]);
  const html = fs.readFileSync(path.join(CRAWL_HTML, f), 'utf8');

  let drawing = null;
  DRAWING_IMG_RE.lastIndex = 0;
  const dm = DRAWING_IMG_RE.exec(html);
  if (dm) drawing = { image_url: dm[1], title: dm[2] };

  pages.push({
    page_id: pageId,
    cn_category: (html.match(H1_RE) || [, ''])[1].trim(),
    drawing,
  });
}

// ---------------------------------------------------------------------------
// 匹配 + 交叉校验
// ---------------------------------------------------------------------------
function resolvePage(page) {
  const out = {
    page_id: page.page_id,
    cn_category: page.cn_category || '',
    drawing_title: page.drawing ? page.drawing.title : '',
    drawing_image_url: page.drawing ? page.drawing.image_url : '',
    numeric: '',
    resolved_bowen_no: '',
    resolved_product_id: '',
    db_product_type: '',
    db_product_name_en: '',
    evidence_kind: 'none',
    category_check: '',
    status: 'no_evidence',
  };

  if (!page.drawing) return out;

  const { stem, numeric } = splitTitle(page.drawing.title);
  out.numeric = numeric;

  const candidates = [];
  if (numeric && byBowen.has(numeric)) candidates.push({ no: numeric, kind: 'bowen_exact' });
  if (stem && byBowen.has(stem)) candidates.push({ no: stem, kind: 'bowen_variant' });

  if (!candidates.length) {
    // 文件名可能是 OE 而不是 Bowen —— 记录下来，但不给候选
    if (numeric && oeSet.has(numeric)) {
      out.evidence_kind = 'oe_in_index';
      out.status = 'oe_only';
    } else {
      out.evidence_kind = 'not_in_database';
      out.status = 'not_in_database';
    }
    return out;
  }

  const hit = candidates[0];
  const p = byBowen.get(hit.no);

  out.resolved_bowen_no = hit.no;
  out.resolved_product_id = p.product_id;
  out.db_product_type = p.product_type || '';
  out.db_product_name_en = p.product_name_en || '';
  out.evidence_kind = hit.kind;

  const expected = CN_CATEGORY_TO_TYPE[out.cn_category];
  if (expected && p.product_type) {
    const ok = expected === p.product_type;
    out.category_check = ok ? 'agree' : 'conflict';
    out.status = ok ? 'candidate' : 'category_conflict';
  } else {
    out.category_check = 'not_checkable';
    out.status = 'candidate';
  }

  return out;
}

const pageResults = pages.filter((p) => p.drawing).map(resolvePage);
const byPage = new Map(pageResults.map((r) => [r.page_id, r]));

// ---------------------------------------------------------------------------
// 汇总到 Phase 3.5 的 review_required 图片行
// ---------------------------------------------------------------------------
const reviewRows = matching.image_rows.filter((r) => r.reuse_status === 'review_required');

const enriched = reviewRows.map((r) => {
  const pageId = Number(r.legacy_page_id);
  const ev = byPage.get(pageId);
  const usable = ev && ev.status === 'candidate';
  return {
    legacy_page_id: pageId,
    source_url: r.source_url,
    product_name_zh: r.product_name_zh || '',
    image_url: r.image_url,
    local_file: r.local_file || '',
    image_size: r.image_size || '',
    drawing_title: ev ? ev.drawing_title : '',
    candidate_bowen_no: usable ? ev.resolved_bowen_no : '',
    candidate_product_id: usable ? ev.resolved_product_id : '',
    candidate_product_name_en: usable ? ev.db_product_name_en : '',
    candidate_product_type: usable ? ev.db_product_type : '',
    evidence_kind: ev ? ev.evidence_kind : 'none',
    category_check: ev ? ev.category_check : '',
    status: ev ? ev.status : 'no_evidence',
    phase35_reason: r.reason || '',
  };
});

const withCandidate = enriched.filter((r) => r.candidate_bowen_no);
const withoutCandidate = enriched.filter((r) => !r.candidate_bowen_no);

const stats = {
  drawing_pages: pageResults.length,
  pages_candidate: pageResults.filter((r) => r.status === 'candidate').length,
  pages_category_conflict: pageResults.filter((r) => r.status === 'category_conflict').length,
  pages_not_in_database: pageResults.filter((r) => r.status === 'not_in_database').length,
  pages_oe_only: pageResults.filter((r) => r.status === 'oe_only').length,
  review_required_images: reviewRows.length,
  review_images_with_candidate: withCandidate.length,
  review_images_still_without: withoutCandidate.length,
};

assert(stats.pages_category_conflict === 0, '出现品类冲突，必须先人工裁决，不得产出候选');

// ---------------------------------------------------------------------------
// 输出 JSON
// ---------------------------------------------------------------------------
fs.writeFileSync(
  EVIDENCE_OUT,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      method: '旧站产品详情页正文图的 title 属性（= 上传原始文件名）→ 产品编号',
      caveat: '文件名是间接证据，候选值须人工在 XLSX 中确认后方可绑定；本脚本不做自动绑定。',
      inputs: {
        crawl_html: 'data/legacy-site/crawl/html/content_*.html',
        matching: 'data/legacy-site/product-image-matching.json',
        products: 'website/src/data/products.json',
        oe_index: 'website/src/data/oe-index.json',
      },
      stats,
      pages: pageResults,
      review_rows: enriched,
    },
    null,
    2,
  ),
  'utf8',
);

// ---------------------------------------------------------------------------
// 输出 XLSX（供业务方确认）
// ---------------------------------------------------------------------------
const noteRows = [
  ['这个文件是做什么的', 'Phase 3.5 里有 520 张旧站产品图被判为「待人工确认」，原因是旧站页面没有可核对的编号。本表用一条被漏掉的证据帮业务方把它们预先填好候选值。'],
  ['补充的证据是什么', '旧站产品详情页正文图的 HTML 自带 title 属性，内容是上传时的原始文件名，公司用产品编号命名图纸，例如 title="4004.jpg" → 博文编号 4004。'],
  ['为什么 Phase 3.5 没用它', 'Phase 3.5 只依据页面可见文本（规格表博文编号 / OEM / 标题）匹配，未使用图片自身的 title 属性。'],
  ['可靠性如何', `已对每一条候选做品类交叉校验：候选编号在冻结产品库里的 product_type，必须与旧站中文品类一致。本次共校验 ${stats.pages_candidate} 条，冲突 ${stats.pages_category_conflict} 条。`],
  ['这是自动绑定吗', '不是。文件名属于间接证据，强度低于「页面写明博文编号」。候选值仅用于把人工工作从「猜测」变成「确认」，仍需业务方在黄色列确认。'],
  ['怎么填', '在「人工确认 Bowen No.」「是否采用候选」「备注」三列填写（黄色=手填，绿色=下拉）。填完放回 review/ 并告知。'],
  ['与另一张表的关系', '本表是 review/legacy-product-image-mapping.xlsx 的补充，不覆盖它。两表都只覆盖 review_required 的图片。'],
  ['仍然没有候选的图', `${stats.review_images_still_without} 张：旧站文件名既不是产品编号、也不在冻结产品库里，需要业务方判断是停产件还是产品表漏登。`],
];

const candidateRows = withCandidate.map((r) => [
  r.legacy_page_id,
  r.source_url,
  r.product_name_zh,
  r.image_url,
  r.local_file,
  r.image_size,
  r.drawing_title,
  r.candidate_bowen_no,
  r.candidate_product_id,
  r.candidate_product_name_en,
  r.candidate_product_type,
  r.category_check,
  r.evidence_kind,
  '',   // 人工确认 Bowen No.
  '',   // 是否采用候选（下拉）
  '',   // 备注
].map((v, i) => {
  if (i === 13 || i === 15) return { v, style: STYLE.MANUAL };
  if (i === 14) return { v, style: STYLE.MANUAL_LIST };
  if (i === 11) return { v, style: v === 'agree' ? STYLE.BODY : STYLE.WARN };
  return { v };
}));

const unresolvedRows = withoutCandidate.map((r) => [
  r.legacy_page_id,
  r.source_url,
  r.product_name_zh,
  r.image_url,
  r.local_file,
  r.drawing_title,
  r.status,
  r.evidence_kind,
  r.phase35_reason,
  '',   // 人工判断
  '',   // 备注
].map((v, i) => {
  if (i === 9 || i === 10) return { v, style: STYLE.MANUAL };
  return { v };
}));

writeXlsx(REVIEW_OUT, [
  {
    name: '填表说明',
    title: '旧站产品图 → Bowen No. 补充证据表（填表说明）',
    autoFilter: false,
    columns: [{ title: '项目', width: 30 }, { title: '说明', width: 110 }],
    rows: noteRows,
  },
  {
    name: '有候选（待确认）',
    title: `有候选编号的图片 — ${withCandidate.length} 张（黄色列由业务方确认）`,
    autoFilter: true,
    columns: [
      { title: '旧站页面ID', width: 11 },
      { title: '页面URL', width: 42 },
      { title: '旧站品类', width: 14 },
      { title: '图片URL', width: 58 },
      { title: '本地文件', width: 42 },
      { title: '尺寸', width: 11 },
      { title: '图纸文件名(证据)', width: 20 },
      { title: '候选 Bowen No.', width: 15 },
      { title: '候选 product_id', width: 15 },
      { title: '候选产品英文名', width: 30 },
      { title: '产品类型', width: 24 },
      { title: '品类校验', width: 11 },
      { title: '证据类型', width: 15 },
      { title: '人工确认 Bowen No.', width: 20 },
      { title: '是否采用候选', width: 16 },
      { title: '备注', width: 30 },
    ],
    rows: candidateRows,
  },
  {
    name: '无候选（需排查）',
    title: `没有候选编号的图片 — ${withoutCandidate.length} 张（需业务方判断）`,
    autoFilter: true,
    columns: [
      { title: '旧站页面ID', width: 11 },
      { title: '页面URL', width: 42 },
      { title: '旧站品类', width: 14 },
      { title: '图片URL', width: 58 },
      { title: '本地文件', width: 42 },
      { title: '图纸文件名', width: 22 },
      { title: '状态', width: 18 },
      { title: '证据类型', width: 18 },
      { title: 'Phase 3.5 原判定理由', width: 46 },
      { title: '人工判断', width: 24 },
      { title: '备注', width: 30 },
    ],
    rows: unresolvedRows,
  },
]);

console.log('drawing-title evidence extracted');
console.log(`  pages with drawing title : ${stats.drawing_pages}`);
console.log(`  resolved to a candidate  : ${stats.pages_candidate}`);
console.log(`  category conflicts       : ${stats.pages_category_conflict}`);
console.log(`  not in database          : ${stats.pages_not_in_database}`);
console.log(`  OE in index (no bowen)   : ${stats.pages_oe_only}`);
console.log(`  review_required images   : ${stats.review_required_images}`);
console.log(`    now with a candidate   : ${stats.review_images_with_candidate}`);
console.log(`    still without          : ${stats.review_images_still_without}`);
console.log(`\n${path.relative(ROOT, EVIDENCE_OUT)}`);
console.log(`${path.relative(ROOT, REVIEW_OUT)}`);

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n✗ ${msg}`);
    process.exit(1);
  }
}
