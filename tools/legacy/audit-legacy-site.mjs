/**
 * Phase 3.5 / E+F+G+H —— 旧站综合审计
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/audit-legacy-site.mjs
 * 产物：data/legacy-site/legacy-site-audit.json
 *
 * E. 公司素材映射建议（Home / Factory / Quality / About / Contact）
 * F. 内容质量审核（可复用 / 需英文改写 / 已过时 / 仅国内 / 不可用）
 * G. 技术审计（页面数、移动端、图片、URL、Meta、robots、sitemap、canonical、HTTPS、加载资源）
 * H. 多语言迁移规划（en / zh / es）
 *
 * 只做分析与建议，绝不改动现有 Prototype，也不把旧站代码当新站基础。
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import { httpGet, pooledMap } from './lib/http.mjs';
import { classifyPage } from './lib/classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(ROOT, 'data', 'legacy-site');
const CRAWL = path.join(SITE_DIR, 'crawl');

// =====================================================================
// F. 内容质量检测器
// =====================================================================
const DETECTORS = [
  { key: 'absolute_claim', label: '绝对化宣传', verdict: 'Do not use',
    why: '海外 B2B 采购与欧盟/英美广告合规都对绝对化用语敏感，不可直接沿用。',
    re: /(最高|最好|最强|最大|最先进|最优|第一品牌|国内第一|世界第一|国际领先|世界领先|行业领先|唯一|独家|首家|100%|百分之百|国家级|顶尖|首屈一指|遥遥领先|无与伦比|极致|完美)/g },
  { key: 'marketing_fluff', label: '夸张营销语', verdict: 'Needs English rewrite',
    why: '国内营销腔调直接翻译成英文会显得不可信，需要用事实型表达重写。',
    re: /(竭诚|真诚为您服务|欢迎来电咨询|质量第一|信誉至上|精益求精|追求卓越|一流|朋友|携手|共赢|共创辉煌|不二之选)/g },
  { key: 'domestic_platform', label: '国内平台链接', verdict: 'Domestic-market only',
    why: '阿里巴巴/1688/百度等国内平台链接对海外采购商无意义，且会分散权重。',
    re: /(1688\.com|alibaba\.com\/|阿里巴巴|淘宝|天猫|jd\.com|百度|搜狗|抖音|微信)/gi },
  { key: 'domestic_filing', label: '国内备案信息', verdict: 'Domestic-market only',
    why: 'ICP 备案号只在中国大陆适用，英文站不应展示。',
    re: /(ICP备|备案号|miit\.gov\.cn|鲁ICP|京ICP)/g },
  { key: 'domestic_phone', label: '旧联系方式（国内电话）', verdict: 'Domestic-market only',
    why: '国内固话/手机号对海外客户不可拨打，且属于"旧联系方式"风险项。',
    re: /(0537[-\s]?\d{7}|全国服务热线|\b400[-\s]?\d{3}[-\s]?\d{4}\b|(?<!\d)1[3-9]\d{9}(?!\d))/g },
  { key: 'domestic_address', label: '旧地址（中文国内地址）', verdict: 'Domestic-market only',
    why: '中文地址无法直接用于英文站，需改为英文规范地址并确认是否对海外公开。',
    re: /(曲阜市|山东省|济宁市|台湾工业园|创业大道|新竹路)/g },
  { key: 'unverifiable_claim', label: '无法证明的数据/模糊表述', verdict: 'Needs English rewrite',
    why: '“多年”“多家”“众多”这类无具体数字的表述无法核证，英文站应改为可验证的事实或删除。',
    re: /(多年|多家|数十家|上百家|众多|大量|丰富的经验|深厚的|广受好评|业界公认)/g },
  { key: 'template_bug', label: '模板未渲染占位符', verdict: 'Do not use',
    why: '旧站模板存在未渲染的标签（如 [about:desc]），这类内容本身是缺陷，不可迁移。',
    re: /(\[[a-z]+:[a-z_]+\])/g },
  { key: 'guestbook_promo', label: '留言板/低价值页', verdict: 'Do not use',
    why: '留言板类页面是交互页而非内容资产，英文站不应照搬。',
    re: /(在线留言|给我们留言|留言板)/g },
];

// 语言中立、可跨语言直接复用的技术数据。
// 注意：这里必须收紧——早期版本用 /\b[A-Z0-9]{2,}[- ]?\d{3,}\b/ 会把页脚电话
// "0537-4598999" 也判成"技术数据"，导致全站被误判为可直接复用。
// 因此 OE 类必须**含字母**，温度必须带单位。
const NEUTRAL_DATA_RES = [
  /\b(?=[A-Z0-9.\/-]{5,})(?=[A-Z0-9.\/-]*[A-Z])[A-Z0-9][A-Z0-9.\/-]{4,}\b/g,  // 含字母的 OE 编号
  /\b\d{2,3}\s*[℃°C]/g,                                                        // 温度（带单位）
];

const COMPANY_PATTERNS = {
  phone: /(?:电话|服务热线|全国服务热线)[：:]\s*([0-9\-—\s]{7,20})/g,
  email: /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
  address: /地址[：:]\s*([^\s<]{4,60})/g,
  contact_person: /联系人[：:]\s*([^\s<]{2,20})/g,
  icp: /(鲁ICP备[0-9]+号(?:-[0-9]+)?)/g,
  company_zh: /(曲阜市博文汽车零部件制造有限公司)/g,
};

function detect(text, re) {
  const m = String(text || '').match(re);
  return m ? [...new Set(m.map((s) => s.trim()))] : [];
}

/**
 * 第一遍：对单个页面跑全部检测器，保留**完整**命中样本（不截断），
 * 供第二遍统计"哪些命中是全站页脚样板"。
 */
function runDetectors(text) {
  const issues = [];
  for (const d of DETECTORS) {
    const hits = detect(text, d.re);
    if (hits.length) {
      issues.push({ key: d.key, label: d.label, verdict: d.verdict, why: d.why, hit_count: hits.length, samples: hits });
    }
  }
  return issues;
}

/** 过时判断（页面自身的时间信息，非模板） */
function checkOutdated(text) {
  let outdated = null;
  const pub = (text.match(/发布时间[：:]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/) || [])[1] || null;
  if (pub) {
    const ageYears = (Date.now() - new Date(pub).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageYears >= 3) outdated = { reason: `发布时间 ${pub}，距今约 ${ageYears.toFixed(1)} 年`, published_at: pub };
  }
  const validity = (text.match(/(有效期至|有效期自|至)\s*[:：]?\s*([0-9]{4}[-年][0-9]{1,2}[-月][0-9]{1,2}日?)/) || [])[2] || null;
  if (validity) {
    const t = new Date(validity.replace(/[年月]/g, '-').replace(/日/, ''));
    if (!Number.isNaN(t.getTime()) && t.getTime() < Date.now()) {
      outdated = { reason: `证书有效期至 ${validity}，已过期`, expired_at: validity };
    }
  }
  return { outdated, published_at: pub };
}

/**
 * 第二遍：依据"页面自身"的问题给出单一结论。
 * 全站页脚样板（ICP 备案、国内固话、"给我们留言"等）不计入单页结论——
 * 它们属于站点级问题，单独统计，否则每一页都会得到同一个无意义的判定。
 */
function verdictOf(page, specificIssues, outdated, neutral, hasSpecTable) {
  const verdicts = new Set(specificIssues.map((i) => i.verdict));
  if (outdated && !verdicts.has('Do not use') && !verdicts.has('Domestic-market only')) {
    return { verdict: 'Outdated', rationale: outdated.reason };
  }
  if (verdicts.has('Do not use')) {
    return { verdict: 'Do not use', rationale: specificIssues.filter((i) => i.verdict === 'Do not use').map((i) => i.label).join('、') };
  }
  if (verdicts.has('Domestic-market only')) {
    return { verdict: 'Domestic-market only', rationale: specificIssues.filter((i) => i.verdict === 'Domestic-market only').map((i) => i.label).join('、') };
  }
  if (verdicts.has('Needs English rewrite')) {
    return { verdict: 'Needs English rewrite', rationale: specificIssues.filter((i) => i.verdict === 'Needs English rewrite').map((i) => i.label).join('、') };
  }
  // "可直接复用"只认有结构化规格表的页面（页面自身写明的 OE / 博文编号 / 温度）。
  // 中文车型名仍需英文对照，这一点在 rationale 里写清楚，不夸大。
  if (hasSpecTable) {
    return {
      verdict: 'Can reuse directly',
      rationale: '页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照',
    };
  }
  if ((page.textLength || 0) < 120) {
    return { verdict: 'Do not use', rationale: '页面除模板样板外没有实质正文内容' };
  }
  return { verdict: 'Needs English rewrite', rationale: '页面为中文正文，需人工重写为英文，页面自身未发现高风险表述' };
}

// =====================================================================
// G. TLS 探测（照实记录旧站 HTTPS 是否可用）
// =====================================================================
function probeTls(servername) {
  return new Promise((resolve) => {
    const raw = net.connect(10090, '127.0.0.1', () => {
      raw.write(`CONNECT ${servername}:443 HTTP/1.1\r\nHost: ${servername}:443\r\n\r\n`);
    });
    let buf = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { raw.destroy(); } catch {} resolve(r); } };
    raw.setTimeout(12000, () => finish({ servername, result: 'TIMEOUT' }));
    raw.on('error', (e) => finish({ servername, result: 'SOCKET_ERROR ' + e.code }));
    raw.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      if (!buf.includes('\r\n\r\n')) return;
      const status = buf.split('\r\n')[0];
      raw.removeAllListeners('data');
      if (!/ 200 /.test(status)) return finish({ servername, result: 'CONNECT_FAILED ' + status });
      const t = tls.connect({ socket: raw, servername, rejectUnauthorized: false }, () => {
        const c = t.getPeerCertificate() || {};
        finish({ servername, result: 'TLS_OK', protocol: t.getProtocol(), issuer: c.issuer ? c.issuer.CN || c.issuer.O : null, valid_to: c.valid_to || null });
      });
      t.setTimeout(12000, () => finish({ servername, result: 'TLS_TIMEOUT' }));
      t.on('error', (e) => finish({ servername, result: 'TLS_ERROR ' + (e.code || e.message) }));
    });
  });
}

// =====================================================================
// 主流程
// =====================================================================
async function main() {
  const crawl = JSON.parse(fs.readFileSync(path.join(CRAWL, 'pages.json'), 'utf8'));
  const probes = JSON.parse(fs.readFileSync(path.join(CRAWL, 'probes.json'), 'utf8'));
  const downloads = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'downloads.json'), 'utf8'));
  const assetsPath = path.join(SITE_DIR, 'assets.json');
  const assets = fs.existsSync(assetsPath) ? JSON.parse(fs.readFileSync(assetsPath, 'utf8')) : null;

  const pages = crawl.pages.map((p) => ({ ...p, ...classifyPage(p) }));

  // ---------------- E. 公司素材映射建议 ----------------
  const okAssets = assets ? assets.assets.filter((a) => a.download_status === 'ok') : [];
  const companyMapping = buildCompanyMapping(okAssets, downloads);

  // ---------------- F. 内容质量审核 ----------------
  // 两遍法：第一遍收集全部命中，第二遍剔除"全站页脚样板"后再给单页结论。
  // 旧站把 ICP 备案、国内固话、留言入口、"给我们留言"等模板文字注入到每一个页面，
  // 若不剔除，943 个页面会得到完全相同的判定，内容审核就失去意义。
  const N = pages.length;
  const rawEval = pages.map((p) => ({ page: p, issues: runDetectors(p.text || '') }));

  const sampleDf = new Map();
  const detectorDf = new Map();
  for (const r of rawEval) {
    for (const iss of r.issues) {
      detectorDf.set(iss.key, (detectorDf.get(iss.key) || 0) + 1);
      for (const s of iss.samples) {
        const k = `${iss.key}::${s}`;
        sampleDf.set(k, (sampleDf.get(k) || 0) + 1);
      }
    }
  }
  const SAMPLE_BOILER_THRESHOLD = Math.max(3, Math.ceil(N * 0.5));
  const siteWideThreshold = Math.ceil(N * 0.8);
  const siteWideDetectors = new Set([...detectorDf].filter(([, c]) => c >= siteWideThreshold).map(([k]) => k));

  const specTablePages = new Set(
    (fs.existsSync(path.join(SITE_DIR, 'legacy-products.json'))
      ? JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'legacy-products.json'), 'utf8')).products
      : []).filter((p) => p.has_spec_table).map((p) => p.source_url)
  );

  const contentPages = rawEval.map(({ page, issues }) => {
    const specificIssues = [];
    const templateIssues = [];
    for (const iss of issues) {
      const isSiteWide = siteWideDetectors.has(iss.key);
      const specificSamples = iss.samples.filter((s) => (sampleDf.get(`${iss.key}::${s}`) || 0) < SAMPLE_BOILER_THRESHOLD);
      const boilerSamples = iss.samples.filter((s) => (sampleDf.get(`${iss.key}::${s}`) || 0) >= SAMPLE_BOILER_THRESHOLD);
      if (boilerSamples.length) {
        templateIssues.push({ key: iss.key, label: iss.label, verdict: iss.verdict, why: iss.why, hit_count: boilerSamples.length, samples: boilerSamples.slice(0, 5) });
      }
      // 站点级检测器（≥80% 页面都命中）一律不算单页问题；其余只要还有"非样板"命中就算页面自身问题
      if (!isSiteWide && specificSamples.length) {
        specificIssues.push({ key: iss.key, label: iss.label, verdict: iss.verdict, why: iss.why, hit_count: specificSamples.length, samples: specificSamples.slice(0, 8) });
      }
    }

    const { outdated, published_at } = checkOutdated(page.text || '');
    const neutral = NEUTRAL_DATA_RES.some((re) => new RegExp(re.source).test(page.text || ''));
    const v = verdictOf(page, specificIssues, outdated, neutral, specTablePages.has(page.url));

    return {
      url: page.url, name: page.name, fine: page.fine, coarse: page.coarse,
      title: page.title, text_length: page.textLength,
      verdict: v.verdict, rationale: v.rationale,
      issues: specificIssues,
      template_wide_issues: templateIssues,
      outdated, published_at, neutral_data_present: neutral,
      has_spec_table: specTablePages.has(page.url),
    };
  });
  const contentByVerdict = contentPages.reduce((m, p) => { m[p.verdict] = (m[p.verdict] || 0) + 1; return m; }, {});

  const siteWideContentFindings = [...detectorDf]
    .filter(([k, c]) => c >= siteWideThreshold || siteWideDetectors.has(k))
    .map(([k, c]) => {
      const d = DETECTORS.find((x) => x.key === k);
      return { key: k, label: d ? d.label : k, verdict: d ? d.verdict : 'review', pages_hit: c, pages_total: N, pct: +((c / N) * 100).toFixed(1) };
    })
    .sort((a, b) => b.pages_hit - a.pages_hit);

  // 公司身份信息（旧站公开的国内联系方式，用于第 10 项对比）
  const allText = pages.map((p) => p.text).join('\n');
  const companyIdentity = {};
  for (const [k, re] of Object.entries(COMPANY_PATTERNS)) {
    const hits = [...new Set([...allText.matchAll(re)].map((m) => (m[1] || m[0]).trim()))];
    companyIdentity[k] = hits;
  }
  // 联系方式按页面定位
  const contactPages = pages.filter((p) => p.coarse === 'contact' || p.fine === 'contact');
  companyIdentity.contact_page_urls = contactPages.map((p) => p.url);

  // ---------------- G. 技术审计 ----------------
  const uniqueCss = [...new Set(pages.flatMap((p) => p.stylesheets || []))];
  const allUniqueJs = [...new Set(pages.flatMap((p) => p.scripts || []))];

  // ⚠️ 旧站每个页面都塞了一个独立的访问计数脚本（/inc/AspCms_Visits.asp?id=N），
  //    这些 URL 每个页面都不同，数量与页面数同量级。审计只统计、**不逐个下载**，
  //    否则会发出上千次无意义请求（既慢又对旧站不礼貌）。
  const isCounterScript = (u) => /AspCms_Visits|visitsadd|(^|[?&])id=\d+/i.test(u) || /\/inc\//i.test(u);
  const counterScripts = allUniqueJs.filter(isCounterScript);
  const staticJs = allUniqueJs.filter((u) => !isCounterScript(u));
  const isStatic = (u) => /\.(css|js)(\?|$)/i.test(u);
  const fetchCss = uniqueCss.filter(isStatic).slice(0, 30);
  const fetchJs = staticJs.filter(isStatic).slice(0, 30);

  const resourceSizes = await pooledMap([...fetchCss, ...fetchJs], async (u) => {
    const r = await httpGet(u, { retries: 2, timeoutMs: 30000, accept: '*/*' });
    return { url: u, bytes: r.bytes, ok: r.ok, status: r.status };
  }, { concurrency: 4, delayMs: 60 });
  const resOk = resourceSizes.filter((r) => r && !r.__error && r.ok);
  const cssBytes = resOk.filter((r) => fetchCss.includes(r.url)).reduce((s, r) => s + r.bytes, 0);
  const jsBytes = resOk.filter((r) => fetchJs.includes(r.url)).reduce((s, r) => s + r.bytes, 0);

  const mediaQueryCss = await pooledMap(fetchCss, async (u) => {
    const r = await httpGet(u, { retries: 2, timeoutMs: 30000, accept: 'text/css,*/*' });
    return { url: u, hasMedia: /@media/i.test(r.text || ''), ok: r.ok };
  }, { concurrency: 4, delayMs: 60 });

  const imageAssets = okAssets.filter((a) => a.asset_type === 'image');
  const docAssets = okAssets.filter((a) => a.asset_type === 'document');
  const videoAssets = okAssets.filter((a) => a.asset_type === 'video');

  const fmtDist = imageAssets.reduce((m, a) => { m[a.format || 'unknown'] = (m[a.format || 'unknown'] || 0) + 1; return m; }, {});
  const widthDist = imageAssets.reduce((m, a) => {
    if (!a.width) { m['no-dimension'] = (m['no-dimension'] || 0) + 1; return m; }
    const bucket = a.width < 300 ? '<300' : a.width < 800 ? '300-799' : a.width < 1200 ? '800-1199' : a.width < 1600 ? '1200-1599' : '>=1600';
    m[bucket] = (m[bucket] || 0) + 1; return m;
  }, {});

  const titles = pages.map((p) => p.title).filter(Boolean);
  const dupTitles = [...new Set(titles.filter((t, i) => titles.indexOf(t) !== i))];

  const tlsResults = [];
  for (const h of ['www.qfbowen.com', 'qfbowen.com']) tlsResults.push(await probeTls(h));

  const techAudit = {
    page_inventory: {
      total_pages: pages.length,
      by_coarse_category: pages.reduce((m, p) => { m[p.coarse] = (m[p.coarse] || 0) + 1; return m; }, {}),
      by_fine_category: pages.reduce((m, p) => { m[p.fine] = (m[p.fine] || 0) + 1; return m; }, {}),
      html_total_bytes: pages.reduce((s, p) => s + (p.htmlBytes || 0), 0),
      avg_html_bytes: Math.round(pages.reduce((s, p) => s + (p.htmlBytes || 0), 0) / Math.max(pages.length, 1)),
    },
    mobile: {
      viewport_meta_pages: pages.filter((p) => p.beacons && p.beacons.hasViewportMeta).length,
      // 这里是"总数"，样本单独放 sample 字段——早期版本把 slice(0,40) 的采样长度
      // 当成总数输出，报告里显示成 40，严重低估（真实为 943）。
      pages_without_viewport: pages.filter((p) => !(p.beacons && p.beacons.hasViewportMeta)).length,
      pages_without_viewport_sample: pages.filter((p) => !(p.beacons && p.beacons.hasViewportMeta)).map((p) => p.url).slice(0, 10),
      css_with_media_queries: mediaQueryCss.filter((m) => m && !m.__error && m.hasMedia).map((m) => m.url),
      css_checked: fetchCss.length,
    },
    images: {
      image_count: imageAssets.length,
      total_bytes: imageAssets.reduce((s, a) => s + (a.bytes || 0), 0),
      format_distribution: fmtDist,
      width_distribution: widthDist,
      oversized_ge_1600: imageAssets.filter((a) => a.width >= 1600).length,
      no_dimension: imageAssets.filter((a) => !a.width).length,
      avg_bytes: Math.round(imageAssets.reduce((s, a) => s + (a.bytes || 0), 0) / Math.max(imageAssets.length, 1)),
      largest: imageAssets.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 10)
        .map((a) => ({
          local_file: a.local_file,
          bytes: a.bytes,
          dim: a.width ? `${a.width}x${a.height}` : null,
          source_page_category: a.page_category,
          reuse_status: a.reuse_status,
        })),
    },
    documents: { count: docAssets.length, files: docAssets.map((a) => ({ local_file: a.local_file, bytes: a.bytes, url: a.asset_url })) },
    videos: { count: videoAssets.length, files: videoAssets.map((a) => ({ local_file: a.local_file, url: a.asset_url })) },
    url_structure: {
      patterns: [
        { pattern: '/', note: '首页' },
        { pattern: '/list/?{栏目ID}_{页码}.html', note: '栏目/分页列表' },
        { pattern: '/content/?{内容ID}.html', note: '详情页（产品/证书/新闻同构）' },
        { pattern: '/about/?{栏目ID}.html', note: '单页（关于/文化/联系/设备）' },
        { pattern: '/gbook/?{ID}_{页码}.html', note: '在线留言' },
      ],
      id_based_urls: pages.filter((p) => /\?[0-9]+/.test(p.url)).length,
      semantic_slug_urls: pages.filter((p) => /[a-z]{3,}/i.test(new URL(p.url).pathname.replace(/\/$/, '').split('/').pop() || '')).length,
      note: 'URL 以数字 ID 为主，无关键词语义，且中英文站点未来需重新设计 URL 结构（旧站 URL 不可继承）。',
    },
    meta: {
      pages_with_title: pages.filter((p) => p.title).length,
      pages_with_description: pages.filter((p) => p.metaDescription && !/^\[/.test(p.metaDescription)).length,
      pages_with_broken_description: pages.filter((p) => p.metaDescription && /^\[/.test(p.metaDescription)).map((p) => p.url),
      pages_with_h1: pages.filter((p) => (p.h1 || []).length > 0).length,
      pages_with_multiple_h1: pages.filter((p) => (p.h1 || []).length > 1).length,
      duplicate_titles: dupTitles,
      duplicate_title_count: dupTitles.length,
      title_pattern: '「栏目/产品名-关键词堆砌-公司全称」，标题均超长且关键词堆砌',
      sample_titles: titles.slice(0, 6),
    },
    seo_files: {
      robots_txt: probes.endpoints['/robots.txt'],
      sitemap_xml: probes.endpoints['/sitemap.xml'],
      canonical_pages: pages.filter((p) => p.canonical).length,
      canonical_note: '全站未设置 rel=canonical',
      meta_robots_pages: pages.filter((p) => p.metaRobots).length,
    },
    https: {
      tls_probes: tlsResults,
      http_redirects_to_https: false,
      http_status: probes.homeHeaders.status,
      note: 'HTTP 直接返回 200，不做 HTTPS 跳转；443 端口 TCP 可连但 TLS 握手被重置，HTTPS 不可用。',
    },
    page_resources: {
      unique_css: uniqueCss.length,
      unique_js_total: allUniqueJs.length,
      unique_js_static: staticJs.length,
      per_page_counter_scripts: counterScripts.length,
      total_css_bytes: cssBytes,
      total_js_bytes: jsBytes,
      avg_css_per_page: +(uniqueCss.length / Math.max(pages.length, 1)).toFixed(2),
      note: `静态资源共 ${uniqueCss.length} 个 CSS + ${staticJs.length} 个 JS（Bootstrap + jQuery + Owl Carousel + animate.css/WOW.js）。`
        + `另有 ${counterScripts.length} 个"每页一个"的访问计数脚本（/inc/AspCms_Visits.asp?id=N），`
        + '旧站因此无法有效利用浏览器缓存，属于典型的老旧 AspCms 实现。本审计只统计这些计数脚本，未逐个下载。',
    },
    tracking: {
      baidu_analytics_pages: pages.filter((p) => p.beacons && p.beacons.baiduAnalytics).length,
      google_analytics_pages: pages.filter((p) => p.beacons && p.beacons.googleAnalytics).length,
      platform_1688_pages: pages.filter((p) => p.beacons && p.beacons.platform1688).length,
      icp_pages: pages.filter((p) => p.beacons && p.beacons.icpBeian).length,
    },
    external_links: [...new Set(pages.flatMap((p) => p.externalLinks || []))].slice(0, 40),
  };

  // ---------------- G2. 旧站代码质量信号（回答"旧站代码是否值得复用"）----------------
  const HTML_DIR = path.join(CRAWL, 'html');
  const codeSignals = {
    pages_analyzed: 0,
    missing_html_tag: 0,
    missing_lang_attr: 0,
    table_layout_pages: 0,
    inline_style_pages: 0,
    deprecrated_tags: {},
    libraries: {},
    html_versions: {},
    template_placeholders_pages: 0,
    template_placeholders: [],
  };
  for (const f of fs.readdirSync(HTML_DIR)) {
    if (!f.endsWith('.html')) continue;
    const h = fs.readFileSync(path.join(HTML_DIR, f), 'utf8');
    codeSignals.pages_analyzed++;
    if (!/<html[\s>]/i.test(h)) codeSignals.missing_html_tag++;
    if (!/<html[^>]*\blang=/i.test(h)) codeSignals.missing_lang_attr++;
    if (/<table[^>]*(width|cellpadding|cellspacing|border)=/i.test(h) && !/class=["']nextinfo/i.test(h)) codeSignals.table_layout_pages++;
    if (/style=["'][^"']{10,}/i.test(h)) codeSignals.inline_style_pages++;
    const dt = (h.match(/<!DOCTYPE[^>]*>/i) || [])[0] || 'none';
    codeSignals.html_versions[dt.slice(0, 60)] = (codeSignals.html_versions[dt.slice(0, 60)] || 0) + 1;
    for (const tag of ['font', 'center', 'marquee', 'blink']) {
      const n = (h.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
      if (n) codeSignals.deprecrated_tags[tag] = (codeSignals.deprecrated_tags[tag] || 0) + n;
    }
    for (const [name, re] of [['jQuery', /jquery/i], ['Bootstrap', /bootstrap/i], ['Owl Carousel', /owl\.carousel/i],
      ['animate.css', /animate\.min\.css/i], ['WOW.js', /wow\.min\.js|new WOW\(/i], ['Baidu Analytics', /hm\.baidu\.com/i]]) {
      if (re.test(h)) codeSignals.libraries[name] = (codeSignals.libraries[name] || 0) + 1;
    }
    const ph = [...new Set([...h.matchAll(/\[[a-z]+:[a-z_]+\]/gi)].map((m) => m[0]))];
    if (ph.length) { codeSignals.template_placeholders_pages++; codeSignals.template_placeholders.push(...ph); }
  }
  codeSignals.template_placeholders = [...new Set(codeSignals.template_placeholders)];
  codeSignals.verdict = '旧站是 IIS + ASP.NET(AspCms) 的静态化中文站：模板级 HTML 结构缺陷（部分页面缺 <html> 标签）、'
    + '表格布局、大量内联样式、未渲染的模板占位符，前端栈为 jQuery + Bootstrap + Owl Carousel。'
    + '这些都应作为"不要复用"的依据，而不是新站的技术底座。';
  techAudit.code_quality = codeSignals;

  // ---------------- H. 多语言迁移规划 ----------------
  const multilingual = {
    current_prototype: { locales_implemented: ['en'], structure: '单语言（无 /en 前缀），Next.js App Router' },
    target: { locales: ['en', '/zh/', '/es/'], phase_1: 'en only' },
    legacy_content_role: {
      zh_source_use: '中文旧站内容仅作为英文撰写的参考与事实核对来源，不作为可直接发布的文案。',
      machine_translation: '禁止机器翻译直接上线；所有英文必须人工撰写或人工校订后方可发布。',
      evidence: '旧站正文含大量国内营销语与绝对化用语，直译会同时触发合规与可信度问题（见 content_review）。',
    },
    recommended_structure: {
      routing: '/en/（默认）, /zh/, /es/ —— Next.js App Router 的 [locale] 动态段',
      redirects: '根路径 / 按 Accept-Language 302 到 /en/，并保留显式语言切换',
      hreflang: '每个页面输出 en / zh / es / x-default 的 hreflang 与 canonical 互指',
      content_model: '产品数据（Products/Applications/OE）与文案分离：数据一套，文案按语言多份',
      fallback: 'zh/es 未完成前，对应语言返回 404 或 "coming soon"，绝不回落到英文内容（避免重复内容）',
    },
    assets: {
      images: '图片素材与语言无关，可共用；但含中文字的图片（Banner/宣传图）必须重做',
      documents: 'PDF 证书/样本需按语言分版本，中文版不进英文站',
    },
  };

  const out = {
    generated_at: new Date().toISOString(),
    phase: 'Phase 3.5 — qfbowen.com 现有官网资产迁移审计',
    source_site: crawl.origin,
    scope_note: '本审计只针对旧站公开页面与公开素材；未绕过任何登录、验证码或访问权限。旧站代码不作为新站基础。',
    crawl_summary: {
      pages: pages.length,
      discovered_assets: crawl.discovered_asset_url_count,
      downloaded_assets: okAssets.length,
      failed_assets: downloads.assets.length - okAssets.length,
      fetch_attempts: crawl.fetch_attempts,
      skipped: crawl.failed_or_skipped.length,
    },
    tech_audit: techAudit,
    content_review: {
      method_note: '两遍法：先统计全部命中，再剔除"出现在 ≥50% 页面上的样板文字"（旧站页脚模板把 ICP 备案、'
        + '国内固话、留言入口注入到每一页），最后只依据"页面自身内容"给出单一结论。'
        + '站点级问题单独列在 site_wide_findings 中，不重复计入每一页。',
      summary_by_verdict: contentByVerdict,
      site_wide_findings: siteWideContentFindings,
      published_year_distribution: contentPages.reduce((m, p) => {
        const y = (p.published_at || '').slice(0, 4) || '(无发布时间)';
        m[y] = (m[y] || 0) + 1; return m;
      }, {}),
      notable_pages: {
        do_not_use: contentPages.filter((p) => p.verdict === 'Do not use')
          .map((p) => ({ url: p.url, reason: p.rationale })),
        absolute_claims: contentPages.filter((p) => p.issues.some((i) => i.key === 'absolute_claim'))
          .map((p) => ({ url: p.url, samples: p.issues.find((i) => i.key === 'absolute_claim').samples })),
      },
      totals: {
        pages_reviewed: contentPages.length,
        pages_with_own_issues: contentPages.filter((p) => p.issues.length).length,
        pages_with_only_template_issues: contentPages.filter((p) => !p.issues.length && p.template_wide_issues.length).length,
        pages_with_absolute_claims: contentPages.filter((p) => p.issues.some((i) => i.key === 'absolute_claim')).length,
        pages_with_domestic_signals: contentPages.filter((p) => p.issues.some((i) => i.verdict === 'Domestic-market only')).length,
        pages_outdated: contentPages.filter((p) => p.outdated).length,
        pages_reusable_as_data: contentPages.filter((p) => p.verdict === 'Can reuse directly').length,
        pages_with_spec_table: contentPages.filter((p) => p.has_spec_table).length,
      },
      pages: contentPages,
    },
    company_identity: companyIdentity,
    company_asset_mapping: companyMapping,
    multilingual,
  };

  fs.writeFileSync(path.join(SITE_DIR, 'legacy-site-audit.json'), JSON.stringify(out, null, 2));

  console.log('pages               :', pages.length);
  console.log('content verdicts    :', JSON.stringify(contentByVerdict));
  console.log('image formats       :', JSON.stringify(fmtDist));
  console.log('https               :', JSON.stringify(tlsResults));
  console.log('company mapping keys:', Object.keys(companyMapping.suggestions).join(', '));
  return out;
}

// =====================================================================
// E. 公司素材映射建议
// =====================================================================
function buildCompanyMapping(okAssets, downloads) {
  // ⚠️ assets.json 里记录的是 local_file（如 images/factory/sb01.jpg），
  //    并没有 subdir 字段。早期版本按 a.subdir 过滤，导致所有候选素材都是 0 个。
  //    这里统一从 local_file 前缀推导归属目录。
  const inDir = (a, dir) => String(a.local_file || '').startsWith(dir + '/');
  const pick = (dir, limit = 40) => okAssets.filter((a) => inDir(a, dir)).slice(0, limit);
  // 计数必须用全量，不能复用带 limit 的采样列表（否则 783 张会被写成 40）
  const countDir = (dir) => okAssets.filter((a) => inDir(a, dir)).length;

  const products = pick('images/products');
  const factory = pick('images/factory');
  const certs = pick('images/certificates');
  const company = pick('images/company');
  const docs = pick('documents');
  const other = pick('images/other');

  const toRef = (list) => list.map((a) => ({
    local_file: a.local_file,
    asset_url: a.asset_url,
    source_page: (a.source_pages || [])[0] || null,
    bytes: a.bytes,
    dim: a.width ? `${a.width}x${a.height}` : null,
    reuse_status: a.reuse_status,
    note: a.classification_evidence,
  }));

  return {
    principle: '只给映射建议，不替换任何网页。含中文字的图片一律先重做英文版再上站。',
    suggestions: {
      Home: {
        target_page: 'http://localhost:3000/ (website/src/app/(site)/page.tsx)',
        current_state: '首页为纯文字/SVG 版式，无真实照片',
        candidates: toRef([...products.slice(0, 6), ...company.slice(0, 4)]),
        recommendation: '首页目前完全没有真实照片。产品实拍图与公司照片是最缺的内容 —— 首页的产品橱窗区块最需要它。',
        caution: '首页 Hero 目前是文字型设计，直接塞旧站 Banner 会破坏版式与英文可读性。',
      },
      Factory: {
        target_page: 'http://localhost:3000/factory (website/src/app/(site)/factory/page.tsx)',
        current_state: '四个工序（Machining/Assembly/Automated Assembly/Testing）全部为纯文字，无工序照片',
        candidates: toRef([...factory, ...products.slice(0, 3)]),
        recommendation: '旧站「厂房厂貌」与「生产设备」栏目照片正是这里缺的内容，建议按四个工序挑选对应照片。',
        caution: '需逐张确认照片与"该工序"是否真的一致——不得为了让版面好看而错误标注工序。',
      },
      Quality: {
        target_page: 'http://localhost:3000/quality (website/src/app/(site)/quality/page.tsx)',
        current_state: '体系与证书区块为占位，等待质量部门确认',
        candidates: toRef([...certs, ...docs]),
        recommendation: '旧站「荣誉资质」的证书图片可作为 IATF 16949 / ISO 14001 / ISO 45001 之外的补充材料来源。',
        caution: '证书必须逐张核对有效期与适用范围；已过期证书严禁上站（见 content_review 的 Outdated 判定）。',
      },
      'About Bowen': {
        target_page: 'http://localhost:3000/about (website/src/app/(site)/about/page.tsx)',
        current_state: '公司事实（2009 年建厂、10000㎡ 等）来自公司资料，配图为空',
        candidates: toRef([...company, ...other.slice(0, 4)]),
        recommendation: '公司外景、厂区照片适合用于 About 页增强真实感。',
        caution: '旧站公司简介文字为国内营销腔调，只能作为事实核对来源，不可直译。',
      },
      Contact: {
        target_page: 'http://localhost:3000/contact (website/src/app/(site)/contact/page.tsx)',
        current_state: '邮箱为占位；公司注册信息、电话、地址、地图均标注 pending',
        candidates: toRef([...company.slice(0, 4)]),
        recommendation: '旧站可提供"注册公司全称"等可核对事实；地图/二维码类素材不建议使用。',
        caution: '旧站电话 0537-4598999、地址「曲阜市东开发区台湾工业园创业大道新竹路」属国内渠道，英文站是否公开需业务方决定，不得默认沿用。',
      },
    },
    not_recommended: {
      count: okAssets.filter((a) => a.reuse_status === 'not_recommended').length,
      examples: okAssets.filter((a) => a.reuse_status === 'not_recommended').slice(0, 15).map((a) => ({ local_file: a.local_file, note: a.classification_evidence })),
      reason: '模板装饰、图标、二维码、加载图等对英文站无价值或会带来品牌风险。',
    },
    counts: {
      product_images: countDir('images/products'),
      factory_images: countDir('images/factory'),
      certificate_images: countDir('images/certificates'),
      company_images: countDir('images/company'),
      other_images: countDir('images/other'),
      documents: countDir('documents'),
    },
  };
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
