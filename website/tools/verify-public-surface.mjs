#!/usr/bin/env node
/**
 * Phase 4.1 — 公开页面「内部文案 / 未公开认证 / 未确认发动机标签」守卫
 * ===========================================================================
 * 客户页面上不允许出现的东西，这里分三层检查：
 *   A. 页面源码（website/src/app、website/src/components）里的可见英文文案
 *   B. 客户可见数据（site-facts.json / products.json / product-images.json）
 *   C. 关键的「不能偷偷回来」的守卫（ISO 两项、Internal/Prototype 标记、来源工作表名）
 *
 * 说明：这里检查的是**页面会渲染的内容**。内部证据（data/derived、data/processed、
 * site-facts.json 里的 certifications / certification_standards / evidence 字段）
 * 不在清理范围内，也不会被要求删除。
 *
 * 用法：node tools/verify-public-surface.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'src');
const DATA = path.join(SRC, 'data');

let pass = 0;
let fail = 0;
const failures = [];
function section(t) { console.log(`\n${'─'.repeat(74)}\n${t}\n${'─'.repeat(74)}`); }
function check(name, fn) {
  let ok = false; let detail = '';
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (typeof r === 'string') detail = r;
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
  } catch (e) { detail = `异常: ${e.message}`; }
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(`[${name}] ${detail}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

/** 页面源码 = app + components；不含 data 目录、不含 lib（lib 里有内部注释） */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const PAGE_FILES = [...walk(path.join(SRC, 'app')), ...walk(path.join(SRC, 'components'))]
  .filter((f) => !/\.module\.css$/.test(f)); // CSS 里没有客户可见文案

const read = (p) => fs.readFileSync(p, 'utf8');
const data = (f) => JSON.parse(read(path.join(DATA, f)));

/**
 * 去掉注释后再找「客户可见文案」。
 * 源码里为了说明为什么不能外露，注释中会提到 source_sheets / ISO 等字样，
 * 那些不会渲染给客户，不该被当成泄漏。
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
/** 页面源码（去掉注释） */
const PAGE_TEXT = new Map(PAGE_FILES.map((f) => [f, stripComments(read(f))]));

console.log('博文外贸独立站 — 公开页面内容边界守卫（Phase 4.1）');
console.log(`扫描页面源码 ${PAGE_FILES.length} 个文件`);

// =====================================================================
section('A. 内部原型 / 数据处理说明不得出现在客户页面');
// =====================================================================
const FORBIDDEN_COPY = [
  { id: 'prototype-marker', re: /UI Prototype|Prototype\s*#|Prototype candidate|Phase 3\b/i, why: '内部原型标记' },
  { id: 'publication-state', re: /Not published|\bNo index\b|noindex/i, why: '内部发布状态说明' },
  { id: 'source-sheets', re: /Source sheets?|source_sheet|工作表|审核表|review sheet/i, why: '源 Excel 工作表/行号' },
  { id: 'classification-process', re: /How this classification was made|product_type_source|classification evidence/i, why: '分类过程说明' },
  { id: 'subtype-note', re: /Subtype:\s*not used|not used in V1/i, why: 'subtype 内部备注' },
  { id: 'evidence-pages', re: /brochure_page|company profile, page\s*\{?\d|evidence source page/i, why: '内部证据页码说明' },
  { id: 'address-missing', re: /do not publish a guessed address|no street address is shown|address pending|地址未确认/i, why: '地址缺失说明' },
  { id: 'cert-missing', re: /does not reproduce those two certificates|no certificate image is shown for them|cannot reproduce as a document image|are not published on this page/i, why: '证书缺图说明' },
];

for (const rule of FORBIDDEN_COPY) {
  check(`页面源码不含「${rule.why}」`, () => {
    const hits = [];
    for (const f of PAGE_FILES) {
      PAGE_TEXT.get(f).split(/\r?\n/).forEach((line, i) => {
        if (rule.re.test(line)) hits.push(`${path.relative(ROOT, f)}:${i + 1} ${line.trim().slice(0, 90)}`);
      });
    }
    return hits.length === 0 ? { ok: true, detail: '0 命中' } : hits.join(' | ');
  });
}

check('页面源码不出现中文工作表名（综合产品信息表 / 工作表1 / 大众系列 …）', () => {
  const re = /综合产品信息表|工作表\s*\d|大众系列|宝马奔驰系列|日系|福特系列/;
  const hits = PAGE_FILES.filter((f) => re.test(PAGE_TEXT.get(f))).map((f) => path.relative(ROOT, f));
  return hits.length === 0 ? { ok: true, detail: '0 命中' } : hits.join(', ');
});

// =====================================================================
section('B. 未公开认证（无证书图片）不得出现在任何公开入口');
// =====================================================================
check('页面源码不出现 ISO 14001 / ISO 45001', () => {
  const re = /ISO\s*14001|ISO\s*45001/;
  const hits = PAGE_FILES.filter((f) => re.test(PAGE_TEXT.get(f))).map((f) => path.relative(ROOT, f));
  return hits.length === 0 ? { ok: true, detail: '0 命中（只允许出现在 tools/config 与内部数据）' } : hits.join(', ');
});
check('页面源码不出现「three management systems」「Three certificates」', () => {
  const re = /three management systems|three certificates|three standards/i;
  const hits = PAGE_FILES.filter((f) => re.test(PAGE_TEXT.get(f))).map((f) => path.relative(ROOT, f));
  return hits.length === 0 ? { ok: true, detail: '0 命中' } : hits.join(', ');
});
check('页面源码不直接读取内部认证字段 certifications / certification_standards', () => {
  const hits = [];
  for (const f of PAGE_FILES) {
    PAGE_TEXT.get(f).split(/\r?\n/).forEach((line, i) => {
      // 允许 public_certifications / public_certification_standards
      if (/\.certifications\b|\.certification_standards\b/.test(line) && !/public_certifications|public_certification_standards/.test(line)) {
        hits.push(`${path.relative(ROOT, f)}:${i + 1} ${line.trim().slice(0, 90)}`);
      }
    });
  }
  return hits.length === 0 ? { ok: true, detail: '页面只用 public_* 字段' } : hits.join(' | ');
});
check('site-facts.json 的公开认证字段只有 IATF', () => {
  const c = data('site-facts.json').company;
  const pub = [...(c.public_certifications ?? []), ...(c.public_certification_standards ?? [])];
  const bad = pub.filter((x) => !/IATF/i.test(x));
  return bad.length === 0 ? { ok: true, detail: pub.join(', ') } : bad.join(', ');
});
check('ISO 两项的内部证据仍然保留（不是被删除，只是不公开）', () => {
  const f = data('site-facts.json');
  const internal = (f.certifications_detail ?? []).filter((x) => x.is_public === false).map((x) => x.standard);
  return internal.length === 2 ? { ok: true, detail: internal.join(', ') } : JSON.stringify(internal);
});
check('证书图片清单里没有任何 ISO 证书图', () => {
  const sm = data('site-media.json');
  const bad = sm.certificates.filter((x) => /iso-?14001|iso-?45001/i.test(x.src)).map((x) => x.src);
  return bad.length === 0 ? { ok: true, detail: `${sm.certificates.length} 张证书/荣誉图` } : bad.join(', ');
});
check('公示名单没有被写成管理体系认证证书', () => {
  const honors = data('site-facts.json').honors ?? [];
  const list = honors.filter((h) => h.document_kind === 'public_list');
  const mislabelled = list.filter((h) => /certificate of|management system certificate/i.test(h.name));
  return list.length === 1 && mislabelled.length === 0
    ? { ok: true, detail: `${list[0].name}（public list）` }
    : `public_list 项 ${list.length}，误标 ${mislabelled.length}`;
});

// =====================================================================
section('C. 未确认的发动机标签不得公开展示');
// =====================================================================
check('页面源码不 import extractEngineCodes', () => {
  const hits = PAGE_FILES.filter((f) => /extractEngineCodes/.test(read(f))).map((f) => path.relative(ROOT, f));
  return hits.length === 0 ? { ok: true, detail: '0 处' } : hits.join(', ');
});
check('页面源码没有「Engine / Engine codes」作为已确认字段展示', () => {
  const hits = [];
  for (const f of PAGE_FILES) {
    PAGE_TEXT.get(f).split(/\r?\n/).forEach((line, i) => {
      if (/<dt>\s*Engine|Engine \/ Application|Engine codes in text|sampleEngines/.test(line)) {
        hits.push(`${path.relative(ROOT, f)}:${i + 1} ${line.trim().slice(0, 90)}`);
      }
    });
  }
  return hits.length === 0 ? { ok: true, detail: '0 命中' } : hits.join(' | ');
});
check('筛选面板不再内置发动机代号候选（datalist / ENGINE_SUGGESTIONS）', () => {
  const f = path.join(SRC, 'components', 'ProductFilters.tsx');
  const text = read(f);
  return /ENGINE_SUGGESTIONS|engine-suggestions/.test(text) ? '仍存在发动机候选列表' : { ok: true, detail: '已移除' };
});

// =====================================================================
section('D. 地址与联系方式');
// =====================================================================
check('Contact 页展示已确认的街道地址', () => {
  const f = path.join(SRC, 'app', '(site)', 'contact', 'page.tsx');
  const text = read(f);
  return /c\.address_en/.test(text) && /<dt>Address<\/dt>/.test(text)
    ? { ok: true, detail: 'Contact 页从 site-facts 读取 address_en' }
    : 'Contact 页没有展示 address_en';
});
check('页脚展示已确认的街道地址', () => {
  const f = path.join(SRC, 'components', 'SiteFooter.tsx');
  return /company\.address_en/.test(read(f)) ? { ok: true, detail: 'Footer 简要展示地址' } : 'Footer 未展示地址';
});
check('没有添加地图坐标 / 营业时间 / 海外办公室 / WhatsApp 公司账号', () => {
  const re = /geo:|latitude|longitude|Business hours|营业时间|overseas office|WhatsApp\s*[:：]\s*\+?86/i;
  const hits = PAGE_FILES.filter((f) => re.test(PAGE_TEXT.get(f))).map((f) => path.relative(ROOT, f));
  return hits.length === 0 ? { ok: true, detail: '0 命中' } : hits.join(', ');
});

// =====================================================================
section('E. Blog 入口已隐藏（页面本身可留，但不再导航）');
// =====================================================================
check('Header 不再出现 /blog 入口', () => {
  const f = path.join(SRC, 'components', 'SiteHeader.tsx');
  return /['"]\/blog['"]/.test(read(f)) ? 'Header 仍有 /blog' : { ok: true, detail: '已从主导航移除' };
});
check('Footer 不再出现 /blog 入口', () => {
  const f = path.join(SRC, 'components', 'SiteFooter.tsx');
  return /['"]\/blog['"]/.test(read(f)) ? 'Footer 仍有 /blog' : { ok: true, detail: '已从页脚移除' };
});

console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ 公开页面内容边界检查全部通过。');
