#!/usr/bin/env node
/**
 * Phase 4.1 — 车型/机型原文提取的回归测试
 * ===========================================================================
 * 背景：原实现在 website/src/lib/engine-code.ts 里用 /[A-Z][A-Z0-9]{2,11}/g 提取，
 * 结果：
 *   4G6     → 空数组（数字开头的代号被整段漏掉）
 *   4G13    → G13（删掉了首位数字，改变了代号）
 *   4G15S   → G15S（同上）
 *   476ZQA  → 空数组
 *   A4L/F150→ 被当成发动机候选输出
 *
 * Phase 4.1 的处理是**保守**的：
 *   1. 提取逻辑修复为保留完整字符串、允许数字开头；
 *   2. 但提取结果**不再在首页 / 产品详情 / 筛选入口公开展示**；
 *   3. 车型代号（A4L / F150）永远不能被声明为已确认发动机标签。
 *
 * 本脚本同时验证「函数正确性」和「公开展示已暂停」两件事。
 * 直接 import TypeScript 源文件（Node 24 内置类型擦除）。
 *
 * 用法：node tools/verify-engine-code.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEngineCodes, extractDisplacements } from '../src/lib/engine-code.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'src');

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
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

console.log('博文外贸独立站 — 车型/机型原文提取回归测试（Phase 4.1）');

// =====================================================================
section('A. 必须保留完整字符串（不得截断、不得漏掉数字开头的代号）');
// =====================================================================
const CASES = [
  ['4G13', '4G13'],
  ['4G15S', '4G15S'],
  ['4G6', '4G6'],
  ['476ZQA', '476ZQA'],
  ['EA888', 'EA888'],
  ['EA111', 'EA111'],
  ['2RZ', '2RZ'],
  ['MR20', 'MR20'],
  ['G4KE', 'G4KE'],
  ['4JJ1', '4JJ1'],
  ['TU5JP4', 'TU5JP4'],
  ['ZG25', 'ZG25'],
  ['DK4A', 'DK4A'],
];
for (const [input, expected] of CASES) {
  check(`${input} 提取结果完整包含 ${expected}`, () => {
    const got = extractEngineCodes(input);
    return got.includes(expected)
      ? { ok: true, detail: JSON.stringify(got) }
      : `实际 ${JSON.stringify(got)}`;
  });
}

check('4G13 不会变成 G13', () => {
  const got = extractEngineCodes('4G13');
  return got.includes('4G13') && !got.includes('G13')
    ? { ok: true, detail: JSON.stringify(got) }
    : `实际 ${JSON.stringify(got)}`;
});
check('4G15S 不会变成 G15S', () => {
  const got = extractEngineCodes('4G15S');
  return got.includes('4G15S') && !got.includes('G15S')
    ? { ok: true, detail: JSON.stringify(got) }
    : `实际 ${JSON.stringify(got)}`;
});
check('4G6 不会因为正则丢掉首位数字', () => {
  const got = extractEngineCodes('4G6');
  return got.length === 1 && got[0] === '4G6'
    ? { ok: true, detail: JSON.stringify(got) }
    : `实际 ${JSON.stringify(got)}`;
});
check('476ZQA 不再被漏掉', () => {
  const got = extractEngineCodes('476ZQA');
  return got.includes('476ZQA') ? { ok: true, detail: JSON.stringify(got) } : `实际 ${JSON.stringify(got)}`;
});
check('混合原文里每个代号都完整保留', () => {
  const got = extractEngineCodes('4G13 4G15S 4G6 476ZQA EA888');
  const want = ['4G13', '4G15S', '4G6', '476ZQA', 'EA888'];
  const missing = want.filter((w) => !got.includes(w));
  const truncated = got.filter((g) => !want.includes(g));
  return missing.length === 0 && truncated.length === 0
    ? { ok: true, detail: JSON.stringify(got) }
    : `缺 ${missing.join(',')} 多 ${truncated.join(',')}`;
});

// =====================================================================
section('B. 噪音与单位不得被当成代号');
// =====================================================================
check('纯数字不算代号', () => extractEngineCodes('2009 2014 25500') .length === 0);
check('数值+单位不算代号', () => {
  const got = extractEngineCodes('92C 1.5L 2.0T 100MM 3KG 12V 5W');
  return got.length === 0 ? true : JSON.stringify(got);
});
check('常见配置缩写不算代号', () => {
  const got = extractEngineCodes('ABS OEM AT MT CVT DOHC TDI AWD SUV 4WD');
  return got.length === 0 ? true : JSON.stringify(got);
});
check('空输入返回空数组', () => extractEngineCodes('').length === 0
  && extractEngineCodes(null).length === 0 && extractEngineCodes(undefined).length === 0);
check('排量提取仍然可用（1.5T / 2.0L）', () => {
  const got = extractDisplacements('1.5T 2.0L 1.6');
  return got.join(',') === '1.5T,2.0L,1.6' ? { ok: true, detail: got.join(',') } : got.join(',');
});

// =====================================================================
section('C. A4L / F150 只是候选，绝不能作为「已确认发动机」输出到页面');
// =====================================================================
check('A4L / F150 会被提为候选（因此更不能直接展示）', () => {
  const got = extractEngineCodes('Audi A4L F150 X1X3X5X4X6');
  return got.includes('A4L') && got.includes('F150')
    ? { ok: true, detail: `${JSON.stringify(got)} —— 候选不等于发动机，页面已停止展示` }
    : `实际 ${JSON.stringify(got)}`;
});

const SRC_FILES = (() => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
    }
  };
  walk(SRC);
  return out;
})();

check('没有任何页面/组件 import extractEngineCodes（公开展示已暂停）', () => {
  const users = SRC_FILES.filter((f) => {
    if (f.endsWith('engine-code.ts')) return false;
    return /extractEngineCodes/.test(fs.readFileSync(f, 'utf8'));
  });
  return users.length === 0
    ? { ok: true, detail: `扫描 ${SRC_FILES.length} 个源文件，0 处引用（仅内部模块自身保留）` }
    : users.map((f) => path.relative(ROOT, f)).join(', ');
});
check('页面源码里不再出现「Engine codes in text」这类已确认发动机的表述', () => {
  const bad = SRC_FILES.filter((f) => /Engine codes in text|sampleEngines\s*\.|engineTags/.test(fs.readFileSync(f, 'utf8')));
  return bad.length === 0 ? { ok: true, detail: '0 处' } : bad.map((f) => path.relative(ROOT, f)).join(', ');
});
check('首页不再出现按发动机筛选的链接（/products?engine=）', () => {
  const home = path.join(SRC, 'app', '(site)', 'page.tsx');
  const explorer = path.join(SRC, 'components', 'MakeExplorer.tsx');
  const bad = [home, explorer].filter((f) => /products\?engine=/.test(fs.readFileSync(f, 'utf8')));
  return bad.length === 0 ? { ok: true, detail: '0 处' } : bad.map((f) => path.relative(ROOT, f)).join(', ');
});
check('筛选面板不再内置发动机代号候选列表（datalist）', () => {
  const f = path.join(SRC, 'components', 'ProductFilters.tsx');
  const text = fs.readFileSync(f, 'utf8');
  const hasDatalist = /ENGINE_SUGGESTIONS|engine-suggestions/.test(text);
  return hasDatalist ? '仍存在发动机候选 datalist' : { ok: true, detail: '已移除 ENGINE_SUGGESTIONS / datalist' };
});

console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ 车型/机型提取回归测试全部通过（且已确认不再公开展示）。');
