#!/usr/bin/env node
/**
 * Phase 4.1 — 网站数据与图片资产的**统一刷新入口**
 * ===========================================================================
 * 为什么需要它：网站数据（products/applications/oe-index）与产品图映射
 * （product-images.json + website/public/assets/products）必须来自同一个发布集合。
 * 如果只跑其中一个，就会出现「数据里有产品但没图」或「有图但数据里没有」。
 *
 * 固定顺序（每一步都失败即停，不静默继续）：
 *   1. 构建内部产品数据                     node tools/build-product-db-v2.mjs
 *      （同时按准入规则导出 website/src/data + data/derived/v2/publication-gate.json）
 *   2. 复制网站图片并生成图片映射            node tools/p4-build-site-assets.mjs
 *      （读取同一份 publication-gate，不反过来读 website 数据 → 无循环依赖）
 *   3. 只读校验：内部数据库                  node tools/verify-product-db-v2.mjs
 *   4. 只读校验：资产与发布集合              node tools/p4-build-site-assets.mjs --verify
 *   5. 只读校验：网站数据集                  node website/tools/verify-prototype-data.mjs
 *   6. 只读守卫：公开页面内容边界            node website/tools/verify-public-surface.mjs
 *
 * 说明：本脚本本身**不**写任何业务文件，只是按顺序调用上面这些命令；
 * 所有子进程都用 stdio:'inherit'（不捕获输出），以便在受限沙箱下也能运行。
 *
 * 用法：node tools/refresh-site-data.mjs
 *       node tools/refresh-site-data.mjs --skip-assets   （只重建数据，不动图片）
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_ASSETS = process.argv.includes('--skip-assets');

const STEPS = [
  ['构建内部产品数据（含网站数据导出）', ['tools/build-product-db-v2.mjs'], ROOT],
  ...(SKIP_ASSETS ? [] : [['复制网站图片 + 生成图片映射', ['tools/p4-build-site-assets.mjs'], ROOT]]),
  ['只读校验：内部数据库', ['tools/verify-product-db-v2.mjs'], ROOT],
  ...(SKIP_ASSETS ? [] : [['只读校验：资产与发布集合', ['tools/p4-build-site-assets.mjs', '--verify'], ROOT]]),
  ['只读校验：网站数据集', ['tools/verify-prototype-data.mjs'], path.join(ROOT, 'website')],
  ['只读守卫：公开页面内容边界', ['tools/verify-public-surface.mjs'], path.join(ROOT, 'website')],
  ['只读回归：车型/机型提取', ['tools/verify-engine-code.mjs'], path.join(ROOT, 'website')],
];

console.log('=== 网站数据与资产刷新（Phase 4.1 固定顺序）===');
console.log(`根目录: ${ROOT}`);
console.log(`步骤数: ${STEPS.length}${SKIP_ASSETS ? '（已跳过图片步骤）' : ''}\n`);

const results = [];
for (const [label, args, cwd] of STEPS) {
  console.log(`\n${'─'.repeat(74)}\n▶ ${label}\n  $ node ${args.join(' ')}   (cwd: ${path.relative(ROOT, cwd) || '.'})\n${'─'.repeat(74)}`);
  const res = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  const ok = res.status === 0;
  results.push({ label, ok, status: res.status });
  if (!ok) {
    console.error(`\n❌ 步骤失败，已停止：${label}（exit ${res.status}）`);
    console.log('\n--- 汇总 ---');
    for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
    process.exit(1);
  }
}

console.log(`\n${'='.repeat(74)}`);
console.log('--- 汇总 ---');
for (const r of results) console.log(`  PASS  ${r.label}`);
console.log('\n✅ 数据、图片资产与全部只读校验一致，刷新完成。');
