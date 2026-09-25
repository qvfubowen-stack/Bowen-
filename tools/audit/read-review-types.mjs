// Read the hand-entered Confirmed Product Type values from the Phase 2 review workbook.
import { Workbook } from '../xlsx-reader.mjs';
const wb = new Workbook(process.argv[2]);
const s = wb.sheets.find((x) => x.name === '第一批产品审核表');
const sh = wb.readSheet(s.path);
const byRow = new Map();
for (const c of sh.cells) {
  if (!byRow.has(c.row)) byRow.set(c.row, new Map());
  byRow.get(c.row).set(c.col, c);
}
const hdr = byRow.get(5);
const colOf = {};
for (const [c, cell] of hdr) colOf[String(cell.value).trim()] = c;
const cBowen = colOf['Bowen No.'];
const cType = colOf['Confirmed Product Type'];
const cReviewer = colOf['Reviewer'];
const cDate = colOf['Review Date'];
const cNotes = colOf['Notes'];
console.log('columns:', JSON.stringify(colOf));
const filled = [];
for (const [r, m] of [...byRow].sort((a, b) => a[0] - b[0])) {
  if (r <= 5) continue;
  const t = m.get(cType)?.value;
  if (t != null && String(t).trim() !== '') {
    filled.push({
      row: r,
      bowen_no: m.get(cBowen)?.value ?? null,
      confirmed_product_type: t,
      reviewer: cReviewer ? m.get(cReviewer)?.value ?? null : null,
      review_date: cDate ? m.get(cDate)?.value ?? null : null,
      notes: cNotes ? m.get(cNotes)?.value ?? null : null,
    });
  }
}
console.log('\nFILLED ROWS:', filled.length);
for (const f of filled) console.log(JSON.stringify(f));
