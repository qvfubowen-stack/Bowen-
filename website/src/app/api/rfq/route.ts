/**
 * POST /api/rfq — RFQ 生产端点
 * ===========================================================================
 * 契约：
 *   只接受 POST。其它方法返回 405 + Allow: POST。
 *   请求体必须 application/json，且只允许 constants/validate 定义的白名单字段。
 *   响应统一为 { ok: true, ... } 或 { ok: false, code, message }，
 *   **绝不**返回 API 密钥、数据库错误详情或服务器堆栈。
 *
 * 缓存：所有响应都带 Cache-Control: no-store（询价数据不允许被任何中间层缓存）。
 */
import { NextResponse } from 'next/server';

import { MAX_BODY_BYTES, RFQ_ERROR_CODES } from '@/lib/rfq/constants';
import { summarizeErrorForLog } from '@/lib/rfq/errors';
import { getRecipientEmail } from '@/lib/rfq/mail';
import { submitRfq } from '@/lib/rfq/service';
import type { RfqResponse } from '@/lib/rfq/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: RfqResponse, status: number, extraHeaders?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(extraHeaders ?? {}) },
  });
}

/**
 * 客户端 IP。
 * 只有 RFQ_TRUST_PROXY=true 时才读取代理请求头 —— 否则任何客户端都能伪造该头绕过限流。
 * 未启用时返回固定值，所有请求共享一个限流桶（仍然限流，只是更早触发）。
 */
function clientIp(request: Request): string {
  const trustProxy = (process.env.RFQ_TRUST_PROXY ?? '').trim().toLowerCase() === 'true';
  if (!trustProxy) return 'untrusted-remote';
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  const realIp = (request.headers.get('x-real-ip') ?? '').trim();
  return realIp || 'unknown';
}

/**
 * 同源检查（CSRF 的第一道防线）。
 * 浏览器提交表单一定会带 Origin；与本站不一致时直接拒绝。
 * 没有 Origin 的请求（curl、服务端调用、部分原生客户端）不放行也不额外拦截 ——
 * 它们本来也无法携带用户的浏览器凭据，真正的防线仍然是 JSON-only + 字段校验 + 限流。
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return true;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    const host = request.headers.get('host') ?? requestUrl.host;
    return originUrl.host === requestUrl.host || originUrl.host === host;
  } catch {
    return false;
  }
}

function methodNotAllowed(): NextResponse {
  return json(
    { ok: false, code: RFQ_ERROR_CODES.methodNotAllowed, message: 'Use POST to submit an RFQ.' },
    405,
    { Allow: 'POST' },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!isSameOrigin(request)) {
      return json(
        {
          ok: false,
          code: RFQ_ERROR_CODES.forbiddenOrigin,
          message: 'This request was blocked. Please submit the form from the Bowen website.',
        },
        403,
      );
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(
        { ok: false, code: RFQ_ERROR_CODES.payloadTooLarge, message: 'Your enquiry is too large to send. Please shorten the message.' },
        413,
      );
    }

    let text: string;
    try {
      text = await request.text();
    } catch {
      return json(
        { ok: false, code: RFQ_ERROR_CODES.validation, message: 'Please check the form and try again.' },
        400,
      );
    }

    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return json(
        { ok: false, code: RFQ_ERROR_CODES.payloadTooLarge, message: 'Your enquiry is too large to send. Please shorten the message.' },
        413,
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(
        { ok: false, code: RFQ_ERROR_CODES.validation, message: 'Please check the form and try again.' },
        400,
      );
    }

    const result = await submitRfq(body, {
      ip: clientIp(request),
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 400),
      now: new Date(),
    });

    const headers: Record<string, string> = {};
    if (result.status === 429) {
      headers['Retry-After'] = String(Math.max(1, Number(process.env.RFQ_RATE_LIMIT_WINDOW_SECONDS ?? 600)));
    }
    return json(result.body, result.status, headers);
  } catch (err) {
    // 兜底：任何未预期异常都只记录脱敏摘要，返回通用错误
    console.error(`[rfq] unhandled error: ${summarizeErrorForLog(err)}`);
    return json(
      {
        ok: false,
        code: RFQ_ERROR_CODES.internal,
        message: `We could not process your enquiry. Please try again, or email ${getRecipientEmail()} directly.`,
      },
      500,
    );
  }
}

export function GET(): NextResponse {
  return methodNotAllowed();
}

export function PUT(): NextResponse {
  return methodNotAllowed();
}

export function PATCH(): NextResponse {
  return methodNotAllowed();
}

export function DELETE(): NextResponse {
  return methodNotAllowed();
}
