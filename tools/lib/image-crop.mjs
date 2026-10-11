#!/usr/bin/env node
/**
 * 图片确定性裁剪（零第三方依赖）
 * ===========================================================================
 * 用途：业务方 D6 决定「IMG-0780 先裁剪」——该图是手机截图，
 *       上下有纯黑信筒区 + 系统状态栏 + 相册底栏，需要裁掉界面部分，只留产品图。
 *
 * 做法：借本机已装的 Chrome 的 canvas 读取真实像素（不引入图像库），
 *       程序化测量出「白色产品图带」的边界，再按测得的矩形裁切导出 PNG。
 *       裁剪矩形是**测量出来的**，不是人眼估的，因此可复现、可复核。
 *
 * 用法（作为库）：
 *   const r = await cropToContent(inputJpegPath, outputPngPath);
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { withChrome } from './cdp-render.mjs';
import { removeTree, unlinkWithRetry } from './fsx.mjs';

const toFileUrl = (p) => 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\//, '');

/**
 * 在页面里测量「内容带」。
 *
 * 手机截图的结构是：状态栏（彩色）→ 纯黑信筒区 → 产品图 → 纯黑信筒区 → 相册底栏。
 * 因此最稳的判据不是「白色占比」（产品本体遮住白底时会误判），
 * 而是「整行近黑」：找出两段足够长的纯黑信筒行带，两张之间的就是产品图。
 *
 * 近黑阈值 16（8bit），近白阈值 235；JPEG 压缩噪声在这个阈值下不会误判。
 */
const MEASURE_JS = `(() => {
  const im = document.getElementById('im');
  if (!im) return JSON.stringify({ error: 'no image element' });
  if (!im.naturalWidth) return JSON.stringify({ error: 'image not loaded' });
  const W = im.naturalWidth, H = im.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const BLACK = 16, WHITE = 235;
  const stepX = W > 1600 ? 4 : 1;
  const samples = Math.ceil(W / stepX);
  const rowBlack = new Float64Array(H);
  const rowWhite = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    let nb = 0, nw = 0;
    for (let x = 0; x < W; x += stepX) {
      const i = (y * W + x) * 4;
      const r = d[i], g = d[i+1], b = d[i+2];
      if (r <= BLACK && g <= BLACK && b <= BLACK) nb++;
      if (r >= WHITE && g >= WHITE && b >= WHITE) nw++;
    }
    rowBlack[y] = nb / samples;
    rowWhite[y] = nw / samples;
  }
  // 连续近黑行带
  const runs = [];
  let cur = -1;
  for (let y = 0; y < H; y++) {
    if (rowBlack[y] >= 0.995) { if (cur < 0) cur = y; }
    else if (cur >= 0) { runs.push({ s: cur, e: y - 1, len: y - cur }); cur = -1; }
  }
  if (cur >= 0) runs.push({ s: cur, e: H - 1, len: H - cur });
  const minLen = Math.max(4, Math.round(H * 0.02));
  const big = runs.filter((r) => r.len >= minLen).sort((a, b) => a.s - b.s);

  // 产品图 = 两段纯黑信筒行带之间**最大**的非黑行区间。
  // （不能简单取「第一段之后」：状态栏里的返回按钮会在信筒区上方再切出一小段非黑行。）
  let top = null, bottom = null, method = null;
  let bestGap = -1;
  for (let i = 0; i + 1 < big.length; i++) {
    const gs = big[i].e + 1;
    const ge = big[i + 1].s - 1;
    const len = ge - gs + 1;
    if (len > bestGap) { bestGap = len; top = gs; bottom = ge; }
  }
  if (top !== null && bestGap >= Math.max(8, Math.round(H * 0.05))) {
    method = 'black_letterbox_gap';
  } else {
    // 退路：最长连续高白行带（≥50%）
    let best = { s: -1, e: -1 }, c2 = -1;
    for (let y = 0; y < H; y++) {
      if (rowWhite[y] >= 0.5) { if (c2 < 0) c2 = y; }
      else if (c2 >= 0) { if (y - c2 > best.e - best.s) best = { s: c2, e: y - 1 }; c2 = -1; }
    }
    if (c2 >= 0 && H - c2 > best.e - best.s) best = { s: c2, e: H - 1 };
    if (best.s < 0) return JSON.stringify({ error: 'no content band found', W, H });
    top = best.s; bottom = best.e;
    method = 'white_band_fallback';
  }
  if (bottom <= top) return JSON.stringify({ error: 'degenerate band', W, H, top, bottom });

  // 带内左右边界：该带里所有非黑像素的最小/最大列（黑边不算内容）
  let minX = W, maxX = -1;
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!(d[i] <= BLACK && d[i+1] <= BLACK && d[i+2] <= BLACK)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
  }
  return JSON.stringify({
    W, H, top, bottom, left: minX, right: maxX, method,
    black_runs: big.map((r) => ({ s: r.s, e: r.e, len: r.len })),
    top_row_black_frac: Number(rowBlack[top].toFixed(4)),
    bottom_row_black_frac: Number(rowBlack[bottom].toFixed(4)),
  });
})()`;

/**
 * 裁切单张图片到「内容带」并导出 PNG。
 * @param {string} srcPath 源图片（jpeg/png 均可）
 * @param {string} outPath 输出 PNG
 * @param {{ padTop?: number, padBottom?: number }} [opts]
 * @returns {Promise<{x:number,y:number,width:number,height:number,sourceWidth:number,sourceHeight:number}>}
 */
export async function cropToContent(srcPath, outPath, opts = {}) {
  const { padTop = 0, padBottom = 0 } = opts;
  const src = path.resolve(srcPath);
  if (!fs.existsSync(src)) throw new Error(`找不到源图片: ${src}`);

  // 探针页面放在系统临时目录，不污染仓库；图片用绝对 file:// 引用，
  // 配合 --allow-file-access-from-files 让 canvas 读得到像素。
  const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-crop-'));
  const probePath = path.join(probeDir, 'probe.html');
  fs.writeFileSync(probePath, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#000}img{display:block;image-rendering:pixelated}</style>
<img id="im" src="${toFileUrl(src)}">`, 'utf8');

  try {
    return await withChrome(async ({ rpc, evaluate, navigate, sleep }) => {
      await navigate(toFileUrl(probePath), 1200);
      // 等图片解码完成
      for (let i = 0; i < 40; i++) {
        const ok = await evaluate(`(() => { const im = document.getElementById('im'); return !!(im && im.complete && im.naturalWidth); })()`);
        if (ok) break;
        await sleep(200);
      }
      const raw = await evaluate(MEASURE_JS);
      const m = JSON.parse(raw);
      if (m.error) throw new Error(`测量失败: ${m.error}（${src}）`);

      const x = 0;
      let y = m.top - padTop;
      const width = m.right + 1;
      let height = (m.bottom + padBottom) - y + 1;
      if (y < 0) { height += y; y = 0; }
      if (y + height > m.H) height = m.H - y;
      if (width <= 0 || height <= 0) throw new Error(`测得矩形非法: ${JSON.stringify(m)}`);

      await rpc('Emulation.setDeviceMetricsOverride', {
        width: m.W, height: m.H, deviceScaleFactor: 1, mobile: false,
      });
      await sleep(200);
      const shot = await rpc('Page.captureScreenshot', {
        format: 'png',
        clip: { x, y, width, height, scale: 1 },
        captureBeyondViewport: true,
      });
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      return {
        x, y, width, height,
        sourceWidth: m.W, sourceHeight: m.H,
        measure: {
          method: m.method,
          content_top_row: m.top,
          content_bottom_row: m.bottom,
          content_left_col: m.left,
          content_right_col: m.right,
          black_runs: m.black_runs,
          top_row_black_frac: m.top_row_black_frac,
          bottom_row_black_frac: m.bottom_row_black_frac,
        },
      };
    }, { extraFlags: ['--allow-file-access-from-files'], width: 1200, height: 900 });
  } finally {
    await unlinkWithRetry(probePath);
    try { removeTree(probeDir); } catch { /* 临时目录删不掉不影响结果 */ }
  }
}

export { toFileUrl };
