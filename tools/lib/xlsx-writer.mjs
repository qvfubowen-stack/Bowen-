/**
 * 极简 XLSX 写出器（纯 Node.js，零第三方依赖）
 * ---------------------------------------------------------------------
 * 支持：多工作表、中文文本、表头样式、列宽、冻结窗格、自动筛选、
 *       单元格下拉菜单（dataValidation list）、超链接、数字/文本类型。
 *
 * 只写出 Excel 必需的最小组件集：
 *   [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml,
 *   xl/workbook.xml, xl/_rels/workbook.xml.rels, xl/styles.xml,
 *   xl/worksheets/sheetN.xml
 *
 * 字符串一律用 inlineStr，避免维护 sharedStrings 的复杂度。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

// =====================================================================
// 工具
// =====================================================================
const XML_ESC = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  // 去掉 XML 1.0 不允许的控制字符
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

export function colName(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// =====================================================================
// ZIP 写出（本地文件头 + 中央目录，deflate）
// =====================================================================
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(dataBuf);
    const comp = zlib.deflateRawSync(dataBuf, { level: 9 });
    const useStore = comp.length >= dataBuf.length;
    const payload = useStore ? dataBuf : comp;
    const method = useStore ? 0 : 8;

    // 本地文件头
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);            // version needed
    lh.writeUInt16LE(0x0800, 6);        // flag: UTF-8 文件名
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);            // time
    lh.writeUInt16LE(0x21, 12);         // date (1980-01-01)
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(payload.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    chunks.push(lh, nameBuf, payload);

    // 中央目录项
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(payload.length, 20);
    ch.writeUInt32LE(dataBuf.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// =====================================================================
// styles.xml —— 固定几个样式 id
// =====================================================================
// 0: 默认
// 1: 标题（大号加粗）
// 2: 表头（加粗 + 灰底 + 自动换行 + 居中）
// 3: 人工填写列（浅黄底，提示“这里要填”）
// 4: 人工填写列 - 下拉（浅绿底）
// 5: 警告（浅红底）
// 6: 正文自动换行 + 顶部对齐
// 7: 说明文字（斜体灰）
// 8: 数字右对齐
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="6">
<font><sz val="11"/><name val="Microsoft YaHei"/></font>
<font><b/><sz val="16"/><color rgb="FF1F3864"/><name val="Microsoft YaHei"/></font>
<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Microsoft YaHei"/></font>
<font><i/><sz val="10"/><color rgb="FF808080"/><name val="Microsoft YaHei"/></font>
<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Microsoft YaHei"/></font>
<font><sz val="11"/><color rgb="FF0000FF"/><u/><name val="Microsoft YaHei"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4E4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export const STYLE = { DEFAULT: 0, TITLE: 1, HEADER: 2, MANUAL: 3, MANUAL_LIST: 4, WARN: 5, BODY: 6, NOTE: 7, NUMBER: 8 };

// =====================================================================
// 工作表 XML
// =====================================================================
/**
 * sheet 定义：
 * {
 *   name: '工作表名',
 *   columns: [{ title, width, style }],
 *   rows: [ [cell, cell, ...], ... ]    // cell 可以是标量，或 {v, style, type, link}
 *   notes: [ '说明文字', ... ]           // 写在工作表顶部
 *   freeze: { row: N, col: M },         // 1-based；冻结该位置以上/以左
 *   validations: [{ sqref, values, promptTitle, prompt }]
 * }
 */
function sheetXml(sheet) {
  const cols = sheet.columns || [];
  const nCols = cols.length;
  const notes = sheet.notes || [];
  const rows = [];
  let r = 1;

  // 标题行（第一列）
  if (sheet.title) {
    rows.push({ r: r++, cells: [{ v: sheet.title, style: STYLE.TITLE }] });
  }
  // 说明行
  for (const n of notes) {
    rows.push({ r: r++, cells: [{ v: n, style: STYLE.NOTE }] });
  }
  // 表头
  const headerRow = r;
  rows.push({ r: r++, cells: cols.map((c) => ({ v: c.title, style: STYLE.HEADER })) });
  const firstDataRow = r;
  // 数据
  for (const dataRow of (sheet.rows || [])) {
    rows.push({ r: r++, cells: dataRow });
  }
  const lastDataRow = r - 1;

  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');

  // ⚠️ OOXML 对 worksheet 子元素顺序有严格要求，顺序必须是：
  //    sheetPr, dimension, sheetViews, sheetFormatPr, cols, sheetData,
  //    sheetCalcPr, sheetProtection, protectedRanges, scenarios, autoFilter,
  //    sortState, dataConsolidate, customSheetViews, mergeCells, phoneticPr,
  //    conditionalFormatting, dataValidations, hyperlinks, printOptions, pageMargins, ...
  // 顺序错了 Excel 会报"文件已损坏"，所以这里严格按序拼装。

  // sheetViews（冻结窗格）
  if (sheet.freeze) {
    const fr = sheet.freeze.row || 1;
    const fc = sheet.freeze.col || 0;
    const cellRef = `${colName(fc + 1)}${fr}`;
    const pane = fc > 0
      ? `<pane xSplit="${fc}" ySplit="${fr - 1}" topLeftCell="${cellRef}" activePane="bottomRight" state="frozen"/>`
      : `<pane ySplit="${fr - 1}" topLeftCell="${cellRef}" activePane="bottomLeft" state="frozen"/>`;
    parts.push(`<sheetViews><sheetView workbookViewId="0">${pane}<selection pane="${fc > 0 ? 'bottomRight' : 'bottomLeft'}" activeCell="${cellRef}" sqref="${cellRef}"/></sheetView></sheetViews>`);
  }

  // 列宽
  if (nCols) {
    parts.push('<cols>');
    cols.forEach((c, i) => {
      const w = c.width || 16;
      parts.push(`<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`);
    });
    parts.push('</cols>');
  }

  parts.push('<sheetData>');
  for (const row of rows) {
    const cells = row.cells || [];
    if (!cells.length) { parts.push(`<row r="${row.r}"/>`); continue; }
    parts.push(`<row r="${row.r}">`);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell === null || cell === undefined || cell === '') {
        const st = (cols[i] && cols[i].style) || 0;
        if (st) parts.push(`<c r="${colName(i + 1)}${row.r}" s="${st}"/>`);
        continue;
      }
      const obj = (typeof cell === 'object') ? cell : { v: cell };
      const st = obj.style !== undefined ? obj.style : 0;
      const ref = `${colName(i + 1)}${row.r}`;
      const sAttr = st ? ` s="${st}"` : '';
      if (obj.type === 'number' && obj.v !== '' && obj.v !== null && Number.isFinite(Number(obj.v))) {
        parts.push(`<c r="${ref}"${sAttr}><v>${Number(obj.v)}</v></c>`);
      } else if (obj.link) {
        parts.push(`<c r="${ref}"${sAttr} t="str"><f>HYPERLINK(&quot;${XML_ESC(obj.link)}&quot;,&quot;${XML_ESC(obj.v ?? obj.link)}&quot;)</f><v>${XML_ESC(obj.v ?? obj.link)}</v></c>`);
      } else {
        const txt = XML_ESC(obj.v);
        parts.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${txt}</t></is></c>`);
      }
    }
    parts.push('</row>');
  }
  parts.push('</sheetData>');

  // 自动筛选（必须紧跟在 sheetData 之后、dataValidations 之前）
  if (sheet.autoFilter && nCols && lastDataRow >= headerRow) {
    parts.push(`<autoFilter ref="A${headerRow}:${colName(nCols)}${lastDataRow}"/>`);
  }

  // 下拉菜单
  if (sheet.validations && sheet.validations.length) {
    parts.push('<dataValidations>');
    for (const v of sheet.validations) {
      // Excel 对列表公式有 255 字符上限
      const formula = `"${v.values.join(',')}"`;
      if (formula.length > 255) {
        throw new Error(`下拉列表过长（${formula.length} > 255 字符），工作表 "${sheet.name}"：请减少选项`);
      }
      parts.push(`<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" `
        + `errorTitle="输入无效" error="请从下拉列表中选择一个值" `
        + `promptTitle="${XML_ESC(v.promptTitle || '请选择')}" prompt="${XML_ESC(v.prompt || '')}" `
        + `sqref="${v.sqref}"><formula1>${XML_ESC(formula)}</formula1></dataValidation>`);
    }
    parts.push('</dataValidations>');
  }

  parts.push('</worksheet>');
  return parts.join('');
}

// =====================================================================
// 工作簿写出
// =====================================================================
export function writeXlsx(filePath, sheets) {
  const files = [];
  const nSheets = sheets.length;

  // [Content_Types].xml
  const overrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  files.push({
    name: '[Content_Types].xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${overrides}
</Types>`,
  });

  // _rels/.rels
  files.push({
    name: '_rels/.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  });

  // docProps
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push({
    name: 'docProps/core.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>博文外贸独立站 — 人工业务审核包</dc:title>
<dc:creator>Bowen B2B Website Project</dc:creator>
<cp:lastModifiedBy>Bowen B2B Website Project</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`,
  });
  files.push({
    name: 'docProps/app.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Bowen Review Package Builder</Application>
</Properties>`,
  });

  // xl/workbook.xml
  files.push({
    name: 'xl/workbook.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((s, i) => `<sheet name="${XML_ESC(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}
</sheets>
</workbook>`,
  });

  // xl/_rels/workbook.xml.rels
  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${nSheets + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });

  // styles
  files.push({ name: 'xl/styles.xml', data: STYLES_XML });

  // sheets
  sheets.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) });
  });

  fs.writeFileSync(filePath, makeZip(files));
  return { sheets: nSheets, bytes: fs.statSync(filePath).size };
}
