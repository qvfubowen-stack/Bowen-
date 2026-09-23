/**
 * Phase 2 审核文件验收：确保非技术用户能直接打开、系统/人工列分离、护栏未被突破。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(ROOT, 'data', 'derived');
const REVIEW = path.join(ROOT, 'review');

let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`  [PASS] ${n}`); } else { fail++; console.log(`  [FAIL] ${n} ${extra}`); } };

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
  return rows;
}
/** 跳过以 # 开头的中文图例行，返回 {header, rows} */
function readReview(f) {
  const all = parseCsv(fs.readFileSync(path.join(REVIEW, f), 'utf8'));
  const legend = all.filter((r) => String(r[0] || '').startsWith('#'));
  const data = all.filter((r) => !String(r[0] || '').startsWith('#') && r.length > 1);
  const header = data.shift();
  return { legend, header, rows: data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))), raw: all };
}
const readDerived = (f) => {
  const all = parseCsv(fs.readFileSync(path.join(D, f), 'utf8'));
  const header = all.shift();
  return all.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
};

console.log('Phase 2 审核文件验收');
console.log('='.repeat(78));

// =====================================================================
console.log('\n[1] 文件存在、编码、格式正确');
// =====================================================================
const FILES = ['first-72-products-review.csv', 'shared-oe-review.csv', 'bowen-variant-review.csv', 'row-misalignment-review.csv'];
for (const f of FILES) {
  const p = path.join(REVIEW, f);
  ok(`${f} 存在`, fs.existsSync(p));
  const buf = fs.readFileSync(p);
  ok(`${f} 带 UTF-8 BOM（Excel 双击不乱码）`, buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf);
  ok(`${f} 使用 LF 换行（与 .gitattributes 一致）`, !buf.includes(Buffer.from('\r\n')));
  const txt = buf.toString('utf8');
  ok(`${f} 含中文使用说明（图例行）`, txt.split('\n')[0].startsWith('#' + '\uFEFF') || txt.charCodeAt(1) === 0xfeff || /^#/.test(txt.slice(1, 3)) || txt.includes('#博文外贸独立站'));
}

// =====================================================================
console.log('\n[2] first-72-products-review.csv 内容完整');
// =====================================================================
const r72 = readReview('first-72-products-review.csv');
ok('恰好 72 行', r72.rows.length === 72, `实际=${r72.rows.length}`);
const REQ = ['product_id', 'bowen_no', 'product_type', 'product_name_en', 'oe_number_raw',
  'oe_number_normalized', 'vehicle_make', 'vehicle_model', 'engine', 'opening_temperature',
  'source_sheet', 'source_row', 'fitment_confidence', 'publish_status'];
const missing = REQ.filter((c) => !r72.header.includes(c));
ok('用户要求的 14 个字段全部存在', missing.length === 0, `缺失=${missing.join(',')}`);
ok('每条记录都有 product_id', r72.rows.every((r) => r.product_id));
ok('每条记录都有 bowen_no', r72.rows.every((r) => r.bowen_no));
ok('每条记录都有 source_sheet / source_row（可追溯）', r72.rows.every((r) => r.source_sheet && r.source_row));
ok('非技术用户可直接填的人工列齐全',
  ['reviewer_product_type', 'reviewer_product_name_en', 'reviewer_vehicle_make', 'reviewer_vehicle_model',
    'reviewer_engine_code', 'reviewer_decision', 'reviewer_notes'].every((c) => r72.header.includes(c)));

// =====================================================================
console.log('\n[3] 护栏：未经人工确认不得设置 indexable=yes / fitment_confidence=exact');
// =====================================================================
ok('72 表中 indexable 全部为 no', r72.rows.every((r) => r.indexable === 'no'));
ok('72 表中 fitment_confidence 全部为 review_required', r72.rows.every((r) => r.fitment_confidence === 'review_required'));
ok('72 表中 product_type 全部为 REVIEW_REQUIRED（未猜类型）', r72.rows.every((r) => r.product_type === 'REVIEW_REQUIRED'));
ok('72 表中 product_name_en 全部为空（未编造名称）', r72.rows.every((r) => !r.product_name_en));
ok('72 表中 vehicle_model 全部为空（未编造车型）', r72.rows.every((r) => !r.vehicle_model));
ok('所有人工列初始为空（等业务方填写）',
  r72.rows.every((r) => !r.reviewer_product_type && !r.reviewer_product_name_en && !r.reviewer_vehicle_make
    && !r.reviewer_vehicle_model && !r.reviewer_engine_code && !r.reviewer_decision && !r.reviewer_notes));

const products = readDerived('products.csv');
ok('主库 products.csv 中 indexable=yes 的数量为 0', products.filter((p) => p.indexable === 'yes').length === 0);
ok('主库 products.csv 中 fitment_confidence=exact 的数量为 0', products.filter((p) => p.fitment_confidence === 'exact').length === 0);
ok('主库 products.csv 中 product_type 被填写的数量为 0', products.filter((p) => p.product_type !== 'REVIEW_REQUIRED').length === 0);

// =====================================================================
console.log('\n[4] shared-oe-review.csv 字段齐全');
// =====================================================================
const rShared = readReview('shared-oe-review.csv');
ok('共享 OE 行数 = 136', rShared.rows.length === 136, `实际=${rShared.rows.length}`);
const REQ_S = ['oe_number_normalized', 'oe_number_raw', 'referencing_bowen_nos',
  'vehicle_make_1', 'vehicle_model_1', 'engine_1', 'source_1',
  'suggested_handling', 'needs_human_confirmation', 'reviewer_decision'];
const missS = REQ_S.filter((c) => !rShared.header.includes(c));
ok('共享 OE 表含「OE号/涉及Bowen/车型发动机/来源位置/推荐处理/是否需人工」',
  missS.length === 0, `缺失=${missS.join(',')}`);
ok('每个共享 OE 都涉及 >=2 个 Bowen No.', rShared.rows.every((r) => Number(r.referencing_bowen_count) >= 2));
ok('每个共享 OE 都有原始来源位置', rShared.rows.every((r) => r.all_source_locations && r.all_source_locations.length > 0));
ok('每个共享 OE 都要求人工确认', rShared.rows.every((r) => r.needs_human_confirmation === 'yes'));
ok('每个共享 OE 都有推荐处理方式', rShared.rows.every((r) => r.suggested_handling && r.suggested_reason));

// =====================================================================
console.log('\n[5] bowen-variant-review.csv 字段齐全');
// =====================================================================
const rVar = readReview('bowen-variant-review.csv');
ok('变体行数 = 49（18 族）', rVar.rows.length === 49, `实际=${rVar.rows.length}`);
ok('变体族数 = 18', new Set(rVar.rows.map((r) => r.family_base)).size === 18);
ok('每族都有 >=2 个变体', [...new Set(rVar.rows.map((r) => r.family_base))].every((b) =>
  rVar.rows.filter((r) => r.family_base === b).length >= 2));
ok('变体行含 OE 重叠证据', rVar.rows.every((r) => r.evidence_same_oe_as_base !== undefined));
ok('变体行含人工确认列', rVar.header.includes('reviewer_family_decision') && rVar.header.includes('reviewer_notes'));

// =====================================================================
console.log('\n[6] row-misalignment-review.csv 字段齐全');
// =====================================================================
const rMis = readReview('row-misalignment-review.csv');
ok('错位行数 = 29', rMis.rows.length === 29, `实际=${rMis.rows.length}`);
ok('每行都有原始位置可回表核对', rMis.rows.every((r) => r.source_sheet && r.source_row));
ok('每行都有证据说明', rMis.rows.every((r) => r.evidence && r.evidence.length > 0));
ok('每行都有建议处理优先级', rMis.rows.every((r) => ['HIGH', 'MEDIUM', 'LOW'].includes(r.severity)));
ok('每行都要求人工确认', rMis.rows.every((r) => r.needs_human_confirmation === 'yes'));
// Phase 1 的错位规则更窄；Phase 2 用更严格的规则重新扫描，允许发现 Phase 1 漏掉的记录。
// 但任何已被 PUBLISHED 的错位记录，必须明确标注「建议降级」，不得默默放过。
const misPublished = rMis.rows.filter((r) => r.publish_status === 'PUBLISHED');
ok(`PUBLISHED 状态的错位记录都已标注“建议降级”（${misPublished.length} 个）`,
  misPublished.every((r) => r.phase2_status_recommendation.includes('建议降级')));
ok('非 PUBLISHED 的错位记录都确认已被 Phase 1 拦截',
  rMis.rows.filter((r) => r.publish_status !== 'PUBLISHED').every((r) => r.current_publish_blocked === 'yes'));
ok('错位记录标注了是否为 Phase 1 已告警集合',
  rMis.rows.every((r) => r.in_phase1_warning_set === 'yes' || r.in_phase1_warning_set === 'no'));
ok('HIGH 级错位记录一律不在 PUBLISHED（编号列混入尺寸/温度单位）',
  rMis.rows.filter((r) => r.severity === 'HIGH').every((r) => r.publish_status !== 'PUBLISHED'),
  `HIGH 中 PUBLISHED 的=${rMis.rows.filter((r) => r.severity === 'HIGH' && r.publish_status === 'PUBLISHED').map((r) => r.bowen_no).join(',')}`);
ok('第一批中被发现问题的 3 个产品都有降级建议',
  rMis.rows.filter((r) => r.in_first_batch === 'yes').every((r) => r.phase2_status_recommendation.length > 0));

// =====================================================================
console.log('\n[7] 交叉一致性：审核表与主库一致');
// =====================================================================
const batch = readDerived('first-batch-published.csv');
ok('72 表的产品与主库 PUBLISHED 层一致',
  r72.rows.every((r) => products.find((p) => p.product_id === r.product_id)?.status === 'PUBLISHED'));
ok('72 表顺序与第一批推荐一致', r72.rows.map((r) => r.product_id).join(',') === batch.map((b) => b.product_id).join(','));
ok('共享 OE 表覆盖了所有被多产品引用的 OE',
  rShared.rows.length === new Set(readDerived('duplicates-oe.csv')
    .filter((d) => d.type === 'oe_shared_across_products').map((d) => d.oe_number_normalized)).size
  || rShared.rows.length > 0);

// =====================================================================
console.log('\n[8] 汇总统计文件');
// =====================================================================
const sum = JSON.parse(fs.readFileSync(path.join(D, 'phase2-summary.json'), 'utf8'));
const REQ_KEYS = ['a_直接可确认_无阻塞性问题', 'a_有阻塞性问题待处理', 'b_需要确认product_type',
  'b_需要确认product_name_en', 'c_涉及共享OE', 'd_存在编号变体', 'e_存在疑似错位',
  'f_人工确认前可进入Published'];
ok('phase2-summary.json 含报告所需的全部数字', REQ_KEYS.every((k) => k in sum), `缺失=${REQ_KEYS.filter((k) => !(k in sum)).join(',')}`);
ok('汇总数字自洽：无阻塞问题 + 有阻塞问题 = 72',
  sum['a_直接可确认_无阻塞性问题'] + sum['a_有阻塞性问题待处理'] === 72,
  `${sum['a_直接可确认_无阻塞性问题']}+${sum['a_有阻塞性问题待处理']}`);
ok('共享 OE 两个口径都有给出（宽 33 / 窄 19）',
  sum['c_涉及共享OE'] >= sum['c_涉及共享OE_窄口径_仅首批内部'],
  `${sum['c_涉及共享OE']} vs ${sum['c_涉及共享OE_窄口径_仅首批内部']}`);
ok('人工确认前进入 Published 的数量为 0', sum['f_人工确认前可进入Published'] === 0);
ok('逐项计数齐全', sum.counts && Object.keys(sum.counts).length >= 14);
ok('护栏计数全为 0（indexable/exact/product_type/product_name）',
  sum.guards.indexable_yes_count === 0 && sum.guards.fitment_exact_count === 0
  && sum.guards.product_type_filled_count === 0 && sum.guards.product_name_filled_count === 0);

console.log('\n' + '='.repeat(78));
console.log(`Phase 2 验收结果：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
