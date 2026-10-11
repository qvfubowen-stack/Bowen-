#!/usr/bin/env node
/**
 * RFQ 表单 → 生产接口 端到端自动测试（真实浏览器）
 * ===========================================================================
 * Phase 5 变更说明（本文件是 Phase 4.1 版本的重写）：
 *   Phase 4.1 的版本断言的是"原型行为"——提交后页面显示一段 JSON payload，
 *   并且 payload.delivery.transport === 'prototype_no_email_sent'。
 *   Phase 5 明确要求：不再向客户展示内部 JSON、不再出现原型提示、必须真正调用
 *   POST /api/rfq。因此这里改为断言**生产行为**：
 *     1. 空表单提交被前端校验拦下，不产生任何网络提交；
 *     2. /rfq?product=BW-3005 自动带入明细，可添加、可删除；
 *     3. 未勾选隐私同意时无法提交（且复选框默认不勾选）；
 *     4. 正常填写并勾选后提交 → 调用 /api/rfq → 显示 Inquiry Number；
 *     5. 页面上**不存在**内部 JSON（data-testid="rfq-payload"）与原型提示文案。
 *
 * 服务器：默认自己起一个 dev 服务器，并使用 mock 邮件 + 本地 JSON 落库，
 *         绝不发送真实邮件、绝不写真实数据库。
 *         设置 BASE_URL 可复用已有服务器（此时跳过 outbox 断言）。
 *
 * 用法：
 *   node tools/verify-rfq-e2e.mjs
 *   BASE_URL=http://127.0.0.1:3100 node tools/verify-rfq-e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  WEBSITE_ROOT,
  makeTempDir,
  randomTestSecret,
  readJsonl,
  sleep,
} from './lib/verify-helpers.mjs';

const ROOT = WEBSITE_ROOT;
const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_PORT = Number(process.env.TEST_PORT ?? 3457);
/** Phase 5.1：第二个服务器，用于"启用 Turnstile"的浏览器场景 */
const TURNSTILE_PORT = TEST_PORT + 1;
const TURNSTILE_MOCK_TOKEN = 'bowen-turnstile-mock-pass';
const EXTERNAL_BASE = process.env.BASE_URL ?? '';
const BASE = EXTERNAL_BASE || `http://127.0.0.1:${TEST_PORT}`;

let pass = 0;
let fail = 0;
const failures = [];
function check(name, fn) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    if (r === true) ok = true;
    else if (typeof r === 'string') detail = r;
    else if (r && typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
  } catch (e) { detail = `异常: ${e.message}`; }
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}

// ---------------------------------------------------------------- 测试数据
const FORM = {
  name: 'Zhang Wei (E2E)',
  company: 'E2E Auto Parts Import GmbH',
  country: 'Germany',
  email: 'e2e.buyer@example.com',
  whatsapp: '+49 151 2345678',
  website: 'https://e2e-buyer.example.com',
  message: 'Sourcing list:\n2550035540 x 300\n4711306950 x 500',
  quantity: '500 pcs',
};

const TMP = makeTempDir('rfq-e2e');
const STORE_PATH = path.join(TMP, 'rfq-inquiries.jsonl');
const OUTBOX_PATH = path.join(TMP, 'outbox.jsonl');

// ---------------------------------------------------------------- 服务器
let server = null;
let serverOut = '';
let serverBase = BASE;

async function waitForServer(url, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
      if (res.status < 500) return true;
    } catch { /* 还没起来 */ }
    await sleep(1000);
  }
  return false;
}

/** 启动一个 dev 服务器（默认场景 / Turnstile 场景共用） */
async function startServer(port, extraEnv, label) {
  console.log(`启动测试用 Next 开发服务器（端口 ${port}，${label}）…`);
  const bin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [bin, 'dev', '-p', String(port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      // 只使用 mock 邮件与本地 JSON 落库：不发真实邮件、不连真实数据库
      RFQ_STORE_DRIVER: 'json',
      RFQ_MAIL_DRIVER: 'mock',
      RFQ_RECIPIENT_EMAIL: 'qfbowen@126.com',
      RFQ_FROM_EMAIL: 'rfq@verify.invalid',
      RFQ_IP_HASH_SECRET: randomTestSecret(),
      RFQ_TRUST_PROXY: 'true',
      RFQ_RATE_LIMIT_MAX: '60',
      RFQ_MIN_FILL_MS: '200',
      NEXT_PUBLIC_SITE_URL: '',
      SITE_INDEXING_ENABLED: 'false',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { serverOut += d.toString(); });
  child.stderr.on('data', (d) => { serverOut += d.toString(); });
  server = child;
  serverBase = `http://127.0.0.1:${port}`;
  const up = await waitForServer(`${serverBase}/rfq`);
  if (!up) throw new Error(`[${label}] 服务器未就绪`);
  return serverBase;
}

function cleanup() {
  if (server && !server.killed) {
    try { server.kill(); } catch { /* ignore */ }
  }
  server = null;
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

if (!EXTERNAL_BASE) {
  await startServer(TEST_PORT, {
    RFQ_JSON_STORE_PATH: STORE_PATH,
    RFQ_MOCK_OUTBOX_PATH: OUTBOX_PATH,
  }, 'mock 邮件 + 本地落库，未启用 Turnstile');
}

// ---------------------------------------------------------------- Chrome
const PORT = 9700 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'bowen-rfq-e2e-'));
let chrome = null;

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('无法连接 Chrome 调试端口');
}

let msgId = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch { return; }
      if (d.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (d.error) reject(new Error(`${method}: ${d.error.message}`));
      else resolve(d.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const { result, exceptionDetails } = await rpc(ws, 'Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate failed');
  return result.value;
}

async function waitForSelector(ws, selector, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(ws, `!!document.querySelector(${JSON.stringify(selector)})`);
    if (ok) return true;
    await sleep(400);
  }
  return false;
}

/**
 * 等待 React 完成 hydration。
 * 开发模式下首屏 JS 是懒编译的，DOM 已出现但事件处理器可能还没挂上；
 * 此时点击提交按钮不会触发 React 的 onSubmit。
 * 这里通过「点击提交并观察是否出现校验提示」判断是否已经可交互。
 */
async function waitForInteractiveForm(ws, timeoutMs = 120_000) {
  const start = Date.now();
  let lastDiag = '';
  while (Date.now() - start < timeoutMs) {
    const diag = await evaluate(ws, `
      (() => {
        const form = document.querySelector('[data-testid="rfq-form"]');
        if (!form) return 'NO_FORM';
        const btn = form.querySelector('button[type="submit"]');
        if (!btn) return 'NO_BUTTON';
        btn.click();
        return 'CLICKED';
      })()
    `);
    lastDiag = String(diag);
    await sleep(700);
    const hasErrors = await evaluate(ws, `
      (() => {
        const form = document.querySelector('[data-testid="rfq-form"]');
        if (!form) return false;
        return Array.from(form.querySelectorAll('span'))
          .some(s => /Please enter|Please select|does not look valid|Add at least one/.test(s.textContent || ''));
      })()
    `);
    if (hasErrors) return true;
    await sleep(500);
  }
  console.error(`waitForInteractiveForm 超时，最后诊断: ${lastDiag}`);
  return false;
}

/** 填表脚本：React 受控输入用原生 setter + input/change 事件 */
const FILL_SCRIPT = `
(() => {
  const setNative = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const set = (name, value) => {
    const el = document.querySelector('[name="' + name + '"]');
    if (!el) return 'MISSING:' + name;
    setNative(el, value);
    return 'OK:' + name;
  };
  const out = [];
  out.push(set('name', ${JSON.stringify(FORM.name)}));
  out.push(set('company', ${JSON.stringify(FORM.company)}));
  out.push(set('country', ${JSON.stringify(FORM.country)}));
  out.push(set('email', ${JSON.stringify(FORM.email)}));
  out.push(set('whatsapp', ${JSON.stringify(FORM.whatsapp)}));
  out.push(set('website', ${JSON.stringify(FORM.website)}));
  out.push(set('message', ${JSON.stringify(FORM.message)}));
  const qty = document.querySelector('[data-testid="rfq-form"] ul li input.input');
  if (qty) { setNative(qty, ${JSON.stringify(FORM.quantity)}); out.push('OK:quantity'); }
  else out.push('MISSING:quantity');
  return out.join(',');
})()
`;

const CONSENT_SCRIPT = `
(() => {
  const el = document.querySelector('[data-testid="rfq-form"] input[name="consent"]');
  if (!el) return 'MISSING:consent';
  return el.checked ? 'ALREADY_CHECKED' : 'UNCHECKED';
})()
`;

const SET_CONSENT_SCRIPT = `
(() => {
  const el = document.querySelector('[data-testid="rfq-form"] input[name="consent"]');
  if (!el) return 'MISSING:consent';
  el.checked = true;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.checked ? 'CHECKED' : 'FAILED';
})()
`;

const RFQ_LINE_COUNT = `
(() => {
  const t = document.body.textContent || '';
  const m = t.match(/(\\d+)\\s+line/);
  return m ? Number(m[1]) : 0;
})()
`;

async function run() {
  console.log(`\n等待服务器 ${BASE} …`);
  const up = await waitForServer(`${BASE}/rfq`);
  if (!up) {
    console.error('服务器未在超时内就绪。dev server 输出：\n' + serverOut.slice(-2000));
    process.exit(2);
  }
  console.log('服务器就绪。\n');

  chrome = (await import('node:child_process')).spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await rpc(ws, 'Page.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  const consoleErrors = [];
  await rpc(ws, 'Runtime.enable');
  rpc(ws, 'Log.enable').catch(() => {});

  // ================================================================
  console.log('─'.repeat(74));
  console.log('场景 A — 空表单提交必须被拦下（且不产生内部 JSON）');
  console.log('─'.repeat(74));

  await rpc(ws, 'Page.navigate', { url: `${BASE}/rfq` });
  await sleep(3000);
  await waitForSelector(ws, 'form button[type="submit"]');

  const interactive = await waitForInteractiveForm(ws);
  check('表单进入可交互状态（React 已 hydration）', () => interactive === true);

  const stillOnForm = await evaluate(ws, `!!document.querySelector('[data-testid="rfq-form"] button[type="submit"]')`);
  const noPayloadEl = await evaluate(ws, `!document.querySelector('[data-testid="rfq-payload"]')`);
  const noSuccess = await evaluate(ws, `!document.querySelector('[data-testid="rfq-success"]')`);
  const errorText = await evaluate(ws, `
    (() => {
      const form = document.querySelector('[data-testid="rfq-form"]');
      if (!form) return '';
      return Array.from(form.querySelectorAll('span'))
        .map(s => (s.textContent || '').trim())
        .filter(t => /Please|valid/.test(t))
        .join(' | ');
    })()
  `);

  check('空表单提交后仍停留在表单上（没有进入成功页）', () => stillOnForm === true && noSuccess === true);
  check('页面上不存在内部 JSON 区块（data-testid="rfq-payload"）', () => noPayloadEl === true);
  check('显示了必填项校验提示', () =>
    errorText && /Please enter your name/.test(errorText)
      ? { ok: true, detail: errorText.slice(0, 130) }
      : `未看到校验提示，实际: ${errorText}`);

  // ================================================================
  console.log(`\n${'─'.repeat(74)}`);
  console.log('场景 B — 隐私同意不能默认勾选，且必须能拦住提交');
  console.log('─'.repeat(74));

  let consentState = await evaluate(ws, CONSENT_SCRIPT);
  check('隐私同意复选框默认未勾选', () =>
    consentState === 'UNCHECKED' ? { ok: true, detail: '默认未勾选' } : `实际 ${consentState}`);

  const privacyLink = await evaluate(ws, `
    (() => {
      const a = Array.from(document.querySelectorAll('[data-testid="rfq-form"] a'))
        .find(x => (x.getAttribute('href') || '') === '/privacy');
      return a ? a.textContent.trim() : null;
    })()
  `);
  check('表单内有指向 /privacy 的隐私政策链接', () =>
    privacyLink ? { ok: true, detail: `链接文案 "${privacyLink}"` } : '没有找到 /privacy 链接');

  // 表单里不应再出现原型提示文案
  const prototypeCopy = await evaluate(ws, `
    (() => {
      const t = document.body.textContent || '';
      return ['prototype', 'nothing was emailed', 'Email delivery is not connected', 'not connected yet']
        .filter(s => t.toLowerCase().includes(s.toLowerCase()));
    })()
  `);
  check('页面上不再出现原型/未接入邮件提示', () =>
    Array.isArray(prototypeCopy) && prototypeCopy.length === 0
      ? { ok: true, detail: '0 命中' }
      : `发现 ${JSON.stringify(prototypeCopy)}`);

  // ================================================================
  console.log(`\n${'─'.repeat(74)}`);
  console.log('场景 C — 带 product 参数进入：明细可添加、可删除');
  console.log('─'.repeat(74));

  await rpc(ws, 'Page.navigate', { url: `${BASE}/rfq?product=BW-3005` });
  await sleep(3500);
  await waitForSelector(ws, 'form button[type="submit"]');
  await waitForInteractiveForm(ws);

  const lineCount = await evaluate(ws, RFQ_LINE_COUNT);
  check('URL 带 product 参数后自动带入 1 条 RFQ 明细', () =>
    lineCount >= 1 ? { ok: true, detail: `${lineCount} line(s)` } : `实际 ${lineCount}`);

  const removeLabel = await evaluate(ws, `
    (() => {
      const btn = Array.from(document.querySelectorAll('[data-testid="rfq-form"] button'))
        .find(b => /^Remove$/.test((b.textContent || '').trim()));
      return btn ? btn.getAttribute('aria-label') : null;
    })()
  `);
  check('明细行有 Remove 按钮（可删除产品）', () =>
    removeLabel ? { ok: true, detail: removeLabel } : '没有找到 Remove 按钮');

  const afterRemove = await evaluate(ws, `
    (() => {
      const btn = Array.from(document.querySelectorAll('[data-testid="rfq-form"] button'))
        .find(b => /^Remove$/.test((b.textContent || '').trim()));
      if (!btn) return 'NO_BUTTON';
      btn.click();
      return 'CLICKED';
    })()
  `);
  await sleep(1200);
  const lineCountAfter = await evaluate(ws, RFQ_LINE_COUNT);
  const emptyNotice = await evaluate(ws, `(document.body.textContent || '').includes('No products added yet')`);
  check('点击 Remove 后明细被删除（列表回到空状态）', () =>
    afterRemove === 'CLICKED' && lineCountAfter === 0 && emptyNotice === true
      ? { ok: true, detail: '1 → 0 条，显示空列表提示' }
      : `click=${afterRemove} lines=${lineCountAfter} emptyNotice=${emptyNotice}`);

  // ================================================================
  console.log(`\n${'─'.repeat(74)}`);
  console.log('场景 D — 真实填写 + 勾选同意 + 提交，校验服务端返回的询价号');
  console.log('─'.repeat(74));

  // 重新带入一条明细
  await rpc(ws, 'Page.navigate', { url: `${BASE}/rfq?product=BW-3005` });
  await sleep(3500);
  await waitForSelector(ws, 'form button[type="submit"]');
  await waitForInteractiveForm(ws);

  const filled = await evaluate(ws, FILL_SCRIPT);
  check('全部表单字段都成功写入', () =>
    !String(filled).includes('MISSING') ? { ok: true, detail: String(filled) } : String(filled));

  const consentBefore = await evaluate(ws, CONSENT_SCRIPT);
  check('填写后隐私同意仍然保持未勾选（不自动勾选）', () =>
    consentBefore === 'UNCHECKED' ? true : `实际 ${consentBefore}`);

  // 先不勾选同意提交一次：必须被前端拦下，不进入成功页
  await evaluate(ws, `document.querySelector('[data-testid="rfq-submit"]')?.click()`);
  await sleep(1500);
  const blockedByConsent = await evaluate(ws, `
    (() => {
      const success = !!document.querySelector('[data-testid="rfq-success"]');
      const text = document.body.textContent || '';
      return { success, asksConsent: /Privacy Policy/.test(text) };
    })()
  `);
  check('未勾选隐私同意时提交被拦下（不会进入成功页）', () =>
    blockedByConsent && blockedByConsent.success === false
      ? { ok: true, detail: '前端校验生效' }
      : `实际 ${JSON.stringify(blockedByConsent)}`);

  const consentSet = await evaluate(ws, SET_CONSENT_SCRIPT);
  check('隐私同意可以被客户手动勾选', () =>
    consentSet === 'CHECKED' ? true : `实际 ${consentSet}`);

  let gotSuccess = false;
  for (let i = 0; i < 25 && !gotSuccess; i++) {
    await evaluate(ws, `document.querySelector('[data-testid="rfq-submit"]')?.click()`);
    await sleep(900);
    gotSuccess = await evaluate(ws, `!!document.querySelector('[data-testid="rfq-success"]')`);
  }
  check('提交后进入成功页', () => gotSuccess === true);
  if (!gotSuccess) {
    const errText = await evaluate(ws, `
      (() => { const el = document.querySelector('[data-testid="rfq-error"]'); return el ? el.textContent : null; })()
    `);
    console.error(`提交未成功，页面错误提示: ${errText}`);
    ws.close();
    return;
  }

  const inquiryNumber = await evaluate(ws, `
    (() => {
      const el = document.querySelector('[data-testid="rfq-inquiry-number"]');
      return el ? el.textContent.trim() : null;
    })()
  `);
  check('成功页显示 Inquiry Number（格式 BW-RFQ-YYYYMMDD-XXXXXX）', () =>
    inquiryNumber && /^BW-RFQ-\d{8}-[0-9A-F]{6}$/.test(inquiryNumber)
      ? { ok: true, detail: inquiryNumber }
      : `实际 ${inquiryNumber}`);

  const noJsonAfterSuccess = await evaluate(ws, `!document.querySelector('[data-testid="rfq-payload"]')`);
  check('提交成功后不再显示内部 JSON payload', () => noJsonAfterSuccess === true);

  const shownOnSuccess = await evaluate(ws, `
    (() => {
      const t = document.body.textContent || '';
      return {
        name: t.includes(${JSON.stringify(FORM.name)}),
        email: t.includes(${JSON.stringify(FORM.email)}),
        company: t.includes(${JSON.stringify(FORM.company)}),
      };
    })()
  `);
  check('成功页回显客户填写的姓名 / 公司 / 邮箱', () =>
    shownOnSuccess?.name && shownOnSuccess?.email && shownOnSuccess?.company
      ? { ok: true, detail: '三项都在' }
      : JSON.stringify(shownOnSuccess));

  const successCopy = await evaluate(ws, `(document.body.textContent || '').toLowerCase()`);
  check('成功页文案不再出现原型/未发送邮件的说法', () =>
    !/prototype|nothing was emailed|not connected yet/.test(successCopy)
      ? { ok: true, detail: '0 命中' }
      : '仍然出现原型提示文案');

  // ---- Phase 5.1：成功页不得无条件声称邮件已发送 ----
  const successLead = await evaluate(ws, `
    (() => {
      const el = document.querySelector('[data-testid="rfq-success-lead"]');
      return el ? el.textContent.trim() : null;
    })()
  `);
  check('成功页主文案只陈述"已记录"这一事实', () =>
    successLead && /Your enquiry has been recorded\./.test(successLead)
      ? { ok: true, detail: successLead.slice(0, 110) }
      : `实际: ${successLead}`);

  check('成功页不再声称销售团队已收到邮件 / 会收到确认邮件', () => {
    const problems = [];
    if (/notified by email/i.test(successCopy)) problems.push('出现 "notified by email"');
    if (/confirmation email/i.test(successCopy)) problems.push('出现 "confirmation email"');
    if (/email has been sent|we have emailed/i.test(successCopy)) problems.push('声称邮件已发送');
    return problems.length === 0 ? { ok: true, detail: '0 命中' } : problems.join('; ');
  });

  check('成功页与整页都没有未确认的回复时效承诺', () =>
    /business day|within \d+ (?:hours|days)|usually within/i.test(successCopy)
      ? '页面出现时效承诺'
      : { ok: true, detail: '0 命中' });

  // ---- Phase 5.1：页面不得存在附件相关流程 ----
  const attachmentProbe = await evaluate(ws, `
    (() => {
      const t = document.body.textContent || '';
      return {
        fileInputs: document.querySelectorAll('input[type="file"]').length,
        mentionsConfirmation: /confirmation email/i.test(t),
      };
    })()
  `);
  check('表单里没有任何文件选择框', () =>
    attachmentProbe?.fileInputs === 0 ? { ok: true, detail: '0 个 file input' } : `有 ${attachmentProbe?.fileInputs} 个`);
  check('页面不再出现 confirmation email 文案', () =>
    attachmentProbe?.mentionsConfirmation === false ? { ok: true, detail: '0 命中' } : '仍然出现');

  // ---- 服务端侧证据（自起服务器时才可读） ----
  if (!EXTERNAL_BASE) {
    const records = readJsonl(STORE_PATH);
    check('询价已真正落库（本地 JSONL，mock 存储）', () => {
      const rec = records.find((r) => r.inquiry_number === inquiryNumber);
      if (!rec) return `落库文件里找不到 ${inquiryNumber}（共 ${records.length} 条）`;
      const item = rec.items?.[0];
      return item?.product_id === 'BW-3005' && item?.application_id
        ? { ok: true, detail: `${rec.inquiry_number}: Bowen ${item.bowen_no} / ${item.matched_oe} / ${item.quantity}` }
        : `items[0] 不完整: ${JSON.stringify(item)}`;
    });

    const mails = readJsonl(OUTBOX_PATH);
    check('mock 邮件已"发出"，主题包含询价号（未真实外发）', () => {
      const mail = mails.find((m) => String(m.subject ?? '').includes(String(inquiryNumber)));
      return mail
        ? { ok: true, detail: mail.subject }
        : `outbox 里没有对应邮件（共 ${mails.length} 封）`;
    });

    check('mock outbox 里没有任何真实收件人以外的东西（确认是测试通道）', () => {
      const mail = mails.find((m) => String(m.subject ?? '').includes(String(inquiryNumber)));
      return mail?.transport === 'mock' && mail?.to === 'qfbowen@126.com'
        ? { ok: true, detail: `transport=${mail.transport}, to=${mail.to}` }
        : `实际 ${JSON.stringify(mail ? { transport: mail.transport, to: mail.to } : null)}`;
    });
  }

  void consoleErrors;
  ws.close();
}

// ===========================================================================
// 场景 E（Phase 5.1）— 启用 Turnstile 时的浏览器行为
// ---------------------------------------------------------------------------
// 关键约束：**不得访问真实 Cloudflare**。
// 做法：服务器用 RFQ_TURNSTILE_MODE=mock（服务端只接受固定测试 token，不发任何请求），
//       前端用 NEXT_PUBLIC_TURNSTILE_MOCK=1（不加载 Cloudflare 脚本），
//       并由本脚本在页面脚本执行前注入 window.__BOWEN_TURNSTILE_MOCK__。
// 这个开关在生产环境会被生产就绪校验直接拒绝，因此不可能在生产生效。
// ===========================================================================
async function runTurnstileScenario() {
  console.log(`\n${'─'.repeat(74)}`);
  console.log('场景 E — 启用 Turnstile（mock，不访问真实 Cloudflare）');
  console.log('─'.repeat(74));

  const base = await startServer(
    TURNSTILE_PORT,
    {
      RFQ_JSON_STORE_PATH: path.join(TMP, 'turnstile', 'rfq.jsonl'),
      RFQ_MOCK_OUTBOX_PATH: path.join(TMP, 'turnstile', 'outbox.jsonl'),
      TURNSTILE_SECRET_KEY: 'verify-e2e-turnstile-secret-placeholder',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      RFQ_TURNSTILE_MODE: 'mock',
      NEXT_PUBLIC_TURNSTILE_MOCK: '1',
    },
    'mock 邮件 + Turnstile mock 模式',
  );

  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await rpc(ws, 'Page.enable');
  // 必须在页面脚本执行之前注入，组件挂载时才会读到
  await rpc(ws, 'Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__BOWEN_TURNSTILE_MOCK__ = ${JSON.stringify(TURNSTILE_MOCK_TOKEN)};`,
  });
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  await rpc(ws, 'Page.navigate', { url: `${base}/rfq?product=BW-3005` });
  await sleep(4000);
  await waitForInteractiveForm(ws);

  const widget = await evaluate(ws, `
    (() => {
      const mock = document.querySelector('[data-testid="turnstile-mock"]');
      const real = document.querySelector('[data-testid="turnstile-widget"]');
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      return {
        mockPresent: !!mock,
        realPresent: !!real,
        turnstileScriptLoaded: scripts.some(s => s.includes('challenges.cloudflare.com')),
        statusText: mock ? (mock.textContent || '').trim().slice(0, 80) : null,
      };
    })()
  `);
  check('启用后页面出现验证码区域（测试模式标记）', () =>
    widget?.mockPresent === true ? { ok: true, detail: widget.statusText ?? '' } : JSON.stringify(widget));
  check('测试模式下没有加载 Cloudflare 脚本（未访问真实 Cloudflare）', () =>
    widget?.turnstileScriptLoaded === false ? { ok: true, detail: '0 个第三方脚本' } : '仍然加载了 Cloudflare 脚本');

  const filled = await evaluate(ws, FILL_SCRIPT);
  check('启用后表单字段仍可正常填写', () =>
    !String(filled).includes('MISSING') ? { ok: true, detail: String(filled) } : String(filled));
  await evaluate(ws, SET_CONSENT_SCRIPT);

  let gotSuccess = false;
  for (let i = 0; i < 25 && !gotSuccess; i++) {
    await evaluate(ws, `document.querySelector('[data-testid="rfq-submit"]')?.click()`);
    await sleep(900);
    gotSuccess = await evaluate(ws, `!!document.querySelector('[data-testid="rfq-success"]')`);
  }
  check('启用 Turnstile 后，携带 token 的提交成功', () =>
    gotSuccess === true
      ? { ok: true, detail: '成功页已出现（说明 turnstile_token 已随提交体发出并通过服务端校验）' }
      : '提交未成功');

  if (gotSuccess) {
    const tokenError = await evaluate(ws, `!!document.querySelector('[data-testid="turnstile-error"]')`);
    check('成功提交后没有残留验证码错误提示', () => tokenError === false);
  }

  ws.close();
}

try {
  await run();
  if (!EXTERNAL_BASE) {
    // dev 服务器会争用 .next，必须串行：先停掉第一个再起第二个
    cleanup();
    await sleep(3000);
    await runTurnstileScenario();
  } else {
    console.log('\n复用 BASE_URL 模式：跳过场景 E（需要独立的 Turnstile 配置进程）。');
  }
} catch (e) {
  console.error(`\n执行出错: ${e.message}`);
  if (serverOut) console.error('dev server 输出尾部:\n' + serverOut.slice(-1500));
  fail += 1;
  failures.push(`执行出错: ${e.message}`);
} finally {
  cleanup();
  if (chrome) { try { chrome.kill(); } catch { /* ignore */ } }
}

console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ RFQ 表单 → 生产接口 端到端测试全部通过（mock 邮件 + mock 存储，未真实外发）。');