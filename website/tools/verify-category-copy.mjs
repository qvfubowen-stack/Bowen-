#!/usr/bin/env node
/**
 * 产品分类文案与分类模型守卫测试
 * ===========================================================================
 * 需求（V1 分类规则）：
 *   1. 产品分类统一使用 Thermostat；
 *   2. Insert / Assembly 只能作为**制造工艺**或**原始资料词汇**出现；
 *   3. 不得生成独立分类、筛选项或主次产品逻辑。
 *
 * 本测试同时检查「数据模型」与「页面文案」，避免以后有人不小心把它们
 * 又变成分类。既查 website/src/data/*.json，也扫 website/src 下的源码。
 *
 * 用法：node tools/verify-category-copy.mjs
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
let group = '';

function section(t) { group = t; console.log(`\n${'─'.repeat(74)}\n${t}\n${'─'.repeat(74)}`); }
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
const products = read(path.join(DATA, 'products.json'));
const applications = read(path.join(DATA, 'applications.json'));

/** 递归收集源码文件 */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const SOURCE_FILES = walk(SRC).filter((f) => !f.startsWith(DATA));

console.log('博文外贸独立站 — 分类文案与分类模型守卫测试');
console.log(`扫描源码 ${SOURCE_FILES.length} 个文件，产品数据 ${products.length} 条`);

// =====================================================================
section('A. 数据模型：只能有 Canonical 产品类型');
// =====================================================================
/**
 * product_type 在数据库里存的是 tools/config/product-types.mjs 的**键**（canonical key），
 * 页面上再通过 replace(/([a-z])([A-Z])/g,'$1 $2') 转成展示名。
 * 这里必须用键来比对。
 */
const CANONICAL = new Set([
  'Thermostat',
  'TemperatureSensor',
  'ThermalSwitch',
  'OilPressureWarningSwitch',
  'BrakeLightSwitch',
  'ReverseLightSwitch',
  'RelatedCoolingPart',
]);

check('product_type 只能是词典里的 canonical 值', () => {
  const bad = products.filter((p) => p.product_type && !CANONICAL.has(p.product_type));
  return bad.length === 0
    ? { ok: true, detail: [...new Set(products.map((p) => p.product_type).filter(Boolean))].join(', ') }
    : `非法类型: ${[...new Set(bad.map((b) => b.product_type))].join(', ')}`;
});
check('不存在 Thermostat Insert / Thermostat Assembly / Automotive Thermostat 作为 product_type', () => {
  const banned = /insert|assembly|automotive thermostat/i;
  const bad = products.filter((p) => p.product_type && banned.test(p.product_type));
  return bad.length === 0 ? true : `${bad.length} 个产品仍被拆分`;
});
check('产品分类里不出现 insert / assembly', () => {
  const bad = products.filter((p) => /\binsert\b|\bassembly\b/i.test(p.website_category ?? ''));
  return bad.length === 0 ? true : `${bad.length} 个产品的 website_category 含禁用词`;
});
check('汽车开关之外没有其他子分类（节温器不得有子分类）', () => {
  const withSub = products.filter((p) => p.switch_subcategory);
  const bad = withSub.filter((p) => p.website_category !== 'automotive-switches');
  if (bad.length) return `${bad.length} 个非开关产品带 switch_subcategory`;
  const thermoWithSub = products.filter((p) => p.product_type === 'Thermostat' && p.switch_subcategory);
  return thermoWithSub.length === 0
    ? { ok: true, detail: `仅 ${withSub.length} 个开关产品有子分类` }
    : `${thermoWithSub.length} 个节温器产品带了子分类`;
});
check('product_subtype 全部为 null（不在网站层做 Insert/Assembly 区分）', () => {
  const bad = products.filter((p) => p.product_subtype !== null);
  return bad.length === 0 ? true : `${bad.length} 个产品有 subtype`;
});

// =====================================================================
section('B. 数据模型：不得有主/次产品逻辑');
// =====================================================================
check('产品数据里没有主/次产品字段', () => {
  const blob = JSON.stringify(products[0] ?? {}) + JSON.stringify(applications[0] ?? {});
  const bad = ['is_primary', 'is_main', 'main_product', 'primary_product', 'product_rank']
    .filter((k) => blob.includes(k));
  return bad.length === 0 ? true : `发现字段: ${bad.join(', ')}`;
});
check('产品数据里没有主/次 OE 字段', () => {
  const blob = JSON.stringify(products[0] ?? {}) + JSON.stringify(applications[0] ?? {});
  const bad = ['main_oe', 'primary_oe', 'secondary_oe', 'oe_rank', 'is_main_oe']
    .filter((k) => blob.includes(k));
  return bad.length === 0 ? true : `发现字段: ${bad.join(', ')}`;
});

// =====================================================================
section('C. 源码：不得把 Insert / Assembly 做成分类或筛选项');
// =====================================================================
/**
 * 允许出现的场景（不进 fail）：
 *   - 制造工艺：Assembly / Automated Assembly / machining, assembly and testing
 *   - 品牌定位：Automotive Thermostat Manufacturer / automotive thermostat
 *   - 本守卫测试自己的禁用词清单（本文件不在扫描范围内）
 *   - 术语翻译词典里的**成对字面量**（见下面 isExemptTermEntry 的说明）
 * 禁止出现的场景：把它们当产品分类/筛选项/产品名称的一部分。
 */
const FORBIDDEN_COPY = [
  { re: /thermostat\s+inserts?\b/i, why: '把 thermostat insert 当产品/分类' },
  { re: /thermostat\s+assembl(?:y|ies)\b/i, why: '把 thermostat assembly 当产品/分类' },
  { re: /\binserts?\s+and\s+(?:thermostat\s+)?assembl/i, why: '并列成两个产品种类' },
  { re: /\binsert\s+vs\.?\s+(?:thermostat\s+)?assembl/i, why: '对比成两个产品种类' },
  { re: /sub-?categor(?:y|ies)\s*[:=]\s*\[[^\]]*insert/i, why: '把 insert 做成子分类' },
];

/**
 * 例外：术语翻译词典（中文原文 → 英文展示词）
 * ---------------------------------------------------------------------------
 * Phase 5 接手时本检查是**失败**的，命中 3 行，全部来自
 * src/lib/application-display.ts 的 TERMS 词典：
 *     ['节温器总成', 'Thermostat assembly'],
 *     ['节温器芯三件套', 'Thermostat insert kit'],
 * 这些是"把源工作簿里的中文零件名翻成英文"的术语映射，
 * 客户页面上并不会出现「Thermostat assembly」这样的产品分类或筛选项
 * （产品分类只有 tools/config/product-types.mjs 里的 canonical 值，已由 A 段校验）。
 *
 * 因此这里把例外限定到最小范围：
 *   1. 只豁免 src/lib/application-display.ts 这一个词典文件；
 *   2. 只豁免形如 ['中文', 'English'], 的成对字面量行（一行可以有多对，但整行
 *      必须全部是这种字面量，不能夹带其它代码）；
 *   3. app/ 与 components/ 下的页面文案**永不**豁免（下方有专门断言）。
 * 这样既修掉了误报，也没有放宽"页面不得把 insert/assembly 当分类"这条真规则。
 */
const TERM_TABLE_FILE = path.join('src', 'lib', 'application-display.ts');
const TERM_ENTRY_LINE = /^\s*(?:\[['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\]\s*,?\s*)+$/;

function isExemptTermEntry(file, line) {
  if (path.relative(ROOT, file) !== TERM_TABLE_FILE) return false;
  return TERM_ENTRY_LINE.test(line);
}

check('源码里没有把 Insert / Assembly 当产品分类或筛选项的文案', () => {
  const hits = [];
  let exempted = 0;
  for (const file of SOURCE_FILES) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const rule of FORBIDDEN_COPY) {
      lines.forEach((line, i) => {
        if (!rule.re.test(line)) return;
        if (isExemptTermEntry(file, line)) { exempted += 1; return; }
        hits.push(`${path.relative(ROOT, file)}:${i + 1} [${rule.why}] ${line.trim().slice(0, 100)}`);
      });
    }
  }
  return hits.length === 0
    ? { ok: true, detail: `扫描 ${SOURCE_FILES.length} 个文件，0 命中（术语词典豁免 ${exempted} 行）` }
    : `${hits.length} 处:\n      ` + hits.join('\n      ');
});

check('术语词典例外不适用于页面文件（app / components 永不豁免）', () => {
  const pageFiles = SOURCE_FILES.filter((f) => /[\\/]src[\\/](app|components)[\\/]/.test(f));
  const bad = pageFiles.filter((f) => fs.readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .some((line) => isExemptTermEntry(f, line)));
  return bad.length === 0
    ? { ok: true, detail: `页面文件 ${pageFiles.length} 个，0 个命中例外` }
    : bad.map((f) => path.relative(ROOT, f)).join(', ');
});


check('不存在把 Insert/Assembly 写进筛选项数组的代码', () => {
  const hits = [];
  for (const file of SOURCE_FILES) {
    const text = fs.readFileSync(file, 'utf8');
    // 找形如 ['Thermostat Insert', ...] / ["Thermostat Assembly"] 的选项数组
    if (/\[\s*['"`][^'"`]*(?:Insert|Assembly)[^'"`]*['"`]\s*(?:,|\])/.test(text)) {
      // 允许：工艺步骤标题数组（Machining/Assembly/Automated Assembly/Testing）
      const allowed = /Machining|Automated Assembly|Testing/.test(text);
      if (!allowed) hits.push(path.relative(ROOT, file));
    }
  }
  return hits.length === 0 ? true : `可疑文件: ${hits.join(', ')}`;
});

check('分类描述里不再列举 insert / assembly 作为产品种类', () => {
  const hits = [];
  for (const file of SOURCE_FILES) {
    const text = fs.readFileSync(file, 'utf8');
    // 反向检查：thermostats 分类的 description 不得出现 inserts/assemblies
    const m = text.match(/thermostats:\s*\{[\s\S]*?description:\s*([\s\S]*?),\n\s*\}/);
    if (m && /insert|assembl/i.test(m[1])) hits.push(path.relative(ROOT, file));
  }
  return hits.length === 0 ? true : `分类描述仍含禁用词: ${hits.join(', ')}`;
});

// =====================================================================
section('D. 允许的用法仍然保留（不能被误删）');
// =====================================================================
check('品牌定位 "Automotive Thermostat Manufacturer" 仍然存在', () => {
  const hits = SOURCE_FILES.filter((f) => /Automotive Thermostat\s*<?br?\s*\/?>?\s*Manufacturer|Automotive Thermostat Manufacturer/i.test(fs.readFileSync(f, 'utf8')));
  return hits.length > 0
    ? { ok: true, detail: `${hits.length} 处（首页/页头等）` }
    : '品牌定位文案丢了';
});
check('Factory 页仍保留 Assembly 作为制造工艺步骤', () => {
  const f = path.join(SRC, 'app', '(site)', 'factory', 'page.tsx');
  const text = fs.readFileSync(f, 'utf8');
  const hasMachining = /Machining/.test(text);
  const hasAssembly = /title: 'Assembly'/.test(text);
  const hasAuto = /Automated Assembly/.test(text);
  const hasTesting = /Testing/.test(text);
  return hasMachining && hasAssembly && hasAuto && hasTesting
    ? { ok: true, detail: 'Machining / Assembly / Automated Assembly / Testing 四步都在' }
    : `缺少步骤: ${[!hasMachining && 'Machining', !hasAssembly && 'Assembly', !hasAuto && 'Automated Assembly', !hasTesting && 'Testing'].filter(Boolean).join(', ')}`;
});

// =====================================================================
console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ 分类模型与文案守卫测试全部通过。');
