import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const readCsv = (f) => parseCsv(fs.readFileSync(path.isAbsolute(f) ? f : path.join(D, f), 'utf8'));

const products = readCsv('products.csv');
const noBowen = products.filter((p) => !p.bowen_no);
console.log(`无 Bowen No. 的产品: ${noBowen.length} 个`);
for (const p of noBowen) {
  console.log(`  ${p.product_id} | OE=${p.oe_count} | make=${p.vehicle_make || '(无)'} | temp=${p.opening_temperature_c || '(无)'} | status=${p.status} | flags=${p.quality_flags}`);
}

// 共享 OE 表里有多少行涉及“无编号”的伪产品
const shared = readCsv(path.join(ROOT, 'review/shared-oe-review.csv'));
const withNoBowen = shared.filter((r) => String(r.referencing_bowen_nos).includes('(无编号)'));
console.log(`\n共享 OE 表中涉及“无编号”伪产品的行数: ${withNoBowen.length} / ${shared.length}`);

// 第一批 72 个里有多少涉及共享 OE 且对方是伪产品
console.log('\n第一批 72 个的共享 OE 是否只与伪产品共享：');
const b72 = readCsv('first-batch-published.csv');
const prods = new Set(b72.map((b) => b.product_id));
let onlyPseudo = 0;
for (const r of shared) {
  const ids = String(r.referencing_product_ids).split(' | ');
  const inB = ids.filter((i) => prods.has(i));
  if (inB.length === 0) continue;
  const others = ids.filter((i) => !prods.has(i));
  const othersArePseudo = others.every((i) => i.startsWith('bwp-'));
  if (othersArePseudo && others.length) onlyPseudo++;
}
console.log(`第一批涉及、且对方全是无编号伪产品的共享 OE 行数: ${onlyPseudo}`);
