/**
 * 用 Chrome DevTools Protocol 把网页渲染成 PNG（零依赖）
 * ===========================================================================
 * 为什么用 CDP 而不是类库：本项目的工具链刻意保持零第三方依赖。
 * Chrome 已经装在本机，用它渲染 HTML 并截图，既能生成带缩略图的联系表，
 * 也不需要引入 jimp / sharp / canvas 之类的图像库。
 *
 * 用法：
 *   const png = await renderUrlToPng(url, { width, maxHeight })
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    DEFAULT_CHROME,
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('找不到 Chrome/Edge。可通过环境变量 CHROME_PATH 指定可执行文件路径。');
}

/**
 * 渲染一个 URL 并截图。
 * @param {string} url
 * @param {{ width?: number, maxHeight?: number, scale?: number, settleMs?: number }} opts
 * @returns {Promise<{ png: Buffer, width: number, height: number }>}
 */
export async function renderUrlToPng(url, opts = {}) {
  const { width = 1400, maxHeight = 12000, scale = 1, settleMs = 1200 } = opts;
  const chromePath = await findChrome();
  const port = 9200 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-cdp-'));

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let ws;
  try {
    // 等调试端口就绪
    let wsUrl = null;
    for (let i = 0; i < 80 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
      } catch { /* 还没起来 */ }
      if (!wsUrl) await sleep(250);
    }
    if (!wsUrl) throw new Error('无法连接 Chrome 调试端口');

    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    let msgId = 0;
    const rpc = (method, params = {}) => new Promise((resolve, reject) => {
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

    await rpc('Page.enable');
    await rpc('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: scale, mobile: false,
    });
    await rpc('Page.navigate', { url });
    await sleep(settleMs);

    // 等所有图片加载完成（最多 30 秒）
    const started = Date.now();
    for (;;) {
      const { result } = await rpc('Runtime.evaluate', {
        expression: `(() => {
          const imgs = Array.from(document.images || []);
          return JSON.stringify({
            total: imgs.length,
            done: imgs.filter(i => i.complete).length,
            h: document.documentElement.scrollHeight,
            w: document.documentElement.scrollWidth,
          });
        })()`,
        returnByValue: true,
      });
      const st = JSON.parse(result.value);
      if (st.done >= st.total || Date.now() - started > 30000) {
        // 若内容比视口宽，就把视口加宽到实际内容宽度，避免右侧被裁掉
        const finalWidth = Math.max(width, Math.min(Math.round(st.w), 4000));
        const height = Math.max(300, Math.min(Math.round(st.h), maxHeight));
        await rpc('Emulation.setDeviceMetricsOverride', {
          width: finalWidth, height, deviceScaleFactor: scale, mobile: false,
        });
        await sleep(settleMs);
        const shot = await rpc('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: false,
        });
        return {
          png: Buffer.from(shot.data, 'base64'),
          width: finalWidth * scale,
          height: height * scale,
          imagesTotal: st.total,
          imagesLoaded: st.done,
        };
      }
      await sleep(400);
    }
  } finally {
    try { ws?.close(); } catch { /* ignore */ }
    try { chrome.kill(); } catch { /* ignore */ }
  }
}
