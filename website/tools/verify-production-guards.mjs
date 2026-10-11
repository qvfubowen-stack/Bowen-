#!/usr/bin/env node
/**
 * Phase 5.1 — 生产就绪硬保护验收（含两次真实 next build）
 * ===========================================================================
 * 为什么必须真跑构建：
 *   "生产缺 Supabase / Resend / Turnstile 时构建失败" 这条要求，
 *   只有真的执行一次 `next build` 才算验证，纯函数断言证明不了 next.config.ts 真的接上了。
 *
 * 三次构建（按顺序，全部通过 node_modules/next 直接调用，不依赖 pnpm）：
 *   #1 VERCEL_ENV=production + 故意缺项      → 必须**失败**，且错误里只出现变量名，不出现变量值
 *   #2 VERCEL_ENV=production + 完整（假）凭据 → 必须**成功**
 *   #3 无 VERCEL_ENV（本地/Preview 形态）     → 必须**成功**（证明本地构建不被缺凭据阻断）
 *
 * ⚠️ 构建 #2 会把 NEXT_PUBLIC_SITE_URL 烘焙进 .next；构建 #3 会把它恢复成交付默认形态。
 *    因此本脚本应当安排在所有 dev 服务器测试之后、交付前的最后一次构建。
 *
 * 用法：node tools/verify-production-guards.mjs
 *      SKIP_BUILD=1 node tools/verify-production-guards.mjs   # 只跑纯逻辑断言（快速回归）
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import { WEBSITE_ROOT, createChecker } from './lib/verify-helpers.mjs';
import { validateProductionReadiness, isManagedProduction } from '../config/site-env.mjs';

const { check, section, summary } = createChecker(
  '博文外贸独立站 — 生产就绪硬保护验收（Phase 5.1）',
);

const NEXT_BIN = path.join(WEBSITE_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const SKIP_BUILD = process.env.SKIP_BUILD === '1';

/** 一段绝不应该出现在构建日志里的标记值 */
const CANARY_SECRET = 'CANARY-should-never-appear-in-build-logs';

const COMPLETE_PROD_ENV = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://www.bowen-tech.cn',
  SITE_INDEXING_ENABLED: 'false', // 本阶段刻意不开启收录
  SUPABASE_URL: 'https://verify-guard.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'verify-guard-service-role-placeholder',
  RESEND_API_KEY: 'verify-guard-resend-placeholder',
  RFQ_FROM_EMAIL: 'rfq@verify-guard.invalid',
  RFQ_RECIPIENT_EMAIL: 'qfbowen@126.com',
  RFQ_IP_HASH_SECRET: 'verify-guard-ip-hash-placeholder',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: 'verify-guard-turnstile-secret-placeholder',
  RFQ_STORE_DRIVER: 'supabase',
  RFQ_MAIL_DRIVER: 'resend',
};

// ===========================================================================
section('A. 纯逻辑：托管生产环境的判定与就绪校验');
// ===========================================================================

check('只用 VERCEL_ENV=production 判定"真正上线"，不用 NODE_ENV', () => {
  const localProdBuild = isManagedProduction({ NODE_ENV: 'production' });
  const vercelPreview = isManagedProduction({ NODE_ENV: 'production', VERCEL_ENV: 'preview' });
  const vercelProd = isManagedProduction({ VERCEL_ENV: 'production' });
  return !localProdBuild && !vercelPreview && vercelProd
    ? { ok: true, detail: '本地构建 / Preview 不触发硬保护，只有 Vercel Production 触发' }
    : `localProd=${localProdBuild} preview=${vercelPreview} prod=${vercelProd}`;
});

check('完整生产配置 → 无错误', () => {
  const r = validateProductionReadiness(COMPLETE_PROD_ENV);
  return r.errors.length === 0
    ? { ok: true, detail: `store=${r.resolved.storeDriver}, mail=${r.resolved.mailDriver}` }
    : r.errors.join(' / ');
});

check('生产环境缺 Supabase → 报错并点名变量', () => {
  const r = validateProductionReadiness({ ...COMPLETE_PROD_ENV, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' });
  const ok = r.errors.some((e) => e.includes('SUPABASE_URL')) && r.errors.some((e) => e.includes('SUPABASE_SERVICE_ROLE_KEY'));
  return ok ? { ok: true, detail: `${r.errors.length} 条错误` } : r.errors.join(' / ');
});

check('生产环境选择 JSON / memory 存储 → 报错', () => {
  const json = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_STORE_DRIVER: 'json' });
  const mem = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_STORE_DRIVER: 'memory' });
  const autoJson = validateProductionReadiness({
    ...COMPLETE_PROD_ENV,
    RFQ_STORE_DRIVER: '',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });
  const problems = [];
  if (!json.errors.some((e) => /resolve to "supabase"/.test(e))) problems.push('json 未被拒绝');
  if (!mem.errors.some((e) => /resolve to "supabase"/.test(e))) problems.push('memory 未被拒绝');
  if (!autoJson.errors.some((e) => /resolve to "supabase"/.test(e))) problems.push('自动解析成 json 未被拒绝');
  return problems.length === 0 ? { ok: true, detail: '三种非持久化路径都被拒绝' } : problems.join('; ');
});

check('生产环境缺 Resend 凭据 → 报错', () => {
  const noKey = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RESEND_API_KEY: '' });
  const noFrom = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_FROM_EMAIL: '' });
  const problems = [];
  if (!noKey.errors.some((e) => e.includes('RESEND_API_KEY'))) problems.push('缺 RESEND_API_KEY 未报错');
  if (!noFrom.errors.some((e) => e.includes('RFQ_FROM_EMAIL'))) problems.push('缺 RFQ_FROM_EMAIL 未报错');
  return problems.length === 0 ? { ok: true, detail: '两个变量都会被点名' } : problems.join('; ');
});

check('生产环境选择 mock 邮件或 unconfigured → 报错', () => {
  const mock = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_MAIL_DRIVER: 'mock' });
  const none = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_MAIL_DRIVER: 'unconfigured' });
  const auto = validateProductionReadiness({
    ...COMPLETE_PROD_ENV,
    RFQ_MAIL_DRIVER: '',
    RESEND_API_KEY: '',
    RFQ_FROM_EMAIL: '',
  });
  const problems = [];
  for (const [label, r] of [['mock', mock], ['unconfigured', none], ['自动解析', auto]]) {
    if (!r.errors.some((e) => /resolve to "resend"/.test(e))) problems.push(`${label} 未被拒绝`);
  }
  return problems.length === 0 ? { ok: true, detail: 'mock / unconfigured / 自动解析都被拒绝' } : problems.join('; ');
});

check('生产环境缺 RFQ_IP_HASH_SECRET → 报错', () => {
  const r = validateProductionReadiness({ ...COMPLETE_PROD_ENV, RFQ_IP_HASH_SECRET: '' });
  return r.errors.some((e) => e.includes('RFQ_IP_HASH_SECRET'))
    ? { ok: true, detail: '已点名' }
    : r.errors.join(' / ');
});

check('生产环境缺少正式 https 域名 → 报错', () => {
  const missing = validateProductionReadiness({ ...COMPLETE_PROD_ENV, NEXT_PUBLIC_SITE_URL: '' });
  const local = validateProductionReadiness({ ...COMPLETE_PROD_ENV, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' });
  const http = validateProductionReadiness({ ...COMPLETE_PROD_ENV, NEXT_PUBLIC_SITE_URL: 'http://www.bowen-tech.cn' });
  const problems = [];
  if (missing.errors.length === 0) problems.push('缺域名未报错');
  if (local.errors.length === 0) problems.push('localhost 未报错');
  if (http.errors.length === 0) problems.push('http 未报错');
  return problems.length === 0 ? { ok: true, detail: '缺失 / localhost / http 都被拒绝' } : problems.join('; ');
});

check('错误信息里只有变量名，没有变量值', () => {
  const leaky = validateProductionReadiness({
    ...COMPLETE_PROD_ENV,
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    RESEND_API_KEY: '',
  });
  const blob = leaky.errors.join('\n');
  const bad = ['verify-guard.invalid', 'verify-guard-service-role-placeholder', 'verify-guard-resend-placeholder']
    .filter((v) => blob.includes(v));
  return bad.length === 0 ? { ok: true, detail: `${leaky.errors.length} 条错误，0 处值泄露` } : `泄露了 ${bad.join(', ')}`;
});

check('本地 / Preview 缺凭据时只警告不阻断', () => {
  const preview = validateProductionReadiness({ VERCEL_ENV: 'preview', NODE_ENV: 'production' });
  const local = validateProductionReadiness({ NODE_ENV: 'production' });
  return preview.errors.length === 0 && local.errors.length === 0
    ? { ok: true, detail: `preview 警告 ${preview.warnings.length} 条、本地警告 ${local.warnings.length} 条` }
    : `preview=${preview.errors.length} local=${local.errors.length}`;
});

// ===========================================================================
section('B. 真实构建：生产环境缺项必须失败');
// ===========================================================================

function runBuild(env, label, timeoutMs = 600_000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [NEXT_BIN, 'build'], {
      cwd: WEBSITE_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, label });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, output: String(err.message), label });
    });
  });
}

if (SKIP_BUILD) {
  console.log('\nSKIP_BUILD=1 → 跳过三次真实构建（只跑纯逻辑断言）。');
} else {
  // ---- 构建 #1：生产环境故意缺项 → 必须失败 ----
  const badEnv = {
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://www.bowen-tech.cn',
    RESEND_API_KEY: CANARY_SECRET, // 故意放一个可识别的值，用来验证日志不泄露
    RFQ_FROM_EMAIL: '',            // 缺失 → 触发失败
    SUPABASE_URL: '',              // 缺失 → 触发失败
  };
  console.log('\n构建 #1：VERCEL_ENV=production + 故意缺项 …');
  const build1 = await runBuild(badEnv, 'production-missing');

  check('生产环境缺项时 next build 必须失败', () =>
    build1.code !== 0
      ? { ok: true, detail: `exit=${build1.code}` }
      : '构建竟然成功了（生产保护没有生效）');

  check('失败信息来自生产就绪校验，并点名缺失的变量', () => {
    const out = build1.output;
    if (!out.includes('[bowen-production]')) return '没有出现 [bowen-production] 标记';
    const missing = ['SUPABASE_URL', 'RFQ_FROM_EMAIL'].filter((v) => !out.includes(v));
    if (missing.length) return `没有点名 ${missing.join(', ')}`;
    return { ok: true, detail: '点名了 SUPABASE_URL / RFQ_FROM_EMAIL' };
  });

  check('失败信息不泄露变量值（canary 未出现）', () =>
    build1.output.includes(CANARY_SECRET)
      ? '构建日志里出现了 RESEND_API_KEY 的值（严重泄露）'
      : { ok: true, detail: 'canary 值未出现在日志中' });

  check('失败信息里没有出现密钥字段的完整形态', () => {
    const leaked = [/re_[A-Za-z0-9]{20,}/, /eyJ[A-Za-z0-9_-]{20,}/].filter((re) => re.test(build1.output));
    return leaked.length === 0 ? { ok: true, detail: '无密钥样式内容' } : `出现 ${leaked.map(String).join(', ')}`;
  });

  // ---- 构建 #2：生产环境完整（假）凭据 → 必须成功 ----
  console.log('构建 #2：VERCEL_ENV=production + 完整假凭据（约 20s）…');
  const build2 = await runBuild(COMPLETE_PROD_ENV, 'production-complete');

  check('生产环境凭据齐全时 next build 成功', () =>
    build2.code === 0
      ? { ok: true, detail: 'exit=0' }
      : `exit=${build2.code}；输出尾部：${build2.output.slice(-400)}`);

  check('生产构建会打印脱敏的运行摘要（store/mail/turnstile）', () => {
    const out = build2.output;
    return /managed production detected: store=supabase, mail=resend, turnstile=true/.test(out)
      ? { ok: true, detail: '摘要出现且不含密钥' }
      : '没有看到生产运行摘要';
  });

  check('生产构建日志里也不出现假凭据值', () => {
    const bad = ['verify-guard-service-role-placeholder', 'verify-guard-resend-placeholder', 'verify-guard-turnstile-secret-placeholder']
      .filter((v) => build2.output.includes(v));
    return bad.length === 0 ? { ok: true, detail: '0 处泄露' } : `泄露了 ${bad.join(', ')}`;
  });

  // ---- 构建 #3：本地/Preview 形态 → 必须成功（同时恢复交付默认产物）----
  console.log('构建 #3：无 VERCEL_ENV（本地/Preview 形态，恢复交付默认产物，约 20s）…');
  const build3 = await runBuild(
    { VERCEL_ENV: '', NEXT_PUBLIC_SITE_URL: '', SITE_INDEXING_ENABLED: 'false' },
    'local-preview',
  );

  check('本地 / Preview 形态的构建不会被缺凭据阻断', () =>
    build3.code === 0
      ? { ok: true, detail: 'exit=0（交付默认产物已恢复）' }
      : `exit=${build3.code}；输出尾部：${build3.output.slice(-400)}`);

  check('本地构建只给出提示，不抛生产保护错误', () => {
    const out = build3.output;
    if (out.includes('[bowen-production] production environment is not ready')) {
      return '本地构建触发了生产保护（不应发生）';
    }
    return /\[bowen-production\] Store driver resolves to/.test(out)
      ? { ok: true, detail: '提示存在，未阻断' }
      : { ok: true, detail: '无生产保护错误' };
  });
}

process.exitCode = summary() ? (process.exitCode ?? 0) : 1;
