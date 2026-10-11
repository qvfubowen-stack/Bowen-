/**
 * RFQ 输入清洗与校验原子操作
 * ===========================================================================
 * 原则：
 *   1. 服务器**绝不**直接信任客户端传来的展示文本（产品名、车型、OE）。
 *   2. 文本字段先清 HTML/脚本，再截断长度；换行只在 message 里保留。
 *   3. HTML 邮件输出必须转义，避免把客户输入当成标签执行。
 *   4. 清洗函数不抛异常、不返回 undefined —— 输入坏值时返回空串，由调用方判定必填。
 */

/** 控制字符（保留 \t \n \r） */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** 任何看起来像标签的片段；循环剥离以处理 "<scr<script>ipt>" 这类嵌套构造 */
const TAG_LIKE = /<[^>]*>/g;
/** 危险协议 */
const DANGEROUS_SCHEME = /(?:javascript|vbscript|data|file)\s*:/gi;

function stripTags(value: string): string {
  let out = value;
  // 最多 5 轮，防止构造出来的嵌套标签；超过 5 轮说明是恶意输入，剩余尖括号直接去掉。
  for (let i = 0; i < 5; i += 1) {
    const next = out.replace(TAG_LIKE, ' ');
    if (next === out) break;
    out = next;
  }
  return out.replace(/[<>]/g, ' ');
}

export function toRawString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** 单行字段：去标签、去危险协议、压缩空白、截断 */
export function sanitizeLine(value: unknown, maxLength: number): string {
  const out = stripTags(toRawString(value))
    .replace(DANGEROUS_SCHEME, ' ')
    .replace(CONTROL_CHARS, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out.slice(0, maxLength).trim();
}

/** 多行字段（message）：保留换行，但限制连续空行 */
export function sanitizeMultiline(value: unknown, maxLength: number): string {
  const out = stripTags(toRawString(value))
    .replace(DANGEROUS_SCHEME, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out.slice(0, maxLength).trim();
}

/**
 * 只允许站内相对路径（用于 source_page）。
 * 任何外部 URL、协议相对地址、含换行的值一律拒绝 → 返回 null。
 */
export function sanitizeInternalPath(value: unknown, maxLength: number): string | null {
  const raw = sanitizeLine(value, maxLength);
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (/[\\\s]/.test(raw)) return null;
  return raw;
}

/** 邮箱格式校验（不使用过于宽松的 .+@.+ 正则） */
export function isValidEmail(value: string): boolean {
  if (!value || value.length > 200) return false;
  if (/[\s,;<>"]/.test(value)) return false;
  return /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+$/.test(value);
}

/**
 * 网址校验：必须是绝对 http/https URL，且主机名带点（或为 IP）。
 * 空值视为"未填写"，由调用方决定是否必填。
 */
export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  if (value.length > 300) return false;
  if (/[\s<>"]/.test(value)) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
}

/** HTML 转义（HTML 邮件模板专用） */
export function escapeHtml(value: unknown): string {
  return toRawString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
