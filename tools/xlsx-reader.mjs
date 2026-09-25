// Generic XLSX reader using only Node built-ins.
// Produces: sheet list, and cell values per sheet (as string matrix).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found');
  let count = buf.readUInt16LE(eocd + 10);
  let cdSize = buf.readUInt32LE(eocd + 12);
  let off = buf.readUInt32LE(eocd + 16);
  // ZIP64 fallback
  if (off === 0xffffffff || count === 0xffff) {
    const z64loc = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
    if (z64loc > 0) {
      const z64off = Number(buf.readBigUInt64LE(z64loc + 8));
      if (buf.readUInt32LE(z64off) === 0x06064b50) {
        count = Number(buf.readBigUInt64LE(z64off + 32));
        off = Number(buf.readBigUInt64LE(z64off + 48));
      }
    }
  }
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length) break;
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad CDH at ' + off);
    const method = buf.readUInt16LE(off + 10);
    let compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    let localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // zip64 extra field
    if (compSize === 0xffffffff || localOff === 0xffffffff) {
      let e = off + 46 + nameLen;
      const eEnd = e + extraLen;
      while (e + 4 <= eEnd) {
        const hid = buf.readUInt16LE(e);
        const hsz = buf.readUInt16LE(e + 2);
        if (hid === 0x0001) {
          let p = e + 4;
          if (buf.readUInt32LE(off + 24) === 0xffffffff) p += 8; // uncompressed
          if (compSize === 0xffffffff) { compSize = Number(buf.readBigUInt64LE(p)); p += 8; }
          if (localOff === 0xffffffff) { localOff = Number(buf.readBigUInt64LE(p)); p += 8; }
          break;
        }
        e += 4 + hsz;
      }
    }
    entries.set(name, { method, compSize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: [...entries.keys()],
    has: (n) => entries.has(n),
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lNameLen = buf.readUInt16LE(e.localOff + 26);
      const lExtraLen = buf.readUInt16LE(e.localOff + 28);
      const dataStart = e.localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + e.compSize);
      return e.method === 0 ? raw : zlib.inflateRawSync(raw);
    },
    text(name) { const d = this.read(name); return d ? d.toString('utf8') : null; },
  };
}

export function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

export function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function numToCol(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * 解析 OOXML 关系里的相对 Target。
 * Target 相对于「拥有该关系的部件」所在目录，而不是相对于 .rels 文件。
 *   baseDir 'xl/worksheets', target '../drawings/drawing1.xml'
 *     → 'xl/drawings/drawing1.xml'
 */
export function normalizePartPath(baseDir, target) {
  if (!target) return null;
  const segs = `${baseDir}/${target}`.split('/');
  const out = [];
  for (const s of segs) {
    if (!s || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
}

export class Workbook {
  constructor(filePath) {
    this.path = filePath;
    this.buf = fs.readFileSync(filePath);
    this.zip = readZip(this.buf);
    this.sheets = this.#parseSheets();
    this.shared = this.#parseSharedStrings();
    this.styles = this.#parseStyles();
  }

  #parseSheets() {
    const wb = this.zip.text('xl/workbook.xml');
    const rels = this.zip.text('xl/_rels/workbook.xml.rels');
    const relMap = new Map();
    const relRe = /<Relationship\b[^>]*>/g;
    let m;
    while ((m = relRe.exec(rels)) !== null) {
      const id = (m[0].match(/Id="([^"]+)"/) || [])[1];
      const tgt = (m[0].match(/Target="([^"]+)"/) || [])[1];
      if (id && tgt) relMap.set(id, tgt.replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
    const out = [];
    const shRe = /<sheet\b[^>]*\/?>/g;
    while ((m = shRe.exec(wb)) !== null) {
      const tag = m[0];
      const name = decodeXml((tag.match(/name="([^"]*)"/) || [])[1] || '');
      const sheetId = (tag.match(/sheetId="([^"]*)"/) || [])[1] || '';
      const rid = (tag.match(/r:id="([^"]*)"/) || [])[1] || '';
      const state = (tag.match(/state="([^"]*)"/) || [])[1] || 'visible';
      const target = relMap.get(rid) || '';
      out.push({ name, sheetId, rid, state, path: target ? 'xl/' + target : '' });
    }
    return out;
  }

  #parseSharedStrings() {
    const xml = this.zip.text('xl/sharedStrings.xml');
    if (!xml) return [];
    const out = [];
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml)) !== null) {
      const body = m[1];
      const parts = [];
      const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
      let t;
      while ((t = tRe.exec(body)) !== null) parts.push(decodeXml(t[1]));
      if (parts.length === 0) {
        // rich text runs without direct <t> wrappers caught above already; handle rPh etc.
        out.push('');
      } else out.push(parts.join(''));
    }
    return out;
  }

  #parseStyles() {
    const xml = this.zip.text('xl/styles.xml');
    if (!xml) return { numFmtByXf: [], dateXfs: new Set(), xfCount: 0 };
    // collect custom numFmts
    const customFmt = new Map();
    const nfRe = /<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"\s*\/>/g;
    let m;
    while ((m = nfRe.exec(xml)) !== null) customFmt.set(Number(m[1]), decodeXml(m[2]));
    const BUILTIN_DATE = new Set([14,15,16,17,18,19,20,21,22,45,46,47]);
    const isDateFmt = (id) => {
      if (BUILTIN_DATE.has(id)) return true;
      const c = customFmt.get(id);
      if (!c) return false;
      const stripped = c.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
      return /[yYdD]/.test(stripped) && !/^[#0.,%\s]*$/.test(stripped) ? /(y{1,4}|d{1,2}|m{3,}|h{1,2}:)/.test(stripped) : false;
    };
    const cellXfs = xml.match(/<cellXfs[\s\S]*?<\/cellXfs>/);
    const numFmtByXf = [];
    if (cellXfs) {
      const xfRe = /<xf\b[^>]*\/?>/g;
      let x;
      while ((x = xfRe.exec(cellXfs[0])) !== null) {
        const id = Number((x[0].match(/numFmtId="(\d+)"/) || [])[1] || 0);
        numFmtByXf.push({ numFmtId: id, isDate: isDateFmt(id) });
      }
    }
    return { numFmtByXf, xfCount: numFmtByXf.length };
  }

  /** Read a sheet as a sparse matrix of {r,c,v,type,formula,styleIdx} plus comments map. */
  readSheet(sheetPath) {
    const xml = this.zip.text(sheetPath);
    if (!xml) return { cells: [], maxRow: 0, maxCol: 0, hyperlinks: [], merges: [], comments: new Map() };
    const cells = [];
    let maxRow = 0, maxCol = 0;
    const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    let r;
    while ((r = rowRe.exec(xml)) !== null) {
      const rAttr = r[1];
      const rNum = Number((rAttr.match(/\br="(\d+)"/) || [])[1] || (maxRow + 1));
      const body = r[2];
      const cRe = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
      let c;
      while ((c = cRe.exec(body)) !== null) {
        const attr = c[1];
        const inner = c[3] || '';
        const ref = (attr.match(/\br="([A-Z]+)(\d+)"/) || []);
        const col = ref[1] || 'A';
        const rowN = Number(ref[2] || rNum);
        const t = (attr.match(/\bt="([^"]+)"/) || [])[1] || 'n';
        const s = Number((attr.match(/\bs="(\d+)"/) || [])[1] || -1);
        const fMatch = inner.match(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/);
        const formula = fMatch ? decodeXml(fMatch[1]) : null;
        let v = null;
        if (t === 'inlineStr') {
          const isM = inner.match(/<is>([\s\S]*?)<\/is>/);
          if (isM) {
            const parts = [];
            const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
            let tt;
            while ((tt = tRe.exec(isM[1])) !== null) parts.push(decodeXml(tt[1]));
            v = parts.join('');
          } else v = '';
        } else if (t === 's') {
          const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
          const idx = vM ? Number(decodeXml(vM[1])) : NaN;
          v = Number.isFinite(idx) ? (this.shared[idx] ?? '') : '';
        } else {
          const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
          v = vM ? decodeXml(vM[1]) : null;
        }
        const cNum = colToNum(col);
        cells.push({ row: rowN, col: cNum, colLetter: col, type: t, value: v, formula, styleIdx: s });
        if (rowN > maxRow) maxRow = rowN;
        if (cNum > maxCol) maxCol = cNum;
      }
    }
    const merges = [];
    const mRe = /<mergeCell\s+ref="([^"]+)"\s*\/>/g;
    let mm;
    while ((mm = mRe.exec(xml)) !== null) merges.push(mm[1]);
    const hyperlinks = [];
    const hRe = /<hyperlink\s+([^>]*)\/>/g;
    let h;
    while ((h = hRe.exec(xml)) !== null) {
      hyperlinks.push({
        ref: (h[1].match(/ref="([^"]+)"/) || [])[1],
        target: decodeXml((h[1].match(/r:id="([^"]+)"/) || [])[1] || ''),
        location: decodeXml((h[1].match(/location="([^"]+)"/) || [])[1] || ''),
        display: decodeXml((h[1].match(/display="([^"]+)"/) || [])[1] || ''),
      });
    }
    return { cells, maxRow, maxCol, merges, hyperlinks, comments: this.#parseComments(sheetPath) };
  }

  #parseComments(sheetPath) {
    const map = new Map();
    // OOXML rels 路径规则：<dir>/<name> → <dir>/_rels/<name>.rels
    // 注意：不是把 "xl/" 替换成 "xl/_rels/"。
    const dir = sheetPath.includes('/') ? sheetPath.slice(0, sheetPath.lastIndexOf('/')) : '';
    const base = sheetPath.slice(sheetPath.lastIndexOf('/') + 1);
    const relPath = `${dir}/_rels/${base}.rels`;
    const rels = this.zip.text(relPath);
    if (!rels) return map;
    // 关系里的 Target 基准是「拥有该关系的部件」所在目录，即 sheetPath 的目录
    const m = rels.match(/Target="([^"]*comments\d*\.xml)"/);
    if (!m) return map;
    const cPath = normalizePartPath(dir, m[1]);
    const xml = this.zip.text(cPath);
    if (!xml) return map;
    const cRe = /<comment\s+ref="([A-Z]+\d+)"[\s\S]*?<text>([\s\S]*?)<\/text>/g;
    let c;
    while ((c = cRe.exec(xml)) !== null) {
      const parts = [];
      const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
      let tt;
      while ((tt = tRe.exec(c[2])) !== null) parts.push(decodeXml(tt[1]));
      map.set(c[1], parts.join(''));
    }
    return map;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  // direct run: print sheet inventory
  const wb = new Workbook(process.argv[2]);
  console.log('FILE', process.argv[2]);
  console.log('zip entries:', wb.zip.names.length);
  console.log('sharedStrings:', wb.shared.length);
  console.log('style xfs:', wb.styles.xfCount);
  for (const s of wb.sheets) {
    console.log(`- "${s.name}" state=${s.state} path=${s.path}`);
  }
}
