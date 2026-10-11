#!/usr/bin/env node
/**
 * Phase 2.7 — 图片复核结论包
 * ===========================================================================
 * 业务方已经对本轮 9 个图片问题逐条作答（见 data/raw/business-decisions-v3.json）。
 * 本脚本把「业务方的决定 + 程序的执行结果 + 仍未解决的部分」整理成一份可以直接看的结论包：
 *   docs/product-image-review-needed.md
 *   data/processed/product-image-review/*.png|html
 *
 * 铁律（写死在代码里）：
 *   1. **只读** product-image-map.json，绝不修改其中的 mapping_status / bowen_no / product_id。
 *      脚本运行前后对该文件做 SHA-256 校验，一旦变化立即报错退出。
 *   2. unresolved 记录**不得**输出任何 Bowen No. 或 product_id（保持 null）。程序不猜。
 *   3. 被业务方删除的图片，本包**不再复制**，只在结论表里留档说明。
 *   4. 不修改 website/，不重建网站 ZIP。
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
import { removeTree } from './lib/fsx.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_EXCEL = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const DECISIONS_PATH = path.join(ROOT, 'data/raw/business-decisions-v3.json');
const MAP_PATH = path.join(ROOT, 'data/processed/product-image-map.json');
const PROCESSED = path.join(ROOT, 'data/processed');
const OUT_DIR = path.join(PROCESSED, 'product-image-review');
const OUT_IMAGES = path.join(OUT_DIR, 'images');
const DOC_PATH = path.join(ROOT, 'docs/product-image-review-needed.md');

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- 前置校验
log('=== Phase 2.7 图片复核结论包 ===');
const mapHashBefore = sha256(MAP_PATH);
const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
const IR = decisions.image_review ?? {};

const reviewRequired = map.images.filter((i) => i.mapping_status === 'review_required');
const unresolved = map.images.filter((i) => i.mapping_status === 'unresolved');
const excluded = map.images.filter((i) => i.business_excluded);
const cropped = map.images.filter((i) => i.crop_status === 'done');
const pending = [...reviewRequired, ...unresolved];

log(`product-image-map.json SHA-256: ${mapHashBefore.slice(0, 16)}…`);
log(`review_required ${reviewRequired.length} / unresolved ${unresolved.length} / 按业务决定删除 ${excluded.length} / 已裁剪 ${cropped.length}`);

// 硬校验：unresolved 不得带 bowen_no / product_id（不猜）
const badUnresolved = unresolved.filter((i) => i.bowen_no || i.product_id);
if (badUnresolved.length) {
  console.error(`FATAL 有 ${badUnresolved.length} 张 unresolved 带了 bowen_no/product_id，违反“不猜”原则`);
  process.exit(2);
}
// 硬校验：删除集合必须与业务决定文件一致
const wantExcluded = [...(IR.D4_unresolved_5?.effective_exclusions ?? [])].sort().join(',');
const gotExcluded = excluded.map((i) => i.image_id).sort().join(',');
if (wantExcluded !== gotExcluded) {
  console.error(`FATAL 删除集合与业务决定不一致\n  决定文件 ${wantExcluded}\n  映射文件 ${gotExcluded}`);
  process.exit(2);
}
if (reviewRequired.length !== 21 || unresolved.length !== 5) {
  console.error(`FATAL 数量与预期不符（期望 review_required 21 + unresolved 5，实际 ${reviewRequired.length} + ${unresolved.length}）`);
  process.exit(2);
}

// ---------------------------------------------------------------- 读取原表上下文
const wb = new Workbook(RAW_EXCEL);
const sheetRowCells = new Map();
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const byRow = new Map();
  for (const c of sh.cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c.value);
  }
  sheetRowCells.set(s.name, byRow);
}

function sourceContext(rec) {
  const byRow = sheetRowCells.get(rec.source_sheet);
  const row = rec.source_row ?? rec.anchor_row;
  if (!byRow || row == null) return { available: false };
  const cells = byRow.get(row);
  if (!cells) return { available: false };
  const bowenCol = rec.block_bowen_col;
  const bowenRaw = bowenCol != null ? cells.get(bowenCol) : undefined;
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

// ---------------------------------------------------------------- 原因 / 处置文案
const REASON_TEXT = {
  record_row_bowen_unreadable:
    '锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号'
    + '（例如写着“无小管”“芯子编号：31052”这类说明文字）。',
  record_row_without_bowen:
    '锚点所在行是一条产品记录行，但该行没有填写「博文编号」。',
  anchor_outside_record_blocks:
    '图片锚点所在列不在该工作表的任何产品记录区块内，无法判断它属于哪条记录。',
  sheet_has_no_product_table:
    '该工作表整体没有产品表结构（只有零散单元格），无法判断图片归属。',
};

const KIND_LABEL = {
  record_row_bowen_unreadable: '编号读不出',
  record_row_without_bowen: '该行未填编号',
  anchor_outside_record_blocks: '锚点在记录区块外',
  sheet_has_no_product_table: '该表无产品表结构',
};

/**
 * 人工逐张看图写下的**观察记录**（不是程序推断）。
 * 即使图片已被删除，这些观察仍要留档：它们正是删除理由的依据，
 * 尤其是 IMG-0723 里含有内部进价/售价。
 */
const IMAGE_OBSERVATIONS = {
  'IMG-0723': {
    what: '不是产品照片：**内部系统产品页面的截图**。左侧是节温器产品照，右侧是字段表。',
    visible: [
      '零件号：**1106013088**',
      '**进价：15**   **售价：19.5**',
      '名称：节温器（MR479Q、MR479QA、MR481QA 等一长串机型代码）',
      '底部按钮：提交求购 / 发布促销 / 记录配件',
    ],
    risk: '🔴 **高风险**：图中含**内部进价与售价**。**绝对不可以**出现在对外网站上。',
    size: '1030 × 386 px',
  },
  'IMG-0780': {
    what: '手机截图：顶部状态栏 + 纯黑信筒区 + 中间一张带水印的节温器总成产品照 + 底部相册「1/1」。',
    visible: ['顶部状态栏：17:09、电量 85%、信号图标', '中间：黑色塑料节温器总成产品照（带 GXN 商标水印）', '底部：相册进度「1/1」、圆形返回按钮'],
    risk: '🟡 已按 D6 裁剪掉界面部分，裁剪后只剩产品图，可用于后续使用。',
    size: '1080 × 2392 px → 裁剪后 1080 × 814 px',
  },
  'IMG-0787': {
    what: '干净的产品照片：金属节温器（单只，浅色背景棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '🟢 图本身干净；业务方依 D4 确认删除。',
    size: '1280 × 1280 px',
  },
  'IMG-0797': {
    what: '干净的产品照片：黑色塑料节温器总成 / 壳体（带管口，浅色背景棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '🟢 图本身干净；业务方依 D4 确认删除。',
    size: '1280 × 1280 px',
  },
  'IMG-0798': {
    what: '干净的产品照片：黑色塑料节温器壳体（正面法兰视角，浅色背景棚拍）。',
    visible: ['无界面元素', '未观察到水印'],
    risk: '🟢 图本身干净；业务方依 D4 确认删除。',
    size: '1280 × 1280 px',
  },
};

/**
 * 剩余 21 张的图片质量目视观察（看联系表得出，非逐像素检测）。
 * 重要更正：图片上的「GXN」是**博文自有商标**（D7 业务方确认），不是外部品牌水印。
 */
const REVIEW_QUALITY_NOTE = `从联系表目视可见，这 21 张图**质量参差**，大致两类：

| 形态 | 说明 | 能否直接用于网站 |
|---|---|---|
| **棚拍产品照（较多）** | 白底 / 浅灰底、构图规整的节温器或传感器产品照 | 构图可用；图上的「GXN」是**博文自有商标**（业务方 D7 确认），按 D7 保留，不需要处理 |
| **随手拍的实物照（部分）** | 例如 \`IMG-0793\`（1080 × 1920）是把节温器放在一张纸上、背后是键盘的随手拍 | 业务方已按 D8 决定**保留**，不要求重拍 |

> **说明**：以上是**人看联系表得出的观察**，不是程序对图片内容的判定。

**这 21 张现在唯一缺的只有一样东西：Bowen No.**
图本身与所属工作表行都已经确定，只差编号，所以业务方补上编号即可自动归位。
`;

// ---------------------------------------------------------------- 复制图片
// 整个结论包目录都重新生成：避免上一轮的 contact-sheet-all-31.* 等文件残留
removeTree(OUT_DIR);
fs.mkdirSync(OUT_IMAGES, { recursive: true });

const records = pending.map((rec) => {
  const ctx = sourceContext(rec);
  const copies = [];
  const copyOne = (relFile, suffix) => {
    if (!relFile) return null;
    const srcFile = path.join(PROCESSED, relFile);
    if (!fs.existsSync(srcFile)) return null;
    const ext = path.extname(srcFile);
    const copyName = `${rec.image_id}_${path.basename(srcFile, ext)}${suffix}${ext}`;
    const dest = path.join(OUT_IMAGES, copyName);
    fs.copyFileSync(srcFile, dest);
    copies.push({ file: `images/${copyName}`, bytes: fs.statSync(dest).size, source: relFile });
    return `images/${copyName}`;
  };
  // 被删除的图片文件已不存在 → 不复制，页面上显示占位
  const copyPath = copyOne(rec.image_file, '');
  const croppedCopy = copyOne(rec.cropped_image_file, '');
  return {
    ...rec,
    __context: ctx,
    __copy: copyPath,
    __cropped_copy: croppedCopy,
    __copies: copies,
    __reason: REASON_TEXT[rec.match_kind] ?? rec.match_kind,
  };
});

const copiedCount = records.filter((r) => r.__copy).length;
const totalCopies = records.reduce((s, r) => s + r.__copies.length, 0);
const totalCopyBytes = records.reduce((s, r) => s + r.__copies.reduce((a, c) => a + c.bytes, 0), 0);
log(`已复制 ${totalCopies} 个图片文件（来自 ${copiedCount} 条记录）到 product-image-review/images/`);

const byKind = (k) => records.filter((r) => r.match_kind === k);
const groupPending = records.filter((r) => !r.business_excluded);
const groupDeleted = records.filter((r) => r.business_excluded);

// ---------------------------------------------------------------- 联系表 HTML
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function disposition(r) {
  if (r.business_excluded) return { cls: 'bg-del', text: `已删除（${r.business_exclusion?.decided_by ?? '业务决定'}）` };
  if (r.crop_status === 'done') return { cls: 'bg-ok', text: '已裁剪保留（D6）' };
  return { cls: 'bg-warn', text: '待业务方补 Bowen No.' };
}

function card(r, idx) {
  const d = disposition(r);
  const bowen = r.mapping_status === 'unresolved'
    ? '<span class="none">（不猜）</span>'
    : (r.bowen_no ? esc(r.bowen_no) : '<span class="none">（空）</span>');
  const pid = r.mapping_status === 'unresolved'
    ? '<span class="none">（不猜）</span>'
    : (r.product_id ? esc(r.product_id) : '<span class="none">（空）</span>');
  const ctxLine = r.__context?.bowen_raw
    ? `<div class="ctx"><b>原表 Bowen 单元格 ${esc(r.__context.bowen_cell)}：</b>${esc(r.__context.bowen_raw)}</div>`
    : (r.__context?.available
      ? `<div class="ctx"><b>原表 Bowen 单元格 ${esc(r.__context.bowen_cell ?? '—')}：</b>（空）</div>`
      : '');
  const shown = r.__cropped_copy ?? r.__copy;
  const thumb = shown
    ? `<img src="${esc(shown)}" alt="${esc(r.image_id)}" loading="eager">`
    : `<div class="nofile">图片文件已按业务决定删除<br><span>（D4/D5，不留副本）</span></div>`;
  const cropHint = r.__cropped_copy ? '<div class="hint">缩略图为 D6 裁剪后的结果（原图见 images/ 内同名 _cropped 之外的副本）</div>' : '';
  const obs = IMAGE_OBSERVATIONS[r.image_id];
  const obsLine = obs
    ? `<div class="note ${obs.risk.includes('高风险') ? 'danger' : ''}">${esc(obs.what)}</div>`
    : '';
  return `
  <figure class="card">
    <div class="thumb">${thumb}</div>
    <figcaption>
      <div class="head">
        <span class="id">#${idx} ${esc(r.image_id)}</span>
        <span class="badge ${d.cls}">${esc(d.text)}</span>
      </div>
      <dl>
        <div><dt>工作表</dt><dd>${esc(r.source_sheet)}</dd></div>
        <div><dt>锚点</dt><dd>${esc(r.anchor_cell ?? '—')}</dd></div>
        <div><dt>行号</dt><dd>${r.source_row ?? '—'}</dd></div>
        <div><dt>Bowen No.</dt><dd class="mono">${bowen}</dd></div>
        <div><dt>product_id</dt><dd class="mono">${pid}</dd></div>
        <div><dt>原因</dt><dd>${esc(KIND_LABEL[r.match_kind] ?? r.match_kind)}</dd></div>
      </dl>
      ${ctxLine}
      ${obsLine}
      ${cropHint}
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
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 18px; margin-top: 20px; }
  .card { margin: 0; min-width: 0; background: #fff; border: 1px solid #d8e0e7; border-radius: 10px; overflow: hidden; }
  .thumb { height: 260px; display: grid; place-items: center; background: #fbfdfe; border-bottom: 1px solid #eaeff3; padding: 10px; }
  .thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .nofile { font-size: 13px; color: #b91c1c; text-align: center; line-height: 1.7; font-weight: 600; }
  .nofile span { font-weight: 400; color: #8a99a8; }
  figcaption { padding: 12px 14px 14px; min-width: 0; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .id { font-family: Consolas, monospace; font-size: 13px; font-weight: 700; }
  .badge { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  .bg-warn { background: #fffbeb; color: #b45309; border: 1px solid #fcd9a4; }
  .bg-del { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .bg-ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; margin: 0 0 10px; font-size: 12.5px; }
  dl > div { display: contents; }
  dt { color: #6b7c8c; }
  dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .mono { font-family: Consolas, monospace; }
  .none { color: #b91c1c; font-weight: 500; }
  .ctx { font-size: 12px; color: #33414f; background: #f2f7fb; border: 1px solid #e3edf6;
         border-radius: 6px; padding: 7px 9px; margin-bottom: 8px; line-height: 1.5; overflow-wrap: anywhere; }
  .note { font-size: 11.5px; color: #4a5a6a; background: #f8fafc; border: 1px solid #e6edf3;
          border-radius: 6px; padding: 7px 9px; line-height: 1.55; overflow-wrap: anywhere; }
  .note.danger { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
  .hint { font-size: 11px; color: #047857; margin-top: 6px; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(subtitle)}</p>
  <span class="count">共 ${list.length} 张</span>
  <div class="grid">${list.map((r, i) => card(r, i + 1)).join('')}</div>
</body></html>`;
}

const sheets = [
  {
    key: 'contact-sheet-all-26',
    title: '缩略图联系表 — 本轮 26 张的最终处置',
    subtitle: '21 张待业务方补 Bowen No.；4 张已按 D4/D5 删除（无文件，显示占位）；1 张已按 D6 裁剪保留。',
    list: records,
  },
  {
    key: 'contact-sheet-pending-22',
    title: '缩略图联系表 — 仍缺 Bowen No. 的 22 张',
    subtitle: '这 22 张的图片与所属工作表位置都已确定，唯一缺的是「博文编号」。编号补齐后即可自动归位。',
    list: groupPending,
  },
  {
    key: 'contact-sheet-removed-5',
    title: '缩略图联系表 — 已处置的 5 张（D4/D5/D6）',
    subtitle: '4 张按 D4/D5 删除（不留副本），1 张（IMG-0780）按 D6 裁剪保留。此表用于留档说明处置理由。',
    list: [...groupDeleted, ...records.filter((r) => r.crop_status === 'done')],
  },
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
    fs.writeFileSync(path.join(OUT_DIR, `${s.key}.png`), png);
    log(`  ${s.key}.png  ${width}x${height}  ${Math.round(png.length / 1024)} KB  图片加载 ${imagesLoaded}/${imagesTotal}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), sheetHtml(
    '图片复核结论包 — 总览',
    '业务方已对 D1–D9 逐条作答。本包含三份联系表：全部 26 张的最终处置、仍缺编号的 22 张、已处置的 5 张。',
    records,
  ), 'utf8');
} finally {
  await server.close();
}

// ---------------------------------------------------------------- 生成 Markdown
const fmtCell = (v) => (v == null || v === '' ? '—' : String(v).replace(/\|/g, '\\|'));
const now = new Date().toISOString();

function tableFor(list, startIndex) {
  const head = '| # | image_id | 图片文件 | 工作表 | 锚点 | 行号 | Bowen No. | product_id | 状态 | 处置 | 原因 |\n'
    + '|---|---|---|---|---|---|---|---|---|---|---|\n';
  const rows = list.map((r, i) => {
    const bowen = r.mapping_status === 'unresolved'
      ? '**（不猜）**'
      : (r.bowen_no ? `\`${r.bowen_no}\`` : '*（空）*');
    const pid = r.mapping_status === 'unresolved'
      ? '**（不猜）**'
      : (r.product_id ? `\`${r.product_id}\`` : '*（空）*');
    return `| ${startIndex + i} | \`${r.image_id}\` | \`${r.__copy ?? (r.business_excluded ? '（已删除）' : '—')}\` `
      + `| ${fmtCell(r.source_sheet)} | \`${fmtCell(r.anchor_cell)}\` | ${fmtCell(r.source_row)} `
      + `| ${bowen} | ${pid} | ${r.mapping_status} | ${disposition(r).text} | ${KIND_LABEL[r.match_kind] ?? r.match_kind} |`;
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

    const blockLine = r.block_start_col != null
      ? `- 锚点所属记录区块：从第 ${r.block_start_col} 列（\`${numToCol(r.block_start_col)}\`）开始的区块；`
        + `该区块的「博文编号」列是 \`${r.block_bowen_col != null ? numToCol(r.block_bowen_col) : '?'}\``
      : '- 锚点不属于任何记录区块（该表没有可识别的产品表结构，或锚点列落在区块之外）';

    const dispLines = [
      `- 业务处置：**${disposition(r).text}**`,
      r.business_exclusion ? `- 删除依据：${r.business_exclusion.decided_by} —— ${r.business_exclusion.reason}` : null,
      r.crop_status === 'done'
        ? `- 裁剪结果：\`${r.cropped_image_file}\`（${r.crop_measure.width}×${r.crop_measure.height}，`
          + `原图 ${r.crop_measure.sourceWidth}×${r.crop_measure.sourceHeight}；方法 ${r.crop_measure.measure.method}）`
        : null,
      r.crop_status === 'failed' ? `- 裁剪失败：${r.crop_error}` : null,
    ].filter(Boolean).join('\n');

    const obs = IMAGE_OBSERVATIONS[r.image_id];
    const obsBlock = obs
      ? `\n**图片内容观察（人工看图记录，非程序推断）**：${obs.what}\n`
        + obs.visible.map((v) => `- ${v}`).join('\n')
        + `\n\n**风险判定**：${obs.risk}\n`
      : '';

    return `#### ${n}. \`${r.image_id}\` — ${KIND_LABEL[r.match_kind] ?? r.match_kind}

| 字段 | 值 |
|---|---|
| image_id | \`${r.image_id}\` |
| 图片文件（复核包内） | \`${r.__copy ?? '（已按业务决定删除，无副本）'}\` |
| 图片文件（原始提取目录） | ${r.image_file ? `\`data/processed/${r.image_file}\`` : '*（已删除）*'} |
| 裁剪派生图 | ${r.cropped_image_file ? `\`data/processed/${r.cropped_image_file}\`` : '—'} |
| 来源工作表 | ${fmtCell(r.source_sheet)} |
| 锚点单元格 | \`${fmtCell(r.anchor_cell)}\` |
| 关联到的记录行 | ${fmtCell(r.source_row)} |
| mapping_status | \`${r.mapping_status}\` |
| match_kind | \`${r.match_kind}\` |
| 源 media 部件 | \`${r.media_part}\` |
| 图片体积 | ${r.media_bytes != null ? `${(r.media_bytes / 1024).toFixed(0)} KB` : '—'} |

${bowenLine}
${blockLine}
${dispLines}

**原因**：${r.__reason}

${ctxLines}
${obsBlock}
`;
  }).join('\n---\n\n');
}

const md = `# 产品图片复核结论（Phase 2.7）

**生成时间：${now}**
**数据来源：\`data/processed/product-image-map.json\`（SHA-256 \`${mapHashBefore}\`）**
**业务决定：\`data/raw/business-decisions-v3.json\`（schema \`${decisions.schema}\`，${decisions.decided_at}）**
**复核包目录：\`data/processed/product-image-review/\`**

> 本清单**只做整理，不改任何状态**。\`product-image-map.json\` 在原样读取后经过
> SHA-256 校验，确认字节未变（见第七节）。
> 本阶段**未修改 \`website/\`、未把图片接入网站、未重建网站 ZIP**。

---

## 一、业务方决定与执行结果（D1–D9）

业务方原话逐条记录在 \`business-decisions-v3.json\` 的 \`image_review\` 段。下表是本轮的**最终结论**。

| # | 业务方回答 | 程序执行结果 |
|---|---|---|
| **D1** | 「编号读不出的部分先忽略」 | ✅ 已执行：${byKind('record_row_bowen_unreadable').length} 张保持原状，**未做任何归属推断** |
| **D2** | 「记录行但没编号的类别都是节温器」 | ✅ 已执行：${byKind('record_row_without_bowen').length} 张只记录品类为 **Thermostat**；因仍无 Bowen No.，**不生成产品、不做归属** |
| **D3** | 「已入库」 | ✅ 已执行：\`38169 / 38298 / 3932 / 32603 / 32748-1\` 已补入产品库，对应 5 张图片**已从 review_required 升级为 exact** |
| **D4** | 「确认删除」 | ✅ 已执行：\`IMG-0723 / IMG-0787 / IMG-0797 / IMG-0798\` 共 4 张已删除，**未导出、无副本、不出现在任何产品下** |
| **D5** | 「忽略这个产品」 | ✅ 已执行：\`IMG-0723\`（含内部进价的系统截图）已删除，与 D4 一致 |
| **D6** | 「先裁剪」 | ✅ 已执行：\`IMG-0780\` 已裁剪为 ${cropped.map((c) => `\`${c.cropped_image_file}\`（${c.crop_measure.width}×${c.crop_measure.height}）`).join('、')}，原图保留可回溯 |
| **D7** | 「水印保留，这是我们公司商标」 | ✅ 已执行：**重要更正——「GXN」是博文自有商标，不是外部品牌水印**。图片水印原样保留，程序不做任何去水印处理；此前的“水印风险”说明作废 |
| **D8** | 「保留」 | ✅ 已执行：随手拍照片（如 \`IMG-0793\`）保留，**不要求重拍** |
| **D9** | 「主图你自己选择」 | ✅ 已执行：按确定性规则为 **${map.totals.products_with_primary_image}** 个有图产品各选出 1 张主图（规则见第六节） |

除此之外：

- 「产能/标准交期先不做了」→ Factory 页的产能/交期**不再作为待补项**推进，也不编造数字。
- 「公司全称、邮箱等看宣传手册」→ 已提取到 \`docs/company-info-from-brochure.md\`（含公司全称、邮箱、电话、网址、成立年份、厂房面积、三张体系证书等；手册中**没有**街道地址，已注明“手册未载”）。

---

## 二、本轮图片总量与处置分布

| 项目 | 数量 |
|---|---|
| 图片对象总数（锚点） | ${map.totals.anchors_found} |
| **exact**（自动关联，无需人工） | ${map.totals.exact} |
| **review_required**（能定位到行、缺编号） | ${reviewRequired.length} |
| **unresolved**（无法映射，程序不猜） | ${unresolved.length} |
| 按业务决定**删除** | ${excluded.length} |
| 按业务决定**裁剪保留** | ${cropped.length} |
| 导出到 \`product-images/\` 的文件 | ${map.totals.images_extracted} |
| 实际落盘文件（含裁剪派生图） | ${map.totals.images_extracted + map.totals.images_cropped} |
| **仍需业务方行动** | **${groupPending.length} 张（只缺 Bowen No.）** |

> 上一轮复核包的 26 + 5 = 31 张里，**5 张已由 D3 归位、4 张已删除、1 张已裁剪**，
> 剩下的 **${groupPending.length} 张**（14 张编号读不出 + 7 张该行未填编号 + 1 张已裁剪的 IMG-0780）
> 现在只缺「博文编号」这一件事。

---

## 三、仍缺 Bowen No. 的 22 张

这 22 张的共同点：**图片本身与它在原表里的位置都已经确定，唯一缺的是「博文编号」**。
补上编号后，程序会自动把它们归位到对应产品（不需要再做别的决定）。

### 3.1 原因分类

| 原因（match_kind） | 数量 | 含义 |
|---|---|---|
| \`record_row_bowen_unreadable\` | ${byKind('record_row_bowen_unreadable').length} | 锚点行是产品记录行，但「博文编号」单元格读不出合法编号（业务方 D1：**先忽略**） |
| \`record_row_without_bowen\` | ${byKind('record_row_without_bowen').length} | 锚点行是产品记录行，但没填「博文编号」（业务方 D2：**品类是节温器**） |
| \`anchor_outside_record_blocks\` | ${byKind('anchor_outside_record_blocks').length} | 锚点列不在任何记录区块内；\`IMG-0780\` 已按 D6 裁剪保留，同样还缺编号 |

### 3.2 总表

${tableFor(groupPending, 1)}

### 3.3 逐条明细

${detailFor(groupPending, 1)}
---

### 3.4 图片质量观察（目视联系表得出，**非程序判定**）

${REVIEW_QUALITY_NOTE}

---

## 四、已处置的 5 张（D4 / D5 / D6）

### 4.1 已删除的 4 张（D4 + D5）

这 4 张按业务方决定**整体删除**：不导出文件、不留副本、不挂到任何产品、不进网站。

| image_id | 工作表 | 锚点 | 图上实际内容（人工观察） | 处置 |
|---|---|---|---|---|
| \`IMG-0723\` | 工作表1 | \`H25\` | 🔴 **内部系统产品页面截图**，含 零件号 \`1106013088\`、**进价 15**、**售价 19.5** | **删除**（D4 + D5） |
| \`IMG-0787\` | 工作表1 | \`H185\` | 干净产品照：金属节温器，浅色背景棚拍 | **删除**（D4） |
| \`IMG-0797\` | 工作表2 | \`B1\` | 干净产品照：黑色塑料节温器总成 / 壳体 | **删除**（D4） |
| \`IMG-0798\` | 工作表2 | \`C1\` | 干净产品照：黑色塑料节温器壳体（正面法兰） | **删除**（D4） |

> **特别提示（IMG-0723）**：该截图里的「进价 15 / 售价 19.5」是内部价格。
> 本清单**没有**把它当作任何产品的价格记录，也**没有**写进任何数据库字段；
> 只是把它作为「这张图不能对外用」的理由留档在此。
> 删除后该风险已彻底消除。

### 4.2 已裁剪保留的 1 张（D6）

| image_id | 原图 | 裁剪后 | 裁剪方法 |
|---|---|---|---|
| \`IMG-0780\` | ${cropped[0] ? `\`${cropped[0].image_file}\`（${cropped[0].crop_measure.sourceWidth}×${cropped[0].crop_measure.sourceHeight}）` : '—'} | ${cropped[0] ? `\`${cropped[0].cropped_image_file}\`（${cropped[0].crop_measure.width}×${cropped[0].crop_measure.height}）` : '—'} | 程序测量像素找上下纯黑信筒行带，取两段黑边之间**最大**的非黑行区间裁切 |

裁剪只去掉**界面部分**（系统状态栏、纯黑信筒区、相册底栏），**宽度不变、产品本体未被裁**。
原图保留在 \`product-images/\` 里可回溯，裁剪图并存，供后续使用。
水印按 D7 保留（博文自有商标）。

---

## 五、编号补齐后的归位方式（无需业务方再做别的决定）

业务方只要提供「哪个 image_id 对应哪个 Bowen No.」，程序会：

1. 把该图片的 \`mapping_status\` 从 \`review_required\` 改为 \`exact\`；
2. 填入 \`bowen_no\` 与 \`product_id\`（指向产品库里已存在的产品）；
3. 重新计算该产品的主图（D9 规则）；
4. 重跑 \`node tools/verify-product-images.mjs\`（当前 56 项全通过）确认没有回归。

**程序不会自己猜编号，也不会按图片外观去匹配产品。**

---

## 六、D9 主图规则（已实现，确定性可复现）

同一 Bowen 有多张图时，按以下优先级选主图（业务方原话：「主图你自己选择」）：

1. 来源工作表 = \`综合产品信息表\`（主目录优先）
2. 其次按系列工作表在 Excel 中的顺序（\`sheet_index\` 升序）
3. 同一工作表内按锚点行号升序
4. 仍相同则按源 media 部件名（\`media_part\`）字典序

结果：**${map.totals.products_with_primary_image} 个有图产品各恰好 1 张主图**，
映射里以 \`is_primary_image\` / \`primary_rank\` / \`primary_image_rule\` 三个字段记录，可逐条复核。

---

## 七、完整性声明

| 校验项 | 结果 |
|---|---|
| \`product-image-map.json\` 运行前后 SHA-256 | \`${mapHashBefore}\` → \`${sha256(MAP_PATH)}\`（**未变**） |
| review_required 数量 | ${reviewRequired.length}（期望 21） |
| unresolved 数量 | ${unresolved.length}（期望 5） |
| 删除集合与业务决定文件是否一致 | **是**（\`${gotExcluded}\`） |
| unresolved 是否带 bowen_no / product_id | **${badUnresolved.length} 条**（必须为 0，保持“不猜”） |
| 是否修改 \`website/\` | **否** |
| 是否把图片接入网站 | **否** |
| 是否重建网站 ZIP | **否** |
| 被删除图片是否留有副本 | **否**（4 张均未复制到本包） |
| 复制的图片文件 | ${totalCopies} 个文件（来自 ${copiedCount} 条记录），合计 ${(totalCopyBytes / 1024 / 1024).toFixed(2)} MB |
| 含内部价格信息的图片 | **1 张（\`IMG-0723\`，已删除）**，理由已在 4.1 与 D5 留档 |

---

## 八、复核包文件清单

| 文件 | 内容 |
|---|---|
| \`contact-sheet-all-26.png\` | 本轮 26 张的最终处置（总览，推荐先看这张） |
| \`contact-sheet-pending-22.png\` | 仍缺 Bowen No. 的 22 张 |
| \`contact-sheet-removed-5.png\` | 已处置的 5 张（4 张删除 + 1 张裁剪） |
| \`index.html\` | 可滚动的可浏览版本 |
| \`contact-sheet-*.html\` | 上述三张联系表的 HTML 源（可自行放大查看） |
| \`images/\` | ${totalCopies} 个图片文件（\`IMG-0780\` 的原图与裁剪图各一份），命名 \`<image_id>_<原文件名>\`；已删除的图片**不在其中** |
| \`../product-image-map.json\` | 原始映射（**未被修改**） |
| \`../../data/raw/business-decisions-v3.json\` | 业务方决定文件（本包的唯一依据） |
| \`../../docs/company-info-from-brochure.md\` | 从宣传手册提取的公司信息 |
`;

fs.writeFileSync(DOC_PATH, md, 'utf8');

// ---------------------------------------------------------------- 收尾校验
const mapHashAfter = sha256(MAP_PATH);
if (mapHashAfter !== mapHashBefore) {
  console.error('\nFATAL product-image-map.json 在运行过程中被改动！这违反了本任务的要求。');
  process.exit(3);
}

log('\n输出：');
log('  docs/product-image-review-needed.md');
for (const s of sheets) log(`  data/processed/product-image-review/${s.key}.png`);
log('  data/processed/product-image-review/index.html');
log(`  data/processed/product-image-review/images/ (${totalCopies} 个文件)`);
log(`\nproduct-image-map.json SHA-256 运行后一致：${mapHashAfter === mapHashBefore}`);
log('website/ 未被修改，未接入图片，未重建 ZIP。');
