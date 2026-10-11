/**
 * RFQ 询价邮件发送适配层
 * ===========================================================================
 * 三个驱动（RFQ_MAIL_DRIVER）：
 *   resend        —— 生产推荐；需要 RESEND_API_KEY + RFQ_FROM_EMAIL
 *   mock          —— 自动化测试 / 本地；把邮件写进 outbox JSONL，绝不外发
 *   unconfigured  —— 生产环境缺少必要变量时的显式状态：**发送必然失败**
 *
 * 关键约定（Phase 5 硬要求）：
 *   - 绝不"默默假装发送成功"。缺少配置时 send() 抛错，
 *     调用方把邮件状态写成 email_failed / email_not_configured，但询价记录保留。
 *   - 没有正式域名就不要编造 RFQ_FROM_EMAIL。空值时必须报明确错误。
 *   - API Key 只在服务端读取，不加 NEXT_PUBLIC_ 前缀，不写进任何日志或响应体。
 */
import 'server-only';

import { DEFAULT_RECIPIENT_EMAIL } from './constants';
import { RfqMailError } from './errors';

export interface RfqMailMessage {
  to: string;
  from: string;
  replyTo: string | null;
  subject: string;
  text: string;
  html: string;
}

export type RfqMailDriver = 'mock' | 'resend' | 'unconfigured';

/**
 * 发送结果。
 * providerMessageId 由邮件服务商返回（Resend 返回 `id`），用于对账与排查；
 * 取不到时为 null。**不会**包含任何密钥或客户信息。
 */
export interface RfqMailResult {
  providerMessageId: string | null;
}

export interface RfqMailer {
  readonly driver: RfqMailDriver;
  /** 是否具备实际投递能力（false 时 send 必然抛错） */
  readonly configured: boolean;
  send(message: RfqMailMessage): Promise<RfqMailResult>;
}

/** 收件地址：业务方已确认的销售邮箱 */
export function getRecipientEmail(): string {
  return (process.env.RFQ_RECIPIENT_EMAIL ?? '').trim() || DEFAULT_RECIPIENT_EMAIL;
}

/** 发件地址：没有正式域名时保持为空，不做任何猜测 */
export function getFromEmail(): string {
  return (process.env.RFQ_FROM_EMAIL ?? '').trim();
}

function hasResendCredentials(): boolean {
  return Boolean((process.env.RESEND_API_KEY ?? '').trim() && getFromEmail());
}

/**
 * 驱动判定：
 *   显式设置 RFQ_MAIL_DRIVER 时以它为准（非法值按 auto 处理）；
 *   auto：有 Resend 凭据 → resend；生产环境 → unconfigured；其它 → mock。
 */
export function resolveMailDriver(): RfqMailDriver {
  const raw = (process.env.RFQ_MAIL_DRIVER ?? '').trim().toLowerCase();
  if (raw === 'mock' || raw === 'resend') return raw;
  if (raw === 'unconfigured' || raw === 'none') return 'unconfigured';
  if (hasResendCredentials()) return 'resend';
  return process.env.NODE_ENV === 'production' ? 'unconfigured' : 'mock';
}

export async function getMailer(): Promise<RfqMailer> {
  const driver = resolveMailDriver();
  if (driver === 'resend') {
    const { ResendMailer } = await import('./mail/resend-mailer');
    return new ResendMailer();
  }
  if (driver === 'mock') {
    const { MockMailer } = await import('./mail/mock-mailer');
    return new MockMailer();
  }
  return {
    driver: 'unconfigured',
    configured: false,
    async send(): Promise<RfqMailResult> {
      throw new RfqMailError(
        'mail transport is not configured: set RESEND_API_KEY and RFQ_FROM_EMAIL (and RFQ_RECIPIENT_EMAIL)',
      );
    },
  };
}

/** 供自检/部署文档使用的脱敏摘要（不含密钥） */
export function describeMailConfig(): {
  driver: RfqMailDriver;
  recipient: string;
  fromConfigured: boolean;
  apiKeyConfigured: boolean;
} {
  return {
    driver: resolveMailDriver(),
    recipient: getRecipientEmail(),
    fromConfigured: Boolean(getFromEmail()),
    apiKeyConfigured: Boolean((process.env.RESEND_API_KEY ?? '').trim()),
  };
}
