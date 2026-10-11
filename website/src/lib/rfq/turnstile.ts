/**
 * Cloudflare Turnstile 服务端校验（可选，默认关闭）
 * ===========================================================================
 * 行为：
 *   - TURNSTILE_SECRET_KEY 未配置 → enabled=false，校验直接跳过（本地/预览默认如此）；
 *     此时其余反垃圾手段（honeypot、最短耗时、限流、去重、字段校验）仍然生效。
 *   - 配置了密钥 → 必须携带有效 token，否则拒绝；网络异常按失败处理（fail closed）。
 *   - 绝不在日志或响应里回显 Cloudflare 的响应体全文与密钥。
 *
 * Phase 5.1 新增：
 *   1. **hostname 校验**：siteverify 返回 hostname 时，与 NEXT_PUBLIC_SITE_URL 的主机名比对，
 *      不一致即拒绝（不硬编码任何正式域名）。
 *   2. **受控的本地 mock（RFQ_TURNSTILE_MODE=mock）**：
 *      自动化测试不允许访问真实 Cloudflare，因此提供一个显式开关。
 *      该开关在托管生产环境（VERCEL_ENV=production）下**强制失效**，
 *      并且 config/site-env.mjs 的生产就绪校验会直接让生产构建失败 ——
 *      也就是说它不可能在生产环境被打开。
 *      mock 只影响"token 是否通过"，不会绕过任何其它校验。
 */
import 'server-only';

import { isManagedProduction } from '../../../config/site-env.mjs';

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8_000;

/** 自动化测试专用 token（仅在 mock 模式下被接受） */
export const TURNSTILE_MOCK_TOKEN = 'bowen-turnstile-mock-pass';

export function isTurnstileEnabled(): boolean {
  return Boolean((process.env.TURNSTILE_SECRET_KEY ?? '').trim());
}

/**
 * 是否处于受控 mock 模式。
 * 生产环境返回 'live'（无论环境变量怎么设），保证 mock 不可能在生产生效。
 */
export function turnstileMode(): 'live' | 'mock' {
  if ((process.env.RFQ_TURNSTILE_MODE ?? '').trim().toLowerCase() !== 'mock') return 'live';
  if (isManagedProduction(process.env)) return 'live';
  return 'mock';
}

export interface TurnstileResult {
  ok: boolean;
  /** 内部诊断用（已脱敏，不含密钥、不含 token） */
  reason: string;
}

/** 期望的主机名（来自 NEXT_PUBLIC_SITE_URL；未配置时返回 null → 不做 hostname 比对） */
function expectedHostname(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export async function verifyTurnstile(token: string, remoteIp: string): Promise<TurnstileResult> {
  const secret = (process.env.TURNSTILE_SECRET_KEY ?? '').trim();
  if (!secret) return { ok: true, reason: 'not_configured' };

  const value = String(token ?? '').trim();
  if (!value) return { ok: false, reason: 'missing_token' };

  // ---- 受控 mock：不访问网络，只接受固定的测试 token ----
  if (turnstileMode() === 'mock') {
    return value === TURNSTILE_MOCK_TOKEN
      ? { ok: true, reason: 'mock_verified' }
      : { ok: false, reason: 'mock_rejected' };
  }

  const form = new URLSearchParams({ secret, response: value });
  if (remoteIp && remoteIp !== 'unknown') form.set('remoteip', remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // fail closed：验证服务不可用时不放行
    return { ok: false, reason: `verification_unavailable (${(err as Error).name})` };
  }

  if (!res.ok) return { ok: false, reason: `verification_http_${res.status}` };

  try {
    const body = (await res.json()) as {
      success?: boolean;
      hostname?: string;
      'error-codes'?: string[];
    };
    if (body?.success !== true) {
      const codes = Array.isArray(body?.['error-codes'])
        ? body['error-codes'].slice(0, 3).join(',')
        : 'unknown';
      return { ok: false, reason: `rejected (${codes})` };
    }

    // 只有 Cloudflare 返回 hostname 时才比对；未配置正式域名则跳过比对。
    const expected = expectedHostname();
    const actual = typeof body.hostname === 'string' ? body.hostname.trim().toLowerCase() : '';
    if (expected && actual && actual !== expected) {
      return { ok: false, reason: 'hostname_mismatch' };
    }

    return { ok: true, reason: 'verified' };
  } catch {
    return { ok: false, reason: 'unreadable_response' };
  }
}
