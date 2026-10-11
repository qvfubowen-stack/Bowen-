/**
 * 从「适用车型/机型」原文里提取候选的字母数字代号。
 * ---------------------------------------------------------------------------
 * ⚠️ Phase 4.1 重要边界（业务方决定，务必先读）
 *
 * 本函数只做**字符串特征匹配**，没有任何产品知识、没有人工复核，
 * 因此结果不能当作「已确认的发动机代号」对外展示。
 * Phase 4.1 起：
 *   - 首页、产品详情页、筛选入口**一律不再公开展示**本函数的输出；
 *   - 客户看到的永远是 `vehicle_application_raw` 原文（Excel 里那一行写的东西）；
 *   - 需要展示发动机/车型区分时，必须由业务人员人工确认后写入专门字段。
 * 保留本函数是为了：① 内部数据检查；② 将来有了人工确认来源后再启用。
 *
 * 已知的正确性要求（有测试守护，见 website/tools/verify-engine-code.mjs）：
 *   - 必须保留完整字符串：4G13 不能变成 G13，4G15S 不能变成 G15S；
 *   - 数字开头的代号不能被丢掉：4G6、476ZQA 必须能提取出来；
 *   - 必须同时含字母和数字，纯数字 / 单位写法不算代号。
 *   - 结果只是「候选」，A4L / F150 这类车型代号同样会被提取出来，
 *     因此**绝不能**把它们当成发动机公开展示 —— 这也是本函数不再上页面的原因。
 */

const NOISE = new Set([
  'ABS', 'OEM', 'AT', 'MT', 'CVT', 'DOHC', 'SOHC', 'TDI', 'MPI', 'GDI', 'TSI', 'FSI', 'TFSI',
  'CRDI', 'VGT', 'EFI', 'SFI', 'AWD', 'FWD', 'RWD', '4WD', '2WD', 'SUV', 'MPV', 'LPG', 'CNG',
  'USA', 'UK', 'GEN', 'MAX', 'PLUS', 'PRO', 'EV', 'DM', 'GT', 'RS', 'ST', 'GL', 'GLX', 'LX',
  'EX', 'DX', 'SE', 'LE', 'XL', 'XLT', 'LTD', 'CD', 'DVD', 'GPS', 'AC', 'ECU', 'TCU', 'OBD',
  'EGR', 'DPF', 'SCR', 'HC', 'CO', 'NOX', 'RPM', 'KW', 'HP', 'NM', 'BAR', 'PSI', 'VVT', 'VVTI',
  'MM', 'CM', 'KG', 'CC',
]);

/** 纯数字（不含字母）不算代号 */
const PURE_NUMBER_RE = /^[0-9]+$/;
/** 数值 + 单位，不算代号 */
const UNIT_RE = /^[0-9]+(\.[0-9]+)?(MM|CM|M|KG|G|CC|L|ML|T|V|W|KW|HP|NM|BAR|KPA|MPA|PSI|RPM|KM|H)$/;
/** 温度写法（92C / 77F），来自规格列错位，不是代号 */
const TEMP_RE = /^[0-9]+C$/;

/**
 * 提取「候选」字母数字代号（含数字、含字母、长度 3–14）。
 * @param text 车型/机型原文
 */
export function extractEngineCodes(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  // 关键：允许以**数字**开头，且整段匹配（不能用 [A-Z] 开头的老正则，
  // 那会把 4G13 截成 G13、把 4G6 / 476ZQA 直接漏掉）。
  const tokens = String(text).toUpperCase().match(/[A-Z0-9][A-Z0-9._-]{1,15}/g) ?? [];
  for (const rawToken of tokens) {
    const t = rawToken.replace(/^[._-]+|[._-]+$/g, '');
    if (!t) continue;
    if (!/[0-9]/.test(t)) continue;      // 必须含数字
    if (!/[A-Z]/.test(t)) continue;      // 必须含字母
    if (PURE_NUMBER_RE.test(t)) continue;
    if (UNIT_RE.test(t)) continue;
    if (TEMP_RE.test(t)) continue;
    if (NOISE.has(t)) continue;
    if (t.length < 3 || t.length > 14) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 排量写法：1.5T / 2.0L / 1.6（同样是原文提取，不是权威结论） */
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
