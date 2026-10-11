/**
 * RFQ 内部错误类型与「可安全写日志」的错误摘要
 * ===========================================================================
 * 目标：邮件/数据库失败时既能诊断，又**绝不**把 API Key、service role key、
 * 完整响应体或服务器堆栈写进日志、返回体或数据库字段。
 */

export class RfqStoreError extends Error {
  readonly operation: string;
  readonly safeDetail: string;

  constructor(operation: string, safeDetail: string) {
    super(`rfq_store_${operation}_failed`);
    this.name = 'RfqStoreError';
    this.operation = operation;
    this.safeDetail = safeDetail;
  }
}

export class RfqMailError extends Error {
  readonly safeDetail: string;

  constructor(safeDetail: string) {
    super('rfq_mail_delivery_failed');
    this.name = 'RfqMailError';
    this.safeDetail = safeDetail;
  }
}

/** 常见密钥字面量，出现即打码 */
const SECRET_PATTERNS: RegExp[] = [
  /re_[A-Za-z0-9_]{6,}/g, // Resend key
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT（Supabase key）
  /sb_[A-Za-z0-9_-]{6,}/g,
  /0x[A-Za-z0-9]{8,}/g,
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi,
];

/**
 * 把任意错误压成一行可安全入库/入日志的文本：
 *   - 只保留错误名与最多 300 字符的消息
 *   - 打码疑似密钥
 *   - 丢弃堆栈
 */
export function summarizeErrorForLog(err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  let message = '';
  if (err instanceof RfqStoreError || err instanceof RfqMailError) {
    message = err.safeDetail;
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err ?? '');
  }

  let safe = `${name}: ${message}`;
  for (const re of SECRET_PATTERNS) safe = safe.replace(re, '[redacted]');
  safe = safe.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return safe.slice(0, 300);
}

/** 判断一条记录里的错误摘要是否含有疑似密钥（自动化测试用它兜底） */
export function containsSuspectedSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}
