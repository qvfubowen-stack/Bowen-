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
const products = parseCsv(fs.readFileSync(path.join(D, 'products.csv'), 'utf8'));
const v2 = parseCsv(fs.readFileSync(path.join(D, 'products-v2.csv'), 'utf8'));

const hasDim = (r) => /\d\s*[*x×]\s*\d/.test(String(r || ''));
const hasUnit = (r) => /[℃°]|\d\s*(mm|bar)\b/i.test(String(r || ''));
const twoNum = (r) => (String(r || '').match(/\d{3,}/g) || []).length > 1;

let cDim = 0, cUnit = 0, cTwo = 0, cSheet1NoApp = 0, cPressure = 0, cParen = 0;
const dimList = [], unitList = [];
for (const p of products) {
  const raws = String(p.bowen_no_raw || '').split(' | ');
  if (raws.some(hasDim)) { cDim++; dimList.push(`${p.bowen_no} raw="${p.bowen_no_raw}"`); }
  if (raws.some(hasUnit)) { cUnit++; unitList.push(`${p.bowen_no} raw="${p.bowen_no_raw}"`); }
  if (raws.some(twoNum)) cTwo++;
  if (String(p.source_sheet || '').includes('Sheet1') && !String(p.application_notes || '').trim()) cSheet1NoApp++;
  if (/\d\s*(bar|kPa|psi)\b/i.test(String(p.specifications_raw || '')) && p.opening_temperature_c) cPressure++;
  if (/[（(]/.test(String(p.bowen_no_raw || ''))) cParen++;
}
console.log('各规则命中数：');
console.log('  尺寸进入编号列:', cDim);
console.log('  温度/单位进入编号列:', cUnit);
console.log('  编号列两个编号:', cTwo);
console.log('  Sheet1 无车型信息:', cSheet1NoApp, '<<< 这不是错位，是 Sheet1 表结构本身没有车型列');
console.log('  温度与压力并存:', cPressure);
console.log('  编号含括号:', cParen);

console.log('\n尺寸进入编号列的明细:');
for (const x of dimList) console.log('  ', x);
console.log('\n温度/单位进入编号列的明细:');
for (const x of unitList) console.log('  ', x);

// v2 状态分布
const st = {};
for (const r of v2) st[r.publish_status] = (st[r.publish_status] || 0) + 1;
console.log('\nproducts-v2 状态分布:', JSON.stringify(st));

// 被 blocked 的 85 个里，有多少是因为 Sheet1 规则
const blockedBySheet1 = v2.filter((r) => r.blocked === 'true' && String(r.blocked_reason).includes('OE / application 列错位'));
console.log('因 Sheet1 规则被 blocked 的:', blockedBySheet1.length);
const blockedByReal = v2.filter((r) => r.blocked === 'true' && !String(r.blocked_reason).includes('OE / application 列错位'));
console.log('因真实错位被 blocked 的:', blockedByReal.length);
