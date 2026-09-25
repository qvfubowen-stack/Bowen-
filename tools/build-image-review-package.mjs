#!/usr/bin/env node
/**
 * Phase 2.7 — 图片人工复核包
 * ===========================================================================
 * 目的：把 product-image-map.json 里 26 张 review_required + 5 张 unresolved
 *       整理成业务方可以直接看的复核包（Markdown + 缩略图联系表 + 可浏览 HTML）。
 *
 * 铁律（写死在代码里）：
 *   1. **只读** product-image-map.json，绝不修改其中的 mapping_status / bowen_no / product_id。
 *      脚本运行前后会对该文件做 SHA-256 校验，一旦变化立即报错。
 *   2. unresolved 记录**不得**输出任何 Bowen No. 或 product_id（保持 null）。
 *   3. 不修改 website/，不重建网站 ZIP。
 *
 * 用法：node tools/build-image-review-package.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Workbook, numToCol } from './xlsx-reader.mjs';
import { startStaticServer } from './lib/static-server.mjs';
import { renderUrlToPng } from './lib/cdp-render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_EXCEL = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const MAP_PATH = path.join(ROOT, 'data/processed/product-image-map.json');
const PROCESSED = path.join(ROOT, 'data/processed');
const OUT_DIR = path.join(PROCESSED, 'product-image-review');
const OUT_IMAGES = path.join(OUT_DIR, 'images');
const DOC_PATH = path.join(ROOT, 'docs/product-image-review-needed.md');

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// 待业务方决定是否入库的编号（要求 5）
const BOWEN_AWAITING_DB_DECISION = ['38169', '38298', '3932', '32603', '32748-1'];

const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- 前置校验
log('=== Phase 2.7 图片人工复核包 ===');
const mapHashBefore = sha256(MAP_PATH);
const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

const reviewRequired = map.images.filter((i) => i.mapping_status === 'review_required');
const unresolved = map.images.filter((i) => i.mapping_status === 'unresolved');
const pending = [...reviewRequired, ...unresolved];

log(`product-image-map.json SHA-256: ${mapHashBefore.slice(0, 16)}…`);
log(`review_required ${reviewRequired.length} 张 / unresolved ${unresolved.length} 张 / 合计 ${pending.length} 张`);

if (reviewRequired.length !== 26 || unresolved.length !== 5) {
  console.error(`FATAL 数量与预期不符（期望 26 + 5），请先确认 product-image-map.json 是否被改动`);
  process.exit(2);
}

// 硬校验：unresolved 不得带 bowen_no / product_id
const badUnresolved = unresolved.filter((i) => i.bowen_no || i.product_id);
if (badUnresolved.length) {
  console.error(`FATAL 有 ${badUnresolved.length} 张 unresolved 带了 bowen_no/product_id，违反"不猜"原则`);
  process.exit(2);
}

// ---------------------------------------------------------------- 读取原表上下文
const wb = new Workbook(RAW_EXCEL);
const sheetByName = new Map(wb.sheets.map((s) => [s.name, s]));
const sheetRowCells = new Map(); // sheet -> Map<row, Map<col, value>>
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const byRow = new Map();
  for (const c of sh.cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c.value);
  }
  sheetRowCells.set(s.name, byRow);
}

/** 记录该行在原表里的原文（OE / 车型 / 该区块的 Bowen 单元格） */
function sourceContext(rec) {
  const byRow = sheetRowCells.get(rec.source_sheet);
  const row = rec.source_row ?? rec.anchor_row;
  if (!byRow || row == null) return { available: false };
  const cells = byRow.get(row);
  if (!cells) return { available: false };
  const bowenCol = rec.block_bowen_col;
  const bowenRaw = bowenCol != null ? cells.get(bowenCol) : undefined;
  // 取该行所有非空文本，便于人工判断
  const all = [...cells.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([col, v]) => `${numToCol(col)}: ${String(v).replace(/[\r\n]+/g, ' / ').trim()}`);
  return {
    available: true,
    row,
    bowen_cell: bowenCol != null ? `${numToCol(bowenCol)}${row}` : null,
    bowen_raw: bowenRaw != null ? String(bowenRaw).replace(/[\r\n]+/g, ' ').trim() : null,
    row_cells: all,
  };
}

// ---------------------------------------------------------------- 原因分类与决策建议
const REASON_TEXT = {
  record_row_bowen_unreadable:
    '锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号'
    + '（例如写着"无小管""芯子编号：31052"这类说明文字）。',
  record_row_without_bowen:
    '锚点所在行是一条产品记录行，但该行没有填写「博文编号」。',
  bowen_not_in_database:
    '从该行的「博文编号」单元格读到了编号，但数据库里没有对应产品'
    + '（这些行属于辅助表《工作表1》中的孤立编号行，Phase 2.5 未纳入产品库）。',
  anchor_outside_record_blocks:
    '图片锚点所在列不在该工作表的任何产品记录区块内，无法判断它属于哪条记录。',
  sheet_has_no_product_table:
    '该工作表整体没有产品表结构（只有零散单元格），无法判断图片归属。',
};

const DECISION_TEXT = {
  record_row_bowen_unreadable:
    '请打开该图片与对应工作表行，人工补上正确的 Bowen No.（或确认该行不是产品记录）。'
    + '补上后我们可以把图片归位到对应产品。',
  record_row_without_bowen:
    '请确认该行对应哪个产品的 Bowen No. 并补填；若该行本就不该有编号，请说明，我们将其标记为无需归属。',
  bowen_not_in_database:
    '请确认该编号是否应作为正式产品补入数据库（见本文档第 4 节）。'
    + '确认补入后，图片会自动归位；确认不补入则保持现状。',
  anchor_outside_record_blocks:
    '请人工看图，判断这张图属于哪个 Bowen 产品；若判断不出，请确认是否应删除该图或忽略。'
    + '**程序不会猜。**',
  sheet_has_no_product_table:
    '请人工看图，判断这张图原本属于哪个产品（很可能是被误贴到空表上）；'
    + '若无法判断，请确认是否应删除或忽略。**程序不会猜。**',
};

// ---------------------------------------------------------------- 图片内容观察
/**
 * 这 5 条是人工逐张看过图之后写下的**观察记录**，不是程序推断。
 * 之所以必须写进来：其中 2 张根本不是产品照片（一个是内部系统页面截图、
 * 一个是手机截图），而且那张系统截图里**含有内部进价/售价**。
 * 这类信息必须让业务方知道，否则将来图片一旦接入网站会造成价格泄漏。
 *
 * 注意：这里只描述"图上能看到什么"，**不给任何 Bowen 归属结论**（不猜）。
 */
const IMAGE_OBSERVATIONS = {
  'IMG-0723': {
    what: '不是产品照片：这是一张**内部系统产品页面的截图**。左侧是节温器产品照，右侧是字段表。',
    visible: [
      '名称：节温器（MR479Q、MR479QA、MR481QA、08CK-1;2LG-1;CK-1 等一长串机型代码）',
      '零件号：**1106013088**',
      '**进价：15**',
      '**售价：19.5**',
      '车型：08CK-1;2LG-1;CK-1;CK-1C;CK-1D;CK-1F;GC3;GX2… 等一长串',
      '底部按钮：提交求购 / 发布促销 / 记录配件',
    ],
    risk: '**高风险**：图中含**内部进价与售价**。这张图**绝对不可以**出现在对外网站上，'
      + '也不能原样交给客户。建议只把它当作内部线索，另外提供干净的产品照。',
    size: '1030 × 386 px',
  },
  'IMG-0780': {
    what: '不是纯净产品照：这是一张**手机截图**（顶部有状态栏、底部有相册"1/1"与返回按钮），'
      + '中间嵌着一张节温器总成照片（带第三方水印）。',
    visible: [
      '顶部状态栏：17:09、电池 85%、信号图标',
      '中间：黑色塑料节温器总成产品照（带水印）',
      '底部：相册进度"1/1"、圆形返回按钮',
    ],
    risk: '中风险：含手机界面元素与水印，**直接用于网站会显得不专业**。'
      + '若确认这张产品可用，需要先裁剪掉界面部分并处理水印。',
    size: '1080 × 2392 px',
  },
  'IMG-0787': {
    what: '是干净的产品照片：金属节温器（单只，白底+浅灰背景，棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '低风险：图片本身干净，可用。缺的只是"它属于哪个 Bowen 产品"。',
    size: '1280 × 1280 px',
  },
  'IMG-0797': {
    what: '是干净的产品照片：黑色塑料节温器总成 / 壳体（带管口，浅色背景棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '低风险：图片本身干净，可用。缺的只是"它属于哪个 Bowen 产品"。',
    size: '1280 × 1280 px',
  },
  'IMG-0798': {
    what: '是干净的产品照片：黑色塑料节温器壳体（正面法兰视角，浅色背景棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '低风险：图片本身干净，可用。缺的只是"它属于哪个 Bowen 产品"。',
    size: '1280 × 1280 px',
  },
};

/**
 * 26 张 review_required 的**图片质量目视观察**（看整张联系表得出，非逐像素检测）。
 * 只描述看到的形态，不给任何归属结论。
 */
const REVIEW_QUALITY_NOTE = `从联系表目视可见，这 26 张图**质量参差**，大致分两类：

| 形态 | 说明 | 能否直接用于网站 |
|---|---|---|
| **棚拍产品照（较多）** | 白底 / 浅灰底、构图规整的节温器或传感器产品照 | 构图可用，但**多数带第三方品牌水印「GXN」**，少数带本项目的「BW」水印 —— 水印必须先处理 |
| **随手拍的实物照（部分）** | 例如 \`IMG-0793\`（1080 × 1920）是把节温器放在一张纸上、背后是键盘的随手拍 | 不适合直接对外使用，建议只作内部识别线索 |

> **说明**：以上是**人看联系表得出的观察**，不是程序对图片内容的判定。
> 水印的准确张数需要逐张确认。

**这带来一个独立于「归属」的问题**：即使某张图的 Bowen 归属确认了，
**它能不能直接用在网站上仍然是另一个决定**（水印、构图、清晰度）。

`;


fs.mkdirSync(OUT_IMAGES, { recursive: true });

const records = pending.map((rec) => {
  const ctx = sourceContext(rec);
  const srcFile = rec.image_file ? path.join(PROCESSED, rec.image_file) : null;
  let copyPath = null;
  let copyBytes = null;
  if (srcFile && fs.existsSync(srcFile)) {
    const ext = path.extname(srcFile);
    const copyName = `${rec.image_id}_${path.basename(srcFile, ext)}${ext}`;
    const dest = path.join(OUT_IMAGES, copyName);
    fs.copyFileSync(srcFile, dest);
    copyPath = `images/${copyName}`;
    copyBytes = fs.statSync(dest).size;
  }
  return {
    ...rec,
    __context: ctx,
    __copy: copyPath,
    __copy_bytes: copyBytes,
    __reason: REASON_TEXT[rec.match_kind] ?? rec.match_kind,
    __decision: DECISION_TEXT[rec.match_kind] ?? '请人工确认。',
  };
});

const byKind = (k) => records.filter((r) => r.match_kind === k);
const groupReview = records.filter((r) => r.mapping_status === 'review_required');
const groupUnresolved = records.filter((r) => r.mapping_status === 'unresolved');

log(`已复制 ${records.filter((r) => r.__copy).length} 张图片到 product-image-review/images/`);

// ---------------------------------------------------------------- 生成联系表 HTML
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATUS_LABEL = {
  review_required: '需人工确认',
  unresolved: '无法映射（不猜）',
};
const KIND_LABEL = {
  record_row_bowen_unreadable: '编号读不出',
  record_row_without_bowen: '该行未填编号',
  bowen_not_in_database: '编号不在库',
  anchor_outside_record_blocks: '锚点在记录区块外',
  sheet_has_no_product_table: '该表无产品表结构',
};

function card(r, idx) {
  const bowen = r.mapping_status === 'unresolved'
    ? '<span class="none">（不猜）</span>'
    : (r.bowen_no ? esc(r.bowen_no) : '<span class="none">（空）</span>');
  const pid = r.mapping_status === 'unresolved'
    ? '<span class="none">（不猜）</span>'
    : (r.product_id ? esc(r.product_id) : '<span class="none">（空）</span>');
  const ctxLine = r.__context?.bowen_raw
    ? `<div class="ctx"><b>原表 Bowen 单元格 ${esc(r.__context.bowen_cell)}：</b>${esc(r.__context.bowen_raw)}</div>`
    : '';
  const obs = IMAGE_OBSERVATIONS[r.image_id];
  const obsLine = obs && obs.risk.includes('高风险')
    ? `<div class="note">⚠️ 该图<strong>含内部价格信息</strong>，不可对外发布。见复核清单。</div>`
    : '';
  return `
  <figure class="card">
    <div class="thumb"><img src="${esc(r.__copy ?? r.image_file)}" alt="${esc(r.image_id)}" loading="eager"></div>
    <figcaption>
      <div class="head">
        <span class="id">#${idx} ${esc(r.image_id)}</span>
        <span class="badge ${r.mapping_status === 'unresolved' ? 'bg-none' : 'bg-warn'}">${esc(KIND_LABEL[r.match_kind] ?? r.match_kind)}</span>
      </div>
      <dl>
        <div><dt>工作表</dt><dd>${esc(r.source_sheet)}</dd></div>
        <div><dt>锚点</dt><dd>${esc(r.anchor_cell ?? '—')}</dd></div>
        <div><dt>行号</dt><dd>${r.source_row ?? '—'}</dd></div>
        <div><dt>Bowen No.</dt><dd class="mono">${bowen}</dd></div>
        <div><dt>product_id</dt><dd class="mono">${pid}</dd></div>
      </dl>
      ${ctxLine}
      ${obsLine}
      <div class="decision"><b>需要业务方决定：</b>${esc(r.__decision)}</div>
    </figcaption>
  </figure>`;
}

function sheetHtml(title, subtitle, list) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px 32px 40px; background: #f5f8fa;
         font-family: 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', system-ui, sans-serif; color: #0f1720; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  .sub { font-size: 14px; color: #4a5a6a; margin: 0 0 6px; max-width: 1100px; }
  .count { display: inline-block; font-size: 13px; font-weight: 700; color: #b45309;
           background: #fffbeb; border: 1px solid #fcd9a4; border-radius: 999px; padding: 3px 12px; margin-top: 8px; }
  /* 用 auto-fill + minmax：列宽稳定，且 430px 起能让缩略图与文字都足够清楚 */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 18px; margin-top: 20px; }
  .card { margin: 0; min-width: 0; background: #fff; border: 1px solid #d8e0e7; border-radius: 10px; overflow: hidden; }
  .thumb { height: 260px; display: grid; place-items: center; background: #fbfdfe; border-bottom: 1px solid #eaeff3; padding: 10px; }
  .thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
  figcaption { padding: 12px 14px 14px; min-width: 0; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .id { font-family: Consolas, monospace; font-size: 13px; font-weight: 700; }
  .badge { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  .bg-warn { background: #fffbeb; color: #b45309; border: 1px solid #fcd9a4; }
  .bg-none { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; margin: 0 0 10px; font-size: 12.5px; }
  dl > div { display: contents; }
  dt { color: #6b7c8c; }
  dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .mono { font-family: Consolas, monospace; }
  .none { color: #b91c1c; font-weight: 500; }
  .ctx { font-size: 12px; color: #33414f; background: #f2f7fb; border: 1px solid #e3edf6;
         border-radius: 6px; padding: 7px 9px; margin-bottom: 8px; line-height: 1.5; overflow-wrap: anywhere; }
  .decision { font-size: 11.5px; color: #4a5a6a; line-height: 1.55; border-top: 1px dashed #d8e0e7; padding-top: 8px; overflow-wrap: anywhere; }
  .decision b { color: #102a43; }
  .note { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 6px; padding: 7px 9px; margin-bottom: 8px; line-height: 1.5; overflow-wrap: anywhere; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(subtitle)}</p>
  <span class="count">共 ${list.length} 张</span>
  <div class="grid">${list.map((r, i) => card(r, i + 1)).join('')}</div>
</body></html>`;
}

// 三个联系表：需确认 / 无法映射 / 全部
const sheets = [
  { key: 'contact-sheet-review-required', title: '缩略图联系表 — 需人工确认（review_required）',
    subtitle: '下列图片能确定属于哪一行，但不能确定属于哪个产品。图片文件名与序号对应本表编号。',
    list: groupReview },
  { key: 'contact-sheet-unresolved', title: '缩略图联系表 — 无法映射（unresolved）',
    subtitle: '下列图片的程序判定为无法可靠关联。按"不猜"原则，Bowen No. 与 product_id 一律留空，请人工看图判断。',
    list: groupUnresolved },
  { key: 'contact-sheet-all-31', title: '缩略图联系表 — 全部待处理（31 张）',
    subtitle: '需人工确认 26 张 + 无法映射 5 张。上半部分为需确认，下半部分为无法映射。',
    list: records },
];

// ---------------------------------------------------------------- 渲染 PNG
const server = await startStaticServer(PROCESSED);
log(`\n临时静态服务器：${server.origin}`);

try {
  for (const s of sheets) {
    const htmlPath = path.join(OUT_DIR, `${s.key}.html`);
    fs.writeFileSync(htmlPath, sheetHtml(s.title, s.subtitle, s.list), 'utf8');
    const url = `${server.origin}/product-image-review/${s.key}.html`;
    const { png, width, height, imagesTotal, imagesLoaded } = await renderUrlToPng(url, {
      width: 1500, maxHeight: 20000, settleMs: 1500,
    });
    const pngPath = path.join(OUT_DIR, `${s.key}.png`);
    fs.writeFileSync(pngPath, png);
    log(`  ${s.key}.png  ${width}x${height}  ${Math.round(png.length / 1024)} KB  `
      + `图片加载 ${imagesLoaded}/${imagesTotal}`);
  }

  // 可浏览的索引页
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), sheetHtml(
    '图片人工复核包 — 总览',
    '三份联系表：需人工确认（26）、无法映射（5）、全部（31）。也可以直接打开单个 HTML 页面逐张查看。',
    records,
  ), 'utf8');
} finally {
  await server.close();
}

// ---------------------------------------------------------------- 生成 Markdown
const fmtCell = (v) => (v == null || v === '' ? '—' : String(v).replace(/\|/g, '\\|'));

function tableFor(list, startIndex) {
  const head = '| # | image_id | 图片文件 | 工作表 | 锚点 | 行号 | Bowen No. | product_id | 状态 | 原因 |\n'
    + '|---|---|---|---|---|---|---|---|---|---|\n';
  const rows = list.map((r, i) => {
    const bowen = r.mapping_status === 'unresolved'
      ? '**（不猜）**'
      : (r.bowen_no ? `\`${r.bowen_no}\`` : '*（空）*');
    const pid = r.mapping_status === 'unresolved'
      ? '**（不猜）**'
      : (r.product_id ? `\`${r.product_id}\`` : '*（空）*');
    const kind = KIND_LABEL[r.match_kind] ?? r.match_kind;
    return `| ${startIndex + i} | \`${r.image_id}\` | \`${r.__copy ?? r.image_file}\` `
      + `| ${fmtCell(r.source_sheet)} | \`${fmtCell(r.anchor_cell)}\` | ${fmtCell(r.source_row)} `
      + `| ${bowen} | ${pid} | ${STATUS_LABEL[r.mapping_status]} | ${kind} |`;
  }).join('\n');
  return head + rows;
}

function detailFor(list, startIndex) {
  return list.map((r, i) => {
    const n = startIndex + i;
    const ctx = r.__context;
    const ctxLines = ctx?.available
      ? [
        ctx.bowen_cell ? `- 原表 Bowen 单元格 \`${ctx.bowen_cell}\` 的内容：${ctx.bowen_raw ? `\`${ctx.bowen_raw}\`` : '*（空）*'}` : null,
        ctx.row_cells?.length ? `- 该行原表内容：${ctx.row_cells.map((c) => `\`${c}\``).join('　')}` : null,
      ].filter(Boolean).join('\n')
      : '- 原表上下文：无法定位到具体行（锚点不在记录区块内）';

    const bowenLine = r.mapping_status === 'unresolved'
      ? '- **Bowen No.：不猜（留空）**\n- **product_id：不猜（留空）**'
      : `- Bowen No.：${r.bowen_no ? `\`${r.bowen_no}\`` : '*（空）*'}\n- product_id：${r.product_id ? `\`${r.product_id}\`` : '*（空）*'}`;

    // 区块信息是**结构性事实**（锚点落在哪个记录区块、该区块的编号列是哪一列），不是推断，
    // 但能帮人工快速判断"这张图应该属于左半区还是右半区的那条记录"。
    const blockLine = r.block_start_col != null
      ? `- 锚点所属记录区块：从第 ${r.block_start_col} 列（\`${numToCol(r.block_start_col)}\`）开始的区块；`
        + `该区块的「博文编号」列是 \`${r.block_bowen_col != null ? numToCol(r.block_bowen_col) : '?'}\``
      : '- 锚点不属于任何记录区块（该表没有可识别的产品表结构，或锚点列落在区块之外）';

    return `#### ${n}. \`${r.image_id}\` — ${KIND_LABEL[r.match_kind] ?? r.match_kind}

| 字段 | 值 |
|---|---|
| image_id | \`${r.image_id}\` |
| 图片文件（复核包内） | \`${r.__copy ?? r.image_file}\` |
| 图片文件（原始提取目录） | \`data/processed/${r.image_file}\` |
| 来源工作表 | ${fmtCell(r.source_sheet)} |
| 锚点单元格 | \`${fmtCell(r.anchor_cell)}\` |
| 锚点所在列 / 行 | ${fmtCell(r.anchor_col_letter)} / ${fmtCell(r.anchor_row)} |
| 关联到的记录行 | ${fmtCell(r.source_row)} |
| mapping_status | \`${r.mapping_status}\` |
| match_kind | \`${r.match_kind}\` |
| 源 media 部件 | \`${r.media_part}\` |
| 图片体积 | ${r.media_bytes != null ? `${(r.media_bytes / 1024).toFixed(0)} KB` : '—'} |

${bowenLine}
${blockLine}

**原因**：${r.__reason}

${ctxLines}

**需要业务方做的决定**：${r.__decision}

`;
  }).join('\n---\n\n');
}

const now = new Date().toISOString();
const totalCopyBytes = records.reduce((s, r) => s + (r.__copy_bytes ?? 0), 0);

const md = `# 产品图片人工复核清单（Phase 2.7）

**生成时间：${now}**
**数据来源：\`data/processed/product-image-map.json\`（SHA-256 \`${mapHashBefore}\`）**
**复核包目录：\`data/processed/product-image-review/\`**

> 本清单**只做整理，不改任何状态**。\`product-image-map.json\` 在原样读取后
> 经过 SHA-256 校验，确认字节未变（详见第 7 节）。
> 按业务方要求，本阶段**未修改 \`website/\`、未接入图片、未重建网站 ZIP**。

---

## 一、复核总量

| 项目 | 数量 |
|---|---|
| 图片对象总数（锚点） | ${map.totals.anchors_found} |
| 其中 **exact**（已自动关联，无需人工） | ${map.totals.exact} |
| 其中 **review_required**（需人工确认） | **${reviewRequired.length}** |
| 其中 **unresolved**（无法映射，程序不猜） | **${unresolved.length}** |
| **本清单需要处理的合计** | **${pending.length}** |

图片文件的命名规则：已确定 Bowen 编号的用 \`<bowen_no>_<工作表>_<序号>.<扩展名>\`，
未能确定的用 \`unresolved_<工作表>_<序号>.<扩展名>\`。
本复核包把 ${pending.length} 张图另行复制到 \`images/\`，
命名为 \`<image_id>_<原文件名>\`，合计 ${(totalCopyBytes / 1024 / 1024).toFixed(2)} MB，
方便脱离原目录单独查看。

---

## 二、怎么用这个复核包

1. **先看联系表**（推荐）：直接打开
   \`data/processed/product-image-review/contact-sheet-all-31.png\`
   —— 一张图里能看到全部 31 张缩略图 + 编号 + 关键字段 + 需要做的决定。
2. **分成两张看**：
   - \`contact-sheet-review-required.png\` —— 需人工确认的 26 张
   - \`contact-sheet-unresolved.png\` —— 无法映射的 5 张
3. **逐张细看**：打开 \`data/processed/product-image-review/index.html\`
   （浏览器可滚动浏览，图片更大）。
4. **对照原表**：每条记录都给了来源工作表和行号，可直接在 Excel 里定位。
5. **回填**：把你确认的 Bowen No. 告诉我，我会更新映射（本轮不改数据库）。

---

## 三、需人工确认的 26 张（review_required）

这 26 张的共同点：**能确定属于哪一行，但不能确定属于哪个产品**。
按原因分三类。

### 3.1 原因分类小结

| 原因（match_kind） | 数量 | 含义 |
|---|---|---|
| \`record_row_bowen_unreadable\` | ${byKind('record_row_bowen_unreadable').length} | 锚点行是产品记录行，但「博文编号」单元格读不出合法编号 |
| \`record_row_without_bowen\` | ${byKind('record_row_without_bowen').length} | 锚点行是产品记录行，但没填「博文编号」 |
| \`bowen_not_in_database\` | ${byKind('bowen_not_in_database').length} | 读到了编号，但数据库里没有该产品（见第 4 节） |

### 3.2 总表

${tableFor(groupReview, 1)}

### 3.3 逐条明细

${detailFor(groupReview, 1)}
---

### 3.4 图片质量观察（目视联系表得出，**非程序判定**）

${REVIEW_QUALITY_NOTE}
---

## 四、等待业务方决定是否入库的 5 个编号

这 5 个编号来自辅助表《工作表1》。它们在原表里**有图片**，说明业务方确实把它们当产品看；
但 Phase 2.5 的规则把「整行只有编号、没有 OE 也没有车型」的行判为辅助表孤立的
「天博编号」行，**没有纳入产品库**，因此图片也无法归位。

**需要业务方决定：这 5 个编号是否作为正式产品补入数据库？**

| # | Bowen No.（原表读到） | image_id | 工作表 | 锚点 | 行号 | 图片文件 | 图片 |
|---|---|---|---|---|---|---|---|
| 1 | \`38169\` | \`IMG-0720\` | 工作表1 | \`A12\` | 12 | \`${records.find((r) => r.image_id === 'IMG-0720')?.__copy}\` | 见联系表 |
| 2 | \`38298\` | \`IMG-0721\` | 工作表1 | \`A13\` | 13 | \`${records.find((r) => r.image_id === 'IMG-0721')?.__copy}\` | 见联系表 |
| 3 | \`3932\` | \`IMG-0736\` | 工作表1 | \`A51\` | 51 | \`${records.find((r) => r.image_id === 'IMG-0736')?.__copy}\` | 见联系表 |
| 4 | \`32603\` | \`IMG-0773\` | 工作表1 | \`A151\` | 151 | \`${records.find((r) => r.image_id === 'IMG-0773')?.__copy}\` | 见联系表 |
| 5 | \`32748-1\` | \`IMG-0776\` | 工作表1 | \`A154\` | 154 | \`${records.find((r) => r.image_id === 'IMG-0776')?.__copy}\` | 见联系表 |

> 说明：这 5 条的状态是 \`review_required\` 而不是 \`unresolved\`，
> 因为**编号是明确读到的**，只是数据库里没有对应产品。
> 程序没有替业务方决定它们该不该入库。

**两种情况下的后续处理：**

| 业务方决定 | 后续动作 |
|---|---|
| **补入产品库** | 把这 5 个编号加入产品库（需要一个产品类型，或先标 \`review_required\`），图片随即自动归位到对应产品 |
| **不补入** | 保持现状；这 5 张图可作为「辅助表编号参考图」保留，不进网站 |

---

## 五、无法映射的 5 张（unresolved）

按"不猜"原则，这 5 张的 **Bowen No. 与 product_id 一律留空**，
程序没有做任何推断，也**不允许**在后续处理中凭外观猜测归属。

| 原因 | 数量 | 含义 |
|---|---|---|
| \`anchor_outside_record_blocks\` | ${byKind('anchor_outside_record_blocks').length} | 锚点所在列不在任何产品记录区块内 |
| \`sheet_has_no_product_table\` | ${byKind('sheet_has_no_product_table').length} | 该工作表整体没有产品表结构 |

${tableFor(groupUnresolved, 27)}

### 5.1 这 5 张图上实际能看到什么（人工逐张查看，**非程序推断**）

> 这一节是**人看图之后写的观察记录**，不是程序对图片归属的推断。
> 写进来的原因：其中 **2 张根本不是产品照片**，而且那 1 张系统截图里**含内部价格**。
> 这类情况必须让业务方知道，否则图片一旦接入网站会造成价格泄漏。

| image_id | 尺寸 | 图上实际内容 | 风险 | 结论 |
|---|---|---|---|---|
| \`IMG-0723\` | 1030 × 386 | **内部系统产品页面截图**：左侧节温器产品照，右侧字段表，含 名称 / 零件号 \`1106013088\` / **进价 15** / **售价 19.5** / 车型 | 🔴 **高风险** | **含内部进价与售价，绝对不可对外发布**；建议仅作内部线索，另提供干净产品照 |
| \`IMG-0780\` | 1080 × 2392 | **手机截图**：顶部状态栏（17:09、电量 85%），中间嵌一张带水印的节温器总成照，底部相册「1/1」与返回按钮 | 🟡 中风险 | 含手机界面与水印，直接上网站不专业；若产品可用需先裁剪去界面、处理水印 |
| \`IMG-0787\` | 1280 × 1280 | 干净产品照：金属节温器，浅色背景棚拍，无界面元素、未观察到水印 | 🟢 低 | 图本身可用，缺的只是「属于哪个 Bowen 产品」 |
| \`IMG-0797\` | 1280 × 1280 | 干净产品照：黑色塑料节温器总成 / 壳体（带管口） | 🟢 低 | 同上 |
| \`IMG-0798\` | 1280 × 1280 | 干净产品照：黑色塑料节温器壳体（正面法兰视角） | 🟢 低 | 同上 |

**特别提示（IMG-0723）**：该截图里的「进价 15 / 售价 19.5」是内部价格。
本清单**没有**把它当作任何产品的价格记录，也没有写进任何数据库字段；
只是把它作为「这张图不能对外用」的理由记录在此。

${detailFor(groupUnresolved, 27)}
---

## 六、需要业务方做的决定（汇总）

| # | 决定 | 涉及数量 | 影响 |
|---|---|---|---|
| D1 | 补填「博文编号」单元格读不出的那几行的正确编号 | ${byKind('record_row_bowen_unreadable').length} 张 | 编号补齐后图片自动归位 |
| D2 | 确认「记录行但没有编号」的那几行对应哪个产品 | ${byKind('record_row_without_bowen').length} 张 | 同上 |
| D3 | 决定 38169 / 38298 / 3932 / 32603 / 32748-1 是否作为产品入库 | 5 张 | 决定后图片归位或保持现状 |
| D4 | 人工看图判断 5 张 unresolved 的归属，或确认应删除/忽略 | 5 张 | 程序不猜，只能人工定 |
| D5 | **确认 \`IMG-0723\`（含内部进价/售价的系统截图）如何处理** | 1 张 | 🔴 该图**不可对外发布**；建议只留内部线索并另提供干净产品照 |
| D6 | **确认 \`IMG-0780\`（手机截图）是否先裁剪去界面与水印** | 1 张 | 不处理不宜用于网站 |
| D7 | **确认水印处理方案**：本批图片多数带第三方品牌水印「GXN」，少数带「BW」；上线前需统一去水印或重拍 | 26 张中的多数 | 不处理会在自家网站上出现别的品牌名 |
| D8 | **确认随手拍照片是否重拍**：如 \`IMG-0793\` 这类「产品放在纸上、背景是键盘」的照片不宜对外 | 26 张中的部分 | 影响网站专业度 |
| D9 | （附带）确认主图规则：267 个 Bowen 有多张图（最多 6 张），网站需要一个主图口径 | — | 影响后续图片接入网站 |

---

## 七、完整性声明

| 校验项 | 结果 |
|---|---|
| \`product-image-map.json\` 运行前后 SHA-256 | \`${mapHashBefore}\` → \`${sha256(MAP_PATH)}\`（**未变**） |
| review_required 数量 | ${reviewRequired.length}（期望 26） |
| unresolved 数量 | ${unresolved.length}（期望 5） |
| unresolved 是否带 bowen_no / product_id | **${badUnresolved.length} 条**（必须为 0，保持"不猜"） |
| 是否修改 \`website/\` | **否** |
| 是否接入图片到网站 | **否** |
| 是否重建网站 ZIP | **否** |
| 复制的图片文件 | ${records.filter((r) => r.__copy).length} 张，合计 ${(totalCopyBytes / 1024 / 1024).toFixed(2)} MB |
| 含内部价格信息的图片 | **1 张（\`IMG-0723\`）**，已在第 5.1 节与 D5 明确标记为不可对外发布 |

---

## 八、复核包文件清单

| 文件 | 内容 |
|---|---|
| \`contact-sheet-all-31.png\` | 全部 31 张缩略图联系表（总览，推荐先看这张） |
| \`contact-sheet-review-required.png\` | 需人工确认的 26 张 |
| \`contact-sheet-unresolved.png\` | 无法映射的 5 张 |
| \`index.html\` | 可滚动的可浏览版本 |
| \`contact-sheet-*.html\` | 上述三张联系表的 HTML 源（可自行放大查看） |
| \`images/\` | 31 张图片的副本，命名 \`<image_id>_<原文件名>\` |
| \`../product-image-map.json\` | 原始映射（**未被修改**） |
`;

fs.writeFileSync(DOC_PATH, md, 'utf8');

// ---------------------------------------------------------------- 收尾校验
const mapHashAfter = sha256(MAP_PATH);
if (mapHashAfter !== mapHashBefore) {
  console.error('\nFATAL product-image-map.json 在运行过程中被改动！这违反了本任务的要求。');
  process.exit(3);
}

log(`\n输出：`);
log(`  docs/product-image-review-needed.md`);
for (const s of sheets) log(`  data/processed/product-image-review/${s.key}.png`);
log(`  data/processed/product-image-review/index.html`);
log(`  data/processed/product-image-review/images/ (${records.filter((r) => r.__copy).length} 张)`);
log(`\nproduct-image-map.json SHA-256 运行后一致：${mapHashAfter === mapHashBefore}`);
log('website/ 未被修改，未接入图片，未重建 ZIP。');
