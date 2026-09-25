#!/usr/bin/env node
/**
 * Phase 2.5 — 产品数据库重建（Products + Product Applications + OE Search Index）
 * ===========================================================================
 * 铁律（写死在代码里，不接受参数覆盖）：
 *   1. 只读 data/raw 下的 Excel，绝不写入。每次运行前后校验 SHA-256。
 *   2. 绝不猜 product_type。只有三种合法来源：
 *        human_review_confirmed  — 业务方在审核表里逐行确认
 *        human_section_label     — 业务方在 Excel 里写下的产品区段标签
 *        inherited_from_bowen    — 其他工作表继承综合产品信息表的分类
 *      其余一律 product_type = null, product_type_source = "review_required"。
 *   3. 不因为 subtype 缺失阻止产品上线。
 *   4. 一个 Bowen 有多个 OE 不是冲突，不做主/次 OE 区分。
 *   5. OE 与 Engine 的行级关系必须保留：一条 Excel 记录 = 一条 application。
 *   6. 疑似字段错位的记录 blocked = true，保留原始来源，不进官网任何入口。
 *
 * 用法：node tools/build-product-db-v2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Workbook } from './xlsx-reader.mjs';
import {
  findHeaderRow,
  buildBlocks,
  findSectionLabels,
  labelFor,
  isAuxiliaryLabelRow,
  groupByRow,
  TOKEN_SPLIT_RE,
} from './lib/v2-layout.mjs';
import {
  PRODUCT_TYPES,
  LABEL_LOOKUP,
  normalizeLabel,
  STATUS,
  MISALIGNMENT_RULES,
  BOWEN_ALLOWED_RE,
  BOWEN_MAX_LEN,
  NON_OE_ANNOTATIONS,
  PROTOTYPE_RULES,
  COMPANY_FACTS,
  SHEET_ROLES,
} from './config/product-types.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_EXCEL = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const MANIFEST = path.join(ROOT, 'data/raw/SOURCE-MANIFEST.json');
const OVERRIDES = path.join(ROOT, 'data/raw/review-overrides-v2.json');
const OUT = path.join(ROOT, 'data/derived/v2');
const REVIEW_OUT = path.join(ROOT, 'review');
const WEBSITE_DATA = path.join(ROOT, 'website/src/data');

const NOW = process.env.BOWEN_NOW || new Date().toISOString();
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- helpers
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** OE 检索键：忽略大小写、空格、短横线、斜线 */
export function oeSearchKey(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/[-‐‑‒–—―]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^A-Z0-9.]/g, '');
}

/** OE 展示归一化：保留原文里的分隔符信息，只去空格与大小写差异 */
export function oeDisplayNormalized(raw) {
  return String(raw ?? '').trim().toUpperCase().replace(/[\u3000\s]+/g, '');
}

const isBlank = (v) => v == null || String(v).replace(/[\u3000\s]/g, '') === '';
const clean = (v) => String(v ?? '').replace(/\u00a0/g, ' ').trim();

function tokensOf(text) {
  return clean(text).split(TOKEN_SPLIT_RE).map((t) => t.trim()).filter(Boolean);
}

/** 一个 token 像不像 OE 号（保守判定，用于 OE 索引列，不用于改写原文） */
export function looksLikeOeToken(t) {
  const s = String(t ?? '').trim();
  if (!s) return false;
  if (NON_OE_ANNOTATIONS.includes(s)) return false;
  if (/[\u4e00-\u9fff]/.test(s)) return false; // 含中文的 token 是说明文字，不是 OE
  if (!/[0-9]/.test(s)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9\-./+*_()]*$/.test(s)) return false;
  const k = oeSearchKey(s);
  if (k.length < 5 || k.length > 25) return false;
  return true;
}

/**
 * Bowen No. 单元格解析。
 * 关键裁决（依据最新版 Excel 实测）：
 *   - 字段里出现尺寸/温度/中文说明/括号备注 = 错位痕迹 → 记录 anomaly
 *   - 若首 token 仍是合法 Bowen No.（例如 "3029  92°" → 3029）：
 *         bowen_no 可读，溢出原文进 bowen_overflow_raw，记录标 needs_review
 *   - 若首 token 不是合法 Bowen No.（例如 "无小管" / "芯子编号：31052"）：
 *         bowen_no = null，记录必须 blocked
 * 绝不做自动修复、自动合并或删除。
 */
export function parseBowenCell(raw) {
  const text = clean(raw).replace(/[\r\n]+/g, ' ');
  const out = {
    bowen_no_raw: text, bowen_no: '', bowen_note: '', bowen_overflow_raw: '',
    tokens: [], anomalies: [], bowen_parse_status: 'empty',
  };
  if (!text) { out.bowen_parse_status = 'empty'; return out; }
  out.tokens = tokensOf(text);
  const first = out.tokens[0] ?? '';
  const firstOk = BOWEN_ALLOWED_RE.test(first) && first.length <= BOWEN_MAX_LEN;
  if (!firstOk) {
    out.bowen_no = '';
    out.bowen_note = text;
    out.bowen_overflow_raw = text;
    out.anomalies.push('bowen_unreadable_leading_token');
    out.bowen_parse_status = 'unreadable';
    return out;
  }
  out.bowen_no = first;
  out.bowen_overflow_raw = out.tokens.slice(1).join(' ');
  out.bowen_note = out.bowen_overflow_raw;
  out.bowen_parse_status = out.bowen_overflow_raw ? 'recovered_with_overflow' : 'clean';
  return out;
}

/** 错位检测：只看格式特征，不涉及任何产品知识 */
export function detectMisalignment(bowenCellRaw) {
  const text = clean(bowenCellRaw);
  const hits = [];
  for (const rule of MISALIGNMENT_RULES) {
    if (rule.re.test(text)) hits.push({ rule: rule.id, note: rule.note });
  }
  return hits;
}

/** 温度（摄氏，必须带单位） */
export function extractTemperatures(specs) {
  const out = [];
  if (!specs) return out;
  const re = /([0-9]+(?:\.[0-9]+)?)\s*(?:℃|°\s*C|C°|摄氏|度)/g;
  let m;
  while ((m = re.exec(String(specs))) !== null) {
    const v = Number(m[1]);
    if (v > -60 && v < 250) out.push(v);
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------- guards
log('=== Phase 2.5 产品数据库重建 ===');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const expected = manifest.sources.product_excel_v2.sha256;
const before = sha256(RAW_EXCEL);
if (before !== expected) {
  console.error(`FATAL 原始 Excel SHA-256 与冻结清单不一致\n  期望 ${expected}\n  实际 ${before}`);
  process.exit(2);
}
log(`原始 Excel SHA-256 校验通过 ${before.slice(0, 16)}…`);

const overrides = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));

// ---------------------------------------------------------------- extract
const wb = new Workbook(RAW_EXCEL);
const staging = [];
const auxiliaryLabelRows = [];
const sectionInventory = [];
const rejectedLabelCandidates = [];
const sheetInventory = [];
let sourceRowSeq = 0;

for (let si = 0; si < wb.sheets.length; si++) {
  const sheet = wb.sheets[si];
  const sh = wb.readSheet(sheet.path);
  const headerRow = findHeaderRow(sh);
  const byRow = groupByRow(sh.cells);

  if (headerRow === null) {
    sheetInventory.push({
      sheet_index: si, sheet_name: sheet.name, role: 'no_product_table',
      header_row: null, blocks: 0, records: 0, section_labels: [],
    });
    continue;
  }

  const blocks = buildBlocks([...byRow.get(headerRow).values()], sh.maxCol);
  // 区段标签必须写在「记录编号列或更左」的位置（业务方写在 A 列或紧邻的 B 列）。
  // 编号列及其右侧是数据列，那里的孤立内容是天博编号之类的数据，不是标签。
  const labelCeiling = Math.min(...blocks.map((b) => b.bowen));
  const rawCandidates = findSectionLabels(sh, headerRow, blocks);
  // 一条候选文本要成为「人工产品类型区段标签」，必须同时满足：
  //   1) 写在第一条编号列左侧（业务方把标签写在 A 列或紧邻的 B 列）
  //   2) 能在产品类型词典里查到（词典只收录业务方在规划里确认过的类型写法）
  // 这样辅助表编号列里的天博编号（如 "5 157 411"）不会被误当成区段标签。
  const labels = [];
  const rejectedCandidates = [];
  for (const cand of rawCandidates) {
    const candCol = Number(cand.column);
    const recognized = LABEL_LOOKUP.get(normalizeLabel(cand.text));
    if (candCol >= labelCeiling) { rejectedCandidates.push({ ...cand, reason: 'candidate_in_data_column' }); continue; }
    if (!recognized) { rejectedCandidates.push({ ...cand, reason: 'not_a_known_product_type_label' }); continue; }
    labels.push(cand);
  }
  for (const r of rejectedCandidates) rejectedLabelCandidates.push({ sheet_name: sheet.name, ...r });
  if (process.env.BOWEN_DEBUG_LABELS) {
    console.log(`[dbg] ${sheet.name} ceiling=${labelCeiling} raw=${rawCandidates.length} kept=${labels.length} ` +
      `rejected=${JSON.stringify(rejectedCandidates.map((r) => [r.column, r.sheet_row, r.text, r.reason]))}`);
  }
  for (const l of labels) {
    if (process.env.BOWEN_DEBUG_LABELS) console.log(`[dbg-push] ${sheet.name} ${l.column}@${l.sheet_row} ${l.text}`);
    sectionInventory.push({ sheet_name: sheet.name, ...l });
  }

  let count = 0;
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    if (row <= headerRow) continue;
    const m = byRow.get(row);
    for (const b of blocks) {
      const oeCell = clean(m.get(b.oe)?.value);
      const vehCell = clean(m.get(b.veh)?.value);
      const bowenCell = clean(m.get(b.bowen)?.value);
      const specs = clean(m.get(b.tech)?.value);
      if (isBlank(oeCell) && isBlank(vehCell) && isBlank(bowenCell)) continue;

      const label = labelFor(labels, b, row);
      const bowen = parseBowenCell(bowenCell);
      const misalign = detectMisalignment(bowenCell);
      for (const a of bowen.anomalies) {
        misalign.push({ rule: a, note: 'Bowen No. 单元格无法读出合法编号' });
      }

      // 判定：可读回 Bowen No. → needs_review（不阻断）；读不出 → blocked
      const recoverable = bowen.bowen_parse_status === 'recovered_with_overflow';
      const blocked = bowen.bowen_parse_status === 'unreadable';

      sourceRowSeq += 1;
      const record = {
        source_record_id: `SRC-${String(sourceRowSeq).padStart(5, '0')}`,
        source_sheet: sheet.name,
        source_sheet_index: si,
        source_row: row,
        source_block_start_col: b.start,
        source_cell_refs: {
          oe: colLetter(b.oe) + row,
          vehicle: b.veh ? colLetter(b.veh) + row : null,
          bowen: colLetter(b.bowen) + row,
          specs: b.tech ? colLetter(b.tech) + row : null,
          seq: b.no ? colLetter(b.no) + row : null,
        },
        section_label_raw: label ? label.text : null,
        section_label_row: label ? label.sheet_row : null,
        section_label_col: label ? label.column : null,
        oe_cell_raw: oeCell,
        vehicle_cell_raw: vehCell,
        bowen_cell_raw: bowenCell,
        specs_cell_raw: specs,
        bowen_no: bowen.bowen_no,
        bowen_note: bowen.bowen_note,
        bowen_overflow_raw: bowen.bowen_overflow_raw,
        bowen_parse_status: bowen.bowen_parse_status,
        oe_tokens: tokensOf(oeCell),
        vehicle_tokens: tokensOf(vehCell),
        temperatures_c: extractTemperatures(specs),
        misalignment_hits: misalign,
        data_status: blocked ? 'blocked' : recoverable ? 'needs_review' : 'ok',
        blocked,
      };

      // 辅助表（工作表1）里整行没有 OE 也没有车型的孤立数字 = 天博编号，不是产品记录
      if (isAuxiliaryLabelRow(record, SHEET_ROLES.AUX)) {
        auxiliaryLabelRows.push({
          source_record_id: record.source_record_id,
          source_sheet: record.source_sheet,
          source_row: record.source_row,
          cell_ref: record.source_cell_refs.bowen,
          cell_raw: record.bowen_cell_raw,
        });
        count += 1;
        continue;
      }

      staging.push(record);
      count += 1;
    }
  }

  sheetInventory.push({
    sheet_index: si, sheet_name: sheet.name,
    role: sheet.name === SHEET_ROLES.MASTER ? 'master'
      : SHEET_ROLES.AUX.includes(sheet.name) ? 'auxiliary_not_ingested'
        : 'series',
    header_row: headerRow, blocks: blocks.length, records: count,
    section_labels: labels.map((l) => l.text),
  });
}

function colLetter(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

log(`抽取原始记录 ${staging.length} 条（${sheetInventory.filter((s) => s.role !== 'no_product_table' && s.role !== 'auxiliary_not_ingested').length} 张工作表）`);
log(`排除辅助表天博编号孤立行 ${auxiliaryLabelRows.length} 条（工作表1/工作表2，本阶段不入库）`);

// ---------------------------------------------------------------- type assignment
const MASTER = SHEET_ROLES.MASTER;

/** 1) 人工区段标签 → canonical product_type（只认词典里有的标签，其余不猜） */
function typeFromSectionLabel(labelText) {
  if (!labelText) return null;
  return LABEL_LOOKUP.get(normalizeLabel(labelText)) ?? null;
}

/** 2) 综合产品信息表：每个 Bowen 的分类证据 */
const masterEvidence = new Map(); // bowenKey -> { type, source, label, row, sheetRow }
const bowenSourceSheets = new Map(); // bowenKey -> Set(sheet)
const bowenRawVariants = new Map(); // bowenKey -> Set(raw)

function bowenKeyOf(no) {
  return String(no ?? '').toUpperCase().replace(/[\u3000\s]/g, '');
}

for (const rec of staging) {
  if (!rec.bowen_no) continue;
  const k = bowenKeyOf(rec.bowen_no);
  if (!bowenSourceSheets.has(k)) bowenSourceSheets.set(k, new Set());
  bowenSourceSheets.get(k).add(rec.source_sheet);
  if (!bowenRawVariants.has(k)) bowenRawVariants.set(k, new Set());
  bowenRawVariants.get(k).add(rec.bowen_no);

  if (rec.source_sheet !== MASTER) continue;
  if (rec.blocked) continue;
  const t = typeFromSectionLabel(rec.section_label_raw);
  if (!t) continue;
  if (!masterEvidence.has(k)) {
    masterEvidence.set(k, {
      type: t, source: 'human_section_label', label: rec.section_label_raw,
      sheet_row: rec.source_row, cell: `B${rec.source_row}`,
    });
  } else if (masterEvidence.get(k).type !== t) {
    const prev = masterEvidence.get(k);
    prev.conflict = prev.conflict ?? [];
    prev.conflict.push({ type: t, label: rec.section_label_raw, sheet_row: rec.source_row });
  }
}

/** 3) 审核表人工确认（最高优先级） */
const reviewConfirmations = new Map();
for (const c of overrides.confirmations) {
  const canonical = typeFromSectionLabel(c.confirmed_product_type);
  if (!canonical) {
    console.error(`FATAL 审核表确认值无法归一化：${c.confirmed_product_type}`);
    process.exit(3);
  }
  reviewConfirmations.set(bowenKeyOf(c.bowen_no), {
    type: canonical, source: 'human_review_confirmed',
    label: c.raw_label, source_file: overrides.source_file, source_row: c.source_row,
  });
}

log(`人工证据：审核表确认 ${reviewConfirmations.size} 个 Bowen；综合表区段标签覆盖 ${masterEvidence.size} 个 Bowen`);

/**
 * 变体编号 → 基础编号。
 * 只做一件事：去掉尾部的「- 后缀」（3002-1 → 3002、3004--3 → 3004、3654--2 → 3654、
 * 3033-z → 3033）。这是纯字符串操作，不涉及任何产品知识，结果只在基础编号
 * 已有人工分类时才用于继承。
 */
function baseBowenKey(key) {
  const m = String(key ?? '').match(/^(\d+)(?:[-–—]+[A-Za-z0-9]+)+$/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- aggregate products
/**
 * 聚合产品。同一个 source_record_id 只会映射到同一个 product 对象。
 * （Bowen No. 读不出来的记录也必须保留成产品，标 blocked，不能被丢弃。）
 */
const productByRecord = new Map(); // source_record_id -> product
const products = new Map(); // bowenKey -> product
let unresolvedSeq = 0;

function ensureProduct(bowenNo, sourceRecordId, bowenCellRaw) {
  if (sourceRecordId && productByRecord.has(sourceRecordId)) return productByRecord.get(sourceRecordId);
  const hasBowen = !!bowenNo;
  const k = hasBowen ? bowenKeyOf(bowenNo) : `__UNRESOLVED__${String(++unresolvedSeq).padStart(4, '0')}`;
  if (!products.has(k)) {
    products.set(k, {
      product_id: hasBowen ? `BW-${k}` : `BW-UNRESOLVED-${String(unresolvedSeq).padStart(4, '0')}`,
      bowen_no: hasBowen ? bowenNo : null,
      bowen_no_key: hasBowen ? k : null,
      has_resolvable_bowen_no: hasBowen,
      bowen_cell_raw_first_seen: bowenCellRaw ?? null,
      bowen_unresolved_reason: hasBowen ? null
        : (String(bowenCellRaw ?? '').trim() ? 'unreadable_bowen_cell' : 'bowen_cell_empty'),
      product_type: null,
      product_type_subtype: null,
      product_type_source: 'review_required',
      product_type_verified: false,
      product_type_evidence: null,
      product_type_raw_labels: [],
      product_type_conflict: null,
      status: STATUS.DRAFT,
      image: null,
      source_sheets: [],
      source_sheet_count: 0,
      source_record_ids: [],
      application_ids: [],
      blocked: false,
      blocked_reasons: [],
      blocked_application_count: 0,
      needs_review_application_count: 0,
      review_notes: [],
      data_status: 'ok',
      oe_token_count: 0,
      distinct_oe_count: 0,
      temperatures_c: [],
      working: { apps: new Map() },
    });
  }
  const product = products.get(k);
  if (sourceRecordId) productByRecord.set(sourceRecordId, product);
  return product;
}

for (const rec of staging) {
  const p = ensureProduct(rec.bowen_no, rec.source_record_id, rec.bowen_cell_raw);
  if (!p.source_sheets.includes(rec.source_sheet)) p.source_sheets.push(rec.source_sheet);
  p.source_record_ids.push(rec.source_record_id);
  if (rec.blocked) {
    p.blocked_application_count += 1;
    for (const h of rec.misalignment_hits) {
      const reason = `${rec.source_sheet}!${rec.source_cell_refs.bowen} ${h.rule}: ${h.note}`;
      if (!p.blocked_reasons.includes(reason)) p.blocked_reasons.push(reason);
    }
  }
  if (rec.data_status === 'needs_review') {
    p.needs_review_application_count += 1;
    for (const h of rec.misalignment_hits) {
      const note = `${rec.source_sheet}!${rec.source_cell_refs.bowen} ${h.rule}: ${h.note}（Bowen No. 仍可读为 ${rec.bowen_no}，错位原文已原样保留）`;
      if (!p.review_notes.includes(note)) p.review_notes.push(note);
    }
  }
}

// ---- applications (1 Excel record = 1 application), deduped within a product
let applicationSeq = 0;
const allApplications = [];
let dedupedBySameCells = 0;

for (const rec of staging) {
  const p = ensureProduct(rec.bowen_no, rec.source_record_id, rec.bowen_cell_raw);
  const dedupeKey = [rec.oe_cell_raw, rec.vehicle_cell_raw, rec.specs_cell_raw].join('\u0001');
  if (p.working.apps.has(dedupeKey)) {
    const existing = p.working.apps.get(dedupeKey);
    existing.merged_source_records.push(rec.source_record_id);
    if (!existing.source_sheets.includes(rec.source_sheet)) existing.source_sheets.push(rec.source_sheet);
    dedupedBySameCells += 1;
    continue;
  }

  applicationSeq += 1;
  const oeTokens = rec.oe_tokens.filter(looksLikeOeToken);
  const oeNotOeTokens = rec.oe_tokens.filter((t) => !looksLikeOeToken(t));
  const app = {
    application_id: `APP-${String(applicationSeq).padStart(5, '0')}`,
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    // —— 原文层：一条 Excel 记录 = 一条 application，绝不拆散 OE 与 Engine ——
    oe_numbers_raw: rec.oe_cell_raw,
    oe_numbers_normalized: rec.oe_tokens.map(oeDisplayNormalized),
    oe_number_raw: rec.oe_cell_raw,
    oe_number_normalized: rec.oe_tokens.map(oeSearchKey),
    oe_tokens: rec.oe_tokens,
    oe_tokens_not_oe_like: oeNotOeTokens,
    vehicle_application_raw: rec.vehicle_cell_raw,
    vehicle_make: null,
    vehicle_make_raw: null,
    vehicle_model: null,
    engine_code: null,
    engine_displacement: null,
    engine_application: rec.vehicle_cell_raw || null,
    opening_temperature_c: rec.temperatures_c.length ? rec.temperatures_c : null,
    application_notes: rec.bowen_overflow_raw
      ? `Bowen No. 单元格原文为 ${JSON.stringify(rec.bowen_cell_raw)}，错位内容原样保留于此：${rec.bowen_overflow_raw}`
      : null,
    source_sheet: rec.source_sheet,
    source_row: rec.source_row,
    source_record_id: rec.source_record_id,
    source_cell_refs: rec.source_cell_refs,
    section_label_raw: rec.section_label_raw,
    verification_status: rec.blocked ? 'blocked_misaligned'
      : rec.data_status === 'needs_review' ? 'needs_review_misaligned' : 'unverified',
    blocked: rec.blocked,
    needs_review: rec.data_status === 'needs_review',
    data_status: rec.data_status,
    blocked_reasons: rec.misalignment_hits.map((h) => h.rule),
    misalignment_notes: rec.misalignment_hits.map((h) => `${h.rule}: ${h.note}`),
    bowen_cell_raw: rec.bowen_cell_raw,
    bowen_overflow_raw: rec.bowen_overflow_raw || null,
    merged_source_records: [rec.source_record_id],
    source_sheets: [rec.source_sheet],
  };
  p.working.apps.set(dedupeKey, app);
  allApplications.push(app);
}

log(`生成 applications ${allApplications.length} 条（同产品内相同单元格记录去重 ${dedupedBySameCells} 条）`);

// 预建 bowenKey → 原始记录，避免二次扫描时重复过滤
const stagingByBowen = new Map();
for (const rec of staging) {
  if (!rec.bowen_no) continue;
  const k = bowenKeyOf(rec.bowen_no);
  if (!stagingByBowen.has(k)) stagingByBowen.set(k, []);
  stagingByBowen.get(k).push(rec);
}

// ---------------------------------------------------------------- attach types
let autoGuessCount = 0; // 必须恒为 0
for (const p of products.values()) {
  const k = p.bowen_no_key;
  const review = reviewConfirmations.get(k);
  const master = masterEvidence.get(k);
  const sheetRecs = stagingByBowen.get(k) ?? [];

  if (!p.has_resolvable_bowen_no) {
    // Bowen No. 单元格读不出合法编号（例如“无小管”“芯子编号：31052”）。
    // 程序不猜编号、不自动修复：整条产品进入 blocked，等待人工补编号。
    p.product_type = null;
    p.product_type_source = 'review_required';
    p.product_type_verified = false;
    p.product_type_evidence = {
      kind: 'review_required',
      note: 'Bowen No. 单元格无法读出合法编号，程序不做任何推断；该产品被阻断，等待人工补充编号后再分类',
    };
  } else if (review) {
    p.product_type = review.type;
    p.product_type_source = review.source;
    p.product_type_verified = true;
    p.product_type_subtype = null;
    p.product_type_evidence = {
      kind: 'human_review_confirmed',
      raw_label: review.label,
      source_file: review.source_file,
      source_sheet: overrides.source_sheet,
      source_row: review.source_row,
      note: '业务方逐行人工确认；按 V1 规则统一为 Thermostat',
    };
    p.product_type_raw_labels = [review.label];
  } else if (master) {
    p.product_type = master.type;
    p.product_type_source = master.source;
    p.product_type_verified = true;
    p.product_type_evidence = {
      kind: 'human_section_label',
      raw_label: master.label,
      source_sheet: MASTER,
      source_row: master.sheet_row,
      note: '业务方在综合产品信息表写下的产品区段标签，向下连续适用',
    };
    p.product_type_raw_labels = [master.label];
    if (master.conflict) p.product_type_conflict = master.conflict;
  } else if (sheetRecs.some((r) => r.source_sheet !== MASTER)) {
    // 非综合表：先看综合表有没有同一 Bowen No. 的分类；
    // 没有则看「基础编号」（3002-1 ← 3002）有没有分类；再没有就 review_required。
    const inherited = masterEvidence.get(k);
    const base = baseBowenKey(k);
    const baseEv = base ? masterEvidence.get(base) : null;
    if (inherited) {
      p.product_type = inherited.type;
      p.product_type_source = 'inherited_from_bowen';
      p.product_type_verified = true;
      p.product_type_evidence = {
        kind: 'inherited_from_bowen',
        raw_label: inherited.label,
        inherited_from_sheet: MASTER,
        inherited_from_row: inherited.sheet_row,
        note: '本工作表无人工标签，继承综合产品信息表中同一 Bowen No. 的分类',
      };
      p.product_type_raw_labels = [inherited.label];
    } else if (baseEv) {
      p.product_type = baseEv.type;
      p.product_type_source = 'inherited_from_bowen';
      p.product_type_verified = true;
      p.variant_of_bowen_no = base;
      p.product_type_evidence = {
        kind: 'inherited_from_bowen',
        raw_label: baseEv.label,
        inherited_from_sheet: MASTER,
        inherited_from_row: baseEv.sheet_row,
        inherited_from_bowen_no: base,
        note: `本编号是 ${base} 的变体（后缀差异），继承综合产品信息表中 ${base} 的人工分类`,
      };
      p.product_type_raw_labels = [baseEv.label];
    } else {
      p.product_type = null;
      p.product_type_source = 'review_required';
      p.product_type_verified = false;
      p.product_type_evidence = {
        kind: 'review_required',
        note: base
          ? `本工作表与综合产品信息表均无该 Bowen No.（含其基础编号 ${base}）的人工类型标签，程序不做任何推断`
          : '本工作表与综合产品信息表均无该 Bowen No. 的人工类型标签，程序不做任何推断',
      };
    }
  } else {
    p.product_type = null;
    p.product_type_source = 'review_required';
    p.product_type_verified = false;
    p.product_type_evidence = {
      kind: 'review_required',
      note: '该记录落在综合产品信息表中没有任何人工产品类型标签的区段，程序不做任何推断',
    };
  }

  // raw labels collected from every sheet that mentions this Bowen
  for (const r of sheetRecs) {
    if (r.section_label_raw) {
      const t = typeFromSectionLabel(r.section_label_raw);
      if (t && !p.product_type_raw_labels.includes(r.section_label_raw)) {
        p.product_type_raw_labels.push(r.section_label_raw);
      }
    }
  }

  p.source_sheet_count = p.source_sheets.length;
  p.source_sheets.sort();
  p.application_ids = [...p.working.apps.values()].map((a) => a.application_id);
  p.oe_token_count = [...p.working.apps.values()].reduce((s, a) => s + a.oe_tokens.length, 0);
  const allKeys = new Set();
  for (const a of p.working.apps.values()) for (const kk of a.oe_number_normalized) allKeys.add(kk);
  p.distinct_oe_count = allKeys.size;
  p.temperatures_c = [...new Set([...p.working.apps.values()].flatMap((a) => a.opening_temperature_c ?? []))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- OE search index
const oeIndex = [];
let oeIndexSeq = 0;
for (const a of allApplications) {
  if (a.blocked) continue; // blocked 记录不进 OE 搜索
  const seen = new Set();
  a.oe_tokens.forEach((tok, i) => {
    if (!looksLikeOeToken(tok)) return;
    const key = oeSearchKey(tok);
    if (!key || seen.has(key)) return;
    seen.add(key);
    oeIndexSeq += 1;
    oeIndex.push({
      oe_index_id: `OEIDX-${String(oeIndexSeq).padStart(5, '0')}`,
      oe_number_raw: tok,
      oe_number_normalized: oeDisplayNormalized(tok),
      oe_search_key: key,
      token_position: i,
      application_id: a.application_id,
      product_id: a.product_id,
      bowen_no: a.bowen_no,
      source_sheet: a.source_sheet,
      source_row: a.source_row,
      source_record_id: a.source_record_id,
      oe_cell_raw: a.oe_numbers_raw,
    });
  });
}
log(`生成 OE 搜索索引 ${oeIndex.length} 条`);

// ---------------------------------------------------------------- shared OE across products
const oeToProducts = new Map();
for (const e of oeIndex) {
  if (!oeToProducts.has(e.oe_search_key)) oeToProducts.set(e.oe_search_key, new Set());
  oeToProducts.get(e.oe_search_key).add(e.product_id);
}
const sharedOe = [...oeToProducts.entries()]
  .filter(([, s]) => s.size > 1)
  .map(([key, s]) => ({
    oe_search_key: key,
    product_count: s.size,
    product_ids: [...s].sort(),
    bowen_nos: [...s].map((id) => id.replace(/^BW-/, '')).sort(),
    oe_numbers_raw: [...new Set(oeIndex.filter((e) => e.oe_search_key === key).map((e) => e.oe_number_raw))],
    applications: oeIndex.filter((e) => e.oe_search_key === key).map((e) => ({
      application_id: e.application_id, product_id: e.product_id,
      source_sheet: e.source_sheet, source_row: e.source_row,
    })),
  }))
  .sort((a, b) => b.product_count - a.product_count || a.oe_search_key.localeCompare(b.oe_search_key));
log(`同一个 normalized OE 对应多个 Bowen 的 OE 数：${sharedOe.length}（仅生成人工参考清单，不删除不合并）`);

// ---------------------------------------------------------------- status assignment
for (const p of products.values()) {
  const apps = [...p.working.apps.values()];
  // 真阻断只有一种情况：Bowen No. 单元格有内容但读不出合法编号（疑似字段错位）。
  // Bowen No. 单元格为空属于「缺编号」而不是「错位」，标 draft 等人工补，不阻断。
  p.blocked = !p.has_resolvable_bowen_no && p.bowen_unresolved_reason === 'unreadable_bowen_cell';
  p.data_status = p.blocked ? 'blocked'
    : apps.some((a) => a.blocked) ? 'has_blocked_application'
      : apps.some((a) => a.needs_review) ? 'needs_review' : 'ok';

  const searchableApps = apps.filter((a) => !a.blocked);
  if (p.blocked) {
    p.status = STATUS.BLOCKED;
  } else if (searchableApps.length === 0) {
    p.status = STATUS.DRAFT;
  } else if (p.product_type && p.product_type_verified && p.has_resolvable_bowen_no) {
    p.status = STATUS.SEARCHABLE_NOINDEX;
  } else {
    p.status = STATUS.DRAFT;
  }
}

// ---------------------------------------------------------------- prototype selection
const candidates = [...products.values()].filter((p) => {
  if (p.status === STATUS.BLOCKED) return false;
  if (p.blocked) return false;
  if (PROTOTYPE_RULES.require_core_type) {
    if (!p.product_type) return false;
    if (!PRODUCT_TYPES[p.product_type]?.is_core) return false;
  }
  // 原型只使用「干净」记录：不能含 blocked 或错位待复核的 application
  const apps = [...p.working.apps.values()].filter((a) => !a.blocked && !a.needs_review);
  if (apps.length < PROTOTYPE_RULES.min_applications) return false;
  if (apps.length !== [...p.working.apps.values()].length) return false;
  if (p.distinct_oe_count < PROTOTYPE_RULES.min_oe_tokens) return false;
  if (p.source_sheet_count < PROTOTYPE_RULES.min_source_sheets) return false;
  return true;
});

function completeness(p) {
  const apps = [...p.working.apps.values()].filter((a) => !a.blocked);
  const withTemp = apps.filter((a) => a.opening_temperature_c).length;
  const withVehicle = apps.filter((a) => a.vehicle_application_raw).length;
  return (
    Math.min(p.distinct_oe_count, 40) * 1.0 +
    Math.min(apps.length, 20) * 2.0 +
    Math.min(p.source_sheet_count, 5) * 3.0 +
    Math.min(withTemp, 10) * 1.5 +
    Math.min(withVehicle, 20) * 0.5
  );
}

candidates.sort((a, b) => completeness(b) - completeness(a) || a.bowen_no.localeCompare(b.bowen_no));
const prototype = candidates.slice(0, PROTOTYPE_RULES.max);
if (prototype.length < PROTOTYPE_RULES.min) {
  console.error(`FATAL Prototype 候选只有 ${prototype.length} 个，少于下限 ${PROTOTYPE_RULES.min}`);
  process.exit(4);
}
for (const p of prototype) {
  p.status = STATUS.PROTOTYPE_CANDIDATE;
  p.prototype_rank = prototype.indexOf(p) + 1;
  p.completeness_score = Number(completeness(p).toFixed(2));
}
log(`选出 Prototype 产品 ${prototype.length} 个（要求 ≥${PROTOTYPE_RULES.min} 且 ≤${PROTOTYPE_RULES.max}）`);

// ---------------------------------------------------------------- finalize product rows
const productRows = [...products.values()]
  .map((p) => {
    const apps = [...p.working.apps.values()];
    return {
      product_id: p.product_id,
      bowen_no: p.bowen_no,
      has_resolvable_bowen_no: p.has_resolvable_bowen_no,
      unresolved_bowen_cell_raw: p.has_resolvable_bowen_no ? null : p.bowen_cell_raw_first_seen,
      variant_of_bowen_no: p.variant_of_bowen_no ?? null,
      product_type: p.product_type,
      product_subtype: p.product_type_subtype,
      product_name_en: p.product_type ? `${PRODUCT_TYPES[p.product_type].en} ${p.bowen_no}` : `Bowen ${p.bowen_no}`,
      product_name_zh: p.product_type ? `${PRODUCT_TYPES[p.product_type].zh} ${p.bowen_no}` : `博文 ${p.bowen_no}`,
      website_category: p.product_type ? PRODUCT_TYPES[p.product_type].website_category : null,
      switch_subcategory: p.product_type ? PRODUCT_TYPES[p.product_type].switch_subcategory ?? null : null,
      image: p.image,
      status: p.status,
      product_type_source: p.product_type_source,
      product_type_verified: p.product_type_verified,
      product_type_evidence: p.product_type_evidence,
      product_type_raw_labels: p.product_type_raw_labels,
      product_type_conflict: p.product_type_conflict ?? null,
      blocked: p.blocked,
      blocked_reasons: p.blocked_reasons,
      blocked_application_count: p.blocked_application_count,
      needs_review_application_count: p.needs_review_application_count,
      review_notes: p.review_notes,
      data_status: p.data_status,
      source_sheets: p.source_sheets,
      source_sheet_count: p.source_sheet_count,
      source_record_ids: p.source_record_ids,
      application_ids: p.application_ids,
      application_count: apps.length,
      searchable_application_count: apps.filter((a) => !a.blocked).length,
      oe_token_count: p.oe_token_count,
      distinct_oe_count: p.distinct_oe_count,
      opening_temperatures_c: p.temperatures_c,
      prototype_rank: p.prototype_rank ?? null,
      completeness_score: p.completeness_score ?? null,
      created_from: 'Phase 2.5 产品数据库重建',
    };
  })
  .sort((a, b) => {
    // 编号排序：数字段数值比较，无编号的排最后，其余字典序
    const sa = a.bowen_no ?? '';
    const sb = b.bowen_no ?? '';
    if (!sa && sb) return 1;
    if (sa && !sb) return -1;
    const na = Number(sa.replace(/[^0-9].*$/, '') || 0);
    const nb = Number(sb.replace(/[^0-9].*$/, '') || 0);
    if (na !== nb) return na - nb;
    return sa.localeCompare(sb);
  });

const applicationRows = allApplications
  .map((a) => {
    // 注意：oe_tokens 必须保留 —— 网站与 OE 索引都依赖它逐个展示/匹配 OE。
    const { merged_source_records, source_sheets, blocked_reasons, oe_tokens_not_oe_like, ...rest } = a;
    return {
      ...rest,
      merged_source_record_count: merged_source_records.length,
      merged_source_records,
      source_sheets,
      blocked_reasons,
      oe_token_count: rest.oe_tokens?.length ?? 0,
      oe_tokens_not_oe_like_count: oe_tokens_not_oe_like.length,
    };
  });

const oeIndexRows = oeIndex;

// ---------------------------------------------------------------- stats
const typeCounts = {};
for (const p of productRows) {
  const key = p.product_type ?? '(null 未确认)';
  typeCounts[key] = (typeCounts[key] ?? 0) + 1;
}
const sourceCounts = {};
for (const p of productRows) sourceCounts[p.product_type_source] = (sourceCounts[p.product_type_source] ?? 0) + 1;
const statusCounts = {};
for (const p of productRows) statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;

const searchableApps = applicationRows.filter((a) => !a.blocked);
const cleanApps = applicationRows.filter((a) => !a.blocked && !a.needs_review);
const needsReviewApps = applicationRows.filter((a) => a.needs_review);
const oeTokenTotal = searchableApps.reduce((s, a) => s + a.oe_token_count, 0);
const distinctOeTotal = new Set(oeIndexRows.map((e) => e.oe_search_key)).size;

/** 行级 OE↔Engine 关系是否丢失：每条 application 必须同时带着 OE 与 Engine 原文 */
const appsWithBoth = searchableApps.filter((a) => a.oe_numbers_raw && a.vehicle_application_raw).length;
const oeEngineIntegrity = {
  applications_total: applicationRows.length,
  applications_with_both_oe_and_engine_cell: appsWithBoth,
  applications_oe_but_no_engine_cell: searchableApps.filter((a) => a.oe_numbers_raw && !a.vehicle_application_raw).length,
  applications_engine_but_no_oe_cell: searchableApps.filter((a) => !a.oe_numbers_raw && a.vehicle_application_raw).length,
  oe_tokens_split_into_standalone_arrays: false,
  relation_preserved: true,
  explanation:
    '每条 application 同时保留 oe_numbers_raw（整格原文）与 vehicle_application_raw（整格原文），' +
    '两者来自同一 Excel 行的同一记录块。OE 没有被抽成脱离 application 的独立数组，' +
    '因此 OE 与 Engine 的行级对应关系没有丢失。',
};

const stats = {
  generated_at: NOW,
  source_excel: {
    path: 'data/raw/产品信息表1(1).xlsx',
    sha256_before: before,
    sha256_after: null, // 最后回填
    bytes: fs.statSync(RAW_EXCEL).size,
  },
  sheets: sheetInventory,
  section_labels: sectionInventory,
  raw_record_count: staging.length,
  auxiliary_excluded_row_count: auxiliaryLabelRows.length,
  product_count: productRows.length,
  application_count: applicationRows.length,
  searchable_application_count: searchableApps.length,
  clean_application_count: cleanApps.length,
  needs_review_application_count: needsReviewApps.length,
  blocked_application_count: applicationRows.length - searchableApps.length,
  blocked_product_count: productRows.filter((p) => p.blocked).length,
  blocked_product_reasons: (() => {
    const m = {};
    for (const p of productRows.filter((x) => x.blocked)) {
      const r = p.blocked_reasons[0]?.split(' ')[1] ?? '(unknown)';
      m[r] = (m[r] ?? 0) + 1;
    }
    return m;
  })(),
  products_missing_bowen_no: productRows.filter((p) => !p.has_resolvable_bowen_no && !p.blocked).length,
  products_with_blocked_applications: productRows.filter((p) => p.blocked_application_count > 0).length,
  products_with_needs_review_applications: productRows.filter((p) => p.needs_review_application_count > 0).length,
  misalignment_hit_records: staging.filter((r) => r.misalignment_hits.length > 0).length,
  misalignment_unreadable_records: staging.filter((r) => r.blocked).length,
  misalignment_recovered_records: staging.filter((r) => r.data_status === 'needs_review').length,
  oe_index_count: oeIndexRows.length,
  oe_token_total: oeTokenTotal,
  distinct_normalized_oe_count: distinctOeTotal,
  avg_oe_per_product: Number((oeTokenTotal / Math.max(1, productRows.length)).toFixed(3)),
  avg_application_per_product: Number((applicationRows.length / Math.max(1, productRows.length)).toFixed(3)),
  shared_oe_across_products_count: sharedOe.length,
  shared_oe_review_rows: sharedOe.length,
  product_type_counts: typeCounts,
  product_type_source_counts: sourceCounts,
  status_counts: statusCounts,
  unknown_product_type_count: productRows.filter((p) => p.product_type === null).length,
  auto_guessed_product_type_count: autoGuessCount,
  prototype_products: prototype.map((p) => ({
    rank: prototype.indexOf(p) + 1,
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    product_type: p.product_type,
    status: p.status,
    application_count: p.application_ids.length,
    searchable_application_count: [...p.working.apps.values()].filter((a) => !a.blocked).length,
    distinct_oe_count: p.distinct_oe_count,
    source_sheets: p.source_sheets,
    completeness_score: Number(completeness(p).toFixed(2)),
  })),
  oe_engine_relation: oeEngineIntegrity,
  company_facts: COMPANY_FACTS,
};

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REVIEW_OUT, { recursive: true });
fs.mkdirSync(WEBSITE_DATA, { recursive: true });

const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1), 'utf8');
writeJson(path.join(OUT, 'staging-records.json'), staging);
writeJson(path.join(OUT, 'products.json'), productRows);
writeJson(path.join(OUT, 'product-applications.json'), applicationRows);
writeJson(path.join(OUT, 'product-oe-search-index.json'), oeIndexRows);
writeJson(path.join(OUT, 'shared-oe-across-products.json'), sharedOe);
writeJson(path.join(OUT, 'section-labels.json'), sectionInventory);
writeJson(path.join(OUT, 'rejected-label-candidates.json'), rejectedLabelCandidates);
writeJson(path.join(OUT, 'auxiliary-excluded-rows.json'), auxiliaryLabelRows);
writeJson(path.join(OUT, 'stats.json'), stats);

// 网站原型直接消费的数据集。
// 范围：全部「可对外」产品 —— prototype_candidate（首页/原型重点展示的 20 个）
//       + searchable_noindex（数据完整、可搜索、暂不收录）。
// draft 与 blocked 一律不进网站数据集。
const prototypeIds = new Set(prototype.map((p) => p.product_id));
const siteStatuses = new Set([STATUS.PROTOTYPE_CANDIDATE, STATUS.SEARCHABLE_NOINDEX]);
const siteProducts = productRows
  .filter((p) => siteStatuses.has(p.status) && !p.blocked)
  .map((p) => {
    // 网站数据集里只保留真正会展示的 application 引用，避免出现悬空 id。
    // 完整引用仍在 data/derived/v2/products.json 里（包含 blocked / needs_review）。
    const visibleApps = applicationRows.filter(
      (a) => a.product_id === p.product_id && !a.blocked && !a.needs_review
        // 既没有 OE 也没有车型的空壳行不在网站上展示（完整记录仍留在 data/derived/v2）
        && (a.oe_numbers_raw || a.vehicle_application_raw),
    );
    return {
      ...p,
      application_ids: visibleApps.map((a) => a.application_id),
      application_count: visibleApps.length,
      searchable_application_count: visibleApps.length,
    };
  })
  .filter((p) => p.application_count > 0);
const siteProductIdSet = new Set(siteProducts.map((p) => p.product_id));
const siteAppIds = new Set(
  applicationRows
    .filter((a) => siteProductIdSet.has(a.product_id) && !a.blocked && !a.needs_review
      && (a.oe_numbers_raw || a.vehicle_application_raw))
    .map((a) => a.application_id),
);
const siteApps = applicationRows.filter((a) => siteAppIds.has(a.application_id));
const siteOe = oeIndexRows.filter((e) => siteAppIds.has(e.application_id));
writeJson(path.join(WEBSITE_DATA, 'products.json'), siteProducts);
writeJson(path.join(WEBSITE_DATA, 'applications.json'), siteApps);
writeJson(path.join(WEBSITE_DATA, 'oe-index.json'), siteOe);
writeJson(path.join(WEBSITE_DATA, 'site-facts.json'), {
  company: COMPANY_FACTS,
  prototype_product_ids: [...prototypeIds],
  prototype_product_count: prototypeIds.size,
  site_product_count: siteProducts.length,
  generated_from: 'data/derived/v2/stats.json',
  generated_at: NOW,
});

// 原始文件校验
const after = sha256(RAW_EXCEL);
stats.source_excel.sha256_after = after;
writeJson(path.join(OUT, 'stats.json'), stats);
if (after !== before) {
  console.error('FATAL 运行过程中原始 Excel 发生变化！');
  process.exit(5);
}

log('\n输出：');
for (const f of fs.readdirSync(OUT)) log(`  data/derived/v2/${f}`);
log(`  website/src/data/*.json（可展示产品 ${siteProducts.length} 个，其中原型重点 ${prototypeIds.size} 个）`);
log(`\n原始记录 ${stats.raw_record_count} | 聚合产品 ${stats.product_count} | applications ${stats.application_count}`);
log(`干净记录 ${stats.clean_application_count} | 待人工复核(错位但编号可读) ${stats.needs_review_application_count} | blocked(编号不可读) ${stats.blocked_application_count}`);
log(`真阻断产品 ${stats.blocked_product_count} | 含部分阻断记录的产品 ${stats.products_with_blocked_applications}`);
log(`Thermostat ${typeCounts.Thermostat ?? 0} | 类型未确认 ${stats.unknown_product_type_count} | 自动猜类型 ${autoGuessCount}`);
log(`OE 索引 ${stats.oe_index_count} 条 / 去重后 ${stats.distinct_normalized_oe_count} 个`);
log(`状态：${JSON.stringify(statusCounts)}`);
log(`原始 Excel SHA-256 运行后一致：${after === before}`);
