/**
 * RFQ 领域常量与限额（服务端与客户端共享的"数字来源"）
 * ===========================================================================
 * 客户端表单的 maxLength 也引用这里的值，避免前后端限额写两遍、慢慢漂移。
 * 注意：客户端引用只是 UX 提示，**服务端仍然独立校验**（客户端可被绕过）。
 */

/** 隐私政策版本号：隐私文本或同意口径变化时必须递增 */
export const PRIVACY_CONSENT_VERSION = '2026-09-rfq-en-v1';

/**
 * 反垃圾 honeypot 字段名。
 * 用一个对爬虫"看起来正常"的名字（传真号），但真实用户永远看不到它
 * （CSS 隐藏 + tabIndex=-1 + aria-hidden）。
 */
export const HONEYPOT_FIELD = 'fax';

/** 请求体上限（字节）。RFQ 正文最大 5000 字符，64KB 足够且能挡住批量灌水。 */
export const MAX_BODY_BYTES = 64 * 1024;

/** 单个 RFQ 明细行数上限 */
export const MAX_ITEMS = 50;

/** 字段长度上限（字符） */
export const FIELD_LIMITS = {
  name: 120,
  company: 160,
  country: 80,
  email: 200,
  whatsapp_phone: 60,
  website: 300,
  message: 5000,
  quantity: 60,
  remark: 240,
  source_page: 300,
  user_agent: 400,
} as const;

/** 询价记录状态（内部字段，不出现在客户页面） */
export const RFQ_STATUS = {
  received: 'received',
} as const;

/** 邮件投递状态（内部字段，不出现在客户页面） */
export const EMAIL_STATUS = {
  pending: 'pending',
  sent: 'sent',
  failed: 'email_failed',
  notConfigured: 'email_not_configured',
} as const;

export type EmailDeliveryStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];

/** 统一错误码（返回给客户端的只有 code + 通用英文提示） */
export const RFQ_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  spam: 'SPAM_REJECTED',
  rateLimited: 'RATE_LIMITED',
  duplicate: 'DUPLICATE_SUBMISSION',
  captcha: 'CAPTCHA_FAILED',
  payloadTooLarge: 'PAYLOAD_TOO_LARGE',
  methodNotAllowed: 'METHOD_NOT_ALLOWED',
  /** 跨站来源被拒绝（Origin 与本站不一致） */
  forbiddenOrigin: 'FORBIDDEN_ORIGIN',
  unavailable: 'SERVICE_UNAVAILABLE',
  internal: 'INTERNAL_ERROR',
} as const;

export type RfqErrorCode = (typeof RFQ_ERROR_CODES)[keyof typeof RFQ_ERROR_CODES];

/** 默认限流参数（可用环境变量覆盖） */
export const DEFAULT_RATE_LIMIT_MAX = 5;
export const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 600;

/** 最短填写耗时（毫秒）。低于该值视为机器人。 */
export const DEFAULT_MIN_FILL_MS = 3000;

/** 相同内容去重窗口（秒） */
export const DEFAULT_DUPLICATE_WINDOW_SECONDS = 900;

/** 站点默认收件邮箱（业务方已确认）。可在 .env 里用 RFQ_RECIPIENT_EMAIL 覆盖。 */
export const DEFAULT_RECIPIENT_EMAIL = 'qfbowen@126.com';

