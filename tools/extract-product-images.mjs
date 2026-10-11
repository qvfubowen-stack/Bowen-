#!/usr/bin/env node
/**
 * Phase 2.6 — Excel 嵌入图片提取与映射
 * ===========================================================================
 * 背景（重要更正）：
 *   之前报告说「Excel 图片列为空，所以没有产品图片」——**这个结论是错的**。
 *   图片列（图片 / B 列）的**单元格值**确实是空的，因为图片不是单元格值，
 *   而是以**浮动绘图对象**的形式嵌在工作表里，保存在：
 *       xl/media/               实际图片二进制
 *       xl/drawings/*.xml       每张图的锚点（from row / col）
 *       xl/drawings/_rels/*     锚点里的 r:embed → media 文件
 *       xl/worksheets/_rels/*   工作表 → drawing
 *   只读 cell.value 永远看不到它们。本脚本改从 OOXML 绘图层提取。
 *
 * 铁律：
 *   1. 只读原始 Excel，绝不修改（运行前后校验 SHA-256）。
 *   2. 关联不上的图片一律标 unresolved，**绝不猜**。
 *   3. 每张图片都保留来源 worksheet + 锚点单元格，可回溯。
 *
 * 用法：node tools/extract-product-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { readZip } from './xlsx-reader.mjs';
import { findHeaderRow, buildBlocks, groupByRow } from './lib/v2-layout.mjs';
import { Workbook } from './xlsx-reader.mjs';
import { cropToContent } from './lib/image-crop.mjs';
import { removeTree } from './lib/fsx.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_EXCEL = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const MANIFEST = path.join(ROOT, 'data/raw/SOURCE-MANIFEST.json');
const DECISIONS = path.join(ROOT, 'data/raw/business-decisions-v3.json');
const IMG_DIR = path.join(ROOT, 'data/processed/product-images');
const OUT_JSON = path.join(ROOT, 'data/processed/product-image-map.json');
const DB_PRODUCTS = path.join(ROOT, 'data/derived/v2/products.json');
const DB_APPS = path.join(ROOT, 'data/derived/v2/product-applications.json');

const log = (...a) => console.log(...a);
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------------------------------------------------------------- 前置校验
log('=== Phase 2.6 Excel 嵌入图片提取 ===');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const expected = manifest.sources.product_excel_v2.sha256;
const before = sha256(RAW_EXCEL);
if (before !== expected) {
  console.error(`FATAL 原始 Excel SHA-256 与冻结清单不一致\n  期望 ${expected}\n  实际 ${before}`);
  process.exit(2);
}
log(`原始 Excel SHA-256 校验通过 ${before.slice(0, 16)}…`);

// ---------------------------------------------------------------- 业务方决定（Phase 2.7）
/**
 * 业务方对本轮 9 个图片问题的逐条回答。程序只执行这里写明的决定，不做任何补充推断。
 * 见 data/raw/business-decisions-v3.json 的 image_review 段。
 */
if (!fs.existsSync(DECISIONS)) {
  console.error(`FATAL 找不到业务方决定文件 ${path.relative(ROOT, DECISIONS)}`);
  process.exit(3);
}
const decisions = JSON.parse(fs.readFileSync(DECISIONS, 'utf8'));
const D = decisions.image_review ?? {};

/** D4/D5：确认删除的图片（IMG-0780 依 D6 例外，裁剪后保留） */
const EXCLUDED_IMAGES = new Map();
for (const id of (D.D4_unresolved_5?.effective_exclusions ?? [])) {
  EXCLUDED_IMAGES.set(id, { decided_by: 'D4_unresolved_5', reason: '业务方确认删除（确认删除）' });
}
{
  const d5 = D.D5_IMG_0723;
  if (d5?.decision === 'exclude_from_library') {
    const prev = EXCLUDED_IMAGES.get('IMG-0723');
    EXCLUDED_IMAGES.set('IMG-0723', {
      decided_by: prev ? 'D4_unresolved_5+D5_IMG_0723' : 'D5_IMG_0723',
      reason: '原图是内部系统页面截图（含内部进价/售价），业务方决定忽略该产品',
    });
  }
}

/** D6：先裁剪再保留的图片 */
const CROP_RULES = new Map();
if (D.D6_IMG_0780?.decision === 'crop_then_keep') {
  CROP_RULES.set('IMG-0780', {
    decided_by: 'D6_IMG_0780',
    mode: D.D6_IMG_0780.crop?.mode ?? 'trim_ui_frame',
    note: '手机截图：裁掉系统状态栏、纯黑信筒区与相册底栏，只留产品图',
  });
}

/** D9：主图选择规则（确定性、可复现） */
const PRIMARY_RULE = D.D9_main_image?.rule?.priority ?? [];

log(`业务方图片决定：删除 ${EXCLUDED_IMAGES.size} 张（${[...EXCLUDED_IMAGES.keys()].join(', ')}），`
  + `裁剪 ${CROP_RULES.size} 张（${[...CROP_RULES.keys()].join(', ')}）`);

// ---------------------------------------------------------------- zip 层
const buf = fs.readFileSync(RAW_EXCEL);
const zip = readZip(buf);
const zipNames = zip.names;

/**
 * OOXML 部件的 rels 路径规则：
 *   xl/worksheets/sheet1.xml            → xl/worksheets/_rels/sheet1.xml.rels
 *   xl/drawings/drawing1.xml            → xl/drawings/_rels/drawing1.xml.rels
 *   <dir>/<name>                        → <dir>/_rels/<name>.rels
 * 注意：不是把 "xl/" 换成 "xl/_rels/"。
 */
function relsPathFor(partPath) {
  const dir = path.posix.dirname(partPath);
  const base = path.posix.basename(partPath);
  return `${dir}/_rels/${base}.rels`;
}

/** 解析一个 .rels 文件 → Map<Id, {target, mode, type}> */
function parseRels(relsPath) {
  const xml = zip.text(relsPath);
  const map = new Map();
  if (!xml) return map;
  for (const m of xml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const tag = m[0];
    const id = (tag.match(/Id="([^"]*)"/) || [])[1];
    const target = (tag.match(/Target="([^"]*)"/) || [])[1];
    const mode = (tag.match(/TargetMode="([^"]*)"/) || [])[1] || 'Internal';
    const type = (tag.match(/Type="([^"]*)"/) || [])[1] || '';
    if (id) map.set(id, { target: target ?? '', mode, type });
  }
  return map;
}

/**
 * 把 rels 里的相对 Target 解析成 zip 内绝对路径。
 * 关键：按 OPC 规范，Target 是相对于**拥有该 rels 的部件**（source part）的目录，
 * 不是相对于 .rels 文件本身。
 *   部件 xl/worksheets/sheet17.xml，Target="../drawings/drawing17.xml"
 *     → 基准目录 xl/worksheets  → xl/drawings/drawing17.xml   ✅
 *   若错误地以 xl/worksheets/_rels 为基准，会得到
 *     xl/worksheets/drawings/drawing17.xml                      ❌（读不到文件）
 */
function resolveTarget(sourcePartPath, target) {
  if (!target) return null;
  if (/^[a-z]+:\/\//i.test(target)) return null;         // 外部链接
  if (target === 'NULL') return null;
  const dir = path.posix.dirname(sourcePartPath);
  return path.posix.normalize(path.posix.join(dir, target));
}

// ---------------------------------------------------------------- 工作表 → drawing
const wb = new Workbook(RAW_EXCEL);
/** sheetName → { sheetIndex, sheetPath, drawingPath } */
const sheetDrawing = new Map();
for (let i = 0; i < wb.sheets.length; i++) {
  const s = wb.sheets[i];
  const relsPath = relsPathFor(s.path);
  const rels = parseRels(relsPath);
  let drawingPath = null;
  for (const { target, type } of rels.values()) {
    if (/\/drawing$/.test(type)) {
      drawingPath = resolveTarget(s.path, target);
      break;
    }
  }
  sheetDrawing.set(s.name, { sheetIndex: i, sheetPath: s.path, drawingPath, relsPath });
}

log('\n工作表 → drawing 映射：');
for (const [name, v] of sheetDrawing) {
  log(`  ${name.padEnd(16)} sheet=${path.posix.basename(v.sheetPath)}  drawing=${v.drawingPath ? path.posix.basename(v.drawingPath) : '(无)'}`);
}

// ---------------------------------------------------------------- 解析每个 drawing 的锚点
/**
 * 锚点类型：
 *   xdr:twoCellAnchor  —— from / to，图片跨多个单元格
 *   xdr:oneCellAnchor  —— from / ext，从某格开始固定尺寸
 *   xdr:absoluteAnchor —— 绝对坐标，没有 from，无法定位到行 → unresolved
 * 图片引用：<a:blip r:embed="rIdN">（r:link 指向外部 NULL，不是真实图片，忽略）
 */
function parseDrawingAnchors(drawingPath) {
  const xml = zip.text(drawingPath);
  if (!xml) return [];
  const relsPath = relsPathFor(drawingPath);
  const rels = parseRels(relsPath);

  const anchors = [];
  // 按锚点类型切块，逐个解析（不能用贪婪正则跨块匹配）
  const anchorRe = /<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[^>]*>([\s\S]*?)<\/xdr:\1>/g;
  let m;
  let ordinal = 0;
  while ((m = anchorRe.exec(xml)) !== null) {
    const kind = m[1];
    const body = m[2];
    ordinal += 1;

    const from = body.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/);
    let fromCol = null;
    let fromRow = null;
    let fromColOff = null;
    let fromRowOff = null;
    if (from) {
      const c = from[1].match(/<xdr:col>(\d+)<\/xdr:col>/);
      const r = from[1].match(/<xdr:row>(\d+)<\/xdr:row>/);
      const co = from[1].match(/<xdr:colOff>(-?\d+)<\/xdr:colOff>/);
      const ro = from[1].match(/<xdr:rowOff>(-?\d+)<\/xdr:rowOff>/);
      fromCol = c ? Number(c[1]) : null;
      fromRow = r ? Number(r[1]) : null;
      fromColOff = co ? Number(co[1]) : 0;
      fromRowOff = ro ? Number(ro[1]) : 0;
    }

    const to = body.match(/<xdr:to>([\s\S]*?)<\/xdr:to>/);
    let toRow = null;
    let toCol = null;
    if (to) {
      const c = to[1].match(/<xdr:col>(\d+)<\/xdr:col>/);
      const r = to[1].match(/<xdr:row>(\d+)<\/xdr:row>/);
      toCol = c ? Number(c[1]) : null;
      toRow = r ? Number(r[1]) : null;
    }

    // 图片：取第一个 <a:blip r:embed="...">
    const blips = [...body.matchAll(/<a:blip\b[^>]*\/?>/g)].map((b) => b[0]);
    const picEmbeds = [];
    for (const b of blips) {
      const embed = (b.match(/r:embed="([^"]*)"/) || [])[1];
      const link = (b.match(/r:link="([^"]*)"/) || [])[1];
      if (embed) picEmbeds.push({ kind: 'embed', rid: embed });
      else if (link) picEmbeds.push({ kind: 'link', rid: link });
    }

    // 图形名称（cNvPr name），有时含编号线索
    const nameM = body.match(/<xdr:cNvPr[^>]*\bname="([^"]*)"/);
    const idM = body.match(/<xdr:cNvPr[^>]*\bid="(\d+)"/);

    anchors.push({
      anchor_kind: kind,
      anchor_ordinal: ordinal,
      from_col_0: fromCol,
      from_row_0: fromRow,
      from_col_off: fromColOff,
      from_row_off: fromRowOff,
      to_col_0: toCol,
      to_row_0: toRow,
      shape_name: nameM ? nameM[1] : null,
      shape_id: idM ? Number(idM[1]) : null,
      refs: picEmbeds,
      rels,
    });
  }
  return anchors;
}

// ---------------------------------------------------------------- 解析工作表记录，建立 row → bowen 索引
/** 每个工作表：headerRow、blocks、以及 row → block → bowen_no 的映射 */
const sheetRecords = new Map();
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const headerRow = findHeaderRow(sh);
  if (headerRow === null) {
    sheetRecords.set(s.name, { headerRow: null, blocks: [], byRow: new Map(), maxRow: sh.maxRow, maxCol: sh.maxCol });
    continue;
  }
  const byRowCells = groupByRow(sh.cells);
  const blocks = buildBlocks([...byRowCells.get(headerRow).values()], sh.maxCol);
  const byRow = new Map(); // excelRow -> Map<blockStart, { bowen, oe, vehicle, blank }>
  for (const row of [...byRowCells.keys()].sort((a, b) => a - b)) {
    const m = byRowCells.get(row);
    const perBlock = new Map();
    for (const b of blocks) {
      const oe = String(m.get(b.oe)?.value ?? '').trim();
      const veh = String(m.get(b.veh)?.value ?? '').trim();
      const bw = String(m.get(b.bowen)?.value ?? '').trim();
      perBlock.set(b.start, { bowen: bw, oe, vehicle: veh, hasData: !!(oe || veh || bw) });
    }
    byRow.set(row, perBlock);
  }
  sheetRecords.set(s.name, { headerRow, blocks, byRow, maxRow: sh.maxRow, maxCol: sh.maxCol });
}

// ---------------------------------------------------------------- 数据库索引：bowen → product
const dbProducts = JSON.parse(fs.readFileSync(DB_PRODUCTS, 'utf8'));
const dbApps = JSON.parse(fs.readFileSync(DB_APPS, 'utf8'));
const productByBowen = new Map();
for (const p of dbProducts) {
  if (p.bowen_no) productByBowen.set(p.bowen_no.toUpperCase(), p);
}
const appByProduct = new Map();
for (const a of dbApps) {
  if (!appByProduct.has(a.product_id)) appByProduct.set(a.product_id, []);
  appByProduct.get(a.product_id).push(a);
}

// 从 Bowen 单元格原文里取「首个合法编号」——与数据库构建脚本同一口径
const BOWEN_ALLOWED_RE = /^[A-Za-z0-9][A-Za-z0-9\-_.\/]*$/;
function leadingBowen(cellText) {
  const t = String(cellText ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!t) return null;
  const first = t.split(/[\s\u3000]+/)[0];
  if (!BOWEN_ALLOWED_RE.test(first)) return null;
  if (first.length > 20) return null;
  return first;
}

// ---------------------------------------------------------------- 提取
function colLetter(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '');

// 每次都从零生成：先清空目录，避免上一轮导出的图片（含本轮决定删除的）残留。
// 注意：本环境里 fs.rmSync 会静默失效，必须用 removeTree（见 tools/lib/fsx.mjs）。
removeTree(IMG_DIR);
fs.mkdirSync(IMG_DIR, { recursive: true });

/** 主目录工作表名（D9 主图规则的优先级 1） */
const MASTER_SHEET = '综合产品信息表';

const images = [];
const perSheetCount = new Map();
const extCounter = new Map(); // sheet -> counter，用于文件名里的 index
let imageSeq = 0;

for (const [sheetName, info] of sheetDrawing) {
  if (!info.drawingPath) continue;
  const anchors = parseDrawingAnchors(info.drawingPath);
  perSheetCount.set(sheetName, anchors.length);
  const rec = sheetRecords.get(sheetName);

  /** 记录来源工作表上的图 sorted by row then col 之后的序号 */
  const ordered = anchors
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.from_row_0 ?? 1e9) - (y.a.from_row_0 ?? 1e9) || (x.a.from_col_0 ?? 1e9) - (y.a.from_col_0 ?? 1e9));

  let idx = 0;
  for (const { a } of ordered) {
    idx += 1;

    // 解析真实图片文件：只认 r:embed（r:link 指向外部 NULL，不是包内图片）
    const embedRef = a.refs.find((r) => r.kind === 'embed');
    let mediaPath = null;
    let externalOnly = false;
    if (embedRef) {
      const rel = a.rels.get(embedRef.rid);
      if (rel && rel.mode === 'Internal') {
        mediaPath = resolveTarget(info.drawingPath, rel.target);
      } else if (rel) {
        externalOnly = true;
      }
    } else if (a.refs.some((r) => r.kind === 'link')) {
      externalOnly = true;
    }

    // 锚点 → Excel 行列（OOXML 里 row/col 是 0 基）
    const excelRow = a.from_row_0 != null ? a.from_row_0 + 1 : null;
    const excelCol = a.from_col_0 != null ? a.from_col_0 + 1 : null;
    const anchorCell = excelRow != null && excelCol != null ? `${colLetter(excelCol)}${excelRow}` : null;

    // 定位该列属于哪个记录区块
    let block = null;
    if (rec && excelCol != null) {
      block = rec.blocks.find((b) => excelCol >= b.start && excelCol <= b.end) ?? null;
    }

    imageSeq += 1;
    const imageId = `IMG-${String(imageSeq).padStart(4, '0')}`;

    // ---- 关联判定（三级，绝不猜）----
    let mappingStatus = 'unresolved';
    let bowenNo = null;
    let productId = null;
    let sourceRow = null;
    let matchKind = null;

    if (externalOnly) {
      matchKind = 'external_reference_only';
    } else if (!rec || rec.headerRow === null) {
      matchKind = 'sheet_has_no_product_table';
    } else if (excelRow == null || excelCol == null) {
      matchKind = 'anchor_without_cell_position';
    } else if (!block) {
      matchKind = 'anchor_outside_record_blocks';
    } else {
      // 1) 精确命中：锚点行本身就是该区块的记录行
      const sameRow = rec.byRow.get(excelRow)?.get(block.start);
      if (sameRow && sameRow.bowen) {
        const lead = leadingBowen(sameRow.bowen);
        if (lead && productByBowen.has(lead.toUpperCase())) {
          mappingStatus = 'exact';
          matchKind = 'anchor_row_is_record_row';
          bowenNo = lead;
          productId = productByBowen.get(lead.toUpperCase()).product_id;
          sourceRow = excelRow;
        } else if (lead) {
          // 有 Bowen 写法，但数据库里没有这个产品
          mappingStatus = 'review_required';
          matchKind = 'bowen_not_in_database';
          bowenNo = lead;
          sourceRow = excelRow;
        } else {
          mappingStatus = 'review_required';
          matchKind = 'record_row_bowen_unreadable';
          sourceRow = excelRow;
        }
      } else if (sameRow && sameRow.hasData) {
        // 该行有记录数据，但没有 Bowen 编号
        mappingStatus = 'review_required';
        matchKind = 'record_row_without_bowen';
        sourceRow = excelRow;
      } else {
        // 2) 非精确：在同一区块内向下寻找最近的记录行（图片常锚在记录上一行）
        const candidates = [];
        for (let r = excelRow + 1; r <= Math.min(rec.maxRow, excelRow + 4); r++) {
          const cell = rec.byRow.get(r)?.get(block.start);
          if (cell && cell.bowen) {
            const lead = leadingBowen(cell.bowen);
            if (lead) { candidates.push({ row: r, bowen: lead }); break; }
          }
          if (cell && cell.hasData) break; // 遇到别的记录就停止
        }
        if (candidates.length === 1) {
          const c = candidates[0];
          const inDb = productByBowen.has(c.bowen.toUpperCase());
          mappingStatus = 'review_required';
          matchKind = inDb ? 'anchored_above_record_row' : 'anchored_above_record_row_not_in_database';
          bowenNo = c.bowen;
          sourceRow = c.row;
          if (inDb) productId = productByBowen.get(c.bowen.toUpperCase()).product_id;
        } else {
          matchKind = 'no_record_row_found_in_block';
        }
      }
    }

    // ---- 业务方决定：确认删除的图片不导出、也不进入任何产品 ----
    const exclusion = EXCLUDED_IMAGES.get(imageId) ?? null;
    const cropRule = CROP_RULES.get(imageId) ?? null;

    // ---- 写出图片文件 ----
    let imageFile = null;
    if (exclusion) {
      // 业务方明确要求删除：不写文件（不猜、也不保留副本）
      matchKind = matchKind ?? 'excluded_by_business_decision';
    } else if (mediaPath && zip.has(mediaPath)) {
      const ext = (path.posix.extname(mediaPath) || '.bin').toLowerCase();
      const bowenPart = bowenNo ? safeName(bowenNo) : 'unresolved';
      const sheetPart = safeName(sheetName);
      const key = `${sheetName}`;
      const n = (extCounter.get(key) ?? 0) + 1;
      extCounter.set(key, n);
      const fileName = `${bowenPart}_${sheetPart}_${String(n).padStart(3, '0')}${ext}`;
      const outPath = path.join(IMG_DIR, fileName);
      const bytes = zip.read(mediaPath);
      if (bytes && bytes.length) {
        fs.writeFileSync(outPath, bytes);
        imageFile = `product-images/${fileName}`;
      }
    } else if (mediaPath) {
      matchKind = matchKind ?? 'media_entry_missing';
    }

    images.push({
      image_id: imageId,
      image_file: imageFile,
      source_sheet: sheetName,
      source_sheet_index: info.sheetIndex,
      drawing_part: info.drawingPath,
      drawing_anchor_kind: a.anchor_kind,
      drawing_anchor_ordinal_in_drawing: a.anchor_ordinal,
      drawing_shape_name: a.shape_name,
      drawing_shape_id: a.shape_id,
      anchor_cell: anchorCell,
      anchor_col_letter: excelCol != null ? colLetter(excelCol) : null,
      anchor_row: excelRow,
      anchor_col: excelCol,
      to_row: a.to_row_0 != null ? a.to_row_0 + 1 : null,
      to_col: a.to_col_0 != null ? a.to_col_0 + 1 : null,
      anchor_row_offset_emu: a.from_row_off,
      anchor_col_offset_emu: a.from_col_off,
      block_start_col: block ? block.start : null,
      block_bowen_col: block ? block.bowen : null,
      source_row: sourceRow,
      bowen_no: bowenNo,
      product_id: productId,
      mapping_status: mappingStatus,
      match_kind: matchKind,
      media_part: mediaPath,
      media_bytes: mediaPath && zip.has(mediaPath) ? zip.read(mediaPath).length : null,
      external_link_only: externalOnly,

      // ---- 业务方决定（Phase 2.7）----
      business_excluded: !!exclusion,
      business_exclusion: exclusion,
      business_crop: cropRule,
      business_note: exclusion
        ? exclusion.reason
        : (cropRule ? cropRule.note : null),
    });
  }
}

// ---------------------------------------------------------------- D6 裁剪（确定性，可用 Chrome 测像素）
let cropOutcome = { status: 'not_required', items: [] };
{
  const targets = images.filter((i) => i.business_crop && i.image_file && !i.business_excluded);
  if (targets.length) {
    const items = [];
    for (const im of targets) {
      const srcAbs = path.join(ROOT, 'data/processed', im.image_file);
      const croppedName = im.image_file.replace(/\.(jpe?g|png|gif|webp)$/i, '') + '_cropped.png';
      const dstAbs = path.join(ROOT, 'data/processed', croppedName);
      try {
        const r = await cropToContent(srcAbs, dstAbs);
        im.crop_status = 'done';
        im.cropped_image_file = croppedName;
        im.crop_measure = r;
        im.crop_source_bytes = fs.statSync(srcAbs).size;
        im.cropped_image_bytes = fs.statSync(dstAbs).size;
        items.push({ image_id: im.image_id, status: 'done', ...r });
        log(`D6 裁剪完成 ${im.image_id} → ${croppedName}  (${r.width}×${r.height}，方法 ${r.measure.method})`);
      } catch (e) {
        // 不静默：记录失败原因，验收测试会因此 FAIL，避免「以为裁好了」
        im.crop_status = 'failed';
        im.crop_error = String(e.message ?? e);
        items.push({ image_id: im.image_id, status: 'failed', error: im.crop_error });
        log(`D6 裁剪失败 ${im.image_id}: ${im.crop_error}`);
      }
    }
    cropOutcome = {
      status: items.every((i) => i.status === 'done') ? 'done' : 'failed',
      method: 'Chrome canvas 像素测量 + CDP clip 截图（零第三方依赖）',
      items,
    };
  }
}

// ---------------------------------------------------------------- D9 主图（确定性规则）
/**
 * 同一 Bowen 有多张图时选主图。规则来自业务方 D9「主图你自己选择」，实现为可复现的优先级：
 *   1. 来源工作表 = 综合产品信息表
 *   2. sheet_index 升序
 *   3. anchor_row 升序
 *   4. media_part 字典序
 */
const primaryGroups = new Map();
for (const im of images) {
  if (!im.product_id || im.business_excluded || !im.image_file) continue;
  const k = im.product_id;
  if (!primaryGroups.has(k)) primaryGroups.set(k, []);
  primaryGroups.get(k).push(im);
}
let primaryCount = 0;
for (const [, list] of primaryGroups) {
  const sorted = [...list].sort((a, b) => {
    const am = a.source_sheet === MASTER_SHEET ? 0 : 1;
    const bm = b.source_sheet === MASTER_SHEET ? 0 : 1;
    if (am !== bm) return am - bm;
    if (a.source_sheet_index !== b.source_sheet_index) return a.source_sheet_index - b.source_sheet_index;
    if ((a.anchor_row ?? 1e9) !== (b.anchor_row ?? 1e9)) return (a.anchor_row ?? 1e9) - (b.anchor_row ?? 1e9);
    return String(a.media_part).localeCompare(String(b.media_part));
  });
  sorted.forEach((im, i) => {
    im.is_primary_image = i === 0;
    im.primary_rank = i + 1;
    im.primary_image_rule = 'D9: master_sheet > sheet_index > anchor_row > media_part';
  });
  primaryCount += 1;
}
for (const im of images) {
  if (im.is_primary_image === undefined) { im.is_primary_image = false; im.primary_rank = null; im.primary_image_rule = null; }
}
log(`D9 主图：为 ${primaryCount} 个产品选出主图`);

// ---------------------------------------------------------------- 统计
const statusCounts = {};
for (const im of images) statusCounts[im.mapping_status] = (statusCounts[im.mapping_status] ?? 0) + 1;

const mediaEntries = zipNames.filter((n) => /^xl\/media\/[^/]+\.(png|jpe?g|gif|bmp|emf|wmf|tiff?|svg)$/i.test(n));
const mediaUsed = new Set(images.map((i) => i.media_part).filter(Boolean));

const mappedBowen = new Set(images.filter((i) => i.mapping_status === 'exact' && i.bowen_no).map((i) => i.bowen_no.toUpperCase()));
const mappedProducts = new Set(images.filter((i) => i.product_id).map((i) => i.product_id));

const perSheet = [...perSheetCount.entries()].map(([sheet, count]) => ({
  sheet_name: sheet,
  sheet_index: sheetDrawing.get(sheet).sheetIndex,
  image_count: count,
  exact: images.filter((i) => i.source_sheet === sheet && i.mapping_status === 'exact').length,
  review_required: images.filter((i) => i.source_sheet === sheet && i.mapping_status === 'review_required').length,
  unresolved: images.filter((i) => i.source_sheet === sheet && i.mapping_status === 'unresolved').length,
  business_excluded: images.filter((i) => i.source_sheet === sheet && i.business_excluded).length,
}));

const map = {
  generated_at: new Date().toISOString(),
  source_excel: {
    path: 'data/raw/产品信息表1(1).xlsx',
    sha256: before,
    bytes: fs.statSync(RAW_EXCEL).size,
  },
  correction_note:
    '之前的报告称「Excel 图片列为空，没有产品图片」，该结论不正确。图片不在单元格值里，' +
    '而是以 OOXML 浮动绘图对象（xl/drawings + xl/media）嵌入。本文件从绘图层提取。',
  business_decisions: {
    decisions_file: 'data/raw/business-decisions-v3.json',
    schema: decisions.schema,
    decided_at: decisions.decided_at,
    D1_bowen_unreadable_14: {
      decision: D.D1_bowen_unreadable_14?.decision ?? null,
      effect: D.D1_bowen_unreadable_14?.effect ?? null,
      applied: '这 14 张图片本轮不动，归属仍为空；未做任何推断',
    },
    D2_row_without_bowen_7: {
      decision: D.D2_row_without_bowen_7?.decision ?? null,
      product_type_per_business: 'Thermostat',
      applied: '仅记录品类；因仍无 Bowen No.，不生成产品、不做归属',
    },
    D3_not_in_database_5: {
      decision: D.D3_not_in_database_5?.decision ?? null,
      bowen_nos: D.D3_not_in_database_5?.bowen_nos ?? [],
      applied: '这 5 个编号已补入产品库（见 products.json），其图片因此可归位',
    },
    D4_unresolved_5: {
      decision: D.D4_unresolved_5?.decision ?? null,
      excluded: D.D4_unresolved_5?.effective_exclusions ?? [],
      applied: '这 4 张不再导出、不出现在任何产品下',
    },
    D5_IMG_0723: {
      decision: D.D5_IMG_0723?.decision ?? null,
      applied: 'IMG-0723 已被删除（与 D4 一致）',
    },
    D6_IMG_0780: {
      decision: D.D6_IMG_0780?.decision ?? null,
      applied: `裁剪状态：${cropOutcome.status}`,
    },
    D7_watermark: {
      decision: D.D7_watermark?.decision ?? null,
      note:
        '**重要更正**：图片上的「GXN」水印是**本公司（博文）自有商标**，'
        + '此前工具把它误记为外部品牌水印，该描述作废。'
        + '业务方要求保留，程序不做任何去除处理，水印也不构成风险项。',
      applied: '水印原样保留；未做任何去水印处理',
    },
    D8_casual_photos: {
      decision: D.D8_casual_photos?.decision ?? null,
      applied: '随手拍照片保留，不要求重拍',
    },
    D9_main_image: {
      decision: D.D9_main_image?.decision ?? null,
      rule_priority: PRIMARY_RULE,
      applied: `已为 ${primaryCount} 个产品标出 is_primary_image`,
    },
  },
  crop_outcome: cropOutcome,
  totals: {
    media_files_in_package: mediaEntries.length,
    drawing_parts: zipNames.filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n)).length,
    anchors_found: images.length,
    images_extracted: images.filter((i) => i.image_file).length,
    business_excluded: images.filter((i) => i.business_excluded).length,
    images_cropped: images.filter((i) => i.crop_status === 'done').length,
    products_with_primary_image: primaryCount,
    media_files_referenced: mediaUsed.size,
    media_files_unreferenced: mediaEntries.filter((n) => !mediaUsed.has(n)).length,
    exact: statusCounts.exact ?? 0,
    review_required: statusCounts.review_required ?? 0,
    unresolved: statusCounts.unresolved ?? 0,
    distinct_bowen_mapped: mappedBowen.size,
    distinct_products_mapped: mappedProducts.size,
  },
  per_sheet: perSheet,
  images,
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(map, null, 1), 'utf8');

// ---------------------------------------------------------------- 输出
log(`\n包内 media 文件：${mediaEntries.length} 个`);
log(`drawing 部件：${map.totals.drawing_parts} 个`);
log(`发现锚点（图片对象）：${images.length} 个`);
log(`成功导出图片文件：${map.totals.images_extracted} 个 → data/processed/product-images/`);
log(`业务方决定删除：${map.totals.business_excluded} 个（未导出）`);
log(`业务方决定裁剪：${map.totals.images_cropped} 个`);
log(`被引用的 media：${mediaUsed.size} 个，未被引用：${map.totals.media_files_unreferenced} 个`);
log(`\n映射结果：`);
log(`  exact            ${map.totals.exact}`);
log(`  review_required  ${map.totals.review_required}`);
log(`  unresolved       ${map.totals.unresolved}`);
log(`  关联到 Bowen No. ${map.totals.distinct_bowen_mapped} 个编号 / ${map.totals.distinct_products_mapped} 个产品`);
log(`  主图已选出       ${map.totals.products_with_primary_image} 个产品`);

log(`\n各工作表图片数：`);
for (const s of perSheet) {
  log(`  ${s.sheet_name.padEnd(16)} ${String(s.image_count).padStart(4)} 张  (exact ${s.exact} / review ${s.review_required} / unresolved ${s.unresolved} / 删除 ${s.business_excluded})`);
}

log(`\n输出：`);
log(`  ${path.relative(ROOT, OUT_JSON)}`);
log(`  data/processed/product-images/  (${map.totals.images_extracted} 个文件)`);

const after = sha256(RAW_EXCEL);
if (after !== before) {
  console.error('\nFATAL 运行过程中原始 Excel 发生变化！');
  process.exit(5);
}
log(`\n原始 Excel SHA-256 运行后一致：${after === before}`);
