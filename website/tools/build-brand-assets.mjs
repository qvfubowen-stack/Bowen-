#!/usr/bin/env node
/**
 * website/tools/build-brand-assets.mjs
 * ===========================================================================
 * 生成 Phase 5 需要的站点展示素材（favicon / apple-touch-icon / Open Graph 分享图）。
 *
 * ⚠️ 素材性质说明（重要）：
 *   - 这些 PNG 是**站点展示素材**，不是新设计的公司 Logo，也没有改动任何现有商标。
 *   - 图标使用站点现有品牌字标 "BW"（页头 / 页脚本来就用这个字标），纯色背景，可直接替换。
 *   - 分享图复用公司**现有 Logo 原图**（data/legacy-site/images/other/logo.png，
 *     只做等比缩放摆放，不裁剪、不改色、不重绘）。
 *   - 渲染方式：本机 Chrome + CDP 截图（沿用 tools/lib/cdp-render.mjs），
 *     不引入任何图像库，也不用 AI 生成任何图像。
 *
 * 用法：node tools/build-brand-assets.mjs
 * 产物：public/icon.png (512×512)、public/apple-icon.png (180×180)、public/og-image.png (1200×630)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withChrome } from '../../tools/lib/cdp-render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '..');
const LOGO = path.join(REPO, 'data', 'legacy-site', 'images', 'other', 'logo.png');
const OUT = path.join(ROOT, 'public');

const NAVY = '#0b1b2b';
const NAVY_700 = '#16395c';
const ACCENT = '#ea580c';

const logoBase64 = fs.readFileSync(LOGO).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

/** 图标：纯色底 + 站点现有 "BW" 字标 */
function iconHtml(size) {
  const bw = Math.round(size * 0.46);
  const bar = Math.max(6, Math.round(size * 0.035));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
    .wrap{width:${size}px;height:${size}px;background:${NAVY};display:flex;flex-direction:column;
          align-items:center;justify-content:center;font-family:${FONT}}
    .bw{color:#fff;font-size:${bw}px;font-weight:800;letter-spacing:${Math.round(size * 0.012)}px;line-height:1}
    .bar{width:${Math.round(size * 0.34)}px;height:${bar}px;background:${ACCENT};
         margin-top:${Math.round(size * 0.06)}px;border-radius:${bar}px}
  </style></head><body>
    <div class="wrap"><div class="bw">BW</div><div class="bar"></div></div>
  </body></html>`;
}

/** Open Graph 分享图：深蓝底 + 公司现有 Logo 原图 + 英文品牌信息 */
function ogHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
    .wrap{position:relative;width:1200px;height:630px;
      background:linear-gradient(135deg, ${NAVY} 0%, ${NAVY_700} 62%, #1d4d78 100%);
      font-family:${FONT};color:#fff;display:flex;flex-direction:column;
      justify-content:space-between;padding:64px 72px;box-sizing:border-box}
    .logoPanel{background:#fff;border-radius:10px;padding:18px 22px;display:inline-block;align-self:flex-start}
    .logoPanel img{display:block;width:322px;height:74px}
    h1{margin:0;font-size:60px;line-height:1.1;font-weight:800;letter-spacing:-0.5px}
    .sub{margin:18px 0 0;font-size:26px;color:rgba(255,255,255,.82);line-height:1.4;max-width:880px}
    .rule{width:120px;height:7px;background:${ACCENT};border-radius:7px;margin:0 0 26px}
    .foot{display:flex;align-items:baseline;justify-content:space-between;gap:24px;
      border-top:1px solid rgba(255,255,255,.18);padding-top:22px}
    .legal{font-size:21px;color:rgba(255,255,255,.72)}
    .site{font-size:21px;color:rgba(255,255,255,.9);font-weight:600}
  </style></head><body>
    <div class="wrap">
      <div>
        <div class="logoPanel"><img src="${logoDataUri}" alt="Bowen logo"></div>
        <div style="height:44px"></div>
        <div class="rule"></div>
        <h1>Automotive Thermostat<br>Manufacturer</h1>
        <p class="sub">Thermostats, temperature sensors and vehicle switches — search by OE number or Bowen No.</p>
      </div>
      <div class="foot">
        <span class="legal">Qufu Bowen Auto Parts Manufacturing Co., Ltd.</span>
        <span class="site">Qufu, Shandong, China</span>
      </div>
    </div>
  </body></html>`;
}

function dataUrl(html) {
  return `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`;
}

async function shoot(url, width, height, outFile) {
  await withChrome(
    async ({ rpc, navigate, sleep }) => {
      await navigate(url, 900);
      await sleep(400);
      const shot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
    },
    { width, height },
  );
}

async function main() {
  if (!fs.existsSync(LOGO)) throw new Error(`找不到公司 Logo 原图: ${LOGO}`);
  fs.mkdirSync(OUT, { recursive: true });

  const targets = [
    { file: 'icon.png', html: iconHtml(512), w: 512, h: 512 },
    { file: 'apple-icon.png', html: iconHtml(180), w: 180, h: 180 },
    { file: 'og-image.png', html: ogHtml(), w: 1200, h: 630 },
  ];

  for (const t of targets) {
    const outFile = path.join(OUT, t.file);
    await shoot(dataUrl(t.html), t.w, t.h, outFile);
    const bytes = fs.statSync(outFile).size;
    console.log(`written  public/${t.file}  ${t.w}x${t.h}  ${bytes} bytes`);
  }
}

await main();
