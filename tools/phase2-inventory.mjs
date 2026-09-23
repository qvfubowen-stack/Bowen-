/**
 * Phase 2 前置盘点：统计审核表需要覆盖的问题规模。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bowenKey } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');

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

const products = readCsv('products.csv');
const oes = readCsv('product-oe-index.csv');
const batch = readCsv('first-batch-published.csv');

const batchIds = new Set(batch.map((b) => b.product_id));
const byId = new Map(products.map((p) => [p.product_id, p]));

console.log('=== Phase 2 盘点 ===');
console.log('产品总数:', products.length, ' 第一批:', batch.length);

// ---- 1) 共享 OE 规模 ----
const oeGroups = new Map();
for (const o of oes) {
  if (!oeGroups.has(o.oe_match_key)) oeGroups.set(o.oe_match_key, []);
  oeGroups.get(o.oe_match_key).push(o);
}
let sharedAll = 0, sharedInBatch = 0, sharedRowsAll = 0, sharedRowsBatch = 0;
for (const [k, list] of oeGroups) {
  const pids = [...new Set(list.map((x) => x.product_id))];
  if (pids.length < 2) continue;
  sharedAll++;
  sharedRowsAll += pids.length;
  const inB = pids.filter((p) => batchIds.has(p));
  if (inB.length >= 2) { sharedInBatch++; sharedRowsBatch += inB.length; }
}
console.log(`\n共享 OE（被>=2个产品引用）: ${sharedAll} 个 OE 号，涉及 ${sharedRowsAll} 条产品-OE 关系`);
console.log(`  其中第一批产品之间互相共享的: ${sharedInBatch} 个 OE 号，涉及 ${sharedRowsBatch} 条`);

// 第一批 72 个产品里，有多少个至少参与一个共享 OE
const batchWithShared = new Set();
for (const [k, list] of oeGroups) {
  const pids = [...new Set(list.map((x) => x.product_id))];
  if (pids.length < 2) continue;
  for (const p of pids) if (batchIds.has(p)) batchWithShared.add(p);
}
console.log(`  第一批 72 个产品中，涉及共享 OE 的产品数: ${batchWithShared.size}`);

// ---- 2) Bowen 变体规模 ----
const byBase = new Map();
for (const p of products) {
  if (!p.bowen_no) continue;
  const k = bowenKey(p.bowen_no);
  if (!byBase.has(k.base)) byBase.set(k.base, []);
  byBase.get(k.base).push(p);
}
const families = [...byBase.entries()].filter(([, v]) => new Set(v.map((x) => bowenKey(x.bowen_no).exact)).size > 1);
console.log(`\nBowen 变体族: ${families.length} 族`);
let famProds = 0, famInBatch = 0;
for (const [, v] of families) {
  famProds += v.length;
  famInBatch += v.filter((p) => batchIds.has(p)).length;
}
console.log(`  涉及产品数: ${famProds}  其中第一批: ${famInBatch}`);

// ---- 3) 错位规模 ----
function bowenLooksLikeDimensions(raw) { return /\d\s*[*x×]\s*\d/.test(raw || ''); }
function bowenHasTwoNumbers(raw) {
  const hits = String(raw || '').match(/\d{3,}/g) || [];
  return hits.length > 1 && !/sealing\s*ring/i.test(raw || '');
}
function bowenHasUnitText(raw) { return /[℃°]|\d\s*(mm|bar|L)\b/i.test(raw || ''); }
function bowenHasParenNote(raw) { return /[（(][^)）]*[)）]/.test(raw || ''); }

let mDim = 0, mTwo = 0, mUnit = 0, mParen = 0, misTotal = 0;
const misBatch = [];
for (const p of products) {
  const raws = String(p.bowen_no_raw || '').split(' | ');
  const flags = [];
  if (raws.some(bowenLooksLikeDimensions)) { flags.push('bowen_contains_dimensions'); mDim++; }
  if (raws.some(bowenHasTwoNumbers)) { flags.push('bowen_contains_two_numbers'); mTwo++; }
  if (raws.some(bowenHasUnitText)) { flags.push('bowen_contains_unit_text'); mUnit++; }
  if (raws.some(bowenHasParenNote)) { flags.push('bowen_contains_parenthetical'); mParen++; }
  if (flags.length) { misTotal++; if (batchIds.has(p.product_id)) misBatch.push(p); }
}
console.log(`\n疑似错位（按 Bowen 单元格特征）: ${misTotal} 个产品`);
console.log(`  bowen_contains_dimensions: ${mDim}`);
console.log(`  bowen_contains_two_numbers: ${mTwo}`);
console.log(`  bowen_contains_unit_text: ${mUnit}`);
console.log(`  bowen_contains_parenthetical: ${mParen}`);
console.log(`  其中属于第一批 72 个的: ${misBatch.length}  ->`, misBatch.map((p) => p.bowen_no).join(', '));

// ---- 4) 第一批里有多少缺应用信息 / 来自 Sheet1 ----
let fromSheet1 = 0, noApp = 0, noMake = 0, noEng = 0, noTemp = 0, noDim = 0;
for (const b of batch) {
  if (String(b.source_sheet).includes('Sheet1')) fromSheet1++;
  if (!b.application_notes) noApp++;
  if (!b.vehicle_make) noMake++;
  if (!b.engine_code) noEng++;
  if (!b.opening_temperature_c) noTemp++;
  if (!b.dimensions) noDim++;
}
console.log(`\n第一批 72 个的字段情况：`);
console.log(`  来源含 Sheet1: ${fromSheet1}`);
console.log(`  缺 application_notes: ${noApp}`);
console.log(`  缺 vehicle_make: ${noMake}`);
console.log(`  缺 engine_code 候选: ${noEng}`);
console.log(`  缺 opening_temperature: ${noTemp}`);
console.log(`  缺 dimensions: ${noDim}`);

// ---- 5) product_type 确认负担 ----
const sugg = {};
for (const b of batch) sugg[b.product_type_suggestion || '(空)'] = (sugg[b.product_type_suggestion || '(空)'] || 0) + 1;
console.log(`\n第一批 product_type_suggestion 分布:`);
for (const [k, v] of Object.entries(sugg).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
