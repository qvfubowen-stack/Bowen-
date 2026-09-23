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
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));

const oes = readCsv('product-oe-index.csv');
const batch = readCsv('first-batch-published.csv');
const products = readCsv('products.csv');
const byId = new Map(products.map((p) => [p.product_id, p]));
const batchIds = new Set(batch.map((b) => b.product_id));

// 定义 A：该 OE 被 >=2 个"全库"产品引用，且本产品是其中之一
const groups = new Map();
for (const o of oes) {
  if (!groups.has(o.oe_match_key)) groups.set(o.oe_match_key, new Set());
  groups.get(o.oe_match_key).add(o.product_id);
}
const anyShared = new Map();       // product -> count of shared OEs (partner 可以是任意产品)
const batchShared = new Map();     // product -> count of shared OEs (partner 必须是第一批产品)
for (const [k, pids] of groups) {
  if (pids.size < 2) continue;
  const bIn = [...pids].filter((p) => batchIds.has(p));
  for (const pid of pids) {
    if (!anyShared.has(pid)) anyShared.set(pid, []);
    anyShared.get(pid).push(k);
  }
  if (bIn.length >= 2) {
    for (const pid of bIn) {
      if (!batchShared.has(pid)) batchShared.set(pid, []);
      batchShared.get(pid).push(k);
    }
  }
}
const A = batch.filter((b) => anyShared.has(b.product_id)).length;
const B = batch.filter((b) => batchShared.has(b.product_id)).length;
console.log(`定义A 与任意产品共享 OE 的第一批产品数: ${A}`);
console.log(`定义B 仅与第一批内其他产品共享 OE 的第一批产品数: ${B}`);

// 非第一批的共享对象是谁？
let partnerNotBatch = 0, partnerBatch = 0;
for (const b of batch) {
  for (const k of (anyShared.get(b.product_id) || [])) {
    const others = [...groups.get(k)].filter((p) => p !== b.product_id);
    if (others.some((p) => batchIds.has(p))) partnerBatch++;
    if (others.some((p) => !batchIds.has(p))) partnerNotBatch++;
  }
}
console.log(`\n第一批产品的共享 OE 中：`);
console.log(`  与第一批内其他产品共享的次数: ${partnerBatch}`);
console.log(`  与第一批之外产品共享的次数: ${partnerNotBatch}`);
console.log(`  （同一个 OE 可能同时与两类共享）`);

// 明细抽样
console.log('\n第一批中"仅与第一批之外产品共享 OE"的例子：');
let n = 0;
for (const b of batch) {
  const onlyOutside = (anyShared.get(b.product_id) || []).filter((k) =>
    ![...groups.get(k)].some((p) => p !== b.product_id && batchIds.has(p)));
  if (!onlyOutside.length) continue;
  if (n++ >= 6) break;
  const k = onlyOutside[0];
  console.log(`  ${b.bowen_no} 的 OE ${k} 同时被: ${[...groups.get(k)].map((p) => byId.get(p)?.bowen_no).join(' / ')}`);
}
