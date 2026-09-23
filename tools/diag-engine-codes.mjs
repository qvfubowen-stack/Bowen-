import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEngineCodes, extractDisplacements } from './lib/normalize.mjs';

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
const raw = parseCsv(fs.readFileSync(path.join(ROOT, 'data', 'derived', 'staging-records.raw.csv'), 'utf8'));

const counter = new Map();
for (const r of raw) {
  for (const c of extractEngineCodes(r.vehicle_raw)) counter.set(c, (counter.get(c) || 0) + 1);
}
const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1]);
console.log(`发动机代码候选 token 总数(去重): ${sorted.length}`);
console.log('\n出现频次 Top 120：');
console.log(sorted.slice(0, 120).map(([k, v]) => `${k}:${v}`).join('  '));

const disp = new Map();
for (const r of raw) for (const d of extractDisplacements(r.vehicle_raw)) disp.set(d, (disp.get(d) || 0) + 1);
console.log('\n排量候选：');
console.log([...disp.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
