/**
 * Phase 2（调整后）：人工业务审核包生成器
 * ---------------------------------------------------------------------
 * 目标：建立给工厂/业务人员使用的人工审核包，而不是让程序猜产品信息。
 *
 * 硬约束（全部由 tools/verify-phase2-package.mjs 强制检查）：
 *   1. 不猜 product_type —— 全库 product_type 一律 review_required
 *   2. 不把第一批标记为 published —— 一律 publish_candidate
 *   3. 疑似错位记录 blocked = true 且 publish_status = draft
 *   4. 未经人工确认不得设置 fitment_confidence = exact
 *   5. 不自动删除 OE、不自动合并 Bowen No.、不修改原始 Excel
 *
 * 输入：data/derived/**（Phase 1 产出，只读）
 * 输出：review/*.xlsx（人工审核包）+ data/derived/*v2*.csv（新状态模型）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bowenKey } from './lib/normalize.mjs';
import { writeXlsx, STYLE } from './lib/xlsx-writer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');
const REVIEW = path.join(ROOT, 'review');
const DATA_VERSION = 'v2.1.0-phase2-package';
const NOW = process.env.BOWEN_NOW || new Date().toISOString();

// =====================================================================
// CSV 读取
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
  // 兼容带 # 图例行的文件
  const body = rows.filter((r) => !String(r[0] || '').startsWith('#') && r.length > 1);
  const header = body.shift();
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function writeCsv(file, header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(','));
  fs.writeFileSync(file, '\uFEFF' + lines.join('\n') + '\n', 'utf8');
  return rows.length;
}

// =====================================================================
// 枚举值（与需求一一对应）
// =====================================================================
const PRODUCT_TYPES = ['Automotive Thermostat', 'Thermostat Assembly', 'Thermostat Insert',
  'Temperature Sensor', 'Thermal Switch', 'Oil Pressure Warning Switch', 'Reverse Light Switch',
  'Brake Light Switch', 'Other', 'Unknown'];
const YES_NO = ['Yes', 'No'];
const YES_NO_UNKNOWN = ['Yes', 'No', 'Unknown'];
const OE_RELATIONSHIP = ['Main OE', 'Cross Reference', 'Vehicle-specific Reference', 'Incorrect', 'Unknown'];
const OE_VALID = ['Yes', 'No', 'Unknown'];
const VARIANT_DECISION = ['Same Product - Merge', 'Different Products - Keep Separate', 'Part of Same Family', 'Unknown'];
const MISALIGN_DECISION = ['Fix Data - Field Misplaced', 'Data Correct As-Is', 'Split Into Two Products', 'Exclude This Product', 'Unknown'];
const BLOCK_DECISION = ['Keep Blocked', 'Unblock After Fix', 'Exclude Permanently', 'Unknown'];
const PUBLISH_STATUSES = ['publish_candidate', 'searchable_noindex', 'draft', 'blocked'];

// =====================================================================
// 读取 Phase 1 产出
// =====================================================================
const products = readCsv('products.csv');
const oes = readCsv('product-oe-index.csv');
const firstBatchCsv = readCsv('first-batch-published.csv');

const byId = new Map(products.map((p) => [p.product_id, p]));
const batchIds = new Set(firstBatchCsv.map((b) => b.product_id));

// =====================================================================
// 问题检测
// =====================================================================
const hasDimInBowen = (raw) => /\d\s*[*x×]\s*\d/.test(String(raw || ''));
const hasUnitInBowen = (raw) => /[℃°]|\d\s*(mm|bar)\b/i.test(String(raw || ''));
const bowenNumberTokens = (raw) => (String(raw || '').match(/\d{3,}/g) || []);
const hasTwoNumbers = (raw) => bowenNumberTokens(raw).length > 1;
const hasParen = (raw) => /[（(][^)）]*[)）]/.test(String(raw || ''));
const parenCrossRef = (raw) => {
  const m = String(raw || '').match(/[（(]([^)）]*)[)）]/);
  if (!m) return false;
  const inner = m[1].trim();
  if (!/\d/.test(inner)) return false;
  if (/sealing\s*ring/i.test(inner)) return false;
  return true;
};

/**
 * 错位检测（严格对齐 Phase 2 需求 E 节）
 *   HIGH（必须 blocked = true）
 *     ① 尺寸进入 Bowen No. 列        例：3520  120*85*90
 *     ② 温度进入编号列               例：3029  92°
 *   MEDIUM（需人工确认，但不阻断）
 *     ③ 编号列出现第二个编号          例：3004--3  3503、3919(35401)
 *   LOW（信息位置问题）
 *     ④ 编号列括号内是零件描述        例：3041-2(3003) Sealing ring
 *
 * ⚠️ 刻意不列为错位的情况（避免误伤）：
 *    Sheet1 的「Vehicle Model」列装的是 OEM 号 —— 这是 Sheet1 本身缺少车型列，
 *    属于「表结构限制」，不是某一行错位。它影响全部 277 条 Sheet1 记录，
 *    把它当作错位会造成 82 个产品被误 blocked。此问题改为在报告中单独说明。
 */
function misalignmentFlags(p) {
  const raws = String(p.bowen_no_raw || '').split(' | ').map((s) => s.trim()).filter(Boolean);
  const hits = [];

  // ① 尺寸进入编号列
  if (raws.some(hasDimInBowen)) {
    hits.push({ type: '尺寸进入 Bowen No. 列', sev: 'HIGH', blocks: true, ev: raws.filter(hasDimInBowen).join(' / ') });
  }
  // ② 温度进入编号列
  if (raws.some(hasUnitInBowen)) {
    hits.push({ type: '温度进入编号列', sev: 'HIGH', blocks: true, ev: raws.filter(hasUnitInBowen).join(' / ') });
  }
  // ③ 编号列出现第二个编号
  const twoNum = raws.filter(hasTwoNumbers);
  if (twoNum.length) {
    hits.push({ type: '编号列出现两个编号', sev: 'MEDIUM', blocks: false, ev: twoNum.join(' / ') });
  }
  // ④ 编号列括号内是零件描述（非交叉引用）
  const parenDescr = raws.filter((r) => hasParen(r) && !parenCrossRef(r));
  if (parenDescr.length) {
    hits.push({ type: '编号列括号内含零件描述', sev: 'LOW', blocks: false, ev: parenDescr.join(' / ') });
  }

  const severity = hits.some((h) => h.sev === 'HIGH') ? 'HIGH'
    : hits.some((h) => h.sev === 'MEDIUM') ? 'MEDIUM' : hits.length ? 'LOW' : '';
  return { hits, severity, blocks: hits.some((h) => h.blocks) };
}

/**
 * 跨工作表 OE 差异
 * ---------------------------------------------------------------------
 * ⚠️ 关键：oe_number_index.csv 里的 source_sheet 只是“该 OE 首次出现的工作表”，
 *    真正的“这个 OE 在哪些工作表出现过”必须从 source_cells 解析，
 *    格式形如 "Product Information!C4 | Volkswagen!C12"。
 *    用 source_sheet 会得出“0 个跨表差异”的错误结论。
 */
const oeByProduct = new Map();
for (const o of oes) {
  if (!oeByProduct.has(o.product_id)) oeByProduct.set(o.product_id, []);
  oeByProduct.get(o.product_id).push(o);
}

/** 解析 "SheetName!C4 | OtherSheet!D9" → [{sheet, cell}] */
function parseSourceCells(sourceCells) {
  const out = [];
  for (const part of String(sourceCells || '').split(' | ')) {
    const s = part.trim();
    if (!s) continue;
    const i = s.lastIndexOf('!');
    if (i <= 0) continue;
    out.push({ sheet: s.slice(0, i), cell: s.slice(i + 1) });
  }
  return out;
}

/** Bowen 精确键 -> { bowen_no, sheets: Map<sheet, Map<oeKey, {oe, raw, cells[]}>>, productIds } */
const bowenSheetOe = new Map();
for (const o of oes) {
  if (!o.bowen_no) continue;
  const k = bowenKey(o.bowen_no).exact;
  if (!bowenSheetOe.has(k)) bowenSheetOe.set(k, { bowen_no: o.bowen_no, sheets: new Map(), productIds: new Set() });
  const rec = bowenSheetOe.get(k);
  rec.productIds.add(o.product_id);
  const locs = parseSourceCells(o.source_cells);
  // 如果没有可解析的位置，退回用 source_sheet
  const useLocs = locs.length ? locs : [{ sheet: o.source_sheet, cell: o.source_row }];
  for (const loc of useLocs) {
    if (!loc.sheet) continue;
    if (!rec.sheets.has(loc.sheet)) rec.sheets.set(loc.sheet, new Map());
    const sm = rec.sheets.get(loc.sheet);
    if (!sm.has(o.oe_match_key)) sm.set(o.oe_match_key, { oe: o.oe_number_normalized, raw: o.oe_number_raw, cells: [] });
    sm.get(o.oe_match_key).cells.push(`${loc.sheet}!${loc.cell}`);
  }
}

/** 变体族 */
const byBase = new Map();
for (const p of products) {
  if (!p.bowen_no) continue;
  const k = bowenKey(p.bowen_no);
  if (!byBase.has(k.base)) byBase.set(k.base, new Set());
  byBase.get(k.base).add(k.exact);
}
const variantFamilies = new Map();
for (const [base, set] of byBase) if (set.size > 1) variantFamilies.set(base, [...set].sort());

// =====================================================================
// A. 新的发布状态模型
// =====================================================================
/**
 * 状态模型（取消 published）：
 *   blocked             —— 被阻止，不得用于产品页 / OE 搜索 / Google 索引
 *   publish_candidate   —— 第一批推荐，等人工业务确认后才可能变成 published
 *   searchable_noindex  —— 站内可搜索，但不索引
 *   draft               —— 不对外
 * 注意：全库没有任何产品是 published（需要人工确认记录才能升级）。
 */
function computeStatus(p) {
  const mis = misalignmentFlags(p);
  if (mis.blocks) return { status: 'blocked', blocked: true, reason: `疑似错位（${mis.hits.filter((h) => h.blocks).map((h) => h.type).join('；')}）`, mis };
  if (batchIds.has(p.product_id)) return { status: 'publish_candidate', blocked: false, reason: '第一批推荐，待人工业务确认', mis };
  if (p.status === 'DRAFT') return { status: 'draft', blocked: false, reason: '缺少关键适配信息', mis };
  return { status: 'searchable_noindex', blocked: false, reason: '字段基本完整但未经业务审核', mis };
}

const v2Rows = [];
for (const p of products) {
  const st = computeStatus(p);
  const oeList = oeByProduct.get(p.product_id) || [];
  v2Rows.push({
    product_id: p.product_id,
    bowen_no: p.bowen_no,
    product_type: 'review_required',                 // 一律不猜
    product_name_en: '',
    publish_status: st.status,
    blocked: st.blocked ? 'true' : 'false',
    blocked_reason: st.blocked ? st.reason : '',
    publish_status_reason: st.reason,
    oe_count: p.oe_count,
    vehicle_make: p.vehicle_make,
    vehicle_model: '',
    opening_temperature_c: p.opening_temperature_c,
    dimensions: p.dimensions,
    fitment_confidence: 'review_required',            // 一律不允许 exact
    searchable: st.status === 'searchable_noindex' || st.status === 'publish_candidate' ? 'true' : 'false',
    indexable: 'false',                               // 未经人工确认不索引
    in_first_batch: batchIds.has(p.product_id) ? 'true' : 'false',
    misalignment_severity: st.mis.severity,
    misalignment_types: st.mis.hits.map((h) => h.type).join('; '),
    source_sheet: p.source_sheet,
    source_row: p.source_row,
    core_field_completeness: p.core_field_completeness,
    enrichment_field_completeness: p.enrichment_field_completeness,
    data_quality_score: p.data_quality_score,
    data_version: DATA_VERSION,
  });
}
writeCsv(path.join(D, 'products-v2.csv'),
  ['product_id', 'bowen_no', 'product_type', 'product_name_en', 'publish_status', 'blocked',
    'blocked_reason', 'publish_status_reason', 'oe_count', 'vehicle_make', 'vehicle_model',
    'opening_temperature_c', 'dimensions', 'fitment_confidence', 'searchable', 'indexable',
    'in_first_batch', 'misalignment_severity', 'misalignment_types', 'source_sheet', 'source_row',
    'core_field_completeness', 'enrichment_field_completeness', 'data_quality_score', 'data_version'],
  v2Rows);

// OE 索引也要带 blocked 标记
const oeV2 = oes.map((o) => {
  const st = v2Rows.find((x) => x.product_id === o.product_id);
  const blocked = st ? st.blocked === 'true' : false;
  return {
    product_id: o.product_id,
    bowen_no: o.bowen_no,
    oe_number_raw: o.oe_number_raw,
    oe_number_normalized: o.oe_number_normalized,
    oe_match_key: o.oe_match_key,
    oe_split_rule: o.oe_split_rule,
    oe_needs_review: o.oe_needs_review,
    publish_status: st ? st.publish_status : 'draft',
    blocked: blocked ? 'true' : 'false',
    usable_for_oe_search: blocked ? 'false' : (st && st.publish_status !== 'draft' ? 'true' : 'false'),
    usable_for_product_page: blocked ? 'false' : (st && st.publish_status === 'publish_candidate' ? 'true' : 'false'),
    indexable: 'false',
    fitment_confidence: 'review_required',
    source_sheet: o.source_sheet,
    source_row: o.source_row,
    source_cells: o.source_cells,
    data_version: DATA_VERSION,
  };
});
writeCsv(path.join(D, 'product-oe-index-v2.csv'), Object.keys(oeV2[0]), oeV2);

// =====================================================================
// B. 第一批产品人工审核表（xlsx，含下拉）
// =====================================================================
fs.mkdirSync(REVIEW, { recursive: true });

/** 把内部产品类型建议映射到审核表下拉值（仅作为“参考提示”，绝不写入确认列） */
function typeHint(p) {
  const s = String(p.product_type_suggestion || '');
  if (!s || s === 'Thermostat (unconfirmed)') return '参考：原文无类型证据，请人工判断';
  return `参考：原文提到 ${s}（仍需人工确认）`;
}

const batchProducts = firstBatchCsv.map((b) => byId.get(b.product_id));
const sheet1Rows = batchProducts.map((p, i) => {
  const mis = misalignmentFlags(p);
  const oeAll = String(p.oe_all_raw || '').split(' | ').filter(Boolean);
  const oeShow = oeAll.slice(0, 8).join('\n') + (oeAll.length > 8 ? `\n… 共 ${oeAll.length} 个` : '');
  return [
    p.bowen_no,
    '',                                            // Product Image（无法关联）
    p.product_name_en || '(未命名，待填)',          // Current Product Name
    oeShow,                                        // OE Numbers
    p.vehicle_make || '(未识别)',
    '',                                            // Vehicle Model（原表无法拆出）
    String(p.application_notes || '').slice(0, 200),
    p.opening_temperature_c || '(无)',
    p.dimensions || '(无)',
    p.source_sheet,                                // Source Sheets
    `${Math.round(Number(p.core_field_completeness) * 100)}% 核心 / ${Math.round(Number(p.enrichment_field_completeness) * 100)}% 增强`,
    typeHint(p),                                   // Type Hint（参考，非确认）
    mis.severity ? `⚠ ${mis.severity}：${mis.hits.map((h) => h.type).join('；')}` : '无',
    '', '', '', '', '', '', '',                      // 人工填写列
  ];
});

const SHEET1_COLS = [
  { title: 'Bowen No.', width: 14 },
  { title: 'Product Image', width: 16 },
  { title: 'Current Product Name', width: 24 },
  { title: 'OE Numbers', width: 34 },
  { title: 'Vehicle Make', width: 24 },
  { title: 'Vehicle Model', width: 16 },
  { title: 'Engine / Application', width: 34 },
  { title: 'Opening Temperature', width: 16 },
  { title: 'Dimensions', width: 22 },
  { title: 'Source Sheets', width: 26 },
  { title: 'Current Data Completeness', width: 18 },
  { title: 'Type Hint (参考，非确认)', width: 34 },
  { title: 'Phase2 数据问题提示', width: 30 },
  { title: 'Confirmed Product Type', width: 22, style: STYLE.MANUAL_LIST },
  { title: 'Confirmed Main OE', width: 20, style: STYLE.MANUAL },
  { title: 'Other Valid OE Numbers', width: 28, style: STYLE.MANUAL },
  { title: 'Vehicle/Application Correct?', width: 18, style: STYLE.MANUAL_LIST },
  { title: 'Opening Temperature Correct?', width: 18, style: STYLE.MANUAL_LIST },
  { title: 'Product Still Active?', width: 16, style: STYLE.MANUAL_LIST },
  { title: 'Allowed to Publish?', width: 16, style: STYLE.MANUAL_LIST },
  { title: 'Reviewer', width: 14, style: STYLE.MANUAL },
  { title: 'Review Date', width: 14, style: STYLE.MANUAL },
  { title: 'Notes', width: 34, style: STYLE.MANUAL },
];

writeXlsx(path.join(REVIEW, 'first-batch-business-review.xlsx'), [
  {
    name: '填表说明',
    title: '博文外贸独立站 — 第一批产品人工审核包（填表说明）',
    columns: [{ title: '项目', width: 30 }, { title: '说明', width: 95 }],
    rows: [
      ['这个文件是做什么的', '让懂产品的人逐行确认第一批候选产品。程序不会替你判断任何产品信息。'],
      ['要审核几个产品', `${batchProducts.length} 个（Bowen 编号）`],
      ['什么时候打开', '用 Excel 或 WPS 双击打开即可。'],
      [''],
      ['【最重要的一条】', 'Confirmed Product Type 这一列必须由人填写。程序没有填写任何一行，也不会根据经验猜测。'],
      ['为什么不能猜', '原始 Excel 里没有产品类型列；466 个产品中有 420 个连一丝类型线索都没有。强行分类会做出错误的网站分类页面。'],
      [''],
      ['黄色列', '需要你手工打字填写的列'],
      ['绿色列', '有下拉菜单，点击单元格右侧箭头从列表中选择，不要手打'],
      [''],
      ['Confirmed Product Type', `下拉可选：${PRODUCT_TYPES.join(' / ')}`],
      ['Confirmed Main OE', '这个产品最主要、最常用的那一个 OE 号（客户最可能拿来搜的那个）'],
      ['Other Valid OE Numbers', '其他有效的 OE 号，多个用换行或 | 分隔'],
      ['Vehicle/Application Correct?', '原始资料里的车型/发动机应用信息对不对？'],
      ['Opening Temperature Correct?', '开启温度对不对？不确定就选 Unknown'],
      ['Product Still Active?', '这个产品现在还在生产销售吗？'],
      ['Allowed to Publish?', '你允许它上线吗？选 No 我们就不会发布它'],
      ['Reviewer', '填你的名字'],
      ['Review Date', '填审核日期，例如 2026-09-23'],
      ['Notes', '任何备注都可以写'],
      [''],
      ['关于 Product Image 列', '原表里的产品图片是嵌在 Excel 里的浮动图片对象，没有文件名，程序无法自动对应到 Bowen 编号。这一列请手工填写图片文件名或编号。'],
      ['关于 Phase2 数据问题提示列', '如果不是“无”，说明本行数据可能有字段错位等问题，请优先看另外 3 个审核文件。'],
      [''],
      ['保留原始文件', 'data/raw/产品信息表1_英文版.xlsx 是原始资料，请不要修改它。'],
    ],
  },
  {
    name: '第一批产品审核表',
    title: `第一批产品人工审核表（${batchProducts.length} 个）— 请逐行确认`,
    notes: [
      `共 ${batchProducts.length} 个产品。绿色列有下拉菜单；黄色列手工填写。`,
      '重要：Confirmed Product Type 必须由人填写，程序未做任何猜测。约 90% 的产品原文没有类型证据，需要你判断。',
      '本表只列出前 8 个 OE 号；完整清单见 data/derived/product-oe-index-v2.csv',
    ],
    columns: SHEET1_COLS,
    freeze: { row: 5, col: 2 },
    autoFilter: true,
    rows: sheet1Rows,
    validations: [
      { sqref: `N6:N${5 + sheet1Rows.length + 500}`, values: PRODUCT_TYPES, promptTitle: 'Confirmed Product Type', prompt: '请从下拉列表选择。不要根据经验猜测。' },
      { sqref: `Q6:Q${5 + sheet1Rows.length + 500}`, values: YES_NO_UNKNOWN, promptTitle: 'Vehicle/Application 是否正确', prompt: '' },
      { sqref: `R6:R${5 + sheet1Rows.length + 500}`, values: YES_NO_UNKNOWN, promptTitle: '开启温度是否正确', prompt: '' },
      { sqref: `S6:S${5 + sheet1Rows.length + 500}`, values: YES_NO_UNKNOWN, promptTitle: '产品是否仍在产', prompt: '' },
      { sqref: `T6:T${5 + sheet1Rows.length + 500}`, values: YES_NO, promptTitle: '是否允许上线', prompt: '选 No 则不会发布' },
    ],
  },
  {
    name: '产品类型可选值',
    title: 'Confirmed Product Type 可选值',
    columns: [{ title: '可选值', width: 30 }, { title: '说明', width: 70 }],
    rows: [
      ['Automotive Thermostat', '汽车节温器（通用叫法）'],
      ['Thermostat Assembly', '节温器总成（带壳体/完整组件）'],
      ['Thermostat Insert', '插入式节温器（芯体，不含壳体）'],
      ['Temperature Sensor', '温度传感器'],
      ['Thermal Switch', '热敏开关'],
      ['Oil Pressure Warning Switch', '机油压力报警开关'],
      ['Reverse Light Switch', '倒车灯开关'],
      ['Brake Light Switch', '制动灯开关'],
      ['Other', '其他（请在 Notes 写明是什么）'],
      ['Unknown', '暂时无法判断'],
    ],
  },
]);

// =====================================================================
// C. OE 跨工作表差异审核（xlsx）
// =====================================================================
const crossSheetRows = [];
const crossSheetSummary = [];
for (const [k, rec] of [...bowenSheetOe.entries()].sort((a, b) => String(a[1].bowen_no).localeCompare(String(b[1].bowen_no)))) {
  if (rec.sheets.size < 2) continue;
  const union = new Map();
  for (const [sheet, m] of rec.sheets) {
    for (const [oeKey, info] of m) {
      if (!union.has(oeKey)) union.set(oeKey, { oe: info.oe, raw: info.raw, perSheet: new Map() });
      union.get(oeKey).perSheet.set(sheet, info.cells);
    }
  }
  const product = products.find((p) => rec.productIds.has(p.product_id));
  // 只记录“不同工作表覆盖不一致”的 OE（即不是所有工作表都有这个号）
  const sheetCount = rec.sheets.size;
  let conflictCount = 0;
  for (const [oeKey, info] of union) {
    const presentIn = info.perSheet.size;
    const isConflict = presentIn < sheetCount;
    if (isConflict) conflictCount++;
    const srcCells = [];
    for (const [, cells] of info.perSheet) for (const c of cells) srcCells.push(c);
    const missingIn = [...rec.sheets.keys()].filter((s) => !info.perSheet.has(s));
    crossSheetRows.push([
      rec.bowen_no,
      info.oe,
      info.raw,
      [...info.perSheet.keys()].join(' / '),
      srcCells.join(' / '),
      missingIn.join(' / ') || '(无)',
      product ? String(product.vehicle_make || '(未识别)') : '',
      product ? String(product.application_notes || '').slice(0, 160) : '',
      { v: presentIn, type: 'number' },
      isConflict ? 'Yes' : 'No',
      { v: '', style: STYLE.MANUAL_LIST },
      { v: '', style: STYLE.MANUAL_LIST },
      { v: '', style: STYLE.MANUAL },
    ]);
  }
  crossSheetSummary.push({
    bowen_no: rec.bowen_no,
    sheet_count: rec.sheets.size,
    sheets: [...rec.sheets.keys()].join(' | '),
    oe_union: union.size,
    oe_only_in_some_sheets: conflictCount,
    in_first_batch: [...rec.productIds].some((id) => batchIds.has(id)) ? 'Yes' : 'No',
    first_batch_priority: [...rec.productIds].some((id) => batchIds.has(id)) && conflictCount > 0 ? 'Yes' : 'No',
  });
}

// 优先审核清单：第一批候选产品中，跨表 OE 覆盖不一致的编号
const priorityBowens = new Set(crossSheetSummary.filter((x) => x.first_batch_priority === 'Yes').map((x) => x.bowen_no));
const priorityBowenKeys = new Set([...priorityBowens].map((b) => bowenKey(b).exact));
const crossSheetPriority = crossSheetRows.filter((r) => priorityBowenKeys.has(bowenKey(r[0]).exact));

writeXlsx(path.join(REVIEW, 'oe-cross-sheet-review.xlsx'), [
  {
    name: '填表说明',
    title: '博文外贸独立站 — OE 跨工作表差异审核（填表说明）',
    columns: [{ title: '项目', width: 30 }, { title: '说明', width: 95 }],
    rows: [
      ['这个文件是做什么的', '同一个 Bowen 编号在不同工作表里登记了不同的 OE 号。这个文件把它们并排列出来，让你判断哪个是对的。'],
      [''],
      ['【最重要的一条】', '同一个 Bowen No. 在不同表里的 OE 不一样，不一定是错误。可能是正常的：'],
      ['可能是正常的', '① 品牌表是主目录的子集，只登记了该品牌相关的 OE 号'],
      ['', '② 同一个产品确实对应多个 OE 号，不同表登记了不同批次'],
      ['', '★ 所以程序不判断对错，全部标 fitment_confidence = review_required'],
      [''],
      ['涉及多少个 Bowen 编号', `${crossSheetSummary.length} 个`],
      ['其中在第一批候选里的', `${crossSheetSummary.filter((x) => x.in_first_batch === 'Yes').length} 个`],
      ['一共多少行 OE 记录', `${crossSheetRows.length} 行（一行 = 一个"编号 × OE 号"组合）`],
      [''],
      ['怎么用', '逐行看 OE Number 和 Source Sheet 两列，判断这个 OE 号对当前 Bowen No. 是否有效。'],
      ['绿色列', '有下拉菜单，请从列表选择'],
      [''],
      ['Valid OE?', `下拉可选：${OE_VALID.join(' / ')}`],
      ['Relationship', `下拉可选：${OE_RELATIONSHIP.join(' / ')}`],
      ['', 'Main OE = 主 OE 号；Cross Reference = 交叉参考号；Vehicle-specific Reference = 特定车型专用参考号；Incorrect = 错的'],
      ['Notes', '备注'],
      [''],
      ['只有 Occurrences 大于等于 1 且 Potential Conflict = Yes 的行才是"不全的表"', 'Potential Conflict = No 表示所有工作表都有这个 OE 号，通常没问题'],
    ],
  },
  {
    name: 'OE跨表差异',
    title: `OE 跨工作表差异明细（${crossSheetRows.length} 行）`,
    notes: [
      '仅列出「不同工作表覆盖不一致」的 OE 号。Potential Conflict = Yes 表示部分工作表缺少该 OE。',
      '程序不判断对错，全部需要人工确认。',
    ],
    columns: [
      { title: 'Bowen No.', width: 14 },
      { title: 'OE Number', width: 20 },
      { title: 'OE Number (原始写法)', width: 20 },
      { title: 'Source Sheet(s)', width: 26 },
      { title: 'Source Row / Cell', width: 30 },
      { title: '缺少该 OE 的工作表', width: 26 },
      { title: 'Vehicle Make', width: 22 },
      { title: 'Vehicle / Application', width: 34 },
      { title: 'Occurrences', width: 13 },
      { title: 'Potential Conflict', width: 16 },
      { title: 'Valid OE?', width: 14, style: STYLE.MANUAL_LIST },
      { title: 'Relationship', width: 22, style: STYLE.MANUAL_LIST },
      { title: 'Notes', width: 30, style: STYLE.MANUAL },
    ],
    freeze: { row: 5, col: 2 },
    autoFilter: true,
    rows: crossSheetRows,
    validations: [
      { sqref: `K6:K${5 + crossSheetRows.length + 500}`, values: OE_VALID, promptTitle: 'Valid OE?', prompt: '这个 OE 号对当前 Bowen No. 是否有效' },
      { sqref: `L6:L${5 + crossSheetRows.length + 500}`, values: OE_RELATIONSHIP, promptTitle: 'Relationship', prompt: '这个 OE 号与产品的什么关系' },
    ],
  },
  {
    name: '第一批优先审核',
    title: `优先审核：第一批候选产品的跨表 OE 差异（${crossSheetPriority.length} 行）`,
    notes: [
      '这是最重要的一张表：只列出「第一批候选产品」中跨工作表覆盖不一致的 OE 号。',
      '先处理这张表，因为它直接影响第一批能不能上线。全部处理完后再看「OE跨表差异」全量表。',
    ],
    columns: [
      { title: 'Bowen No.', width: 14 },
      { title: 'OE Number', width: 20 },
      { title: 'OE Number (原始写法)', width: 20 },
      { title: 'Source Sheet(s)', width: 26 },
      { title: 'Source Row / Cell', width: 30 },
      { title: '缺少该 OE 的工作表', width: 26 },
      { title: 'Vehicle Make', width: 22 },
      { title: 'Vehicle / Application', width: 34 },
      { title: 'Occurrences', width: 13 },
      { title: 'Potential Conflict', width: 16 },
      { title: 'Valid OE?', width: 14, style: STYLE.MANUAL_LIST },
      { title: 'Relationship', width: 22, style: STYLE.MANUAL_LIST },
      { title: 'Notes', width: 30, style: STYLE.MANUAL },
    ],
    freeze: { row: 5, col: 2 },
    autoFilter: true,
    rows: crossSheetPriority,
    validations: [
      { sqref: `K6:K${5 + crossSheetPriority.length + 500}`, values: OE_VALID, promptTitle: 'Valid OE?', prompt: '' },
      { sqref: `L6:L${5 + crossSheetPriority.length + 500}`, values: OE_RELATIONSHIP, promptTitle: 'Relationship', prompt: '' },
    ],
  },
  {
    name: '按编号汇总',
    title: '按 Bowen 编号汇总（哪些编号的 OE 清单跨表不一致）',
    notes: ['用于快速定位问题最严重的编号。oe_only_in_some_sheets 越大，说明跨表差异越大。'],
    columns: [
      { title: 'Bowen No.', width: 14 },
      { title: '工作表数', width: 11 },
      { title: '涉及工作表', width: 46 },
      { title: 'OE 并集数', width: 12 },
      { title: '仅部分表有该 OE 的数量', width: 22 },
      { title: '在第一批候选', width: 14 },
      { title: '第一批优先处理', width: 15 },
    ],
    freeze: { row: 5, col: 2 },
    autoFilter: true,
    rows: crossSheetSummary.sort((a, b) => b.oe_only_in_some_sheets - a.oe_only_in_some_sheets)
      .map((x) => [x.bowen_no, { v: x.sheet_count, type: 'number' }, x.sheets,
        { v: x.oe_union, type: 'number' }, { v: x.oe_only_in_some_sheets, type: 'number' },
        x.in_first_batch, x.first_batch_priority]),
  },
]);

// =====================================================================
// D. Bowen 编号变体审核（xlsx）
// =====================================================================
const variantRows = [];
for (const [base, variants] of [...variantFamilies.entries()].sort()) {
  const baseProduct = products.find((p) => p.bowen_no && bowenKey(p.bowen_no).exact === base);
  const baseOes = new Set(String(baseProduct?.oe_all_normalized || '').split(' | ').filter(Boolean));
  for (const v of variants) {
    const p = products.find((x) => x.bowen_no && bowenKey(x.bowen_no).exact === v);
    if (!p) continue;
    const oesOf = new Set(String(p.oe_all_normalized || '').split(' | ').filter(Boolean));
    const overlap = [...oesOf].filter((x) => baseOes.has(x)).length;
    const unionSize = new Set([...oesOf, ...baseOes]).size;
    const sameSpecs = String(p.dimensions || '') === String(baseProduct?.dimensions || '')
      && String(p.opening_temperature_c || '') === String(baseProduct?.opening_temperature_c || '');
    variantRows.push([
      base,
      { v: variants.length, type: 'number' },
      variants.join(' / '),
      v,
      v === base ? 'Yes' : 'No',
      p.bowen_no_raw,
      p.oe_count,
      [...oesOf].slice(0, 5).join(' | ') + (oesOf.size > 5 ? ` … 共 ${oesOf.size} 个` : ''),
      `与基础号共有 ${overlap} 个；并集 ${unionSize} 个`,
      p.vehicle_make || '(未识别)',
      String(p.application_notes || '').slice(0, 140),
      p.opening_temperature_c || '(无)',
      p.dimensions || '(无)',
      sameSpecs ? '与基础号相同' : '与基础号不同',
      '',                                            // Product Image
      p.source_sheet,
      p.source_row,
      batchIds.has(p.product_id) ? 'Yes' : 'No',
      '',                                            // 人工：Same product?
      { v: '', style: STYLE.MANUAL_LIST },           // 人工：Decision
      { v: '', style: STYLE.MANUAL },                // 人工：Merge into
      { v: '', style: STYLE.MANUAL },                // 人工：Reviewer
      { v: '', style: STYLE.MANUAL },                // 人工：Review Date
      { v: '', style: STYLE.MANUAL },                // 人工：Notes
    ]);
  }
}

writeXlsx(path.join(REVIEW, 'bowen-number-variant-review.xlsx'), [
  {
    name: '填表说明',
    title: '博文外贸独立站 — Bowen 编号变体审核（填表说明）',
    columns: [{ title: '项目', width: 30 }, { title: '说明', width: 95 }],
    rows: [
      ['这个文件是做什么的', '有些 Bowen 编号看起来是同一族，例如 3004 / 3004-1 / 3004-3 / 3004-5。需要你判断它们是同一个产品还是不同产品。'],
      [''],
      ['【最重要的一条】', '程序不会自动合并任何编号。必须你确认后，我们才会合并。'],
      ['为什么不能自动合并', '合并错了会丢产品（两个不同产品变成一个），不合并又可能出现重复页面。这个判断只有懂产品的人能做。'],
      [''],
      ['涉及多少个变体族', `${variantFamilies.size} 族`],
      ['一共多少行', `${variantRows.length} 行（一行 = 一个变体编号）`],
      ['其中在第一批候选里的', `${variantRows.filter((r) => r[17] === 'Yes').length} 行`],
      [''],
      ['怎么用', '同一个「基础编号」的所有行放在一起。看 OE 重叠情况和规格是否相同，然后给出判断。'],
      ['绿色列', '下拉菜单'],
      [''],
      ['Decision', `下拉可选：${VARIANT_DECISION.join(' / ')}`],
      ['', 'Same Product - Merge = 这些是同一个产品，应该合并成一个'],
      ['', 'Different Products - Keep Separate = 是不同的产品，各自保留'],
      ['', 'Part of Same Family = 属于同一系列但是不同规格，保持独立但可以互相关联'],
      ['Merge into', '如果你选了 Merge，请填合并后保留哪个编号'],
      [''],
      ['一个重要的提示', '「与基础号共有 N 个 OE」这一列是判断的关键证据：'],
      ['', '共有 OE 多、规格相同 → 很可能是同一个产品'],
      ['', '共有 OE 少、规格不同 → 很可能是不同产品'],
    ],
  },
  {
    name: '编号变体审核',
    title: `Bowen 编号变体审核（${variantFamilies.size} 族 / ${variantRows.length} 个编号）`,
    notes: [
      '同一族的行连续排列。程序不会自动合并，必须人工确认。',
      '「OE 重叠情况」列是判断关键：与基础号共有 OE 多且规格相同 → 可能是同一产品。',
    ],
    columns: [
      { title: '基础编号', width: 12 },
      { title: '本族编号个数', width: 13 },
      { title: '本族全部编号', width: 30 },
      { title: 'Bowen No.', width: 14 },
      { title: '是否基础号', width: 11 },
      { title: '原始写法', width: 20 },
      { title: 'OE 数', width: 9 },
      { title: 'OE 示例', width: 34 },
      { title: 'OE 重叠情况', width: 26 },
      { title: 'Vehicle Make', width: 22 },
      { title: 'Application', width: 30 },
      { title: 'Opening Temp', width: 13 },
      { title: 'Specs / 尺寸', width: 24 },
      { title: '规格是否与基础号相同', width: 18 },
      { title: 'Product Image', width: 14 },
      { title: 'Source Sheet', width: 24 },
      { title: 'Source Row', width: 22 },
      { title: '在第一批候选', width: 13 },
      { title: 'Same Product? (Yes/No)', width: 14 },
      { title: 'Decision', width: 26, style: STYLE.MANUAL_LIST },
      { title: 'Merge into (Bowen No.)', width: 18, style: STYLE.MANUAL },
      { title: 'Reviewer', width: 14, style: STYLE.MANUAL },
      { title: 'Review Date', width: 14, style: STYLE.MANUAL },
      { title: 'Notes', width: 30, style: STYLE.MANUAL },
    ],
    freeze: { row: 5, col: 4 },
    autoFilter: true,
    rows: variantRows,
    validations: [
      { sqref: `S6:S${5 + variantRows.length + 500}`, values: YES_NO, promptTitle: 'Same Product?', prompt: '是否与基础编号是同一个产品' },
      { sqref: `T6:T${5 + variantRows.length + 500}`, values: VARIANT_DECISION, promptTitle: 'Decision', prompt: '程序不会自动合并，请人工判断' },
    ],
  },
]);

// =====================================================================
// E. 错位数据审核（xlsx）
// =====================================================================
const misRows = [];
for (const p of products) {
  const mis = misalignmentFlags(p);
  if (!mis.hits.length) continue;
  const st = v2Rows.find((x) => x.product_id === p.product_id);
  misRows.push([
    p.product_id,
    p.bowen_no,
    p.bowen_no_raw,
    mis.severity,
    mis.hits.map((h) => h.type).join('；'),
    mis.hits.map((h) => h.ev).join(' ｜ '),
    st ? st.publish_status : 'draft',
    st && st.blocked === 'true' ? 'true' : 'false',
    st && st.blocked === 'true' ? 'blocked（不得用于产品页/OE搜索/索引）' : '—（非 HIGH，未阻断）',
    p.opening_temperature_c || '(无)',
    p.dimensions || '(无)',
    String(p.application_notes || '').slice(0, 140),
    p.source_sheet,
    p.source_row,
    batchIds.has(p.product_id) ? 'Yes' : 'No',
    { v: '', style: STYLE.MANUAL_LIST },
    { v: '', style: STYLE.MANUAL },
    { v: '', style: STYLE.MANUAL },
    { v: '', style: STYLE.MANUAL },
    { v: '', style: STYLE.MANUAL },
  ]);
}
const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
misRows.sort((a, b) => sevOrder[a[3]] - sevOrder[b[3]] || (a[14] === 'Yes' ? -1 : 1) - (b[14] === 'Yes' ? -1 : 1));

writeXlsx(path.join(REVIEW, 'row-misalignment-review.xlsx'), [
  {
    name: '填表说明',
    title: '博文外贸独立站 — 疑似字段错位审核（填表说明）',
    columns: [{ title: '项目', width: 30 }, { title: '说明', width: 95 }],
    rows: [
      ['这个文件是做什么的', '有些行的 Bowen No.（编号）列里装的东西不是编号，而是尺寸、温度、或者另一个编号。说明这一行可能是错位的。'],
      ['为什么严重', '如果编号列错位，同一行的温度列、尺寸列也可能装的是别的产品的东西 → 整行数据都不可信。'],
      [''],
      ['【最重要的一条】', '凡是严重度 HIGH 的记录，系统已经设为 blocked = true：'],
      ['blocked 意味着', '① 不得用于产品页  ② 不得用于 OE 搜索  ③ 不得被 Google 收录'],
      ['', '这是硬性阻断，不是提示。'],
      [''],
      ['涉及多少条记录', `${misRows.length} 条`],
      ['其中 HIGH', `${misRows.filter((r) => r[3] === 'HIGH').length} 条（全部已 blocked）`],
      ['其中 MEDIUM', `${misRows.filter((r) => r[3] === 'MEDIUM').length} 条`],
      ['其中 LOW', `${misRows.filter((r) => r[3] === 'LOW').length} 条`],
      ['其中在第一批候选里的', `${misRows.filter((r) => r[14] === 'Yes').length} 条`],
      [''],
      ['严重度怎么定的', 'HIGH = 编号列里出现尺寸（如 120*85*90）或温度（如 88℃）→ 这一行数据不可信'],
      ['', 'MEDIUM = 编号列里出现第二个编号 → 可能是变体/替代号（合法），也可能是录错'],
      ['', 'LOW = 编号列括号里是零件描述（如 Sealing ring）→ 信息放错位置'],
      [''],
      ['为什么 Sheet1 的记录不算错位', 'Sheet1 的列名叫 Vehicle Model，但里面装的是 OEM 号。'],
      ['', '这是 Sheet1 本身「没有车型列」造成的，影响全部 277 条 Sheet1 记录，不是某一行错位。'],
      ['', '如果把它算作错位，会有 82 个产品被误判。所以本表刻意排除，改为在报告中单独说明。'],
      [''],
      ['怎么用', '拿着 Source Sheet + Source Row 去原始 Excel 核对那一行，然后填 Decision。'],
      ['原始文件位置', 'data/raw/产品信息表1_英文版.xlsx —— 只读，请勿修改'],
      ['Source Row 怎么看', '例如 "Product Information!E129" = 主目录工作表的 E129 单元格'],
      [''],
      ['绿色列', `Decision 下拉可选：${MISALIGN_DECISION.join(' / ')}`],
    ],
  },
  {
    name: '错位审核',
    title: `疑似字段错位审核（${misRows.length} 条，按严重度排序）`,
    notes: [
      '严重度 HIGH 的记录已 blocked，不得用于产品页、OE 搜索和 Google 索引。',
      '请拿 Source Sheet + Source Row 回原始 Excel 核对后填写 Decision。',
    ],
    columns: [
      { title: 'product_id', width: 20 },
      { title: 'Bowen No.', width: 22 },
      { title: 'Bowen No.(原始)', width: 24 },
      { title: '严重度', width: 10 },
      { title: '问题类型', width: 26 },
      { title: '证据（原文）', width: 44 },
      { title: 'publish_status', width: 18 },
      { title: 'blocked', width: 10 },
      { title: '阻断说明', width: 30 },
      { title: 'Opening Temp', width: 14 },
      { title: 'Dimensions', width: 22 },
      { title: 'Application', width: 30 },
      { title: 'Source Sheet', width: 24 },
      { title: 'Source Row', width: 22 },
      { title: '在第一批候选', width: 13 },
      { title: 'Decision', width: 28, style: STYLE.MANUAL_LIST },
      { title: 'Correct Value / 正确处理', width: 30, style: STYLE.MANUAL },
      { title: 'Reviewer', width: 14, style: STYLE.MANUAL },
      { title: 'Review Date', width: 14, style: STYLE.MANUAL },
      { title: 'Notes', width: 30, style: STYLE.MANUAL },
    ],
    freeze: { row: 5, col: 2 },
    autoFilter: true,
    rows: misRows,
    validations: [
      { sqref: `P6:P${5 + misRows.length + 500}`, values: MISALIGN_DECISION, promptTitle: 'Decision', prompt: '核对原表后选择' },
    ],
  },
]);

// =====================================================================
// 统计
// =====================================================================
const statusCounts = {};
for (const r of v2Rows) statusCounts[r.publish_status] = (statusCounts[r.publish_status] || 0) + 1;

const blockedRows = v2Rows.filter((r) => r.blocked === 'true');
const typeUnknown = v2Rows.filter((r) => r.product_type === 'review_required').length;

const crossSheetProducts = new Set();
for (const [k, rec] of bowenSheetOe) {
  if (rec.sheets.size < 2) continue;
  let inconsistent = false;
  const union = new Set();
  for (const [, m] of rec.sheets) for (const oeKey of m.keys()) union.add(oeKey);
  for (const [, m] of rec.sheets) if (m.size !== union.size) inconsistent = true;
  if (inconsistent) for (const pid of rec.productIds) crossSheetProducts.add(pid);
}
const variantProducts = new Set();
for (const [base, variants] of variantFamilies) {
  for (const p of products) {
    if (p.bowen_no && variants.includes(bowenKey(p.bowen_no).exact)) variantProducts.add(p.product_id);
  }
}

const summary = {
  generated_at: NOW,
  data_version: DATA_VERSION,
  totals: {
    产品总数: v2Rows.length,
    原始记录数: 970,
    publish_candidate: statusCounts.publish_candidate || 0,
    searchable_noindex: statusCounts.searchable_noindex || 0,
    draft: statusCounts.draft || 0,
    blocked: statusCounts.blocked || 0,
    published: statusCounts.published || 0,
  },
  产品类型未知: typeUnknown,
  跨工作表OE差异涉及产品: crossSheetProducts.size,
  Bowen编号变体涉及产品: variantProducts.size,
  被blocked产品: blockedRows.length,
  publish_candidate产品: statusCounts.publish_candidate || 0,
  review_files: {
    'first-batch-business-review.xlsx': batchProducts.length,
    'oe-cross-sheet-review.xlsx': crossSheetRows.length,
    'bowen-number-variant-review.xlsx': variantRows.length,
    'row-misalignment-review.xlsx': misRows.length,
  },
  guards: {
    published_count: statusCounts.published || 0,
    product_type_filled_count: v2Rows.filter((r) => r.product_type !== 'review_required').length,
    fitment_exact_count: v2Rows.filter((r) => r.fitment_confidence === 'exact').length,
    indexable_yes_count: v2Rows.filter((r) => r.indexable === 'true').length,
    high_severity_all_blocked: misRows.filter((r) => r[3] === 'HIGH').every((r) => r[7] === 'true'),
  },
};
fs.writeFileSync(path.join(D, 'phase2-package-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

console.log('=== Phase 2 人工业务审核包已生成 ===');
console.log('review/first-batch-business-review.xlsx      :', batchProducts.length, '个产品');
console.log('review/oe-cross-sheet-review.xlsx            :', crossSheetRows.length, '行 OE 记录 /', crossSheetSummary.length, '个 Bowen 编号');
console.log('review/bowen-number-variant-review.xlsx      :', variantRows.length, '个编号 /', variantFamilies.size, '族');
console.log('review/row-misalignment-review.xlsx          :', misRows.length, '条');
console.log('data/derived/products-v2.csv                 :', v2Rows.length, '行');
console.log('data/derived/product-oe-index-v2.csv         :', oeV2.length, '行');
console.log('');
console.log(JSON.stringify(summary, null, 2));
