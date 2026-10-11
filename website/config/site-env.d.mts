/**
 * website/config/site-env.d.mts
 * TypeScript 类型声明，供 next.config.ts 与 src/lib/site-url.ts 引用同名 .mjs。
 * 实现在 site-env.mjs，两处必须保持一致。
 */

export interface ResolvedSiteUrl {
  /** 原始环境变量值 */
  raw: string;
  /** 归一化后的站点地址（无尾斜杠）；未配置时为本地默认地址 */
  url: string;
  /** 站点 origin */
  origin: string;
  /** true = 未配置正式地址或配置无效，正在使用本地默认地址 */
  isLocalFallback: boolean;
  isHttps: boolean;
  valid: boolean;
}

export interface SiteEnvCheck {
  site: ResolvedSiteUrl;
  indexing: boolean;
  isProd: boolean;
  errors: string[];
  warnings: string[];
}

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

export const LOCAL_SITE_URL: string;
export const INDEXING_ENV_KEY: string;
export const SITE_URL_ENV_KEY: string;
export const VERCEL_ENV_KEY: string;
export const ALWAYS_NOINDEX_PATHS: string[];

export type RfqStoreDriverName = 'memory' | 'json' | 'supabase';
export type RfqMailDriverName = 'mock' | 'resend' | 'unconfigured';

export interface TurnstileState {
  site: boolean;
  secret: boolean;
  paired: boolean;
}

export interface ProductionReadiness {
  enabled: boolean;
  errors: string[];
  warnings: string[];
  resolved: {
    storeDriver: RfqStoreDriverName;
    mailDriver: RfqMailDriverName;
    turnstileSiteKeyConfigured: boolean;
    turnstileSecretKeyConfigured: boolean;
  };
}

export function resolveSiteUrl(env?: Record<string, string | undefined>): ResolvedSiteUrl;
export function isIndexingEnabled(env?: Record<string, string | undefined>): boolean;
export function isProductionEnv(env?: Record<string, string | undefined>): boolean;
export function isManagedProduction(env?: Record<string, string | undefined>): boolean;
export function resolveStoreDriverFromEnv(env?: Record<string, string | undefined>): RfqStoreDriverName;
export function resolveMailDriverFromEnv(env?: Record<string, string | undefined>): RfqMailDriverName;
export function resolveTurnstileState(env?: Record<string, string | undefined>): TurnstileState;
export function validateSiteEnv(env?: Record<string, string | undefined>): SiteEnvCheck;
export function validateProductionReadiness(env?: Record<string, string | undefined>): ProductionReadiness;
export function securityHeaders(env?: Record<string, string | undefined>): HeaderEntry[];
export function robotsHeaderRules(env?: Record<string, string | undefined>): HeaderRule[];
