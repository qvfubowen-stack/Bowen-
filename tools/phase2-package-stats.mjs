import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from './xlsx-reader.mjs';
import { bowenKey } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data/derived');
const REVIEW = path.join(ROOT, 'review');

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

function readXlsxSheetRows(file, sheetIndex) {
  const wb = new Workbook(path.join(REVIEW, file));
  const s = wb.sheets[sheetIndex];
  const sh = wb.readSheet(s.path);
  const grid = new Map();
  for (const c of sh.cells) grid.set(c.row + ':' + c.col, c.value);
  let headerRow = 0;
  for (let r = 1; r <= Math.min(sh.maxRow, 40); r++) {
    let n = 0; for (let c = 1; c <= sh.maxCol; c++) if (String(grid.get(r + ':' + c) ?? '').trim()) n++;
    if (n >= 3) { headerRow = r; break; }
  }
  const header = []; for (let c = 1; c <= sh.maxCol; c++) header.push(String(grid.get(headerRow + ':' + c) ?? ''));
  const rows = [];
  for (let r = headerRow + 1; r <= sh.maxRow; r++) {
    const o = {}; let any = false;
    for (let c = 1; c <= sh.maxCol; c++) { const v = String(grid.get(r + ':' + c) ?? ''); o[header[c - 1]] = v; if (v.trim()) any = true; }
    if (any) rows.push(o);
  }
  return { rows, header, headerRow, wb };
}

const v2 = readCsv('products-v2.csv');
const sum = JSON.parse(fs.readFileSync(path.join(D, 'phase2-package-summary.json'), 'utf8'));
const s1 = readXlsxSheetRows('first-batch-business-review.xlsx', 1);
const cs = readXlsxSheetRows('oe-cross-sheet-review.xlsx', 1);
const csPrio = readXlsxSheetRows('oe-cross-sheet-review.xlsx', 2);
const csSum = readXlsxSheetRows('oe-cross-sheet-review.xlsx', 3);
const mis = readXlsxSheetRows('row-misalignment-review.xlsx', 1);

console.log('=== A. 状态分布 ===');
const st = {};
for (const r of v2) st[r.publish_status] = (st[r.publish_status] || 0) + 1;
for (const [k, v] of Object.entries(st)) console.log(`  ${k}: ${v}`);
console.log('  合计:', Object.values(st).reduce((a, b) => a + b, 0));

console.log('\n=== B. 第一批审核表 ===');
console.log('  产品行数:', s1.rows.length);
const s1Flags = {};
for (const r of s1.rows) {
  const f = r['Phase2 数据问题提示'] || '无';
  s1Flags[f] = (s1Flags[f] || 0) + 1;
}
console.log('  数据问题提示分布:');
for (const [k, v] of Object.entries(s1Flags).sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).slice(0, 70)}: ${v}`);

console.log('\n=== C. OE 跨表差异 ===');
console.log('  全部差异行:', cs.rows.length);
console.log('  第一批优先审核行:', csPrio.rows.length);
console.log('  涉及 Bowen 编号数:', csSum.rows.length);
console.log('  其中在第一批候选的编号数:', csSum.rows.filter((r) => r['在第一批候选'] === 'Yes').length);
console.log('  第一批优先处理编号数:', csSum.rows.filter((r) => r['第一批优先处理'] === 'Yes').length);
const s1Bowens = new Set(s1.rows.map((r) => bowenKey(r['Bowen No.']).exact));
const prioBowens = new Set(csPrio.rows.map((r) => bowenKey(r['Bowen No.']).exact));
console.log('  第一批 72 个中涉及跨表 OE 差异的编号数:', [...prioBowens].filter((b) => s1Bowens.has(b)).length);

console.log('\n=== D. 错位 ===');
const misSev = {};
for (const r of mis.rows) misSev[r['严重度']] = (misSev[r['严重度']] || 0) + 1;
console.log('  严重度分布:', JSON.stringify(misSev));
console.log('  其中在第一批候选:', mis.rows.filter((r) => r['在第一批候选'] === 'Yes').length);
console.log('  HIGH 编号:', mis.rows.filter((r) => r['严重度'] === 'HIGH').map((r) => r['Bowen No.']).join(' | '));

console.log('\n=== E. 变体 ===');
const bv = readXlsxSheetRows('bowen-number-variant-review.xlsx', 1);
console.log('  变体编号行数:', bv.rows.length);
console.log('  变体族数:', new Set(bv.rows.map((r) => r['基础编号'])).size);
console.log('  在第一批候选的变体编号:', bv.rows.filter((r) => r['在第一批候选'] === 'Yes').length);

console.log('\n=== F. 最少审核量（若只先上线 50 个）===');
// 第一批里"无阻塞数据问题"的（Phase2 数据问题提示 = 无）
const clean = s1.rows.filter((r) => (r['Phase2 数据问题提示'] || '无') === '无');
console.log('  第一批中无数据问题的产品数:', clean.length);
console.log('  第一批中有数据问题的产品数:', s1.rows.length - clean.length);
console.log('  每人每行最少要填的字段数: 7 (类型/主OE/车型校对/温度校对/在产/是否发布/审核人+日期)');
console.log('  先上线 50 个需要确认的最少产品行数:', 50);
console.log('  若只用"无数据问题"的产品，最多只能上线:', clean.length);
console.log('  要达到 50 个，必须额外处理有数据问题的产品数:', Math.max(0, 50 - clean.length));
