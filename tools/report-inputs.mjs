// 导出报告所需的全部统计数字（避免在 PowerShell 里处理中文导致的乱码）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));

function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (f) => parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));

const stats = readJson('stats.json');
const products = readCsv('products.csv');
const oes = readCsv('product-oe-index.csv');
const makes = readCsv('product-vehicle-makes.csv');
const engines = readCsv('product-engine-codes.csv');
const batch = readCsv('first-batch-published.csv');
const dupBowen = readCsv('duplicates-bowen.csv');
const dupOe = readCsv('duplicates-oe.csv');
const oeKept = readCsv('issues-oe-kept-whole.csv');
const oeOver = readCsv('issues-oe-oversized.csv');
const oeNon = readCsv('issues-oe-nonstandard.csv');
const oeAmb = readCsv('issues-oe-ambiguous-splits.csv');
const bowenAnom = readCsv('issues-bowen-anomalies.csv');
const dupCells = readCsv('issues-duplicate-oe-cells.csv');
const raw = readCsv('staging-records.raw.csv');

const L = [];
const p = (s = '') => L.push(s);

p('# 原始记录数量 vs 产品数量对照');
p('');
p(`原始记录行数(含 Sheet1 补充表): ${raw.length}`);
let master = 0, brand = 0, supp = 0;
for (const r of raw) { if (r.sheet_kind === 'master') master++; else if (r.sheet_kind === 'brand') brand++; else supp++; }
p(`  - 主目录 Product Information: ${master}`);
p(`  - 品牌/车型目录 14 张表: ${brand}`);
p(`  - 补充表 Sheet1: ${supp}`);
p(`产品数(按 Bowen No. 聚合): ${products.length}`);
p(`不重复 Bowen No.: ${stats.summary['不重复BowenNo数']}`);
p(`OE 明细行: ${oes.length}  不重复 OE(严格): ${new Set(oes.map((o) => o.oe_number_normalized)).size}  宽松匹配键: ${new Set(oes.map((o) => o.oe_match_key)).size}`);
p(`车型品牌关系: ${makes.length}  不重复品牌: ${new Set(makes.map((m) => m.vehicle_make)).size}`);
p(`发动机代码行: ${engines.length}  不重复: ${new Set(engines.map((e) => e.engine_code)).size}`);
p(`原始车型片段(去重): ${stats.summary['原始车型片段数']}`);
p('');
p('## 分层');
for (const [k, v] of Object.entries(stats.status_distribution)) p(`- ${k}: ${v}  (${(v / products.length * 100).toFixed(1)}%)`);
p('');
p('## OE 每产品分布');
for (const [k, v] of Object.entries(stats.oe_per_product_distribution)) p(`- ${k}: ${v}`);
p('');
p('## 来源分布（产品数，一个产品可能来自多表）');
const srcCount = {};
for (const r of products) for (const s of String(r.source_sheet).split(' | ')) srcCount[s] = (srcCount[s] || 0) + 1;
for (const [k, v] of Object.entries(srcCount).sort((a, b) => b[1] - a[1])) p(`- ${k}: ${v}`);
p('');
p('## 字段完整率');
p('| 字段 | 已填 | 总数 | 完整率 | 说明 |');
p('|---|---|---|---|---|');
for (const f of stats.field_completeness) p(`| ${f.field} | ${f.filled} | ${f.total} | ${(f.rate * 100).toFixed(1)}% | ${f.note || ''} |`);
p('');
p(`平均核心字段完整率: ${(stats.averages.core_field_completeness * 100).toFixed(1)}%`);
p(`平均增强字段完整率: ${(stats.averages.enrichment_field_completeness * 100).toFixed(1)}%`);
p(`平均每产品 OE 数: ${stats.averages.oe_per_product}`);
p('');
p('## 异常与治理清单');
p(JSON.stringify(stats.issues, null, 2));
p('');
p('## Bowen 重复分层');
const bowenTypes = {};
for (const d of dupBowen) bowenTypes[d.type] = (bowenTypes[d.type] || 0) + 1;
p(JSON.stringify(bowenTypes, null, 2));
p('');
p('### 跨表重复 Top 20');
p('| Bowen No. | 出现在几个表 | 表 |');
p('|---|---|---|');
for (const d of (stats.duplicates.bowen_cross_sheet_top || [])) p(`| ${d.key} | ${d.count} | ${d.sheets || d.locations || ''} |`);
p('');
p('### OE 集合跨表冲突 Top 20');
for (const d of dupBowen.filter((x) => x.type === 'bowen_oe_conflict_across_sheets').slice(0, 20)) {
  p(`- ${d.key}: ${d.detail}`);
}
p('');
p('### Bowen 变体族全部');
for (const d of dupBowen.filter((x) => x.type === 'bowen_variant_family')) p(`- 基础号 ${d.key} (${d.count} 个): ${d.product_ids_or_variants}`);
p('');
p('## OE 重复');
const oeTypes = {};
for (const d of dupOe) oeTypes[d.type] = (oeTypes[d.type] || 0) + 1;
p(JSON.stringify(oeTypes, null, 2));
p('');
p('### 被多个产品共用最多的 OE Top 25');
p('| OE(标准化) | 产品数 | Bowen No. |');
p('|---|---|---|');
for (const d of (stats.duplicates.oe_shared_top || [])) p(`| ${d.oe_number_normalized} | ${d.product_count} | ${d.bowen_nos} |`);
p('');
p('## OE 解析问题明细');
p(`- 单个空格推断拆分（已拆，标记待确认）: ${oeAmb.length}`);
p(`- 保留整段待人工确认（混有品牌名等非 OE 片段）: ${oeKept.length}`);
p(`- 归一化后过长被剔除: ${oeOver.length}`);
p(`- 不标准被剔除: ${oeNon.length}`);
p(`- 版面重复单元格被剔除: ${dupCells.length}`);
p('');
p('### 保留整段待确认明细');
for (const d of oeKept.slice(0, 40)) p(`- ${d.location} [${d.reason}] tokens=${d.token_count}: ${String(d.oe_number_raw).slice(0, 150)}`);
p('');
p('### 过长被剔除明细');
for (const d of oeOver) p(`- ${d.location} len=${d.normalized_length}: ${String(d.oe_number_raw).slice(0, 150)}`);
p('');
p('### 不标准被剔除明细');
for (const d of oeNon) p(`- ${d.location} [${d.reason}]: ${d.oe_number_raw}`);
p('');
p('## Bowen No. 异常明细');
for (const d of bowenAnom) p(`- ${d.location} [${d.anomaly}] raw="${d.bowen_raw}" -> "${d.extracted_bowen_no}" note="${d.bowen_note}"`);
p('');
p('## 第一批推荐上线清单');
p(`数量: ${batch.length}  分数区间: ${batch[batch.length - 1]?.data_quality_score} ~ ${batch[0]?.data_quality_score}`);
p('');
p('| # | Bowen No. | OE数 | 车型品牌 | 温度 | 尺寸 | 产品类型建议 | 来源 |');
p('|---|---|---|---|---|---|---|---|');
for (const b of batch) {
  p(`| ${b.rank} | ${b.bowen_no} | ${b.oe_count} | ${String(b.vehicle_make).slice(0, 60)} | ${b.opening_temperature_c} | ${b.dimensions} | ${b.product_type_suggestion} | ${b.source_sheet} |`);
}
p('');
p('## 全部车型品牌（推导结果）');
p(stats.vehicle_makes.join(', '));
p('');

fs.writeFileSync(path.join(ROOT, 'docs', '_source', 'report-inputs.md'), L.join('\n'), 'utf8');
console.log('written docs/_source/report-inputs.md  lines=' + L.length);
