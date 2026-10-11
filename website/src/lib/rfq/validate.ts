/**
 * RFQ 服务端校验（唯一可信的校验点）
 * ===========================================================================
 * 设计要点（对应 Phase 5 的硬要求）：
 *   1. 请求体严格白名单：出现任何白名单以外的键直接判定为非法请求；
 *   2. 客户端传来的**展示文本一律不可信**：product_type / matched_oe / vehicle
 *      全部由服务端从公开产品数据重新推导，客户端值只参与"是否自相矛盾"的比对；
 *   3. product_id 必须能在公开仓储里取到（仓储层已经保证：状态允许 + 未 blocked
 *      + 有可靠主图），无图产品或未公开产品在这里就会被拒绝；
 *   4. application_id 必须属于该 product_id，并且是可对外展示的 application；
 *   5. Bowen No. 必须与服务端记录一致（忽略大小写与空格差异）；
 *   6. 所有文本先清 HTML/脚本再截断，长度上限集中在 constants.ts。
 */
import 'server-only';

import { applicationOeTokens, applicationTextEn } from '../application-display';
import { getDisplayApplications, getProductById } from '../db';
import {
  FIELD_LIMITS,
  HONEYPOT_FIELD,
  MAX_ITEMS,
  PRIVACY_CONSENT_VERSION,
  RFQ_ERROR_CODES,
} from './constants';
import { minFillMs } from './rate-limit';
import {
  isValidEmail,
  isValidHttpUrl,
  sanitizeInternalPath,
  sanitizeLine,
  sanitizeMultiline,
  toRawString,
} from './sanitize';
import type { RfqContact, RfqItem, RfqValidationResult, RfqValidatedSubmission } from './types';

/** 允许出现在请求体里的键（其余一律拒绝） */
export const ALLOWED_BODY_KEYS: readonly string[] = [
  'name',
  'company',
  'country',
  'email',
  'whatsapp_phone',
  'website',
  'message',
  'items',
  'consent',
  'privacy_consent_version',
  'source_page',
  'elapsed_ms',
  'turnstile_token',
  HONEYPOT_FIELD,
];

/** 允许出现在单个 RFQ 明细里的键 */
const ALLOWED_ITEM_KEYS: readonly string[] = [
  'product_id',
  'bowen_no',
  'product_type',
  'application_id',
  'matched_oe',
  'vehicle',
  'quantity',
  'remark',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 归一化 Bowen No.：去空格、转大写，只用于比较 */
function normalizeBowen(value: unknown): string {
  return sanitizeLine(value, 60).replace(/\s+/g, '').toUpperCase();
}

/** 电话号码宽松校验：至少 5 位数字、至多 25 位数字 */
function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 25;
}

/** 补全站点地址：允许客户只填 "example.com" */
function normalizeWebsite(value: unknown): { value: string | null; invalid: boolean } {
  const raw = sanitizeLine(value, FIELD_LIMITS.website);
  if (!raw) return { value: null, invalid: false };
  if (isValidHttpUrl(raw)) return { value: raw, invalid: false };
  if (/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/\S*)?$/.test(raw)) {
    const withScheme = `https://${raw}`;
    return isValidHttpUrl(withScheme) ? { value: withScheme, invalid: false } : { value: null, invalid: true };
  }
  return { value: null, invalid: true };
}

export async function validateRfqBody(rawBody: unknown): Promise<RfqValidationResult> {
  if (!isPlainObject(rawBody)) {
    return { ok: false, code: RFQ_ERROR_CODES.validation };
  }

  const body = rawBody;
  const fieldErrors: Record<string, string> = {};

  // ---- 0. 白名单：多余字段一律拒绝（含任何试图提交内部字段的请求） ----
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.includes(key)) {
      return { ok: false, code: RFQ_ERROR_CODES.validation };
    }
  }

  // ---- 1. honeypot：真用户永远填不到这个字段 ----
  if (sanitizeLine(body[HONEYPOT_FIELD], 200)) {
    return { ok: false, code: RFQ_ERROR_CODES.spam };
  }

  // ---- 2. 最短填写耗时 ----
  const elapsedRaw = body.elapsed_ms;
  if (typeof elapsedRaw === 'number' && Number.isFinite(elapsedRaw)) {
    if (elapsedRaw < minFillMs()) return { ok: false, code: RFQ_ERROR_CODES.spam };
  }

  // ---- 3. 隐私同意（不得默认勾选，必须显式传 true） ----
  if (body.consent !== true) {
    fieldErrors.consent = 'Please confirm that you have read the Privacy Policy before sending your enquiry.';
  }

  // ---- 4. 隐私政策版本 ----
  const consentVersion = sanitizeLine(body.privacy_consent_version, 60) || PRIVACY_CONSENT_VERSION;
  if (consentVersion !== PRIVACY_CONSENT_VERSION) {
    fieldErrors.consent =
      'Our Privacy Policy has been updated. Please reload this page, review it and confirm again.';
  }

  // ---- 5. 联系信息 ----
  const name = sanitizeLine(body.name, FIELD_LIMITS.name);
  if (!name) fieldErrors.name = 'Please enter your name.';
  else if (name.length < 2) fieldErrors.name = 'Please enter your full name.';

  const company = sanitizeLine(body.company, FIELD_LIMITS.company);
  if (!company) fieldErrors.company = 'Please enter your company name.';

  const country = sanitizeLine(body.country, FIELD_LIMITS.country);
  if (!country) fieldErrors.country = 'Please select your country.';

  const email = sanitizeLine(body.email, FIELD_LIMITS.email);
  if (!email) fieldErrors.email = 'Please enter your email address.';
  else if (!isValidEmail(email)) fieldErrors.email = 'That email address does not look valid.';

  const whatsapp = sanitizeLine(body.whatsapp_phone, FIELD_LIMITS.whatsapp_phone);
  if (whatsapp && !looksLikePhone(whatsapp)) {
    fieldErrors.whatsapp_phone =
      'Please enter a reachable phone or WhatsApp number, including the country code.';
  }

  const site = normalizeWebsite(body.website);
  if (site.invalid) fieldErrors.website = 'Please enter a valid website address or leave it blank.';

  const message = sanitizeMultiline(body.message, FIELD_LIMITS.message);

  // ---- 6. RFQ 明细 ----
  const rawItems = body.items;
  if (rawItems !== undefined && rawItems !== null && !Array.isArray(rawItems)) {
    fieldErrors.items = 'The RFQ list could not be read. Please reload the page and try again.';
  }
  const itemsArray = Array.isArray(rawItems) ? rawItems : [];
  if (itemsArray.length > MAX_ITEMS) {
    fieldErrors.items = `Please limit your RFQ to ${MAX_ITEMS} catalogue lines and email us the rest.`;
  }

  const items: RfqItem[] = [];
  if (!fieldErrors.items) {
    for (let i = 0; i < itemsArray.length; i += 1) {
      const rawItem = itemsArray[i];
      const position = `items[${i}]`;
      if (!isPlainObject(rawItem)) {
        fieldErrors[position] = 'This RFQ line could not be read. Please remove and re-add the product.';
        continue;
      }
      // 明细内部同样白名单
      for (const key of Object.keys(rawItem)) {
        if (!ALLOWED_ITEM_KEYS.includes(key)) {
          fieldErrors[position] = 'This RFQ line contained an unsupported field.';
          break;
        }
      }
      if (fieldErrors[position]) continue;

      const productId = sanitizeLine(rawItem.product_id, 80);
      if (!productId) {
        fieldErrors[position] = 'This RFQ line is missing its product. Please re-add it from the catalogue.';
        continue;
      }

      // 仓储层已保证：状态允许 + 未 blocked + 有可靠主图。取不到就是不允许下单。
      const product = await getProductById(productId);
      if (!product) {
        fieldErrors[position] =
          'One of the products in your list is no longer available. Please re-add it from the catalogue.';
        continue;
      }

      // Bowen No. 必须与服务端一致（忽略大小写/空格）
      const clientBowen = normalizeBowen(rawItem.bowen_no);
      const serverBowen = normalizeBowen(product.bowen_no);
      if (clientBowen && serverBowen && clientBowen !== serverBowen) {
        fieldErrors[position] = 'One of the Bowen numbers did not match our records. Please re-add the product.';
        continue;
      }

      // application_id 必须属于该产品，且是可对外展示的 application
      const applicationId = sanitizeLine(rawItem.application_id, 120) || null;
      let matchedOe: string | null = null;
      let vehicle: string | null = null;
      if (applicationId) {
        const apps = await getDisplayApplications(product.product_id);
        const app = apps.find((a) => a.application_id === applicationId);
        if (!app) {
          fieldErrors[position] =
            'One of the applications in your list no longer matches this product. Please re-add it from the product page.';
          continue;
        }
        matchedOe = applicationOeTokens(app.oe_tokens)[0] ?? null;
        vehicle = applicationTextEn(app.vehicle_application_raw);
      }

      const quantity = sanitizeLine(rawItem.quantity, FIELD_LIMITS.quantity) || null;
      const remark = sanitizeLine(rawItem.remark, FIELD_LIMITS.remark) || null;

      items.push({
        product_id: product.product_id,
        bowen_no: product.bowen_no ?? null,
        // 以下三项一律以服务端公开数据为准，绝不采用客户端传入的展示文本
        product_type: product.product_type ?? null,
        application_id: applicationId,
        matched_oe: matchedOe,
        vehicle,
        quantity,
        remark,
      });
    }
  }

  // ---- 7. 至少要有一条明细或一段留言 ----
  if (items.length === 0 && !message) {
    fieldErrors.message = 'Add at least one product or describe what you need.';
  }

  // ---- 8. 来源页面只允许站内相对路径 ----
  const sourcePage = sanitizeInternalPath(body.source_page, FIELD_LIMITS.source_page);

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, code: RFQ_ERROR_CODES.validation, field_errors: fieldErrors };
  }

  const contact: RfqContact = {
    name,
    company,
    country,
    email,
    whatsapp_phone: whatsapp,
    website: site.value,
    message,
  };

  const value: RfqValidatedSubmission = {
    contact,
    items,
    source_page: sourcePage,
    privacy_consent_version: consentVersion,
  };

  return { ok: true, value };
}

/** 便于日志/测试：客户端是否携带了会被拒绝的多余字段（不返回字段名给客户） */
export function findUnexpectedKeys(rawBody: unknown): string[] {
  if (!isPlainObject(rawBody)) return [];
  return Object.keys(rawBody).filter((k) => !ALLOWED_BODY_KEYS.includes(k));
}

export { toRawString };
