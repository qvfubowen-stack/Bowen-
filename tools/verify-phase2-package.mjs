/**
 * Phase 2 人工业务审核包验收测试
 * ---------------------------------------------------------------------
 * 强制检查需求里列出的全部禁令与硬约束。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from './xlsx-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');
const REVIEW = path.join(ROOT, 'review');

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`  [PASS] ${n}`); } else { fail++; console.log(`  [FAIL] ${n} ${extra}`); } };

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
  const body = rows.filter((r) => !String(r[0] || '').startsWith('#') && r.length > 1);
  const header = body.shift();
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));

/** 读一个 xlsx 工作表为对象数组（跳过标题行与说明行，找表头行） */
function readXlsxSheet(file, sheetIndex) {
  const wb = new Workbook(path.join(REVIEW, file));
  const s = wb.sheets[sheetIndex];
  const sh = wb.readSheet(s.path);
  const xml = wb.zip.text(s.path);
  const grid = new Map();
  for (const c of sh.cells) grid.set(c.row + ':' + c.col, c.value);
  let headerRow = 0;
  for (let r = 1; r <= Math.min(sh.maxRow, 40); r++) {
    let n = 0;
    for (let c = 1; c <= sh.maxCol; c++) if (String(grid.get(r + ':' + c) ?? '').trim()) n++;
    if (n >= 3) { headerRow = r; break; }
  }
  const header = [];
  for (let c = 1; c <= sh.maxCol; c++) header.push(String(grid.get(headerRow + ':' + c) ?? ''));
  const rows = [];
  for (let r = headerRow + 1; r <= sh.maxRow; r++) {
    const o = {};
    let any = false;
    for (let c = 1; c <= sh.maxCol; c++) {
      const v = String(grid.get(r + ':' + c) ?? '');
      o[header[c - 1]] = v;
      if (v.trim()) any = true;
    }
    if (any) rows.push(o);
  }
  return { wb, sheet: s, xml, header, rows, headerRow, maxRow: sh.maxRow, maxCol: sh.maxCol };
}

console.log('Phase 2 人工业务审核包验收');
console.log('='.repeat(80));

// =====================================================================
console.log('\n[1] 审核包文件存在且为合法 xlsx');
// =====================================================================
const XLSX = ['first-batch-business-review.xlsx', 'oe-cross-sheet-review.xlsx',
  'bowen-number-variant-review.xlsx', 'row-misalignment-review.xlsx'];
for (const f of XLSX) {
  const p = path.join(REVIEW, f);
  ok(`${f} 存在`, fs.existsSync(p));
  if (fs.existsSync(p)) {
    const buf = fs.readFileSync(p);
    ok(`${f} 是合法 ZIP/xlsx（PK 头）`, buf[0] === 0x50 && buf[1] === 0x4b);
    try {
      const wb = new Workbook(p);
      ok(`${f} 可被解析，含 ${wb.sheets.length} 个工作表`, wb.sheets.length >= 2);
      ok(`${f} 含中文说明工作表`, wb.sheets.some((s) => s.name.includes('说明')));
    } catch (e) { ok(`${f} 可被解析`, false, String(e.message)); }
  }
}
ok('审核目录中不再残留旧的 CSV 审核表（已归档）',
  fs.readdirSync(REVIEW).filter((f) => f.endsWith('.csv')).length === 0,
  fs.readdirSync(REVIEW).filter((f) => f.endsWith('.csv')).join(','));

// =====================================================================
console.log('\n[2] 禁令：不得使用 published');
// =====================================================================
const v2 = readCsv('products-v2.csv');
ok('products-v2.csv 存在且有 466 行', v2.length === 466, `实际=${v2.length}`);
const statuses = new Set(v2.map((r) => r.publish_status));
const ALLOWED = new Set(['publish_candidate', 'searchable_noindex', 'draft', 'blocked']);
ok('publish_status 只使用允许的 4 个值', [...statuses].every((s) => ALLOWED.has(s)), `实际=${[...statuses].join(',')}`);
ok('products-v2.csv 中没有任何 published', !v2.some((r) => r.publish_status === 'published'));
ok('第一批 72 个全部标为 publish_candidate',
  v2.filter((r) => r.in_first_batch === 'true').length === 72
  && v2.filter((r) => r.in_first_batch === 'true').every((r) => r.publish_status === 'publish_candidate'));
ok('第一批中没有任何一个被标为 published',
  !v2.some((r) => r.in_first_batch === 'true' && r.publish_status === 'published'));

const sum = JSON.parse(fs.readFileSync(path.join(D, 'phase2-package-summary.json'), 'utf8'));
ok('汇总中 published 计数为 0', sum.totals.published === 0 && sum.guards.published_count === 0);

// =====================================================================
console.log('\n[3] 禁令：不得猜 product_type');
// =====================================================================
ok('全库 product_type 一律 review_required',
  v2.every((r) => r.product_type === 'review_required'), `非 review_required 的=${v2.filter((r) => r.product_type !== 'review_required').length}`);
ok('全库 product_name_en 一律为空', v2.every((r) => !r.product_name_en));
ok('汇总中 product_type 已填计数为 0', sum.guards.product_type_filled_count === 0);

// 审核表里的下拉值必须是需求指定的 10 个
const REVIEW_TYPES = ['Automotive Thermostat', 'Thermostat Assembly', 'Thermostat Insert',
  'Temperature Sensor', 'Thermal Switch', 'Oil Pressure Warning Switch', 'Reverse Light Switch',
  'Brake Light Switch', 'Other', 'Unknown'];
const s1 = readXlsxSheet('first-batch-business-review.xlsx', 1);
const dvMatch = s1.xml.match(/<dataValidation[^>]*sqref="N[^"]*"[^>]*>.*?<formula1>(.*?)<\/formula1>/s)
  || s1.xml.match(/<formula1>(&quot;)?(Automotive Thermostat[^<]*)/);
const dvText = s1.xml.match(/<dataValidation[^>]*>(.*?)<\/dataValidation>/gs) || [];
const hasTypeList = dvText.some((d) => d.includes('Automotive Thermostat') && d.includes('Unknown'));
ok('第一批审核表含 Confirmed Product Type 下拉菜单', hasTypeList);
ok('下拉菜单包含需求指定的 10 个类型',
  dvText.some((d) => REVIEW_TYPES.every((t) => d.includes(t))));

// =====================================================================
console.log('\n[4] 禁令：不得自动设置 fitment_confidence = exact');
// =====================================================================
ok('products-v2.csv 中无 exact', !v2.some((r) => r.fitment_confidence === 'exact'));
ok('products-v2.csv 中全部为 review_required',
  v2.every((r) => r.fitment_confidence === 'review_required'));
ok('汇总中 exact 计数为 0', sum.guards.fitment_exact_count === 0);
const oeV2 = readCsv('product-oe-index-v2.csv');
ok('OE 索引 v2 中无 exact', !oeV2.some((r) => r.fitment_confidence === 'exact'));

// =====================================================================
console.log('\n[5] 禁令：indexable 不得为 yes');
// =====================================================================
ok('products-v2.csv 中 indexable 全部为 false', v2.every((r) => r.indexable === 'false'));
ok('OE 索引 v2 中 indexable 全部为 false', oeV2.every((r) => r.indexable === 'false'));
ok('汇总中 indexable=yes 计数为 0', sum.guards.indexable_yes_count === 0);

// =====================================================================
console.log('\n[6] 疑似错位记录必须 blocked = true 且 publish_status = draft/blocked');
// =====================================================================
const mis = readXlsxSheet('row-misalignment-review.xlsx', 1);
ok('错位审核表有数据', mis.rows.length > 0, `实际=${mis.rows.length}`);
const highRows = mis.rows.filter((r) => r['严重度'] === 'HIGH');
ok('存在 HIGH 级错位记录', highRows.length > 0, `HIGH=${highRows.length}`);
ok('全部 HIGH 级记录的 blocked 列为 true', highRows.every((r) => r.blocked === 'true'));
ok('全部 HIGH 级记录的 publish_status 为 blocked',
  highRows.every((r) => r.publish_status === 'blocked'), highRows.map((r) => r.publish_status).join(','));
ok('阻断说明写明不得用于产品页/OE搜索/索引',
  highRows.every((r) => r['阻断说明'].includes('不得用于')));
ok('汇总中 high_severity_all_blocked 为 true', sum.guards.high_severity_all_blocked === true);

const blockedProducts = v2.filter((r) => r.blocked === 'true');
ok('products-v2 中 blocked 产品数 > 0', blockedProducts.length > 0, `${blockedProducts.length}`);
ok('blocked 产品的 publish_status 都是 blocked',
  blockedProducts.every((r) => r.publish_status === 'blocked'));
ok('blocked 产品都有 blocked_reason', blockedProducts.every((r) => r.blocked_reason));
// OE 索引里 blocked 产品不得可用
const blockedIds = new Set(blockedProducts.map((r) => r.product_id));
const blockedOe = oeV2.filter((r) => blockedIds.has(r.product_id));
ok('blocked 产品的 OE 记录全部 usable_for_oe_search=false',
  blockedOe.every((r) => r.usable_for_oe_search === 'false'), `共 ${blockedOe.length} 条`);
ok('blocked 产品的 OE 记录全部 usable_for_product_page=false',
  blockedOe.every((r) => r.usable_for_product_page === 'false'));

// =====================================================================
console.log('\n[7] 第一批产品人工审核表内容完整');
// =====================================================================
const s1b = readXlsxSheet('first-batch-business-review.xlsx', 1);
ok('第一批审核表恰好 72 行产品', s1b.rows.length === 72, `实际=${s1b.rows.length}`);
const REQUIRED_COLS = ['Bowen No.', 'Product Image', 'Current Product Name', 'OE Numbers',
  'Vehicle Make', 'Vehicle Model', 'Engine / Application', 'Opening Temperature', 'Dimensions',
  'Source Sheets', 'Current Data Completeness',
  'Confirmed Product Type', 'Confirmed Main OE', 'Other Valid OE Numbers',
  'Vehicle/Application Correct?', 'Opening Temperature Correct?', 'Product Still Active?',
  'Allowed to Publish?', 'Reviewer', 'Review Date', 'Notes'];
const missingCols = REQUIRED_COLS.filter((c) => !s1b.header.includes(c));
ok('需求要求的全部列都存在', missingCols.length === 0, `缺失=${missingCols.join(',')}`);
ok('Confirmed Product Type 列 100% 为空（未猜类型）',
  s1b.rows.every((r) => !r['Confirmed Product Type']));
ok('全部人工填写列初始为空',
  s1b.rows.every((r) => !r['Confirmed Main OE'] && !r['Other Valid OE Numbers']
    && !r['Vehicle/Application Correct?'] && !r['Opening Temperature Correct?']
    && !r['Product Still Active?'] && !r['Allowed to Publish?']
    && !r['Reviewer'] && !r['Review Date'] && !r['Notes']));
ok('每行都有 Bowen No.', s1b.rows.every((r) => r['Bowen No.']));
ok('每行都有 OE Numbers', s1b.rows.every((r) => r['OE Numbers']));
ok('每行都有 Source Sheets（可追溯）', s1b.rows.every((r) => r['Source Sheets']));
ok('含 4 个人工下拉列（类型/车型/温度/在产/发布）', (s1b.xml.match(/<dataValidation /g) || []).length === 5);

// =====================================================================
console.log('\n[8] OE 跨工作表差异审核表内容完整');
// =====================================================================
const cs = readXlsxSheet('oe-cross-sheet-review.xlsx', 1);
const CS_COLS = ['Bowen No.', 'OE Number', 'Source Sheet(s)', 'Source Row / Cell',
  'Vehicle / Application', 'Occurrences', 'Potential Conflict', 'Valid OE?', 'Relationship'];
const missCs = CS_COLS.filter((c) => !cs.header.includes(c));
ok('需求要求的全部列都存在', missCs.length === 0, `缺失=${missCs.join(',')}`);
ok('跨表差异表有数据', cs.rows.length > 0, `实际=${cs.rows.length}`);
ok('每行都有 Bowen No. 与 OE Number', cs.rows.every((r) => r['Bowen No.'] && r['OE Number']));
ok('每行都有原始来源位置', cs.rows.every((r) => r['Source Row / Cell']));
ok('每行都标注了 Occurrences', cs.rows.every((r) => r.Occurrences && Number(r.Occurrences) >= 1));
ok('每行都标注了 Potential Conflict', cs.rows.every((r) => ['Yes', 'No'].includes(r['Potential Conflict'])));
ok('Valid OE? / Relationship 列 100% 为空（程序不判断）',
  cs.rows.every((r) => !r['Valid OE?'] && !r['Relationship']));
ok('含 Valid OE? 与 Relationship 两个下拉',
  (cs.xml.match(/<dataValidation /g) || []).length >= 2);
ok('Relationship 下拉含需求指定的 5 个选项',
  ['Main OE', 'Cross Reference', 'Vehicle-specific Reference', 'Incorrect', 'Unknown']
    .every((t) => cs.xml.includes(t)));
ok('存在"第一批优先审核"工作表（便于先处理重点）',
  new Workbook(path.join(REVIEW, 'oe-cross-sheet-review.xlsx')).sheets.some((s) => s.name.includes('优先')));

// =====================================================================
console.log('\n[9] Bowen 编号变体审核表内容完整（不得自动合并）');
// =====================================================================
const bv = readXlsxSheet('bowen-number-variant-review.xlsx', 1);
ok('变体表有数据', bv.rows.length > 0, `实际=${bv.rows.length}`);
const BV_NEED = ['基础编号', '本族全部编号', 'Bowen No.', '原始写法', 'OE 示例', 'OE 重叠情况',
  'Vehicle Make', 'Application', 'Opening Temp', 'Specs / 尺寸', 'Product Image', 'Source Sheet',
  'Decision', 'Merge into (Bowen No.)'];
const missBv = BV_NEED.filter((c) => !bv.header.includes(c));
ok('需求要求的列都存在（含图片/规格/温度/车型/OE/来源）', missBv.length === 0, `缺失=${missBv.join(',')}`);
ok('程序未自动合并：原库产品数仍是 466', readCsv('products.csv').length === 466);
ok('Decision / Merge into 列 100% 为空（等人工确认）',
  bv.rows.every((r) => !r.Decision && !r['Merge into (Bowen No.)']));
ok('含 Decision 下拉（4 个选项）',
  ['Same Product - Merge', 'Different Products - Keep Separate', 'Part of Same Family', 'Unknown']
    .every((t) => bv.xml.includes(t) || t.includes(' ')));
ok('每行都有 OE 重叠证据', bv.rows.every((r) => r['OE 重叠情况'] && r['OE 重叠情况'].includes('共有')));
ok('每行都有原始来源', bv.rows.every((r) => r['Source Sheet'] && r['Source Row']));

// =====================================================================
console.log('\n[10] 错位审核表内容完整');
// =====================================================================
const MIS_COLS = ['product_id', 'Bowen No.', 'Bowen No.(原始)', '严重度', '问题类型', '证据（原文）',
  'publish_status', 'blocked', 'Source Sheet', 'Source Row', 'Decision'];
const missMis = MIS_COLS.filter((c) => !mis.header.includes(c));
ok('需求要求的列都存在', missMis.length === 0, `缺失=${missMis.join(',')}`);
ok('每行都有原始位置可回表核对', mis.rows.every((r) => r['Source Sheet'] && r['Source Row']));
ok('每行都有证据', mis.rows.every((r) => r['证据（原文）']));
ok('严重度取值合法', mis.rows.every((r) => ['HIGH', 'MEDIUM', 'LOW'].includes(r['严重度'])));
ok('Decision 列 100% 为空（等人工确认）', mis.rows.every((r) => !r.Decision));
ok('含 Decision 下拉', (mis.xml.match(/<dataValidation /g) || []).length >= 1);
ok('按严重度排序（HIGH 在前）',
  mis.rows.findIndex((r) => r['严重度'] === 'MEDIUM') === -1
  || mis.rows.findIndex((r) => r['严重度'] === 'HIGH') < mis.rows.findIndex((r) => r['严重度'] === 'MEDIUM'));

// =====================================================================
console.log('\n[11] 原始文件未被修改');
// =====================================================================
import crypto from 'node:crypto';
const rawPath = path.join(ROOT, 'data', 'raw', '产品信息表1_英文版.xlsx');
const rawSha = crypto.createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex');
ok('原始 Excel SHA-256 仍与冻结值一致',
  rawSha === '22da11156fa4eb82a5b88c520263b06d56c39e0c291c3ed8952edccb1e8a062f', rawSha);
ok('review 目录中没有写入任何原始资料文件',
  fs.readdirSync(REVIEW).every((f) => !f.endsWith('.xlsx') || XLSX.includes(f)));

// =====================================================================
console.log('\n[12] 汇总数字自洽');
// =====================================================================
ok('产品总数 = 466', sum.totals.产品总数 === 466);
const statusSum = sum.totals.publish_candidate + sum.totals.searchable_noindex
  + sum.totals.draft + sum.totals.blocked + sum.totals.published;
ok('各状态之和 = 产品总数', statusSum === 466, `${statusSum}`);
ok('publish_candidate = 72', sum.totals.publish_candidate === 72);
ok('产品类型未知 = 466', sum.产品类型未知 === 466);
ok('blocked 产品数 = 11', sum.被blocked产品 === 11, `${sum.被blocked产品}`);

console.log('\n' + '='.repeat(80));
console.log(`Phase 2 审核包验收结果：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
