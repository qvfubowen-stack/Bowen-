/**
 * Phase 2.5 产品数据库重建 — 配置（唯一的人工裁决点集中在这里）
 * ---------------------------------------------------------------------------
 * 本文件里的每一个判断都必须是「人在 Excel 里写下的东西」，或者是业务方
 * 已经明确拍板的规则。程序不得在此之外推断任何 product_type。
 */

// =====================================================================
// 一、产品类型词典
// =====================================================================
/**
 * canonical = 网站 V1 使用的产品类型。
 * 注意业务规则：Automotive Thermostat / Thermostat / Thermostat Insert /
 * Thermostat Assembly 在 V1 全部统一为 "Thermostat"，不得再拆分。
 * 原始写法保存在 raw_label 里，未来要做 product_subtype 时有据可依。
 */
export const PRODUCT_TYPES = {
  Thermostat: {
    en: 'Thermostat',
    zh: '节温器',
    raw_labels: [
      '节温器',
      'Thermostat',
      'Automotive Thermostat',
      'Thermostat Insert',
      'Thermostat Assembly',
      '恒温器',
    ],
    website_category: 'thermostats',
    is_core: true,
  },
  TemperatureSensor: {
    en: 'Temperature Sensor',
    zh: '温度传感器',
    raw_labels: ['温度传感器', 'Temperature Sensor', '水温传感器'],
    website_category: 'temperature-sensors',
    is_core: false,
  },
  ThermalSwitch: {
    en: 'Thermal Switch',
    zh: '热敏开关',
    raw_labels: ['热敏开关', 'Thermal Switch', '温度开关'],
    website_category: 'automotive-switches',
    switch_subcategory: 'thermal-switches',
    is_core: false,
  },
  OilPressureWarningSwitch: {
    en: 'Oil Pressure Warning Switch',
    zh: '机油压力报警器',
    raw_labels: ['机油压力报警器', '机油压力开关', 'Oil Pressure Switch', 'Oil Pressure Warning Switch'],
    website_category: 'automotive-switches',
    switch_subcategory: 'oil-pressure-warning-switches',
    is_core: false,
  },
  BrakeLightSwitch: {
    en: 'Brake Light Switch',
    zh: '刹车灯开关',
    raw_labels: ['刹车灯开关', 'Brake Light Switch', '制动灯开关'],
    website_category: 'automotive-switches',
    switch_subcategory: 'brake-light-switches',
    is_core: false,
  },
  ReverseLightSwitch: {
    en: 'Reverse Light Switch',
    zh: '倒车灯开关',
    raw_labels: ['倒车灯开关', 'Reverse Light Switch', '倒车开关'],
    website_category: 'automotive-switches',
    switch_subcategory: 'reverse-light-switches',
    is_core: false,
  },
  RelatedCoolingPart: {
    en: 'Related Cooling Part',
    zh: '冷却系统相关件',
    raw_labels: ['冷却水管', '冷却水管法兰', 'Related Cooling Parts'],
    website_category: 'related-cooling-parts',
    is_core: false,
  },
};

/** raw label（去掉空格标点后）→ canonical type */
export const LABEL_LOOKUP = (() => {
  const m = new Map();
  for (const [canonical, def] of Object.entries(PRODUCT_TYPES)) {
    for (const l of def.raw_labels) m.set(normalizeLabel(l), canonical);
  }
  return m;
})();

export function normalizeLabel(s) {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]：:、,，.。]/g, '')
    .toLowerCase();
}

// =====================================================================
// 二、产品类型来源（product_type_source）合法值
// =====================================================================
export const ALLOWED_TYPE_SOURCES = [
  'human_section_label',        // 人工在 Excel 里写的产品区段标签
  'human_review_confirmed',     // 业务方在 Phase 2 审核表里逐行确认
  'inherited_from_bowen',       // 其他工作表继承综合产品信息表的分类
  'review_required',            // 没有人工证据，必须人工确认（程序绝不猜）
];

// =====================================================================
// 三、阻断（blocked）判定规则
// =====================================================================
/**
 * 判定依据：数值性规格（尺寸 / 温度 / 压力）或说明文字错位落进了 Bowen No. 字段。
 *
 * 校准原则（依据 2026 年对最新版 Excel 的实际抽样）：
 *   - 35 个异常单元格中有 33 个仍然以合法 Bowen No. 开头，后面才跟着错位内容，
 *     例如 "3029  92°" / "3033-z  138*95*251" / "3064\n77℃"。
 *     这类记录 Bowen No. 仍然可读，因此：
 *         * application 标 needs_review = true，错位原文原样进 application_notes
 *         * 不阻断整个产品（其他工作表里通常还有同一 Bowen 的干净记录）
 *   - 只有「根本读不出合法 Bowen No.」的记录才 blocked = true，
 *     例如 "无小管" / "芯子编号：31052" / "同3025尺寸相同，原件阀座有3处豁口…"。
 *   - 无论哪种情况都不做自动修复、不自动合并、不删除原始来源。
 */
export const MISALIGNMENT_RULES = [
  { id: 'dimension_token', re: /\d\s*[*×xX]\s*\d/, note: 'Bowen 字段出现尺寸写法（如 138*95*251）' },
  { id: 'mm_unit', re: /\d\s*(?:mm|MM|Mm|cm|CM)\b/, note: 'Bowen 字段出现长度单位' },
  { id: 'temperature_unit', re: /\d\s*(?:℃|°\s*C|C°|摄氏|℉|°\s*F)/, note: 'Bowen 字段出现温度值' },
  { id: 'pressure_unit', re: /\d\s*(?:bar|BAR|Bar|kpa|KPA|Mpa|MPA|psi|PSI)/, note: 'Bowen 字段出现压力值' },
  { id: 'bare_degree', re: /\d+\s*°/, note: 'Bowen 字段出现角度/温度符号' },
  { id: 'descriptive_text', re: /[\u4e00-\u9fff]/, note: 'Bowen 字段出现中文说明文字' },
  { id: 'parenthetical_note', re: /[（(].+[）)]/, note: 'Bowen 字段出现括号备注' },
];

/** Bowen No. 允许的字符形态（其余一律进入人工复核清单） */
export const BOWEN_ALLOWED_RE = /^[A-Za-z0-9][A-Za-z0-9\-_.\/]*$/;
export const BOWEN_MAX_LEN = 20;

/**
 * 单元格里不是 OE 号、而是状态说明的 token（例如 "总成OE" / "待确认"）。
 * 这些 token 保留在原文里，但不进 OE 搜索索引，也不参与 OE 计数。
 */
export const NON_OE_ANNOTATIONS = [
  '总成OE', '总成oe', '总成', '待确认', '停售', '借用', '只有芯子', '非电子',
  '胶圈', '胶圈不同', '塑料外壳', '铝外壳', '德本', '天博',
];

// =====================================================================
// 四、状态模型
// =====================================================================
export const STATUS = {
  PROTOTYPE_CANDIDATE: 'prototype_candidate',
  SEARCHABLE_NOINDEX: 'searchable_noindex',
  DRAFT: 'draft',
  BLOCKED: 'blocked',
};

/** Prototype 阶段挑选规则 */
export const PROTOTYPE_RULES = {
  min: 15,
  max: 20,
  /** 只允许核心品类（节温器）进原型 */
  require_core_type: true,
  /** 至少这么多条 applications 才算“信息完整” */
  min_applications: 2,
  /** 至少这么多张不同工作表出现（证明资料交叉验证过） */
  min_source_sheets: 1,
  /** 每个产品至少要有这么多条 OE 参考号 */
  min_oe_tokens: 2,
};

// =====================================================================
// 五、站点级静态事实（全部来自项目资料，禁止编造）
// =====================================================================
export const COMPANY_FACTS = {
  since_year: 2009,
  manufacturing_base_m2: 10000,
  production_workshop_m2: 3500,
  temperature_controlled_workshop_m2: 2000,
  production_equipment_count: 100,
  rd_projects: 29,
  patents: 16,
  software_copyrights: 5,
  certifications: ['IATF 16949', 'ISO 14001', 'ISO 45001'],
};

export const SHEET_ROLES = {
  MASTER: '综合产品信息表',
  /** 天博编号辅助表，本阶段不入库，仅记录其存在 */
  AUX: ['工作表1', '工作表2'],
};
