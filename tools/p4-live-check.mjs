#!/usr/bin/env node
/**
 * Phase 4 实测脚本：对运行中的站点做端到端页面检查（零依赖，用 fetch，不用 child_process）。
 *   node tools/p4-live-check.mjs [baseUrl]
 *
 * 检查内容：
 *   1. 十条验收路由的 HTTP 状态
 *   2. 每页引用的图片 URL 是否真的能取到（200 + image/*）
 *   3. 联系资料是否为公司正式资料；是否残留旧占位邮箱
 *   4. Factory 页是否已移除产能 / 标准交期模块
 *   5. Quality 页证书编号与日期是否与证书原件一致
 *   6. RFQ 是否仍保留产品上下文
 *   7. 页面是否错误引用 data/ 目录
 *   8. OE 搜索两种写法是否给出一致结果
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
function section(t) { console.log(`\n${'─'.repeat(74)}\n${t}\n${'─'.repeat(74)}`); }

const ROUTES = [
  '/',
  '/products',
  '/products/BW-3005',
  '/oe-search?q=25500-35540',
  '/oe-search?q=2550035540',
  '/factory',
  '/quality',
  '/about',
  '/contact',
  '/rfq?product=BW-3005',
];

/** Phase 4.1：无可靠主图的产品，直接访问必须 404（不能显示 fallback 占位产品页） */
const NOT_FOUND_ROUTES = [
  '/products/BW-3004-5',
  '/products/BW-3566',
  '/products/BW-403229',
];

const pages = new Map();
async function get(path, { raw = false } = {}) {
  const res = await fetch(BASE + path, { redirect: 'follow' });
  const body = raw ? await res.arrayBuffer() : await res.text();
  return { status: res.status, type: res.headers.get('content-type') ?? '', body };
}

section('1. 路由可达性');
for (const r of ROUTES) {
  try {
    const { status } = await get(r);
    check(`GET ${r}`, status === 200, `HTTP ${status}`);
  } catch (e) {
    check(`GET ${r}`, false, `异常 ${e.message}`);
  }
}

section('1b. 无可靠主图的产品必须 404');
for (const r of NOT_FOUND_ROUTES) {
  try {
    const { status, body } = await get(r);
    check(`GET ${r} 返回 404`, status === 404, `HTTP ${status}`);
    check(`GET ${r} 不显示产品详情内容`, !/OE References &amp; Vehicle Applications|OE References & Vehicle Applications/.test(body));
  } catch (e) {
    check(`GET ${r} 返回 404`, false, `异常 ${e.message}`);
  }
}

section('2. 页面正文抓取');
for (const r of ROUTES) {
  const { body } = await get(r);
  pages.set(r, body);
}

// ---------------------------------------------------------------------------
section('3. 图片可加载（含去重后的产品图抽样）');
const IMG_RE = /<img[^>]*\ssrc="([^"]+)"/g;
const referenced = new Map(); // src -> Set(page)
for (const [r, html] of pages) {
  for (const m of html.matchAll(IMG_RE)) {
    const src = m[1];
    if (!referenced.has(src)) referenced.set(src, new Set());
    referenced.get(src).add(r);
  }
}
const allSrcs = [...referenced.keys()];
console.log(`  页面共引用 ${allSrcs.length} 个不同图片 URL`);
check('页面引用了图片（首页/工厂/质量等）', allSrcs.length > 0, `${allSrcs.length} 个`);

const dataRefs = allSrcs.filter((s) => s.includes('/data/') || s.startsWith('data/'));
check('没有任何图片指向 data/ 目录', dataRefs.length === 0, dataRefs.slice(0, 5).join(', '));

let imgOk = 0;
const imgBad = [];
for (const src of allSrcs) {
  try {
    const { status, type } = await get(src, { raw: true });
    if (status === 200 && type.startsWith('image/')) imgOk++;
    else imgBad.push(`${src} -> ${status} ${type}`);
  } catch (e) { imgBad.push(`${src} -> ${e.message}`); }
}
check(`全部 ${allSrcs.length} 个被引用图片都能以 image/* 取到`, imgBad.length === 0,
  imgBad.length ? imgBad.slice(0, 6).join(' | ') : `${imgOk}/${allSrcs.length} OK`);

// 产品图抽样：直接命中若干产品页引用的资产
const sample = allSrcs.filter((s) => s.startsWith('/assets/products/')).slice(0, 12);
let sampleOk = 0;
for (const s of sample) {
  const { status, type } = await get(s, { raw: true });
  if (status === 200 && type.startsWith('image/')) sampleOk++;
}
check('产品图抽样可加载', sample.length === 0 || sampleOk === sample.length, `${sampleOk}/${sample.length}`);

// ---------------------------------------------------------------------------
section('4. 公司资料 / 占位残留');
const home = pages.get('/');
const contact = pages.get('/contact');
const about = pages.get('/about');
const factory = pages.get('/factory');
const quality = pages.get('/quality');

const pick = (html, re) => (html.match(re) ?? []).filter((x) => typeof x === 'string');
const uniq = (a) => [...new Set(a)];

const oldMail = ['sales@bowen-thermostat.com', 'quality@bowen-thermostat.com', 'info@bowen', 'bowen-thermostat.com'];
for (const m of oldMail) {
  const hits = ROUTES.filter((r) => pages.get(r).includes(m));
  check(`旧的占位邮箱 ${m} 已不再出现`, hits.length === 0, hits.join(', '));
}

const legalName = 'Qufu Bowen Auto Parts Manufacturing Co., Ltd.';
check('首页出现正式公司英文全称', home.includes(legalName));
check('Contact 页出现正式公司英文全称', contact.includes(legalName));
check('Contact 页出现中文名称', contact.includes('曲阜市博文汽车零部件制造有限公司') || contact.includes('曲阜市博文汽车零部件有限公司'));
check('Contact 页出现正式邮箱 qfbowen@126.com', contact.includes('qfbowen@126.com'));
check('Contact 页出现正式电话（E.164 展示格式）', contact.includes('+86 186 5375 0690'));
check('页头/页脚出现正式邮箱', home.includes('qfbowen@126.com'));
check('页脚出现公司全称', home.includes(legalName));

section('5. 不得出现的编造信息');
const FORBIDDEN = [
  ['WhatsApp', /WhatsApp/i],
  ['WeChat', /WeChat|微信/i],
  ['Business hours', /Business hours|营业时间/i],
  ['Map / location', /Map and factory location|地图坐标/i],
  ['海外销售办公室', /overseas (sales )?office|海外分公司|销售办公室/i],
  ['行业领先/全球第一等绝对化用语', /industry[- ]leading|world'?s (no\.?|number) ?1|top supplier|most advanced|global leader/i],
];
for (const [label, re] of FORBIDDEN) {
  const hits = ROUTES.filter((r) => re.test(pages.get(r)) && r !== '/rfq?product=BW-3005');
  check(`未出现「${label}」`, hits.length === 0, hits.join(', '));
}

section('6. Factory 页：产能 / 标准交期已移除');
const capacityRe = /Annual capacity|Standard lead time|annual (production )?capacity|标准交期|年产能|日产量|月产量|MOQ|Minimum order quantity/i;
check('Factory 页不含产能 / 标准交期 / MOQ 模块', !capacityRe.test(factory),
  uniq(pick(factory, capacityRe)).join(', '));
check('首页也不含产能 / 标准交期', !capacityRe.test(home), uniq(pick(home, capacityRe)).join(', '));
check('About 页也不含产能 / 标准交期', !capacityRe.test(about), uniq(pick(about, capacityRe)).join(', '));
check('Factory 页不再出现 "Placeholder — pending" 占位块', !/Placeholder\s*[—–-]\s*pending/i.test(factory));
check('Factory 页仍保留四道工序标题', ['Machining', 'Assembly', 'Automated Assembly', 'Testing'].every((s) => factory.includes(s)));
check('Factory 页引用了真实工厂图片', /\/assets\/factory\//.test(factory),
  uniq(pick(factory, /\/assets\/factory\/[a-z0-9-]+\.jpg/g)).length + ' 张');
check('Quality 页引用了证书图片', /\/assets\/certificates\//.test(quality),
  uniq(pick(quality, /\/assets\/certificates\/[a-z0-9-]+\.jpg/g)).length + ' 张');

section('7. Quality 页证书数据（只公开有证书图片的认证）');
const CERT_EXPECT = [
  ['IATF 认证机构 NQA', 'NQA'],
  ['IATF 证书号 0513244', '0513244'],
  ['NQA 证书号 T184734', 'T184734'],
  ['签发日期 25 April 2024', '25 April 2024'],
  ['到期日期 24 April 2027', '24 April 2027'],
  ['范围 manufacture of thermostats', /manufacture of thermostats/i],
  ['Clause 8.3 排除说明', /Clause 8\.3 product design is excluded/i],
];
for (const [label, needle] of CERT_EXPECT) {
  const ok = typeof needle === 'string' ? quality.includes(needle) : needle.test(quality);
  check(label, ok);
}
check('Quality 页不再出现 ISO 14001', !/ISO\s*14001/.test(quality));
check('Quality 页不再出现 ISO 45001', !/ISO\s*45001/.test(quality));
check('Quality 页不再声称「Three certificates」/「three management systems」',
  !/Three certificates|three management systems/i.test(quality));
check('Quality 页不再解释「为什么没有 ISO 证书图」',
  !/does not reproduce those two certificates|no certificate image is shown for them|cannot reproduce as a document image/i.test(quality));
check('Quality 页不再声称证书编号"正在收集"',
  !/not published yet|being collected|will be published with the certificate copies/i.test(quality));
check('Quality 页的创新型中小企业材料标注为 public list', /Public list/i.test(quality));

section('8. About 页：真实资料，无占位块');
check('About 页包含 2009 年成立', about.includes('2009'));
check('About 页包含 2014 年建厂', about.includes('2014'));
check('About 页列出产品范围', /Thermostats/.test(about) && /Temperature Sensors/.test(about) && /Brake Light Switches/.test(about));
check('About 页引用了真实公司/工厂图片', /\/assets\/(company|factory)\//.test(about));
check('About 页不再出现"公司故事待补"占位块',
  !/Company story details still to be supplied|intentionally left out until Bowen supplies/i.test(about));

section('9. 产品图与产品对应');
const p3005 = pages.get('/products/BW-3005');
const p3005Imgs = uniq(pick(p3005, /\/assets\/products\/[a-z0-9-]+\.(?:jpg|jpeg|png)/g));
check('BW-3005 详情页显示真实产品图', p3005Imgs.length >= 1, p3005Imgs.join(', '));
check('BW-3005 图片路径与产品 ID 对应', p3005Imgs.every((s) => s.includes('/bw-3005')), p3005Imgs.join(', '));
const altMatch = p3005.match(/<img[^>]*alt="([^"]*)"/);
check('BW-3005 产品图 alt 含 Bowen No. 3005', !!altMatch && /Bowen No\.? 3005/.test(altMatch[1]),
  altMatch ? altMatch[1] : '(无 img)');
check('产品详情页不再出现大面积 "Photo pending"', !/Photo pending/i.test(p3005));

section('10. OE 搜索（两种写法一致）');
const oe1 = pages.get('/oe-search?q=25500-35540');
const oe2 = pages.get('/oe-search?q=2550035540');
const norm = (h) => h.replace(/\s+/g, ' ').trim();
check('带短横线查询有结果', /25500-35540|2550035540|3503/.test(oe1));
check('不带短横线查询有结果', /25500-35540|2550035540|3503/.test(oe2));
const strip = (h) => {
  const m = h.match(/<main[\s\S]*<\/main>/);
  return norm((m ? m[0] : h).replace(/<[^>]+>/g, ' '));
};
const raw1 = strip(oe1);
const raw2 = strip(oe2);
// 页面会回显用户输入的查询字面量（"Query: 25500-35540"），两种写法必然差一个连字符；
// 这不是结果差异。比较前把两种写法归一成同一个占位符，只比较结果本身。
const normQueryEcho = (s) => s.replace(/25500-35540/g, '<Q>').replace(/2550035540/g, '<Q>');
const s1 = normQueryEcho(raw1);
const s2 = normQueryEcho(raw2);
check('两种写法结果一致（查询回显归一后正文完全相同）', s1 === s2,
  s1 === s2 ? `${s1.length} 字符一致` : `长度 ${s1.length} vs ${s2.length}`);
check('两种写法都解析出同一个规范化键 2550035540',
  /normalized:\s*2550035540/.test(raw1) && /normalized:\s*2550035540/.test(raw2));
check('两种写法命中同样条数与同样产品数',
  (raw1.match(/\d+\s*exact match\w*\s*across\s*\d+\s*Bowen/i) ?? [''])[0]
  === (raw2.match(/\d+\s*exact match\w*\s*across\s*\d+\s*Bowen/i) ?? [''])[0],
  (raw1.match(/\d+\s*exact match[\s\S]{0,40}?Bowen\s*products?/i) ?? [''])[0].replace(/\s+/g, ' '));
check('OE 结果带 application 上下文', /Hyundai|Sonata|G6EA|Application|Vehicle/i.test(oe1));

section('11. RFQ 产品上下文');
const rfq = pages.get('/rfq?product=BW-3005');
check('RFQ 页保留 product=BW-3005 上下文', /BW-3005/.test(rfq));
check('RFQ 页保留 Bowen No. 3005', /3005/.test(rfq));
check('RFQ 页仍提供表单与提交入口', /form|Request|Submit|quantity/i.test(rfq));

section('12. 1688 国内平台标注');
check('Contact 页把 1688 标注为中国国内平台', /China domestic marketplace/i.test(contact));
check('Contact 页 1688 位于次要位置且非主域名包装',
  /Domestic marketplace/i.test(contact) && !/https?:\/\/bowen18653750690\.1688\.com<\/a>/.test(contact));

// ---------------------------------------------------------------------------
section('13. 客户页面不得出现内部原型 / 数据处理文案（Phase 4.1）');
const INTERNAL_COPY = [
  ['UI Prototype / Prototype # / Prototype candidate', /UI Prototype|Prototype\s*#|Prototype candidate|Phase 3\b/i],
  ['Not published / No index', /Not published|\bNo index\b/i],
  ['Source sheets', /Source sheets?/i],
  ['Subtype: not used in V1', /Subtype:\s*not used|not used in V1/i],
  ['How this classification was made', /How this classification was made/i],
  ['内部证据页码说明（company profile, page N）', /company profile, page\s*\d/i],
  ['地址缺失说明', /do not publish a guessed address|No street address is shown/i],
  ['证书缺图说明', /does not reproduce those two certificates|cannot reproduce as a document image/i],
  ['中文工作表名', /综合产品信息表|工作表\s*\d/],
];
for (const [label, re] of INTERNAL_COPY) {
  const hits = ROUTES.filter((r) => re.test(pages.get(r)));
  check(`10 条验收路由均不含「${label}」`, hits.length === 0, hits.join(', '));
}
check('页脚不再出现 "UI Prototype — Phase 3 · Not published · No index"',
  !/UI Prototype\s*—\s*Phase 3/i.test(home));
check('Header/Footer 不再提供 /blog 入口', !/href="\/blog"/.test(home));

section('14. 发动机标签（Phase 4.1：不公开展示未确认的代号）');
check('产品详情页不再有「Engine codes in text」列', !/Engine codes in text/i.test(p3005));
check('产品详情页不再把截断代号（G13 / G15S）作为发动机标签输出',
  !/>\s*G13\s*</.test(p3005) && !/>\s*G15S\s*</.test(p3005) && !/code[^>]*>\s*G13\s*</.test(p3005));
check('产品详情页保留原始 application 原文列', /Vehicle \/ Application \(as recorded\)/i.test(p3005));
check('首页不再出现按发动机筛选的链接', !/href="\/products\?engine=/.test(home));
check('首页不再宣传 "Engine codes such as EA111, 4G6 or 476ZQA"',
  !/Engine codes such as|476ZQA\s*are recorded/i.test(home));
const productsPage = pages.get('/products');
check('筛选面板不再内置发动机代号候选列表', !/engine-suggestions|list="engine-suggestions"/.test(productsPage));
{
  const re = /vehicle and engine|engine application|vehicle\/engine/i;
  const hits = ROUTES.filter((r) => re.test(pages.get(r)));
  check('公开文案不再声称提供「vehicle and engine application」结论', hits.length === 0, hits.join(', '));
}

section('15. 已确认地址与公开数量（Phase 4.1）');
const ADDRESS = 'No. 3, Duzhi Road, Qufu Electronic Information Industrial Park, Jining City, Shandong Province, 273100, China';
check('Contact 页展示完整已确认地址', contact.includes(ADDRESS), contact.includes(ADDRESS) ? '' : '未找到完整地址');
check('页脚展示已确认地址（可分词，检查关键片段）',
  /Duzhi Road/.test(home) && /273100/.test(home));
check('Contact 页不再解释「为什么不展示地址」',
  !/materials do not\s+state one|do not publish a guessed address/i.test(contact));

section('16. 公开产品数量（有可靠主图才公开）');
/** 去掉标签后再找数字，避免被 <strong>…</strong><span>…</span> 的标记打断 */
const stripMain = (html) => {
  const m = html.match(/<main[\s\S]*<\/main>/);
  return (m ? m[0] : html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
};
const homeText = stripMain(home);
const productsText = stripMain(pages.get('/products'));
const productCounts = (text) => {
  // 首页 hero fact：N Products searchable now
  const m = text.match(/(\d[\d,]*)\s*Products searchable now/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const homeCount = productCounts(homeText);
const listCount = (() => {
  const m = productsText.match(/(\d[\d,]*)\s*products?\b/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
})();
check('首页显示了公开产品数量', homeCount !== null, String(homeCount));
check('/products 列表显示了同一个公开产品数量', listCount !== null, String(listCount));
check('首页产品数量与 /products 列表口径一致（同一公开集合）',
  homeCount !== null && homeCount === listCount, `首页 ${homeCount} / 列表页 ${listCount}`);
check('OE 搜索结果里不再出现无图产品 BW-3004-5',
  !/BW-3004-5/.test(oe1) && !/BW-3004-5/.test(oe2));
check('OE 示例命中 3 条 application / 2 个产品',
  /3\s*exact matches?\s*across\s*2\s*Bowen/i.test(oe1) || /3<\/strong>\s*exact match[\s\S]{0,60}?2<\/strong>\s*Bowen/i.test(oe1),
  (oe1.match(/\d+\s*exact match[\s\S]{0,50}?Bowen\s*products?/i) ?? [''])[0].replace(/\s+/g, ' '));
check('首页不把内部字段序列化进页面源码（site-facts 的 certifications 不应出现在 HTML）',
  !/"certifications"\s*:/.test(home) && !/"internal_only_certifications"/.test(home));
check('产品详情页不把内部审计字段序列化进页面源码（source_sheets / product_type_evidence）',
  !/"source_sheets"\s*:/.test(p3005) && !/"product_type_evidence"\s*:/.test(p3005) && !/综合产品信息表/.test(p3005));
check('Quality 页 HTML 里不出现 ISO 14001 / ISO 45001（含 RSC payload）',
  !/ISO\s*14001/.test(quality) && !/ISO\s*45001/.test(quality));

section('17. 质量页面证据边界（Phase 4.1）');
const QUALITY_UNSUPPORTED = [
  ['测试结果与生产批次绑定', /test result and production batch are linked|Test results are linked to the production batch/i],
  ['所有产品均可完整追溯', /can be traced back\.|Traceability/i],
  ['每类产品固定检验（六个检验环节）', /Inspection happens at six points|six points between goods-in and packing/i],
  ['已校准量具', /calibrated instruments|calibrated measuring/i],
];
for (const [label, re] of QUALITY_UNSUPPORTED) {
  check(`Quality 页不再声称「${label}」`, !re.test(quality), '');
}
check('Quality 页保留设备事实（调整测试设备 + 寿命试验台）',
  /adjustment and testing machine/i.test(quality) && /life test bench/i.test(quality));
check('Quality 页保留 IATF 适用范围与 Clause 8.3',
  /manufacture of thermostats/i.test(quality) && /clause 8\.3/i.test(quality));

console.log(`\n${'='.repeat(74)}`);
console.log(`结果：PASS ${pass}  FAIL ${fail}`);
if (fail) {
  console.log('\n失败项：');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n✅ 页面实测全部通过。');
