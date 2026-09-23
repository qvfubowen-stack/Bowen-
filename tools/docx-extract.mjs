// Extract readable text (+ tables) from a .docx using only Node built-ins.
// Usage: node tools/docx-extract.mjs <input.docx> <output.txt>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node docx-extract.mjs <in.docx> <out.txt>');
  process.exit(1);
}

/** Minimal ZIP reader: find central directory, inflate raw entries. */
function readZipEntries(buf) {
  const entries = new Map();
  // locate End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad CDH at ' + off);
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // local header
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, { method, raw });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryText(entries, name) {
  const e = entries.get(name);
  if (!e) return null;
  const data = e.method === 0 ? e.raw : zlib.inflateRawSync(e.raw);
  return data.toString('utf8');
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

const buf = fs.readFileSync(input);
const entries = readZipEntries(buf);
const doc = entryText(entries, 'word/document.xml');
if (!doc) throw new Error('word/document.xml missing');

// Walk top-level body children: paragraphs and tables, preserving order.
const bodyMatch = doc.match(/<w:body>([\s\S]*)<\/w:body>/);
const body = bodyMatch ? bodyMatch[1] : doc;

const tokens = [];
const tagRe = /<w:(p|tbl)(?:\s[^>]*)?>|<\/w:(p|tbl)>/g;
// simple depth scanner over top-level elements
let i = 0, depth = 0, startIdx = -1, curKind = null;
const blocks = [];
const re = /<(\/?)w:(p|tbl)(\s[^>]*?)?(\/?)>/g;
let m;
while ((m = re.exec(body)) !== null) {
  const closing = m[1] === '/';
  const selfClose = m[4] === '/';
  const kind = m[2];
  if (selfClose) { continue; }
  if (!closing) {
    if (depth === 0) { startIdx = m.index; curKind = kind; }
    depth++;
  } else {
    depth--;
    if (depth === 0 && startIdx >= 0) {
      const end = m.index + m[0].length;
      blocks.push({ kind: curKind, xml: body.slice(startIdx, end) });
      startIdx = -1; curKind = null;
    }
  }
}

function paraText(pXml) {
  // keep tabs and breaks as separators
  let s = pXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n');
  const parts = [];
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let mm;
  while ((mm = tRe.exec(s)) !== null) parts.push(decodeXml(mm[1]));
  return parts.join('').replace(/[ \t]+$/g, '');
}

function paraStyle(pXml) {
  const m1 = pXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
  const outline = pXml.match(/<w:outlineLvl\s+w:val="(\d+)"/);
  return { style: m1 ? m1[1] : '', outline: outline ? Number(outline[1]) : null };
}

function tableRows(tblXml) {
  const rows = [];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let tr;
  while ((tr = trRe.exec(tblXml)) !== null) {
    const cells = [];
    const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let tc;
    while ((tc = tcRe.exec(tr[1])) !== null) {
      const cellParas = [];
      const pRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
      let pp;
      while ((pp = pRe.exec(tc[1])) !== null) cellParas.push(paraText(pp[1]));
      cells.push(cellParas.join(' ').trim());
    }
    rows.push(cells);
  }
  return rows;
}

const out = [];
let tblCount = 0;
for (const b of blocks) {
  if (b.kind === 'p') {
    const txt = paraText(b.xml);
    if (txt.trim() === '') continue;
    const { style, outline } = paraStyle(b.xml);
    let prefix = '';
    const sm = style.match(/^(\d+)$/);
    if (outline !== null) prefix = '#'.repeat(Math.min(outline + 1, 6)) + ' ';
    else if (sm) prefix = '#'.repeat(Math.min(Number(style), 6)) + ' ';
    else if (/Heading/i.test(style)) prefix = '## ';
    out.push(prefix + txt);
  } else {
    tblCount++;
    const rows = tableRows(b.xml);
    out.push(`\n[TABLE ${tblCount}]`);
    for (const r of rows) out.push('| ' + r.map((c) => c.replace(/\n/g, ' / ')).join(' | ') + ' |');
    out.push(`[/TABLE ${tblCount}]\n`);
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, out.join('\n'), 'utf8');
console.log(`blocks=${blocks.length} tables=${tblCount} -> ${output}`);
