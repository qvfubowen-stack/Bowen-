/**
 * Phase 3.5 —— 旧站页面 / 素材分类规则（单一事实来源）
 * ---------------------------------------------------------------------
 * 分类只用**可验证的证据**（URL 形态、列表页归属、页面自带字段），
 * 不靠"看起来像"。每条分类都附带 evidence 字段，方便人工复核。
 *
 * 站点栏目（从抓取结果的 title 与导航确认）：
 *   /about/?1.html   关于我们        /about/?57.html  企业文化
 *   /about/?6.html   联系我们        /about/?84.html  生产设备
 *   /list/?2_*.html  产品中心        /list/?58_*.html 系列产品
 *   /list/?3_*.html  荣誉资质        /list/?47_*.html 厂房厂貌
 *   /list/?4_*.html  新闻资讯        /gbook/...       在线留言
 *   /content/?N.html 详情页（产品 / 证书 / 新闻）
 */

export const LIST_SECTIONS = {
  2: { fine: 'products-list', coarse: 'product', zh: '产品中心' },
  58: { fine: 'products-list', coarse: 'product', zh: '系列产品' },
  3: { fine: 'certificates-list', coarse: 'certificate', zh: '荣誉资质' },
  47: { fine: 'factory-list', coarse: 'factory', zh: '厂房厂貌' },
  4: { fine: 'news-list', coarse: 'news', zh: '新闻资讯' },
};

/**
 * 产品类列表栏目 id（全部经抓取结果核对，标题即证据）：
 *   产品类型：65 水温度传感器 66 机油压力报警器 67 节温器 68 热敏开关
 *             69 刹车灯开关 70 倒车灯开关
 *   车型系列：8 比亚迪 9 标致雪铁龙雷诺 10 传祺 48 大众 49 福特 50 吉利哈弗
 *             51 奇瑞 59 日系 60 荣威名爵 61 三菱 62 长安 63 长城哈弗 64 通用
 *   以及 71..83：与上面同一批车型系列，挂在"系列产品"下
 */
export const PRODUCT_LIST_IDS = new Set([
  2, 58,
  65, 66, 67, 68, 69, 70,
  8, 9, 10, 48, 49, 50, 51, 59, 60, 61, 62, 63, 64,
  71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
]);

export function isProductSubList(id) {
  return PRODUCT_LIST_IDS.has(Number(id));
}

export const ABOUT_SECTIONS = {
  1: { fine: 'about-profile', coarse: 'company', zh: '关于我们' },
  57: { fine: 'about-culture', coarse: 'company', zh: '企业文化' },
  6: { fine: 'contact', coarse: 'contact', zh: '联系我们' },
  84: { fine: 'equipment', coarse: 'factory', zh: '生产设备' },
};

/** 产品页规格表里的中文列名 → 标准字段 */
export const SPEC_COLUMNS = [
  { key: 'oe', zh: ['OEM号码', 'OE号码', 'OE号', 'OEM号', 'OEM编号'] },
  { key: 'vehicle', zh: ['适用车型/机型', '适用车型', '车型/机型', '适用机型'] },
  { key: 'bowen_no', zh: ['博文编号', '博文号', '产品编号'] },
  { key: 'spec', zh: ['技术参数', '参数', '规格'] },
];

/** 解析 URL 里的栏目 id */
export function listIdOf(url) {
  const m = String(url).match(/\/list\/\?(\d+)_(\d+)\.html/i);
  return m ? { id: Number(m[1]), page: Number(m[2]) } : null;
}

export function aboutIdOf(url) {
  const m = String(url).match(/\/about\/\?(\d+)\.html/i);
  return m ? Number(m[1]) : null;
}

export function contentIdOf(url) {
  const m = String(url).match(/\/content\/\?(\d+)\.html/i);
  return m ? Number(m[1]) : null;
}

/**
 * 页面分类。page 为爬虫产出的记录（含 url / discoveredFrom / 详情页字段）。
 * extra.discoveredFromCategory 用于详情页继承列表归属。
 */
export function classifyPage(page) {
  const url = page.url || '';
  if (/^https?:\/\/[^/]+\/?$/.test(url)) return { fine: 'home', coarse: 'company', evidence: 'URL 为站点根路径' };

  const lid = listIdOf(url);
  if (lid) {
    const s = LIST_SECTIONS[lid.id];
    if (s) return { fine: s.fine, coarse: s.coarse, evidence: `列表栏目 id=${lid.id}（${s.zh}）` };
    if (isProductSubList(lid.id)) return { fine: 'products-list', coarse: 'product', evidence: `产品子分类列表 id=${lid.id}` };
    return { fine: 'list-unknown', coarse: 'other', evidence: `未识别列表栏目 id=${lid.id}` };
  }

  const aid = aboutIdOf(url);
  if (aid !== null) {
    const s = ABOUT_SECTIONS[aid];
    if (s) return { fine: s.fine, coarse: s.coarse, evidence: `关于栏目 id=${aid}（${s.zh}）` };
    return { fine: 'about-unknown', coarse: 'company', evidence: `未识别关于栏目 id=${aid}` };
  }

  if (/\/gbook\//i.test(url)) return { fine: 'guestbook', coarse: 'contact', evidence: '在线留言页' };

  const cid = contentIdOf(url);
  if (cid !== null) {
    // 详情页：优先用页面自带的结构化证据，其次用来源列表页的归属
    if (page.legacyProduct && page.legacyProduct.bowenNo) {
      return { fine: 'product-detail', coarse: 'product', evidence: `页面规格表含博文编号 ${page.legacyProduct.bowenNo}` };
    }
    if (page.legacyProduct && page.legacyProduct.oeNumbers && page.legacyProduct.oeNumbers.length) {
      return { fine: 'product-detail', coarse: 'product', evidence: '页面规格表含 OEM 号码' };
    }
    if (/\/upLoad\/product\//i.test(JSON.stringify(page.imageUrls || []))) {
      return { fine: 'product-detail', coarse: 'product', evidence: '页面含 /upLoad/product/ 产品图路径' };
    }
    const from = page.discoveredFromCoarse;
    if (from === 'certificate') return { fine: 'certificate-detail', coarse: 'certificate', evidence: '由荣誉资质列表链入' };
    if (from === 'news') return { fine: 'news-detail', coarse: 'news', evidence: '由新闻列表链入' };
    if (from === 'factory') return { fine: 'factory-detail', coarse: 'factory', evidence: '由厂房厂貌列表链入' };
    if (from === 'product') return { fine: 'product-detail', coarse: 'product', evidence: '由产品列表链入' };
    return { fine: 'content-unknown', coarse: 'other', evidence: '详情页无结构化归属证据' };
  }

  return { fine: 'other', coarse: 'other', evidence: '未匹配任何已知栏目形态' };
}

// ---------------------------------------------------------------------
// 素材分类
// ---------------------------------------------------------------------
const TEMPLATE_CHROME_RE = /\/Templates\/[^/]+\/(images|css|js)\//i;
const PRODUCT_UPLOAD_RE = /\/upLoad\/product\//i;
const IMAGE_UPLOAD_RE = /\/upload\/image\//i;

// 明显属于"国内站装饰/图标/栏目 Banner/二维码"的素材，不建议迁移。
// 这些文件名在旧站模板里是固定命名（nyb*=栏目头图、banner*=首页大图、
// wx*/ma*/logo/qq* = 二维码与图标、ny-proshow1-* = 40x40 小图标）。
// 用边界+前瞻避免误伤真实照片（如 sb01.jpg 生产设备照、about.jpg 公司照、cp*.jpg 产品图）。
const NOT_RECOMMENDED_RE = /(^|[/_\-])(logo|qrcode|erweima|ma|wx\d*|qq\d+|nyb\d+|banner\d*|ny-proshow1[-_][a-z0-9]+|icon|ico|arrow|btn|badge|share|loading|placeholder|spacer|blank)(?=[.\-_0-9]|$)/i;

// 访问控制类资源：验证码图片等。爬虫一律**不下载**，避免任何越界嫌疑。
const ACCESS_CONTROL_RE = /(checkcode|captcha|verifycode|validatecode|yzm)/i;

/**
 * 判断素材应该落到哪个目录 + 复用状态。
 * referencing: [{coarse, url}] —— 引用了该素材的页面
 *
 * ⚠️ 关键事实（抓取后核对得出）：
 *   旧站把**所有**上传图片都丢进同一个 `/upLoad/product/month_XXXX/` 目录——
 *   产品图、证书扫描件、厂房照片全在里面。因此 **URL 路径不能作为分类依据**。
 *   唯一可靠的主证据是"这张图被哪一类页面引用"。
 *   路径规则只作为"页面归属未知"时的兜底。
 */
export function classifyAsset(assetUrl, assetType, referencing = []) {
  const refs = referencing.map((r) => r.coarse);
  const uniq = [...new Set(refs)];
  const basename = String(assetUrl).split('/').pop().split('?')[0];

  if (assetType === 'document') {
    return { subdir: 'documents', page_category: uniq[0] || 'other', reuse: 'review_required',
      evidence: '文档/下载文件，需人工确认内容与时效' };
  }
  if (assetType === 'video') {
    return { subdir: 'images/other', page_category: uniq[0] || 'other', reuse: 'review_required',
      evidence: '视频素材，需人工确认版权与内容' };
  }

  const isTemplate = TEMPLATE_CHROME_RE.test(assetUrl);
  const looksDecorative = NOT_RECOMMENDED_RE.test(basename);

  // ① 装饰件优先判定：文件名特征即为证据。
  //    必须先于"按引用页面归类"，否则旧站那批只出现在产品页的二维码/小图标
  //    （ma.png / ny-proshow1-*.jpg）会被误当成产品照片。
  if (looksDecorative) {
    return {
      subdir: 'images/other',
      page_category: uniq[0] || 'other',
      reuse: 'not_recommended',
      evidence: `文件名特征显示为装饰/图标/二维码/栏目 Banner 类模板素材（${basename}），英文站不应原样沿用`,
    };
  }

  // ② 站点外壳：模板目录素材且被多类栏目共用（例如全站共用的图片）
  if (isTemplate && uniq.length >= 3) {
    return {
      subdir: 'images/other',
      page_category: 'other',
      reuse: 'review_required',
      evidence: `模板目录素材，被 ${uniq.length} 类页面共用（站点外壳），需人工判断是否复用`,
    };
  }

  // ③ 首页专属素材：首页是"混合内容页"（Banner + 产品橱窗 + 图标 + 公司图），
  //    无法仅凭引用关系可靠判定用途，一律进 other 并交人工确认——绝不假装知道它是什么。
  const fines = [...new Set(referencing.map((r) => r.fine).filter(Boolean))];
  const onlyHome = fines.length > 0 && fines.every((f) => f === 'home');
  if (onlyHome) {
    return {
      subdir: 'images/other',
      page_category: 'other',
      reuse: 'review_required',
      evidence: '仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认',
    };
  }

  // ④ 主证据：引用该素材的页面类别
  //    注意：真实内容照也可能放在 /Templates/cn/images/ 下（如 sb01-04.jpg 生产设备照、
  //    about.jpg 公司照），所以这里不按目录一刀切，而是按"被哪类页面引用"。
  const CATEGORY_DIR = {
    certificate: 'images/certificates',
    factory: 'images/factory',
    product: 'images/products',
    company: 'images/company',
    contact: 'images/company',
    news: 'images/other',
  };
  const PRIORITY = ['certificate', 'factory', 'product', 'company', 'contact', 'news'];
  const hit = PRIORITY.find((c) => uniq.includes(c));
  if (hit) {
    const detail = uniq.length > 1 ? `（同时被 ${uniq.join(' / ')} 类页面引用，按最具体类别归类）` : '';
    return {
      subdir: CATEGORY_DIR[hit],
      page_category: hit,
      reuse: 'review_required',
      evidence: `被「${hit}」类页面引用${detail}`,
    };
  }

  // ④ 兜底：页面归属未知时，才参考上传路径
  if (PRODUCT_UPLOAD_RE.test(assetUrl)) {
    return { subdir: 'images/products', page_category: 'product', reuse: 'review_required',
      evidence: 'URL 位于 /upLoad/product/ 且未被任何已知类别页面引用（路径兜底判断，需人工确认）' };
  }
  if (IMAGE_UPLOAD_RE.test(assetUrl)) {
    return { subdir: 'images/other', page_category: 'other', reuse: 'review_required',
      evidence: '/upload/image/ 上传目录素材，归属需人工确认' };
  }

  return { subdir: 'images/other', page_category: uniq[0] || 'other', reuse: 'review_required',
    evidence: uniq.length ? `被 ${uniq.join('/')} 类页面引用` : '未被任何已抓页面引用（孤立链接）' };
}

/** 生成保留原文件名、必要时加哈希前缀的本地文件名 */
export function localFileName(assetUrl, taken) {
  let base = decodeURIComponent(String(assetUrl).split('/').pop().split('?')[0] || 'file');
  base = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'file';
  if (base.length > 120) {
    const ext = (base.match(/\.[a-z0-9]+$/i) || [''])[0];
    base = base.slice(0, 100) + ext;
  }
  const key = base.toLowerCase();
  if (!taken.has(key)) { taken.add(key); return base; }
  // 同名不同 URL：加 URL 哈希前缀，保证可追溯
  const h = simpleHash(assetUrl).slice(0, 8);
  const cand = `${h}_${base}`;
  taken.add(cand.toLowerCase());
  return cand;
}

export function simpleHash(s) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }
  return h1.toString(16).padStart(8, '0');
}

export { TEMPLATE_CHROME_RE, PRODUCT_UPLOAD_RE, IMAGE_UPLOAD_RE, NOT_RECOMMENDED_RE, ACCESS_CONTROL_RE };
