// Shared Excel layout detection for the v2 product workbook.
// Pure functions — no product knowledge, no guessing.
import { readFileSync } from 'node:fs';

export function headerKey(v) {
  return String(v ?? '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[（）()]/g, '');
}

const NO_COL = new Set(['序号']);
const PIC_COL = new Set(['图片']);
const OE_COL = new Set(['OEM号码', 'OEM']);
const VEH_COL = new Set(['适用车型/机型', '车型']);
const BOWEN_COL = new Set(['博文编号', '编号']);
const PRICE_COL = new Set(['单价']);
const TECH_COL = new Set(['技术参数', '温度']);

/** locate the header row of a sheet, or null when the sheet has no product table */
export function findHeaderRow(sh) {
  const byRow = groupByRow(sh.cells);
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    const keys = [...byRow.get(r).values()].map((c) => headerKey(c.value));
    if (keys.includes('OEM号码') || keys.includes('OEM')) return r;
  }
  return null;
}

export function groupByRow(cells) {
  const byRow = new Map();
  for (const c of cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, new Map());
    byRow.get(c.row).set(c.col, c);
  }
  return byRow;
}

/**
 * Split a header row into parallel record blocks (left block, right block, …).
 * Each block reports the column index of every field. Layout is discovered, never assumed.
 */
export function buildBlocks(headerCells, maxCol) {
  const cells = headerCells.slice().sort((a, b) => a.col - b.col);
  const blocks = [];
  let cur = null;
  const push = () => {
    if (cur && cur.oe && cur.bowen) blocks.push(cur);
    cur = null;
  };
  for (const c of cells) {
    const k = headerKey(c.value);
    if (NO_COL.has(k) || PIC_COL.has(k)) {
      if (cur && cur.oe) push();
      if (!cur) cur = { start: c.col, no: null, pic: null, oe: null, veh: null, bowen: null, price: null, tech: null };
      if (NO_COL.has(k)) cur.no = c.col; else cur.pic = c.col;
      continue;
    }
    if (!cur) continue;
    if (OE_COL.has(k) && !cur.oe) cur.oe = c.col;
    else if (VEH_COL.has(k) && !cur.veh) cur.veh = c.col;
    else if (BOWEN_COL.has(k) && !cur.bowen) cur.bowen = c.col;
    else if (PRICE_COL.has(k) && !cur.price) cur.price = c.col;
    else if (TECH_COL.has(k) && !cur.tech) cur.tech = c.col;
  }
  push();
  return blocks.map((b) => {
    const last = Math.max(...[b.oe, b.veh, b.bowen, b.price, b.tech].filter((x) => x != null));
    return { ...b, end: Math.min(maxCol, last) };
  });
}

/**
 * 人工区段标签 = 落在记录区块列范围内、同一行没有任何记录数据的一格短文本。
 *
 * 重要裁决：区段标签是「按行」生效的，不是「按列块」生效的。
 * 综合产品信息表把一条产品区段横跨左右两个并列区块（A–F / G–L），
 * 但业务方只在其中一个区块写一次标签（例如 R139 只在 B 列写「冷却水管」）。
 * 因此同一行以下的所有记录区块都受该标签管辖。这里把标签的管辖区间记为
 * 「所有区块」，而不是只记它自己所在的区块。
 */
export function findSectionLabels(sh, headerRow, blocks) {
  const byRow = groupByRow(sh.cells);
  const out = [];
  if (!blocks.length) return out;
  const regionStart = Math.min(...blocks.map((b) => b.start));
  const regionEnd = Math.max(...blocks.map((b) => b.end));
  for (const [r, m] of [...byRow].sort((a, b) => a[0] - b[0])) {
    if (r <= headerRow) continue;
    const nonEmpty = [...m.entries()].filter(([, c]) => c.value != null && String(c.value).trim() !== '');
    if (nonEmpty.length !== 1) continue;
    const [col, cell] = nonEmpty[0];
    if (col < regionStart || col > regionEnd) continue;
    const text = String(cell.value).trim();
    if (!text || text.length > 20) continue;
    out.push({
      sheet_row: r, column: col, text,
      governs_block_starts: blocks.map((b) => b.start),
    });
  }
  return out;
}

/** 管辖某条记录的人工区段标签（同一行以下、最近的一个） */
export function labelFor(labels, block, row) {
  const governing = labels.filter(
    (l) => l.governs_block_starts.includes(block.start) && l.sheet_row < row,
  );
  if (!governing.length) return null;
  return governing[governing.length - 1];
}

/**
 * 辅助表（工作表1）的编号列里混进了「天博编号」式的孤立数字，整行没有 OE 也没有车型。
 * 这类行不是产品记录，本阶段不入库（原始单元格仍完整保存在 staging 里）。
 */
export function isAuxiliaryLabelRow(rec, auxSheets) {
  if (!auxSheets.includes(rec.source_sheet)) return false;
  const hasOe = String(rec.oe_cell_raw ?? '').trim() !== '';
  const hasVeh = String(rec.vehicle_cell_raw ?? '').trim() !== '';
  return !hasOe && !hasVeh;
}

/** whitespace/newline splitter used for OE cells (raw text is never rewritten) */
export const TOKEN_SPLIT_RE = /[\s\u3000]+/;

export function readJsonIfExists(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
