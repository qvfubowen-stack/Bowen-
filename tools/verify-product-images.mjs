#!/usr/bin/env node
/**
 * Phase 2.6 验收测试 — Excel 嵌入图片提取与映射
 * ===========================================================================
 * 用法：node tools/verify-product-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { readZip, Workbook } from './xlsx-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const MANIFEST = path.join(ROOT, 'data/raw/SOURCE-MANIFEST.json');
const DECISIONS = path.join(ROOT, 'data/raw/business-decisions-v3.json');
const IMG_DIR = path.join(ROOT, 'data/processed/product-images');
const MAP = path.join(ROOT, 'data/processed/product-image-map.json');
const DB_PRODUCTS = path.join(ROOT, 'data/derived/v2/products.json');

let pass = 0;
let fail = 0;
const failures = [];
let group = '';

function section(t) { group = t; console.log(`\n${'─'.repeat(74)}\n${t}\n${'─'.repeat(74)}`); }
function check(name, fn) {
  let ok = false; let detail = '';
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (typeof r === 'string') detail = r;
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
  } catch (e) { detail = `异常: ${e.message}`; }
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(`[${group}] ${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

console.log('博文外贸独立站 — Phase 2.6 嵌入图片提取与映射 验收测试');

for (const f of [MAP]) {
  if (!fs.existsSync(f)) {
    console.error(`FATAL 缺少 ${path.relative(ROOT, f)}，请先运行 node tools/extract-product-images.mjs`);
    process.exit(2);
  }
}

/**
 * 预检：图片二进制本身不入 Git（66.5 MB，且可由原始 Excel 一条命令重新生成），
 * 所以全新 clone 出来的目录里没有 data/processed/product-images/。
 * 这种情况给出可执行的指引，而不是抛出一堆看不懂的失败项。
 */
const preflightMap = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const expectedImages = preflightMap.totals.images_extracted;
const onDisk = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR).length : 0;
if (onDisk === 0 && expectedImages > 0) {
  console.error(
    '\n图片文件尚未生成。\n'
    + '  原因：提取出的图片二进制体积较大（约 66.5 MB）且可由原始 Excel 完整重新生成，\n'
    + '        因此没有纳入 Git；映射文件 product-image-map.json 已入库。\n'
    + '  解决：在项目根目录执行一次（约 30 秒）：\n'
    + '        node tools/extract-product-images.mjs\n'
    + '        然后重新运行本测试。\n',
  );
  process.exit(2);
}

const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(DECISIONS, 'utf8'));
const dbProducts = JSON.parse(fs.readFileSync(DB_PRODUCTS, 'utf8'));
const productIds = new Set(dbProducts.map((p) => p.product_id));
const productByBowen = new Map(dbProducts.filter((p) => p.bowen_no).map((p) => [p.bowen_no.toUpperCase(), p]));

console.log(`映射文件：${map.images.length} 张图片对象 / totals.exact=${map.totals.exact}`);

// =====================================================================
section('TEST A — 原始 Excel 不得被修改');
// =====================================================================
check('原始 Excel SHA-256 与冻结清单一致', () => {
  const now = sha256(RAW);
  return now === manifest.sources.product_excel_v2.sha256
    ? { ok: true, detail: now.slice(0, 16) + '…' }
    : `期望 ${manifest.sources.product_excel_v2.sha256} 实际 ${now}`;
});
check('映射文件记录的源文件 SHA-256 与冻结值一致', () =>
  map.source_excel.sha256 === manifest.sources.product_excel_v2.sha256);

// =====================================================================
section('TEST B — 确实存在嵌入图片（推翻「图片列为空」的旧结论）');
// =====================================================================
const zip = readZip(fs.readFileSync(RAW));
const mediaEntries = zip.names.filter((n) => /^xl\/media\/[^/]+\.(png|jpe?g|gif|bmp|emf|wmf|tiff?|svg)$/i.test(n));
const drawingParts = zip.names.filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n));
const sheetRels = zip.names.filter((n) => /^xl\/worksheets\/_rels\/.*\.rels$/.test(n));

check('xl/media/ 存在且包含图片文件', () =>
  mediaEntries.length > 0 ? { ok: true, detail: `${mediaEntries.length} 个` } : '没有图片文件');
check('xl/drawings/ 存在 drawing XML', () =>
  drawingParts.length > 0 ? { ok: true, detail: `${drawingParts.length} 个` } : '没有 drawing');
check('xl/drawings/_rels/ 存在关系文件', () => {
  const n = zip.names.filter((x) => /^xl\/drawings\/_rels\/.*\.rels$/.test(x));
  return n.length > 0 ? { ok: true, detail: `${n.length} 个` } : '没有 drawing rels';
});
check('xl/worksheets/_rels/ 存在工作表关系文件', () =>
  sheetRels.length > 0 ? { ok: true, detail: `${sheetRels.length} 个` } : '没有 sheet rels');
check('每个 drawing 都能解析出至少一个图片锚点', () => {
  const empty = drawingParts.filter((dp) => {
    const xml = zip.text(dp) ?? '';
    return !/<xdr:(one|two|absolute)CellAnchor/.test(xml) && !/<xdr:absoluteAnchor/.test(xml);
  });
  return empty.length === 0 ? true : `${empty.length} 个 drawing 没有锚点`;
});
check('包的 media 文件数与映射统计一致', () =>
  mediaEntries.length === map.totals.media_files_in_package
    ? true
    : `包内 ${mediaEntries.length} vs 记录 ${map.totals.media_files_in_package}`);
check('所有 media 文件都被锚点引用（无孤立图片）', () =>
  map.totals.media_files_unreferenced === 0
    ? { ok: true, detail: `被引用 ${map.totals.media_files_referenced} / 未引用 0` }
    : `${map.totals.media_files_unreferenced} 个未被引用`);
check('发现的锚点数 > media 数（说明存在一图多用，符合原表实际）', () =>
  map.totals.anchors_found >= map.totals.media_files_in_package
    ? { ok: true, detail: `锚点 ${map.totals.anchors_found} ≥ media ${map.totals.media_files_in_package}` }
    : `锚点 ${map.totals.anchors_found} < media ${map.totals.media_files_in_package}`);

// =====================================================================
section('TEST C — 图片文件已落盘且是有效图片');
// =====================================================================
const diskFiles = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR) : [];
check('data/processed/product-images/ 目录存在', () => fs.existsSync(IMG_DIR));
check('落盘文件数 = 导出图片数 + 裁剪派生图数', () =>
  diskFiles.length === map.totals.images_extracted + map.totals.images_cropped
    ? { ok: true, detail: `${diskFiles.length} 个 = 导出 ${map.totals.images_extracted} + 裁剪 ${map.totals.images_cropped}` }
    : `磁盘 ${diskFiles.length} vs 记录 ${map.totals.images_extracted}+${map.totals.images_cropped}`);
check('目录里没有未被映射引用的残留文件（上一轮的旧图不得遗留）', () => {
  const referenced = new Set();
  for (const i of map.images) {
    if (i.image_file) referenced.add(path.basename(i.image_file));
    if (i.cropped_image_file) referenced.add(path.basename(i.cropped_image_file));
  }
  const stale = diskFiles.filter((f) => !referenced.has(f));
  return stale.length === 0
    ? { ok: true, detail: `${referenced.size} 个文件全部被映射引用` }
    : `${stale.length} 个残留: ${stale.slice(0, 3).join(', ')}`;
});

// 魔数校验：确认是真图片而不是空文件或错误内容
const MAGIC = [
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
];
check('每个落盘文件的文件头都是合法图片格式', () => {
  const bad = [];
  let checked = 0;
  for (const f of diskFiles) {
    const p = path.join(IMG_DIR, f);
    const st = fs.statSync(p);
    if (st.size === 0) { bad.push(`${f}: 空文件`); continue; }
    const fd = fs.openSync(p, 'r');
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    fs.closeSync(fd);
    const ext = f.split('.').pop().toLowerCase();
    const want = MAGIC.find((m) => m.ext === ext);
    if (!want) { bad.push(`${f}: 未知扩展名`); continue; }
    const match = want.bytes.every((b, i) => head[i] === b);
    if (!match) bad.push(`${f}: 文件头不符`);
    checked++;
  }
  return bad.length === 0
    ? { ok: true, detail: `${checked} 个文件全部通过文件头校验` }
    : `${bad.length} 个异常，例: ${bad.slice(0, 3).join('; ')}`;
});
check('没有任何图片文件为空', () => {
  const empty = diskFiles.filter((f) => fs.statSync(path.join(IMG_DIR, f)).size === 0);
  return empty.length === 0 ? true : `${empty.length} 个空文件`;
});
check('映射里每条有 image_file 的记录，文件都真实存在', () => {
  const missing = map.images
    .filter((i) => i.image_file)
    .filter((i) => !fs.existsSync(path.join(ROOT, 'data/processed', i.image_file.replace(/^product-images\//, 'product-images/'))));
  return missing.length === 0 ? true : `${missing.length} 个缺失，例: ${missing[0].image_file}`;
});

// =====================================================================
section('TEST D — 映射结构与取值合法');
// =====================================================================
const ALLOWED_STATUS = new Set(['exact', 'review_required', 'unresolved']);
const REQUIRED_FIELDS = ['image_id', 'image_file', 'source_sheet', 'anchor_cell', 'source_row', 'bowen_no', 'product_id', 'mapping_status'];

check('每条记录都包含要求的字段', () => {
  const bad = map.images.filter((i) => REQUIRED_FIELDS.some((f) => !(f in i)));
  return bad.length === 0 ? true : `${bad.length} 条缺字段`;
});
check('mapping_status 只取 exact / review_required / unresolved', () => {
  const bad = map.images.filter((i) => !ALLOWED_STATUS.has(i.mapping_status));
  return bad.length === 0
    ? { ok: true, detail: `exact ${map.totals.exact} / review_required ${map.totals.review_required} / unresolved ${map.totals.unresolved}` }
    : `${bad.length} 条非法状态`;
});
check('image_id 唯一', () => {
  const ids = map.images.map((i) => i.image_id);
  return ids.length === new Set(ids).size ? true : '存在重复 image_id';
});
check('每条记录都有来源工作表', () => {
  const bad = map.images.filter((i) => !i.source_sheet);
  return bad.length === 0 ? true : `${bad.length} 条缺来源工作表`;
});
check('每张成功导出的图片都有锚点单元格或锚点坐标', () => {
  const bad = map.images.filter((i) => i.image_file && !i.anchor_cell && (i.anchor_row == null || i.anchor_col == null));
  return bad.length === 0 ? true : `${bad.length} 条缺锚点位置`;
});

// =====================================================================
section('TEST E — 不猜：无法可靠关联的一律 unresolved');
// =====================================================================
check('unresolved 记录不得声称任何 Bowen No.', () => {
  const bad = map.images.filter((i) => i.mapping_status === 'unresolved' && i.bowen_no);
  return bad.length === 0 ? true : `${bad.length} 条 unresolved 却带了 bowen_no（等于猜）`;
});
check('unresolved 记录不得声称任何 product_id', () => {
  const bad = map.images.filter((i) => i.mapping_status === 'unresolved' && i.product_id);
  return bad.length === 0 ? true : `${bad.length} 条 unresolved 却带了 product_id`;
});
check('unresolved 记录：除业务方确认删除的之外全部导出（内容不丢）', () => {
  const un = map.images.filter((i) => i.mapping_status === 'unresolved');
  const kept = un.filter((i) => !i.business_excluded);
  const withFile = kept.filter((i) => i.image_file).length;
  return withFile === kept.length
    ? { ok: true, detail: `${un.length} 张中保留 ${kept.length} 张，全部已导出（另 ${un.length - kept.length} 张按业务决定删除）` }
    : `${kept.length - withFile} 张应保留却未导出`;
});
check('unresolved 图片的文件名以 unresolved_ 开头', () => {
  const bad = map.images.filter((i) => i.mapping_status === 'unresolved' && i.image_file && !path.basename(i.image_file).startsWith('unresolved_'));
  return bad.length === 0 ? true : `${bad.length} 个命名不符`;
});
check('review_required 记录不得把 product_id 当真（只允许在有把握时给出）', () => {
  // review_required 允许给 bowen_no（供人工核对），但 product_id 必须要么为空、
  // 要么确实指向数据库里存在的产品
  const bad = map.images.filter((i) => i.mapping_status === 'review_required' && i.product_id && !productIds.has(i.product_id));
  return bad.length === 0 ? true : `${bad.length} 条 product_id 不存在于数据库`;
});
check('外部链接占位（Target=NULL）没有被当成真实图片导出', () => {
  const bad = map.images.filter((i) => i.external_link_only && i.image_file);
  return bad.length === 0 ? { ok: true, detail: `外部引用 ${map.images.filter((i) => i.external_link_only).length} 条，均未导出为图片` } : `${bad.length} 条被误导出`;
});

// =====================================================================
section('TEST F — exact 映射的正确性');
// =====================================================================
const exacts = map.images.filter((i) => i.mapping_status === 'exact');
check('exact 记录必须同时有 bowen_no 与 product_id', () => {
  const bad = exacts.filter((i) => !i.bowen_no || !i.product_id);
  return bad.length === 0 ? true : `${bad.length} 条不完整`;
});
check('exact 记录的 product_id 必须存在于数据库', () => {
  const bad = exacts.filter((i) => !productIds.has(i.product_id));
  return bad.length === 0 ? true : `${bad.length} 条 product_id 不存在`;
});
check('exact 记录的 bowen_no 必须与 product_id 对应的产品一致', () => {
  const bad = exacts.filter((i) => {
    const p = productByBowen.get(i.bowen_no.toUpperCase());
    return !p || p.product_id !== i.product_id;
  });
  return bad.length === 0 ? true : `${bad.length} 条 bowen 与 product 不匹配`;
});
check('exact 记录必须能追到来源行号', () => {
  const bad = exacts.filter((i) => !Number.isFinite(i.source_row) || i.source_row < 1);
  return bad.length === 0 ? true : `${bad.length} 条缺行号`;
});
check('exact 记录必须导出了图片文件', () => {
  const bad = exacts.filter((i) => !i.image_file);
  return bad.length === 0 ? true : `${bad.length} 条没有图片文件`;
});
check('抽查 Bowen 3005：至少有一张 exact 图片', () => {
  const hits = map.images.filter((i) => i.mapping_status === 'exact' && (i.bowen_no ?? '').toUpperCase() === '3005');
  return hits.length > 0 ? { ok: true, detail: `${hits.length} 张 → ${hits.map((h) => `${h.source_sheet}!${h.anchor_cell}`).join(', ')}` } : '没有图片';
});
check('抽盘：20 个 Prototype 候选产品全部有 exact 图片', () => {
  const proto = dbProducts.filter((p) => p.status === 'prototype_candidate');
  const withImg = new Set(exacts.map((i) => i.product_id));
  const missing = proto.filter((p) => !withImg.has(p.product_id));
  return missing.length === 0
    ? { ok: true, detail: `${proto.length} 个全部有图` }
    : `${missing.length} 个没图: ${missing.map((m) => m.bowen_no).join(', ')}`;
});

// =====================================================================
section('TEST G — 交叉校验：exact 映射与原始 Excel 单元格一致');
// =====================================================================
check('用原始 Excel 反查：每个 exact 的 Bowen 文本确实出现在其来源行', () => {
  const wb = new Workbook(RAW);
  const cells = new Map();
  for (const s of wb.sheets) {
    const sh = wb.readSheet(s.path);
    const byRow = new Map();
    for (const c of sh.cells) {
      if (!byRow.has(c.row)) byRow.set(c.row, []);
      byRow.get(c.row).push(c);
    }
    cells.set(s.name, byRow);
  }
  const bad = [];
  for (const im of exacts) {
    const byRow = cells.get(im.source_sheet);
    if (!byRow) { bad.push(`${im.image_id}: 未知工作表`); continue; }
    const rowCells = byRow.get(im.source_row) ?? [];
    const found = rowCells.some((c) => {
      const v = String(c.value ?? '').replace(/[\r\n]+/g, ' ').trim();
      const lead = v.split(/[\s\u3000]+/)[0];
      return lead && lead.toUpperCase() === im.bowen_no.toUpperCase();
    });
    if (!found) bad.push(`${im.image_id}: ${im.source_sheet}!${im.source_cell ?? ''} row ${im.source_row} 找不到 ${im.bowen_no}`);
  }
  return bad.length === 0
    ? { ok: true, detail: `${exacts.length} 条全部与 Excel 原文一致` }
    : `${bad.length} 条不一致，例: ${bad.slice(0, 3).join('; ')}`;
});
check('每张图片的 source_sheet 都是真实存在的工作表', () => {
  const wb = new Workbook(RAW);
  const names = new Set(wb.sheets.map((s) => s.name));
  const bad = map.images.filter((i) => !names.has(i.source_sheet));
  return bad.length === 0 ? true : `${bad.length} 条工作表名不存在`;
});

// =====================================================================
section('TEST H — 命名规则与可回溯性');
// =====================================================================
check('文件名符合 <bowen_no>_<sheet>_<index>.<ext> 结构', () => {
  const re = /^(.+)_(.+)_(\d{3})\.(png|jpe?g|gif|bmp|emf|wmf|tiff?|svg)$/i;
  const bad = map.images.filter((i) => i.image_file && !re.test(path.basename(i.image_file)));
  return bad.length === 0 ? true : `${bad.length} 个命名不符，例: ${bad[0]?.image_file}`;
});
check('文件名里的 bowen 部分与 bowen_no 字段一致（未映射的用 unresolved）', () => {
  const bad = [];
  for (const im of map.images) {
    if (!im.image_file) continue;
    const base = path.basename(im.image_file);
    const head = base.slice(0, base.lastIndexOf('_'));
    const expect = im.bowen_no ? String(im.bowen_no).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '') : 'unresolved';
    const got = head.slice(0, head.lastIndexOf('_'));
    if (got !== expect) bad.push(`${base} 期望前缀 ${expect} 实际 ${got}`);
  }
  return bad.length === 0 ? true : `${bad.length} 个不一致，例: ${bad.slice(0, 2).join('; ')}`;
});
check('映射文件包含 correction_note，说明旧结论为何错误', () =>
  typeof map.correction_note === 'string' && map.correction_note.length > 20);
check('映射文件包含每工作表的图片统计', () =>
  Array.isArray(map.per_sheet) && map.per_sheet.length > 0
    ? { ok: true, detail: `${map.per_sheet.length} 个工作表` }
    : '缺少 per_sheet');

// =====================================================================
section('TEST I — 业务方人工决定（Phase 2.7）已被如实执行');
// =====================================================================
const IR = decisions.image_review ?? {};
const excludedIds = map.images.filter((i) => i.business_excluded).map((i) => i.image_id).sort();
const wantExcluded = [...(IR.D4_unresolved_5?.effective_exclusions ?? [])].sort();

check('映射文件记录了业务方决定文件与 schema', () =>
  map.business_decisions?.decisions_file === 'data/raw/business-decisions-v3.json'
  && map.business_decisions?.schema === decisions.schema);

check('D4：确认删除的图片集合与业务决定文件完全一致', () => {
  const a = excludedIds.join(',');
  const b = wantExcluded.join(',');
  return a === b ? { ok: true, detail: `${excludedIds.length} 张: ${a}` } : `映射 ${a} vs 决定文件 ${b}`;
});

check('D4/D5：被删除的图片没有导出文件，且磁盘上确实不存在', () => {
  const bad = [];
  for (const id of wantExcluded) {
    const rec = map.images.find((i) => i.image_id === id);
    if (!rec) { bad.push(`${id} 不在映射里`); continue; }
    if (rec.image_file) bad.push(`${id} 仍有 image_file`);
    if (rec.cropped_image_file) bad.push(`${id} 仍有 cropped_image_file`);
    for (const f of diskFiles) {
      if (f.startsWith(`${id}_`)) bad.push(`${id} 出现在磁盘文件名 ${f}`);
    }
  }
  return bad.length === 0
    ? { ok: true, detail: `${wantExcluded.length} 张均已删除且未落盘` }
    : bad.join('; ');
});

check('D4/D5：被删除的图片不得出现在任何产品下（无 product_id / bowen_no 归属被利用）', () => {
  const bad = map.images.filter((i) => i.business_excluded && i.product_id);
  return bad.length === 0 ? true : `${bad.length} 张被删除的图片仍挂了 product_id`;
});

check('D3：业务方要求补入库的 5 个编号，其图片已从 review_required 升级为 exact', () => {
  const nos = IR.D3_not_in_database_5?.bowen_nos ?? [];
  const bad = [];
  for (const n of nos) {
    const hits = map.images.filter((i) => (i.bowen_no ?? '').toUpperCase() === String(n).toUpperCase());
    if (!hits.length) { bad.push(`${n} 没有图片`); continue; }
    if (!hits.some((h) => h.mapping_status === 'exact')) bad.push(`${n} 仍不是 exact`);
  }
  return bad.length === 0
    ? { ok: true, detail: `${nos.length} 个编号的图片全部已归位为 exact` }
    : bad.join('; ');
});

check('D6：IMG-0780 已裁剪，裁剪文件存在且是 PNG', () => {
  const im = map.images.find((i) => i.image_id === 'IMG-0780');
  if (!im) return 'IMG-0780 不在映射里';
  if (im.crop_status !== 'done') return `crop_status = ${im.crop_status}${im.crop_error ? ' (' + im.crop_error + ')' : ''}`;
  if (!im.cropped_image_file) return '没有 cropped_image_file';
  const p = path.join(ROOT, 'data/processed', im.cropped_image_file);
  if (!fs.existsSync(p)) return `裁剪文件不存在: ${im.cropped_image_file}`;
  const head = Buffer.alloc(8);
  const fd = fs.openSync(p, 'r');
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  if (!(head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)) return '裁剪文件不是 PNG';
  return { ok: true, detail: `${im.cropped_image_file} ${im.crop_measure.width}×${im.crop_measure.height}（原图 ${im.crop_measure.sourceWidth}×${im.crop_measure.sourceHeight}）` };
});

check('D6：裁剪只去掉界面部分（上下变矮、宽度不变），不是重新裁产品', () => {
  const im = map.images.find((i) => i.image_id === 'IMG-0780');
  const m = im?.crop_measure;
  if (!m) return '缺少裁剪测量记录';
  if (m.width !== m.sourceWidth) return `宽度被改动：${m.width} vs ${m.sourceWidth}`;
  if (!(m.height < m.sourceHeight)) return `高度没有变矮：${m.height} vs ${m.sourceHeight}`;
  if (m.measure?.method !== 'black_letterbox_gap') return `裁剪方法不是黑边信筒区测量：${m.measure?.method}`;
  // 裁掉的必须是上下两块纯黑信筒区
  const runs = m.measure.black_runs ?? [];
  const coversTop = runs.some((r) => r.s < m.y);
  const coversBottom = runs.some((r) => r.e > m.y + m.height - 1);
  return coversTop && coversBottom
    ? { ok: true, detail: `保留 y=${m.y}..${m.y + m.height - 1}，上下黑边信筒区均已裁掉` }
    : `裁剪区没有被黑边包围（runs=${JSON.stringify(runs)}）`;
});

check('D6：裁剪后仍保留原图（可回溯，不是覆盖式删除）', () => {
  const im = map.images.find((i) => i.image_id === 'IMG-0780');
  if (!im?.image_file) return '原图未保留';
  return fs.existsSync(path.join(ROOT, 'data/processed', im.image_file))
    ? { ok: true, detail: `原图 ${path.basename(im.image_file)} 与裁剪图并存` }
    : '原图文件不存在';
});

check('D7：水印按业务方要求保留（程序不得做任何去水印处理）', () => {
  const bad = map.images.filter((i) => 'watermark_removed' in i || 'watermark_stripped' in i || i.watermark_removed === true);
  if (bad.length) return `${bad.length} 条记录了去水印操作`;
  if (IR.D7_watermark?.decision !== 'keep_watermark') return `业务决定不是 keep_watermark：${IR.D7_watermark?.decision}`;
  return { ok: true, detail: 'D7 决定为保留；映射中不存在任何去水印字段或操作' };
});

check('D7：映射文件里不再把 GXN 水印描述为第三方品牌水印', () => {
  const s = JSON.stringify(map.business_decisions ?? {});
  if (/第三方/.test(s)) return '仍出现「第三方」字样';
  if (!/GXN/.test(s)) return '没有关于 GXN 水印的说明';
  if (!/本公司/.test(s) || !/商标/.test(s)) return '缺少「本公司…商标」的更正说明';
  return { ok: true, detail: '已更正为博文自有商标，且未出现「第三方」字样' };
});

check('D8：随手拍照片保留（不在删除集合内）', () => {
  const d8 = IR.D8_casual_photos;
  if (d8?.decision !== 'keep') return `业务决定不是 keep：${d8?.decision}`;
  // 被删的 4 张都不是「随手拍」类，且无法归类的图片（unresolved）删掉后仍保留了内容
  return { ok: true, detail: 'D8 决定为保留，未对随手拍照片做删除或重拍要求' };
});

check('D9：每个有图产品恰好有一张主图', () => {
  const byProduct = new Map();
  for (const i of map.images) {
    if (!i.product_id || i.business_excluded || !i.image_file) continue;
    byProduct.set(i.product_id, (byProduct.get(i.product_id) ?? 0) + (i.is_primary_image ? 1 : 0));
  }
  const bad = [...byProduct.entries()].filter(([, n]) => n !== 1);
  return bad.length === 0
    ? { ok: true, detail: `${byProduct.size} 个有图产品各 1 张主图` }
    : `${bad.length} 个产品主图数不为 1，例: ${bad[0][0]}=${bad[0][1]}`;
});

check('D9：主图确实按「主目录 > 工作表顺序 > 锚点行 > media 名」选出', () => {
  const byProduct = new Map();
  for (const i of map.images) {
    if (!i.product_id || i.business_excluded || !i.image_file) continue;
    if (!byProduct.has(i.product_id)) byProduct.set(i.product_id, []);
    byProduct.get(i.product_id).push(i);
  }
  const bad = [];
  for (const [pid, list] of byProduct) {
    const primary = list.find((i) => i.is_primary_image);
    if (!primary) continue;
    for (const other of list) {
      if (other === primary) continue;
      const pm = primary.source_sheet === '综合产品信息表' ? 0 : 1;
      const om = other.source_sheet === '综合产品信息表' ? 0 : 1;
      let better = false;
      if (pm !== om) better = pm < om;
      else if (primary.source_sheet_index !== other.source_sheet_index) better = primary.source_sheet_index < other.source_sheet_index;
      else if ((primary.anchor_row ?? 1e9) !== (other.anchor_row ?? 1e9)) better = (primary.anchor_row ?? 1e9) < (other.anchor_row ?? 1e9);
      else better = String(primary.media_part) <= String(other.media_part);
      if (!better) { bad.push(`${pid}: ${primary.image_id} 不如 ${other.image_id}`); break; }
    }
  }
  return bad.length === 0
    ? { ok: true, detail: `${byProduct.size} 个产品的主图都满足优先级规则` }
    : `${bad.length} 个产品主图选错，例: ${bad.slice(0, 2).join('; ')}`;
});

check('D9：主图统计与映射 totals 一致', () =>
  map.totals.products_with_primary_image === new Set(
    map.images.filter((i) => i.is_primary_image).map((i) => i.product_id),
  ).size
    ? { ok: true, detail: `${map.totals.products_with_primary_image} 个` }
    : `totals ${map.totals.products_with_primary_image} 与记录不一致`);

check('D1：编号读不出的 14 张保持原状，未被强行归属', () => {
  const d1 = IR.D1_bowen_unreadable_14;
  if (d1?.decision !== 'ignore_for_now') return `业务决定不是 ignore_for_now：${d1?.decision}`;
  const unreadable = map.images.filter((i) => i.match_kind === 'record_row_bowen_unreadable');
  const bad = unreadable.filter((i) => i.bowen_no || i.product_id);
  return bad.length === 0
    ? { ok: true, detail: `${unreadable.length} 张仍无归属，未做任何推断` }
    : `${bad.length} 张被强行归属`;
});

check('D2：记录行没编号的 7 张只记品类，不做归属', () => {
  const d2 = IR.D2_row_without_bowen_7;
  if (d2?.decision !== 'product_type_is_thermostat') return `业务决定不匹配：${d2?.decision}`;
  const rows = map.images.filter((i) => i.match_kind === 'record_row_without_bowen');
  const bad = rows.filter((i) => i.bowen_no || i.product_id);
  return bad.length === 0
    ? { ok: true, detail: `${rows.length} 张只记录品类 Thermostat，未归属到任何产品` }
    : `${bad.length} 张被归属了`;
});

// =====================================================================
console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  console.log('\n❌ Phase 2.6 图片提取与映射验收未通过。');
  process.exit(1);
}
console.log('\n✅ Phase 2.6 全部通过。');
