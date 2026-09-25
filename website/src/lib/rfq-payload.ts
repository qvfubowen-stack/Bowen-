/**
 * RFQ payload 构建（纯函数，可单测）
 * ===========================================================================
 * 为什么单独抽出来：成功页要展示「将传输给销售的完整数据」，其中联系信息必须
 * 是用户在表单里**真实填写的值**，不能是占位符。把它做成纯函数后，
 * 既能被 React 组件复用，也能被自动测试直接调用断言。
 *
 * 注意：本阶段原型**不真正发送邮件**，本模块只负责构造 payload。
 */

/** RFQ 明细行（与 rfq-context 的 RfqLine 保持一致的结构子集） */
export interface RfqPayloadLine {
  product_id: string;
  bowen_no: string;
  product_type: string | null;
  matched_oe: string | null;
  vehicle: string | null;
  engine: string | null;
  application_id: string | null;
  quantity: string;
  remark?: string;
}

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

export interface RfqPayload {
  submitted_at: string;
  contact: {
    name: string;
    company: string;
    country: string;
    email: string;
    whatsapp_phone: string;
    website: string | null;
    message: string;
    consent: boolean;
  };
  items: {
    product_id: string;
    bowen_no: string;
    product_type: string | null;
    matched_oe: string | null;
    vehicle: string | null;
    engine: string | null;
    application_id: string | null;
    quantity: string | null;
    remark: string | null;
  }[];
  items_count: number;
  sourcing_list_file: string | null;
  delivery: {
    transport: 'prototype_no_email_sent';
    note: string;
  };
}

/** 表单字段名 → RfqContact 字段的映射（集中在这里，测试与组件共用） */
export const RFQ_FORM_FIELDS = {
  name: 'name',
  company: 'company',
  country: 'country',
  email: 'email',
  whatsapp_phone: 'whatsapp',
  website: 'website',
  message: 'message',
  consent: 'consent',
} as const;

/**
 * 从 HTMLFormElement 读取联系信息。
 * 组件与测试都用这个函数，保证「读表单」的口径只有一处。
 */
export function readContactFromForm(form: HTMLFormElement | { elements: unknown }): RfqContact {
  const get = (n: string): string => {
    const el = (form as HTMLFormElement).elements?.namedItem?.(n) as HTMLInputElement | HTMLTextAreaElement | null;
    return el ? String(el.value ?? '').trim() : '';
  };
  const consentEl = (form as HTMLFormElement).elements?.namedItem?.(RFQ_FORM_FIELDS.consent) as HTMLInputElement | null;
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

const EMPTY = '(not provided)';

/**
 * 构造 payload。
 * 联系信息使用传入的真实值；空字符串统一显示为 "(not provided)"，
 * **绝不使用 "(from form)" 这类占位文字**。
 */
export function buildRfqPayload(
  contact: RfqContact,
  lines: RfqPayloadLine[],
  fileName: string | null,
  now: Date = new Date(),
): RfqPayload {
  const t = (v: string): string => (v && v.trim() ? v.trim() : EMPTY);
  return {
    submitted_at: now.toISOString(),
    contact: {
      name: t(contact.name),
      company: t(contact.company),
      country: t(contact.country),
      email: t(contact.email),
      whatsapp_phone: t(contact.whatsapp_phone),
      website: contact.website && contact.website.trim() ? contact.website.trim() : null,
      message: t(contact.message),
      consent: Boolean(contact.consent),
    },
    items: lines.map((l) => ({
      product_id: l.product_id,
      bowen_no: l.bowen_no,
      product_type: l.product_type,
      matched_oe: l.matched_oe,
      vehicle: l.vehicle,
      engine: l.engine,
      application_id: l.application_id,
      quantity: l.quantity && l.quantity.trim() ? l.quantity.trim() : null,
      remark: l.remark && l.remark.trim() ? l.remark.trim() : null,
    })),
    items_count: lines.length,
    sourcing_list_file: fileName && fileName.trim() ? fileName.trim() : null,
    delivery: {
      transport: 'prototype_no_email_sent',
      note:
        'Prototype build: no email is sent. On the production site this payload is POSTed to the '
        + 'Bowen RFQ endpoint, stored, and forwarded to sales.',
    },
  };
}

/** 校验（纯函数，供组件与测试共用） */
export interface RfqValidationErrors {
  [field: string]: string;
}

export function validateRfq(
  contact: RfqContact,
  itemCount: number,
  fileName: string | null,
): RfqValidationErrors {
  const errors: RfqValidationErrors = {};
  if (!contact.name) errors.name = 'Please enter your name.';
  if (!contact.company) errors.company = 'Please enter your company name.';
  if (!contact.country) errors.country = 'Please select your country.';
  if (!contact.email) errors.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) {
    errors.email = 'That email address does not look valid.';
  }
  if (!contact.message && itemCount === 0 && !fileName) {
    errors.message = 'Add at least one product, upload a sourcing list, or describe what you need.';
  }
  return errors;
}
