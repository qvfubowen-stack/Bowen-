// 校验报告里引用的具体数字，避免文档与数据不一致
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const stats = JSON.parse(fs.readFileSync(path.join(D, 'stats.json'), 'utf8'));

const products = readCsv('products.csv');
const batch = readCsv('first-batch-published.csv');

console.log('--- 报告引用数字核对 ---');
console.log('eligible_pool_size (报告写 80):', stats.first_batch.eligible_pool_size);
console.log('first_batch.count (报告写 72):', stats.first_batch.count);
console.log('shortfall:', stats.first_batch.shortfall_below_target_min);

// 未确认建议的产品类型分布
const sugg = {};
for (const p of batch) sugg[p.product_type_suggestion] = (sugg[p.product_type_suggestion] || 0) + 1;
console.log('\n第一批 product_type_suggestion 分布:');
for (const [k, v] of Object.entries(sugg).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

// PUBLISHED 层总数与告警数
console.log('\nPUBLISHED 产品数:', products.filter((p) => p.status === 'PUBLISHED').length);
console.log('has_attribute_warnings=yes 的产品数:', products.filter((p) => p.has_attribute_warnings === 'yes').length);
console.log('其中处于 PUBLISHED 的数量(应为0):', products.filter((p) => p.has_attribute_warnings === 'yes' && p.status === 'PUBLISHED').length);

// 各来源表数量
const srcSheets = new Set();
for (const p of products) for (const s of String(p.source_sheet).split(' | ')) srcSheets.add(s);
console.log('产品来源表数:', srcSheets.size);

// 第一批前 20 的核对表
console.log('\n--- 第一批前 20（核对报告 9.2 表格）---');
for (const b of batch.slice(0, 20)) {
  const srcCount = String(b.source_sheet).split(' | ').length;
  console.log(`${b.rank}\t${b.bowen_no}\tOE=${b.oe_count}\tT=${b.opening_temperature_c}\tD=${b.dimensions}\tsrc=${srcCount}\tM=${String(b.vehicle_make).slice(0, 70)}`);
}
