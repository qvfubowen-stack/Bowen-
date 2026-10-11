/**
 * RFQ 提交编排（业务主流程）
 * ===========================================================================
 * 顺序与失败语义：
 *   限流 → Turnstile（可选）→ 校验 → 去重 → **先落库** → 再发邮件 → 记录投递状态
 *
 *   为什么先落库再发邮件：
 *     一旦邮件失败，询价记录必须仍然存在（状态 email_failed），
 *     绝不因为邮件通道故障丢掉客户询价。
 *   为什么落库失败要返回错误：
 *     落库失败时没有任何持久记录，如果返回成功就是"假装收到"。
 *     此时返回 SERVICE_UNAVAILABLE，让客户稍后重试或直接发邮件。
 */
import 'server-only';

import crypto from 'node:crypto';

import {
  EMAIL_STATUS,
  PRIVACY_CONSENT_VERSION,
  RFQ_ERROR_CODES,
  RFQ_STATUS,
  type RfqErrorCode,
} from './constants';
import { summarizeErrorForLog } from './errors';
import { getFromEmail, getMailer, getRecipientEmail, type RfqMailer } from './mail';
import { renderRfqEmail } from './mail/templates';
import {
  buildRateLimitKey,
  buildSubmissionFingerprint,
  checkRateLimit,
  duplicateWindowSeconds,
} from './rate-limit';
import { getRfqStore } from './store';
import { isTurnstileEnabled, verifyTurnstile } from './turnstile';
import { validateRfqBody } from './validate';
import type {
  RfqInquiryRecord,
  RfqRequestContext,
  RfqResponse,
  RfqValidatedSubmission,
} from './types';

export interface RfqServiceResult {
  status: number;
  body: RfqResponse;
}

const GENERIC_VALIDATION_MESSAGE = 'Please check the form and try again.';

function errorResult(
  status: number,
  code: RfqErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): RfqServiceResult {
  return { status, body: { ok: false, code, message, ...(fieldErrors ? { field_errors: fieldErrors } : {}) } };
}

/** 生成询价号：BW-RFQ-YYYYMMDD-XXXXXX（日期用 UTC，便于跨时区对账） */
export function buildInquiryNumber(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BW-RFQ-${y}${m}${d}-${suffix}`;
}

/** 内容指纹：用于"相同内容短时间重复提交"检测 */
export function buildFingerprint(value: RfqValidatedSubmission): string {
  return buildSubmissionFingerprint([
    value.contact.email.toLowerCase(),
    value.contact.message.replace(/\s+/g, ' ').trim(),
    ...value.items.map((i) => `${i.product_id}|${i.application_id ?? ''}|${i.quantity ?? ''}`),
  ]);
}

function buildRecord(
  value: RfqValidatedSubmission,
  fingerprint: string,
  ctx: RfqRequestContext,
  now: Date,
): RfqInquiryRecord {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    inquiry_number: buildInquiryNumber(now),
    name: value.contact.name,
    company: value.contact.company,
    country: value.contact.country,
    email: value.contact.email,
    whatsapp_phone: value.contact.whatsapp_phone || null,
    website: value.contact.website,
    message: value.contact.message || null,
    items: value.items,
    source_page: value.source_page,
    status: RFQ_STATUS.received,
    email_delivery_status: EMAIL_STATUS.pending,
    email_delivery_error: null,
    privacy_consent_version: value.privacy_consent_version || PRIVACY_CONSENT_VERSION,
    user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 400) : null,
    submission_fingerprint: fingerprint,
    created_at: iso,
    updated_at: iso,
  };
}

/**
 * 邮件失败时给客户的诚实提示（不含任何内部细节）。
 * ⚠️ Phase 5.1：删除了"一个工作日内回复"这类**未经业务方确认的时效承诺**，
 *    也不再暗示已经发出过确认邮件。只陈述事实 + 给出可执行的兜底联系方式。
 */
function fallbackNotice(): string {
  return (
    `Your enquiry has been recorded. If you have not received a reply, please email `
    + `${getRecipientEmail()} directly and include your inquiry number.`
  );
}

export async function submitRfq(
  rawBody: unknown,
  ctx: RfqRequestContext,
): Promise<RfqServiceResult> {
  const now = ctx.now ?? new Date();

  // ---------------------------------------------------------------- 1. 限流
  const rateKey = buildRateLimitKey(ctx.ip);
  const limit = checkRateLimit(rateKey, now.getTime());
  if (!limit.allowed) {
    return errorResult(
      429,
      RFQ_ERROR_CODES.rateLimited,
      `Too many enquiries from this connection. Please try again later, or email ${getRecipientEmail()} directly.`,
    );
  }

  // ---------------------------------------------------------------- 2. Turnstile
  if (isTurnstileEnabled()) {
    const token = typeof rawBody === 'object' && rawBody !== null
      ? String((rawBody as Record<string, unknown>).turnstile_token ?? '')
      : '';
    const captcha = await verifyTurnstile(token, ctx.ip);
    if (!captcha.ok) {
      console.warn(`[rfq] captcha rejected: ${captcha.reason}`);
      return errorResult(
        400,
        RFQ_ERROR_CODES.captcha,
        'The verification check did not pass. Please reload the page and try again.',
      );
    }
  }

  // ---------------------------------------------------------------- 3. 校验
  const validation = await validateRfqBody(rawBody);
  if (!validation.ok) {
    if (validation.code === RFQ_ERROR_CODES.spam) {
      // 不给机器人任何可用的反馈信号
      return errorResult(400, RFQ_ERROR_CODES.spam, GENERIC_VALIDATION_MESSAGE);
    }
    return errorResult(
      400,
      RFQ_ERROR_CODES.validation,
      GENERIC_VALIDATION_MESSAGE,
      validation.field_errors,
    );
  }

  const value = validation.value;

  // ---------------------------------------------------------------- 4. 去重
  const fingerprint = buildFingerprint(value);
  let store;
  try {
    store = await getRfqStore();
  } catch (err) {
    console.error(`[rfq] store unavailable: ${summarizeErrorForLog(err)}`);
    return errorResult(503, RFQ_ERROR_CODES.unavailable, 'We could not record your enquiry. Please try again in a moment.');
  }

  try {
    const since = new Date(now.getTime() - duplicateWindowSeconds() * 1000).toISOString();
    const existing = await store.findRecentByFingerprint(fingerprint, since);
    if (existing) {
      return errorResult(
        409,
        RFQ_ERROR_CODES.duplicate,
        `We already received this enquiry (${existing.inquiry_number}). Our team will reply to it shortly.`,
      );
    }
  } catch (err) {
    // 去重查询失败不应阻断真实客户：记录问题后继续
    console.warn(`[rfq] duplicate check skipped: ${summarizeErrorForLog(err)}`);
  }

  // ---------------------------------------------------------------- 5. 落库（先存后发）
  const record = buildRecord(value, fingerprint, ctx, now);
  try {
    await store.create(record);
  } catch (err) {
    console.error(`[rfq] could not persist inquiry: ${summarizeErrorForLog(err)}`);
    return errorResult(
      503,
      RFQ_ERROR_CODES.unavailable,
      `We could not record your enquiry, so nothing was sent. Please try again in a moment, or email ${getRecipientEmail()} directly.`,
    );
  }

  // ---------------------------------------------------------------- 6. 发邮件
  let mailer: RfqMailer | null = null;
  let emailStatus: string = EMAIL_STATUS.sent;
  let emailError: string | null = null;
  let notice: string | undefined;

  try {
    mailer = await getMailer();
    const rendered = renderRfqEmail(record);
    await mailer.send({
      to: getRecipientEmail(),
      from: getFromEmail(),
      replyTo: record.email || null,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  } catch (err) {
    emailStatus = mailer?.driver === 'unconfigured'
      ? EMAIL_STATUS.notConfigured
      : EMAIL_STATUS.failed;
    emailError = summarizeErrorForLog(err);
    notice = fallbackNotice();
    console.error(`[rfq] inquiry ${record.inquiry_number} stored but email delivery failed: ${emailError}`);
  }

  // 投递状态写回；写回失败不影响"询价已收到"这一事实
  try {
    await store.updateEmailDelivery(record.id, {
      status: emailStatus,
      error: emailError,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[rfq] could not update delivery status for ${record.inquiry_number}: ${summarizeErrorForLog(err)}`);
  }

  return {
    status: 200,
    body: {
      ok: true,
      inquiry_id: record.id,
      inquiry_number: record.inquiry_number,
      message: 'Your inquiry has been received.',
      ...(notice ? { notice } : {}),
    },
  };
}

/** 运行期自检摘要（不含任何密钥），供启动日志与部署核对使用 */
export async function describeRfqRuntime(): Promise<Record<string, string | boolean>> {
  const mailer = await getMailer();
  const store = await getRfqStore();
  return {
    store_driver: store.driver,
    mail_driver: mailer.driver,
    mail_configured: mailer.configured,
    recipient_configured: Boolean(getRecipientEmail()),
    from_configured: Boolean(getFromEmail()),
    turnstile_enabled: isTurnstileEnabled(),
    trust_proxy: (process.env.RFQ_TRUST_PROXY ?? '').trim().toLowerCase() === 'true',
  };
}
