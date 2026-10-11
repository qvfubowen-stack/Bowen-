#!/usr/bin/env node
/**
 * Phase 3 原型验收 —— 直接对网站数据集跑一遍页面所依赖的查询逻辑
 * ===========================================================================
 * 页面的数据来自 website/src/data/*.json，全部由 Phase 2.5 的构建脚本产出。
 * 本脚本不依赖 Next.js 运行时，验证的是「页面会拿到什么」。
 *
 * 用法：node tools/verify-prototype-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'src/data');
const DB = path.join(ROOT, '..', 'data/derived/v2');

let pass = 0;
let fail = 0;
const failures = [];
let group = '';

function section(t) { group = t; console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`); }
function check(name, fn) {
  let ok = false; let detail = '';
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (typeof r === 'string') detail = r;
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
  } catch (e) { detail = `异常: ${e.message}`; }
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(`[${group}] ${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const products = read(path.join(SITE, 'products.json'));
const applications = read(path.join(SITE, 'applications.json'));
const oeIndex = read(path.join(SITE, 'oe-index.json'));
const facts = read(path.join(SITE, 'site-facts.json'));
const productImages = read(path.join(SITE, 'product-images.json'));
const fullProducts = read(path.join(DB, 'products.json'));
const fullApplications = read(path.join(DB, 'product-applications.json'));
const imageMap = read(path.join(ROOT, '..', 'data/processed/product-image-map.json'));

// ---- Phase 4.1 发布集合（与 tools/lib/publication-gate.mjs 同一规则，独立实现用于交叉验证） ----
const publishableStatuses = new Set(['prototype_candidate', 'searchable_noindex']);
const reliablePrimaryByProduct = new Set(
  imageMap.images
    .filter((r) => r.mapping_status === 'exact' && r.is_primary_image === true && r.product_id)
    .map((r) => r.product_id),
);
const displayableAppsByProduct = new Map();
for (const a of fullApplications) {
  if (a.blocked || a.needs_review) continue;
  if (!a.oe_numbers_raw && !a.vehicle_application_raw) continue;
  if (!displayableAppsByProduct.has(a.product_id)) displayableAppsByProduct.set(a.product_id, []);
  displayableAppsByProduct.get(a.product_id).push(a);
}
const independentlyComputedPublic = fullProducts.filter(
  (p) => publishableStatuses.has(p.status) && !p.blocked
    && reliablePrimaryByProduct.has(p.product_id)
    && (displayableAppsByProduct.get(p.product_id) ?? []).length > 0,
).map((p) => p.product_id);
const independentlyComputedExcludedNoImage = fullProducts.filter(
  (p) => publishableStatuses.has(p.status) && !p.blocked
    && !reliablePrimaryByProduct.has(p.product_id)
    && (displayableAppsByProduct.get(p.product_id) ?? []).length > 0,
).map((p) => p.product_id);

// 与 src/lib/db.ts 保持一致的归一化实现
const normalizeOeInput = (raw) => String(raw ?? '')
  .toUpperCase().replace(/[\u3000\s]/g, '').replace(/[-‐‑‒–—―]/g, '')
  .replace(/[/\\]/g, '').replace(/[^A-Z0-9.]/g, '');

function searchByOe(query) {
  const key = normalizeOeInput(query);
  const productById = new Map(products.map((p) => [p.product_id, p]));
  const appById = new Map(applications.map((a) => [a.application_id, a]));
  const exact = [];
  const partial = [];
  for (const e of oeIndex) {
    const product = productById.get(e.product_id);
    const application = appById.get(e.application_id);
    if (!product || !application) continue;
    if (product.blocked || product.status === 'draft' || product.status === 'blocked') continue;
    if (application.blocked || application.needs_review) continue;
    const hit = { oe_number_raw: e.oe_number_raw, oe_search_key: e.oe_search_key, product, application };
    if (e.oe_search_key === key) exact.push(hit);
    else if (e.oe_search_key.includes(key) || key.includes(e.oe_search_key)) partial.push(hit);
  }
  return { key, exact, partial, hits: exact.length ? exact : partial };
}

console.log('博文外贸独立站 — Phase 3 原型数据验收');
console.log(`数据集：${products.length} products / ${applications.length} applications / ${oeIndex.length} OE rows`);

// =====================================================================
section('数据集完整性');
// =====================================================================
check('website/src/data 只包含可展示状态（prototype_candidate / searchable_noindex）', () => {
  const allowed = new Set(['prototype_candidate', 'searchable_noindex']);
  const bad = products.filter((p) => !allowed.has(p.status));
  return bad.length === 0
    ? { ok: true, detail: `${products.length} 个：prototype_candidate ${products.filter((p) => p.status === 'prototype_candidate').length} + searchable_noindex ${products.filter((p) => p.status === 'searchable_noindex').length}` }
    : `${bad.length} 个状态非法`;
});
check('数据集里没有 blocked 产品', () => products.filter((p) => p.blocked).length === 0);
check('数据集里没有 blocked 或错位待复核的 application', () =>
  applications.filter((a) => a.blocked || a.needs_review).length === 0);
check('原型重点产品（prototype_candidate）数量在 15–20 之间', () => {
  const n = products.filter((p) => p.status === 'prototype_candidate').length;
  return n >= 15 && n <= 20 ? { ok: true, detail: `${n} 个（另有 ${products.filter((p) => p.status === 'searchable_noindex').length} 个可搜索产品）` } : `${n} 个`;
});
check('首页重点展示的产品恰好是 prototype_candidate', () => {
  const n = products.filter((p) => p.prototype_rank).length;
  const pc = products.filter((p) => p.status === 'prototype_candidate').length;
  return n === pc ? { ok: true, detail: `${n} 个带 prototype_rank` } : `${n} vs ${pc}`;
});
check('每个产品的 application_ids 都能在数据集里找到', () => {
  const ids = new Set(applications.map((a) => a.application_id));
  const bad = products.flatMap((p) => (p.application_ids ?? []).filter((id) => !ids.has(id)));
  return bad.length === 0 ? true : `${bad.length} 个悬空`;
});
check('每条 application 的 product_id 都在数据集里', () => {
  const ids = new Set(products.map((p) => p.product_id));
  const bad = applications.filter((a) => !ids.has(a.product_id));
  return bad.length === 0 ? true : `${bad.length} 条悬空`;
});
check('所有 OE 索引行都指向数据集内的 application', () => {
  const ids = new Set(applications.map((a) => a.application_id));
  const bad = oeIndex.filter((e) => !ids.has(e.application_id));
  return bad.length === 0 ? true : `${bad.length} 条悬空`;
});

// =====================================================================
section('OE 搜索（原型核心功能）');
// =====================================================================
check('四种写法得到同一个标准化键', () => {
  const keys = new Set(['25500-35540', '2550035540', '25500 35540', '25500/35540'].map(normalizeOeInput));
  return keys.size === 1 ? { ok: true, detail: [...keys][0] } : `得到 ${keys.size} 个键`;
});
check('2550035540 能搜到结果', () => {
  const r = searchByOe('2550035540');
  return r.exact.length > 0
    ? { ok: true, detail: `${r.exact.length} 条精确命中 → Bowen ${[...new Set(r.exact.map((h) => h.product.bowen_no))].join(', ')}` }
    : '没有命中';
});
check('带短横线的 25500-35540 与不带短横线结果一致', () => {
  const a = searchByOe('2550035540');
  const b = searchByOe('25500-35540');
  return a.exact.length === b.exact.length && a.key === b.key
    ? { ok: true, detail: `均为 ${a.exact.length} 条` }
    : `${a.exact.length} vs ${b.exact.length}`;
});
check('小写输入也能命中（忽略大小写）', () => {
  const upper = searchByOe('WV56TB');
  const lower = searchByOe('wv56tb');
  return upper.exact.length > 0 && upper.exact.length === lower.exact.length
    ? { ok: true, detail: `${upper.exact.length} 条` }
    : `${upper.exact.length} vs ${lower.exact.length}`;
});
check('搜索结果带完整应用上下文（OE + Bowen + 车型/Engine 字段 + 来源）', () => {
  const r = searchByOe('2550035540');
  if (!r.exact.length) return '无命中，无法验证';
  const h = r.exact[0];
  const bad = [];
  if (!h.oe_number_raw) bad.push('缺 OE');
  if (!h.product.bowen_no) bad.push('缺 Bowen');
  // 车型/发动机在原表里可能是空的（例如辅助表工作表1 没有车型列）——字段必须存在，值可以为空
  if (!('vehicle_application_raw' in h.application)) bad.push('缺车型字段');
  if (!('engine_application' in h.application)) bad.push('缺 Engine 字段');
  if (!h.application.source_sheet || !h.application.source_row) bad.push('缺来源');
  return bad.length === 0
    ? {
      ok: true,
      detail: `OE ${h.oe_number_raw} → Bowen ${h.product.bowen_no} · ${h.application.source_sheet} row ${h.application.source_row}`
        + `（该行原表无车型内容：${h.application.vehicle_application_raw ? '有' : '无'}）`,
    }
    : bad.join(', ');
});
check('存在「同一行同时有 OE 和车型」的真实 application（详情页表格主体）', () => {
  const both = applications.filter((a) => a.oe_numbers_raw && a.vehicle_application_raw);
  return both.length > 0
    ? { ok: true, detail: `${both.length}/${applications.length} 条同时有 OE 与车型原文` }
    : '一条都没有';
});
check('抽一条「同时有 OE 与车型」的 application，其 OE 可被搜索命中', () => {
  const sample = applications.find((a) => a.oe_numbers_raw && a.vehicle_application_raw && a.oe_tokens?.length);
  if (!sample) return '没有可用样本';
  const r = searchByOe(sample.oe_tokens[0]);
  const found = r.hits.some((h) => h.application.application_id === sample.application_id);
  return found
    ? { ok: true, detail: `OE ${sample.oe_tokens[0]} 命中 ${sample.source_sheet} row ${sample.source_row}` }
    : `OE ${sample.oe_tokens[0]} 未命中它自己的 application`;
});
check('多个真实 OE 都能搜到（抽 10 个索引键）', () => {
  const sample = oeIndex.filter((_, i) => i % Math.ceil(oeIndex.length / 10) === 0).slice(0, 10);
  const misses = sample.filter((e) => searchByOe(e.oe_search_key).exact.length === 0);
  return misses.length === 0 ? { ok: true, detail: `10/10 命中` } : `${misses.length} 个搜不到`;
});
check('搜不到的 OE 能优雅返回空结果（不报错）', () => {
  const r = searchByOe('ZZZZ99999999');
  return r.exact.length === 0 && r.partial.length === 0 ? true : '出现了意外命中';
});
check('空查询不会报错', () => {
  const r = searchByOe('');
  return r.exact.length === 0 && r.key === '';
});

// =====================================================================
section('OE ↔ Engine 行级关系（页面展示的事实基础）');
// =====================================================================
check('每条 application 都有 OE 原文字段与车型/发动机字段（值可为空，但字段必须在）', () => {
  const noField = applications.filter(
    (a) => typeof a.oe_numbers_raw !== 'string'
      || !('vehicle_application_raw' in a)
      || !('engine_application' in a),
  );
  if (noField.length) return `${noField.length} 条缺字段`;
  const withOe = applications.filter((a) => a.oe_numbers_raw).length;
  return { ok: true, detail: `${applications.length} 条字段完整；${withOe} 条原表有 OE 原文，${applications.length - withOe} 条原表 OE 单元格本身为空` };
});
check('OE 单元格为空的那几条，原表确实同时有车型内容（不是解析丢失）', () => {
  const noOe = applications.filter((a) => !a.oe_numbers_raw);
  const orphanInSource = JSON.parse(fs.readFileSync(path.join(DB, 'staging-records.json'), 'utf8'))
    .filter((r) => !String(r.oe_cell_raw ?? '').trim());
  // 网站数据集里无 OE 的 application，其来源行在原表里 OE 单元格也必须是空的
  const bad = noOe.filter((a) => {
    const rec = orphanInSource.find((r) => r.source_record_id === a.source_record_id);
    return !rec;
  });
  return bad.length === 0
    ? { ok: true, detail: `${noOe.length} 条无 OE 的 application，来源行 OE 单元格在原表中均为空` }
    : `${bad.length} 条与原始单元格不符`;
});
check('每条 application 至少有 OE 或车型内容之一（不存在空壳行）', () => {
  const empty = applications.filter((a) => !a.oe_numbers_raw && !a.vehicle_application_raw);
  return empty.length === 0 ? true : `${empty.length} 条空壳`;
});
check('产品详情页表格的每一行都有来源工作表与行号（内部审计字段，不再上页面）', () => {
  const bad = applications.filter((a) => !a.source_sheet || !Number.isFinite(a.source_row) || a.source_row < 1);
  return bad.length === 0 ? true : `${bad.length} 条缺来源`;
});
check('不存在 main / primary / secondary OE 字段', () => {
  const blob = JSON.stringify(products[0]) + JSON.stringify(applications[0]) + JSON.stringify(oeIndex[0]);
  const bad = ['main_oe', 'primary_oe', 'secondary_oe', 'is_main', 'oe_rank'].filter((k) => blob.includes(k));
  return bad.length === 0 ? true : bad.join(', ');
});
check('存在大量「同一 Bowen 多个 OE」的真实例子（证明多 OE 被当作正常情况）', () => {
  const multi = products.filter((p) => p.distinct_oe_count > 1);
  const maxOe = Math.max(...products.map((p) => p.distinct_oe_count));
  return multi.length >= 100
    ? { ok: true, detail: `${multi.length}/${products.length} 个产品有多个 OE，最多的 ${maxOe} 个` }
    : `只有 ${multi.length} 个`;
});

// =====================================================================
section('页面所需数据齐备');
// =====================================================================
check('每个产品都有 product_type（网站不展示无类型产品）', () => {
  const bad = products.filter((p) => !p.product_type);
  return bad.length === 0 ? true : `${bad.length} 个缺类型`;
});
check('20 个 Prototype 重点产品全部是 Thermostat（核心品类）', () => {
  const bad = products.filter((p) => p.prototype_rank && p.product_type !== 'Thermostat');
  const n = products.filter((p) => p.prototype_rank).length;
  return bad.length === 0 ? { ok: true, detail: `${n} 个重点产品全为 Thermostat` } : `${bad.length} 个不是`;
});
check('网站产品架构的每个分类都有真实产品（不展示空分类）', () => {
  const cats = {};
  for (const p of products) cats[p.website_category ?? '(none)'] = (cats[p.website_category ?? '(none)'] ?? 0) + 1;
  return Object.keys(cats).filter((k) => k !== '(none)').length >= 4
    ? { ok: true, detail: Object.entries(cats).map(([k, v]) => `${k}=${v}`).join(', ') }
    : `只有 ${Object.keys(cats).length} 个分类`;
});
check('汽车开关的四个子分类都各自有产品', () => {
  const subs = {};
  for (const p of products) if (p.switch_subcategory) subs[p.switch_subcategory] = (subs[p.switch_subcategory] ?? 0) + 1;
  const expected = ['thermal-switches', 'oil-pressure-warning-switches', 'brake-light-switches', 'reverse-light-switches'];
  const missing = expected.filter((e) => !subs[e]);
  return missing.length === 0 ? { ok: true, detail: Object.entries(subs).map(([k, v]) => `${k}=${v}`).join(', ') } : `缺: ${missing.join(', ')}`;
});
check('product_subtype 全为 null（V1 不区分 Insert/Assembly）', () =>
  products.filter((p) => p.product_subtype !== null).length === 0);
check('每个产品都有分类证据对象（内部审计用，客户页面不再展示）', () => {
  const bad = products.filter((p) => !p.product_type_evidence);
  return bad.length === 0 ? true : `${bad.length} 个缺证据`;
});
check('每个产品都有来源工作表列表', () => {
  const bad = products.filter((p) => !p.source_sheets?.length);
  return bad.length === 0 ? true : `${bad.length} 个缺来源表`;
});
check('site-facts.json 的公司数字与项目资料一致', () => {
  const c = facts.company;
  const expect = {
    since_year: 2009,
    manufacturing_base_m2: 10000,
    production_workshop_m2: 3500,
    temperature_controlled_workshop_m2: 2000,
    production_equipment_count: 100,
    rd_projects: 29,
    patents: 16,
    software_copyrights: 5,
  };
  const bad = Object.entries(expect).filter(([k, v]) => c[k] !== v);
  return bad.length === 0 ? { ok: true, detail: '全部一致' } : bad.map(([k, v]) => `${k}: ${c[k]} ≠ ${v}`).join(', ');
});
check('公开认证只有有证书图片的 IATF 16949（ISO 两项只留内部证据）', () => {
  const c = facts.company;
  const pub = c.public_certifications ?? [];
  const pubStandards = c.public_certification_standards ?? [];
  if (pub.length !== 1 || pub[0] !== 'IATF 16949') return `public_certifications = ${JSON.stringify(pub)}`;
  if (pubStandards.length !== 1 || !pubStandards[0].startsWith('IATF')) {
    return `public_certification_standards = ${JSON.stringify(pubStandards)}`;
  }
  const leaked = [...pub, ...pubStandards].filter((x) => /ISO\s*14001|ISO\s*45001/i.test(x));
  if (leaked.length) return `公开认证里仍有 ISO: ${leaked.join(', ')}`;
  // 内部证据必须完整保留
  const detail = facts.certifications_detail ?? [];
  const internal = detail.filter((x) => x.is_public === false).map((x) => x.standard);
  if (internal.length !== 2) return `内部记录缺失: ${JSON.stringify(internal)}`;
  return {
    ok: true,
    detail: `公开 ${pub.join(', ')}；内部保留 ${internal.join(', ')}（无证书图片，不公开）`,
  };
});

// =====================================================================
section('客户可见范围（blocked / draft 绝不外露）');
// =====================================================================
check('完整数据库里的不可发布状态（blocked / draft）一个都没进网站数据集', () => {
  // Phase 4 说明：原断言写成「blockedCount > 0 && 无泄漏」。
  // 但 data/derived/v2/products.json 当前已经没有 blocked 产品（blocked=0，draft=5），
  // 所以 blockedCount > 0 这个**前提**已经过时 —— 断言失败的原因是数据形态变了，
  // 不是网站数据集泄漏。业务规则本身没变：任何 blocked / draft 都不得对外可见。
  // 下面把「前提」泛化为「全量库里确实存在至少一种不可发布状态」，
  // 这样守卫仍然有实际约束力（当前由 draft=5 真实行使），泄漏检查一条都没删。
  const blockedCount = fullProducts.filter((p) => p.status === 'blocked' || p.blocked).length;
  const draftCount = fullProducts.filter((p) => p.status === 'draft').length;
  const leakedBlocked = products.filter((p) => p.status === 'blocked' || p.blocked);
  const leakedDraft = products.filter((p) => p.status === 'draft');

  if (blockedCount + draftCount === 0) {
    return '全量库里既没有 blocked 也没有 draft，这条守卫已失去约束力，请检查数据构建';
  }
  if (leakedBlocked.length || leakedDraft.length) {
    return `泄漏：blocked=${leakedBlocked.length} draft=${leakedDraft.length}`;
  }
  return {
    ok: true,
    detail: `全量库 blocked=${blockedCount} draft=${draftCount}，网站数据集 0 泄漏`,
  };
});
check('完整数据库里的 draft 产品没进网站数据集', () => {
  const draftCount = fullProducts.filter((p) => p.status === 'draft').length;
  return draftCount > 0 && products.filter((p) => p.status === 'draft').length === 0
    ? { ok: true, detail: `完整库 ${draftCount} 个 draft，网站数据集 0 个` }
    : 'draft 泄漏';
});
check('网站数据集里没有 published 状态', () => products.filter((p) => p.status === 'published').length === 0);

// =====================================================================
section('Phase 4.1 — 公开产品准入（有可靠主图才进网站）');
// =====================================================================
check('网站产品集合 == 从内部状态与源图片映射独立算出的公开集合', () => {
  const site = new Set(products.map((p) => p.product_id));
  const expected = new Set(independentlyComputedPublic);
  const missing = [...expected].filter((id) => !site.has(id));
  const extra = [...site].filter((id) => !expected.has(id));
  return missing.length === 0 && extra.length === 0
    ? { ok: true, detail: `${site.size} 个产品两侧完全一致` }
    : `缺失 ${missing.length}（${missing.slice(0, 5).join(', ')}）越界 ${extra.length}（${extra.slice(0, 5).join(', ')}）`;
});
check('每个网站产品都有可靠主图（product-images.json 覆盖全部产品）', () => {
  const imgs = new Set(Object.keys(productImages.images));
  const noImage = products.filter((p) => !imgs.has(p.product_id)).map((p) => p.product_id);
  return noImage.length === 0
    ? { ok: true, detail: `${products.length}/${products.length} 都有图` }
    : `${noImage.length} 个无图: ${noImage.slice(0, 8).join(', ')}`;
});
check('product-images.json 没有指向网站数据集之外的产品', () => {
  const site = new Set(products.map((p) => p.product_id));
  const extra = Object.keys(productImages.images).filter((id) => !site.has(id));
  return extra.length === 0 ? { ok: true, detail: `${productImages.count} 条映射` } : extra.slice(0, 8).join(', ');
});
check('无可靠主图的产品一个都没进网站数据集', () => {
  const site = new Set(products.map((p) => p.product_id));
  const leaked = independentlyComputedExcludedNoImage.filter((id) => site.has(id));
  return leaked.length === 0
    ? { ok: true, detail: `${independentlyComputedExcludedNoImage.length} 个无图产品全部排除` }
    : `泄漏: ${leaked.join(', ')}`;
});
check('业务方给出的 22 个无图产品与实际排除清单一致', () => {
  const business = [
    'BW-2043', 'BW-3003-3', 'BW-3004-5', 'BW-3021-1', 'BW-3192', 'BW-3508',
    'BW-3565-2', 'BW-3566', 'BW-3567', 'BW-3655-2', 'BW-3665', 'BW-3902', 'BW-3919',
    'BW-3964', 'BW-31002', 'BW-32748-2', 'BW-33111', 'BW-33561', 'BW-33655',
    'BW-35116', 'BW-36583', 'BW-403229',
  ];
  const actual = [...independentlyComputedExcludedNoImage].sort();
  const want = [...business].sort();
  const missing = want.filter((x) => !actual.includes(x));
  const extra = actual.filter((x) => !want.includes(x));
  return missing.length === 0 && extra.length === 0
    ? { ok: true, detail: `两侧都是 ${actual.length} 个，完全一致` }
    : `少 ${missing.join(', ')} 多 ${extra.join(', ')}`;
});
check('无图产品没有任何 application 或 OE 索引行进入网站数据', () => {
  const excluded = new Set(independentlyComputedExcludedNoImage);
  const badApp = applications.filter((a) => excluded.has(a.product_id)).length;
  const badOe = oeIndex.filter((e) => excluded.has(e.product_id)).length;
  return badApp === 0 && badOe === 0
    ? { ok: true, detail: '0 条 application / 0 条 OE 索引行' }
    : `application ${badApp} 条、OE 索引 ${badOe} 条泄漏`;
});
check('无图产品的详情页数据不可达（getProductById 会返回 null）', () => {
  const site = new Set(products.map((p) => p.product_id));
  return site.has('BW-3004-5') ? 'BW-3004-5 仍在网站数据集里' : { ok: true, detail: 'BW-3004-5 不在网站数据集 → 详情页 404' };
});
check('示例 OE 2550035540 / 25500-35540 命中 3 条 application、2 个产品（BW-3503 / BW-3004-3）', () => {
  const a = searchByOe('2550035540');
  const b = searchByOe('25500-35540');
  const bowens = [...new Set(a.exact.map((h) => h.product.bowen_no))].sort();
  const ok = a.exact.length === 3 && b.exact.length === 3
    && new Set(a.exact.map((h) => h.product.product_id)).size === 2
    && bowens.join(',') === '3004-3,3503';
  return ok
    ? { ok: true, detail: `两种写法各 ${a.exact.length} 条 → Bowen ${bowens.join(', ')}` }
    : `实际：2550035540=${a.exact.length} 条 / 25500-35540=${b.exact.length} 条 / Bowen ${bowens.join(', ')}`;
});
check('示例 OE 结果里不再出现无图产品 BW-3004-5', () => {
  const r = searchByOe('2550035540');
  const bad = r.exact.filter((h) => h.product.product_id === 'BW-3004-5');
  return bad.length === 0 ? { ok: true, detail: `${r.exact.length} 条命中，无 BW-3004-5` } : 'BW-3004-5 仍然命中';
});
check('首页统计口径与列表/分类/OE 数量一致', () => {
  const cats = {};
  for (const p of products) cats[p.website_category ?? '(none)'] = (cats[p.website_category ?? '(none)'] ?? 0) + 1;
  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0);
  const published = products.filter((p) => p.status === 'prototype_candidate' || p.status === 'searchable_noindex');
  const distinctOe = new Set(oeIndex.map((e) => e.oe_search_key)).size;
  return catTotal === products.length && published.length === products.length
    ? {
      ok: true,
      detail: `${products.length} 产品 / ${applications.length} application / ${oeIndex.length} OE 行 / ${distinctOe} 个不同 OE`,
    }
    : `分类合计 ${catTotal} vs 产品 ${products.length}`;
});
check('公开地址字段与业务方确认的地址一致', () => {
  const c = facts.company;
  const want = 'No. 3, Duzhi Road, Qufu Electronic Information Industrial Park, '
    + 'Jining City, Shandong Province, 273100, China';
  return c.address_en === want && c.postal_code === '273100' && c.country === 'China'
    ? { ok: true, detail: c.address_en }
    : `实际 ${JSON.stringify({ address_en: c.address_en, postal_code: c.postal_code, country: c.country })}`;
});
check('site-facts 不再包含「没有地址」的旧字段/旧说法', () => {
  const c = facts.company;
  const blob = JSON.stringify(c);
  const bad = /address_note|address pending|no street address|不展示地址|地址未确认/.test(blob);
  return !bad && c.address_evidence ? { ok: true, detail: '已替换为 address_evidence（内部说明）' } : '仍残留旧地址说明';
});
check('荣誉/公示材料的 document_kind 正确（公示名单不是管理体系证书）', () => {
  const honors = facts.honors ?? [];
  const list = honors.filter((h) => h.document_kind === 'public_list').map((h) => h.name);
  const bad = honors.filter((h) => !h.document_kind).length;
  if (bad) return `${bad} 项缺 document_kind`;
  return list.length === 1 && /public list/i.test(list[0])
    ? { ok: true, detail: `${honors.length} 项，其中公示名单 ${list.length} 项：${list[0]}` }
    : `公示名单标注异常: ${JSON.stringify(list)}`;
});

// =====================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ Phase 3 原型数据全部通过。');
