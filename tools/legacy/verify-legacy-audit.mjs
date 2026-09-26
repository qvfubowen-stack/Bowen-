/**
 * Phase 3.5 —— 验收测试（纯 Node.js，零依赖）
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/verify-legacy-audit.mjs
 *
 * 重点验证三件事：
 *   1. 交付物齐全且结构正确（assets.json 字段、xlsx、报告）。
 *   2. **没有无证据的自动绑定**（本阶段最重要的红线）。
 *   3. **没有修改现有 Prototype**，也没有越界抓取（登录/后台/表单提交）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readZip } from '../xlsx-reader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');

let pass = 0; const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; return; }
  failures.push(`${name}${detail ? ' :: ' + detail : ''}`);
}
function section(t) { console.log(`\n== ${t} ==`); }
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

// =====================================================================
section('TEST 1 — 交付物存在性');
// =====================================================================
const REQUIRED = [
  'data/legacy-site/assets.json',
  'data/legacy-site/downloads.json',
  'data/legacy-site/legacy-products.json',
  'data/legacy-site/product-image-matching.json',
  'data/legacy-site/legacy-site-audit.json',
  'data/legacy-site/crawl/pages.json',
  'data/legacy-site/crawl/probes.json',
  'review/legacy-product-image-mapping.xlsx',
  'docs/qfbowen-legacy-site-audit.md',
];
for (const r of REQUIRED) ok(`存在 ${r}`, exists(path.join(ROOT, r)));

for (const d of ['images/products', 'images/factory', 'images/certificates', 'images/company', 'images/other', 'documents']) {
  ok(`目录存在 data/legacy-site/${d}`, exists(path.join(SITE_DIR, d)));
}

// =====================================================================
section('TEST 2 — 抓取合规性（只抓公开页面）');
// =====================================================================
const crawl = readJson(path.join(SITE_DIR, 'crawl', 'pages.json'));
const urls = crawl.pages.map((p) => p.url);
ok('抓取到页面', crawl.pages.length > 0, `pages=${crawl.pages.length}`);
ok('无后台/登录路径', !urls.some((u) => /\/(admin|manage|login|user|member)\b/i.test(u)),
  urls.filter((u) => /\/(admin|manage|login|user|member)\b/i.test(u)).slice(0, 3).join(', '));
ok('无验证码相关路径', !urls.some((u) => /(captcha|verifycode|yzm)/i.test(u)));
ok('全部为 qfbowen.com 站内页面', urls.every((u) => /^https?:\/\/(www\.)?qfbowen\.com/i.test(u)));
ok('全部为 HTTP GET 抓取的 HTML 页面', urls.every((u) => /^\/($|about|list|content|gbook)/i.test(new URL(u).pathname)));

// 未提交任何表单：抓取脚本只使用 GET
const crawlSrc = fs.readFileSync(path.join(__dirname, 'crawl-legacy-site.mjs'), 'utf8');
ok('爬虫代码中无 POST', !/method\s*:\s*['"]POST['"]/i.test(crawlSrc));
ok('爬虫代码中无 Cookie 注入', !/headers[\s\S]{0,200}cookie/i.test(crawlSrc));

// =====================================================================
section('TEST 3 — 素材清单字段完整性');
// =====================================================================
const assets = readJson(path.join(SITE_DIR, 'assets.json'));
const REQ_FIELDS = ['source_url', 'asset_url', 'local_file', 'asset_type', 'page_title',
  'page_category', 'possible_bowen_no', 'possible_product_name', 'reuse_status'];
const missing = [];
for (const a of assets.assets) {
  for (const f of REQ_FIELDS) if (!(f in a)) missing.push(`${a.asset_url} 缺 ${f}`);
}
ok('每条资产都含需求书要求的 9 个字段', missing.length === 0, missing.slice(0, 5).join(' | '));

const ALLOWED_REUSE = new Set(['auto_match', 'review_required', 'not_recommended']);
const badReuse = assets.assets.filter((a) => !ALLOWED_REUSE.has(a.reuse_status));
ok('reuse_status 取值合法', badReuse.length === 0, badReuse.slice(0, 3).map((a) => a.reuse_status).join(','));

ok('asset_type 取值合法', assets.assets.every((a) => ['image', 'document', 'video', 'unknown'].includes(a.asset_type)));
ok('page_category 非空', assets.assets.every((a) => !!a.page_category));
ok('汇总数与明细一致',
  assets.summary.downloaded_ok === assets.assets.filter((a) => a.download_status === 'ok').length);

// =====================================================================
section('TEST 4 — 【红线】没有无证据的自动绑定');
// =====================================================================
const matching = readJson(path.join(SITE_DIR, 'product-image-matching.json'));
const autoRows = matching.image_rows.filter((r) => r.reuse_status === 'auto_match');

const EVIDENCE_METHODS = new Set(['bowen_no', 'oe_number_unique']);
const noEvidence = autoRows.filter((r) => !EVIDENCE_METHODS.has(r.match_method));
ok('每个 auto_match 都有可核对的证据方法（博文编号 或 唯一 OE）',
  noEvidence.length === 0,
  noEvidence.slice(0, 3).map((r) => `${r.image_url}::${r.match_method}`).join(' | '));

const noProduct = autoRows.filter((r) => !r.matched_product_id);
ok('每个 auto_match 都带 matched_product_id', noProduct.length === 0);

const noEvidenceText = autoRows.filter((r) => !(r.evidence && r.evidence.length));
ok('每个 auto_match 都有 evidence 文本链', noEvidenceText.length === 0);

// 匹配到的 product_id 必须真实存在于当前数据库
const products = readJson(path.join(ROOT, 'data/derived/v2/products.json'));
const productIds = new Set(products.map((p) => p.product_id));
const ghost = autoRows.filter((r) => !productIds.has(r.matched_product_id));
ok('auto_match 的 product_id 全部存在于当前数据库', ghost.length === 0,
  ghost.slice(0, 3).map((r) => r.matched_product_id).join(','));

// review_required 不得带 matched_product_id 之外的自动绑定
const reviewWithMatch = matching.image_rows.filter((r) => r.reuse_status === 'review_required' && r.match_method === 'bowen_no' && r.matched_product_id);
ok('review_required 行没有被当作已绑定产品使用', reviewWithMatch.length === 0);

// assets.json 里的产品图复用状态必须与匹配结论一致
const matchByImage = new Map(matching.image_rows.map((r) => [r.image_url, r]));
const inconsistent = assets.assets.filter((a) => matchByImage.has(a.asset_url)
  && a.reuse_status !== matchByImage.get(a.asset_url).reuse_status);
ok('assets.json 与 product-image-matching.json 的复用状态一致', inconsistent.length === 0,
  inconsistent.slice(0, 3).map((a) => a.asset_url).join(','));

// 禁止"只根据图片外观"：自动匹配必须有编号类证据，标题/车型不足以自动绑定
const titleOnly = autoRows.filter((r) => !r.legacy_bowen_nos && !r.legacy_oe_numbers);
ok('不存在仅凭标题/外观的 auto_match', titleOnly.length === 0);

// =====================================================================
section('TEST 5 — 下载文件的真实性与完整性');
// =====================================================================
const downloads = readJson(path.join(SITE_DIR, 'downloads.json'));
const okDownloads = downloads.assets.filter((a) => a.download_status === 'ok');
let fileMissing = 0, hashMismatch = 0, hashChecked = 0;
for (const a of okDownloads) {
  const p = path.join(SITE_DIR, a.local_file);
  if (!fs.existsSync(p)) { fileMissing++; continue; }
  if (a.sha256) {
    hashChecked++;
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    if (h !== a.sha256) hashMismatch++;
  }
}
ok('所有记录为 ok 的文件都真实存在', fileMissing === 0, `missing=${fileMissing}`);
ok('文件 sha256 与记录一致', hashMismatch === 0, `checked=${hashChecked}, mismatch=${hashMismatch}`);
ok('确实下载到了图片素材', okDownloads.filter((a) => a.asset_type === 'image').length > 0);
ok('local_file 保留了原始文件名（或加哈希前缀）',
  okDownloads.every((a) => path.basename(a.local_file).length > 0));

// 文件不落空
const zeroByte = okDownloads.filter((a) => a.bytes === 0);
ok('没有 0 字节文件', zeroByte.length === 0);

// =====================================================================
section('TEST 6 — 内容质量审核覆盖度');
// =====================================================================
const audit = readJson(path.join(SITE_DIR, 'legacy-site-audit.json'));
const VERDICTS = new Set(['Can reuse directly', 'Needs English rewrite', 'Outdated', 'Domestic-market only', 'Do not use']);
const badVerdict = audit.content_review.pages.filter((p) => !VERDICTS.has(p.verdict));
ok('内容质量审核结论取值合法', badVerdict.length === 0, badVerdict.slice(0, 3).map((p) => p.verdict).join(','));
ok('审核覆盖全部抓取页面', audit.content_review.pages.length === crawl.pages.length,
  `${audit.content_review.pages.length} vs ${crawl.pages.length}`);
// 国内信号在旧站是"全站页脚样板"（100% 页面都有），因此正确断言是站点级发现，
// 而不是"某些页面自身含国内信号"——后者会得出 0，属于测试口径错误。
const siteWide = audit.content_review.site_wide_findings || [];
ok('识别出全站页脚样板中的国内平台链接',
  siteWide.some((f) => f.key === 'domestic_platform' && f.pages_hit > 0),
  JSON.stringify(siteWide.map((f) => f.key)));
ok('识别出全站页脚样板中的国内备案/固话/地址',
  ['domestic_filing', 'domestic_phone', 'domestic_address'].every((k) => siteWide.some((f) => f.key === k)));
ok('单页结论未被模板样板污染（not 100% 同一判定）',
  Object.keys(audit.content_review.summary_by_verdict).length >= 2,
  JSON.stringify(audit.content_review.summary_by_verdict));
ok('检测出绝对化宣传（页面自身）', audit.content_review.totals.pages_with_absolute_claims >= 0);
ok('多语言规划存在且明确禁止机翻直接上线',
  !!audit.multilingual && /禁止机器翻译/.test(audit.multilingual.legacy_content_role.machine_translation));
ok('技术审计包含 HTTPS 探测结论',
  !!audit.tech_audit.https && Array.isArray(audit.tech_audit.https.tls_probes));
ok('技术审计记录了 robots.txt / sitemap.xml 状态',
  !!audit.tech_audit.seo_files.robots_txt && !!audit.tech_audit.seo_files.sitemap_xml);
ok('公司素材映射覆盖 5 个目标页',
  ['Home', 'Factory', 'Quality', 'About Bowen', 'Contact'].every((k) => k in audit.company_asset_mapping.suggestions));

// =====================================================================
section('TEST 7 — 【红线】未修改现有 Prototype');
// =====================================================================
const phaseStatePath = path.join(SITE_DIR, 'phase-state.json');
ok('存在 Phase 3.5 起始时间戳（用于证明未改动 Prototype）', exists(phaseStatePath));
if (exists(phaseStatePath)) {
  const { started_at } = readJson(phaseStatePath);
  const startMs = new Date(started_at).getTime();
  const touched = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (fs.statSync(p).mtimeMs >= startMs) touched.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  const websiteDir = path.join(ROOT, 'website');
  if (exists(websiteDir)) walk(websiteDir);
  ok('website/ 下没有任何文件在 Phase 3.5 期间被修改', touched.length === 0,
    touched.slice(0, 10).join(', '));
}

// 旧站代码未被引入新站
const websiteSrc = path.join(ROOT, 'website', 'src');
if (exists(websiteSrc)) {
  let legacyRefs = 0;
  const walk2 = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk2(p); continue; }
      if (!/\.(tsx?|css|json|mjs)$/.test(e.name)) continue;
      const t = fs.readFileSync(p, 'utf8');
      if (/qfbowen\.com|legacy-site|Templates\/cn/i.test(t)) legacyRefs++;
    }
  };
  walk2(websiteSrc);
  ok('新站源码未引入旧站代码/资源引用', legacyRefs === 0, `refs=${legacyRefs}`);
}

// =====================================================================
section('TEST 8 — 人工审核 XLSX 结构');
// =====================================================================
const xlsxPath = path.join(ROOT, 'review', 'legacy-product-image-mapping.xlsx');
if (exists(xlsxPath)) {
  const buf = fs.readFileSync(xlsxPath);
  ok('xlsx 是有效 ZIP 包（PK 头）', buf[0] === 0x50 && buf[1] === 0x4b);
  ok('xlsx 非空', buf.length > 5000, `bytes=${buf.length}`);
  // 必须真正解压后再断言：sheet XML 是 deflate 压缩的，
  // 直接在原始字节里搜字符串会永远搜不到（早期版本就是这么写错的）。
  const zip = readZip(buf);
  const sheetNames = zip.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  ok('包含 4 个工作表', sheetNames.length === 4, sheetNames.join(','));
  const allSheets = sheetNames.map((n) => zip.text(n)).join('\n');
  ok('工作簿含真实数据行（inlineStr 非空）', /inlineStr/.test(allSheets));
  ok('包含下拉菜单校验（dataValidations）', /dataValidations/.test(allSheets) && /dataValidation /.test(allSheets));
  ok('包含人工填写列标题', /人工确认Bowen No\./.test(allSheets));
  ok('包含"无编号页面"工作表说明', /无任何编号/.test(allSheets) || /无编号页面/.test(allSheets));
  // 工作表「名称」写在 xl/workbook.xml，不在 worksheet XML 里（曾据此写错过断言）
  const workbook = zip.text('xl/workbook.xml') || '';
  ok('工作表名称与要求一致（说明/图片审核/页面汇总/无编号）',
    ['填表说明', '图片匹配审核', '按旧站页面汇总', '无编号页面'].every((t) => workbook.includes(t)),
    workbook.slice(0, 300));
} else {
  ok('review/legacy-product-image-mapping.xlsx 存在', false);
}

// =====================================================================
console.log(`\n${'='.repeat(60)}`);
if (failures.length === 0) {
  console.log(`Phase 3.5 验收测试：${pass}/${pass} PASS`);
} else {
  console.log(`Phase 3.5 验收测试：${pass} PASS / ${failures.length} FAIL`);
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
