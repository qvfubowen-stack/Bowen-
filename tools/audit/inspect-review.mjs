// Inspect the hand-filled Phase 2 review workbook (did the business team fill any columns?).
import { Workbook } from '../xlsx-reader.mjs';
const wb = new Workbook(process.argv[2]);
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const byRow = new Map();
  for (const c of sh.cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c);
  }
  console.log(`\n=== SHEET "${s.name}" rows=${sh.maxRow} cols=${sh.maxCol} ===`);
  for (const r of [1, 2, 3, 4, 5]) {
    const m = byRow.get(r);
    if (!m) continue;
    const parts = [...m.keys()].sort((a, b) => a - b).map((c) => c + ':' + JSON.stringify(m.get(c).value));
    console.log(` R${r}: ${parts.join(' ')}`);
  }
  // count non-empty cells in each column beyond row 5
  const colCount = new Map();
  for (const [r, m] of byRow) {
    if (r <= 5) continue;
    for (const [c, cell] of m) {
      const v = cell.value;
      if (v != null && String(v).trim() !== '') colCount.set(c, (colCount.get(c) || 0) + 1);
    }
  }
  console.log(' non-empty cells below header, by column:', JSON.stringify([...colCount.entries()].sort((a, b) => a[0] - b[0])));
}
