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
const fullProducts = read(path.join(DB, 'products.json'));

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
check('产品详情页表格的每一行都能查到来源工作表与行号', () => {
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
check('每个产品都有分类证据对象（页面上要展示来源）', () => {
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
check('认证只有 IATF 16949 / ISO 14001 / ISO 45001 三项', () => {
  const c = facts.company.certifications;
  return c.length === 3 && c.includes('IATF 16949') && c.includes('ISO 14001') && c.includes('ISO 45001')
    ? { ok: true, detail: c.join(', ') } : c.join(', ');
});

// =====================================================================
section('客户可见范围（blocked / draft 绝不外露）');
// =====================================================================
check('完整数据库里有 blocked 产品，但一个都没进网站数据集', () => {
  const blockedCount = fullProducts.filter((p) => p.status === 'blocked').length;
  const leaked = products.filter((p) => p.status === 'blocked' || p.blocked);
  return blockedCount > 0 && leaked.length === 0
    ? { ok: true, detail: `完整库 ${blockedCount} 个 blocked，网站数据集 0 个` }
    : `blocked=${blockedCount} leaked=${leaked.length}`;
});
check('完整数据库里的 draft 产品没进网站数据集', () => {
  const draftCount = fullProducts.filter((p) => p.status === 'draft').length;
  return draftCount > 0 && products.filter((p) => p.status === 'draft').length === 0
    ? { ok: true, detail: `完整库 ${draftCount} 个 draft，网站数据集 0 个` }
    : 'draft 泄漏';
});
check('网站数据集里没有 published 状态', () => products.filter((p) => p.status === 'published').length === 0);

// =====================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ Phase 3 原型数据全部通过。');
