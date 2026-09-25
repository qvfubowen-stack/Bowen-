// List every distinct single-cell "section label" candidate across the workbook.
// A section label = a text-only cell in the label columns (A or B) with no record data beside it.
import { Workbook } from '../xlsx-reader.mjs';
const wb = new Workbook(process.argv[2]);

const CN = /[\u4e00-\u9fff]/;

for (let i = 0; i < wb.sheets.length; i++) {
  const s = wb.sheets[i];
  const sh = wb.readSheet(s.path);
  const byRow = new Map();
  for (const c of sh.cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c);
  }
  const labels = [];
  for (const [r, m] of [...byRow].sort((a, b) => a[0] - b[0])) {
    for (const col of [1, 2]) {
      const cell = m.get(col);
      if (!cell) continue;
      const v = cell.value;
      if (v == null) continue;
      const t = String(v).trim();
      if (!t) continue;
      if (!CN.test(t)) continue;
      if (t.length > 12) continue;
      // a label row has no numeric record data in the other record columns
      const others = [...m.entries()].filter(([c]) => c !== col);
      const hasData = others.some(([, o]) => {
        const ov = o.value;
        if (ov == null) return false;
        const os = String(ov).trim();
        return os !== '' && os !== ' ';
      });
      if (hasData) continue;
      labels.push({ row: r, col, text: t });
    }
  }
  console.log(`SHEET ${i} "${s.name}": ` + (labels.length ? labels.map((l) => `R${l.row}/col${l.col}="${l.text}"`).join('  ') : '(none)'));
}
