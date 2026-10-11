/**
 * Resend 邮件驱动（生产）
 * ===========================================================================
 * 只依赖 fetch，不引入第三方 SDK。要点：
 *   - RESEND_API_KEY 只在服务端读取，绝不加 NEXT_PUBLIC_ 前缀；
 *   - 错误只保留 HTTP 状态码与 Resend 的错误 name/type，绝不回显响应体全文或密钥；
 *   - 带超时，避免上游卡死拖垮 RFQ 请求；
 *   - reply_to 设为客户邮箱，销售可直接回复客户。
 */
import 'server-only';

import { RfqMailError } from '../errors';
import type { RfqMailMessage, RfqMailResult, RfqMailer } from '../mail';

const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 15_000;

interface ResendErrorBody {
  statusCode?: number;
  name?: string;
  message?: string;
  type?: string;
}

export class ResendMailer implements RfqMailer {
  readonly driver = 'resend' as const;
  readonly configured = true;

  async send(message: RfqMailMessage): Promise<RfqMailResult> {
    const apiKey = (process.env.RESEND_API_KEY ?? '').trim();
    if (!apiKey) throw new RfqMailError('RESEND_API_KEY is not configured');
    if (!message.from) {
      throw new RfqMailError(
        'RFQ_FROM_EMAIL is not configured: a verified sender address is required before email delivery can work',
      );
    }

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new RfqMailError(`network error talking to the mail provider (${(err as Error).name})`);
    }

    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as ResendErrorBody;
        detail = [body?.name, body?.type].filter(Boolean).join('/').slice(0, 60);
      } catch {
        detail = '';
      }
      throw new RfqMailError(
        `mail provider rejected the message: HTTP ${res.status}${detail ? ` (${detail})` : ''}`,
      );
    }

    // 成功时取服务商消息 ID（Resend 返回 { id }）。取不到不算失败。
    let providerMessageId: string | null = null;
    try {
      const body = (await res.json()) as { id?: string };
      providerMessageId = typeof body?.id === 'string' && body.id ? body.id.slice(0, 120) : null;
    } catch {
      providerMessageId = null;
    }
    return { providerMessageId };
  }
}
