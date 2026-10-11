/**
 * RFQ 询价邮件模板（纯文本 + HTML）
 * ===========================================================================
 * 硬规则：
 *   1. 主题固定为 `New RFQ — [Company] — [Inquiry Number]`。
 *   2. 正文必须包含业务方要求的全部字段（询价号、联系人、公司、国家、邮箱、
 *      电话/WhatsApp、网站、留言，以及每一行的 Bowen No. / OE / 产品类型 /
 *      车型适配 / 数量），外加提交时间与来源页面。
 *   3. HTML 版本必须**全部转义**，客户输入的 <img onerror=...> 只能是文本。
 *   4. 同时给出纯文本版本，便于不支持 HTML 的客户端。
 *   5. 邮件里不出现任何内部字段（工作表名、行号、内部审核状态、证据路径）。
 */
import type { RfqInquiryRecord, RfqItem } from '../types';
import { escapeHtml } from '../sanitize';

const NOT_PROVIDED = '(not provided)';

function or(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? v : NOT_PROVIDED;
}

/** 邮件主题：New RFQ — [Company] — [Inquiry Number] */
export function buildSubject(record: RfqInquiryRecord): string {
  const company = (record.company ?? '').trim() || 'Unknown company';
  return `New RFQ — ${company} — ${record.inquiry_number}`;
}

/** 单行 RFQ 明细的纯文本块 */
function itemText(item: RfqItem, index: number): string[] {
  return [
    `  ${index + 1}. Bowen No.:          ${or(item.bowen_no)}`,
    `     OE Reference:       ${or(item.matched_oe)}`,
    `     Product Type:       ${or(item.product_type)}`,
    `     Vehicle / Application: ${or(item.vehicle)}`,
    `     Quantity:           ${or(item.quantity)}`,
    `     Application ID:     ${or(item.application_id)}`,
    `     Remark:             ${or(item.remark)}`,
  ];
}

/** 纯文本正文 */
export function buildTextBody(record: RfqInquiryRecord): string {
  const lines: string[] = [
    'NEW REQUEST FOR QUOTATION',
    '=========================',
    '',
    `Inquiry Number:      ${record.inquiry_number}`,
    `Customer Name:       ${or(record.name)}`,
    `Company:             ${or(record.company)}`,
    `Country:             ${or(record.country)}`,
    `Email:               ${or(record.email)}`,
    `Phone / WhatsApp:    ${or(record.whatsapp_phone)}`,
    `Website:             ${or(record.website)}`,
    '',
    'Message',
    '-------',
    or(record.message),
    '',
    `RFQ lines (${record.items.length})`,
    '----------------',
  ];

  if (record.items.length === 0) {
    lines.push('  (no catalogue line items — see the message above)');
  } else {
    record.items.forEach((item, i) => lines.push(...itemText(item, i)));
  }

  lines.push(
    '',
    'Submission',
    '----------',
    `Submitted At:        ${record.created_at}`,
    `Source Page:         ${or(record.source_page)}`,
    `Privacy consent:     ${record.privacy_consent_version}`,
    '',
    'Reply directly to this email to answer the buyer.',
      );

  return lines.join('\n');
}

/** HTML 明细行 */
function itemHtml(item: RfqItem, index: number): string {
  const row = (label: string, value: string | null) =>
    `<tr><th style="text-align:left;padding:4px 10px 4px 0;color:#33414f;font-weight:600;white-space:nowrap">${escapeHtml(
      label,
    )}</th><td style="padding:4px 0;color:#0f1720">${escapeHtml(or(value))}</td></tr>`;

  return `
    <div style="margin:0 0 14px;padding:10px 12px;border:1px solid #d8e0e7;border-radius:6px">
      <p style="margin:0 0 6px;font-weight:700;color:#0b1b2b">Line ${index + 1}</p>
      <table role="presentation" style="border-collapse:collapse;font-size:14px">
        ${row('Bowen No.', item.bowen_no)}
        ${row('OE Reference', item.matched_oe)}
        ${row('Product Type', item.product_type)}
        ${row('Vehicle / Application', item.vehicle)}
        ${row('Quantity', item.quantity)}
        ${row('Application ID', item.application_id)}
        ${row('Remark', item.remark)}
      </table>
    </div>`;
}

/** HTML 正文（所有插值均已转义） */
export function buildHtmlBody(record: RfqInquiryRecord): string {
  const contactRow = (label: string, value: string | null) =>
    `<tr><th style="text-align:left;padding:4px 12px 4px 0;color:#33414f;font-weight:600;white-space:nowrap">${escapeHtml(
      label,
    )}</th><td style="padding:4px 0;color:#0f1720">${escapeHtml(or(value))}</td></tr>`;

  const itemsHtml = record.items.length
    ? record.items.map((item, i) => itemHtml(item, i)).join('')
    : '<p style="color:#4a5a6a">No catalogue line items — see the message above.</p>';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(buildSubject(record))}</title></head>
<body style="margin:0;padding:20px;background:#f5f8fa;font-family:Arial,Helvetica,sans-serif;color:#0f1720">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d8e0e7;border-radius:8px;padding:22px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2563a0">Qufu Bowen Auto Parts Manufacturing Co., Ltd.</p>
    <h1 style="margin:0 0 18px;font-size:20px;color:#0b1b2b">New Request for Quotation</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#4a5a6a">
      Inquiry Number <strong style="color:#0b1b2b">${escapeHtml(record.inquiry_number)}</strong>
    </p>

    <h2 style="margin:0 0 8px;font-size:15px;color:#0b1b2b">Contact</h2>
    <table role="presentation" style="border-collapse:collapse;font-size:14px;margin:0 0 20px">
      ${contactRow('Customer Name', record.name)}
      ${contactRow('Company', record.company)}
      ${contactRow('Country', record.country)}
      ${contactRow('Email', record.email)}
      ${contactRow('Phone / WhatsApp', record.whatsapp_phone)}
      ${contactRow('Website', record.website)}
    </table>

    <h2 style="margin:0 0 8px;font-size:15px;color:#0b1b2b">Message</h2>
    <pre style="margin:0 0 20px;padding:12px;background:#f5f8fa;border:1px solid #eaeff3;border-radius:6px;font-size:13px;white-space:pre-wrap;word-break:break-word;color:#0f1720">${escapeHtml(
      or(record.message),
    )}</pre>

    <h2 style="margin:0 0 10px;font-size:15px;color:#0b1b2b">RFQ lines (${record.items.length})</h2>
    ${itemsHtml}

    <h2 style="margin:20px 0 8px;font-size:15px;color:#0b1b2b">Submission</h2>
    <table role="presentation" style="border-collapse:collapse;font-size:14px">
      ${contactRow('Submitted At', record.created_at)}
      ${contactRow('Source Page', record.source_page)}
      ${contactRow('Privacy consent', record.privacy_consent_version)}
    </table>

    <p style="margin:20px 0 0;font-size:13px;color:#4a5a6a">
      Reply directly to this email to answer the buyer.
    </p>
  </div>
</body>
</html>`;
}

export interface RenderedRfqEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderRfqEmail(record: RfqInquiryRecord): RenderedRfqEmail {
  return {
    subject: buildSubject(record),
    text: buildTextBody(record),
    html: buildHtmlBody(record),
  };
}
