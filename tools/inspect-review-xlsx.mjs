/**
 * XLSX 审核包读回检查：确认文件结构、中文、下拉菜单、关键内容都正确。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from './xlsx-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'review');

const FILES = ['first-batch-business-review', 'oe-cross-sheet-review',
  'bowen-number-variant-review', 'row-misalignment-review'];

for (const f of FILES) {
  const p = path.join(REVIEW, f + '.xlsx');
  const wb = new Workbook(p);
  console.log('='.repeat(88));
  console.log(`FILE ${f}.xlsx  (${(fs.statSync(p).size / 1024).toFixed(1)} KB, ${wb.sheets.length} 个工作表)`);
  for (const s of wb.sheets) {
    const sh = wb.readSheet(s.path);
    const xml = wb.zip.text(s.path);
    const dvs = (xml.match(/<dataValidation /g) || []).length;
    const grid = new Map();
    for (const c of sh.cells) grid.set(c.row + ':' + c.col, c.value);
    // 找表头行（含多个非空单元格的那一行）
    let headerRow = 0;
    for (let r = 1; r <= Math.min(sh.maxRow, 40); r++) {
      let n = 0;
      for (let c = 1; c <= sh.maxCol; c++) if (String(grid.get(r + ':' + c) ?? '').trim()) n++;
      if (n >= 3) { headerRow = r; break; }
    }
    const hdrs = [];
    for (let c = 1; c <= sh.maxCol; c++) hdrs.push(String(grid.get(headerRow + ':' + c) ?? ''));
    const title = String(grid.get('1:1') ?? '').slice(0, 60);
    console.log(`  - "${s.name}"  ${sh.maxRow}行 × ${sh.maxCol}列  下拉=${dvs}  冻结=${/state="frozen"/.test(xml)}  筛选=${/<autoFilter/.test(xml)}`);
    console.log(`      标题: ${title}`);
    console.log(`      表头(第${headerRow}行): ${hdrs.filter(Boolean).slice(0, 12).join(' | ')}`);
    // 第一数据行抽样
    if (sh.maxRow > headerRow) {
      const sample = [];
      for (let c = 1; c <= Math.min(sh.maxCol, 8); c++) {
        let v = String(grid.get((headerRow + 1) + ':' + c) ?? '');
        if (v.length > 28) v = v.slice(0, 28) + '…';
        sample.push(v);
      }
      console.log(`      首行数据: ${sample.join(' | ')}`);
    }
  }
}
console.log('='.repeat(88));
