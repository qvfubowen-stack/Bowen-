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
const raw = parseCsv(fs.readFileSync(path.join(ROOT, 'data/derived/staging-records.raw.csv'), 'utf8'));
let catalog = 0, supp = 0;
for (const r of raw) { if (r.sheet_kind === 'supplement') supp++; else catalog++; }
console.log('目录记录(master+brand):', catalog, ' 报告写 693 ->', catalog === 693);
console.log('Sheet1 记录:', supp, ' 报告写 277 ->', supp === 277);
console.log('合计:', raw.length, ' 报告写 970 ->', raw.length === 970);

const oeRows = parseCsv(fs.readFileSync(path.join(ROOT, 'data/derived/product-oe-index.csv'), 'utf8'));
// 验证 25500-35540 与 2550035540 落在同一个 oe_match_key
const g = new Map();
for (const o of oeRows) {
  if (!g.has(o.oe_match_key)) g.set(o.oe_match_key, new Set());
  g.get(o.oe_match_key).add(o.oe_number_raw);
}
const k = '2550035540';
console.log(`\nOE 归一化验证: match_key=${k} 覆盖的原始写法 =`, JSON.stringify([...(g.get(k) || [])]));

// 验证最大拆分单元格
const byCell = new Map();
for (const o of oeRows) {
  for (const c of String(o.source_cells).split(' | ')) {
    if (!byCell.has(c)) byCell.set(c, new Set());
    byCell.get(c).add(o.oe_number_normalized);
  }
}
const top = [...byCell.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);
console.log('\n拆分出 OE 最多的单元格 Top 5:');
for (const [c, s] of top) console.log(`  ${c}: ${s.size} 个`);

// 时间/尺寸提取抽查
const products = parseCsv(fs.readFileSync(path.join(ROOT, 'data/derived/products.csv'), 'utf8'));
console.log('\n带温度的产品数:', products.filter((p) => p.opening_temperature_c).length, '(报告写 250)');
console.log('带尺寸的产品数:', products.filter((p) => p.dimensions).length, '(报告写 97)');
const tempSample = products.filter((p) => p.opening_temperature_c).slice(0, 12)
  .map((p) => `${p.bowen_no}:${p.opening_temperature_c}`);
console.log('温度抽样:', tempSample.join('  '));
const dimSample = products.filter((p) => p.dimensions).slice(0, 8).map((p) => `${p.bowen_no}:${p.dimensions}`);
console.log('尺寸抽样:', dimSample.join('  '));
// 检查有没有把 bar 误当温度
const badTemp = products.filter((p) => /bar/i.test(p.opening_temperature_c || ''));
console.log('温度字段里混入 bar 的:', badTemp.length, '(应为 0)');
const barProducts = products.filter((p) => /bar/i.test(p.specifications_raw || '')).slice(0, 5)
  .map((p) => `${p.bowen_no}->${p.opening_temperature_c || '(空)'} raw=${String(p.specifications_raw).slice(0, 40)}`);
console.log('压力类规格处理抽样:'); for (const x of barProducts) console.log('  ', x);
