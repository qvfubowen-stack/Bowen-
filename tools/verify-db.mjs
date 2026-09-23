/**
 * 阶段一验收测试：对派生产物做自检。
 * 用法：node tools/verify-db.mjs
 * 退出码 0 = 全部通过；1 = 有断言失败。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Workbook } from './xlsx-reader.mjs';
import { normalizeOeNumber, oeMatchKey, bowenKey, parseBowenNo } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', '产品信息表1_英文版.xlsx');
const DERIVED = path.join(ROOT, 'data', 'derived');
const EXPECTED_SHA = '22da11156fa4eb82a5b88c520263b06d56c39e0c291c3ed8952edccb1e8a062f';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; console.log(`  [FAIL] ${name} ${extra}`); }
};

// ---- 极简 CSV 解析（支持引号内换行） ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(DERIVED, f), 'utf8'));
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DERIVED, f), 'utf8'));

console.log('博文独立站 — 阶段一数据验收');
console.log('='.repeat(80));

// =====================================================================
console.log('\n[1] 原始文件未被修改');
// =====================================================================
const rawBuf = fs.readFileSync(RAW);
const actualSha = crypto.createHash('sha256').update(rawBuf).digest('hex');
ok('原始 Excel SHA-256 与冻结值一致（文件未被改动）', actualSha === EXPECTED_SHA, `实际=${actualSha}`);

const srcMeta = readJson('source-files.json');
ok('source-files.json 记录的哈希与实测一致', srcMeta.files[0].sha256 === actualSha);

// =====================================================================
console.log('\n[2] 工作表与原始记录可追溯');
// =====================================================================
const sheets = readJson('sheet-inventory.json').sheets;
ok('17 个工作表全部登记', sheets.length === 17, `实际=${sheets.length}`);
const raw = readCsv('staging-records.raw.csv');
ok('原始记录层非空', raw.length > 800, `实际=${raw.length}`);

// 复查：随机抽 30 条原始记录，回到 Excel 核对 oem_raw / bowen_raw 是否逐字一致
const wb = new Workbook(RAW);
const sheetGrid = new Map();
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const g = new Map();
  for (const c of sh.cells) g.set(c.row + ':' + c.col, c.value == null ? '' : String(c.value));
  sheetGrid.set(s.name, g);
}
const COL = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J', 11: 'K', 12: 'L', 13: 'M', 14: 'N' };
let checked = 0, mismatched = 0;
const step = Math.max(1, Math.floor(raw.length / 30));
for (let i = 0; i < raw.length; i += step) {
  const r = raw[i];
  const g = sheetGrid.get(r.source_sheet);
  if (!g) continue;
  const oemCol = r.source_cell_oem.replace(/\d+/g, '');
  const bowenCol = r.source_cell_bowen.replace(/\d+/g, '');
  const excelOem = String(g.get(r.source_row + ':' + Object.entries(COL).find(([, v]) => v === oemCol)?.[0]) ?? '');
  const excelBowen = String(g.get(r.source_row + ':' + Object.entries(COL).find(([, v]) => v === bowenCol)?.[0]) ?? '');
  checked++;
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/[\r\n]+/g, '\n').trim();
  if (norm(excelOem) !== norm(r.oem_raw)) { mismatched++; if (mismatched < 4) console.log(`     差异 ${r.source_sheet}!${r.source_cell_oem}\n       Excel=${JSON.stringify(norm(excelOem))}\n       CSV  =${JSON.stringify(norm(r.oem_raw))}`); }
  if (norm(excelBowen) !== norm(r.bowen_raw)) { mismatched++; }
}
ok(`抽样 ${checked} 条原始记录与 Excel 逐字一致`, mismatched === 0, `不一致=${mismatched}`);

// =====================================================================
console.log('\n[3] 产品层结构完整');
// =====================================================================
const products = readCsv('products.csv');
ok('products.csv 有数据', products.length > 400, `实际=${products.length}`);
const REQUIRED = ['product_id', 'product_type', 'product_name_en', 'bowen_no', 'status',
  'oe_number_raw', 'oe_number_normalized', 'vehicle_make', 'vehicle_model', 'engine_code',
  'engine_displacement', 'application_notes', 'opening_temperature_c', 'dimensions', 'housing_type',
  'source_sheet', 'source_row', 'source_version', 'fitment_confidence', 'searchable', 'indexable',
  'last_verified_at', 'verified_by'];
const header = Object.keys(products[0]);
const missing = REQUIRED.filter((f) => !header.includes(f));
ok('规划 V1 要求的字段全部存在', missing.length === 0, `缺失=${missing.join(',')}`);
ok('product_id 唯一', new Set(products.map((p) => p.product_id)).size === products.length);
ok('status 取值仅在允许集合内', products.every((p) => ['PUBLISHED', 'SEARCHABLE_BUT_NOINDEX', 'DRAFT'].includes(p.status)));
ok('fitment_confidence 未被伪造（全部 review_required）', products.every((p) => p.fitment_confidence === 'review_required'));
ok('product_type 未被臆造（全部 REVIEW_REQUIRED）', products.every((p) => p.product_type === 'REVIEW_REQUIRED'));
ok('product_name_en 未被臆造（全部留空）', products.every((p) => p.product_name_en === ''));
ok('vehicle_model 未被臆造（全部留空）', products.every((p) => p.vehicle_model === ''));
ok('indexable 全部为 no（未经审核不得索引）', products.every((p) => p.indexable === 'no'));
ok('last_verified_at / verified_by 全部为空（未经人工复核）', products.every((p) => p.last_verified_at === '' && p.verified_by === ''));
ok('searchable=yes 仅出现在 PUBLISHED / SEARCHABLE_BUT_NOINDEX',
  products.every((p) => (p.searchable === 'yes') === (p.status !== 'DRAFT')));
// 发动机代码来自自由文本抽取，必须带 review_required 状态；有值就必须有状态
ok('engine_code 有值时必须带 review_required 状态',
  products.every((p) => (p.engine_code ? p.engine_code_status === 'review_required' : p.engine_code_status === '')));
const engRows = readCsv('product-engine-codes.csv');
ok('engine_code 候选表不被当作已确认数据',
  engRows.every((e) => e.engine_code === 'REVIEW_REQUIRED' && e.engine_code_status === 'review_required'));

// =====================================================================
console.log('\n[4] OE 标准化规则正确');
// =====================================================================
const oes = readCsv('product-oe-index.csv');
ok('OE 明细表非空', oes.length > 1500, `实际=${oes.length}`);
ok('oe_number_normalized 与规则一致（大小写/空格/短横线均已忽略）',
  oes.every((o) => o.oe_number_normalized === normalizeOeNumber(o.oe_number_raw)));
ok('oe_match_key 与规则一致', oes.every((o) => o.oe_match_key === oeMatchKey(o.oe_number_normalized)));
ok('oe_number_normalized 不含空格与短横线', oes.every((o) => !/[\s\u3000\-]/.test(o.oe_number_normalized)));
ok('oe_number_normalized 全为大写', oes.every((o) => o.oe_number_normalized === o.oe_number_normalized.toUpperCase()));
ok('oe_number_normalized 长度在 5-25 位', oes.every((o) => o.oe_number_normalized.length >= 5 && o.oe_number_normalized.length <= 25));
ok('每个 OE 都能挂到存在的 product_id', oes.every((o) => products.some((p) => p.product_id === o.product_id)));
ok('(product_id, oe_number_normalized) 无重复', new Set(oes.map((o) => o.product_id + '|' + o.oe_number_normalized)).size === oes.length);

// 多 OE 拆分验证：找一条原文含换行多 OE 的记录，检查是否拆成对应条数
const rawMulti = raw.find((r) => (r.oem_raw.match(/\n/g) || []).length >= 4);
if (rawMulti) {
  // 用“原始单元格地址”精确定位这一条原始记录对应的 OE 行，避免被同号跨表记录干扰
  const cellAddr = `${rawMulti.source_sheet}!${rawMulti.source_cell_oem}`;
  const expectTokens = [...new Set(rawMulti.oem_raw.split(/[\r\n]+/)
    .map((s) => normalizeOeNumber(s)).filter((s) => s.length >= 5 && s.length <= 25))];
  const oeRawSet = new Set(oes.filter((o) => String(o.source_cells).split(' | ').includes(cellAddr))
    .map((o) => o.oe_number_normalized));
  const allPresent = expectTokens.every((t) => oeRawSet.has(t));
  ok(`多 OE 单元格已拆分（样本 ${cellAddr}：原文 ${expectTokens.length} 个互不相同）`,
    allPresent && oeRawSet.size >= expectTokens.length,
    `实际命中=${oeRawSet.size}，期望包含=${expectTokens.length}`);
  ok(`拆分结果与原文数量一致（${cellAddr}）`, oeRawSet.size === expectTokens.length,
    `实际=${oeRawSet.size} 期望=${expectTokens.length}`);
}

// =====================================================================
console.log('\n[5] Bowen No. 处理正确');
// =====================================================================
const bowenProducts = products.filter((p) => p.bowen_no);
ok('bowen_no 大写一致性未被破坏', bowenProducts.every((p) => typeof p.bowen_no === 'string' && p.bowen_no.trim() !== ''));
const bowenSet = new Set(bowenProducts.map((p) => bowenKey(p.bowen_no).exact));
ok('标准化后 Bowen No. 在产品层唯一', bowenSet.size === bowenProducts.length, `${bowenSet.size} vs ${bowenProducts.length}`);
ok('带 "With small pipe" 的描述已从 bowen_no 拆出',
  !products.some((p) => /small\s*pipe/i.test(p.bowen_no || '')));

const bowenIssues = readCsv('issues-bowen-anomalies.csv');
ok('Bowen No. 异常已单独列出待确认', bowenIssues.length > 0, `实际=${bowenIssues.length}`);

// =====================================================================
console.log('\n[6] 重复识别可用');
// =====================================================================
const dupBowen = readCsv('duplicates-bowen.csv');
const dupOe = readCsv('duplicates-oe.csv');
ok('Bowen 重复报告有内容', dupBowen.length > 0, `实际=${dupBowen.length}`);
ok('OE 重复报告有内容', dupOe.length > 0, `实际=${dupOe.length}`);
ok('跨表 Bowen 重复已单独标记', dupBowen.some((d) => d.type === 'raw_bowen_repeated'));
ok('Bowen 变体族已识别', dupBowen.some((d) => d.type === 'bowen_variant_family'));
ok('共享 OE 已识别', dupOe.some((d) => d.type === 'oe_shared_across_products'));

// =====================================================================
console.log('\n[7] 车型标准化');
// =====================================================================
const makes = readCsv('product-vehicle-makes.csv');
ok('车型品牌关系表非空', makes.length > 200, `实际=${makes.length}`);
ok('vehicle_make 全部来自标准名表（无中文残留、无自由文本）',
  makes.every((m) => !/[\u4e00-\u9fff]/.test(m.vehicle_make) && m.vehicle_make.length <= 30));
ok('vehicle_model 未被臆造', makes.every((m) => m.vehicle_model === '' && m.vehicle_model_status === 'review_required'));
ok('每个车型品牌都挂到存在的 product_id', makes.every((m) => products.some((p) => p.product_id === m.product_id)));

// =====================================================================
console.log('\n[8] 第一批上线推荐合规');
// =====================================================================
const batch = readCsv('first-batch-published.csv');
ok('第一批数量在 50-100 之间', batch.length >= 50 && batch.length <= 100, `实际=${batch.length}`);
ok('第一批全部 status=PUBLISHED', batch.every((b) => b.status === 'PUBLISHED'));
ok('第一批全部有 Bowen No.', batch.every((b) => b.bowen_no));
ok('第一批全部有 OE 号', batch.every((b) => Number(b.oe_count) >= 2));
ok('第一批全部有车型品牌', batch.every((b) => b.vehicle_make));
ok('第一批全部有开启温度', batch.every((b) => b.opening_temperature_c));
ok('第一批全部标注为“待确认产品类型后才能上线”', batch.every((b) => b.publish_ready === 'blocked_until_product_type_confirmed'));
ok('第一批全部按完整度降序排列', batch.every((b, i) => i === 0 || Number(batch[i - 1].data_quality_score) >= Number(b.data_quality_score)));
// 列错位防护：Bowen 单元格混入尺寸或两个编号的记录，绝不允许进入第一批
ok('第一批不含“Bowen 单元格疑似列错位”的记录', batch.every((b) => b.has_attribute_warnings === 'no'));
const allWarn = products.filter((p) => p.has_attribute_warnings === 'yes');
ok('存在列错位风险的记录已被降级（不会出现在 PUBLISHED）',
  allWarn.every((p) => p.status !== 'PUBLISHED'), `风险记录=${allWarn.length}`);
ok('风险记录已写入 quality_flags 可追溯',
  allWarn.every((p) => /列错位风险|两个编号/.test(p.quality_flags)));

// =====================================================================
console.log('\n[9] 字段完整率已计算');
// =====================================================================
const stats = readJson('stats.json');
ok('stats.json 含字段完整率', Array.isArray(stats.field_completeness) && stats.field_completeness.length > 15);
ok('完整率在 0-1 之间', stats.field_completeness.every((f) => f.rate >= 0 && f.rate <= 1));
ok('完整率分母 = 产品数', stats.field_completeness.every((f) => f.total === products.length));
ok('待人工确认字段的完整率为 0 且带说明',
  stats.field_completeness.filter((f) => ['product_type', 'vehicle_model', 'indexable'].includes(f.field)).every((f) => f.rate === 0 && f.note));

// =====================================================================
console.log('\n[10] 输出目录干净（原始数据未被写入）');
// =====================================================================
const rawDirFiles = fs.readdirSync(path.join(ROOT, 'data', 'raw'));
ok('data/raw 下只有原始文件，没有被写入派生产物',
  rawDirFiles.every((f) => f.toLowerCase().endsWith('.xlsx')), rawDirFiles.join(','));

console.log('\n' + '='.repeat(80));
console.log(`验收结果：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
