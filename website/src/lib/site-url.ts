/**
 * 正式站点地址工具（canonical / sitemap / 结构化数据的唯一 URL 来源）
 * ===========================================================================
 * Phase 5 规则：
 *   1. 禁止在代码里硬编码 localhost。本地默认值只在 config/site-env.mjs 里出现一次。
 *   2. 禁止编造正式域名。正式地址必须由 NEXT_PUBLIC_SITE_URL 提供。
 *   3. 未配置正式地址时：canonical 退回本地默认地址，同时**全站保持 noindex**，
 *      sitemap 不输出任何 URL（见 website/src/app/sitemap.ts）。
 *   4. 收录开关 SITE_INDEXING_ENABLED 默认 false，只有显式 true 且地址为 https 才允许收录。
 *
 * 判定逻辑全部在 website/config/site-env.mjs，本文件只是运行期的薄封装，
 * 保证 next.config.ts 的响应头与页面 metadata 用的是同一份判定。
 */
import {
  INDEXING_ENV_KEY,
  LOCAL_SITE_URL,
  SITE_URL_ENV_KEY,
  isIndexingEnabled as isIndexingEnabledFor,
  resolveSiteUrl,
  validateSiteEnv,
} from '../../config/site-env.mjs';

/** 站点地址（无尾斜杠）。未配置正式地址时返回本地默认地址。 */
export function getSiteUrl(): string {
  return resolveSiteUrl(process.env).url;
}

/** 站点 origin（协议 + 主机 + 端口） */
export function getSiteOrigin(): string {
  return resolveSiteUrl(process.env).origin;
}

/** 是否正在使用本地默认地址（= 未配置有效正式地址） */
export function isLocalFallbackUrl(): boolean {
  return resolveSiteUrl(process.env).isLocalFallback;
}

/** 是否允许搜索引擎收录（默认 false） */
export function isIndexingEnabled(): boolean {
  return isIndexingEnabledFor(process.env);
}

/** 环境自检结果（构建期与工具脚本共用） */
export function getSiteEnvCheck() {
  return validateSiteEnv(process.env);
}

/**
 * 生成绝对 URL。传入的 path 必须以 / 开头（站内路径）。
 * 已给出绝对 URL 时原样返回，便于调用方传入已有外链（当前没有这种用法）。
 */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = String(path ?? '/');
  if (/^https?:\/\//i.test(p)) return p;
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

/**
 * 页面 metadata 的 canonical。
 * ---------------------------------------------------------------------------
 * 未配置正式域名时**不输出 canonical**，而不是输出 localhost：
 *   为本地地址生成 canonical 等于对外声明"这一页的正式地址是 127.0.0.1"，
 *   一旦被任何爬虫或分享预览抓到就是错误信号。
 * 配置了 NEXT_PUBLIC_SITE_URL 后，canonical 统一由这里生成，保证全站同源。
 */
export function canonicalFor(path: string): { canonical: string } | undefined {
  if (isLocalFallbackUrl()) return undefined;
  return { canonical: path };
}

/**
 * 页面 metadata 用的 robots 指令。
 * 未开启收录 → 不允许索引；开启收录 → 允许（功能页必须自行覆盖为不允许）。
 */
export function robotsMetadata(): { index: boolean; follow: boolean } {
  const on = isIndexingEnabled();
  return { index: on, follow: on };
}

/** 供报告/日志使用的一句话描述（不含任何密钥） */
export function describeSiteUrlEnv(): string {
  const check = getSiteEnvCheck();
  const url = check.site.valid ? check.site.url : `${LOCAL_SITE_URL} (fallback)`;
  return `${SITE_URL_ENV_KEY}=${check.site.raw || '(unset)'} → ${url}; ${INDEXING_ENV_KEY}=${check.indexing}`;
}
