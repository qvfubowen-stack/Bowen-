/**
 * OE / Bowen 字段的纯函数工具（Phase 4.1 从 tools/build-product-db-v2.mjs 抽出）
 * ===========================================================================
 * 抽出来的原因：build-product-db-v2.mjs 是**构建脚本**（会写文件），
 * 而 tools/verify-product-db-v2.mjs 只需要 oeSearchKey 这样的纯函数。
 * 原先 verify 直接 import 构建脚本，导致「跑一次校验」会顺带重建全部数据。
 * 现在纯函数集中在本模块，构建脚本与校验脚本都从这里取，校验保持只读。
 *
 * 本模块不读文件、不写文件、没有顶层副作用。
 */
import { TOKEN_SPLIT_RE } from './v2-layout.mjs';
import {
  MISALIGNMENT_RULES,
  BOWEN_ALLOWED_RE,
  BOWEN_MAX_LEN,
  NON_OE_ANNOTATIONS,
} from '../config/product-types.mjs';

export const isBlank = (v) => v == null || String(v).replace(/[\u3000\s]/g, '') === '';

export const clean = (v) => String(v ?? '').replace(/\u00a0/g, ' ').trim();

/** 按表格里使用的分隔符切 token */
export function tokensOf(text) {
  return clean(text).split(TOKEN_SPLIT_RE).map((t) => t.trim()).filter(Boolean);
}

/** OE 检索键：忽略大小写、空格、短横线、斜线 */
export function oeSearchKey(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/[-‐‑‒–—―]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^A-Z0-9.]/g, '');
}

/** OE 展示归一化：保留原文里的分隔符信息，只去空格与大小写差异 */
export function oeDisplayNormalized(raw) {
  return String(raw ?? '').trim().toUpperCase().replace(/[\u3000\s]+/g, '');
}

/** 一个 token 像不像 OE 号（保守判定，用于 OE 索引列，不用于改写原文） */
export function looksLikeOeToken(t) {
  const s = String(t ?? '').trim();
  if (!s) return false;
  if (NON_OE_ANNOTATIONS.includes(s)) return false;
  if (/[\u4e00-\u9fff]/.test(s)) return false; // 含中文的 token 是说明文字，不是 OE
  if (!/[0-9]/.test(s)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9\-./+*_()]*$/.test(s)) return false;
  const k = oeSearchKey(s);
  if (k.length < 5 || k.length > 25) return false;
  return true;
}

/**
 * Bowen No. 单元格解析。
 * 关键裁决（依据最新版 Excel 实测）：
 *   - 字段里出现尺寸/温度/中文说明/括号备注 = 错位痕迹 → 记录 anomaly
 *   - 若首 token 仍是合法 Bowen No.（例如 "3029  92°" → 3029）：
 *         bowen_no 可读，溢出原文进 bowen_overflow_raw，记录标 needs_review
 *   - 若首 token 不是合法 Bowen No.（例如 "无小管" / "芯子编号：31052"）：
 *         bowen_no = null，记录必须 blocked
 * 绝不做自动修复、自动合并或删除。
 */
export function parseBowenCell(raw) {
  const text = clean(raw).replace(/[\r\n]+/g, ' ');
  const out = {
    bowen_no_raw: text, bowen_no: '', bowen_note: '', bowen_overflow_raw: '',
    tokens: [], anomalies: [], bowen_parse_status: 'empty',
  };
  if (!text) { out.bowen_parse_status = 'empty'; return out; }
  out.tokens = tokensOf(text);
  const first = out.tokens[0] ?? '';
  const firstOk = BOWEN_ALLOWED_RE.test(first) && first.length <= BOWEN_MAX_LEN;
  if (!firstOk) {
    out.bowen_no = '';
    out.bowen_note = text;
    out.bowen_overflow_raw = text;
    out.anomalies.push('bowen_unreadable_leading_token');
    out.bowen_parse_status = 'unreadable';
    return out;
  }
  out.bowen_no = first;
  out.bowen_overflow_raw = out.tokens.slice(1).join(' ');
  out.bowen_note = out.bowen_overflow_raw;
  out.bowen_parse_status = out.bowen_overflow_raw ? 'recovered_with_overflow' : 'clean';
  return out;
}

/** 错位检测：只看格式特征，不涉及任何产品知识 */
export function detectMisalignment(bowenCellRaw) {
  const text = clean(bowenCellRaw);
  const hits = [];
  for (const rule of MISALIGNMENT_RULES) {
    if (rule.re.test(text)) hits.push({ rule: rule.id, note: rule.note });
  }
  return hits;
}

/** 温度（摄氏，必须带单位） */
export function extractTemperatures(specs) {
  const out = [];
  if (!specs) return out;
  const re = /([0-9]+(?:\.[0-9]+)?)\s*(?:℃|°\s*C|C°|摄氏|度)/g;
  let m;
  while ((m = re.exec(String(specs))) !== null) {
    const v = Number(m[1]);
    if (v > -60 && v < 250) out.push(v);
  }
  return [...new Set(out)];
}
