/**
 * 博文外贸独立站 — 阶段一：产品数据库清洗与标准化
 * ---------------------------------------------------------------------
 * 输入：data/raw 下全部 .xlsx（只读，绝不修改）
 * 输出：data/derived/**（全部为派生产物，原始数据永久保留）
 *
 * 不猜数据：任何无法从原文直接读出的字段一律留空 + 打状态标记。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Workbook, numToCol } from './xlsx-reader.mjs';
import {
  splitOeCell, normalizeOeNumber, oeMatchKey, cellSeparatorKinds, looksLikeOeNumber, isOversizedOe,
  parseSpecs, extractVehicleMakes, extractEngineCodes, extractDisplacements,
  parseBowenNo, bowenKey, isBlank, isGarbage, splitApplicationSegments, OE_MIN_LEN, OE_MAX_LEN,
} from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const DERIVED_DIR = path.join(ROOT, 'data', 'derived');
const DATA_VERSION = 'v1.0.0';              // 本轮清洗的规则版本号
const NOW = process.env.BOWEN_NOW || new Date().toISOString();
// 第一批上线推荐的目标区间（规划 V1 第 12 节：先选 50-100 个资料最完整的产品做样板）
const FIRST_BATCH_TARGET_MIN = 50;
const FIRST_BATCH_TARGET_MAX = 100;

// ---------------------------------------------------------------------
// 版面定义
// ---------------------------------------------------------------------
// 主表 "Product Information"：一行两块，每块 6 列（A-F / G-L），但外框到 X 列
const MASTER = {
  match: (name) => name === 'Product Information',
  blocks: [
    { tag: 'L', no: 1, image: 2, oem: 3, app: 4, bowen: 5, spec: 6 },
    { tag: 'R', no: 7, image: 8, oem: 9, app: 10, bowen: 11, spec: 12 },
  ],
  firstRow: 4,
};
// 品牌页：一行两块，每块 6 列（无 Unit Price）
const BRAND12 = {
  blocks: [
    { tag: 'L', no: 1, image: 2, oem: 3, app: 4, bowen: 5, spec: 6 },
    { tag: 'R', no: 7, image: 8, oem: 9, app: 10, bowen: 11, spec: 12 },
  ],
  firstRow: 3,
};
// 品牌页：一行两块，每块 7 列（含 Unit Price）
const BRAND14 = {
  blocks: [
    { tag: 'L', no: 1, image: 2, oem: 3, app: 4, bowen: 5, price: 6, spec: 7 },
    { tag: 'R', no: 8, image: 9, oem: 10, app: 11, bowen: 12, price: 13, spec: 14 },
  ],
  firstRow: 3,
};
// 补充表 Sheet1：单块，表头 A=Image B=OEM C=Vehicle Model D=Part No. E=Temp. F=Tianbo No.
const SHEET1 = {
  match: (name) => name === 'Sheet1',
  blocks: [{ tag: 'S', image: 1, oem: 2, app: 3, bowen: 4, temp: 5, tianbo: 6 }],
  firstRow: 2,
};

// ---------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const csv = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const writeCsv = (file, header, rows) => {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csv(r[h])).join(','));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
  return rows.length;
};
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
const uniqSorted = (arr) => [...new Set(arr)].sort();

// ---------------------------------------------------------------------
// 0. 发现原始文件
// ---------------------------------------------------------------------
function discoverRawFiles() {
  const found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.xlsx$/i.test(e.name)) found.push(p);
    }
  };
  walk(RAW_DIR);
  return found.sort();
}

// ---------------------------------------------------------------------
// 1. 抽取原始记录
// ---------------------------------------------------------------------
function detectLayout(sheetName, maxCol, headerRow) {
  if (MASTER.match(sheetName)) return { layout: MASTER, kind: 'master' };
  if (SHEET1.match(sheetName)) return { layout: SHEET1, kind: 'supplement' };
  // 依据表头文字判定：出现 "Unit Price" 的用 14 列版面
  const hdr = (headerRow || []).map((h) => String(h || '').toLowerCase());
  const hasPrice = hdr.some((h) => h.includes('unit price'));
  if (hasPrice || maxCol >= 14) return { layout: BRAND14, kind: 'brand' };
  return { layout: BRAND12, kind: 'brand' };
}

function extractRecords(wb, fileInfo) {
  const records = [];
  const sheetReports = [];
  const audit = {
    garbageCells: [],        // 被忽略的 Excel 浮点残留
    bowenAnomalies: [],
    oeAmbiguousSplits: [],
    oeNonStandard: [],
    oeOversized: [],
    oeKeptWhole: [],
    appOnSupplement: 0,      // Sheet1 中 "车型" 列其实是 OEM
    tianboField: 0,
    emptyBowenWithOem: 0,
    emptyOemWithBowen: 0,
    duplicateOemCells: [],   // 同一单元格文本在多个版面上被重复计入
  };

  for (const s of wb.sheets) {
    const sh = wb.readSheet(s.path);
    const seenCellKeys = new Set();
    const seenValueKeys = new Set();
    const grid = new Map();
    for (const c of sh.cells) grid.set(c.row + ':' + c.col, c);
    const val = (r, c) => {
      const cell = grid.get(r + ':' + c);
      if (!cell || cell.value === null || cell.value === undefined) return null;
      return cell.value;
    };
    const headerRow = [];
    for (let c = 1; c <= Math.min(sh.maxCol, 20); c++) headerRow.push(val(2, c));
    const { layout, kind } = detectLayout(s.name, sh.maxCol, headerRow);

    let sheetRecords = 0;
    for (let r = layout.firstRow; r <= sh.maxRow; r++) {
      for (const b of layout.blocks) {
        const rawOem = val(r, b.oem);
        const rawBowen = val(r, b.bowen);
        const rawApp = val(r, b.app);
        const rawSpec = val(r, b.spec);
        const rawTemp = b.temp ? val(r, b.temp) : null;
        const rawTianbo = b.tianbo ? val(r, b.tianbo) : null;
        const rawNo = val(r, b.no);
        const rawPrice = b.price ? val(r, b.price) : null;
        const rawImageCell = val(r, b.image);

        const oemText = isGarbage(rawOem) ? '' : (rawOem == null ? '' : String(rawOem).trim());
        const bowenText = isGarbage(rawBowen) ? '' : (rawBowen == null ? '' : String(rawBowen).trim());
        const appText = isGarbage(rawApp) ? '' : (rawApp == null ? '' : String(rawApp).trim());
        const specText = isGarbage(rawSpec) ? '' : (rawSpec == null ? '' : String(rawSpec).trim());
        const tempText = isGarbage(rawTemp) ? '' : (rawTemp == null ? '' : String(rawTemp).trim());
        const tianboText = isGarbage(rawTianbo) ? '' : (rawTianbo == null ? '' : String(rawTianbo).trim());

        if (isGarbage(rawOem) && rawOem != null) audit.garbageCells.push({ sheet: s.name, row: r, col: numToCol(b.oem), value: String(rawOem) });
        if (isGarbage(rawBowen) && rawBowen != null) audit.garbageCells.push({ sheet: s.name, row: r, col: numToCol(b.bowen), value: String(rawBowen) });
        if (isGarbage(rawImageCell) && rawImageCell != null) audit.garbageCells.push({ sheet: s.name, row: r, col: numToCol(b.image), value: String(rawImageCell) });

        if (!oemText && !bowenText) continue;   // 完全空块

        // 主表外框到 X 列，某些行会把同一段 OEM 文本物理重复在第二块里。
        // 这不是新产品，是版面重复 → 去重并记录证据。
        const dupKey = `${s.name}|${b.tag}|${oemText}|${bowenText}`;
        const valKey = `${s.name}|${oemText}|${bowenText}`;
        if (kind === 'master' && oemText && (seenCellKeys.has(dupKey) || seenValueKeys.has(valKey))) {
          audit.duplicateOemCells.push({ sheet: s.name, row: r, block: b.tag, cell: numToCol(b.oem) + r, preview: oemText.slice(0, 120), kind: seenCellKeys.has(dupKey) ? 'same_cell_address' : 'same_text_other_block' });
          continue;
        }
        if (kind === 'master') { seenCellKeys.add(dupKey); seenValueKeys.add(valKey); }

        if (!bowenText && oemText) audit.emptyBowenWithOem++;
        if (bowenText && !oemText) audit.emptyOemWithBowen++;
        if (tianboText) audit.tianboField++;

        records.push({
          source_file: fileInfo.name,
          source_sheet: s.name,
          sheet_kind: kind,
          source_row: r,
          source_block: b.tag,
          source_cell_oem: numToCol(b.oem) + r,
          source_cell_bowen: numToCol(b.bowen) + r,
          source_cell_app: numToCol(b.app) + r,
          source_cell_spec: numToCol(b.spec) + r,
          source_version: DATA_VERSION,
          source_file_sha256: fileInfo.sha256,
          catalog_no_raw: rawNo == null ? '' : String(rawNo).trim(),
          unit_price_raw: rawPrice == null ? '' : String(rawPrice).trim(),
          image_cell_text: rawImageCell == null ? '' : String(rawImageCell).trim(),
          // Sheet1 的 “Vehicle Model” 列实际是 OEM，见 audit.appOnSupplement
          oem_raw: oemText,
          vehicle_raw: kind === 'supplement' ? '' : appText,
          oem_extra_raw: kind === 'supplement' ? appText : '',
          bowen_raw: bowenText,
          specs_raw: specText || tempText,
          tianbo_raw: tianboText,
        });
        sheetRecords++;
        if (kind === 'supplement' && appText) audit.appOnSupplement++;
      }
    }
    sheetReports.push({
      sheet: s.name,
      kind,
      rows: sh.maxRow,
      cols: sh.maxCol,
      first_data_row: layout.firstRow,
      blocks_extracted: sheetRecords,
      merges: sh.merges.length,
      hyperlinks: sh.hyperlinks.length,
    });
  }
  return { records, sheetReports, audit };
}

// ---------------------------------------------------------------------
// 2. 标准化
// ---------------------------------------------------------------------
const CORE_FIELDS = ['bowen_no', 'product_type', 'product_name_en', 'oe_number_normalized',
  'vehicle_make', 'vehicle_model', 'application_notes', 'source_sheet', 'source_row'];
const ENRICH_FIELDS = ['opening_temperature_c', 'dimensions', 'housing_type', 'engine_code',
  'engine_displacement', 'connector_type', 'material', 'test_standard', 'image_urls', 'document_urls'];

function buildOeEntries(rec, audit) {
  const parts = splitOeCell(rec.oem_raw);
  const seen = new Set();
  const out = [];
  const loc = `${rec.source_sheet}!${rec.source_cell_oem}`;
  for (const p of parts) {
    const normalized = normalizeOeNumber(p.raw);
    if (!normalized) continue;
    const ctx = {
      sheet: rec.source_sheet, row: rec.source_row, block: rec.source_block,
      location: loc, oe_number_raw: p.raw, raw_cell: rec.oem_raw,
    };

    if (p.ambiguous) audit.oeAmbiguousSplits.push(ctx);
    if (p.kept_whole_reason) audit.oeKeptWhole.push({ ...ctx, reason: p.kept_whole_reason, token_count: p.raw.split(/ +/).length });

    // 长度异常：太长 = 两个号粘在一起；太短 = 不是号
    if (isOversizedOe(normalized)) {
      audit.oeOversized.push({ ...ctx, normalized_length: normalized.length, reason: `归一化后 ${normalized.length} 位，超过 ${OE_MAX_LEN} 位上限：疑似两个 OE 号粘在一起` });
      continue;
    }
    if (normalized.length < OE_MIN_LEN) {
      audit.oeNonStandard.push({ ...ctx, reason: `normalized_too_short(${normalized.length})` });
      continue;
    }
    if (!/[0-9]/.test(normalized)) {
      audit.oeNonStandard.push({ ...ctx, reason: 'no_digit_likely_brand_name' });
      continue;
    }
    if (seen.has(normalized)) continue;   // 同一块内重复（例如 1338A0 出现两次）
    seen.add(normalized);
    out.push({
      oe_number_raw: p.raw,
      oe_number_normalized: normalized,
      oe_match_key: oeMatchKey(normalized),
      oe_split_rule: p.split_rule,
      oe_split_ambiguous: p.ambiguous ? 'yes' : 'no',
      oe_needs_review: (p.ambiguous || p.kept_whole_reason) ? 'yes' : 'no',
    });
  }
  return out;
}

function inferProductType(text) {
  const t = String(text || '');
  const hits = [];
  if (/\bwater\s*pump\b/i.test(t)) hits.push('Water Pump Assembly');
  if (/\bassembly\b|\bsubassembly\b|\b总成\b/i.test(t)) hits.push('Thermostat Assembly');
  if (/\binsert\b/i.test(t)) hits.push('Thermostat Insert');
  if (/\bhousing\b/i.test(t)) hits.push('Thermostat Housing');
  if (/\belectronic\b/i.test(t)) hits.push('Electronic Thermostat');
  if (/\bsensor\b/i.test(t)) hits.push('Temperature Sensor');
  if (/\bswitch\b/i.test(t)) hits.push('Switch');
  if (hits.length === 0) return { suggestion: 'Thermostat (unconfirmed)', evidence: '' };
  return { suggestion: hits.join(' + '), evidence: hits.join(' | ') };
}

function standardize(rec, audit) {
  // --- Bowen No. ---
  const bn = parseBowenNo(rec.bowen_raw);
  if (bn.anomalies.length) {
    audit.bowenAnomalies.push({
      location: `${rec.source_sheet}!${rec.source_cell_bowen}`,
      anomaly: bn.anomalies.join(';'),
      bowen_raw: rec.bowen_raw, extracted_bowen_no: bn.bowen_no, bowen_note: bn.bowen_note,
      source_sheet: rec.source_sheet, source_row: rec.source_row, source_block: rec.source_block,
    });
  }
  const bkey = bowenKey(bn.bowen_no);

  // --- OE ---
  const oes = buildOeEntries(rec, audit);

  // --- 车型 ---
  const makes = extractVehicleMakes(rec.vehicle_raw);
  const engines = extractEngineCodes(rec.vehicle_raw);
  const displacements = extractDisplacements(rec.vehicle_raw);

  // --- 规格 ---
  const specs = parseSpecs(rec.specs_raw);
  const dimText = Object.entries(specs.dimensions).map(([k, v]) => `${k}=${v}mm`).join('; ');

  // --- 产品类型（一律待确认，仅给建议）---
  const ptype = inferProductType([rec.vehicle_raw, rec.specs_raw, rec.bowen_raw].join(' '));

  // --- 完整度 ---
  const present = {
    bowen_no: Boolean(bn.bowen_no),
    product_type: false,                        // 必须人工确认 → 永远算缺失
    product_name_en: false,                     // 阶段一尚未命名
    oe_number_normalized: oes.length > 0,
    vehicle_make: makes.makes.length > 0,
    vehicle_model: false,                       // 无法从原文可靠拆出 → 留空
    application_notes: Boolean(rec.vehicle_raw),
    source_sheet: true,
    source_row: true,
  };
  const enrich = {
    opening_temperature_c: specs.opening_temperature_c.length > 0,
    dimensions: Object.keys(specs.dimensions).length > 0,
    housing_type: false,
    engine_code: engines.length > 0,
    engine_displacement: displacements.length > 0,
    connector_type: false,
    material: false,
    test_standard: false,
    image_urls: false,
    document_urls: false,
  };
  const coreRate = CORE_FIELDS.filter((f) => present[f]).length / CORE_FIELDS.length;
  const enrichRate = ENRICH_FIELDS.filter((f) => enrich[f]).length / ENRICH_FIELDS.length;

  return {
    bowen: bn,
    bkey,
    oes,
    makes: makes.makes,
    engines,
    displacements,
    specs,
    dimText,
    ptype,
    present,
    enrich,
    coreRate,
    enrichRate,
  };
}

// ---------------------------------------------------------------------
// 3. 生成产品（按 Bowen No. 聚合）
// ---------------------------------------------------------------------
function productIdFor(bkey, bowenNo, fallbackSeq) {
  if (bkey.exact) return 'bw-' + bkey.exact.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return 'bwp-' + String(fallbackSeq).padStart(4, '0');
}

function main() {
  fs.mkdirSync(DERIVED_DIR, { recursive: true });

  const rawFiles = discoverRawFiles();
  if (rawFiles.length === 0) {
    console.error('未找到任何 .xlsx 原始文件，请把产品表放入 data/raw/');
    process.exit(2);
  }

  const rawManifest = [];
  const allRecords = [];
  const sheetReportsAll = [];
  const audit = {
    garbageCells: [], bowenAnomalies: [], oeAmbiguousSplits: [], oeNonStandard: [],
    oeOversized: [], oeKeptWhole: [], duplicateOemCells: [],
    appOnSupplement: 0, tianboField: 0, emptyBowenWithOem: 0, emptyOemWithBowen: 0,
  };

  for (const f of rawFiles) {
    const buf = fs.readFileSync(f);
    const info = { name: path.basename(f), rel: path.relative(ROOT, f).replace(/\\/g, '/'), size: buf.length, sha256: sha256(buf), mtime: fs.statSync(f).mtime.toISOString() };
    const ef = path.join(DERIVED_DIR, 'source-files.json');
    rawManifest.push(info);

    const wb = new Workbook(f);
    const { records, sheetReports, audit: a } = extractRecords(wb, info);
    for (const k of Object.keys(a)) {
      if (Array.isArray(a[k])) audit[k].push(...a[k]);
      else audit[k] += a[k];
    }
    allRecords.push(...records);
    sheetReportsAll.push(...sheetReports.map((r) => ({ ...r, file: info.name })));
    console.log(`读取 ${info.name}: ${records.length} 条原始记录 / ${sheetReports.length} 个工作表`);
  }

  // ---------------- 原始记录层（永久保留，一字不改） ----------------
  const recordsHeader = ['record_id', 'source_file', 'source_sheet', 'sheet_kind', 'source_row', 'source_block',
    'source_cell_oem', 'source_cell_bowen', 'source_cell_app', 'source_cell_spec', 'source_version', 'source_file_sha256',
    'catalog_no_raw', 'unit_price_raw', 'image_cell_text', 'oem_raw', 'vehicle_raw', 'oem_extra_raw', 'bowen_raw',
    'specs_raw', 'tianbo_raw'];
  allRecords.forEach((r, i) => { r.record_id = 'rec-' + String(i + 1).padStart(5, '0'); });
  writeCsv(path.join(DERIVED_DIR, 'staging-records.raw.csv'), recordsHeader, allRecords);

  // ---------------- 标准化 ----------------
  const stdRecords = [];
  for (const rec of allRecords) {
    const s = standardize(rec, audit);
    stdRecords.push({ rec, s });
  }

  // ---------------- 产品聚合 ----------------
  const products = new Map();          // productId -> product
  let provisionalSeq = 0;
  for (const { rec, s } of stdRecords) {
    let pid;
    if (s.bkey.exact) pid = productIdFor(s.bkey, s.bowen.bowen_no, 0);
    else { provisionalSeq++; pid = productIdFor(s.bkey, '', provisionalSeq); }

    if (!products.has(pid)) {
      products.set(pid, {
        product_id: pid,
        bowen_no: s.bowen.bowen_no,
        bowen_base_key: s.bkey.base,
        bowen_variant: s.bkey.exact && s.bkey.base !== s.bkey.exact ? 'yes' : 'no',
        bowen_notes: new Set(),
        oe_map: new Map(),                 // normalized -> oe entry (+ 来源记录)
        makes: new Set(),
        engines: new Set(),
        displacements: new Set(),
        temps: new Set(),
        dims: new Map(),
        app_segments: new Set(),
        records: [],
        ptype_suggestions: new Set(),
        ptype_evidence: new Set(),
        sources: new Set(),
        source_rows: new Set(),
        specs_all: new Set(),
        price_raw: new Set(),
      });
    }
    const p = products.get(pid);
    p.records.push(rec);
    if (s.bowen.bowen_note) p.bowen_notes.add(s.bowen.bowen_note);
    for (const oe of s.oes) {
      const key = oe.oe_number_normalized;
      if (!p.oe_map.has(key)) p.oe_map.set(key, { ...oe, sources: [] });
      p.oe_map.get(key).sources.push(`${rec.source_sheet}!${rec.source_cell_oem}`);
    }
    for (const m of s.makes) p.makes.add(m);
    for (const e of s.engines) p.engines.add(e);
    for (const d of s.displacements) p.displacements.add(d);
    for (const t of s.specs.opening_temperature_c) p.temps.add(t);
    for (const [k, v] of Object.entries(s.specs.dimensions)) p.dims.set(k, v);
    for (const seg of splitApplicationSegments(rec.vehicle_raw)) p.app_segments.add(seg);
    p.ptype_suggestions.add(s.ptype.suggestion);
    if (s.ptype.evidence) p.ptype_evidence.add(s.ptype.evidence);
    p.sources.add(rec.source_sheet);
    p.source_rows.add(`${rec.source_sheet}!${rec.source_row}${rec.source_block}`);
    if (rec.specs_raw) p.specs_all.add(rec.specs_raw);
    if (rec.unit_price_raw) p.price_raw.add(rec.unit_price_raw);
  }

  // ---------------- 评分 & 分层 ----------------
  const productRows = [];
  const oeRows = [];
  const makeRows = [];
  const engineRows = [];
  const appRows = [];

  for (const p of products.values()) {
    const oeList = [...p.oe_map.values()];
    const hasBowen = Boolean(p.bowen_no);
    const coreHits = [
      hasBowen,
      false,                                   // product_type 待人工确认
      false,                                   // product_name_en 待人工确认
      oeList.length > 0,
      p.makes.size > 0,
      false,                                   // vehicle_model 无法可靠拆分
      p.app_segments.size > 0,
      true, true,
    ];
    const coreRate = coreHits.filter(Boolean).length / CORE_FIELDS.length;
    const enrichHits = [
      p.temps.size > 0, p.dims.size > 0, false, p.engines.size > 0, p.displacements.size > 0,
      false, false, false, false, false,
    ];
    const enrichRate = enrichHits.filter(Boolean).length / ENRICH_FIELDS.length;

    // 数据完整度得分（用于第一批上线推荐排序）
    const score =
      (hasBowen ? 10 : 0) +
      Math.min(oeList.length, 8) * 3 +
      (oeList.length >= 2 ? 6 : 0) +
      (p.makes.size > 0 ? 8 : 0) +
      (p.app_segments.size > 0 ? 8 : 0) +
      (p.temps.size > 0 ? 6 : 0) +
      (p.dims.size > 0 ? 6 : 0) +
      (p.engines.size > 0 ? 5 : 0) +
      (p.displacements.size > 0 ? 3 : 0) +
      (p.sources.has('Product Information') ? 6 : 0) +
      (p.records.length >= 2 ? 4 : 0);

    const oeCount = oeList.length;
    // 属性错位风险：Bowen No. 单元格里混进了尺寸 (120*85*90) 或出现了两个编号。
    // 一旦错位，温度/尺寸可能挂错产品 → 这类记录永不允许自动进入 PUBLISHED。
    const bnRawAll = p.records.map((r) => r.bowen_raw).filter(Boolean);
    const bowenLooksLikeDimensions = bnRawAll.some((b) => /\d\s*[*x×]\s*\d/.test(b));
    const bowenHasTwoNumbers = bnRawAll.some((b) => {
      const hits = b.match(/\d{3,}/g) || [];
      return hits.length > 1 && !/sealing\s*ring/i.test(b);
    });
    const attrWarnings = [];
    if (bowenLooksLikeDimensions) attrWarnings.push('Bowen No. 单元格含尺寸样式文本（列错位风险）');
    if (bowenHasTwoNumbers) attrWarnings.push('Bowen No. 单元格含两个编号（需拆分确认）');
    const hasAttrWarning = attrWarnings.length > 0;

    // 分层规则（写死、可复核）
    let status;
    if (!hasBowen || oeCount === 0 || p.app_segments.size === 0) status = 'DRAFT';
    else if (hasAttrWarning) status = 'SEARCHABLE_BUT_NOINDEX';
    else if (oeCount >= 2 && p.makes.size > 0 && p.temps.size > 0 && p.dims.size > 0) status = 'PUBLISHED';
    else status = 'SEARCHABLE_BUT_NOINDEX';

    // 站内搜索 / Google 索引开关
    const searchable = status === 'PUBLISHED' || status === 'SEARCHABLE_BUT_NOINDEX';
    const indexable = false;   // product_type 未人工确认 → 阶段一全部不索引（见报告说明）

    const notable = [];
    if (!hasBowen) notable.push('缺 Bowen No.');
    if (oeCount === 0) notable.push('缺 OE Number');
    if (p.app_segments.size === 0) notable.push('缺车型/应用信息');
    if (p.temps.size === 0) notable.push('缺开启温度');
    if (p.dims.size === 0) notable.push('缺尺寸');
    if (p.makes.size === 0) notable.push('车型品牌未能识别');
    if (p.records.length > 1) notable.push(`多来源记录(${p.records.length})`);
    if (p.bowen_notes.size) notable.push('Bowen No. 带描述后缀');
    if (p.bowen_variant === 'yes') notable.push('Bowen 变体号');
    for (const w of attrWarnings) notable.push(w);

    const row = {
      product_id: p.product_id,
      product_type: 'REVIEW_REQUIRED',
      product_type_suggestion: [...p.ptype_suggestions].join(' / '),
      product_name_en: '',
      bowen_no: p.bowen_no,
      bowen_no_raw: [...new Set(p.records.map((r) => r.bowen_raw))].join(' | '),
      status,
      oe_number_raw: oeList.slice(0, 1).map((o) => o.oe_number_raw).join(''),
      oe_number_normalized: oeList.slice(0, 1).map((o) => o.oe_number_normalized).join(''),
      oe_count: String(oeCount),
      oe_all_raw: oeList.map((o) => o.oe_number_raw).join(' | '),
      oe_all_normalized: oeList.map((o) => o.oe_number_normalized).join(' | '),
      vehicle_make: [...p.makes].join(' | '),
      vehicle_model: '',
      engine_code: [...p.engines].join(' | '),
      engine_code_status: p.engines.size > 0 ? 'review_required' : '',
      engine_displacement: [...p.displacements].join(' | '),
      engine_displacement_status: p.displacements.size > 0 ? 'review_required' : '',
      application_notes: [...p.app_segments].join(' ;; ').slice(0, 4000),
      opening_temperature_c: [...p.temps].sort((a, b) => a - b).join(' | '),
      dimensions: [...p.dims.entries()].map(([k, v]) => `${k}=${v}mm`).join(' | '),
      housing_type: '',
      connector_type: '',
      material: '',
      test_standard: '',
      image_urls: '',
      document_urls: '',
      specifications_raw: [...p.specs_all].join(' | '),
      unit_price_raw_internal: [...p.price_raw].join(' | '),
      source_sheet: [...p.sources].join(' | '),
      source_row: [...p.source_rows].join(' | '),
      source_version: DATA_VERSION,
      source_record_count: String(p.records.length),
      fitment_confidence: 'review_required',
      searchable: searchable ? 'yes' : 'no',
      indexable: indexable ? 'yes' : 'no',
      inquiry_enabled: 'yes',
      downloadable_datasheet: 'no',
      last_verified_at: '',
      verified_by: '',
      core_field_completeness: coreRate.toFixed(3),
      enrichment_field_completeness: enrichRate.toFixed(3),
      data_quality_score: String(score),
      has_attribute_warnings: hasAttrWarning ? 'yes' : 'no',
      quality_flags: notable.join('; '),
      internal_notes: '',
    };
    productRows.push(row);

    // --- OE 明细表（一行一个 OE 号，用于 OE 搜索） ---
    for (const oe of oeList) {
      oeRows.push({
        product_id: p.product_id,
        bowen_no: p.bowen_no,
        product_type: 'REVIEW_REQUIRED',
        oe_number_raw: oe.oe_number_raw,
        oe_number_normalized: oe.oe_number_normalized,
        oe_match_key: oe.oe_match_key,
        oe_split_rule: oe.split_rule,
        oe_split_ambiguous: oe.oe_split_ambiguous,
        oe_is_primary: oe === oeList[0] ? 'yes' : 'no',
        source_sheet: p.records[0].source_sheet,
        source_row: p.records[0].source_row,
        source_block: p.records[0].source_block,
        source_cells: oe.sources.join(' | '),
        source_version: DATA_VERSION,
        fitment_confidence: 'review_required',
        searchable: searchable ? 'yes' : 'no',
        indexable: 'no',
        last_verified_at: '',
        verified_by: '',
      });
    }

    // --- 车型品牌关系表 ---
    for (const m of p.makes) {
      makeRows.push({
        product_id: p.product_id, bowen_no: p.bowen_no, vehicle_make: m,
        vehicle_make_source: 'derived_from_application_text',
        vehicle_model: '', vehicle_model_status: 'review_required',
        application_notes: [...p.app_segments].join(' ;; ').slice(0, 2000),
        source_sheet: [...p.sources].join(' | '), source_version: DATA_VERSION,
        status, last_verified_at: '', verified_by: '',
      });
    }
    for (const e of p.engines) {
      engineRows.push({
        product_id: p.product_id, bowen_no: p.bowen_no,
        candidate_token: e,
        // 原表没有独立的“发动机代码”列，这个词是从自由文本里抽出来的候选值，
        // 可能同时混入车型名（如 CS75 / B70）。因此一律 review_required。
        engine_code: 'REVIEW_REQUIRED',
        engine_code_status: 'review_required',
        candidate_source: 'extracted_from_application_text',
        engine_displacement: [...p.displacements].join(' | '),
        source_sheet: [...p.sources].join(' | '), source_version: DATA_VERSION,
        last_verified_at: '', verified_by: '',
      });
    }
  }

  // ---------------- 重复检测 ----------------
  // ===== 第 0 层：原始记录层面的重复（最贴近“原表里重复了几条”） =====
  const rawBowenMap = new Map();       // bowenNo -> [record]
  for (const r of allRecords) {
    const bn = parseBowenNo(r.bowen_raw).bowen_no;
    if (!bn) continue;
    const k = bowenKey(bn).exact;
    if (!rawBowenMap.has(k)) rawBowenMap.set(k, []);
    rawBowenMap.get(k).push({ ...r, _bn: bn });
  }
  const rawBowenDup = [];
  for (const [k, list] of rawBowenMap) {
    if (list.length < 2) continue;
    const sheets = uniqSorted(list.map((x) => x.source_sheet));
    const locations = list.map((x) => `${x.source_sheet}!${x.source_cell_oem}`);
    rawBowenDup.push({
      type: 'raw_bowen_repeated',
      key: k,
      detail: `同一 Bowen No. 在原表出现 ${list.length} 次，分布在 ${sheets.length} 个工作表${sheets.length > 1 ? '（跨表重复）' : '（同表重复）'}`,
      count: list.length,
      product_ids_or_variants: locations.join(' | '),
    });
  }
  const rawBowenCrossSheet = rawBowenDup.filter((d) => d.detail.includes('跨表'));

  // 原始层 OE 重复：同一个归一化 OE 出现在多个不同 Bowen No. 的原始记录里
  const rawOeMap = new Map();
  for (const { rec, s } of stdRecords) {
    const bn = s.bowen.bowen_no;
    for (const oe of s.oes) {
      const k = oe.oe_match_key;
      if (!rawOeMap.has(k)) rawOeMap.set(k, new Map());
      const m = rawOeMap.get(k);
      if (!m.has(bn)) m.set(bn, []);
      m.get(bn).push(`${rec.source_sheet}!${rec.source_cell_oem}`);
    }
  }
  const rawOeShared = [];
  for (const [k, m] of rawOeMap) {
    if (m.size > 1) rawOeShared.push({ oe: k, bowenCount: m.size, bowens: [...m.keys()].filter(Boolean) });
  }

  // A. Bowen No. 重复（产品层面）：同一标准化编号是否由多条原始记录聚合而来，
  //    以及是否出现在多个工作表（跨表重复 = 最可能是真正的重复录入）
  const bowenProductMeta = new Map();   // exact -> { sheets:Set, locs:[], oes:Set }
  const oeByKeyAndSheet = new Map();    // exact -> Map(sheet -> Set(oe))
  for (const { rec, s } of stdRecords) {
    const k = s.bkey.exact;
    if (!k) continue;
    if (!bowenProductMeta.has(k)) bowenProductMeta.set(k, { sheets: new Set(), locs: [], oes: new Set() });
    const m = bowenProductMeta.get(k);
    m.sheets.add(rec.source_sheet);
    m.locs.push(`${rec.source_sheet}!${rec.source_row}${rec.source_block}`);
    for (const oe of s.oes) m.oes.add(oe.oe_match_key);

    if (!oeByKeyAndSheet.has(k)) oeByKeyAndSheet.set(k, new Map());
    const sm = oeByKeyAndSheet.get(k);
    if (!sm.has(rec.source_sheet)) sm.set(rec.source_sheet, new Set());
    for (const oe of s.oes) sm.get(rec.source_sheet).add(oe.oe_match_key);
  }
  const bowenDuplicateGroup = [];   // 由多条原始记录聚合（信息性）
  const bowenCrossSheetDup = [];    // 跨工作表重复（需要业务处理）
  for (const [k, m] of bowenProductMeta) {
    if (m.locs.length > 1) {
      bowenDuplicateGroup.push({ key: k, count: m.locs.length, product_ids: m.locs.join(' | '), sheets: [...m.sheets].join(' | ') });
    }
    if (m.sheets.size > 1) {
      bowenCrossSheetDup.push({ type: 'raw_bowen_repeated', key: k, detail: `同一 Bowen No. 出现在 ${m.sheets.size} 个工作表`, count: m.sheets.size, sheets: [...m.sheets].join(' | '), product_ids_or_variants: m.locs.join(' | ') });
    }
  }
  // 同号但 OE 集合冲突：同一 Bowen No. 在不同工作表登记的 OE 号不一致
  const bowenConflict = [];
  for (const [k, sm] of oeByKeyAndSheet) {
    if (sm.size < 2) continue;
    const sets = [...sm.values()];
    const union = new Set(sets.flatMap((s) => [...s]));
    if (sets.some((s) => s.size !== union.size)) {
      const detail = [];
      for (const [sheet, st] of sm) {
        const missing = [...union].filter((v) => !st.has(v));
        if (missing.length) detail.push(`${sheet} 缺少 ${missing.length} 个`);
      }
      bowenConflict.push({ bowen: k, sheet_count: sm.size, union: union.size, detail: detail.join('；'), locations: [...sm.keys()].join(' | ') });
    }
  }
  // 基础号相同、后缀不同（3004 / 3004--3 / 3004-5 这类）
  const byBase = new Map();
  for (const r of productRows) {
    if (!r.bowen_no) continue;
    const k = bowenKey(r.bowen_no);
    if (!byBase.has(k.base)) byBase.set(k.base, new Set());
    byBase.get(k.base).add(k.exact);
  }
  const bowenVariantFamilies = [];
  for (const [base, exacts] of byBase) {
    if (exacts.size > 1) bowenVariantFamilies.push({ base, variant_count: exacts.size, variants: [...exacts].sort() });
  }
  bowenVariantFamilies.sort((a, b) => b.variant_count - a.variant_count || a.base.localeCompare(b.base));

  // B. OE 重复：同一 OE 号被多个不同产品引用
  const byOe = new Map();
  for (const r of oeRows) {
    if (!byOe.has(r.oe_match_key)) byOe.set(r.oe_match_key, []);
    byOe.get(r.oe_match_key).push(r);
  }
  const oeShared = [];
  const oeDuplicateWithin = [];
  for (const [k, list] of byOe) {
    const pids = uniqSorted(list.map((x) => x.product_id));
    if (pids.length > 1) {
      oeShared.push({
        oe_match_key: k,
        oe_number_normalized: list[0].oe_number_normalized,
        oe_number_raw: uniqSorted(list.map((x) => x.oe_number_raw)).join(' | '),
        product_count: pids.length,
        products: pids.join(' | '),
        bowen_nos: uniqSorted(list.map((x) => x.bowen_no || '(无 Bowen No.)')).join(' | '),
        severity: 'review_required',
        note: '同一 OE 号被多个产品引用：可能是一号多型、替代关系或录错，必须业务确认',
      });
    }
    if (list.length > pids.length) {
      oeDuplicateWithin.push({ oe: k, rows: list.length, products: pids.length });
    }
  }

  // ---------------- 输出文件 ----------------
  const productHeader = Object.keys(productRows[0]);
  writeCsv(path.join(DERIVED_DIR, 'products.csv'), productHeader, productRows);

  const oeHeader = Object.keys(oeRows[0]);
  writeCsv(path.join(DERIVED_DIR, 'product-oe-index.csv'), oeHeader, oeRows);

  const makeHeader = Object.keys(makeRows[0]);
  writeCsv(path.join(DERIVED_DIR, 'product-vehicle-makes.csv'), makeHeader, makeRows);

  const engineHeader = Object.keys(engineRows[0]);
  writeCsv(path.join(DERIVED_DIR, 'product-engine-codes.csv'), engineHeader, engineRows);

  writeJson(path.join(DERIVED_DIR, 'source-files.json'), { generated_at: NOW, data_version: DATA_VERSION, files: rawManifest });
  writeJson(path.join(DERIVED_DIR, 'sheet-inventory.json'), { generated_at: NOW, data_version: DATA_VERSION, sheets: sheetReportsAll });

  writeCsv(path.join(DERIVED_DIR, 'duplicates-bowen.csv'),
    ['type', 'key', 'detail', 'count', 'product_ids_or_variants'],
    [
      ...rawBowenDup.map((d) => ({ type: 'raw_bowen_repeated', key: d.key, detail: d.detail, count: d.count, product_ids_or_variants: d.product_ids_or_variants })),
      ...bowenConflict.map((d) => ({ type: 'bowen_oe_conflict_across_sheets', key: d.bowen, detail: `同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 ${d.union} 个）；${d.detail}`, count: d.sheet_count, product_ids_or_variants: d.locations })),
      ...bowenVariantFamilies.map((d) => ({ type: 'bowen_variant_family', key: d.base, detail: '基础号相同但后缀不同，需确认是同一产品的变体还是不同产品', count: d.variant_count, product_ids_or_variants: d.variants.join(' | ') })),
    ]);

  const dupOeMin = 2;
  writeCsv(path.join(DERIVED_DIR, 'duplicates-oe.csv'),
    ['type', 'oe_number_normalized', 'oe_number_raw', 'product_count', 'bowen_nos', 'products', 'severity', 'note'],
    [
      ...oeShared.filter((d) => d.product_count >= dupOeMin).map((d) => ({ type: 'oe_shared_across_products', ...d })),
      ...oeDuplicateWithin.map((d) => ({ type: 'oe_repeated_within_product', oe_number_normalized: d.oe, oe_number_raw: '', product_count: d.products, bowen_nos: '', products: '', severity: 'info', note: `原表同一产品内重复出现 ${d.rows} 次，已去重` })),
    ]);

  // 治理清单
  writeCsv(path.join(DERIVED_DIR, 'issues-bowen-anomalies.csv'),
    ['location', 'anomaly', 'bowen_raw', 'extracted_bowen_no', 'bowen_note', 'source_sheet', 'source_row', 'source_block'],
    audit.bowenAnomalies);
  writeCsv(path.join(DERIVED_DIR, 'issues-oe-ambiguous-splits.csv'),
    ['location', 'source_sheet', 'source_row', 'source_block', 'oe_number_raw', 'raw_cell'],
    audit.oeAmbiguousSplits);
  writeCsv(path.join(DERIVED_DIR, 'issues-oe-kept-whole.csv'),
    ['location', 'reason', 'token_count', 'oe_number_raw', 'source_sheet', 'source_row', 'source_block', 'raw_cell'],
    audit.oeKeptWhole);
  writeCsv(path.join(DERIVED_DIR, 'issues-oe-oversized.csv'),
    ['location', 'normalized_length', 'reason', 'oe_number_raw', 'source_sheet', 'source_row', 'source_block', 'raw_cell'],
    audit.oeOversized);
  writeCsv(path.join(DERIVED_DIR, 'issues-oe-nonstandard.csv'),
    ['location', 'reason', 'oe_number_raw', 'source_sheet', 'source_row', 'source_block'],
    audit.oeNonStandard);
  writeCsv(path.join(DERIVED_DIR, 'issues-ignored-garbage-cells.csv'),
    ['source_sheet', 'source_row', 'col', 'value'], audit.garbageCells);
  writeCsv(path.join(DERIVED_DIR, 'issues-duplicate-oe-cells.csv'),
    ['sheet', 'row', 'block', 'cell', 'kind', 'preview'], audit.duplicateOemCells);

  // ---------------- 第一批上线推荐 ----------------
  const rankable = productRows.filter((r) => r.status === 'PUBLISHED' && r.bowen_no
    && Number(r.oe_count) >= 2 && r.has_attribute_warnings === 'no');
  rankable.sort((a, b) => Number(b.data_quality_score) - Number(a.data_quality_score)
    || Number(b.oe_count) - Number(a.oe_count)
    || String(a.bowen_no).localeCompare(String(b.bowen_no)));
  // 目标区间 50-100：优先取 100 以内的自然合格数量；不足 50 时标注需人工补数
  const firstBatch = rankable.slice(0, FIRST_BATCH_TARGET_MAX);
  const firstBatchShortfall = Math.max(0, FIRST_BATCH_TARGET_MIN - firstBatch.length);

  writeCsv(path.join(DERIVED_DIR, 'first-batch-published.csv'),
    ['rank', ...productHeader, 'publish_ready'],
    firstBatch.map((r, i) => ({ rank: i + 1, ...r, publish_ready: 'blocked_until_product_type_confirmed' })));

  // ---------------- 统计 ----------------
  const stats = computeStats({ allRecords, stdRecords, productRows, oeRows, sheetReportsAll, audit, bowenDuplicateGroup, bowenCrossSheetDup, rawBowenDup, rawOeShared, bowenConflict, bowenVariantFamilies, oeShared, firstBatch, rawManifest, firstBatchShortfall, eligiblePoolSize: rankable.length });
  writeJson(path.join(DERIVED_DIR, 'stats.json'), stats);

  console.log('\n===== 完成 =====');
  console.log(JSON.stringify(stats.summary, null, 2));
  return stats;
}

function computeStats(ctx) {
  const { allRecords, stdRecords, productRows, oeRows, sheetReportsAll, audit, bowenDuplicateGroup, bowenCrossSheetDup, rawBowenDup, rawOeShared, bowenConflict, bowenVariantFamilies, oeShared, firstBatch, rawManifest, firstBatchShortfall, eligiblePoolSize } = ctx;

  const totalRaw = allRecords.length;
  const totalProducts = productRows.length;
  const withBowen = productRows.filter((r) => r.bowen_no).length;
  const withoutBowen = productRows.filter((r) => !r.bowen_no).length;
  const uniqueBowen = uniqSorted(productRows.map((r) => r.bowen_no).filter(Boolean)).length;

  const uniqueOe = new Set(oeRows.map((r) => r.oe_match_key)).size;
  const uniqueOeStrict = new Set(oeRows.map((r) => r.oe_number_normalized)).size;

  const makeSet = new Set();
  for (const r of productRows) for (const m of String(r.vehicle_make).split(' | ').filter(Boolean)) makeSet.add(m);

  const rawAppTokens = new Set();
  for (const r of allRecords) {
    for (const seg of splitApplicationSegments(r.vehicle_raw)) rawAppTokens.add(seg);
  }

  const statusCounts = {};
  for (const r of productRows) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

  const fieldFill = (field, rows = productRows, predicate = (v) => Boolean(v)) =>
    rows.filter((r) => predicate(r[field])).length;

  const core = {
    product_id: fieldFill('product_id'),
    product_type: fieldFill('product_type', productRows, (v) => v && v !== 'REVIEW_REQUIRED'),
    product_name_en: fieldFill('product_name_en'),
    bowen_no: withBowen,
    status: fieldFill('status'),
    oe_number_raw: fieldFill('oe_number_raw'),
    oe_number_normalized: fieldFill('oe_number_normalized'),
    vehicle_make: fieldFill('vehicle_make'),
    vehicle_model: 0,
    engine_code: fieldFill('engine_code'),
    engine_displacement: fieldFill('engine_displacement'),
    application_notes: fieldFill('application_notes'),
    opening_temperature_c: fieldFill('opening_temperature_c'),
    dimensions: fieldFill('dimensions'),
    housing_type: 0,
    source_sheet: totalProducts,
    source_row: totalProducts,
    source_version: totalProducts,
    fitment_confidence: fieldFill('fitment_confidence'),
    searchable: fieldFill('searchable', productRows, (v) => v === 'yes'),
    indexable: 0,
    last_verified_at: 0,
    verified_by: 0,
  };

  const completeness = Object.entries(core).map(([f, n]) => ({
    field: f, filled: n, total: totalProducts,
    rate: totalProducts ? +(n / totalProducts).toFixed(4) : 0,
    note: ['product_type', 'product_name_en', 'vehicle_model', 'housing_type', 'last_verified_at', 'verified_by', 'indexable'].includes(f)
      ? '必须先人工确认/补录，本阶段不允许自动填充' : '',
  }));

  const avgCore = +(productRows.reduce((a, r) => a + Number(r.core_field_completeness), 0) / totalProducts).toFixed(4);
  const avgEnrich = +(productRows.reduce((a, r) => a + Number(r.enrichment_field_completeness), 0) / totalProducts).toFixed(4);

  const oePerProduct = oeRows.length / Math.max(totalProducts, 1);
  const oeCountsSorted = productRows.map((r) => Number(r.oe_count)).sort((a, b) => b - a);

  return {
    generated_at: NOW,
    data_version: DATA_VERSION,
    summary: {
      原始文件数: rawManifest.length,
      工作表数: sheetReportsAll.length,
      原始记录数: totalRaw,
      产品数_按BowenNo聚合: totalProducts,
      有BowenNo的产品数: withBowen,
      无BowenNo的产品数: withoutBowen,
      不重复BowenNo数: uniqueBowen,
      OE明细行数: oeRows.length,
      不重复OE号数: uniqueOe,
      车型品牌数: makeSet.size,
      原始车型片段数: rawAppTokens.size,
      第一批推荐上线数: firstBatch.length,
    },
    raw_files: rawManifest,
    sheets: sheetReportsAll,
    status_distribution: statusCounts,
    field_completeness: completeness,
    averages: { core_field_completeness: avgCore, enrichment_field_completeness: avgEnrich, oe_per_product: +oePerProduct.toFixed(2) },
    oe_per_product_distribution: {
      '0': oeCountsSorted.filter((n) => n === 0).length,
      '1': oeCountsSorted.filter((n) => n === 1).length,
      '2-3': oeCountsSorted.filter((n) => n >= 2 && n <= 3).length,
      '4-5': oeCountsSorted.filter((n) => n >= 4 && n <= 5).length,
      '6+': oeCountsSorted.filter((n) => n >= 6).length,
      max: oeCountsSorted[0] || 0,
    },
    vehicle_makes: [...makeSet].sort(),
    duplicates: {
      raw_bowen_repeated: rawBowenDup.length,
      raw_bowen_cross_sheet: bowenCrossSheetDup.length,
      raw_oe_shared_across_bowen: rawOeShared.length,
      bowen_multi_record_aggregated: bowenDuplicateGroup.length,
      bowen_oe_conflict_across_sheets: bowenConflict.length,
      bowen_variant_families: bowenVariantFamilies.length,
      oe_shared_across_products: oeShared.length,
      oe_shared_top: [...oeShared].sort((a, b) => b.product_count - a.product_count).slice(0, 15),
      bowen_variant_families_top: bowenVariantFamilies.slice(0, 20),
      bowen_cross_sheet_top: bowenCrossSheetDup.slice(0, 20),
    },
    issues: {
      ignored_garbage_cells: audit.garbageCells.length,
      duplicate_oe_cells_removed: audit.duplicateOemCells.length,
      bowen_anomalies: audit.bowenAnomalies.length,
      oe_ambiguous_splits: audit.oeAmbiguousSplits.length,
      oe_kept_whole_needs_review: audit.oeKeptWhole.length,
      oe_oversized_dropped: audit.oeOversized.length,
      oe_nonstandard_dropped: audit.oeNonStandard.length,
      supplement_app_column_is_oem: audit.appOnSupplement,
      tianbo_field_present: audit.tianboField,
      records_with_oem_but_no_bowen: audit.emptyBowenWithOem,
      records_with_bowen_but_no_oem: audit.emptyOemWithBowen,
    },
    first_batch: {
      count: firstBatch.length,
      target_range: [FIRST_BATCH_TARGET_MIN, FIRST_BATCH_TARGET_MAX],
      shortfall_below_target_min: firstBatchShortfall,
      eligible_pool_size: eligiblePoolSize,
      bowen_nos: firstBatch.map((r) => r.bowen_no),
      score_range: firstBatch.length ? [Number(firstBatch[firstBatch.length - 1].data_quality_score), Number(firstBatch[0].data_quality_score)] : [0, 0],
    },
  };
}

main();
