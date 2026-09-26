/**
 * Phase 3.5 —— 旧站抓取的 HTTP 客户端（纯 Node.js，零第三方依赖）
 * ---------------------------------------------------------------------
 * 约束（写在代码里的规则）：
 *   1. 只抓公开页面：不提交表单、不带 Cookie、不绕验证码、不碰 /gbook 留言提交。
 *   2. 走本机 HTTP 代理（环境已配置 HTTP(S)_PROXY），Node 24 的
 *      NODE_USE_ENV_PROXY 让内置 fetch 尊重该代理。
 *   3. 失败重试 + 超时 + 限速，避免把旧站打挂（旧站是 IIS/AspCms，很慢）。
 *   4. 返回原始字节，由调用方决定编码（旧站实测是 UTF-8）。
 */
import { setTimeout as sleep } from 'node:timers/promises';

process.env.NODE_USE_ENV_PROXY = '1';

export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BowenLegacyAudit/1.0';

/**
 * 单次 GET，返回 { status, ok, contentType, buffer, text, bytes, finalUrl, error }
 */
export async function httpGetOnce(url, opts = {}) {
  const { timeoutMs = 45000, ua = DEFAULT_UA } = opts;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': ua,
        Accept: opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    const contentType = res.headers.get('content-type') || '';
    return {
      status: res.status,
      ok: res.ok,
      contentType,
      buffer,
      bytes: buffer.length,
      finalUrl: res.url || url,
      text: /charset=(gb2312|gbk|gb18030)/i.test(contentType)
        ? new TextDecoder('gbk').decode(buffer)
        : buffer.toString('utf8'),
      error: null,
    };
  } catch (e) {
    return {
      status: 0, ok: false, contentType: '', buffer: Buffer.alloc(0), bytes: 0,
      finalUrl: url, text: '', error: (e.cause && e.cause.code) || e.code || e.message,
    };
  }
}

/**
 * 带重试的 GET。默认重试 3 次，退避 700ms / 1600ms。
 * onAttempt 回调用于进度输出。
 */
export async function httpGet(url, opts = {}) {
  const { retries = 3, backoffMs = 700, onAttempt } = opts;
  let last = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    last = await httpGetOnce(url, opts);
    // 404/403 这类确定性结果不重试；5xx 与网络错误重试
    if (last.ok || (last.status >= 400 && last.status < 500)) return last;
    if (onAttempt) onAttempt(url, attempt, last);
    if (attempt < retries) await sleep(backoffMs * attempt);
  }
  return last;
}

/**
 * 极简并发池：保持顺序稳定，限制同时在飞的请求数。
 * 旧站很慢，默认并发 3，并在每个请求之间留 delayMs 的礼貌间隔。
 */
export async function pooledMap(items, worker, { concurrency = 3, delayMs = 250 } = {}) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = { __error: e.message, item: items[i] };
      }
      if (delayMs) await sleep(delayMs);
    }
  });
  await Promise.all(runners);
  return results;
}

export { sleep };
