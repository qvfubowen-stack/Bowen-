/**
 * 博文外贸独立站 — OE / 规格 标准化库
 * ---------------------------------------------------------------------
 * 铁律：
 *  1. 绝不修改原始 Excel。本模块只读取内存中的字符串。
 *  2. 绝不猜数据。任何无法从原文直接读出的字段一律留空 + 打状态标记。
 *  3. 每一次“改写”都必须可追溯：保留 raw，另存 normalized，并记录变更原因。
 */

// =====================================================================
// 一、OE Number 拆分
// =====================================================================

/** 拆分隔符：换行、回车、多空格（>=2）、中文全角空格、制表符 */
const SEPARATOR_RE = /[\r\n\t\u3000]+| {2,}/;

/**
 * 判定一个 token 是否“是”一个 OE 号。
 * 这是本项目的关键裁决点，规则必须保守：
 *   - 归一化后长度必须落在 [5, 25]（真实 OE / 厂商件号范围）
 *   - 必须含数字
 *   - 不能是纯字母（纯字母多为品牌名，如 TOYOTA / Suzuki / NISSAN）
 *   - 不能是纯数字且短于 5 位
 */
export const OE_MIN_LEN = 5;
export const OE_MAX_LEN = 25;

export function looksLikeOeNumber(token) {
  const t = String(token ?? '').trim();
  if (!t) return false;
  if (/\s/.test(t)) return false;                      // 单个 token 内部不应再有空格
  if (!/^[A-Za-z0-9][A-Za-z0-9\-./+*_()]*$/.test(t)) return false;
  if (!/[0-9]/.test(t)) return false;                  // 必须含数字
  if (!/[A-Za-z]/.test(t) && t.replace(/\D/g, '').length < OE_MIN_LEN) return false;
  const n = normalizeOeNumber(t);
  if (n.length < OE_MIN_LEN || n.length > OE_MAX_LEN) return false;
  if (!/[0-9]/.test(n)) return false;
  if (!/[A-Z0-9]/.test(n)) return false;
  return true;
}

/** token 归一化后是否“过长”，通常意味着两个 OE 号被粘在一起 */
export function isOversizedOe(normalized) {
  return String(normalized ?? '').length > OE_MAX_LEN;
}


/**
 * 把一个单元格中的多个 OE 号拆成数组。
 * 返回 [{ raw, split_rule, ambiguous, kept_whole_reason }]
 * split_rule: newline | multi_space | single_space_inferred | whole
 *
 * 关键取舍：只有“每一段看起来都是 OE 号”时才按单个空格拆。
 * 否则整体保留为一条并标记 review_required —— 宁可让人去确认，也不猜。
 */
export function splitOeCell(cellValue) {
  const out = [];
  if (cellValue === null || cellValue === undefined) return out;
  const text = String(cellValue);
  if (!text.trim()) return out;

  // 第一层：明确的换行 / 多空格
  const chunks = text.split(SEPARATOR_RE);

  for (const chunkRaw of chunks) {
    const chunk = chunkRaw.trim();
    if (!chunk) continue;

    // 去掉首尾的孤立符号（原表里有 " A113808030" 这种）
    const cleaned = chunk.replace(/^[^\w(]+/, '').replace(/[^\w)]+$/, '').trim();
    if (!cleaned) continue;

    if (/\s/.test(cleaned)) {
      const parts = cleaned.split(/ +/).filter(Boolean);
      const allLook = parts.length > 1 && parts.every(looksLikeOeNumber);
      if (allLook) {
        for (const p of parts) out.push({ raw: p, split_rule: 'single_space_inferred', ambiguous: true });
      } else {
        const looksCount = parts.filter(looksLikeOeNumber).length;
        out.push({
          raw: cleaned,
          split_rule: 'whole',
          ambiguous: false,
          kept_whole_reason: looksCount > 0 ? 'mixed_oe_and_non_oe_tokens' : 'no_oe_like_token',
        });
      }
    } else {
      out.push({ raw: cleaned, split_rule: 'whole', ambiguous: false });
    }
  }
  return out;
}

/** 合并“换行”与“多空格”之外的统计用：判断原始单元格用了哪类分隔 */
export function cellSeparatorKinds(cellValue) {
  const t = String(cellValue ?? '');
  return {
    newline: /[\r\n]/.test(t),
    multiSpace: / {2,}/.test(t),
    singleSpaceOnly: !/[\r\n]/.test(t) && !/ {2,}/.test(t) && / /.test(t.trim()),
  };
}

// =====================================================================
// 二、OE Number 搜索标准化
// =====================================================================
/**
 * 统一 OE 搜索格式：忽略大小写、忽略空格、忽略短横线。
 * 另外按规划 6.2 的要求，一并忽略全角空格、点、斜线以外的杂符。
 * 保留字符：A-Z 0-9 / . （斜线与点是 OE 号真实组成部分，不删除）
 */
export function normalizeOeNumber(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .toUpperCase()
    .replace(/[\u3000\s]/g, '')      // 空格（含全角）
    .replace(/[-‐‑‒–—―]/g, '')        // 各类短横线
    .replace(/[^A-Z0-9./]/g, '');     // 去掉其余杂符，保留 / 和 .
}

/** 仅用于“严格同号判定”的更激进键：同时忽略 / 和 . */
export function oeMatchKey(normalized) {
  return String(normalized ?? '').replace(/[/.]/g, '');
}

// =====================================================================
// 三、Specs 解析（尺寸 / 开启温度）
// =====================================================================
/**
 * 只提取原文中明确带单位的数值。
 * 温度：必须带 ℃ / °C / C° / 度；摄氏。绝不把裸数字当温度。
 * 尺寸：D1=xxmm / d2=xxmm / A=xxmm 形式。
 */
export function parseSpecs(specsRaw) {
  const result = {
    opening_temperature_c: [],
    dimensions: {},
    dimension_notes: [],
    other_specs: [],
    unparsed: [],
  };
  if (!specsRaw) return result;
  const text = String(specsRaw).replace(/\u00a0/g, ' ');

  // --- 尺寸 ---
  const dimRe = /\b([Dd]1|[Dd]2|[Dd]|A)\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|MM|Mm)?/g;
  let m;
  while ((m = dimRe.exec(text)) !== null) {
    const key = m[1].toUpperCase() === 'D1' ? 'D1' : m[1].toUpperCase() === 'D2' ? 'd2' : m[1].toUpperCase();
    result.dimensions[key] = Number(m[2]);
  }
  // 尺寸单位缺失但形如 "A=33m" 的残缺值 → 记录为可疑，不当作有效尺寸
  const badDimRe = /\b([Dd]1|[Dd]2|[Dd]|A)\s*=\s*([0-9]+(?:\.[0-9]+)?)(?!\s*(?:mm|MM|Mm))/g;
  while ((m = badDimRe.exec(text)) !== null) {
    result.dimension_notes.push(`${m[1]}=${m[2]} (缺少单位，原样保留待确认)`);
  }

  // --- 温度（摄氏，必须带单位）---
  const tempRe = /([0-9]+(?:\.[0-9]+)?)\s*(?:℃|°\s*C|C°|摄氏|度)/g;
  while ((m = tempRe.exec(text)) !== null) {
    const v = Number(m[1]);
    if (v > -60 && v < 250) result.opening_temperature_c.push(v);
  }
  // 华氏度（若出现）单独标出，不混入摄氏列表
  const fRe = /([0-9]+(?:\.[0-9]+)?)\s*(?:℉|°\s*F)/g;
  const fahrenheit = [];
  while ((m = fRe.exec(text)) !== null) fahrenheit.push(Number(m[1]));

  // --- 其他规格（bar 等非温度、非尺寸内容）---
  const residue = text
    .replace(dimRe, ' ')
    .replace(tempRe, ' ')
    .replace(fRe, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (residue) {
    // 纯分隔符残留（例如 "~" "-"），忽略
    if (/[A-Za-z0-9\u4e00-\u9fff]/.test(residue)) result.other_specs.push(residue);
  }

  // 去重但保留顺序
  result.opening_temperature_c = [...new Set(result.opening_temperature_c)];
  result.dimension_notes = [...new Set(result.dimension_notes)];
  if (fahrenheit.length) result.other_specs.push(`华氏度原值: ${fahrenheit.join(', ')} °F`);
  return result;
}

// =====================================================================
// 四、车型字段拆分（make / model / engine）
// =====================================================================
/**
 * 事实来源只有一列自由文本 "Vehicle / Engine Applications"。
 * 本函数只做“物理切分”，不做品牌补全：
 *   - 以 ; 和换行为硬分隔
 *   - 命中品牌表 → 给出 vehicle_make（记录命中证据）
 *   - 从原文抽取发动机代码样式 token → engine_code（仅当原文明确写出）
 *   - 其余文本原样进 application_notes，绝不臆造 vehicle_model
 */

/**
 * 车型品牌标准名表。
 * 规则：只在原文出现“可确认的写法”时映射；表里每一条都可人工复核。
 * 注意：这里只统一拼写，不新增任何原文没有的品牌。
 */
export const MAKE_ALIASES = [
  // 集团 / 多品牌条目（按最长优先匹配）
  { canonical: 'Volkswagen Group', aliases: ['Volkswagen Group'] },
  { canonical: 'Mercedes-Benz', aliases: ['Mercedes-Benz', 'Mercedes Benz', 'MercedesBenz', 'Benz', '奔驰'] },
  { canonical: 'BMW', aliases: ['BMW', 'MINI'] },
  { canonical: 'Land Rover', aliases: ['Land Rover', 'Range Rover'] },
  { canonical: 'Volkswagen', aliases: ['Volkswagen', 'VW', '大众'] },
  { canonical: 'Audi', aliases: ['Audi', '奥迪'] },
  { canonical: 'Skoda', aliases: ['Skoda', 'Škoda', '斯柯达'] },
  { canonical: 'SEAT', aliases: ['SEAT'] },
  { canonical: 'Porsche', aliases: ['Porsche'] },
  { canonical: 'Opel', aliases: ['Opel', 'OPEL'] },
  { canonical: 'Buick', aliases: ['Buick', '别克'] },
  { canonical: 'Chevrolet', aliases: ['Chevrolet', 'Chevy', '雪佛兰'] },
  { canonical: 'Cadillac', aliases: ['Cadillac'] },
  { canonical: 'GMC', aliases: ['GMC'] },
  { canonical: 'SAIC-GM', aliases: ['SAIC GM', 'SAIC-GM', 'Shanghai GM', '上汽通用'] },
  { canonical: 'SAIC-GM-Wuling', aliases: ['SAIC-GM-Wuling', 'SGMW', 'Liuzhou Wuling', 'Wuling', '五菱'] },
  { canonical: 'Ford', aliases: ['Ford', '福特'] },
  { canonical: 'Lincoln', aliases: ['Lincoln'] },
  { canonical: 'Changan Ford', aliases: ['Changan Ford'] },
  { canonical: 'Jiangling', aliases: ['Jiangling', 'JMC', 'Jiangxi Isuzu'] },
  { canonical: 'Chrysler', aliases: ['Chrysler', '克莱斯勒'] },
  { canonical: 'Dodge', aliases: ['Dodge'] },
  { canonical: 'Jeep', aliases: ['Jeep', 'JEEP'] },
  { canonical: 'GAC FCA', aliases: ['GAC FCA'] },
  { canonical: 'Fiat', aliases: ['Fiat'] },
  { canonical: 'Lancia', aliases: ['Lancia'] },
  { canonical: 'Peugeot', aliases: ['Peugeot', '标致'] },
  { canonical: 'Citroen', aliases: ['Citroen', 'Citroën', '雪铁龙'] },
  { canonical: 'Dongfeng Peugeot Citroen', aliases: ['Dongfeng Peugeot Citroen', 'DPCA', '神龙'] },
  { canonical: 'Renault', aliases: ['Renault', '雷诺'] },
  { canonical: 'Dacia', aliases: ['Dacia'] },
  { canonical: 'Volvo', aliases: ['Volvo', '沃尔沃'] },
  { canonical: 'Toyota', aliases: ['Toyota', 'TOYOTA', '丰田'] },
  { canonical: 'Lexus', aliases: ['Lexus', '雷克萨斯'] },
  { canonical: 'GAC Toyota', aliases: ['GAC Toyota'] },
  { canonical: 'FAW Toyota', aliases: ['FAW Toyota'] },
  { canonical: 'Honda', aliases: ['Honda', '本田'] },
  { canonical: 'Acura', aliases: ['Acura', '讴歌'] },
  { canonical: 'Dongfeng Honda', aliases: ['Dongfeng Honda'] },
  { canonical: 'GAC Honda', aliases: ['GAC Honda'] },
  { canonical: 'Nissan', aliases: ['Nissan', '日产'] },
  { canonical: 'Infiniti', aliases: ['Infiniti', '英菲尼迪'] },
  { canonical: 'Dongfeng Nissan', aliases: ['Dongfeng Nissan'] },
  { canonical: 'Mazda', aliases: ['Mazda', '马自达'] },
  { canonical: 'FAW Mazda', aliases: ['FAW Mazda', 'Bestune', '奔腾'] },
  { canonical: 'Changan Mazda', aliases: ['Changan Mazda'] },
  { canonical: 'Mitsubishi', aliases: ['Mitsubishi', '三菱'] },
  { canonical: 'Shenyang Mitsubishi', aliases: ['Shenyang Mitsubishi'] },
  { canonical: 'Dongan Mitsubishi', aliases: ['Dongan Mitsubishi'] },
  { canonical: 'Soueast', aliases: ['Soueast', 'Southeast'] },
  { canonical: 'Subaru', aliases: ['Subaru', '斯巴鲁'] },
  { canonical: 'Suzuki', aliases: ['Suzuki', '铃木'] },
  { canonical: 'Changhe Suzuki', aliases: ['Changhe Suzuki'] },
  { canonical: 'Isuzu', aliases: ['Isuzu', '五十铃'] },
  { canonical: 'Hyundai', aliases: ['Hyundai', '现代'] },
  { canonical: 'Beijing Hyundai', aliases: ['Beijing Hyundai'] },
  { canonical: 'Kia', aliases: ['Kia', '起亚'] },
  { canonical: 'Daewoo', aliases: ['Daewoo', 'UZ-DAEWOO', 'UZ DAEWOO'] },
  { canonical: 'SsangYong', aliases: ['SsangYong'] },
  { canonical: 'BYD', aliases: ['BYD', '比亚迪'] },
  { canonical: 'Geely', aliases: ['Geely', '吉利'] },
  { canonical: 'Shanghai Maple', aliases: ['Shanghai Maple', '华普'] },
  { canonical: 'Chery', aliases: ['Chery', '奇瑞'] },
  { canonical: 'Cowin', aliases: ['Cowin', '凯翼'] },
  { canonical: 'Great Wall', aliases: ['Great Wall', '长城'] },
  { canonical: 'Haval', aliases: ['Haval', '哈弗'] },
  { canonical: 'WEY', aliases: ['WEY'] },
  { canonical: 'Changan', aliases: ['Changan', '长安'] },
  { canonical: 'Dongfeng', aliases: ['Dongfeng', '东风'] },
  { canonical: 'FAW', aliases: ['FAW', '一汽'] },
  { canonical: 'Hongqi', aliases: ['Hongqi'] },
  { canonical: 'SAIC', aliases: ['SAIC', '上汽'] },
  { canonical: 'Roewe', aliases: ['Roewe', '荣威'] },
  { canonical: 'MG', aliases: ['MG'] },
  { canonical: 'Maxus', aliases: ['Maxus'] },
  { canonical: 'GAC Trumpchi', aliases: ['GAC Trumpchi', 'Trumpchi', 'GAC Motor', '传祺'] },
  { canonical: 'Brilliance', aliases: ['Brilliance', '中华'] },
  { canonical: 'JAC', aliases: ['JAC', '江淮'] },
  { canonical: 'Zotye', aliases: ['Zotye', '众泰'] },
  { canonical: 'Lifan', aliases: ['Lifan', '力帆'] },
  { canonical: 'Hawtai', aliases: ['Hawtai'] },
  { canonical: 'Xiali', aliases: ['Xiali', '夏利'] },
  { canonical: 'Haima', aliases: ['Haima', '海马'] },
  { canonical: 'Changfeng', aliases: ['Changfeng', 'Leopaard', '猎豹'] },
  { canonical: 'Landwind', aliases: ['Landwind'] },
  { canonical: 'Mianyang Xinchen', aliases: ['Mianyang Xinchen', 'Xinchen'] },
  { canonical: 'Shenyang Xinguang', aliases: ['Shenyang Xinguang', 'Xinguang'] },
  { canonical: 'Dongan', aliases: ['Dongan'] },
  { canonical: 'Zhejiang Gonow', aliases: ['Zhejiang Gonow', 'Gonow'] },
  { canonical: 'Huaihai', aliases: ['Huaihai'] },
  { canonical: 'DFSK', aliases: ['DFSK'] },
  { canonical: 'Foton', aliases: ['Foton'] },
  { canonical: 'Yuejin', aliases: ['Yuejin'] },
  { canonical: 'Tata', aliases: ['Tata'] },
  { canonical: 'MAHINDRA', aliases: ['Mahindra'] },
  { canonical: 'UAES', aliases: ['UAES'] },
  { canonical: 'Delphi', aliases: ['Delphi'] },
];

const MAKE_LOOKUP = (() => {
  const pairs = [];
  for (const { canonical, aliases } of MAKE_ALIASES) {
    for (const a of aliases) pairs.push({ canonical, alias: a });
  }
  // 最长优先，避免 "Ford" 抢先匹配 "Changan Ford"
  pairs.sort((a, b) => b.alias.length - a.alias.length);
  return pairs.map((p) => ({
    ...p,
    re: new RegExp(`(^|[^A-Za-z0-9])${p.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i'),
  }));
})();

/** 从自由文本中找出所有可确认的车型品牌（按原文顺序，去重）。 */
export function extractVehicleMakes(text) {
  if (!text) return { makes: [], unmatched: true };
  const found = [];
  let working = String(text);
  for (const { canonical, alias, re } of MAKE_LOOKUP) {
    if (re.test(working)) {
      if (!found.includes(canonical)) found.push(canonical);
      // 屏蔽已命中片段，避免 "Changan Ford" 再被 "Ford" 重复命中
      working = working.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '.repeat(alias.length));
    }
  }
  return { makes: found, unmatched: found.length === 0 };
}

/** 发动机代码候选：原文中明确写出的、含数字的车型/发动机代号样式 token。 */
export function extractEngineCodes(text) {
  if (!text) return [];
  const codes = new Set();
  // 形如 4G13 / EA111 / TU5JP4 / 4C20 / GW4B13 / JL476ZQCF / D4G15 / MR20 / 2RZ / 495QE
  // 注意：原实现用纯前瞻、没有捕获组，导致 m[1] 恒为 undefined。此处改为显式捕获组。
  const re = /\b(?=[A-Z0-9]{3,12}\b)(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])([A-Z][A-Z0-9]{2,11})\b/g;
  let m;
  const NOISE = new Set(['ABS', 'OEM', 'AT', 'MT', 'VVT', 'VVTI', 'DOHC', 'SOHC', 'TDI', 'MPI', 'GDI', 'CVT', 'SUV', 'MPV', 'LPG', 'CNG', 'USA', 'UK', 'GEN', 'MAX', 'PLUS', 'PRO', 'DM', 'EV', 'TSI', 'FSI', 'TFSI', 'CRDI', 'VGT', 'EFI', 'SFI', 'AWD', 'FWD', 'RWD', '4WD', '2WD', 'NE', 'A5', 'B8', 'A4', 'A6', 'C2', 'C4', 'C5', 'C6', 'B6', 'B7', 'B9', 'T1', 'T2', 'V1', 'V2', 'GT', 'RS', 'ST', 'GL', 'GLX', 'LX', 'EX', 'DX', 'SE', 'LE', 'XL', 'XLT', 'LTD', 'CD', 'DVD', 'GPS', 'AC', 'ECU', 'TCU', 'OBD', 'EGR', 'DPF', 'SCR', 'HC', 'CO', 'NOX', 'RPM', 'KW', 'HP', 'NM', 'BAR', 'PSI', 'M12', 'M14', 'M16']);
  const up = String(text).toUpperCase();
  while ((m = re.exec(up)) !== null) {
    const c = m[1];
    if (!c) continue;
    if (NOISE.has(c)) continue;
    if (/^\d+$/.test(c)) continue;
    codes.add(c);
  }
  return [...codes];
}

/** 排量候选：原文中的 1.5T / 2.0L / 1.6 / 1.8T 等明确写法。 */
export function extractDisplacements(text) {
  if (!text) return [];
  const out = new Set();
  const re = /\b([0-9]\.[0-9])\s*(T|L|t|l|Turbo)?\b/g;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const suffix = m[2] ? m[2].toUpperCase().replace('TURBO', 'T') : '';
    out.add(m[1] + suffix);
  }
  return [...out];
}

// =====================================================================
// 五、Bowen No. 清洗
// =====================================================================
/**
 * Bowen No. 原文里混进了 "With small pipe" / "Without small pipe" 之类的描述。
 * 处理：拆出编号本体 + 描述，两段都保留，不丢信息。
 */
export function parseBowenNo(raw) {
  const out = { bowen_no: '', bowen_note: '', anomalies: [] };
  if (raw === null || raw === undefined) return out;
  const text = String(raw).replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ').trim();
  if (!text) return out;

  // 尾部/中间夹带的英文描述词
  const m = text.match(/^(.*?)\s*(With(?:out)?\s+small\s+pipe|With\s+pipe|Without\s+pipe)\s*$/i);
  if (m) {
    out.bowen_no = m[1].trim();
    out.bowen_note = m[2].trim();
    out.anomalies.push('bowen_no_contained_description');
    return out;
  }
  out.bowen_no = text;
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_.\/]*$/.test(text)) {
    out.anomalies.push('bowen_no_nonstandard_chars');
  }
  return out;
}

/** Bowen No. 归一化键：大写、去空格、统一各种短横线（保留短横线语义以便分组审核） */
export function bowenKey(bowenNo) {
  const s = String(bowenNo ?? '').toUpperCase().replace(/[\u3000\s]/g, '').replace(/[‐‑‒–—―]/g, '-');
  // 变体后缀：3004--3 / 3004-5 / 3033--1 / 3654--2 视为同一基础号的变体
  return { exact: s, base: s.replace(/-+.*$/, '') };
}

// =====================================================================
// 六、杂项
// =====================================================================
export function isBlank(v) {
  if (v === null || v === undefined) return true;
  return String(v).replace(/[\u3000\s]/g, '') === '';
}

/** 已知的 Excel 浮点残留垃圾值（原文件 B 列被误当成数字的 "Image" 列） */
export const GARBAGE_VALUES = new Set(['0.10000000000000001', '0.20000000000000001', '0.30000000000000004',
  '0.40000000000000002', '0.50000000000000001', '0.59999999999999998', '0.69999999999999996',
  '0.80000000000000004', '0.90000000000000002']);

export function isGarbage(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return GARBAGE_VALUES.has(s);
}

/** 车辆文本拆成句子级片段（; 或换行），保留原文，不改写 */
export function splitApplicationSegments(text) {
  if (!text) return [];
  return String(text)
    .split(/[;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
