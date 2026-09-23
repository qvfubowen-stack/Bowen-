import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from './xlsx-reader.mjs';
import { bowenKey } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'review');
const D = path.join(ROOT, 'data/derived');

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
  return { rows };
}

const s1 = readXlsxSheetRows('first-batch-business-review.xlsx', 1).rows;
const csPrio = readXlsxSheetRows('oe-cross-sheet-review.xlsx', 2).rows;

// 每个第一批 Bowen 的跨表差异行数
const diffsByBowen = new Map();
for (const r of csPrio) {
  const k = bowenKey(r['Bowen No.']).exact;
  diffsByBowen.set(k, (diffsByBowen.get(k) || 0) + 1);
}

const products = s1.map((r) => {
  const k = bowenKey(r['Bowen No.']).exact;
  return {
    bowen: r['Bowen No.'],
    key: k,
    diff: diffsByBowen.get(k) || 0,
    hasDataIssue: (r['Phase2 数据问题提示'] || '无') !== '无',
  };
});

const noDiff = products.filter((p) => p.diff === 0);
const withDiff = products.filter((p) => p.diff > 0).sort((a, b) => a.diff - b.diff);

console.log(`第一批候选: ${products.length} 个`);
console.log(`  无跨表 OE 差异: ${noDiff.length} 个`);
console.log(`  有跨表 OE 差异: ${withDiff.length} 个`);
console.log(`  有数据问题(错位): ${products.filter((p) => p.hasDataIssue).length} 个`);
console.log(`  完全干净(无差异且无数据问题): ${products.filter((p) => p.diff === 0 && !p.hasDataIssue).length} 个`);

// 取 50 个最省力的：先无差异的，再按差异数从小到大
const need = 50;
const picked = [...noDiff, ...withDiff].slice(0, need);
const oeConfirm = picked.reduce((a, p) => a + p.diff, 0);
const dataIssuePicked = picked.filter((p) => p.hasDataIssue).length;

console.log(`\n=== 最省力路线：上线 50 个 ===`);
console.log(`  产品行确认: ${picked.length}`);
console.log(`  其中需要额外看原表(有数据问题)的: ${dataIssuePicked}`);
console.log(`  OE 关系确认条数: ${oeConfirm}`);
console.log(`  平均每个产品差异数: ${(oeConfirm / picked.length).toFixed(1)}`);
console.log(`  总确认记录数: ${picked.length + oeConfirm + dataIssuePicked}`);
console.log(`  涉及 Bowen: ${picked.map((p) => p.bowen).join(', ')}`);

// 全部 72 个
const allDiff = products.reduce((a, p) => a + p.diff, 0);
console.log(`\n=== 全部 72 个 ===`);
console.log(`  产品行: ${products.length}`);
console.log(`  OE 关系: ${allDiff}`);
console.log(`  变体行: 13 (第一批候选内的变体编号)`);
console.log(`  错位行: ${products.filter((p) => p.hasDataIssue).length}`);
console.log(`  总确认记录数: ${products.length + allDiff + 13 + products.filter((p) => p.hasDataIssue).length}`);
