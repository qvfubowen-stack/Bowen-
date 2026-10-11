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
/**
 * ⚠️ 这里是站点公司资料的**唯一权威来源**。
 * website/src/data/site-facts.json 是构建产物（由 tools/build-product-db-v2.mjs 写出），
 * 直接改那个 JSON 会在下次构建时被覆盖 —— 要改公司资料请改这里。
 *
 * 证据来源：宣传手册最终PDF/博文公司宣传手册-英文版.pdf 与 _中文版.pdf
 *   P3 公司概况 / P4 产品系列 / P5–P8 工厂与设备 / P12 管理体系 / P13 资质荣誉 / P14 封底联系方式
 * 全部字段都逐条核对过手册文字层；证书字段另与证书原图核对（见 CERTIFICATIONS_DETAIL.evidence）。
 * 手册没有任何街道地址，因此**不提供** address 字段，页面也不展示地址。
 */
export const COMPANY_FACTS = {
  // ---- 主体与联系方式（手册 P3 / P14）----
  legal_name_en: 'Qufu Bowen Auto Parts Manufacturing Co., Ltd.',
  legal_name_zh: '曲阜市博文汽车零部件有限公司',
  brand_name: 'Bowen',
  email: 'qfbowen@126.com',
  /** 手册原样号码（不带国家码） */
  tel_national: '18653750690',
  /** 展示用格式 */
  tel_display: '+86 186 5375 0690',
  /** tel: 链接用格式（E.164） */
  tel_href: '+8618653750690',
  /** 国内平台：必须明确标注为中国国内平台，不得包装成海外官网主域名 */
  domestic_marketplace_url: 'https://bowen18653750690.1688.com',
  domestic_marketplace_label: 'bowen18653750690.1688.com',
  domestic_marketplace_note: "China domestic marketplace (1688). This is not the company's export website.",

  // ---- 规模事实（手册 P3）----
  since_year: 2009,
  factory_built_year: 2014,
  manufacturing_base_m2: 10000,
  production_workshop_m2: 3500,
  temperature_controlled_workshop_m2: 2000,
  production_equipment_count: 100,
  rd_projects: 29,
  patents: 16,
  software_copyrights: 5,

  // ---- 认证 ----
  // Phase 4.1 业务规则：**只有存在证书图片的认证才在公开网站展示**。
  // 因此内部证据清单（certifications / certification_standards）与公开清单
  // （public_certifications / public_certification_standards）分开维护：
  //   - 内部清单保留全部三项，供内部资料、审计报告与后续业务使用；
  //   - 公开清单只含 IATF 16949 —— 宣传手册没有 ISO 14001 / ISO 45001 的证书图片。
  // 页面**只允许**读取 public_* 字段（见 website/tools/verify-public-surface.mjs）。
  certifications: ['IATF 16949', 'ISO 14001', 'ISO 45001'],
  certification_standards: ['IATF 16949:2016', 'ISO 14001:2015', 'ISO 45001:2018'],
  /** 内部记录：ISO 两项没有证书图片，按业务决定不在公开网站展示 */
  internal_only_certifications: ['ISO 14001', 'ISO 45001'],

  /** ★ 公开认证（有证书图片，允许在网站展示） */
  public_certifications: ['IATF 16949'],
  public_certification_standards: ['IATF 16949:2016'],

  // ---- 公司地址（Phase 4.1 业务方已确认可对外公开）----
  // 来源：IATF 16949 证书原图上的注册地址（宣传手册封底文字层没有地址栏），
  // 已由业务方在 2026 明确确认该地址可以对外公布。
  address_en:
    'No. 3, Duzhi Road, Qufu Electronic Information Industrial Park, '
    + 'Jining City, Shandong Province, 273100, China',
  postal_code: '273100',
  country: 'China',
  address_evidence:
    'IATF 16949:2016 证书原图上的公司注册地址（宣传手册 P12 图 IM69）；'
    + '宣传手册封底文字层只有邮箱/电话/网址，无地址栏。业务方已确认该地址可对外公开。',

  // ---- 产品范围（手册 P4；V1 网站分类仍统一为 Thermostat，不新增类目）----
  product_range: [
    'Thermostats',
    'Temperature Sensors',
    'Oil Pressure Warning Switches',
    'Thermal Switches',
    'Reversing Light Switches',
    'Brake Light Switches',
  ],

  evidence_source:
    '宣传手册最终PDF/博文公司宣传手册-英文版.pdf 与 _中文版.pdf'
    + '（P3 公司概况 / P4 产品系列 / P5–P8 工厂与设备 / P12 管理体系 / P13 资质荣誉 / P14 封底联系方式）'
    + '，以及 P12 的 IATF 16949 证书原图（公司注册地址）',
};

/**
 * 管理体系认证明细（宣传手册 P12）。
 * IATF 各字段已与证书原图（IM69）逐字核对；
 * ISO 14001 / ISO 45001 的编号与有效期来自中英文两版手册文字层（两版互相印证）。
 *
 * Phase 4.1：业务规则是「只有存在证书图片的认证才在公开网站展示」。
 * 手册没有附 ISO 两张证书的图片，因此：
 *   - ISO 两项仍然完整保留在本文件（内部证据，不删除）；
 *   - 但 is_public = false，网站页面不得展示、不得写进元描述或结构化数据。
 * IATF 有证书原图，is_public = true。
 * 另外这 3 张证书图片已作为荣誉/资质单独展示在 site-media.json → certificates。
 */
export const CERTIFICATIONS_DETAIL = [
  {
    standard: 'IATF 16949:2016',
    system: 'Automotive quality management system',
    scope: 'Manufacture of thermostats.',
    scope_exclusion: 'Clause 8.3 product design is excluded from the certification scope.',
    certification_body: 'NQA',
    iatf_certificate_no: '0513244',
    nqa_certificate_no: 'T184734',
    certificate_no: null,
    issue_date: '25 April 2024',
    expiry_date: '24 April 2027',
    surveillance: null,
    image: '/assets/certificates/iatf-16949-certificate.jpg',
    /** 有证书图片 → 允许公开 */
    is_public: true,
    public_hide_reason: null,
    evidence: '宣传手册-英文版 P12 证书原图（IM69）逐字核对；中文版 P12 文字层一致',
  },
  {
    standard: 'ISO 14001:2015',
    system: 'Environmental management system',
    scope: 'Environmental management activities related to thermostat processing.',
    scope_exclusion: null,
    certification_body: null,
    iatf_certificate_no: null,
    nqa_certificate_no: null,
    certificate_no: '05325E31120R0S',
    issue_date: '10 July 2025',
    expiry_date: '9 July 2028',
    surveillance: 'Certification is subject to ongoing surveillance.',
    image: null,
    /** 手册未附证书图片 → 按业务规则不公开（内部证据保留） */
    is_public: false,
    public_hide_reason:
      '内部资料记录了编号与有效期，但公司宣传手册没有附该证书图片；'
      + '业务决定「没有证书图片的认证暂不在公开网站展示」。',
    evidence:
      '宣传手册-英文版 P12 与 -中文版 P12 文字层分别提取，编号与日期完全一致；'
      + '手册未附该证书图片',
  },
  {
    standard: 'ISO 45001:2018',
    system: 'Occupational health and safety management system',
    scope: 'Occupational health and safety management activities related to thermostat processing.',
    scope_exclusion: null,
    certification_body: null,
    iatf_certificate_no: null,
    nqa_certificate_no: null,
    certificate_no: '05325S31042R0S',
    issue_date: '10 July 2025',
    expiry_date: '9 July 2028',
    surveillance: 'Certification is subject to ongoing surveillance.',
    image: null,
    /** 手册未附证书图片 → 按业务规则不公开（内部证据保留） */
    is_public: false,
    public_hide_reason:
      '内部资料记录了编号与有效期，但公司宣传手册没有附该证书图片；'
      + '业务决定「没有证书图片的认证暂不在公开网站展示」。',
    evidence:
      '宣传手册-英文版 P12 与 -中文版 P12 文字层分别提取，编号与日期完全一致；'
      + '手册未附该证书图片',
  },
];

/**
 * 资质与荣誉（宣传手册 P13）。三项都有图片，因此都可以公开。
 * 编号直接读取自手册中的证书/公示图片（IM72/IM73/IM74）——
 * 手册文字层没有写这些编号，只有图片上有，因此以图片为准。
 *
 * document_kind 必须如实标注：
 *   certificate  = 证书
 *   public_list  = 公示名单（**不是**管理体系认证证书，页面文案必须写 public list / 公示名单）
 */
export const HONORS = [
  {
    name: 'High-tech Enterprise Certificate',
    name_zh: '高新技术企业证书',
    document_kind: 'certificate',
    certificate_no: 'GR202537000055',
    entry_no: null,
    issue_date: '8 December 2025',
    validity: 'Three years',
    image: '/assets/certificates/high-tech-enterprise-certificate.jpg',
    is_public: true,
    evidence: '宣传手册-英文版 P13 证书原图（IM72）；编号与日期直接读取自证书图片',
  },
  {
    name: 'Work Safety Standardization Certificate',
    name_zh: '安全生产标准化证书',
    document_kind: 'certificate',
    certificate_no: '曲AQB XW 20250005',
    entry_no: null,
    issue_date: 'July 2025',
    validity: 'Until July 2028',
    image: '/assets/certificates/work-safety-standardization-certificate.jpg',
    is_public: true,
    evidence: '宣传手册-英文版 P13 证书原图（IM73）；编号与有效期直接读取自证书图片',
  },
  {
    name: 'Shandong Province 2026 Innovative SME public list',
    name_zh: '山东省2026年度创新型中小企业公示',
    document_kind: 'public_list',
    certificate_no: null,
    entry_no: '3380',
    issue_date: '4 June 2026',
    validity: null,
    image: '/assets/certificates/innovative-sme-2026-public-list.jpg',
    is_public: true,
    evidence: '宣传手册-英文版 P13 公示截图（IM74）；名单序号直接读取自图片',
  },
];


export const SHEET_ROLES = {
  MASTER: '综合产品信息表',
  /** 天博编号辅助表，本阶段不入库，仅记录其存在 */
  AUX: ['工作表1', '工作表2'],
};
