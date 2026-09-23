import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bowenKey } from './lib/normalize.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const oes = parseCsv(fs.readFileSync(path.join(D, 'product-oe-index.csv'), 'utf8'));

console.log('OE 行数:', oes.length);
console.log('sample row:', JSON.stringify(oes[0], null, 2));

const map = new Map();
for (const o of oes) {
  if (!o.bowen_no) continue;
  const k = bowenKey(o.bowen_no).exact;
  if (!map.has(k)) map.set(k, new Map());
  const m = map.get(k);
  if (!m.has(o.source_sheet)) m.set(o.source_sheet, new Set());
  m.get(o.source_sheet).add(o.oe_match_key);
}
const multi = [...map.entries()].filter(([, m]) => m.size >= 2);
console.log('\n出现在 >=2 个工作表的 Bowen 编号数:', multi.length);

let inconsistent = 0;
for (const [k, m] of multi) {
  const sets = [...m.values()];
  const union = new Set(sets.flatMap((s) => [...s]));
  if (sets.some((s) => s.size !== union.size)) inconsistent++;
}
console.log('其中 OE 清单不一致的:', inconsistent);

console.log('\n前 3 个不一致的编号明细:');
let n = 0;
for (const [k, m] of multi) {
  const sets = [...m.values()];
  const union = new Set(sets.flatMap((s) => [...s]));
  if (!sets.some((s) => s.size !== union.size)) continue;
  if (n++ >= 3) break;
  console.log(`  ${k}: 并集 ${union.size} 个`);
  for (const [sheet, s] of m) console.log(`    ${sheet}: ${s.size} 个`);
}
