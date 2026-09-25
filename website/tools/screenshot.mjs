#!/usr/bin/env node
/**
 * 截图工具（Chrome DevTools Protocol）
 * ===========================================================================
 * 用真正的移动端/桌面端视口截整页图，供 delivery/screenshots 使用。
 * --window-size 在 headless 下不可靠，所以这里用 Emulation.setDeviceMetricsOverride。
 *
 * 用法：
 *   node tools/screenshot.mjs <url> <输出文件> <宽> [高]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_ = process.argv[2];
const OUT = process.argv[3];
const WIDTH = Number(process.argv[4] ?? 1440);
const MAXH = Number(process.argv[5] ?? 6000);
const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!URL_ || !OUT) {
  console.error('用法: node tools/screenshot.mjs <url> <输出文件> <宽> [最大高度]');
  process.exit(1);
}

const PORT = 9800 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('无法连接 Chrome');
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

try {
  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  await rpc(ws, 'Page.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH <= 768,
  });
  await rpc(ws, 'Page.navigate', { url: URL_ });
  await sleep(7000);

  const { result } = await rpc(ws, 'Runtime.evaluate', {
    expression: 'JSON.stringify({h: document.documentElement.scrollHeight, w: document.documentElement.clientWidth})',
    returnByValue: true,
  });
  const measured = JSON.parse(result.value);
  const height = Math.max(400, Math.min(Math.round(measured.h), MAXH));
  console.log(`  页面实测：clientWidth ${measured.w}px · scrollHeight ${measured.h}px → 截取高 ${height}px`);
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height, deviceScaleFactor: 1, mobile: WIDTH <= 768,
  });
  await sleep(1500);

  const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`${path.basename(OUT)}  ${WIDTH}x${height}  ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
  ws.close();
} finally {
  chrome.kill();
}
