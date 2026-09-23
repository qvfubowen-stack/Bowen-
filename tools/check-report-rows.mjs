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
function readReview(f) {
  const all = parseCsv(fs.readFileSync(f, 'utf8'));
  const data = all.filter((r) => !String(r[0] || '').startsWith('#') && r.length > 1);
  const header = data.shift();
  return data.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const rows = readReview(path.join(ROOT, 'review/first-72-products-review.csv'));

// Excel 行号 = 图例行数 + 1(表头) + review_rank
// 统计图例行数
const rawAll = parseCsv(fs.readFileSync(path.join(ROOT, 'review/first-72-products-review.csv'), 'utf8'));
const legendCount = rawAll.filter((r) => String(r[0] || '').startsWith('#')).length;
const headerRowInFile = legendCount + 1;
console.log(`图例行数=${legendCount} 表头在第 ${headerRowInFile} 行 → Excel 行号 = review_rank + ${headerRowInFile}`);

console.log('\n报告引用的行号核对（报告用 Excel 行号）：');
const claimed = { 31: '3001', 38: '3028', 41: '3582', 45: '3334', 50: '3555', 55: '3012', 56: '3024', 65: '3013', 66: '3014', 67: '3340' };
for (const [excelRowStr, bowen] of Object.entries(claimed)) {
  const rank = Number(excelRowStr) - headerRowInFile;
  const r = rows.find((x) => Number(x.review_rank) === rank);
  const got = r ? r.bowen_no : '(无)';
  console.log(`  Excel 行 ${excelRowStr} (=rank ${rank}) 报告写 ${bowen}，实际 ${got} ${got === bowen ? 'OK' : '<<< 不符'}`);
}

console.log('\n错位 3 个的行号：');
const mis = readReview(path.join(ROOT, 'review/row-misalignment-review.csv'));
for (const r of mis.filter((x) => x.in_first_batch === 'yes')) {
  const m = rows.find((x) => x.product_id === r.product_id);
  console.log(`  bowen=${r.bowen_no} 主表 rank=${m?.review_rank} Excel行=${Number(m?.review_rank) + headerRowInFile} severity=${r.severity}`);
}
