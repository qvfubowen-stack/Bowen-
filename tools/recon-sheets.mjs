// Structural recon of the source workbook: per-sheet dimensions, header candidates, sample rows.
import { Workbook, numToCol } from './xlsx-reader.mjs';

const wb = new Workbook(process.argv[2]);
const only = process.argv[3] || null;

for (const s of wb.sheets) {
  if (only && s.name !== only) continue;
  const { cells, maxRow, maxCol, merges, hyperlinks } = wb.readSheet(s.path);
  const byRow = new Map();
  for (const c of cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, []);
    byRow.get(c.row).push(c);
  }
  console.log('='.repeat(90));
  console.log(`SHEET "${s.name}"  rows=${maxRow} cols=${maxCol} (${numToCol(maxCol)}) cells=${cells.length} merges=${merges.length} links=${hyperlinks.length}`);
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const show = rows.slice(0, 14);
  for (const rn of show) {
    const row = byRow.get(rn).sort((a, b) => a.col - b.col);
    const parts = row.map((c) => {
      const val = c.value === null ? '' : String(c.value);
      return `${c.colLetter}=${JSON.stringify(val).slice(0, 60)}`;
    });
    console.log(`  r${rn}: ` + parts.join(' '));
  }
  if (rows.length > 14) console.log(`  ... (${rows.length - 14} more rows)`);
}
