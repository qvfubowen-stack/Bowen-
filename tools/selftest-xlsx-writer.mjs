/**
 * XLSX 写出器自测：写一个含中文、下拉菜单、冻结、筛选、超链接的文件，
 * 再用本项目自研的 xlsx-reader 读回来逐项核对。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { writeXlsx, STYLE } from './lib/xlsx-writer.mjs';
import { Workbook } from './xlsx-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'derived', '_selftest-writer.xlsx');

const TYPES = ['Automotive Thermostat', 'Thermostat Assembly', 'Thermostat Insert', 'Temperature Sensor',
  'Thermal Switch', 'Oil Pressure Warning Switch', 'Reverse Light Switch', 'Brake Light Switch', 'Other', 'Unknown'];
const YNU = ['Yes', 'No', 'Unknown'];

writeXlsx(OUT, [
  {
    name: '说明',
    title: '博文外贸独立站 — 审核包自测',
    columns: [{ title: '项目', width: 28 }, { title: '内容', width: 70 }],
    notes: [],
    rows: [
      ['本工作表', '用于验证 XLSX 写出器是否生成合法文件'],
      ['中文测试', '节温器、车型、开启温度、博文编号 —— 中文是否正常'],
      ['特殊字符', 'A & B < C > D "引号" \'单引号\''],
    ],
  },
  {
    name: '审核表',
    title: '第一批产品人工审核（自测）',
    notes: [
      '这是说明行 1：黄色列需要人工填写。',
      '这是说明行 2：下拉菜单列请从列表中选择。',
    ],
    columns: [
      { title: 'Bowen No.', width: 14 },
      { title: 'OE Numbers', width: 30 },
      { title: 'Vehicle Make', width: 22 },
      { title: 'Opening Temp', width: 14 },
      { title: 'Confirmed Product Type', width: 24, style: STYLE.MANUAL_LIST },
      { title: 'Allowed to Publish?', width: 16, style: STYLE.MANUAL_LIST },
      { title: 'Notes', width: 30, style: STYLE.MANUAL },
      { title: 'Image Link', width: 20 },
    ],
    freeze: { row: 6, col: 1 },
    autoFilter: true,
    rows: [
      ['3001', '056121113D | 86203787', 'Hongqi', { v: 79, type: 'number' }, '', '', '', { v: '打开图片', link: 'https://example.com/a.jpg' }],
      ['3005', '4711306950 | WV56TB', 'Mitsubishi | Geely', { v: 76.5, type: 'number' }, '', '', '注意：57 个 OE', ''],
      ['3064', '2120053J00', 'Nissan', { v: 82, type: 'number' }, '', '', '', ''],
    ],
    validations: [
      { sqref: 'E7:E200', values: TYPES, promptTitle: '产品类型', prompt: '请从下拉列表选择，不要猜测' },
      { sqref: 'F7:F200', values: YNU, promptTitle: '是否允许发布', prompt: '' },
    ],
  },
]);

console.log('已写出:', OUT, fs.statSync(OUT).size, 'bytes');

// ---- 读回验证 ----
const wb = new Workbook(OUT);
console.log('\n工作表:', wb.sheets.map((s) => s.name).join(' | '));

const s1 = wb.readSheet(wb.sheets[0].path);
const g1 = new Map();
for (const c of s1.cells) g1.set(c.row + ':' + c.col, c.value);
console.log('\n[说明表] 中文测试:', JSON.stringify(g1.get('2:2')));
console.log('[说明表] 特殊字符:', JSON.stringify(g1.get('3:2')));

const s2 = wb.readSheet(wb.sheets[1].path);
const g2 = new Map();
for (const c of s2.cells) g2.set(c.row + ':' + c.col, c.value);
console.log('\n[审核表] 最大行/列:', s2.maxRow, s2.maxCol);
console.log('[审核表] 表头行(r3):', [1, 2, 3, 4, 5, 6].map((c) => g2.get('3:' + c)).join(' | '));
console.log('[审核表] 第一数据行(r4):', [1, 2, 3, 4].map((c) => g2.get('4:' + c)).join(' | '));
console.log('[审核表] 数字 76.5 是否保留为数字:', JSON.stringify(g2.get('5:4')));

const sheetXml = wb.zip.text('xl/worksheets/sheet2.xml');
console.log('\n校验 XML 片段:');
console.log('  含 sheetViews(冻结):', /<sheetViews>/.test(sheetXml));
console.log('  含 autoFilter:', /<autoFilter /.test(sheetXml));
console.log('  含 dataValidations:', /<dataValidations>/.test(sheetXml));
console.log('  含产品类型下拉:', sheetXml.includes('Automotive Thermostat'));
console.log('  含 HYPERLINK 公式:', /HYPERLINK/.test(sheetXml));
console.log('  元素顺序正确(sheetViews<cols<sheetData<autoFilter<dataValidations):',
  sheetXml.indexOf('<sheetViews>') < sheetXml.indexOf('<cols>')
  && sheetXml.indexOf('<cols>') < sheetXml.indexOf('<sheetData>')
  && sheetXml.indexOf('<sheetData>') < sheetXml.indexOf('<autoFilter')
  && sheetXml.indexOf('<autoFilter') < sheetXml.indexOf('<dataValidations>'));

// 清理自测产物
fs.unlinkSync(OUT);
console.log('\n自测文件已清理。');
