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
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const products = parseCsv(fs.readFileSync(path.join(ROOT, 'data/derived/products.csv'), 'utf8'));
const sugg = {};
for (const p of products) sugg[p.product_type_suggestion] = (sugg[p.product_type_suggestion] || 0) + 1;
console.log('全部 466 个产品的 product_type_suggestion 分布：');
for (const [k, v] of Object.entries(sugg).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

// 有具体关键词证据的产品举例
console.log('\n含具体关键词证据的产品示例（最多 15 个）：');
let n = 0;
for (const p of products) {
  if (p.product_type_suggestion === 'Thermostat (unconfirmed)') continue;
  console.log(`  ${p.bowen_no} -> ${p.product_type_suggestion}  |  ${String(p.application_notes).slice(0, 100)}`);
  if (++n >= 15) break;
}
