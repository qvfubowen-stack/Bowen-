#!/usr/bin/env node
/**
 * RFQ 表单 → payload 端到端自动测试（真实浏览器）
 * ===========================================================================
 * 为什么必须用真浏览器测：需求要求「payload 必须显示用户实际填写的值」。
 * 只有真的填表、真的提交、真的读回渲染结果，才能证明数据流是通的；
 * 单元测试无法覆盖「表单控件 → FormData → React state → 渲染」这条链路。
 *
 * 本脚本会：
 *   1) 自行启动一个 Next 开发服务器（随机端口，用完即关）
 *   2) 打开 /rfq?product=BW-3005（自动带入一个 RFQ 明细行）
 *   3) 真实填写 name / company / country / email / whatsapp / website / message
 *   4) 填数量、点提交
 *   5) 读回成功页上的 payload，逐字段断言
 *   6) 另外验证：空表单提交必须被拦下、不出现 payload
 *
 * 用法：
 *   node tools/verify-rfq-e2e.mjs                 # 自己起服务器
 *   BASE_URL=http://127.0.0.1:3000 node tools/verify-rfq-e2e.mjs   # 用已有服务器
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_PORT = Number(process.env.TEST_PORT ?? 3457);
const EXTERNAL_BASE = process.env.BASE_URL ?? '';
const BASE = EXTERNAL_BASE || `http://127.0.0.1:${TEST_PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---------------------------------------------------------------- 服务器
let server = null;
let serverOut = '';

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.status < 500) return true;
    } catch { /* 还没起来 */ }
    await sleep(1000);
  }
  return false;
}

if (!EXTERNAL_BASE) {
  console.log(`启动测试用 Next 开发服务器（端口 ${TEST_PORT}）…`);
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(TEST_PORT)], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverOut += d.toString(); });
  server.stderr.on('data', (d) => { serverOut += d.toString(); });
}

function cleanup() {
  if (server && !server.killed) {
    try { server.kill(); } catch { /* ignore */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// ---------------------------------------------------------------- Chrome
const PORT = 9700 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-rfq-e2e-'));
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

/** 等到某个 selector 出现 */
async function waitForSelector(ws, selector, timeoutMs = 60000) {
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
 * 此时点击提交按钮不会触发 React 的 onSubmit（会走原生提交或什么都不做）。
 * 这里通过「连续两次点击提交并观察是否出现校验提示」来判断是否已经可交互。
 */
async function waitForInteractiveForm(ws, timeoutMs = 90000) {
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

// 填表脚本：普通 input/select/textarea 直接赋值；React 受控输入用原生 setter + input 事件
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
  // 数量：受控输入，需要原生 setter + input 事件
  const qty = document.querySelector('[data-testid="rfq-form"] ul li input.input');
  if (qty) { setNative(qty, ${JSON.stringify(FORM.quantity)}); out.push('OK:quantity'); }
  else out.push('MISSING:quantity');
  return out.join(',');
})()
`;

const READ_PAYLOAD = `
(() => {
  const el = document.querySelector('[data-testid="rfq-payload"]');
  return el ? el.textContent : null;
})()
`;

async function run() {
  // ---------- 服务器就绪 ----------
  console.log(`\n等待服务器 ${BASE} …`);
  const up = await waitForServer(`${BASE}/rfq`);
  if (!up) {
    console.error('服务器未在超时内就绪。dev server 输出：\n' + serverOut.slice(-2000));
    process.exit(2);
  }
  console.log('服务器就绪。\n');

  chrome = spawn(CHROME, [
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

  // ================================================================
  console.log('─'.repeat(74));
  console.log('场景 A — 空表单提交必须被拦下（校验生效）');
  console.log('─'.repeat(74));

  await rpc(ws, 'Page.navigate', { url: `${BASE}/rfq` });
  await sleep(3000);
  await waitForSelector(ws, 'form button[type="submit"]', 90000);

  // 等表单真正可交互（dev 模式 hydration 可能滞后）
  const interactive = await waitForInteractiveForm(ws);
  check('表单进入可交互状态（React 已 hydration）', () => interactive === true);

  const stillOnForm = await evaluate(ws, `!!document.querySelector('[data-testid="rfq-form"] button[type="submit"]')`);
  const noPayload = await evaluate(ws, `!document.querySelector('[data-testid="rfq-payload"]')`);
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

  check('空表单提交后仍停留在表单页（未生成 payload）', () => stillOnForm === true);
  check('空表单提交没有渲染 payload', () => noPayload === true);
  check('显示了必填项校验提示', () =>
    errorText && /Please enter your name/.test(errorText)
      ? { ok: true, detail: errorText.slice(0, 120) }
      : `未看到校验提示，实际: ${errorText}`);

  // ================================================================
  console.log(`\n${'─'.repeat(74)}`);
  console.log('场景 B — 真实填写表单并提交，校验 payload 内容');
  console.log('─'.repeat(74));

  // 带 product 参数，确保 RFQ 明细里有真实产品
  await rpc(ws, 'Page.navigate', { url: `${BASE}/rfq?product=BW-3005` });
  await sleep(3500);
  await waitForSelector(ws, 'form button[type="submit"]', 90000);
  await waitForInteractiveForm(ws);

  const lineCount = await evaluate(ws, `
    (() => {
      const t = document.body.textContent || '';
      const m = t.match(/(\\d+)\\s+line/);
      return m ? Number(m[1]) : 0;
    })()
  `);
  check('URL 带 product 参数后自动带入 1 条 RFQ 明细', () =>
    lineCount >= 1 ? { ok: true, detail: `${lineCount} line(s)` } : `实际 ${lineCount}`);

  const filled = await evaluate(ws, FILL_SCRIPT);
  check('全部表单字段都成功写入', () =>
    !String(filled).includes('MISSING') ? { ok: true, detail: String(filled) } : String(filled));

  // 提交（轮询，避免 hydration 时序问题）
  let gotPayload = false;
  for (let i = 0; i < 20 && !gotPayload; i++) {
    await evaluate(ws, `document.querySelector('[data-testid="rfq-form"] button[type="submit"]')?.click()`);
    await sleep(900);
    gotPayload = await evaluate(ws, `!!document.querySelector('[data-testid="rfq-payload"]')`);
  }
  check('提交后成功渲染 payload', () => gotPayload === true);

  if (!gotPayload) {
    ws.close();
    return;
  }

  const raw = await evaluate(ws, READ_PAYLOAD);
  let payload = null;
  try { payload = JSON.parse(raw); } catch { /* 解析失败下面会报 */ }
  check('payload 是合法 JSON', () =>
    payload ? { ok: true, detail: `${raw.length} 字符` } : `无法解析: ${String(raw).slice(0, 200)}`);

  if (!payload) { ws.close(); return; }

  // ---- 联系信息必须是用户真实填写的值 ----
  console.log('\n联系信息（必须是用户实际填写的值）：');
  check('contact.name = 用户填写的姓名', () =>
    payload.contact?.name === FORM.name ? { ok: true, detail: payload.contact.name } : `期望 "${FORM.name}" 实际 "${payload.contact?.name}"`);
  check('contact.company = 用户填写的公司', () =>
    payload.contact?.company === FORM.company ? { ok: true, detail: payload.contact.company } : `期望 "${FORM.company}" 实际 "${payload.contact?.company}"`);
  check('contact.country = 用户选择的国家', () =>
    payload.contact?.country === FORM.country ? { ok: true, detail: payload.contact.country } : `期望 "${FORM.country}" 实际 "${payload.contact?.country}"`);
  check('contact.email = 用户填写的邮箱', () =>
    payload.contact?.email === FORM.email ? { ok: true, detail: payload.contact.email } : `期望 "${FORM.email}" 实际 "${payload.contact?.email}"`);
  check('contact.whatsapp_phone = 用户填写的 WhatsApp/电话', () =>
    payload.contact?.whatsapp_phone === FORM.whatsapp ? { ok: true, detail: payload.contact.whatsapp_phone } : `期望 "${FORM.whatsapp}" 实际 "${payload.contact?.whatsapp_phone}"`);
  check('contact.website = 用户填写的网站', () =>
    payload.contact?.website === FORM.website ? { ok: true, detail: payload.contact.website } : `期望 "${FORM.website}" 实际 "${payload.contact?.website}"`);
  check('contact.message = 用户粘贴的清单（保留换行）', () =>
    payload.contact?.message === FORM.message ? { ok: true, detail: JSON.stringify(payload.contact.message).slice(0, 80) } : `实际 ${JSON.stringify(payload.contact?.message)}`);

  // ---- 关键：不得残留占位符 ----
  check('payload 中不出现 "(from form)" 占位符', () =>
    !String(raw).includes('(from form)') ? true : '仍然存在 (from form)');
  check('payload 中不出现 "(not provided)"（本次全部字段都有值）', () =>
    !String(raw).includes('(not provided)') ? true : `出现了 (not provided)：${String(raw).match(/"[^"]*\(not provided\)[^"]*/)?.[0] ?? ''}`);
  check('payload 中不出现其他模板占位符（{{ }} <% %> FROM_FORM）', () => {
    const bad = ['{{', '}}', '<%', 'FROM_FORM', 'PLACEHOLDER'].filter((t) => String(raw).includes(t));
    return bad.length === 0 ? true : `发现: ${bad.join(', ')}`;
  });

  // ---- RFQ 明细必须保留业务字段 ----
  console.log('\nRFQ 明细（必须保留业务字段）：');
  const item = Array.isArray(payload.items) ? payload.items[0] : null;
  check('items 是非空数组', () =>
    Array.isArray(payload.items) && payload.items.length >= 1 ? { ok: true, detail: `${payload.items.length} 条` } : 'items 为空');
  check('item.product_id 存在', () => item?.product_id === 'BW-3005' ? { ok: true, detail: item.product_id } : `实际 ${item?.product_id}`);
  check('item.application_id 存在（保留 application 级关联）', () =>
    item?.application_id ? { ok: true, detail: item.application_id } : `实际 ${item?.application_id}`);
  check('item.bowen_no 存在', () => item?.bowen_no ? { ok: true, detail: item.bowen_no } : `实际 ${item?.bowen_no}`);
  check('item.matched_oe 存在', () => item?.matched_oe ? { ok: true, detail: item.matched_oe } : `实际 ${item?.matched_oe}`);
  check('item.vehicle 存在', () => item?.vehicle ? { ok: true, detail: String(item.vehicle).slice(0, 50) } : `实际 ${item?.vehicle}`);
  check('item.engine 存在', () => item?.engine ? { ok: true, detail: String(item.engine).slice(0, 50) } : `实际 ${item?.engine}`);
  check('item.quantity = 用户填写的数量', () =>
    item?.quantity === FORM.quantity ? { ok: true, detail: item.quantity } : `期望 "${FORM.quantity}" 实际 "${item?.quantity}"`);
  check('items_count 与 items 长度一致', () =>
    payload.items_count === payload.items.length ? { ok: true, detail: String(payload.items_count) } : `${payload.items_count} vs ${payload.items.length}`);

  // ---- 明确标注原型不发邮件 ----
  check('payload 明确标注原型阶段不发送邮件', () =>
    payload.delivery?.transport === 'prototype_no_email_sent'
      ? { ok: true, detail: payload.delivery.transport }
      : `实际 ${payload.delivery?.transport}`);

  // ---- 成功页同时可视化展示联系信息（不是只有 JSON） ----
  const shownName = await evaluate(ws, `
    (() => { const t = document.body.textContent || ''; return t.includes(${JSON.stringify(FORM.name)}); })()
  `);
  const shownEmail = await evaluate(ws, `
    (() => { const t = document.body.textContent || ''; return t.includes(${JSON.stringify(FORM.email)}); })()
  `);
  check('成功页正文里能看到用户填写的姓名', () => shownName === true);
  check('成功页正文里能看到用户填写的邮箱', () => shownEmail === true);

  const stillFailed = await evaluate(ws, `document.body.textContent.includes('(from form)')`);
  check('成功页整页文本里没有 "(from form)"', () => stillFailed === false);

  ws.close();
}

try {
  await run();
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
console.log('\n✅ RFQ 表单 → payload 端到端测试全部通过（原型不发送邮件）。');
