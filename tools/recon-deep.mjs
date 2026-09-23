// Deep-dive inventory: block layout per sheet, raw field samples, separator analysis.
import { Workbook, numToCol } from './xlsx-reader.mjs';

const wb = new Workbook(process.argv[2]);
const LAYOUTS = [
  { name: 'twoBlock12', blocks: [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]], price: false },
  { name: 'twoBlock14', blocks: [[1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14]], price: true },
];

const rawDumps = [];
for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const grid = new Map();
  for (const c of sh.cells) grid.set(c.row + ':' + c.col, c);
  const hdr = [];
  for (let c = 1; c <= Math.min(sh.maxCol, 14); c++) {
    const cell = grid.get(2 + ':' + c);
    hdr.push(numToCol(c) + '=' + (cell ? String(cell.value ?? '').replace(/\n/g, '\\n') : '-'));
  }
  console.log('='.repeat(100));
  console.log(`SHEET "${s.name}" rows=${sh.maxRow} cols=${sh.maxCol} merges=${JSON.stringify(sh.merges)} links=${sh.hyperlinks.length}`);
  console.log('  header r2: ' + hdr.join('  '));

  // block detection: layout with the most non-empty Bowen-No blocks
  let best = null;
  for (const L of LAYOUTS) {
    let n = 0;
    for (let r = 3; r <= sh.maxRow; r++) {
      for (const b of L.blocks) {
        const bnCell = grid.get(r + ':' + b[4]);
        const oemCell = grid.get(r + ':' + b[2]);
        if ((bnCell && String(bnCell.value ?? '').trim()) || (oemCell && String(oemCell.value ?? '').trim())) n++;
      }
    }
    if (!best || n > best.n) best = { n, L };
  }
  console.log(`  best layout: ${best.L.name}  nonEmptyBlocks=${best.n}`);

  // separator analysis on OEM cells
  let nlSep = 0, multiSpaceSep = 0, both = 0, singleLine = 0, total = 0;
  let withImageB = 0;
  for (let r = 3; r <= sh.maxRow; r++) {
    for (const b of best.L.blocks) {
      const oemCell = grid.get(r + ':' + b[2]);
      const v = oemCell && oemCell.value != null ? String(oemCell.value) : '';
      if (!v.trim()) continue;
      total++;
      const hasNL = /\n/.test(v.trim());
      const hasMS = / {2,}/.test(v.trim());
      if (hasNL && hasMS) both++;
      else if (hasNL) nlSep++;
      else if (hasMS) multiSpaceSep++;
      else singleLine++;
      const imgCell = grid.get(r + ':' + b[1]);
      if (imgCell && String(imgCell.value ?? '').trim()) withImageB++;
    }
  }
  console.log(`  OEM cells: total=${total} newlineOnly=${nlSep} multiSpaceOnly=${multiSpaceSep} both=${both} singleLine=${singleLine}`);
  console.log(`  blocks with text in Image col: ${withImageB}`);
  if (sh.hyperlinks.length) console.log('  hyperlinks: ' + JSON.stringify(sh.hyperlinks.slice(0, 5)));

  // samples of long OEM cells from the master sheet only
  if (s.name === 'Product Information') {
    for (let r = 3; r <= Math.min(sh.maxRow, 20); r++) {
      for (const b of best.L.blocks) {
        const oemCell = grid.get(r + ':' + b[2]);
        if (!oemCell) continue;
        rawDumps.push({ sheet: s.name, row: r, col: oemCell.colLetter, len: String(oemCell.value).length, value: String(oemCell.value) });
      }
    }
  }
}

console.log('\n\n' + '#'.repeat(100));
console.log('RAW OEM CELL VALUES (master sheet rows 3-20)');
for (const d of rawDumps) {
  console.log(`--- ${d.sheet} ${d.col}${d.row} len=${d.len}`);
  console.log(JSON.stringify(d.value));
}
