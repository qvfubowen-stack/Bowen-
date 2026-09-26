/**
 * Phase 3.5 / I —— 生成 docs/qfbowen-legacy-site-audit.md
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/build-legacy-audit-report.mjs
 *
 * 报告里所有数字都从 JSON 产物读取，不手写，避免报告与数据不一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(SITE_DIR, p), 'utf8'));

const crawl = readJson('crawl/pages.json');
const probes = readJson('crawl/probes.json');
const assets = readJson('assets.json');
const downloads = readJson('downloads.json');
const matching = readJson('product-image-matching.json');
const audit = readJson('legacy-site-audit.json');
const legacy = readJson('legacy-products.json');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/v2/products.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/derived/v2/stats.json'), 'utf8'));

const G = audit.tech_audit;
const C = audit.content_review;
const okAssets = assets.assets.filter((a) => a.download_status === 'ok');
const cnt = (pred) => okAssets.filter(pred).length;
const mb = (b) => (b / 1048576).toFixed(1);
const n = (x) => (x === null || x === undefined ? '—' : x);

const imgTotal = cnt((a) => a.asset_type === 'image');
const docTotal = cnt((a) => a.asset_type === 'document');
const vidTotal = cnt((a) => a.asset_type === 'video');
const brokenImg = downloads.assets.filter((a) => a.download_status === 'failed' && a.asset_type === 'image').length;
const excludedCtrl = downloads.assets.filter((a) => a.download_status === 'excluded_access_control').length;
const productImgs = cnt((a) => a.local_file.startsWith('images/products/'));
const factoryImgs = cnt((a) => a.local_file.startsWith('images/factory/'));
const certImgs = cnt((a) => a.local_file.startsWith('images/certificates/'));
const companyImgs = cnt((a) => a.local_file.startsWith('images/company/'));
const otherImgs = cnt((a) => a.local_file.startsWith('images/other/'));

const autoRows = matching.image_rows.filter((r) => r.reuse_status === 'auto_match');
const reviewRows = matching.image_rows.filter((r) => r.reuse_status === 'review_required');
const uniqueMatchedProducts = [...new Set(autoRows.map((r) => r.matched_product_id))];

const verdictOrder = ['Can reuse directly', 'Needs English rewrite', 'Outdated', 'Domestic-market only', 'Do not use'];
const verdictZh = {
  'Can reuse directly': '可直接复用（语言中立的技术数据）',
  'Needs English rewrite': '需英文重写',
  'Outdated': '已过时',
  'Domestic-market only': '仅适用于国内市场',
  'Do not use': '不可使用',
};

const md = [];
const w = (s = '') => md.push(s);
// Markdown 表格单元格转义：内容里的 | 和换行会破坏表格结构
const esc = (s) => String(s === null || s === undefined || s === '' ? '—' : s)
  .replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();

// =====================================================================
w('# qfbowen.com 现有官网资产迁移审计');
w();
w('> **Phase 3.5 交付物** · 生成时间 ' + audit.generated_at + ' · 来源站点 `' + crawl.origin + '`');
w();
w('**本次审计的目标**：从公司现有国内展示站 `www.qfbowen.com` 中提取**可复用的真实素材**，');
w('用于正在开发的海外 B2B 独立站。');
w();
w('**本次审计不做的事**：');
w();
w('- ❌ 不用旧站代码替换 Next.js 项目 —— 现有 Bowen Website Prototype 仍是技术底座');
w('- ❌ 不修改任何现有 Prototype 文件（见 TEST 7，`website/` 目录零改动）');
w('- ❌ 不自动把任何中文内容上线到英文站');
w('- ❌ 不绕过登录、验证码或任何访问权限；只抓公开页面（见 TEST 2）');
w();
w('---');
w();

// =====================================================================
// 一、十二个问题的直接回答
// =====================================================================
w('## 一、直接回答需求书的 12 个问题');
w();
w('| # | 问题 | 结论 |');
w('|---|---|---|');
w(`| 1 | 共抓到多少页面 | **${crawl.pages.length} 个公开页面** |`);
w(`| 2 | 共发现多少图片 | **${crawl.discovered_asset_url_count} 个素材 URL**，全部为图片（成功下载 ${imgTotal} 张；${brokenImg} 张在旧站本身已是 404 死链；${excludedCtrl} 张为验证码图片，按合规要求不下载） |`);
w(`| 3 | 产品图片多少 | **${productImgs} 张**（按"被产品页引用"归类，不是按上传路径——见下方说明） |`);
w(`| 4 | 工厂图片多少 | **${factoryImgs} 张**（厂房厂貌 + 生产设备栏目） |`);
w(`| 5 | 证书图片多少 | **${certImgs} 张**（荣誉资质栏目下的证书扫描件） |`);
w(`| 6 | 成功匹配到 Bowen 产品的图片 | **${autoRows.length} 张**（覆盖 **${uniqueMatchedProducts.length} 个当前产品**；旧站 ${matching.page_summaries.filter((p) => p.matched_product_id).length} 个产品页有编号可直接对应） |`);
w(`| 7 | 多少需要人工确认 | **${reviewRows.length} 张**产品图片需人工确认（另有全部公司/证书类素材同样待确认） |`);
w(`| 8 | 哪些内容值得迁移 | 见 [第四节](#四d-产品图片匹配结果) 与 [第六节](#六e-公司素材映射建议) |`);
w(`| 9 | 哪些内容不建议迁移 | 见 [第八节第 9 条](#9-哪些内容不建议迁移) |`);
w(`| 10 | Prototype 建议替换哪些占位内容 | 见 [第九节](#九对现有-prototype-的建议不立即执行) |`);
w(`| 11 | 旧站代码是否值得复用 | **不值得复用**，见 [第十节](#十旧站代码是否值得复用结论不值得) |`);
w(`| 12 | 下一步资产迁移建议 | 见 [第十一节](#十一下一步资产迁移建议) |`);
w();
w('> ⚠️ **一句话总结**：旧站有真实可用的**产品照片、工厂照片和证书图片**，');
w(`> 但 ${reviewRows.length} 张产品图因旧站页面本身没写编号而**无法自动对应**产品，必须人工确认。`);
w('> 旧站代码、HTTP 协议、国内联系方式与营销文案**一律不建议迁移**。');
w();
w('---');
w();

// =====================================================================
// 二、A. 抓取范围与方法
// =====================================================================
w('## 二、A. 抓取范围与方法');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 站点根地址 | \`${crawl.origin}\` |`);
w(`| 成功抓取页面 | **${crawl.pages.length}** |`);
w(`| 抓取尝试次数 | ${crawl.fetch_attempts} |`);
w(`| 跳过/失败 | ${crawl.failed_or_skipped.length}（旧站自定义 404 页不计入） |`);
w(`| 发现的素材 URL | ${crawl.discovered_asset_url_count} |`);
w(`| 服务器 | ${probes.homeHeaders.contentType} · Microsoft-IIS/10.0 · ASP.NET（AspCms 建站系统） |`);
w(`| 页面编码 | UTF-8（\`charset=utf-8\`，实测无乱码） |`);
w();
w('**抓取到的页面构成（按栏目）**：');
w();
w('| 栏目类型 | 页面数 |');
w('|---|---|');
for (const [k, v] of Object.entries(G.page_inventory.by_coarse_category).sort((a, b) => b[1] - a[1])) {
  const zh = { product: '产品', company: '公司介绍', certificate: '证书/荣誉', news: '新闻', factory: '工厂/设备', contact: '联系方式', other: '其它' }[k] || k;
  w(`| ${zh}（${k}） | ${v} |`);
}
w();
w('**抓取边界（硬编码在爬虫里）**：');
w();
w('- 只发送 GET 请求，不携带 Cookie、不提交任何表单（`/gbook` 留言页只读、绝不写入）');
w('- 明确排除 `/admin`、`/manage`、`/login`、`/search`、`/Templates`、`/upLoad` 等路径');
w('- 并发 3、每请求间隔 220ms、失败最多重试 3 次 —— 避免影响旧站正常访问');
w('- 遇到 HTTP 404 的自定义错误页直接丢弃，不当作页面收录');
w();
w('**记录到的字段**（每个页面）：URL、Page Title、Meta Description、Meta Keywords、H1/H2/H3、');
w('主要正文、图片 URL、视频、PDF/下载、canonical、robots meta、引用资源、外链、国内站特征信标。');
w();
w('---');
w();

// =====================================================================
// 三、B/C. 素材下载与资产清单
// =====================================================================
w('## 三、B / C. 素材下载与资产清单');
w();
w('### 下载结果');
w();
w('| 目录 | 文件数 | 说明 |');
w('|---|---|---|');
w(`| \`data/legacy-site/images/products/\` | ${productImgs} | 产品图（被产品页引用） |`);
w(`| \`data/legacy-site/images/factory/\` | ${factoryImgs} | 工厂 / 设备 / 厂房 |`);
w(`| \`data/legacy-site/images/certificates/\` | ${certImgs} | 证书 / 荣誉扫描件 |`);
w(`| \`data/legacy-site/images/company/\` | ${companyImgs} | 公司外景 / 企业文化图 |`);
w(`| \`data/legacy-site/images/other/\` | ${otherImgs} | 模板装饰件、首页混合内容、全站 Banner、图标 |`);
w(`| \`data/legacy-site/documents/\` | ${docTotal} | PDF / Office 下载文件 |`);
w(`| **合计** | **${okAssets.length}** | 共 ${mb(assets.summary.total_bytes)} MB |`);
w();
w(`> ⚠️ **旧站没有任何 PDF、Office 文档或视频**（下载结果里 documents = ${docTotal}、videos = ${vidTotal}）。`);
w('> 也就是说旧站**无法提供**英文样本册、检测报告、证书 PDF 等文件类素材 —— 这类素材需要公司另行提供。');
w();
w(`下载未成功 ${assets.summary.download_failed} 个：其中 **${brokenImg} 个是旧站自身的 404 死链**（页面引用了不存在的图片），`);
w(`**${excludedCtrl} 个是验证码图片**（`+'`/inc/checkcode.asp`'+`，按"不绕过访问控制"的要求不下载）。`);
w('逐条清单见 `downloads.json` 的 `assets` 字段。');
w();
w('### ⚠️ 分类方法上的一个重要事实');
w();
w('旧站把**所有**上传图片都塞进同一个 `/upLoad/product/month_XXXX/` 目录 —— ');
w('产品图、证书扫描件、厂房照片、甚至公司照片全在里面。因此：');
w();
w('- ❌ **不能**用 URL 路径判断一张图是产品图还是证书图');
w('- ✅ 本审计改用**"这张图被哪一类页面引用"**作为主证据（并用文件名特征与实测尺寸识别装饰件）');
w();
w('**保留策略**：每个文件都保留了**原始文件名**；同名不同 URL 时加 URL 哈希前缀，');
w('并且 `assets.json` 里同时记录了 `asset_url`（原始 URL）与 `source_url`（它出现在哪个页面），可完整回溯。');
w();
w('### assets.json 资产清单');
w();
w('路径：`data/legacy-site/assets.json`，包含需求书要求的全部字段：');
w();
w('```');
w(assets.field_spec.join(', '));
w('```');
w();
w('**reuse_status 分布**：');
w();
w('| reuse_status | 数量 | 含义 |');
w('|---|---|---|');
w(`| \`auto_match\` | ${assets.summary.by_reuse_status.auto_match || 0} | 旧站页面写明的编号在当前数据库唯一命中，可自动对应 |`);
w(`| \`review_required\` | ${assets.summary.by_reuse_status.review_required || 0} | 证据不足或有歧义，必须人工确认 |`);
w(`| \`not_recommended\` | ${assets.summary.by_reuse_status.not_recommended || 0} | 不建议迁移（模板装饰、图标、二维码等） |`);
w();
w('**图片格式与尺寸分布**（技术审计视角）：');
w();
w('| 格式 | 数量 |');
w('|---|---|');
for (const [k, v] of Object.entries(G.images.format_distribution).sort((a, b) => b[1] - a[1])) w(`| ${k} | ${v} |`);
w();
w('| 宽度区间 | 数量 |');
w('|---|---|');
for (const [k, v] of Object.entries(G.images.width_distribution)) w(`| ${k} | ${v} |`);
w();
w(`平均文件大小 ${(G.images.avg_bytes / 1024).toFixed(0)} KB；宽度 ≥1600px 的有 ${G.images.oversized_ge_1600} 张。`);
w();
w('---');
w();

// =====================================================================
// 四、D. 产品图片匹配结果
// =====================================================================
w('## 四、D. 产品图片匹配结果');
w();
w('### 匹配依据（严格按需求书优先级）');
w();
w('1. **Bowen No.** —— 旧站产品页规格表里的「博文编号」列（2024 年新建的产品页有这个表）');
w('2. 产品编号');
w('3. **OE Number** —— 规格表里的「OEM号码」列');
w('4. 产品标题');
w('5. 原网页 URL');
w();
w('### 自动化红线的执行情况');
w();
w('> **禁止只根据图片外观猜产品。** 程序只承认两类证据，其余一律 `review_required`，绝不自动绑定：');
w();
w('- ✅ 旧站页面**明确写明**博文编号，且在冻结数据库中**唯一命中** → `auto_match`');
w('- ✅ 旧站页面写明的 OEM 号码在数据库中**唯一命中**一个产品 → `auto_match`');
w('- ⛔ 一个 OE 命中多个产品（数据库里确实存在 **' + stats.shared_oe_across_products_count + ' 个共享 OE**）→ `review_required`');
w('- ⛔ 页面没有编号、只有中文标题与车型 → `review_required`');
w();
w('### 匹配结果');
w();
const matchedPages = matching.page_summaries.filter((p) => p.matched_product_id);
const methodDist = matching.page_summaries.reduce((m, p) => { m[p.match_method] = (m[p.match_method] || 0) + 1; return m; }, {});
const methodZh = {
  bowen_no: '博文编号唯一命中',
  oe_number_unique: 'OEM 号码唯一命中',
  bowen_no_unresolved: '博文编号在数据库中不存在（待确认）',
  oe_number_unresolved: 'OEM 号码在数据库中不存在（待确认）',
  oe_number_ambiguous: 'OEM 号码为多个产品共享（待裁决）',
  none: '页面没有任何编号信息（待人工对应）',
};
w('| 旧站产品页的匹配情况 | 页面数 |');
w('|---|---|');
for (const [k, v] of Object.entries(methodDist).sort((a, b) => b[1] - a[1])) {
  w(`| ${methodZh[k] || k} | ${v} |`);
}
w(`| **合计** | **${matching.page_summaries.length}** |`);
w();
w('| 指标 | 数量 |');
w('|---|---|');
w(`| 旧站产品详情页 | ${legacy.product_detail_page_count} |`);
w(`| 其中有规格表 | ${legacy.with_spec_table} |`);
w(`| 其中写明博文编号 | ${legacy.with_bowen_no} |`);
w(`| 其中只有 OEM 号码 | ${legacy.with_oe_only} |`);
w(`| **完全没有编号信息** | **${legacy.with_no_structured_fields}** |`);
w(`| 成功对应到当前产品的旧站页面 | **${matchedPages.length}** |`);
w(`| 产品图片总数（去重后） | ${matching.legacy_product_image_count} |`);
w(`| ✅ 自动匹配（有编号证据） | **${autoRows.length}** |`);
w(`| ⚠️ 需人工确认 | **${reviewRows.length}** |`);
w(`| 自动匹配覆盖的不同产品数 | ${uniqueMatchedProducts.length} |`);
w();
w('> **为什么"匹配到产品的页面数"（' + matchedPages.length + '）大于"自动匹配的图片数"（' + autoRows.length + '）？');
w('> 因为旧站把同一个产品在「产品中心」和「系列产品」两个栏目下重复发布，');
w('> 两条记录指向同一张图和同一个博文编号。按"一张图 + 一个产品"去重后，');
w(`> ${matchedPages.length} 条页面记录收敛为 **${autoRows.length} 张不同图片 / ${uniqueMatchedProducts.length} 个不同产品**。`);
w('> 这是旧站自身的重复发布问题，不是匹配遗漏。');
w();
if (autoRows.length) {
  w('### 自动匹配到的产品（可自动绑定的部分）');
  w();
  w('| 旧站页面 | 旧站博文编号 | 旧站 OEM | 匹配方式 | product_id | 产品英文名 |');
  w('|---|---|---|---|---|---|');
  const seenP = new Set();
  for (const r of autoRows) {
    if (seenP.has(r.matched_product_id)) continue;
    seenP.add(r.matched_product_id);
    w(`| [${r.legacy_page_id}](${r.source_url}) | ${esc(r.legacy_bowen_nos)} | ${esc((r.legacy_oe_numbers || '').slice(0, 40))} | ${r.match_method} | \`${r.matched_product_id}\` | ${esc(r.matched_product_name_en)} |`);
  }
  w();
}
w('### 为什么有这么多需要人工确认');
w();
w(`旧站 ${legacy.product_detail_page_count} 个产品详情页里，只有 ${legacy.with_bowen_no} 个写了「博文编号」，`);
w(`${legacy.with_no_structured_fields} 个页面**既没有博文编号也没有 OEM 号码** —— 只有一张详情图和一个中文产品名（例如多个页面标题都是「节温器」）。`);
w('在这种情况下，任何"看起来像"的判断都是在猜，因此程序全部标为 `review_required`。');
w();
w('### 人工确认表');
w();
w('路径：**`review/legacy-product-image-mapping.xlsx`**（4 个工作表）');
w();
w('| 工作表 | 内容 |');
w('|---|---|');
w('| 填表说明 | 怎么填、颜色约定、红线说明 |');
w(`| 图片匹配审核 | ${matching.legacy_product_image_count} 张图片逐张核对（含人工确认列 + 下拉菜单） |`);
w(`| 按旧站页面汇总 | ${matching.page_summaries.length} 个旧站页面汇总 |`);
w(`| 无编号页面 | ${legacy.with_no_structured_fields} 个无任何编号的页面，优先人工处理 |`);
w();
w('🟡 黄色列 = 手工填写 ｜ 🟢 绿色列 = 下拉选择 ｜ 🔴 红色标记 = `auto_match` 重点抽查项');
w();
w('---');
w();

// =====================================================================
// 五、E. 公司素材映射建议
// =====================================================================
w('## 五、E. 公司素材映射建议');
w();
w('> **只做映射建议，不替换任何网页。**');
w();
w('| 目标页面 | 当前状态 | 建议来源素材 | 注意事项 |');
w('|---|---|---|---|');
const M = audit.company_asset_mapping.suggestions;
for (const key of ['Home', 'Factory', 'Quality', 'About Bowen', 'Contact']) {
  const s = M[key];
  w(`| **${key}** | ${esc(s.current_state)} | ${s.candidates.length} 个候选素材 | ${esc(s.caution)} |`);
}
w();
w('### 逐页说明');
w();
for (const key of ['Home', 'Factory', 'Quality', 'About Bowen', 'Contact']) {
  const s = M[key];
  w(`#### ${key}`);
  w();
  w(`- **目标页面**：\`${s.target_page}\``);
  w(`- **现状**：${s.current_state}`);
  w(`- **建议**：${s.recommendation}`);
  w(`- **注意**：${s.caution}`);
  if (s.candidates.length) {
    w(`- **候选素材**（前 ${Math.min(s.candidates.length, 8)} 个）：`);
    for (const c of s.candidates.slice(0, 8)) {
      w(`  - \`${c.local_file}\`${c.dim ? ` (${c.dim})` : ''} — ${esc(c.note)}`);
    }
  }
  w();
}
w('### 明确不建议迁移的公司素材');
w();
w(`共 ${audit.company_asset_mapping.not_recommended.count} 个。原因：${audit.company_asset_mapping.not_recommended.reason}`);
w();
for (const e of audit.company_asset_mapping.not_recommended.examples.slice(0, 10)) {
  w(`- \`${e.local_file}\` — ${e.note}`);
}
w();
w('---');
w();

// =====================================================================
// 六、F. 内容质量审核
// =====================================================================
w('## 六、F. 内容质量审核');
w();
w('对全部 ' + C.pages.length + ' 个抓取页面逐页做了内容质量判定。');
w();
w('| 分类 | 页面数 | 说明 |');
w('|---|---|---|');
for (const v of verdictOrder) {
  w(`| ${verdictZh[v]} | ${C.summary_by_verdict[v] || 0} | ${{
    'Can reuse directly': '语言中立的技术数据（编号/温度），可直接使用',
    'Needs English rewrite': '中文文案需人工重写为英文，不能直译',
    'Outdated': '含过期信息（发布时间过久或证书失效）',
    'Domestic-market only': '国内平台链接 / 备案号 / 国内电话地址',
    'Do not use': '绝对化宣传、模板缺陷、无实质内容',
  }[v]} |`);
}
w();
w('### 特别检查项（需求书指定）');
w();
w('#### ① 站点级问题：全站页脚/模板样板（**每一页都有**）');
w();
w('> 旧站的页脚与侧栏模板把下列内容注入到**全部 ' + C.pages.length + ' 个页面**。');
w('> 它们不是某一页的内容，而是"整站都带着"的问题 —— 迁移时只要不照搬模板即可一次性消除。');
w();
w('| 检查项 | 命中页面数 | 占比 | 判定 |');
w('|---|---|---|---|');
for (const f of (C.site_wide_findings || [])) {
  w(`| ${esc(f.label)} | ${f.pages_hit} / ${f.pages_total} | **${f.pct}%** | ${f.verdict} |`);
}
w();
w('#### ② 页面自身的问题（已剔除上面这些全站样板）');
w();
w('| 检查项 | 命中页面数 |');
w('|---|---|');
w(`| 夸张营销语 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'marketing_fluff')).length} |`);
w(`| 绝对化宣传 | ${C.totals.pages_with_absolute_claims} |`);
w(`| 国内平台链接 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'domestic_platform')).length} |`);
w(`| 国内备案信息 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'domestic_filing')).length} |`);
w(`| 旧联系方式（国内电话） | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'domestic_phone')).length} |`);
w(`| 旧地址 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'domestic_address')).length} |`);
w(`| 无法证明的数据 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'unverifiable_claim')).length} |`);
w(`| 已过时（发布时间/证书有效期） | ${C.totals.pages_outdated} |`);
w(`| 模板未渲染占位符 | ${C.pages.filter((p) => p.issues.some((i) => i.key === 'template_bug')).length} |`);
w();
if (C.notable_pages && C.notable_pages.absolute_claims.length) {
  w('**命中绝对化宣传的页面**（需在英文站改写成事实型表达）：');
  w();
  for (const p of C.notable_pages.absolute_claims) {
    w(`- [${p.url}](${p.url}) —— 命中样本：${esc(p.samples.join('、'))}`);
  }
  w();
}
w('**发布时间分布**（判断旧站维护活跃度）：');
w();
w('| 发布年份 | 页面数 |');
w('|---|---|');
for (const [y, c] of Object.entries(C.published_year_distribution || {}).sort((a, b) => String(b[0]).localeCompare(String(a[0])))) {
  w(`| ${y} | ${c} |`);
}
w();
w('> 说明：' + audit.content_review.method_note);
w();
w('### 旧站在用的公司联系方式（供业务方核对，**不直接搬上英文站**）');
w();
w('| 项目 | 旧站公开值 |');
w('|---|---|');
const idn = audit.company_identity;
w(`| 公司中文全称 | ${(idn.company_zh || []).join('、') || '—'} |`);
w(`| 电话 | ${(idn.phone || []).join('、') || '—'} |`);
w(`| 邮箱 | ${(idn.email || []).join('、') || '—'} |`);
w(`| 地址 | ${(idn.address || []).join('、') || '—'} |`);
w(`| 联系人 | ${(idn.contact_person || []).join('、') || '—'} |`);
w(`| ICP 备案号 | ${(idn.icp || []).join('、') || '—'} |`);
w();
w('> 这些是**国内渠道**信息。英文站是否公开固话/中文地址，需要业务方决定；');
w('> 其中"公司中文全称"可作为注册主体事实核对来源。');
w();
w('### 逐页审核明细');
w();
w('<details>');
w('<summary>点击展开全部 ' + C.pages.length + ' 个页面的判定（含命中样本）</summary>');
w();
w('| 页面 | 栏目 | 判定 | 原因 | 命中样本 |');
w('|---|---|---|---|---|');
for (const p of C.pages) {
  const samples = p.issues.flatMap((i) => i.samples).slice(0, 4).join('、');
  w(`| [${p.name}](${p.url}) | ${p.fine} | ${verdictZh[p.verdict]} | ${esc(p.rationale)} | ${esc(samples)} |`);
}
w();
w('</details>');
w();
w('---');
w();

// =====================================================================
// 七、G. 技术审计
// =====================================================================
w('## 七、G. 技术审计（只用于了解旧站）');
w();
w('### 页面与规模');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 页面总数 | ${G.page_inventory.total_pages} |`);
w(`| HTML 总字节 | ${(G.page_inventory.html_total_bytes / 1048576).toFixed(2)} MB |`);
w(`| 平均每页 HTML | ${(G.page_inventory.avg_html_bytes / 1024).toFixed(1)} KB |`);
w();
w('### 移动端表现');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 有 viewport meta 的页面 | **${G.mobile.viewport_meta_pages} / ${G.page_inventory.total_pages}** |`);
w(`| 无 viewport 的页面 | ${G.mobile.pages_without_viewport} |`);
w(`| 含媒体查询的 CSS | ${G.mobile.css_with_media_queries.length} / ${G.mobile.css_checked}（抽查） |`);
w();
if (G.mobile.viewport_meta_pages === 0) {
  w('> 🔴 **旧站没有任何页面声明 viewport**，移动端属于"缩小版桌面站"，不可作为移动体验参考。');
  w();
}
w('### 图片');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 图片数 | ${G.images.image_count} |`);
w(`| 图片总大小 | ${mb(G.images.total_bytes)} MB |`);
w(`| 平均大小 | ${(G.images.avg_bytes / 1024).toFixed(0)} KB |`);
w(`| 宽度 ≥1600px | ${G.images.oversized_ge_1600} |`);
w();
w('最大的 10 张图（"来源页面类别"是它出现在哪类页面；"复用状态"才是能否上英文站）：');
w();
w('| 文件 | 尺寸 | 大小 | 来源页面类别 | 复用状态 |');
w('|---|---|---|---|---|');
for (const i of G.images.largest) w(`| \`${i.local_file}\` | ${i.dim || '—'} | ${(i.bytes / 1024).toFixed(0)} KB | ${i.source_page_category || '—'} | ${i.reuse_status || '—'} |`);
w();
w('### URL 结构');
w();
w('| 形态 | 说明 |');
w('|---|---|');
for (const p of G.url_structure.patterns) w(`| \`${p.pattern}\` | ${p.note} |`);
w();
w(`${G.url_structure.note}`);
w();
w('### Meta / SEO 文件');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 有 Title | ${G.meta.pages_with_title} / ${G.page_inventory.total_pages} |`);
w(`| 有 Description | ${G.meta.pages_with_description} / ${G.page_inventory.total_pages} |`);
w(`| Description 是未渲染模板占位符 | ${G.meta.pages_with_broken_description.length} |`);
w(`| 有 H1 | ${G.meta.pages_with_h1} / ${G.page_inventory.total_pages} |`);
w(`| H1 多于 1 个的页面 | ${G.meta.pages_with_multiple_h1} |`);
w(`| 重复 Title | ${G.meta.duplicate_title_count} |`);
w(`| \`rel=canonical\` | **${G.seo_files.canonical_pages}**（${G.seo_files.canonical_note}） |`);
w(`| \`robots.txt\` | HTTP **${G.seo_files.robots_txt.status}**（不存在） |`);
w(`| \`sitemap.xml\` | HTTP **${G.seo_files.sitemap_xml.status}**（不存在） |`);
w();
w('示例 Title（注意关键词堆砌）：');
w();
for (const t of G.meta.sample_titles.slice(0, 4)) w(`- \`${t}\``);
w();
w('### HTTPS');
w();
w('| 探测目标 | 结果 |');
w('|---|---|');
for (const t of G.https.tls_probes) w(`| \`${t.servername}:443\` | **${t.result}**${t.protocol ? ` (${t.protocol})` : ''} |`);
w(`| HTTP → HTTPS 跳转 | ${G.https.http_redirects_to_https ? '有' : '**无**'}（HTTP 直接返回 ${G.https.http_status}） |`);
w();
w(`> ${G.https.note}`);
w();
w('### 页面加载资源');
w();
w('| 项目 | 值 |');
w('|---|---|');
w(`| 独立 CSS 文件 | ${G.page_resources.unique_css} |`);
w(`| 独立静态 JS 文件 | ${G.page_resources.unique_js_static} |`);
w(`| 每页一个的访问计数脚本 | ${G.page_resources.per_page_counter_scripts} |`);
w(`| CSS 总字节 | ${(G.page_resources.total_css_bytes / 1024).toFixed(0)} KB |`);
w(`| JS 总字节 | ${(G.page_resources.total_js_bytes / 1024).toFixed(0)} KB |`);
w();
w(`${G.page_resources.note}`);
w();
w('### 统计与第三方脚本');
w();
w('| 项目 | 页面数 |');
w('|---|---|');
w(`| 百度统计 | ${G.tracking.baidu_analytics_pages} |`);
w(`| Google Analytics | ${G.tracking.google_analytics_pages} |`);
w(`| 1688 平台链接 | ${G.tracking.platform_1688_pages} |`);
w(`| ICP 备案号 | ${G.tracking.icp_pages} |`);
w();
w('外链（前 20）：');
w();
for (const l of G.external_links.slice(0, 20)) w(`- ${l}`);
w();
w('---');
w();

// =====================================================================
// 八、第 8 / 9 条
// =====================================================================
w('## 八、值得迁移 vs 不建议迁移');
w();
w('### 8. 哪些旧站内容值得迁移');
w();
w('| 优先级 | 内容 | 规模 | 去向 |');
w('|---|---|---|---|');
w(`| 🥇 最高 | **产品实拍图** | ${productImgs} 张（其中 ${autoRows.length} 张已可自动对应产品） | 产品详情页 / 产品卡（替换现在的 "Photo pending" 占位） |`);
w(`| 🥈 高 | **工厂与设备照片** | ${factoryImgs} 张 | Factory 页四个工序配图 |`);
w(`| 🥈 高 | **证书 / 荣誉图片** | ${certImgs} 张 | Quality 页（逐张核对有效期后） |`);
w(`| 🥉 中 | **公司外景 / 厂区照片** | ${companyImgs} 张 | About / Home 增强真实感 |`);
w(`| 🥉 中 | **产品技术数据**（OE 号、适用车型、温度） | ${legacy.with_spec_table} 个页面有规格表 | 英文站产品数据结构（语言中立，可直接用） |`);
w(`| ⚪ 低 | 公司注册主体事实（中文全称） | ${(idn.company_zh || []).length} 处 | Contact 页核对用 |`);
w();
w('### 9. 哪些内容不建议迁移');
w();
w('| 内容 | 原因 |');
w('|---|---|');
w('| **旧站代码 / 模板 / CSS / JS** | IIS + ASP.NET(AspCms)、表格布局、jQuery + Bootstrap + Owl Carousel，与 Next.js 15 技术栈完全冲突 |');
w('| **中文营销文案** | 国内腔调，直译不可信；需按英文 B2B 习惯重写 |');
w(`| **绝对化宣传用语** | 命中 ${C.totals.pages_with_absolute_claims} 个页面，海外合规与可信度双重风险 |`);
w('| **国内平台链接**（1688 / 阿里巴巴 / 百度） | 对海外采购商无意义 |');
w('| **ICP 备案号** | 只在中国大陆适用 |');
w('| **国内固话 / 中文地址** | 海外客户无法拨打；地址需英文规范格式 |');
w('| **含中文字的 Banner / 宣传图** | 必须重做英文版，不能原样上站 |');
w('| **模板装饰件、图标、二维码、加载图** | 无价值或带来品牌风险 |');
w(`| **过时内容** | ${C.totals.pages_outdated} 个页面命中发布时间过久或证书有效期已过 |`);
w('| **未渲染的模板占位符内容** | 旧站模板缺陷（如 `[about:desc]`），内容本身无效 |');
w('| **HTTPS / HTTP 头配置方式** | 旧站 HTTPS 不可用，无任何可借鉴价值 |');
w();
w('---');
w();

// =====================================================================
// 九、第 10 条
// =====================================================================
w('## 九、对现有 Prototype 的建议（**不立即执行**）');
w();
w('> 以下只是建议。本阶段**没有修改** Prototype 的任何文件（TEST 7 已验证）。');
w();
w('### 现状：Prototype 目前没有任何真实照片');
w();
w('检查 `website/` 目录后确认：');
w();
w('- `website/public/` 目录**不存在** —— 站点没有任何图片资源');
w('- `ProductVisual.tsx` 在产品无图时渲染一个 "Photo pending" 的 SVG 占位符');
w('- 三个页面上明确标注了占位（Placeholder）');
w();
w('### 建议替换的占位内容');
w();
w('| # | 位置 | 现在的占位 | 建议用旧站素材替换为 | 前置条件 |');
w('|---|---|---|---|---|');
w('| 1 | `website/src/components/ProductVisual.tsx` | 全站产品的 "Photo pending" SVG 圆环 | 旧站产品实拍图 | 先完成 `review/legacy-product-image-mapping.xlsx` 人工确认 |');
w('| 2 | `website/src/app/(site)/factory/page.tsx` | 四个工序（Machining / Assembly / Automated Assembly / Testing）**纯文字无图** | 旧站「厂房厂貌」「生产设备」照片 | 逐张确认照片确实对应所标工序 |');
w('| 3 | `website/src/app/(site)/quality/page.tsx` | "Placeholder — pending confirmation from the quality department" | 旧站「荣誉资质」证书图片 | **必须**先核对证书有效期与适用范围 |');
w('| 4 | `website/src/app/(site)/contact/page.tsx` | "Company details — pending"：公司注册信息、电话、地址、地图 | 旧站可提供注册公司全称等事实 | 需业务方决定国内联系方式是否对海外公开 |');
w('| 5 | `website/src/app/(site)/page.tsx`（首页） | 文字 + SVG 版式，无照片 | 公司外景 / 厂区照片 | 含中文的 Banner 必须重做 |');
w('| 6 | `website/src/app/(site)/about/page.tsx` | 公司事实齐全，配图为空 | 公司外景 / 厂区照片 | 中文简介只能作事实核对，不可直译 |');
w();
w('### 建议的实施顺序（等业务方确认后另行立项）');
w();
w('1. 业务方完成 `review/legacy-product-image-mapping.xlsx` 中的人工确认');
w('2. 把确认后的产品图压缩、转 WebP/AVIF，放入 `website/public/products/`');
w('3. 只更新 `website/src/data/` 的数据集（`image` 字段），**不改页面组件逻辑**');
w('4. Factory / Quality / About 的图片接入单独做一轮，逐张确认后再替换');
w();
w('---');
w();

// =====================================================================
// 十、第 11 条
// =====================================================================
w('## 十、旧站代码是否值得复用？——结论：不值得');
w();
w('**结论：一行都不建议复用。** 只复用"素材和事实"，不复用"代码和架构"。');
w();
w('### 客观依据');
w();
w('| 维度 | 旧站实际情况 | 与新站的关系 |');
w('|---|---|---|');
w(`| 服务端 | Microsoft-IIS/10.0 + ASP.NET，建站系统 AspCms | 新站是 Next.js 15 + TypeScript，技术栈完全不同 |`);
w(`| HTML 结构 | ${G.code_quality.missing_html_tag} 个页面**连 \`<html>\` 标签都没有**；${G.code_quality.missing_lang_attr} 个页面无 \`lang\` 属性 | 结构本身有缺陷 |`);
w(`| 布局方式 | ${G.code_quality.table_layout_pages} 个页面使用表格布局，${G.code_quality.inline_style_pages} 个页面大量内联样式 | 与响应式 CSS Module 方案冲突 |`);
w(`| 前端库 | ${Object.entries(G.code_quality.libraries).map(([k, v]) => `${k}(${v}页)`).join('、')} | 老旧依赖，与 React 无互补性 |`);
w(`| 移动端 | ${G.mobile.viewport_meta_pages} 个页面声明 viewport | 无任何移动端方案可借鉴 |`);
w(`| URL 设计 | 全部是数字 ID（\`/content/?925.html\`），无语义、无多语言前缀 | 新站要 /en /zh /es，旧 URL 不可继承 |`);
w(`| SEO | 无 canonical、无 robots.txt、无 sitemap.xml，Title 关键词堆砌 | 新站必须从零建立 SEO 体系 |`);
w(`| 协议 | HTTPS 不可用 | 新站必须全程 HTTPS |`);
w(`| 模板质量 | ${G.code_quality.template_placeholders_pages} 个页面残留未渲染占位符 ${G.code_quality.template_placeholders.map((p) => `\`${p}\``).join('、')} | 说明站点维护质量不高 |`);
w();
w('### 但旧站有三样东西必须保留下来');
w();
w('1. **真实素材**：产品照片、工厂照片、证书图片（已全部下载到 `data/legacy-site/`）');
w('2. **事实数据**：产品规格表里的 OE 号、适用车型、温度参数（语言中立）');
w('3. **产品与页面的对应关系**：哪个产品对应哪张图，这层关系是人工审核表的输入');
w();
w('---');
w();

// =====================================================================
// 十一、H. 多语言迁移规划（第 12 条前置）
// =====================================================================
w('## 十一、H. 多语言迁移规划');
w();
w('### 目标结构');
w();
w('| 语言 | 路径 | 本阶段是否实施 |');
w('|---|---|---|');
w('| 英文 | `/en/`（默认） | ✅ **只做这个** |');
w('| 中文 | `/zh/` | ⏸ 预留结构，不实施 |');
w('| 西班牙文 | `/es/` | ⏸ 预留结构，不实施 |');
w();
w('### 中文旧站内容的定位');
w();
w('> ' + audit.multilingual.legacy_content_role.zh_source_use);
w();
w('> **' + audit.multilingual.legacy_content_role.machine_translation + '**');
w();
w('依据：' + audit.multilingual.legacy_content_role.evidence);
w();
w('### 建议的实现方式');
w();
w('| 项目 | 建议 |');
w('|---|---|');
for (const [k, v] of Object.entries(audit.multilingual.recommended_structure)) {
  const label = { routing: '路由', redirects: '重定向', hreflang: 'hreflang / canonical', content_model: '内容模型', fallback: '缺失语言兜底' }[k] || k;
  w(`| ${label} | ${v} |`);
}
w();
w('### 素材的多语言处理');
w();
w(`- **图片**：${audit.multilingual.assets.images}`);
w(`- **文档**：${audit.multilingual.assets.documents}`);
w();
w('---');
w();

// =====================================================================
// 十二、下一步（第 12 条）
// =====================================================================
w('## 十二、下一步资产迁移建议');
w();
w('### 业务方需要做的事（按优先级）');
w();
w('| # | 事项 | 为什么必须由人来做 |');
w('|---|---|---|');
w(`| 1 | 填写 **\`review/legacy-product-image-mapping.xlsx\`**（${reviewRows.length} 张待确认） | 旧站页面没写编号，程序无法核对，只能人工对应 |`);
w(`| 2 | 核对证书有效期 | 已过期证书不能上站，程序只能标记不能裁决 |`);
w('| 3 | 决定国内联系方式是否对海外公开 | 涉及公司对外口径，不是技术问题 |');
w('| 4 | 确认工厂照片与工序的对应关系 | 标错工序等于向客户提供错误信息 |');
w('| 5 | 提供英文公司名与英文地址 | 英文站必需，旧站只有中文 |');
w();
w('### 我可以接着做的事（等确认后）');
w();
w('| # | 事项 | 说明 |');
w('|---|---|---|');
w('| 1 | 图片工程化处理 | 压缩、裁剪、转 WebP/AVIF、生成多尺寸响应式图 |');
w('| 2 | 把确认后的图片接入 Prototype | 只改 `website/src/data/` 的 `image` 字段，不动组件逻辑 |');
w('| 3 | 补齐 Factory / Quality / About 配图 | 按人工确认的对应关系逐张接入 |');
w('| 4 | 英文文案撰写 | 以旧站中文内容为事实来源，按英文 B2B 习惯重写（不用机翻） |');
w('| 5 | 多语言结构落地 | 引入 `[locale]` 动态段，先只实现 `en` |');
w();
w('### 本阶段的硬性边界（已遵守）');
w();
w('| 禁令 | 状态 |');
w('|---|---|');
w('| 用旧站代码替换 Next.js 项目 | ❌ 未做 |');
w('| 修改现有 Prototype | ❌ 未做（TEST 7 已验证 `website/` 零改动） |');
w('| 把中文内容自动上线英文站 | ❌ 未做 |');
w('| 机器人翻译内容 | ❌ 未做 |');
w('| 绕过登录 / 验证码 / 访问权限 | ❌ 未做（只抓公开页面） |');
w('| 提交任何表单 | ❌ 未做（只读 GET） |');
w('| 无编号证据就自动绑定产品图 | ❌ 未做（TEST 4 已验证） |');
w();
w('---');
w();

// =====================================================================
// 附录
// =====================================================================
w('## 附录 A：本阶段产物清单');
w();
w('| 文件 / 目录 | 内容 |');
w('|---|---|');
w(`| \`data/legacy-site/crawl/html/\` | ${crawl.pages.length} 个页面的原始 HTML |`);
w('| `data/legacy-site/crawl/pages.json` | 每页的 Title / Description / H1 / 正文 / 图片 / 链接 / 信标 |');
w('| `data/legacy-site/crawl/probes.json` | robots.txt、sitemap.xml、响应头探测结果 |');
w(`| \`data/legacy-site/images/{products,factory,certificates,company,other}/\` | ${imgTotal} 张图片 |`);
w(`| \`data/legacy-site/documents/\` | ${docTotal} 个文档 |`);
w('| `data/legacy-site/downloads.json` | 每个文件的下载结果、尺寸、SHA-256 |');
w('| `data/legacy-site/legacy-products.json` | 旧站产品页结构化字段（规格表解析结果） |');
w('| `data/legacy-site/product-image-matching.json` | 图片匹配结论 + 完整证据链 |');
w(`| **\`data/legacy-site/assets.json\`** | **需求书要求的资产清单**（${assets.assets.length} 条） |`);
w('| `data/legacy-site/legacy-site-audit.json` | 技术审计 + 内容审核 + 映射建议 + 多语言规划 |');
w('| **`review/legacy-product-image-mapping.xlsx`** | **业务方人工确认表** |');
w('| **`docs/qfbowen-legacy-site-audit.md`** | **本报告** |');
w();
w('## 附录 B：工具链（纯 Node.js，零第三方依赖）');
w();
w('| 脚本 | 作用 |');
w('|---|---|');
w('| `tools/legacy/lib/http.mjs` | 代理感知的 HTTP 客户端（重试 / 超时 / 限速 / 并发池） |');
w('| `tools/legacy/lib/html.mjs` | HTML 解析（Meta / 标题 / 链接 / 图片 / 附件 / 视频 / 正文 / 信标） |');
w('| `tools/legacy/lib/classify.mjs` | 页面与素材分类规则（单一事实来源） |');
w('| `tools/legacy/lib/media.mjs` | 图片头部解析（真实格式 + 宽高 + SHA-256） |');
w('| `tools/legacy/lib/match.mjs` | 产品图片匹配规则（含"禁止猜"红线） |');
w('| `tools/legacy/crawl-legacy-site.mjs` | A：抓取公开页面 |');
w('| `tools/legacy/download-legacy-assets.mjs` | B：下载公开素材 |');
w('| `tools/legacy/build-legacy-asset-manifest.mjs` | C：生成 assets.json |');
w('| `tools/legacy/extract-legacy-products.mjs` | D 前置：解析产品规格表 |');
w('| `tools/legacy/match-legacy-product-images.mjs` | D：匹配 + 生成人工审核 XLSX |');
w('| `tools/legacy/audit-legacy-site.mjs` | E/F/G/H：综合审计 |');
w('| `tools/legacy/verify-legacy-audit.mjs` | 验收测试 |');
w('| `tools/legacy/build-legacy-audit-report.mjs` | I：生成本报告 |');
w();
w('## 附录 C：复现命令');
w();
w('```bash');
w('# 依赖 Node.js（本项目用 v24.9.0 验证），无需安装任何第三方包');
w('node tools/legacy/crawl-legacy-site.mjs            # A 抓取（约 20 分钟，旧站较慢）');
w('node tools/legacy/download-legacy-assets.mjs       # B 下载素材');
w('node tools/legacy/extract-legacy-products.mjs      # 解析产品规格表');
w('node tools/legacy/match-legacy-product-images.mjs  # D 匹配 + 人工审核表');
w('node tools/legacy/build-legacy-asset-manifest.mjs  # C assets.json');
w('node tools/legacy/audit-legacy-site.mjs            # E/F/G/H 综合审计');
w('node tools/legacy/build-legacy-audit-report.mjs    # I 生成报告');
w('node tools/legacy/verify-legacy-audit.mjs          # 验收测试');
w('```');
w();
w('> 环境说明：本机通过 `127.0.0.1:10090` 代理访问外网，Node 需 `NODE_USE_ENV_PROXY=1`');
w('> （已在 `lib/http.mjs` 内自动设置）。旧站 HTTPS 在本机与代理链路上均握手失败，');
w('> 已用 Node 的 OpenSSL 独立验证（`tls_probes`），确认是旧站自身问题。');
w();

const outPath = path.join(ROOT, 'docs', 'qfbowen-legacy-site-audit.md');
fs.writeFileSync(outPath, md.join('\n'));
console.log(`written: ${outPath}`);
console.log(`lines: ${md.length}`);
