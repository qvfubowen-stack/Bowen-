/**
 * 从「适用车型/机型」原文里提取明显的发动机/机型代号。
 * ---------------------------------------------------------------------------
 * 规则是纯粹的字符串特征匹配，不做任何产品知识推断：
 *   - 必须含数字
 *   - 至少 3 位、至多 12 位
 *   - 首字符必须是字母（4G6 / EA111 / 476ZQA / TU5JP4 / MR20 / ZG25 / DK4A / 2RZ 都符合）
 *   - 排除一批明显的噪音词（配置缩写、车身代号之外的单位等）
 *
 * 提取结果只是「原文里出现的候选代号」，页面必须同时展示原始车型文本，
 * 让用户自己判断，绝不把提取结果当成权威结论。
 */

const NOISE = new Set([
  'ABS', 'OEM', 'AT', 'MT', 'CVT', 'DOHC', 'SOHC', 'TDI', 'MPI', 'GDI', 'TSI', 'FSI', 'TFSI',
  'CRDI', 'VGT', 'EFI', 'SFI', 'AWD', 'FWD', 'RWD', '4WD', '2WD', 'SUV', 'MPV', 'LPG', 'CNG',
  'USA', 'UK', 'GEN', 'MAX', 'PLUS', 'PRO', 'EV', 'DM', 'GT', 'RS', 'ST', 'GL', 'GLX', 'LX',
  'EX', 'DX', 'SE', 'LE', 'XL', 'XLT', 'LTD', 'CD', 'DVD', 'GPS', 'AC', 'ECU', 'TCU', 'OBD',
  'EGR', 'DPF', 'SCR', 'HC', 'CO', 'NOX', 'RPM', 'KW', 'HP', 'NM', 'BAR', 'PSI', 'VVT', 'VVTI',
  'MM', 'CM', 'KG', 'CC',
]);

/** 单位/尺寸写法，出现这些的行内 token 不算发动机代号 */
const MEASURE_RE = /^\d|MM$|CM$/;

export function extractEngineCodes(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const tokens = String(text).toUpperCase().match(/[A-Z][A-Z0-9]{2,11}/g) ?? [];
  for (const t of tokens) {
    if (!/[0-9]/.test(t)) continue;      // 必须含数字
    if (NOISE.has(t)) continue;
    if (MEASURE_RE.test(t)) continue;
    if (t.length < 3 || t.length > 12) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 排量写法：1.5T / 2.0L / 1.6 */
export function extractDisplacements(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /\b([0-9]\.[0-9])\s*(T|L|t|l)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text))) !== null) {
    out.add(m[1] + (m[2] ? m[2].toUpperCase() : ''));
  }
  return [...out];
}
