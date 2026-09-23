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
const b = parseCsv(fs.readFileSync(path.join(ROOT, 'data/derived/first-batch-published.csv'), 'utf8'));
for (const rank of (process.argv.slice(2).length ? process.argv.slice(2) : ['11', '13']).map(Number)) {
  const r = b.find((x) => Number(x.rank) === rank);
  if (!r) { console.log('rank', rank, 'not found'); continue; }
  console.log('=== rank', rank, '| bowen', r.bowen_no, '===');
  console.log('  source_sheet:', r.source_sheet);
  console.log('  source_row  :', r.source_row);
  console.log('  oe_count    :', r.oe_count);
  console.log('  temperature :', r.opening_temperature_c);
  console.log('  dimensions  :', r.dimensions);
  console.log('  vehicle_make:', r.vehicle_make);
  console.log('  oe_all_norm :', String(r.oe_all_normalized).slice(0, 400));
  console.log('  app_notes   :', String(r.application_notes).slice(0, 400));
  console.log('');
}
