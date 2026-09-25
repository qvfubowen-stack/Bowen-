/**
 * OE 输入标准化
 * ===========================================================================
 * 与数据库构建脚本 tools/build-product-db-v2.mjs 的 oeSearchKey() 保持完全一致：
 * 忽略大小写、空格（含全角）、各类短横线、斜线。
 *
 * 单独成文件是为了让仓储实现与页面层都能引用，且不依赖任何数据源。
 */

/** 忽略大小写、空格、短横线、斜线 */
export function normalizeOeInput(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/[-‐‑‒–—―]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^A-Z0-9.]/g, '');
}

/** 输入看起来像不像一个 OE 号（用来决定搜索走 OE 通道还是关键词通道） */
export function looksLikeOeQuery(raw: string): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  if (t.length < 4 || t.length > 30) return false;
  return /[0-9]/.test(t) && /^[A-Za-z0-9\s\-/._]+$/.test(t);
}
