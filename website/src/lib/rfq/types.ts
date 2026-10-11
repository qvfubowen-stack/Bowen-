/**
 * RFQ 领域类型
 * ===========================================================================
 * 与 supabase/migrations/001_create_rfq_inquiries.sql 的表结构一一对应。
 *
 * ⚠️ 这里刻意**没有**任何内部审计字段：source_sheets / source_row /
 *    product_type_evidence / 审核状态 / 未公开证书 都不得进入询价记录。
 * ⚠️ 也不保存明文 IP：限流只用带服务器密钥的 HMAC 短键，见 rate-limit.ts。
 */
import type { RfqErrorCode } from './constants';

/** 客户联系信息（已清洗） */
export interface RfqContact {
  name: string;
  company: string;
  country: string;
  email: string;
  whatsapp_phone: string;
  website: string | null;
  message: string;
}

/**
 * RFQ 明细行（服务端重新核验后的结果）。
 * product_type / bowen_no / matched_oe / vehicle 全部以服务端公开产品数据为准，
 * 客户端传来的这些值只用于比对，不直接入库。
 */
export interface RfqItem {
  product_id: string;
  bowen_no: string | null;
  product_type: string | null;
  application_id: string | null;
  matched_oe: string | null;
  vehicle: string | null;
  quantity: string | null;
  remark: string | null;
}

/** 通过校验的提交内容 */
export interface RfqValidatedSubmission {
  contact: RfqContact;
  items: RfqItem[];
  source_page: string | null;
  privacy_consent_version: string;
}

/** 持久化的询价记录 */
export interface RfqInquiryRecord {
  id: string;
  inquiry_number: string;
  name: string;
  company: string;
  country: string;
  email: string;
  whatsapp_phone: string | null;
  website: string | null;
  message: string | null;
  items: RfqItem[];
  source_page: string | null;
  /** 内部状态 */
  status: string;
  /** 内部状态：pending / sent / email_failed / email_not_configured */
  email_delivery_status: string;
  /** 内部诊断信息（已去除密钥与堆栈） */
  email_delivery_error: string | null;
  privacy_consent_version: string;
  user_agent: string | null;
  /** 内部去重指纹（sha256 前 32 位），不对外 */
  submission_fingerprint: string;
  created_at: string;
  updated_at: string;
}

/** 首次邮件投递结果，用于回写存储 */
export interface RfqEmailDeliveryUpdate {
  status: string;
  error: string | null;
  updatedAt: string;
}

/** 客户端可提交的字段白名单（不含任何内部字段） */
export interface RfqSubmissionBody {
  name?: unknown;
  company?: unknown;
  country?: unknown;
  email?: unknown;
  whatsapp_phone?: unknown;
  website?: unknown;
  message?: unknown;
  items?: unknown;
  consent?: unknown;
  privacy_consent_version?: unknown;
  source_page?: unknown;
  elapsed_ms?: unknown;
  turnstile_token?: unknown;
  /** honeypot，见 constants.HONEYPOT_FIELD */
  fax?: unknown;
}

/** 统一响应：成功 */
export interface RfqSuccessResponse {
  ok: true;
  inquiry_id: string;
  inquiry_number: string;
  message: string;
  /** 邮件未送达时给客户的诚实提示（可选） */
  notice?: string;
}

/** 统一响应：失败（绝不包含密钥、数据库错误详情或服务器堆栈） */
export interface RfqErrorResponse {
  ok: false;
  code: RfqErrorCode;
  message: string;
  /** 字段级错误（英文，可直接展示） */
  field_errors?: Record<string, string>;
}

export type RfqResponse = RfqSuccessResponse | RfqErrorResponse;

/** 服务端判定结果 */
export type RfqValidationResult =
  | { ok: true; value: RfqValidatedSubmission }
  | { ok: false; code: RfqErrorCode; field_errors?: Record<string, string> };

/** 提交上下文（由 route handler 从请求中提取） */
export interface RfqRequestContext {
  /** 客户端 IP（仅在 RFQ_TRUST_PROXY=true 时来自 x-forwarded-for） */
  ip: string;
  userAgent: string;
  now?: Date;
}
