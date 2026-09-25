#!/usr/bin/env node
/**
 * 移动端横向溢出探针
 * ===========================================================================
 * 用 Chrome DevTools Protocol 在真实移动端视口下量出所有比视口宽的元素。
 * 原型必须响应式，所以这个检查在验收时要跑一遍。
 *
 * 用法：node tools/find-overflow.mjs [url] [width] [height]
 *   node tools/find-overflow.mjs http://127.0.0.1:3000/ 390
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_ = process.argv[2] ?? 'http://127.0.0.1:3000/';
const WIDTH = Number(process.argv[3] ?? 390);
const HEIGHT = Number(process.argv[4] ?? 900);
const PORT = 9333 + Math.floor(Math.random() * 400);
const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-probe-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('无法连接 Chrome 调试端口');
}

let msgId = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (data.error) reject(new Error(`${method}: ${data.error.message}`));
      else resolve(data.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const PROBE = `
(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1) {
      const cs = getComputedStyle(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className.slice(0, 50) : '',
        w: Math.round(r.width),
        right: Math.round(r.right),
        display: cs.display,
        ws: cs.whiteSpace,
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 36),
      });
    }
  }
  out.sort((a, b) => b.w - a.w);
  const seen = new Set();
  const uniq = out.filter((o) => {
    const k = o.cls + '|' + o.w;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return JSON.stringify({
    viewport: vw,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth - vw,
    offenders: uniq.slice(0, 15),
  }, null, 1);
})()
`;

try {
  const wsUrl = await getTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await rpc(ws, 'Page.enable');
  // 用设备度量覆盖，才是真正的移动端视口（--window-size 在 headless 下不可靠）
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: WIDTH <= 768,
  });
  await rpc(ws, 'Page.navigate', { url: URL_ });
  await sleep(6000);

  const { result } = await rpc(ws, 'Runtime.evaluate', { expression: PROBE, returnByValue: true });
  const data = JSON.parse(result.value);

  console.log(`URL: ${URL_}`);
  console.log(`视口宽 ${data.viewport}px · 文档 scrollWidth ${data.scrollWidth}px · 横向溢出 ${data.overflow}px`);
  if (data.overflow <= 0) {
    console.log('\n✅ 没有横向溢出，移动端布局正常。');
  } else {
    console.log('\n❌ 以下元素比视口宽：');
    for (const o of data.offenders) {
      console.log(`  ${String(o.w).padStart(4)}px  right=${String(o.right).padStart(4)}  <${o.tag} class="${o.cls}">  ws=${o.ws}  "${o.text}"`);
    }
    process.exitCode = 1;
  }
  ws.close();
} finally {
  chrome.kill();
}
