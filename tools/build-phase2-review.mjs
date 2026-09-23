/**
 * ⚠️ 已取代（superseded）—— 请勿用于当前阶段
 * ---------------------------------------------------------------------
 * 本脚本生成的是 Phase 2 第一版的 **CSV** 审核表
 * （first-72-products-review.csv、shared-oe-review.csv、
 *   bowen-variant-review.csv、row-misalignment-review.csv）。
 *
 * 该阶段目标「自动确认 72 个 Published 产品」已被取消，
 * 现阶段的审核交付物已改为**带下拉菜单的 Excel**，由
 *   tools/build-phase2-package.mjs
 * 生成，输出到 review/*.xlsx。
 *
 * 原 CSV 已归档到 review/_archive_phase2-csv/，仅作历史留档。
 * 本脚本默认拒绝运行，避免误生成过时文件造成混淆。
 * 如果确实需要重新生成历史 CSV，请显式传 --force-legacy。
 * ---------------------------------------------------------------------
 */
if (!process.argv.includes('--force-legacy')) {
  console.error('本脚本已取代，请使用 tools/build-phase2-package.mjs 生成当前审核包。');
  console.error('（如确需重新生成历史 CSV，请显式传 --force-legacy）');
  process.exit(2);
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bowenKey, parseBowenNo } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');
const REVIEW = path.join(ROOT, 'review');
const DATA_VERSION = 'v2.0.0-phase2';

// =====================================================================
// CSV 工具
// =====================================================================
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
/** 写出带 BOM、LF 换行的 CSV；首行可为中文图例（以 # 开头） */
function writeReviewCsv(file, header, rows, legendRows = []) {
  const lines = [];
  for (const l of legendRows) lines.push('#' + l.map(csvCell).join(','));
  lines.push(header.join(','));
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\n') + '\n', 'utf8');
  return rows.length;
}

// =====================================================================
// 读取 Phase 1 产出
// =====================================================================
const products = readCsv('products.csv');
const oes = readCsv('product-oe-index.csv');
const batch = readCsv('first-batch-published.csv');
const stats = JSON.parse(fs.readFileSync(path.join(D, 'stats.json'), 'utf8'));
const sheetInv = JSON.parse(fs.readFileSync(path.join(D, 'sheet-inventory.json'), 'utf8'));

const byId = new Map(products.map((p) => [p.product_id, p]));
const batchIds = new Set(batch.map((b) => b.product_id));

// =====================================================================
// 问题检测规则（全部可复核）
// =====================================================================
/** Bowen No. 单元格被污染：混入尺寸 */
const isBowenDirtyDimensions = (raw) => /\d\s*[*x×]\s*\d/.test(String(raw || ''));
/** Bowen No. 单元格含两个编号 */
const isBowenTwoNumbers = (raw) => {
  const s = String(raw || '');
  const hits = s.match(/\d{3,}/g) || [];
  return hits.length > 1;
};
/** Bowen No. 单元格含单位/温度文字 */
const isBowenUnitText = (raw) => /[℃°]|\d\s*(mm|bar)\b/i.test(String(raw || ''));
/** Bowen No. 单元格含括号注释（交叉引用或零件描述） */
const isBowenParenNote = (raw) => /[（(][^)）]*[)）]/.test(String(raw || ''));
/** 括号里是否是“另一个编号”（交叉引用），而不是英文描述 */
const parenHasCrossReference = (raw) => {
  const m = String(raw || '').match(/[（(]([^)）]*)[)）]/);
  if (!m) return false;
  const inner = m[1].trim();
  if (!/\d/.test(inner)) return false;                       // 无数字 → 不是编号
  if (/sealing\s*ring/i.test(inner)) return false;           // "Sealing ring" 是零件描述
  return /^[0-9][0-9A-Za-z\-\s]*$/.test(inner.replace(/\s+/g, ' ').trim());
};

/**
 * 对单个产品计算 Phase 2 审核标记。
 * 返回 { flags: {}, suggestedActions: [], needsHuman: bool }
 */
function computeFlags(p, ctx) {
  const flags = {};
  const actions = [];
  const rawList = String(p.bowen_no_raw || '').split(' | ').map((s) => s.trim()).filter(Boolean);

  // ---- A. Bowen 编号问题 ----
  if (rawList.some(isBowenTwoNumbers)) {
    flags.bowen_contains_two_numbers = 'yes';
    actions.push('Bowen No. 单元格含两个编号：请确认应拆成两个产品，还是保留为一个');
  }
  if (rawList.some(isBowenDirtyDimensions)) {
    flags.bowen_contains_dimensions = 'yes';
    actions.push('Bowen No. 单元格混入尺寸（如 120*85*90）：疑似整行错位，请核对原表列位置');
  }
  if (rawList.some(isBowenUnitText)) {
    flags.bowen_contains_unit_text = 'yes';
    actions.push('Bowen No. 单元格混入单位/温度文字：请从编号中清除');
  }
  const parenRef = rawList.filter(parenHasCrossReference);
  if (parenRef.length) {
    flags.bowen_contains_cross_reference = 'yes';
    actions.push(`Bowen No. 括号内是另一个编号（${parenRef.join(' / ')}）：请确认是变体、替代号还是录错`);
  } else if (rawList.some(isBowenParenNote)) {
    flags.bowen_contains_parenthetical = 'yes';
    actions.push('Bowen No. 括号内是零件描述（如 Sealing ring）：请确认是否应移入 product_name 或备注');
  }

  // ---- B. Bowen 变体 ----
  const bk = p.bowen_no ? bowenKey(p.bowen_no) : { exact: '', base: '' };
  if (bk.exact && ctx.variantBaseSet.has(bk.base)) {
    flags.bowen_variant = 'yes';
    const fam = ctx.variantFamilies.get(bk.base) || [];
    actions.push(`Bowen 变体族「${bk.base}」共 ${fam.length} 个：${fam.join(' / ')}。请确认是同一产品的不同状态，还是不同产品`);
  }

  // ---- C. 共享 OE ----
  // 口径 A（宽）：该 OE 被 >=2 个“全库任意”产品引用
  // 口径 B（窄）：该 OE 被 >=2 个“第一批内部”产品引用（会直接影响首批上线结果）
  const sharedOes = ctx.sharedOeByProduct.get(p.product_id) || [];
  if (sharedOes.length) {
    flags.oe_shared = 'yes';
    flags.oe_shared_count = String(sharedOes.length);
    const batchOnly = ctx.sharedOeWithinBatchByProduct.get(p.product_id) || [];
    if (batchOnly.length) {
      flags.oe_shared_within_first_batch = 'yes';
      flags.oe_shared_within_first_batch_count = String(batchOnly.length);
    }
    actions.push(`${sharedOes.length} 个 OE 号被多个产品共用（其中 ${batchOnly.length} 个是与第一批内其他产品共用）：请确认是一号多型、替代关系还是录错（见 shared-oe-review.csv）`);
  }

  // ---- D. 跨表 OE 清单冲突 ----
  if (ctx.conflictBowens.has(bk.exact)) {
    flags.oe_list_conflict_across_sheets = 'yes';
    actions.push('同一编号在不同工作表的 OE 清单不一致：请确认哪张表为准（见 duplicates-bowen.csv）');
  }

  // ---- E. OE 拆分需确认 ----
  const oesOfProduct = ctx.oeByProduct.get(p.product_id) || [];
  const amb = oesOfProduct.filter((o) => o.oe_split_ambiguous === 'yes');
  if (amb.length) {
    flags.oe_split_ambiguous = 'yes';
    flags.oe_split_ambiguous_count = String(amb.length);
    actions.push(`${amb.length} 个 OE 号是按单个空格推断拆出来的：请确认拆分是否正确`);
  }
  const needReview = oesOfProduct.filter((o) => o.oe_needs_review === 'yes');
  if (needReview.length) {
    flags.oe_needs_review = 'yes';
    actions.push(`${needReview.length} 个 OE 条目需人工确认（空格拆分或整段保留）`);
  }

  // ---- F. 产品类型 / 命名 ----
  if (!p.product_type || p.product_type === 'REVIEW_REQUIRED') {
    flags.product_type_review_required = 'yes';
    actions.push(`产品类型待确认（系统建议：${p.product_type_suggestion || '无'}，原文无明确证据）`);
  }
  if (!p.product_name_en) {
    flags.product_name_missing = 'yes';
    actions.push('英文产品名待确认（网站产品页必需）');
  }

  // ---- G. 车型 / 发动机 ----
  if (!p.vehicle_make) {
    flags.vehicle_make_missing = 'yes';
    actions.push('未能从原文识别出车型品牌：请补录');
  }
  if (!p.vehicle_model) {
    flags.vehicle_model_missing = 'yes';
    actions.push('车型（vehicle_model）未填：原表把品牌/车型/发动机混在一列，需人工拆分或改为不展示该字段');
  }
  if (p.engine_code) {
    flags.engine_code_is_candidate = 'yes';
    actions.push(`发动机代码为程序抽取的候选值（${String(p.engine_code).split(' | ').length} 个），混有车型名，需人工确认`);
  }

  // ---- H. 图片 ----
  flags.image_missing = 'yes';   // 全部产品都没有图片路径
  actions.push('产品图片缺失：原表图片为嵌入式对象，与 Bowen No. 的对应关系待补（网站产品卡片必需）');

  const needsHuman = Object.keys(flags).length > 0;
  return { flags, actions, needsHuman };
}

// =====================================================================
// 建立上下文
// =====================================================================
// 1) 共享 OE
const oeGroups = new Map();
for (const o of oes) {
  if (!oeGroups.has(o.oe_match_key)) oeGroups.set(o.oe_match_key, []);
  oeGroups.get(o.oe_match_key).push(o);
}
const sharedOeByProduct = new Map();
const sharedOeWithinBatchByProduct = new Map();
for (const [k, list] of oeGroups) {
  const pids = [...new Set(list.map((x) => x.product_id))];
  if (pids.length < 2) continue;
  for (const pid of pids) {
    if (!sharedOeByProduct.has(pid)) sharedOeByProduct.set(pid, []);
    sharedOeByProduct.get(pid).push(list.find((x) => x.product_id === pid));
  }
  const inBatch = pids.filter((x) => batchIds.has(x));
  if (inBatch.length >= 2) {
    for (const pid of inBatch) {
      if (!sharedOeWithinBatchByProduct.has(pid)) sharedOeWithinBatchByProduct.set(pid, []);
      sharedOeWithinBatchByProduct.get(pid).push(list.find((x) => x.product_id === pid));
    }
  }
}

// 2) 变体族
const byBase = new Map();
for (const p of products) {
  if (!p.bowen_no) continue;
  const k = bowenKey(p.bowen_no);
  if (!byBase.has(k.base)) byBase.set(k.base, new Set());
  byBase.get(k.base).add(k.exact);
}
const variantFamilies = new Map();
for (const [base, set] of byBase) if (set.size > 1) variantFamilies.set(base, [...set].sort());
const variantBaseSet = new Set(variantFamilies.keys());

// 3) 跨表 OE 冲突（重算，口径与 Phase 1 一致）
const bowenSheets = new Map();
for (const o of oes) {
  const bn = o.bowen_no;
  if (!bn) continue;
  const k = bowenKey(bn).exact;
  if (!bowenSheets.has(k)) bowenSheets.set(k, new Map());
  const m = bowenSheets.get(k);
  if (!m.has(o.source_sheet)) m.set(o.source_sheet, new Set());
  m.get(o.source_sheet).add(o.oe_match_key);
}
const conflictBowens = new Set();
for (const [k, m] of bowenSheets) {
  if (m.size < 2) continue;
  const sets = [...m.values()];
  const union = new Set(sets.flatMap((s) => [...s]));
  if (sets.some((s) => s.size !== union.size)) conflictBowens.add(k);
}

// 4) 每个产品的 OE 列表
const oeByProduct = new Map();
for (const o of oes) {
  if (!oeByProduct.has(o.product_id)) oeByProduct.set(o.product_id, []);
  oeByProduct.get(o.product_id).push(o);
}

const ctx = { sharedOeByProduct, sharedOeWithinBatchByProduct, variantFamilies, variantBaseSet, conflictBowens, oeByProduct };

// =====================================================================
// 生成 1：first-72-products-review.csv
// =====================================================================
fs.mkdirSync(REVIEW, { recursive: true });

/**
 * 「阻塞性」问题：指数据本身可能有问题，必须先人工判断，不能靠补录解决。
 * 与「缺口」区分开——缺口是 product_type / product_name_en / 图片这类“必须人工填”的空字段，
 * 它们不阻塞数据正确性，但同样需要人工完成。
 */
const BLOCKING_FLAGS = ['bowen_contains_two_numbers', 'bowen_contains_dimensions', 'bowen_contains_unit_text',
  'bowen_contains_cross_reference', 'bowen_contains_parenthetical', 'bowen_variant',
  'oe_shared', 'oe_list_conflict_across_sheets', 'oe_split_ambiguous'];

const LEGEND_72 = [
  ['博文外贸独立站 — Phase 2 第一批 72 个产品人工确认表'],
  ['怎么用：只需要填写所有以 reviewer_ 开头的列。系统列（phase2_ 开头的列）请不要修改。'],
  [''],
  ['reviewer_product_type', '请从这一列选一个值填进去', '可选值：Thermostat / Thermostat Assembly / Thermostat Insert / Thermostat Housing / Electronic Thermostat / Water Pump Assembly / Temperature Sensor / Thermal Switch / Oil Pressure Warning Switch / Reverse Light Switch / Brake Light Switch / NOT_A_PRODUCT'],
  ['reviewer_product_name_en', '英文产品名，网站产品页标题会用它', '示例：Automotive Thermostat 82°C for Volkswagen EA111'],
  ['reviewer_vehicle_make', '确认或修正车型品牌，多个用 | 分隔', '如果是发动机厂而不是整车厂，请改为 ENGINE_MAKER:名字'],
  ['reviewer_vehicle_model', '车型，多个用 | 分隔；不确定就留空', '留空表示网站不展示车型字段'],
  ['reviewer_engine_code', '确认发动机代码，多个用 | 分隔；不确定就留空', '系统给的候选值混有车型名，请只保留真正的发动机代码'],
  ['reviewer_decision', '', '可选值：APPROVE / NEEDS_FIX / REJECT'],
  ['reviewer_notes', '你的备注，随便写', ''],
  [''],
  ['系统列说明', 'phase2_review_flags', '本产品命中了哪些问题，多个用 ; 分隔'],
  ['系统列说明', 'phase2_suggested_action', '系统建议你怎么处理（只是建议，不是结论）'],
  ['系统列说明', 'phase2_needs_human', 'yes = 有问题需要你判断；no = 数据本身没有发现问题'],
  ['系统列说明', 'phase2_shared_oe_count', '本产品有多少个 OE 号同时被“任意其他产品”引用（宽口径）'],
  ['系统列说明', 'phase2_shared_oe_within_batch', '本产品有多少个 OE 号是与“第一批内部其他产品”共用（窄口径，直接影响首批上线结果）'],
  ['系统列说明', 'phase2_blocking_issue_count', '有几个“必须人工判断”的问题。0 = 数据本身没发现阻塞性问题，只需补录类型/名称/图片'],
  ['系统列说明', 'confirmed_fields', '目前只有 Bowen No. + OE + 车型品牌 + 温度 + 尺寸 是齐的；其余都待你确认'],
  [''],
  ['小提示', 'phase2_blocking_issue_count = 0', '符合这个条件的有 10 个（第 31/38/41/45/50/55/56/65/66/67 行），它们只需要你补产品类型、产品名、图片'],
  ['小提示', 'phase2_blocking_issue_count > 0', '其余 62 个有需要判断的问题，请先看同目录另外 3 张表'],
];

const rows72 = batch.map((b) => {
  const p = byId.get(b.product_id);
  const { flags, actions } = computeFlags(p, ctx);
  const shareCount = flags.oe_shared_count || '0';
  return {
    review_rank: b.rank,
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    bowen_no_raw: p.bowen_no_raw,
    product_type: p.product_type,                       // 始终 REVIEW_REQUIRED
    product_type_suggestion: p.product_type_suggestion,
    product_name_en: p.product_name_en,                 // 始终空
    oe_count: p.oe_count,
    oe_number_raw: String(p.oe_all_raw || '').split(' | ').slice(0, 6).join(' | '),
    oe_number_normalized: String(p.oe_all_normalized || '').split(' | ').slice(0, 6).join(' | '),
    oe_all_count_note: Number(p.oe_count) > 6 ? `（仅显示前 6 个，共 ${p.oe_count} 个；完整清单见 data/derived/product-oe-index.csv）` : '',
    vehicle_make: p.vehicle_make,
    vehicle_model: p.vehicle_model,                     // 始终空
    engine: p.engine_code,
    engine_status: p.engine_code_status,
    opening_temperature: p.opening_temperature_c,
    dimensions: p.dimensions,
    application_notes: String(p.application_notes || '').slice(0, 300),
    source_sheet: p.source_sheet,
    source_row: p.source_row,
    fitment_confidence: p.fitment_confidence,           // 始终 review_required
    publish_status: p.status,
    indexable: p.indexable,                             // 始终 no
    data_quality_score: p.data_quality_score,
    phase2_review_flags: Object.keys(flags).join('; '),
    phase2_suggested_action: actions.join(' ｜ '),
    phase2_needs_human: Object.keys(flags).length ? 'yes' : 'no',
    phase2_shared_oe_count: shareCount,
    phase2_shared_oe_within_batch: flags.oe_shared_within_first_batch_count || '0',
    phase2_blocking_issue_count: String(BLOCKING_FLAGS.filter((b) => Object.keys(flags).some((f) => f === b)).length),
    confirmed_fields: 'bowen_no + oe_number + vehicle_make + opening_temperature + dimensions',
    reviewer_product_type: '',
    reviewer_product_name_en: '',
    reviewer_vehicle_make: '',
    reviewer_vehicle_model: '',
    reviewer_engine_code: '',
    reviewer_decision: '',
    reviewer_notes: '',
  };
});

const H72 = ['review_rank', 'product_id', 'bowen_no', 'bowen_no_raw', 'product_type', 'product_type_suggestion',
  'product_name_en', 'oe_count', 'oe_number_raw', 'oe_number_normalized', 'oe_all_count_note',
  'vehicle_make', 'vehicle_model', 'engine', 'engine_status', 'opening_temperature', 'dimensions',
  'application_notes', 'source_sheet', 'source_row', 'fitment_confidence', 'publish_status', 'indexable',
  'data_quality_score', 'phase2_review_flags', 'phase2_suggested_action', 'phase2_needs_human',
  'phase2_shared_oe_count', 'phase2_shared_oe_within_batch', 'phase2_blocking_issue_count', 'confirmed_fields',
  'reviewer_product_type', 'reviewer_product_name_en', 'reviewer_vehicle_make', 'reviewer_vehicle_model',
  'reviewer_engine_code', 'reviewer_decision', 'reviewer_notes'];
writeReviewCsv(path.join(REVIEW, 'first-72-products-review.csv'), H72, rows72, LEGEND_72);

// =====================================================================
// 生成 2：shared-oe-review.csv
// =====================================================================
const LEGEND_SHARED = [
  ['博文外贸独立站 — Phase 2 共享 OE 审核表'],
  ['什么是共享 OE：同一个 OE 号被 2 个及以上的博文编号（Bowen No.）同时引用。'],
  ['为什么重要：一个海外采购商搜这个 OE 号时，网站要决定给他看几个产品。给错会丢单或发错货。'],
  ['怎么用：填写 reviewer_decision 列。'],
  [''],
  ['reviewer_decision 可选值', '', 'SAME_PRODUCT = 其实是同一个产品，应合并'],
  ['', '', 'ONE_TO_MANY = 一号多型，这些是不同产品，搜索时全部展示'],
  ['', '', 'SUPERSEDED = 替代关系，其中一个已被另一个替代，搜索时应提示'],
  ['', '', 'WRONG_ENTRY = 其中一个录错了，应删除该 OE 关联'],
  ['', '', 'KEEP_AS_IS = 确认没问题，保持现状'],
  ['reviewer_primary_bowen', '如果选 SUPERSEDED，请在这里填「当前有效」的那个 Bowen No.', ''],
  ['reviewer_notes', '备注', ''],
];

const sharedRows = [];
for (const [key, list] of [...oeGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const pids = [...new Set(list.map((x) => x.product_id))];
  if (pids.length < 2) continue;
  const inBatchCount = pids.filter((x) => batchIds.has(x)).length;

  // 每个涉及产品的车型/发动机/来源
  const details = pids.map((pid) => {
    const p = byId.get(pid);
    const oeRow = list.find((x) => x.product_id === pid);
    return {
      bowen: p.bowen_no,
      make: p.vehicle_make || '(未能识别)',
      model: '(未填)',
      engine: p.engine_code || '(无候选)',
      temp: p.opening_temperature_c || '(无)',
      dims: p.dimensions || '(无)',
      loc: oeRow ? oeRow.source_cells : '',
      note: String(p.application_notes || '').slice(0, 120),
    };
  });

  // 推荐处理方式：基于可观测证据给建议，不下结论
  const makes = new Set(details.map((d) => d.make).filter((m) => m !== '(未能识别)'));
  const temps = new Set(details.map((d) => d.temp).filter((t) => t !== '(无)'));
  const dims = new Set(details.map((d) => d.dims).filter((d) => d !== '(无)'));
  let suggestion, suggestionReason;
  if (temps.size <= 1 && dims.size <= 1 && makes.size <= 1) {
    suggestion = 'LIKELY_SAME_PRODUCT (需人工确认)';
    suggestionReason = '涉及产品的温度/尺寸/车型品牌完全一致，可能是同一产品的重复录入或替代关系';
  } else if (temps.size > 1 || dims.size > 1) {
    suggestion = 'LIKELY_ONE_TO_MANY (需人工确认)';
    suggestionReason = `温度有 ${temps.size} 种、尺寸有 ${dims.size} 种写法，更像是一号多型（不同结构）`;
  } else {
    suggestion = 'NEEDS_MANUAL_REVIEW';
    suggestionReason = '证据不足以判断，必须人工确认';
  }

  sharedRows.push({
    oe_number_normalized: key,
    oe_number_raw: [...new Set(list.map((x) => x.oe_number_raw))].join(' | '),
    oe_number_normalized_alt: [...new Set(list.map((x) => x.oe_number_normalized))].join(' | '),
    referencing_bowen_count: String(pids.length),
    referencing_bowen_nos: pids.map((x) => byId.get(x).bowen_no || '(无编号)').join(' | '),
    referencing_product_ids: pids.join(' | '),
    in_first_batch_count: String(inBatchCount),
    blocks_first_batch: inBatchCount >= 2 ? 'yes' : 'no',
    /* 每个产品的车型/发动机 */
    bowen_1: details[0]?.bowen || '', vehicle_make_1: details[0]?.make || '',
    vehicle_model_1: details[0]?.model || '', engine_1: details[0]?.engine || '',
    temp_1: details[0]?.temp || '', dims_1: details[0]?.dims || '', source_1: details[0]?.loc || '',
    bowen_2: details[1]?.bowen || '', vehicle_make_2: details[1]?.make || '',
    vehicle_model_2: details[1]?.model || '', engine_2: details[1]?.engine || '',
    temp_2: details[1]?.temp || '', dims_2: details[1]?.dims || '', source_2: details[1]?.loc || '',
    bowen_3: details[2]?.bowen || '', vehicle_make_3: details[2]?.make || '',
    vehicle_model_3: details[2]?.model || '', engine_3: details[2]?.engine || '',
    temp_3: details[2]?.temp || '', dims_3: details[2]?.dims || '', source_3: details[2]?.loc || '',
    all_source_locations: list.map((x) => x.source_cells).join(' | '),
    suggested_handling: suggestion,
    suggested_reason: suggestionReason,
    needs_human_confirmation: 'yes',
    reviewer_decision: '',
    reviewer_primary_bowen: '',
    reviewer_notes: '',
  });
}
const H_SHARED = ['oe_number_normalized', 'oe_number_raw', 'oe_number_normalized_alt',
  'referencing_bowen_count', 'referencing_bowen_nos', 'referencing_product_ids',
  'in_first_batch_count', 'blocks_first_batch',
  'bowen_1', 'vehicle_make_1', 'vehicle_model_1', 'engine_1', 'temp_1', 'dims_1', 'source_1',
  'bowen_2', 'vehicle_make_2', 'vehicle_model_2', 'engine_2', 'temp_2', 'dims_2', 'source_2',
  'bowen_3', 'vehicle_make_3', 'vehicle_model_3', 'engine_3', 'temp_3', 'dims_3', 'source_3',
  'all_source_locations', 'suggested_handling', 'suggested_reason', 'needs_human_confirmation',
  'reviewer_decision', 'reviewer_primary_bowen', 'reviewer_notes'];
writeReviewCsv(path.join(REVIEW, 'shared-oe-review.csv'), H_SHARED, sharedRows, LEGEND_SHARED);

// =====================================================================
// 生成 3：bowen-variant-review.csv（一族一行 + 每变体一行，两种视图合并为每变体一行）
// =====================================================================
const LEGEND_VARIANT = [
  ['博文外贸独立站 — Phase 2 Bowen 编号变体审核表'],
  ['什么是编号变体：基础编号相同但后缀不同，例如 3004 / 3004-1 / 3004-3 / 3004-5。'],
  ['为什么重要：如果它们是同一个产品，网站应合并成一页；如果是不同产品，必须各占一页。判断错会导致重复内容或漏产品。'],
  ['怎么用：每个「族」只需要填一次 reviewer_family_decision（填在 family_size 最大的那一行即可，其余行可留空）。'],
  [''],
  ['reviewer_family_decision 可选值', '', 'SAME_PRODUCT = 整族是同一个产品，应合并为一个'],
  ['', '', 'DISTINCT_PRODUCTS = 整族是不同产品，各自独立'],
  ['', '', 'MIXED = 部分相同部分不同，请在 reviewer_notes 说明哪些合并、哪些独立'],
  ['', '', 'NEEDS_INFO = 需要更多信息才能判断'],
  ['reviewer_keep_which', '如果选 SAME_PRODUCT，请填保留哪个编号作为主编号', ''],
];

const variantRows = [];
for (const [base, variants] of [...variantFamilies.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const v of variants) {
    const list = products.filter((p) => p.bowen_no && bowenKey(p.bowen_no).exact === v);
    const p = list[0];
    variantRows.push({
      family_base: base,
      family_size: String(variants.length),
      family_variants: variants.join(' / '),
      bowen_no: v,
      is_base_number: v === base ? 'yes' : 'no',
      product_id: p ? p.product_id : '',
      product_type: p ? p.product_type : '',
      product_type_suggestion: p ? p.product_type_suggestion : '',
      oe_count: p ? p.oe_count : '',
      vehicle_make: p ? p.vehicle_make : '',
      opening_temperature: p ? p.opening_temperature_c : '',
      dimensions: p ? p.dimensions : '',
      application_notes: p ? String(p.application_notes || '').slice(0, 200) : '',
      source_sheet: p ? p.source_sheet : '',
      source_row: p ? p.source_row : '',
      publish_status: p ? p.status : '',
      in_first_batch: p && batchIds.has(p.product_id) ? 'yes' : 'no',
      /* 证据：判断是否为独立产品的可观测线索 */
      evidence_same_oe_as_base: (() => {
        if (v === base || !p) return '';
        const baseP = products.find((x) => x.bowen_no && bowenKey(x.bowen_no).exact === base);
        if (!baseP) return '';
        const a = new Set(String(p.oe_all_normalized || '').split(' | ').filter(Boolean));
        const b = new Set(String(baseP.oe_all_normalized || '').split(' | ').filter(Boolean));
        const inter = [...a].filter((x) => b.has(x)).length;
        return `共有 OE ${inter} 个 / 本号 ${a.size} 个 / 基础号 ${b.size} 个`;
      })(),
      needs_human_confirmation: 'yes',
      reviewer_family_decision: '',
      reviewer_keep_which: '',
      reviewer_notes: '',
    });
  }
}
const H_VARIANT = ['family_base', 'family_size', 'family_variants', 'bowen_no', 'is_base_number',
  'product_id', 'product_type', 'product_type_suggestion', 'oe_count', 'vehicle_make',
  'opening_temperature', 'dimensions', 'application_notes', 'source_sheet', 'source_row',
  'publish_status', 'in_first_batch', 'evidence_same_oe_as_base', 'needs_human_confirmation',
  'reviewer_family_decision', 'reviewer_keep_which', 'reviewer_notes'];
writeReviewCsv(path.join(REVIEW, 'bowen-variant-review.csv'), H_VARIANT, variantRows, LEGEND_VARIANT);

// =====================================================================
// 生成 4：row-misalignment-review.csv
// =====================================================================
const LEGEND_MIS = [
  ['博文外贸独立站 — Phase 2 疑似行错位 / 列错位审核表'],
  ['什么是错位：Bowen No.（博文编号）这一列里，混进了本来不该在这里的内容，'],
  ['例如尺寸「120*85*90」、温度「82℃」、两个编号、或者括号里的另一个编号。'],
  ['为什么重要：这一列错位，说明同一行的温度列、尺寸列也可能装的是别的产品的东西 → 整行数据可能是错的。'],
  ['怎么用：拿着 source_sheet + source_row 去原始 Excel 里核对那一行，然后填 reviewer_decision。'],
  ['原始 Excel 位置：data/raw/产品信息表1_英文版.xlsx（只读，请勿修改）'],
  [''],
  ['reviewer_decision 可选值', '', 'FIX_DATA = 我核对了原表，数据确实错了，需修正（请在 notes 写明正确值）'],
  ['', '', 'DATA_OK = 我核对了原表，数据没问题，是原表写法特殊，可以保留'],
  ['', '', 'SPLIT_PRODUCT = 两个编号应该拆成两个产品'],
  ['', '', 'EXCLUDE = 这个产品先不上线'],
];

const misRows = [];
for (const p of products) {
  const raws = String(p.bowen_no_raw || '').split(' | ').map((s) => s.trim()).filter(Boolean);
  const hit = [];
  if (raws.some(isBowenTwoNumbers)) hit.push('bowen_contains_two_numbers');
  if (raws.some(isBowenDirtyDimensions)) hit.push('bowen_contains_dimensions');
  if (raws.some(isBowenUnitText)) hit.push('bowen_contains_unit_text');
  const parenRef = raws.filter(parenHasCrossReference);
  if (parenRef.length) hit.push('bowen_contains_cross_reference');
  else if (raws.some(isBowenParenNote)) hit.push('bowen_contains_parenthetical');
  if (!hit.length) continue;

  // 证据
  const ev = [];
  if (raws.some(isBowenDirtyDimensions)) ev.push(`Bowen 列出现尺寸样式：${raws.filter(isBowenDirtyDimensions).join(' / ')}`);
  if (raws.some(isBowenTwoNumbers)) ev.push(`Bowen 列出现两个编号：${raws.filter(isBowenTwoNumbers).join(' / ')}`);
  if (raws.some(isBowenUnitText)) ev.push(`Bowen 列出现单位/温度：${raws.filter(isBowenUnitText).join(' / ')}`);
  if (parenRef.length) ev.push(`Bowen 列括号内是另一个编号：${parenRef.join(' / ')}`);
  else if (raws.some(isBowenParenNote)) ev.push(`Bowen 列括号内是零件描述：${raws.filter(isBowenParenNote).join(' / ')}`);

  // 该产品的温度/尺寸是否也可疑（温度值是否有多个差异很大的）
  const temps = String(p.opening_temperature_c || '').split(' | ').filter(Boolean).map(Number);
  const tempSpread = temps.length > 1 ? Math.max(...temps) - Math.min(...temps) : 0;
  if (tempSpread >= 20) ev.push(`该产品登记了跨度 ${tempSpread}℃ 的多个温度（${temps.join('/')}），可能是不同产品混在一起`);
  const dimCount = String(p.dimensions || '').split('|').length;
  if (dimCount > 6) ev.push(`尺寸字段含 ${dimCount} 段，较多`);

  const isHigh = hit.includes('bowen_contains_dimensions') || hit.includes('bowen_contains_unit_text');
  const inFirstBatch = batchIds.has(p.product_id);

  // 优先级定义（写死、可复核）：
  //   HIGH   = 编号单元格里出现尺寸/温度单位 → 几乎确定这一行整体错位，温度尺寸不可信
  //   MEDIUM = 编号单元格里出现第二个编号 → 可能是变体/替代号（合法）也可能是录错
  //   LOW    = 编号单元格里出现零件描述 → 信息位置放错，不影响数值可信度
  const severity = isHigh ? 'HIGH'
    : hit.includes('bowen_contains_two_numbers') || hit.includes('bowen_contains_cross_reference') ? 'MEDIUM'
      : 'LOW';

  misRows.push({
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    bowen_no_raw: p.bowen_no_raw,
    issue_types: hit.join('; '),
    evidence: ev.join(' ｜ '),
    product_type_suggestion: p.product_type_suggestion,
    oe_count: p.oe_count,
    vehicle_make: p.vehicle_make,
    opening_temperature: p.opening_temperature_c,
    dimensions: p.dimensions,
    application_notes: String(p.application_notes || '').slice(0, 200),
    source_sheet: p.source_sheet,
    source_row: p.source_row,
    publish_status: p.status,
    in_first_batch: inFirstBatch ? 'yes' : 'no',
    /* 当前是否已被 Phase 1 的规则拦住 */
    current_publish_blocked: p.status === 'PUBLISHED' ? 'no' : 'yes',
    /* Phase 2 的独立建议：Phase 1 的规则更窄，这里给出更严格的建议 */
    phase2_status_recommendation: p.status === 'PUBLISHED'
      ? '建议降级为 SEARCHABLE_BUT_NOINDEX（Phase 1 的错位规则未覆盖此写法，本阶段发现）'
      : '保持当前状态（已被 Phase 1 拦截）',
    in_phase1_warning_set: p.has_attribute_warnings === 'yes' ? 'yes' : 'no',
    severity,
    suggested_action: severity === 'HIGH'
      ? 'HIGH：编号列混入尺寸/温度单位 → 请先核对原表整行，确认温度与尺寸属于哪个编号'
      : severity === 'MEDIUM'
        ? 'MEDIUM：编号列出现第二个编号 → 请确认是变体/替代号，还是录错'
        : 'LOW：编号列括号内是零件描述 → 请确认是否移入产品名或备注',
    needs_human_confirmation: 'yes',
    reviewer_decision: '',
    reviewer_notes: '',
  });
}
// 排序：HIGH 优先，其次第一批，再按编号
const sevRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
misRows.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]
  || (a.in_first_batch === 'yes' ? -1 : 1) - (b.in_first_batch === 'yes' ? -1 : 1)
  || String(a.bowen_no).localeCompare(String(b.bowen_no)));
const H_MIS = ['product_id', 'bowen_no', 'bowen_no_raw', 'issue_types', 'severity', 'evidence',
  'product_type_suggestion', 'oe_count', 'vehicle_make', 'opening_temperature', 'dimensions',
  'application_notes', 'source_sheet', 'source_row', 'publish_status', 'in_first_batch',
  'current_publish_blocked', 'phase2_status_recommendation', 'in_phase1_warning_set',
  'suggested_action', 'needs_human_confirmation', 'reviewer_decision', 'reviewer_notes'];
writeReviewCsv(path.join(REVIEW, 'row-misalignment-review.csv'), H_MIS, misRows, LEGEND_MIS);

// =====================================================================
// 生成 5：机器可读的标记表
// =====================================================================
const flagRows = [];
for (const p of products) {
  const { flags, actions } = computeFlags(p, ctx);
  if (!Object.keys(flags).length) continue;
  flagRows.push({
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    publish_status: p.status,
    in_first_batch: batchIds.has(p.product_id) ? 'yes' : 'no',
    phase2_flags: Object.keys(flags).join('; '),
    flag_count: String(Object.keys(flags).length),
    suggested_action: actions.join(' | '),
    needs_human_confirmation: 'yes',
    indexable: p.indexable,
    fitment_confidence: p.fitment_confidence,
    data_version: DATA_VERSION,
  });
}
writeReviewCsv(path.join(D, 'phase2-review-flags.csv'),
  ['product_id', 'bowen_no', 'publish_status', 'in_first_batch', 'phase2_flags', 'flag_count',
    'suggested_action', 'needs_human_confirmation', 'indexable', 'fitment_confidence', 'data_version'],
  flagRows);

// =====================================================================
// 统计（所有计数都基于明确的标记名，避免子串误匹配）
// =====================================================================
const hasFlag = (row, name) => String(row.phase2_review_flags || '').split('; ').some((f) => f.split('_count')[0] === name);
const countFlag = (rows, name) => rows.filter((r) => hasFlag(r, name)).length;

const b72 = rows72;
const blockingInBatch = b72.filter((r) => BLOCKING_FLAGS.some((b) => hasFlag(r, b)));

// 逐项计数（报告直接用这些数字）
const counts = {
  产品类型待确认: countFlag(b72, 'product_type_review_required'),
  英文产品名待补: countFlag(b72, 'product_name_missing'),
  车型待补: countFlag(b72, 'vehicle_model_missing'),
  图片待补: countFlag(b72, 'image_missing'),
  发动机代码待确认: countFlag(b72, 'engine_code_is_candidate'),
  涉及共享OE_宽口径: countFlag(b72, 'oe_shared'),
  涉及共享OE_窄口径: countFlag(b72, 'oe_shared_within_first_batch'),
  存在编号变体: countFlag(b72, 'bowen_variant'),
  编号列含第二个编号: countFlag(b72, 'bowen_contains_two_numbers'),
  编号列含尺寸: countFlag(b72, 'bowen_contains_dimensions'),
  编号列含单位或温度: countFlag(b72, 'bowen_contains_unit_text'),
  编号列括号含交叉引用: countFlag(b72, 'bowen_contains_cross_reference'),
  编号列括号含零件描述: countFlag(b72, 'bowen_contains_parenthetical'),
  跨表OE清单冲突: countFlag(b72, 'oe_list_conflict_across_sheets'),
  空格推断拆分的OE: countFlag(b72, 'oe_split_ambiguous'),
};
// 存在疑似错位（合并口径：编号单元格被任何非编号内容污染）
const misalignmentInBatch = b72.filter((r) => ['bowen_contains_two_numbers', 'bowen_contains_dimensions',
  'bowen_contains_unit_text', 'bowen_contains_cross_reference', 'bowen_contains_parenthetical']
  .some((b) => hasFlag(r, b)));

const summary = {
  generated_at: new Date().toISOString(),
  data_version: DATA_VERSION,
  first_batch_size: b72.length,
  products_total: products.length,
  /* ---- 报告需要的 6 个数字 ---- */
  a_直接可确认_无阻塞性问题: b72.length - blockingInBatch.length,
  a_有阻塞性问题待处理: blockingInBatch.length,
  b_需要确认product_type: counts.产品类型待确认,
  b_需要确认product_name_en: counts.英文产品名待补,
  c_涉及共享OE: counts.涉及共享OE_宽口径,
  c_涉及共享OE_窄口径_仅首批内部: counts.涉及共享OE_窄口径,
  d_存在编号变体: counts.存在编号变体,
  e_存在疑似错位: misalignmentInBatch.length,
  f_人工确认前可进入Published: 0,
  /* ---- 明细计数 ---- */
  counts,
  review_files: {
    'first-72-products-review.csv': rows72.length,
    'shared-oe-review.csv': sharedRows.length,
    'bowen-variant-review.csv': variantRows.length,
    'row-misalignment-review.csv': misRows.length,
    'phase2-review-flags.csv': flagRows.length,
  },
  shared_oe_detail: {
    total_shared_oe: sharedRows.length,
    blocking_first_batch: sharedRows.filter((r) => r.blocks_first_batch === 'yes').length,
    first_batch_products_involved_wide: counts.涉及共享OE_宽口径,
    first_batch_products_involved_narrow: counts.涉及共享OE_窄口径,
  },
  misalignment_detail: {
    total_flagged_products: misRows.length,
    high: misRows.filter((r) => r.severity === 'HIGH').length,
    medium: misRows.filter((r) => r.severity === 'MEDIUM').length,
    low: misRows.filter((r) => r.severity === 'LOW').length,
    in_first_batch: misRows.filter((r) => r.in_first_batch === 'yes').length,
    first_batch_bowens: misRows.filter((r) => r.in_first_batch === 'yes').map((r) => r.bowen_no),
    first_batch_by_severity: {
      HIGH: misRows.filter((r) => r.in_first_batch === 'yes' && r.severity === 'HIGH').length,
      MEDIUM: misRows.filter((r) => r.in_first_batch === 'yes' && r.severity === 'MEDIUM').length,
      LOW: misRows.filter((r) => r.in_first_batch === 'yes' && r.severity === 'LOW').length,
    },
    published_but_should_downgrade: misRows.filter((r) => r.publish_status === 'PUBLISHED').length,
    published_but_should_downgrade_bowens: misRows.filter((r) => r.publish_status === 'PUBLISHED').map((r) => r.bowen_no),
    phase1_warning_set_size: misRows.filter((r) => r.in_phase1_warning_set === 'yes').length,
    newly_detected_by_phase2: misRows.filter((r) => r.in_phase1_warning_set === 'no').length,
  },
  guards: {
    indexable_yes_count: products.filter((p) => p.indexable === 'yes').length,
    fitment_exact_count: products.filter((p) => p.fitment_confidence === 'exact').length,
    product_type_filled_count: products.filter((p) => p.product_type !== 'REVIEW_REQUIRED').length,
    product_name_filled_count: products.filter((p) => p.product_name_en).length,
  },
};
fs.writeFileSync(path.join(D, 'phase2-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

console.log('=== Phase 2 审核文件已生成 ===');
console.log('review/first-72-products-review.csv   :', rows72.length, '行');
console.log('review/shared-oe-review.csv           :', sharedRows.length, '行');
console.log('review/bowen-variant-review.csv       :', variantRows.length, '行');
console.log('review/row-misalignment-review.csv    :', misRows.length, '行');
console.log('data/derived/phase2-review-flags.csv  :', flagRows.length, '行');
console.log('');
console.log(JSON.stringify(summary, null, 2));
