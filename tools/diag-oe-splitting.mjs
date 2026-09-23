// 诊断：单个空格到底该不该当作 OE 分隔符？
import { Workbook } from './xlsx-reader.mjs';
import { splitOeCell, looksLikeOeNumber, normalizeOeNumber } from './lib/normalize.mjs';

const wb = new Workbook(process.argv[2]);
const samples = { newline: [], multiSpace: [], singleSpaceOnly: [] };
let cellsWithSingleSpaceInsideToken = 0;
let totalOeCells = 0;

const LAYOUTS = {
  'Product Information': { blocks: [[3, 5], [9, 11]], firstRow: 4 },
  default12: { blocks: [[3, 5], [9, 11]], firstRow: 3 },
  default14: { blocks: [[3, 5], [10, 12]], firstRow: 3 },
  Sheet1: { blocks: [[2, 4]], firstRow: 2 },
};

for (const s of wb.sheets) {
  const sh = wb.readSheet(s.path);
  const grid = new Map();
  for (const c of sh.cells) grid.set(c.row + ':' + c.col, c);
  const hdr = [];
  for (let c = 1; c <= Math.min(sh.maxCol, 20); c++) {
    const cell = grid.get('2:' + c);
    hdr.push(cell ? String(cell.value ?? '').toLowerCase() : '');
  }
  let L;
  if (s.name === 'Product Information') L = LAYOUTS['Product Information'];
  else if (s.name === 'Sheet1') L = LAYOUTS.Sheet1;
  else if (hdr.some((h) => h.includes('unit price')) || sh.maxCol >= 14) L = LAYOUTS.default14;
  else L = LAYOUTS.default12;

  for (let r = L.firstRow; r <= sh.maxRow; r++) {
    for (const [oemCol] of L.blocks) {
      const cell = grid.get(r + ':' + oemCol);
      if (!cell || cell.value == null) continue;
      const v = String(cell.value);
      if (!v.trim()) continue;
      totalOeCells++;
      const kind = /[\r\n]/.test(v) ? 'newline' : / {2,}/.test(v) ? 'multiSpace' : / /.test(v.trim()) ? 'singleSpaceOnly' : null;
      if (kind && samples[kind].length < 40) samples[kind].push({ sheet: s.name, row: r, v });
      if (kind === 'singleSpaceOnly' || kind === 'multiSpace') {
        // 统计“拆完之后每段都还是不是 OE 长相”
        const parts = splitOeCell(v);
        const nonLooking = parts.filter((p) => !looksLikeOeNumber(p.raw));
        if (nonLooking.length) cellsWithSingleSpaceInsideToken++;
      }
    }
  }
}

console.log(`总 OEM 单元格数: ${totalOeCells}`);
console.log(`拆分后出现“不像 OE 号”片段的单元格数: ${cellsWithSingleSpaceInsideToken}`);
for (const k of ['newline', 'multiSpace', 'singleSpaceOnly']) {
  console.log('\n' + '='.repeat(90));
  console.log(`### 分隔类型 = ${k}  (样本 ${samples[k].length})`);
  for (const x of samples[k].slice(0, 18)) {
    console.log(`--- ${x.sheet} r${x.row}`);
    console.log('    RAW : ' + JSON.stringify(x.v));
    console.log('    SPLIT: ' + JSON.stringify(splitOeCell(x.v).map((p) => p.raw)));
  }
}
