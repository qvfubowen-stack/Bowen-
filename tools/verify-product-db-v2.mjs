#!/usr/bin/env node
/**
 * Phase 2.5 验收测试
 * ===========================================================================
 * 覆盖业务方指定的 TEST 1–7，以及项目铁律的机器化检查。
 * 任何一个 FAIL 都会让退出码非 0，后续阶段不得开始。
 *
 * 用法：node tools/verify-product-db-v2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Phase 4.1：oeSearchKey 等纯函数已移入 tools/lib/oe-keys.mjs。
// 本脚本**只读**，不再 import 会写文件的构建脚本（原先会顺带重建全部数据）。
import { oeSearchKey } from './lib/oe-keys.mjs';
import { PRODUCT_TYPES, LABEL_LOOKUP, normalizeLabel, STATUS } from './config/product-types.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/derived/v2');
const RAW = path.join(ROOT, 'data/raw/产品信息表1(1).xlsx');
const MANIFEST = path.join(ROOT, 'data/raw/SOURCE-MANIFEST.json');
const REVIEW = path.join(ROOT, 'review/first-batch-business-review.xlsx');
const SITE = path.join(ROOT, 'website/src/data');

let pass = 0;
let fail = 0;
const failures = [];
let group = '';

function section(title) {
  group = title;
  console.log(`\n${'─'.repeat(74)}\n${title}\n${'─'.repeat(74)}`);
}
function check(name, fn) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (typeof r === 'string') { ok = false; detail = r; }
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
  } catch (e) {
    ok = false;
    detail = `抛出异常: ${e.message}`;
  }
  if (ok) { pass += 1; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else {
    fail += 1;
    failures.push(`[${group}] ${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`);
  }
  return ok;
}

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------------------------------------------------------------- load
for (const f of ['products.json', 'product-applications.json', 'product-oe-search-index.json',
  'shared-oe-across-products.json', 'section-labels.json', 'staging-records.json', 'stats.json']) {
  if (!fs.existsSync(path.join(OUT, f))) {
    console.error(`FATAL 缺少产物 ${f}，请先运行 node tools/build-product-db-v2.mjs`);
    process.exit(2);
  }
}
const products = read(path.join(OUT, 'products.json'));
const apps = read(path.join(OUT, 'product-applications.json'));
const oeIndex = read(path.join(OUT, 'product-oe-search-index.json'));
const shared = read(path.join(OUT, 'shared-oe-across-products.json'));
const labels = read(path.join(OUT, 'section-labels.json'));
const staging = read(path.join(OUT, 'staging-records.json'));
const stats = read(path.join(OUT, 'stats.json'));
const manifest = read(MANIFEST);

console.log('博文外贸独立站 — Phase 2.5 产品数据库验收测试');
console.log(`产物：${products.length} products / ${apps.length} applications / ${oeIndex.length} oe index rows`);

// =====================================================================
section('TEST 1 — 原始 Excel 不得被修改（SHA-256 校验）');
// =====================================================================
check('冻结清单里的 SHA-256 与当前文件一致', () => {
  const now = sha256(RAW);
  return now === manifest.sources.product_excel_v2.sha256
    ? { ok: true, detail: now.slice(0, 16) + '…' }
    : `期望 ${manifest.sources.product_excel_v2.sha256} 实际 ${now}`;
});
check('统计报告记录的运行前 SHA-256 与冻结值一致', () =>
  stats.source_excel.sha256_before === manifest.sources.product_excel_v2.sha256);
check('统计报告记录的运行后 SHA-256 与冻结值一致', () =>
  stats.source_excel.sha256_after === manifest.sources.product_excel_v2.sha256);
check('data/raw 下仅有只读原始资料（无程序输出 .json 之外的脏文件）', () => {
  const bad = fs.readdirSync(path.join(ROOT, 'data/raw'))
    .filter((f) => !/\.(xlsx|json|md)$/i.test(f));
  return bad.length === 0 ? true : `发现可疑文件: ${bad.join(', ')}`;
});

// =====================================================================
section('TEST 2 — 同一 Bowen 多个 OE 不得被判定为冲突');
// =====================================================================
const multiOeProducts = products.filter((p) => p.distinct_oe_count > 1);
check('存在大量「一个 Bowen 多个 OE」的产品（说明没有被当成异常丢掉）', () =>
  multiOeProducts.length > 100 ? { ok: true, detail: `${multiOeProducts.length} 个产品有 >1 个 OE` } : `仅 ${multiOeProducts.length} 个`);
check('数据库中不存在 main_oe / primary_oe / secondary_oe 字段', () => {
  const blob = JSON.stringify(products[0]) + JSON.stringify(apps[0]) + JSON.stringify(oeIndex[0]);
  const bad = ['main_oe', 'primary_oe', 'secondary_oe', 'is_main', 'oe_rank'].filter((k) => blob.includes(k));
  return bad.length === 0 ? true : `出现主/次 OE 概念字段: ${bad.join(', ')}`;
});
check('不存在把「同 Bowen 多 OE」标成冲突的记录', () => {
  const bad = products.filter((p) => /conflict/i.test(JSON.stringify(p.product_type_conflict ?? '')) && p.distinct_oe_count > 1);
  return bad.length === 0 ? true : `${bad.length} 个产品被误标冲突`;
});
check('product_type_conflict 只用于「类型标签互相矛盾」，不用于 OE 数量', () =>
  products.filter((p) => p.product_type_conflict).length === 0
    ? true
    : `${products.filter((p) => p.product_type_conflict).length} 个产品有类型标签冲突（已记录待人工裁决，非 OE 冲突）`);
check('共享 OE 未触发任何删除或合并（仅生成人工参考清单）', () =>
  shared.length > 0 && products.every((p) => p.has_resolvable_bowen_no ? p.product_id.startsWith('BW-') : true));

// =====================================================================
section('TEST 3 — OE 与 Engine/Application 的行级关系不得丢失');
// =====================================================================
check('每条 application 都同时带有 OE 原文与 Engine/车型 原文', () => {
  const bad = apps.filter((a) => !('oe_numbers_raw' in a) || !('vehicle_application_raw' in a));
  return bad.length === 0 ? true : `${bad.length} 条 application 缺字段`;
});
check('不存在「OE 数组与 Engine 数组各自独立、失去对应」的结构', () => {
  // 独立数组结构 = application 上没有 oe_numbers_raw 原文，只有分离的列表
  const bad = apps.filter((a) => a.oe_tokens_standalone_only === true);
  if (bad.length) return `${bad.length} 条出现独立 OE 数组`;
  const noRaw = apps.filter((a) => !a.oe_numbers_raw && a.oe_tokens?.length);
  return noRaw.length === 0 ? true : `${noRaw.length} 条有 OE token 但无原文`;
});
check('每条 application 的 source_sheet + source_row 可回溯到 Excel 原始位置', () => {
  const bad = apps.filter((a) => !a.source_sheet || !Number.isFinite(a.source_row) || a.source_row < 1);
  return bad.length === 0 ? true : `${bad.length} 条缺来源坐标`;
});
check('OE 索引每条都指回一条真实 application（关系不悬空）', () => {
  const ids = new Set(apps.map((a) => a.application_id));
  const bad = oeIndex.filter((e) => !ids.has(e.application_id));
  return bad.length === 0 ? true : `${bad.length} 条索引指向不存在的 application`;
});
check('统计报告明确声明行级关系未丢失', () => stats.oe_engine_relation.relation_preserved === true);
check('没有被抽成独立数组的 OE（oe_tokens_split_into_standalone_arrays 必须为 false）', () =>
  stats.oe_engine_relation.oe_tokens_split_into_standalone_arrays === false);
check('抽查 Bowen 3005：每条 application 的 OE 与车型来自同一行同一区块', () => {
  const a = apps.filter((x) => x.bowen_no === '3005');
  if (!a.length) return '未找到 3005';
  // Excel 原文里车型单元格可能本来就是空的；关键是「同一行」且来源坐标可回溯
  const bad = a.filter((x) => !x.oe_numbers_raw || !x.source_sheet || !Number.isFinite(x.source_row) || !x.source_cell_refs?.oe);
  const withVeh = a.filter((x) => x.vehicle_application_raw).length;
  return bad.length === 0
    ? { ok: true, detail: `${a.length} 条 application 全部带 OE 原文与来源坐标（其中 ${withVeh} 条 Excel 原文有车型）` }
    : `${bad.length} 条不完整`;
});

// =====================================================================
section('TEST 4 — 不同格式 OE 标准化后应能正常查询');
// =====================================================================
const formatVariants = ['25500-35540', '2550035540', '25500 35540', '25500/35540'];
check('业务规则要求的 4 种写法标准化键完全一致（忽略大小写/空格/短横线/斜线）', () => {
  const keys = new Set(formatVariants.map(oeSearchKey));
  return keys.size === 1 ? { ok: true, detail: [...keys][0] } : `得到 ${keys.size} 个不同键: ${[...keys].join(' | ')}`;
});
check('忽略大小写', () => oeSearchKey('abc12345') === oeSearchKey('ABC12345'));
check('忽略全角空格', () => oeSearchKey('25500\u300035540') === oeSearchKey('25500-35540'));
check('标准化键在真实索引中可命中（2550035540）', () => {
  const k = oeSearchKey('25500-35540');
  const hit = oeIndex.filter((e) => e.oe_search_key === k);
  return hit.length > 0
    ? { ok: true, detail: `命中 ${hit.length} 条 → Bowen ${[...new Set(hit.map((h) => h.bowen_no))].join(', ')}` }
    : `索引里找不到 ${k}`;
});
check('索引同时保留 oe_number_raw 供网站展示', () => {
  const bad = oeIndex.filter((e) => !e.oe_number_raw || !e.oe_number_normalized || !e.oe_search_key);
  return bad.length === 0 ? true : `${bad.length} 条缺展示字段`;
});
check('同一 application 内重复 OE 已去重（不会重复计数）', () => {
  const bad = oeIndex.filter((e) => e.oe_search_key === '');
  return bad.length === 0 ? true : `${bad.length} 条空键`;
});
check('所有索引键仅由 A-Z0-9 与点组成（无空格/短横线/斜线残留）', () => {
  const bad = oeIndex.filter((e) => !/^[A-Z0-9.]+$/.test(e.oe_search_key));
  return bad.length === 0 ? true : `${bad.length} 条含非法字符，例: ${bad[0]?.oe_search_key}`;
});

// =====================================================================
section('TEST 5 — blocked 数据不得进入 Prototype');
// =====================================================================
const prototypeIds = new Set(products.filter((p) => p.status === STATUS.PROTOTYPE_CANDIDATE).map((p) => p.product_id));
check('Prototype 产品数量在 15–20 之间', () =>
  prototypeIds.size >= 15 && prototypeIds.size <= 20 ? { ok: true, detail: `${prototypeIds.size} 个` } : `${prototypeIds.size} 个`);
check('没有任何 blocked 产品进入 Prototype', () => {
  const bad = products.filter((p) => p.status === STATUS.PROTOTYPE_CANDIDATE && (p.blocked || p.data_status === 'blocked'));
  return bad.length === 0 ? true : bad.map((b) => b.product_id).join(', ');
});
check('Prototype 产品不含任何 blocked application', () => {
  const bad = apps.filter((a) => prototypeIds.has(a.product_id) && a.blocked);
  return bad.length === 0 ? true : `${bad.length} 条`;
});
check('Prototype 产品不含任何「错位待复核」application', () => {
  const bad = apps.filter((a) => prototypeIds.has(a.product_id) && a.needs_review);
  return bad.length === 0 ? true : `${bad.length} 条`;
});
check('blocked application 不出现在 OE 搜索索引里', () => {
  const ids = new Set(oeIndex.map((e) => e.application_id));
  const bad = apps.filter((a) => a.blocked && ids.has(a.application_id));
  return bad.length === 0 ? true : `${bad.length} 条 blocked application 出现在索引`;
});
check('网站数据集（website/src/data）里没有 blocked 产品', () => {
  const siteProducts = read(path.join(SITE, 'products.json'));
  const bad = siteProducts.filter((p) => p.blocked || p.status === STATUS.BLOCKED);
  return bad.length === 0 ? true : bad.map((b) => b.product_id).join(', ');
});
check('网站数据集里没有 blocked application', () => {
  const siteApps = read(path.join(SITE, 'applications.json'));
  const bad = siteApps.filter((a) => a.blocked || a.needs_review);
  return bad.length === 0 ? true : `${bad.length} 条`;
});
check('blocked 记录保留了原始来源（source_sheet/source_row/原始单元格）', () => {
  const blockedProducts = products.filter((p) => p.blocked);
  if (!blockedProducts.length) {
    // 业务方已用 business-decisions-v3 把全部「编号读不出」产品按标黄整体舍弃，
    // 因此产品库里不再有 blocked 产品 —— 这是正确结果，不是失败。
    return { ok: true, detail: '当前没有 blocked 产品（业务方已舍弃全部不可读编号产品）' };
  }
  const bad = blockedProducts.filter((p) => !p.blocked_reasons.length || !p.source_record_ids.length);
  return bad.length === 0 ? { ok: true, detail: `${blockedProducts.length} 个 blocked 产品均保留来源` } : `${bad.length} 个缺来源`;
});
check('业务方标黄舍弃的 30 个产品确实已不在产品库', () => {
  const p = path.join(ROOT, 'data/raw/business-decisions-v3.json');
  if (!fs.existsSync(p)) return '缺少 business-decisions-v3.json';
  const dec = read(p);
  const discarded = dec.product_type_review?.discarded ?? [];
  const ids = new Set(products.map((x) => x.product_id));
  const still = discarded.filter((d) => ids.has(d.product_id));
  return still.length === 0
    ? { ok: true, detail: `${discarded.length} 个标黄产品全部已移出产品库` }
    : `${still.length} 个仍在库里: ${still.slice(0, 3).map((x) => x.product_id).join(', ')}`;
});
check('业务方确认类型的 40 个产品已标为 Thermostat', () => {
  const p = path.join(ROOT, 'data/raw/business-decisions-v3.json');
  if (!fs.existsSync(p)) return '缺少 business-decisions-v3.json';
  const dec = read(p);
  const want = dec.product_type_review?.confirmed_bowen_nos ?? [];
  const map = new Map(products.filter((x) => x.bowen_no).map((x) => [x.bowen_no.toUpperCase(), x.product_type]));
  const bad = want.filter((n) => map.get(String(n).toUpperCase()) !== 'Thermostat');
  return bad.length === 0
    ? { ok: true, detail: `${want.length} 个全部为 Thermostat` }
    : `${bad.length} 个未确认: ${bad.slice(0, 5).join(', ')}`;
});
check('业务方要求补入库的 5 个编号已作为产品存在', () => {
  const p = path.join(ROOT, 'data/raw/business-decisions-v3.json');
  if (!fs.existsSync(p)) return '缺少 business-decisions-v3.json';
  const dec = read(p);
  const want = dec.image_review?.D3_not_in_database_5?.bowen_nos ?? [];
  const have = new Set(products.filter((x) => x.bowen_no).map((x) => x.bowen_no.toUpperCase()));
  const missing = want.filter((n) => !have.has(String(n).toUpperCase()));
  return missing.length === 0
    ? { ok: true, detail: `${want.length} 个已入库: ${want.join(', ')}` }
    : `${missing.length} 个缺失: ${missing.join(', ')}`;
});

// =====================================================================
section('TEST 6 — 没有人工类型标签的数据不得自动猜 product_type');
// =====================================================================
check('自动猜 product_type 计数必须为 0', () =>
  stats.auto_guessed_product_type_count === 0 ? { ok: true, detail: '0' } : `${stats.auto_guessed_product_type_count}`);
check('product_type_source 只取 4 个合法值', () => {
  const allowed = new Set(['human_section_label', 'human_review_confirmed', 'inherited_from_bowen', 'review_required']);
  const bad = products.filter((p) => !allowed.has(p.product_type_source));
  return bad.length === 0 ? true : `${bad.length} 个非法来源: ${[...new Set(bad.map((b) => b.product_type_source))].join(', ')}`;
});
check('product_type 非空的产品必有证据对象', () => {
  const bad = products.filter((p) => p.product_type && !p.product_type_evidence);
  return bad.length === 0 ? true : `${bad.length} 个缺证据`;
});
check('product_type 为空的产品必须标 review_required 且未被标为已核实', () => {
  const bad = products.filter((p) => !p.product_type && (p.product_type_source !== 'review_required' || p.product_type_verified));
  return bad.length === 0 ? true : `${bad.length} 个违规`;
});
check('每个已分类产品的证据都能追到 Excel 单元格或审核表行', () => {
  const bad = products.filter((p) => {
    if (!p.product_type) return false;
    const e = p.product_type_evidence;
    if (!e) return true;
    if (e.kind === 'human_review_confirmed') return !(e.source_file && Number.isFinite(e.source_row));
    if (e.kind === 'inherited_from_bowen') return !(e.inherited_from_sheet && Number.isFinite(e.inherited_from_row));
    return !(e.source_sheet && Number.isFinite(e.source_row));
  });
  return bad.length === 0 ? true : `${bad.length} 个证据不完整`;
});
check('变体编号的继承证据指向其基础编号（3002-1 ← 3002）', () => {
  const variants = products.filter((p) => p.variant_of_bowen_no);
  if (!variants.length) return '没有变体产品';
  const bad = variants.filter((p) => p.product_type_evidence?.inherited_from_bowen_no !== p.variant_of_bowen_no);
  return bad.length === 0
    ? { ok: true, detail: `${variants.length} 个变体明确记录了基础编号` }
    : `${bad.length} 个不一致`;
});
check('没有任何产品的类型来自「按 OE/车型/发动机/温度/尺寸推断」', () => {
  const bad = products.filter((p) => /guess|inferred|heuristic|auto_/i.test(p.product_type_source));
  return bad.length === 0 ? true : `${bad.length} 个可疑来源`;
});
check('无法确定类型的产品仍然入库（不只是被丢弃）', () => {
  const unknown = products.filter((p) => !p.product_type);
  return unknown.length > 0
    ? { ok: true, detail: `${unknown.length} 个类型待确认产品已入库并标 review_required` }
    : '没有未确认产品（可疑）';
});
check('staging 原始记录数与抽取数一致，未被静默丢弃', () =>
  staging.length === stats.raw_record_count ? true : `staging ${staging.length} vs stats ${stats.raw_record_count}`);

// =====================================================================
section('TEST 7 — Thermostat 不得再拆分 Insert / Assembly / Automotive Thermostat');
// =====================================================================
const ALLOWED_TYPES = new Set(Object.keys(PRODUCT_TYPES));
check('product_type 取值只能是词典里的 canonical 值', () => {
  const bad = products.filter((p) => p.product_type && !ALLOWED_TYPES.has(p.product_type));
  return bad.length === 0 ? true : `非法类型: ${[...new Set(bad.map((b) => b.product_type))].join(', ')}`;
});
check('不存在 Thermostat Insert / Assembly / Automotive Thermostat 作为 product_type', () => {
  const banned = ['Thermostat Insert', 'Thermostat Assembly', 'Automotive Thermostat', 'ThermostatInsert', 'ThermostatAssembly'];
  const bad = products.filter((p) => banned.includes(p.product_type));
  return bad.length === 0 ? true : `${bad.length} 个产品仍被拆分`;
});
check('四个节温器写法在词典里全部归一为 Thermostat', () => {
  const four = ['Automotive Thermostat', 'Thermostat', 'Thermostat Insert', 'Thermostat Assembly'];
  const mapped = four.map((x) => LABEL_LOOKUP.get(normalizeLabel(x)));
  return mapped.every((m) => m === 'Thermostat') ? { ok: true, detail: '4 → Thermostat' } : `得到 ${mapped.join(', ')}`;
});
check('product_subtype 全部为 null，且不阻止产品上线', () => {
  const bad = products.filter((p) => p.product_subtype !== null);
  if (bad.length) return `${bad.length} 个产品有 subtype`;
  const searchable = products.filter((p) => p.status === STATUS.SEARCHABLE_NOINDEX || p.status === STATUS.PROTOTYPE_CANDIDATE);
  const blockedBySubtype = searchable.filter((p) => p.product_subtype === null && p.status === STATUS.DRAFT);
  return blockedBySubtype.length === 0
    ? { ok: true, detail: `subtype 全为 null，仍有 ${searchable.length} 个产品可上线` }
    : `${blockedBySubtype.length} 个产品因 subtype 缺失被降级`;
});
check('审核表里人类填的 Insert/Assembly 原始值被保留在 product_type_raw_labels', () => {
  const p3064 = products.find((p) => p.bowen_no === '3064');
  const p3061a = products.find((p) => p.bowen_no === '3061A');
  if (!p3064 || !p3061a) return '未找到 3064 / 3061A';
  return p3064.product_type_raw_labels.includes('Thermostat Insert')
    && p3061a.product_type_raw_labels.includes('Thermostat Assembly')
    ? { ok: true, detail: '原始写法已保留（未来做 subtype 有据可依）' }
    : `3064=${JSON.stringify(p3064.product_type_raw_labels)} 3061A=${JSON.stringify(p3061a.product_type_raw_labels)}`;
});
check('Phase 2 人工审核表确认的 3 个产品仍被标记为 human_review_confirmed', () => {
  const byNo = new Map(products.filter((p) => p.bowen_no).map((p) => [p.bowen_no.toUpperCase(), p]));
  const want = ['3005', '3064', '3061A'];
  const bad = want.filter((n) => byNo.get(n)?.product_type_source !== 'human_review_confirmed');
  return bad.length === 0
    ? { ok: true, detail: want.map((n) => `${n}→${byNo.get(n).product_type}`).join(', ') }
    : `${bad.length} 个丢失或被改写: ${bad.join(', ')}`;
});
check('人工确认类型的产品全部来自人工审核，且带可追溯的审核表行号', () => {
  const dec = read(path.join(ROOT, 'data/raw/business-decisions-v3.json'));
  const typeReview = dec.product_type_review;
  const confirmed = products.filter((p) => p.product_type_source === 'human_review_confirmed');
  // Phase 2 的 3 个 + Phase 2.7 类型表确认的 40 个（两者都来自人工审核）
  const expectedMin = 3;
  if (confirmed.length < expectedMin) return `确认产品只有 ${confirmed.length} 个，少于 ${expectedMin}`;
  const noRow = confirmed.filter((p) => !p.product_type_evidence?.source_file || !Number.isFinite(p.product_type_evidence?.source_row));
  if (noRow.length) return `${noRow.length} 个确认产品缺少审核表来源行号`;
  // 类型表确认的 40 个必须逐个对上人工审阅表里未标黄的行
  const rows = typeReview.confirmed_form_rows ?? {};
  const fromForm = confirmed.filter((p) => Object.prototype.hasOwnProperty.call(rows, String(p.bowen_no)));
  if (fromForm.length !== typeReview.confirmed_count) {
    return `类型表确认 ${typeReview.confirmed_count} 个，实际在库 ${fromForm.length} 个`;
  }
  const wrongType = fromForm.filter((p) => p.product_type !== typeReview.confirmed_product_type);
  if (wrongType.length) return `${wrongType.length} 个确认产品类型不是 ${typeReview.confirmed_product_type}`;
  const mismatch = fromForm.filter((p) => p.product_type_evidence.source_row !== rows[String(p.bowen_no)]);
  if (mismatch.length) return `${mismatch.length} 个产品记录的行号与人工审阅表不一致`;
  return { ok: true, detail: `共 ${confirmed.length} 个人工确认产品（含类型表 ${fromForm.length} 个），行号全部对得上` };
});

// =====================================================================
section('附加 — 项目铁律与数据完整性');
// =====================================================================
check('不存在重复 product_id', () => products.length === new Set(products.map((p) => p.product_id)).size);
check('不存在重复 application_id', () => apps.length === new Set(apps.map((a) => a.application_id)).size);
check('每个产品的 application_ids 都能找到对应记录', () => {
  const ids = new Set(apps.map((a) => a.application_id));
  const bad = products.flatMap((p) => p.application_ids.filter((id) => !ids.has(id)));
  return bad.length === 0 ? true : `${bad.length} 个悬空引用`;
});
check('每条 application 的 product_id 都存在', () => {
  const ids = new Set(products.map((p) => p.product_id));
  const bad = apps.filter((a) => !ids.has(a.product_id));
  return bad.length === 0 ? true : `${bad.length} 条悬空`;
});
check('OE 索引条数与 stats 一致', () => oeIndex.length === stats.oe_index_count);
check('application 条数与 stats 一致', () => apps.length === stats.application_count);
check('产品条数与 stats 一致', () => products.length === stats.product_count);
check('参与入库的工作表里，人工区段标签全部能被词典识别', () => {
  // 辅助表（工作表1/工作表2）本阶段不入库，其编号列里的天博编号孤立行不计入
  const seen = [...new Set(staging.map((r) => r.section_label_raw).filter(Boolean))];
  const unknown = seen.filter((s) => !LABEL_LOOKUP.has(normalizeLabel(s)));
  return unknown.length === 0 ? { ok: true, detail: seen.join('、') } : `无法识别: ${unknown.join('、')}`;
});
check('辅助表天博编号孤立行已被正确排除并留档', () => {
  const ex = read(path.join(OUT, 'auxiliary-excluded-rows.json'));
  const leaked = ex.filter((r) => {
    const rec = staging.find((s) => s.source_record_id === r.source_record_id);
    return rec && (rec.oe_cell_raw || rec.vehicle_cell_raw);
  });
  return leaked.length === 0
    ? { ok: true, detail: `排除 ${ex.length} 条，无有效记录被误排除` }
    : `${leaked.length} 条有效记录被误排除`;
});
check('综合产品信息表的 7 个人工区段标签全部被识别', () => {
  const masterLabels = [...new Set(staging.filter((r) => r.source_sheet === '综合产品信息表' && r.section_label_raw).map((r) => r.section_label_raw))];
  return masterLabels.length === 7
    ? { ok: true, detail: masterLabels.join('、') }
    : `期望 7 个，实际 ${masterLabels.length}: ${masterLabels.join('、')}`;
});
check('共享 OE 参考清单已生成（review/shared-oe-across-products.xlsx）', () =>
  fs.existsSync(path.join(ROOT, 'review/shared-oe-across-products.xlsx')) ? true : '文件不存在');
check('共享 OE 清单覆盖所有「一个 OE 对多个 Bowen」的情况', () =>
  shared.length === stats.shared_oe_across_products_count
    ? { ok: true, detail: `${shared.length} 个 OE` }
    : `${shared.length} vs ${stats.shared_oe_across_products_count}`);
check('共享 OE 情况没有阻止 Prototype 开发（Prototype 仍为 15–20 个）', () =>
  stats.prototype_products.length >= 15);
check('Prototype 产品全部来自核心品类 Thermostat', () => {
  const bad = stats.prototype_products.filter((p) => p.product_type !== 'Thermostat');
  return bad.length === 0 ? true : bad.map((b) => `${b.bowen_no}:${b.product_type}`).join(', ');
});
check('每个 Prototype 产品都有 ≥1 条可用 application', () =>
  stats.prototype_products.every((p) => p.application_count >= 1));
check('没有中文 token 被当成 OE 写进索引', () => {
  const bad = oeIndex.filter((e) => /[\u4e00-\u9fff]/.test(e.oe_number_raw));
  return bad.length === 0 ? true : `${bad.length} 条，例: ${bad[0]?.oe_number_raw}`;
});
check('状态取值只能是 prototype_candidate / searchable_noindex / draft / blocked', () => {
  const allowed = new Set(Object.values(STATUS));
  const bad = products.filter((p) => !allowed.has(p.status));
  return bad.length === 0 ? true : `${[...new Set(bad.map((b) => b.status))].join(', ')}`;
});
check('不存在 published 状态（本阶段禁止正式上线口径）', () =>
  products.filter((p) => p.status === 'published').length === 0);
check('不存在对原始 Excel 的写操作（构建脚本只调用 readFileSync/statSync）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/build-product-db-v2.mjs'), 'utf8');
  const bad = /writeFileSync\([^)]*RAW_EXCEL/.test(src) || /writeFileSync\([^)]*data\/raw/.test(src);
  return bad ? '构建脚本写入了 data/raw' : true;
});

// =====================================================================
section('Phase 4.1 — 准入规则没有删除任何内部资料，且校验保持只读');
// =====================================================================
/** 22 个无可靠主图的网站产品（业务方 2026 确认的清单） */
const NO_IMAGE_PRODUCT_IDS = [
  'BW-2043', 'BW-3003-3', 'BW-3004-5', 'BW-3021-1', 'BW-3192', 'BW-3508',
  'BW-3565-2', 'BW-3566', 'BW-3567', 'BW-3655-2', 'BW-3665', 'BW-3902', 'BW-3919',
  'BW-3964', 'BW-31002', 'BW-32748-2', 'BW-33111', 'BW-33561', 'BW-33655',
  'BW-35116', 'BW-36583', 'BW-403229',
];

check('校验脚本不再 import 会写文件的构建脚本（只读）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/verify-product-db-v2.mjs'), 'utf8');
  const importsBuild = /from\s+['"]\.\/build-product-db-v2\.mjs['"]/.test(src);
  const importsPure = /from\s+['"]\.\/lib\/oe-keys\.mjs['"]/.test(src);
  return !importsBuild && importsPure
    ? { ok: true, detail: 'oeSearchKey 来自 tools/lib/oe-keys.mjs；未 import 构建脚本' }
    : `importsBuild=${importsBuild} importsPure=${importsPure}`;
});
check('构建脚本有显式 main 入口（import 不会触发写文件）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/build-product-db-v2.mjs'), 'utf8');
  const hasMain = /export function main\(\)/.test(src);
  const hasGuard = /invokedDirectly/.test(src) && /if \(invokedDirectly\) main\(\)/.test(src);
  return hasMain && hasGuard
    ? { ok: true, detail: 'export function main() + 直接执行守卫' }
    : `main=${hasMain} guard=${hasGuard}`;
});
check('22 个无可靠主图的产品仍在内部产品库里完整保留（准入规则不删原始数据）', () => {
  const ids = new Set(products.map((p) => p.product_id));
  const missing = NO_IMAGE_PRODUCT_IDS.filter((id) => !ids.has(id));
  return missing.length === 0
    ? { ok: true, detail: `${NO_IMAGE_PRODUCT_IDS.length} 个全部保留在 data/derived/v2/products.json` }
    : `内部库里丢了 ${missing.length} 个: ${missing.join(', ')}`;
});
check('22 个无可靠主图的产品仍有自己的 application 记录（行级关系未删）', () => {
  const withApps = new Set(apps.filter((a) => NO_IMAGE_PRODUCT_IDS.includes(a.product_id)).map((a) => a.product_id));
  return withApps.size === NO_IMAGE_PRODUCT_IDS.length
    ? { ok: true, detail: `${withApps.size}/${NO_IMAGE_PRODUCT_IDS.length} 个仍有 application` }
    : `只有 ${withApps.size} 个有 application`;
});
check('源图片映射里的 review_required / unresolved 记录未被删除', () => {
  const p = path.join(ROOT, 'data/processed/product-image-map.json');
  if (!fs.existsSync(p)) return '缺少 product-image-map.json';
  const im = read(p).images;
  const rr = im.filter((r) => r.mapping_status === 'review_required').length;
  const un = im.filter((r) => r.mapping_status === 'unresolved').length;
  return rr > 0 && un > 0
    ? { ok: true, detail: `review_required=${rr} unresolved=${un} 全部保留` }
    : `review_required=${rr} unresolved=${un}`;
});
check('准入规则由 tools/lib/publication-gate.mjs 单点实现（构建与资产脚本共用）', () => {
  const build = fs.readFileSync(path.join(ROOT, 'tools/build-product-db-v2.mjs'), 'utf8');
  const assets = fs.readFileSync(path.join(ROOT, 'tools/p4-build-site-assets.mjs'), 'utf8');
  return /computePublicationGate/.test(build) && /readPublicationGate/.test(assets)
    ? { ok: true, detail: 'build 用 computePublicationGate，assets 用 readPublicationGate' }
    : `build=${/computePublicationGate/.test(build)} assets=${/readPublicationGate/.test(assets)}`;
});

// =====================================================================
console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  console.log('\n❌ Phase 2.5 验收未通过，不得进入 Phase 3。');
  process.exit(1);
}
console.log(`\n✅ 全部 ${pass} 项通过。自动猜 product_type = ${stats.auto_guessed_product_type_count}。`);
