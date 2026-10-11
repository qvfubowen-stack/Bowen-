/**
 * RFQ 客户端请求体构造（纯函数，可单测）
 * ===========================================================================
 * 职责边界（Phase 5 重构后）：
 *   - 本模块只在**浏览器**里把表单值整理成 POST /api/rfq 的 JSON 请求体；
 *   - 真正的可信校验在服务端（src/lib/rfq/validate.ts）。这里的校验只是 UX 提示，
 *     让客户在提交前就看到错误，不能、也不会被当作安全边界；
 *   - 不再构造"待展示的完整 payload"——询价内容不再回显到页面（避免泄露内部结构）。
 *
 * 字段名与字段长度上限来自 src/lib/rfq/constants.ts，前后端共用一份，避免漂移。
 */
import {
  FIELD_LIMITS,
  HONEYPOT_FIELD,
  MAX_ITEMS,
  PRIVACY_CONSENT_VERSION,
} from './rfq/constants';

/** 表单字段名 → 语义字段的映射（集中在这里，组件与测试共用） */
export const RFQ_FORM_FIELDS = {
  name: 'name',
  company: 'company',
  country: 'country',
  email: 'email',
  whatsapp_phone: 'whatsapp',
  website: 'website',
  message: 'message',
  consent: 'consent',
  honeypot: HONEYPOT_FIELD,
} as const;

/** 用户在表单里填写的联系信息 */
export interface RfqContact {
  name: string;
  company: string;
  country: string;
  email: string;
  whatsapp_phone: string;
  website: string;
  message: string;
  consent: boolean;
}

/** 一行 RFQ 明细（与服务端 RfqItem 对齐；product_type/matched_oe/vehicle 仅供服务端比对） */
export interface RfqSubmitLine {
  product_id: string;
  bowen_no: string;
  product_type: string | null;
  matched_oe: string | null;
  vehicle: string | null;
  application_id: string | null;
  quantity: string;
  remark: string;
}

/** POST /api/rfq 的请求体 */
export interface RfqSubmitBody {
  name: string;
  company: string;
  country: string;
  email: string;
  whatsapp_phone: string;
  website: string;
  message: string;
  items: {
    product_id: string;
    bowen_no: string;
    product_type: string | null;
    matched_oe: string | null;
    vehicle: string | null;
    application_id: string | null;
    quantity: string;
    remark: string;
  }[];
  consent: boolean;
  privacy_consent_version: string;
  source_page: string;
  elapsed_ms: number;
  /** Turnstile token；未配置验证码时为空串 */
  turnstile_token: string;
  /** honeypot：真实用户永远留空 */
  fax: string;
}

/**
 * 从 HTMLFormElement 读取联系信息。
 * 组件与测试都用这个函数，保证"读表单"的口径只有一处。
 */
export function readContactFromForm(form: HTMLFormElement | { elements: unknown }): RfqContact {
  const get = (n: string): string => {
    const el = (form as HTMLFormElement).elements?.namedItem?.(n) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    return el ? String(el.value ?? '').trim() : '';
  };
  const consentEl = (form as HTMLFormElement).elements?.namedItem?.(
    RFQ_FORM_FIELDS.consent,
  ) as HTMLInputElement | null;
  return {
    name: get(RFQ_FORM_FIELDS.name),
    company: get(RFQ_FORM_FIELDS.company),
    country: get(RFQ_FORM_FIELDS.country),
    email: get(RFQ_FORM_FIELDS.email),
    whatsapp_phone: get(RFQ_FORM_FIELDS.whatsapp_phone),
    website: get(RFQ_FORM_FIELDS.website),
    message: get(RFQ_FORM_FIELDS.message),
    consent: consentEl ? Boolean(consentEl.checked) : false,
  };
}

export interface BuildRfqBodyOptions {
  /** 提交时的站内路径，例如 /rfq?product=BW-3005 */
  sourcePage: string;
  /** 从表单出现到点击提交的毫秒数（服务端用于最短耗时判断） */
  elapsedMs: number;
  /**
   * Turnstile token。只有配置了 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时才会有值；
   * 未配置验证码时传 null，提交体里的 turnstile_token 为空串。
   */
  turnstileToken?: string | null;
}

/** 组装请求体：长度截断与空值归一化，避免服务端因为长度问题拒单 */
export function buildRfqSubmitBody(
  contact: RfqContact,
  lines: RfqSubmitLine[],
  options: BuildRfqBodyOptions,
): RfqSubmitBody {
  const cut = (value: string, max: number): string => String(value ?? '').trim().slice(0, max);
  return {
    name: cut(contact.name, FIELD_LIMITS.name),
    company: cut(contact.company, FIELD_LIMITS.company),
    country: cut(contact.country, FIELD_LIMITS.country),
    email: cut(contact.email, FIELD_LIMITS.email),
    whatsapp_phone: cut(contact.whatsapp_phone, FIELD_LIMITS.whatsapp_phone),
    website: cut(contact.website, FIELD_LIMITS.website),
    message: cut(contact.message, FIELD_LIMITS.message),
    items: lines.slice(0, MAX_ITEMS).map((l) => ({
      product_id: l.product_id,
      bowen_no: cut(l.bowen_no, 60),
      product_type: l.product_type,
      matched_oe: l.matched_oe,
      vehicle: l.vehicle,
      application_id: l.application_id,
      quantity: cut(l.quantity, FIELD_LIMITS.quantity),
      remark: cut(l.remark, FIELD_LIMITS.remark),
    })),
    consent: Boolean(contact.consent),
    privacy_consent_version: PRIVACY_CONSENT_VERSION,
    source_page: cut(options.sourcePage, FIELD_LIMITS.source_page),
    elapsed_ms: Math.max(0, Math.round(options.elapsedMs)),
    turnstile_token: cut(options.turnstileToken ?? '', 4000),
    fax: '',
  };
}

/** 客户端预校验（仅 UX；服务端会独立再校验一次） */
export interface RfqValidationErrors {
  [field: string]: string;
}

export function validateRfq(contact: RfqContact, itemCount: number): RfqValidationErrors {
  const errors: RfqValidationErrors = {};
  if (!contact.name) errors.name = 'Please enter your name.';
  if (!contact.company) errors.company = 'Please enter your company name.';
  if (!contact.country) errors.country = 'Please select your country.';
  if (!contact.email) errors.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) {
    errors.email = 'That email address does not look valid.';
  }
  if (contact.website && !/^https?:\/\/\S+$/i.test(contact.website) && !/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(contact.website)) {
    errors.website = 'Please enter a valid website address or leave it blank.';
  }
  if (!contact.message && itemCount === 0) {
    errors.message = 'Add at least one product or describe what you need.';
  }
  if (!contact.consent) {
    errors.consent = 'Please confirm that you have read the Privacy Policy.';
  }
  return errors;
}

export { PRIVACY_CONSENT_VERSION };
