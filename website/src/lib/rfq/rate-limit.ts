/**
 * RFQ 限流（服务端内存实现）+ IP 哈希
 * ===========================================================================
 * 隐私要求：**不保存明文 IP**。
 *   - 限流键 = HMAC-SHA256(RFQ_IP_HASH_SECRET, ip) 的前 32 位十六进制；
 *   - 只存在于进程内存，不写数据库、不写日志；
 *   - 未配置密钥时使用进程级随机密钥（重启即失效，且不同实例之间不共享），
 *     绝不会退化成"明文 IP 当键"。
 *
 * ⚠️ 单进程内存限流的局限（已写入部署文档）：
 *   多实例/无服务器部署时每个实例各算一份。生产上线后建议换成
 *   Upstash Redis / Cloudflare 限流规则；本模块已把接口收敛到 checkRateLimit()，
 *   替换实现不影响路由层。
 *
 * ⚠️ 关于客户端 IP：
 *   Next.js Route Handler 拿不到 socket 地址，只能依赖代理请求头。
 *   因此只有 RFQ_TRUST_PROXY=true 时才读取 x-forwarded-for 的第一段
 *   （部署在 nginx / Cloudflare / Vercel 等会覆写该头的代理后面）。
 *   未启用时所有请求共享一个桶（限流仍然生效，但会更早触发）。
 */
import 'server-only';

import crypto from 'node:crypto';

import { DEFAULT_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_WINDOW_SECONDS } from './constants';

const PROCESS_SECRET = crypto.randomBytes(32);

function ipHashSecret(): Buffer {
  const configured = (process.env.RFQ_IP_HASH_SECRET ?? '').trim();
  if (configured) return Buffer.from(configured, 'utf8');
  return PROCESS_SECRET;
}

/** 生成短期限流键（HMAC 截断，不可逆推 IP） */
export function buildRateLimitKey(ip: string): string {
  const digest = crypto
    .createHmac('sha256', ipHashSecret())
    .update(String(ip ?? 'unknown'))
    .digest('hex');
  return digest.slice(0, 32);
}

/** 内容指纹（用于"相同内容短时间重复提交"检测），不含任何明文身份信息 */
export function buildSubmissionFingerprint(parts: readonly string[]): string {
  return crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32);
}

function readInt(name: string, fallback: number): number {
  const raw = Number.parseInt((process.env[name] ?? '').trim(), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function rateLimitMax(): number {
  return readInt('RFQ_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX);
}

export function rateLimitWindowSeconds(): number {
  return readInt('RFQ_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_RATE_LIMIT_WINDOW_SECONDS);
}

export function minFillMs(): number {
  return readInt('RFQ_MIN_FILL_MS', 3000) || 3000;
}

export function duplicateWindowSeconds(): number {
  return readInt('RFQ_DUPLICATE_WINDOW_SECONDS', 900) || 900;
}

interface Bucket {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number, windowMs: number): void {
  // 简单的惰性清理：每 5 分钟清一次过期桶，避免内存无界增长
  if (now - lastSweep < 300_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > windowMs * 2) buckets.delete(key);
  }
}

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  /** 被拒绝时建议的 Retry-After 秒数 */
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, nowMs: number = Date.now()): RateLimitOutcome {
  const windowMs = rateLimitWindowSeconds() * 1000;
  const max = rateLimitMax();
  sweep(nowMs, windowMs);

  const existing = buckets.get(key);
  if (!existing || nowMs - existing.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: nowMs });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.windowStartedAt + windowMs - nowMs) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, retryAfterSeconds: 0 };
}

/** 仅供测试脚本使用 */
export function resetRateLimitState(): void {
  buckets.clear();
  lastSweep = 0;
}
