import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  return rows;
}
const all = parseCsv(fs.readFileSync(path.join(ROOT, 'review/first-72-products-review.csv'), 'utf8'));
const data = all.filter((r) => !String(r[0] || '').startsWith('#') && r.length > 1);
const header = data.shift();
const rows = data.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));

const BLOCKING = ['bowen_contains_two_numbers', 'bowen_contains_dimensions', 'bowen_contains_unit_text',
  'bowen_contains_cross_reference', 'bowen_contains_parenthetical', 'bowen_variant',
  'oe_shared', 'oe_list_conflict_across_sheets', 'oe_split_ambiguous'];

const clean = rows.filter((r) => !BLOCKING.some((b) => String(r.phase2_review_flags).includes(b)));
console.log(`无数据问题的产品: ${clean.length} 个\n`);
console.log('rank\tbowen_no\tOE数\t车型品牌\t温度\t尺寸\t产品类型建议');
for (const r of clean) {
  console.log(`${r.review_rank}\t${r.bowen_no}\t${r.oe_count}\t${String(r.vehicle_make).slice(0, 45)}\t${r.opening_temperature}\t${String(r.dimensions).slice(0, 30)}\t${r.product_type_suggestion}`);
}

console.log('\n\n各类问题计数：');
const cnt = {};
for (const r of rows) {
  for (const f of String(r.phase2_review_flags).split('; ').filter(Boolean)) {
    const key = f.split('_count')[0];
    cnt[key] = (cnt[key] || 0) + 1;
  }
}
for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
