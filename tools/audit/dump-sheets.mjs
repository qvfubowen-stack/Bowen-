// Dump every sheet of an XLSX to a per-sheet TSV-ish text file for offline inspection.
import fs from 'node:fs';
import path from 'node:path';
import { Workbook, numToCol } from '../xlsx-reader.mjs';

const FILE = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

const wb = new Workbook(FILE);
const index = [];
for (let i = 0; i < wb.sheets.length; i++) {
  const s = wb.sheets[i];
  const sh = wb.readSheet(s.path);
  const lines = [];
  lines.push(`# SHEET "${s.name}" rows=${sh.maxRow} cols=${sh.maxCol} cells=${sh.cells.length}`);
  const byRow = new Map();
  for (const c of sh.cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  for (const r of rows) {
    const m = byRow.get(r);
    const cols = [...m.keys()].sort((a, b) => a - b);
    const parts = cols.map((c) => `${numToCol(c)}${r}=${JSON.stringify(m.get(c).value)}`);
    lines.push(parts.join('\t'));
  }
  const f = path.join(OUT, `sheet-${String(i).padStart(2, '0')}-${s.name}.txt`);
  fs.writeFileSync(f, lines.join('\n'), 'utf8');
  index.push({ i, name: s.name, rows: sh.maxRow, cols: sh.maxCol, cells: sh.cells.length, file: f });
}
fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify(index, null, 2), 'utf8');
for (const e of index) console.log(`${String(e.i).padStart(2)} ${e.name}  rows=${e.rows} cols=${e.cols} cells=${e.cells}`);
console.log('written to', OUT);
