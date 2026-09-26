/**
 * Phase 3.5 —— 旧站 HTML 解析器（纯 Node.js，零第三方依赖）
 * ---------------------------------------------------------------------
 * 旧站是 AspCms 生成的静态化 HTML，结构规整，用正则分词足够可靠，
 * 也不需要为了审计引入 cheerio 之类的第三方依赖（项目铁律：零依赖）。
 *
 * 解析产出：标题 / Meta / 各级标题 / 链接 / 图片 / 附件 / 视频 /
 *           样式脚本 / 可见正文 / 移动端与追踪相关信标。
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“',
  rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', mdash: '—', ndash: '–',
  middot: '·', times: '×', copy: '©', reg: '®', deg: '°', yen: '¥',
};

export function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g) => {
    if (g[0] === '#') {
      const code = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    const k = g.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : m;
  });
}

export function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** 把 href/src 解析成绝对 URL（相对路径以 pageUrl 为基准） */
export function resolveUrl(base, href) {
  if (!href) return null;
  const h = String(href).trim();
  if (!h || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) return null;
  if (/^\[[a-z]+:/i.test(h)) return null; // AspCms 未渲染的模板占位符，如 [cimages:title]
  try {
    return new URL(h, base).href;
  } catch {
    return null;
  }
}

/** 抓取某个标签的所有属性 */
function attrs(tag) {
  const out = {};
  for (const m of String(tag).matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]));
  }
  return out;
}

const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|avi|wmv|flv|webm|ogv|mkv)(\?|#|$)/i;
const IMG_EXT = /\.(jpe?g|png|gif|bmp|webp|svg|ico|tiff?)(\?|#|$)/i;

export function parsePage(html, pageUrl) {
  const raw = String(html);
  const head = (raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, raw])[1];

  const meta = (name) => {
    const re = new RegExp(`<meta[^>]*\\b(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, 'i');
    const m = head.match(re);
    if (!m) return null;
    const a = attrs(m[0]);
    return a.content ? a.content.trim() : null;
  };

  const titleM = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  // 各级标题
  const headings = {};
  for (const lvl of [1, 2, 3]) {
    headings['h' + lvl] = [...raw.matchAll(new RegExp(`<h${lvl}[^>]*>([\\s\\S]*?)</h${lvl}>`, 'gi'))]
      .map((m) => stripTags(m[1])).filter(Boolean);
  }

  // 链接
  const links = [];
  for (const m of raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = attrs('<a' + m[1] + '>');
    const abs = resolveUrl(pageUrl, a.href);
    links.push({
      href: a.href || null,
      abs,
      text: stripTags(m[2]).slice(0, 200),
      title: a.title || null,
      external: abs ? !/^https?:\/\/(www\.)?qfbowen\.com/i.test(abs) : false,
      isDocument: a.href ? DOC_EXT.test(a.href) : false,
      isVideo: a.href ? VIDEO_EXT.test(a.href) : false,
      rel: a.rel || null,
    });
  }

  // 图片（含懒加载属性与 <source srcset>）
  const images = [];
  const pushImg = (src, a, extra = {}) => {
    const abs = resolveUrl(pageUrl, src);
    if (!abs) return;
    images.push({
      src: String(src).trim(), abs,
      alt: a.alt || '', title: a.title || '',
      width: a.width || null, height: a.height || null,
      ...extra,
    });
  };
  for (const m of raw.matchAll(/<img\b([^>]*)\/?>/gi)) {
    const a = attrs('<img' + m[1] + '>');
    const src = a.src || a['data-src'] || a['data-original'] || a['data-lazy'] || null;
    if (src) pushImg(src, a, { lazy: !a.src });
  }
  for (const m of raw.matchAll(/<source\b([^>]*)\/?>/gi)) {
    const a = attrs('<source' + m[1] + '>');
    if (a.src) pushImg(a.src, a, { fromSource: true });
  }
  // 内联样式里的 background-image
  for (const m of raw.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const abs = resolveUrl(pageUrl, m[1]);
    if (abs) images.push({ src: m[1].trim(), abs, alt: '', title: '', fromCssInline: true });
  }

  const stylesheets = [...raw.matchAll(/<link\b([^>]*)>/gi)]
    .map((m) => attrs(m[0]))
    .filter((a) => (a.rel || '').toLowerCase().includes('stylesheet') && a.href)
    .map((a) => resolveUrl(pageUrl, a.href)).filter(Boolean);

  const scripts = [...raw.matchAll(/<script\b([^>]*)>/gi)]
    .map((m) => attrs(m[0]))
    .map((a) => resolveUrl(pageUrl, a.src)).filter(Boolean);

  // 视频 / 嵌入
  const videos = [];
  for (const m of raw.matchAll(/<(video|iframe|embed)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    const a = attrs('<' + tag + m[2] + '>');
    const src = a.src || a['data-src'] || null;
    const abs = resolveUrl(pageUrl, src);
    if (abs) videos.push({ tag, src, abs, type: a.type || null });
    else if (src) videos.push({ tag, src, abs: null, type: a.type || null });
  }

  // 可见正文：去掉脚本/样式后取 body
  const bodyM = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyM ? bodyM[1] : raw;
  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = stripTags(body);

  // 信标：把"国内站特征"显式记录下来，供内容质量审核（F）使用
  const beacons = {
    hasViewportMeta: /<meta[^>]*name=["']viewport["']/i.test(raw),
    baiduAnalytics: /hm\.baidu\.com/i.test(raw),
    googleAnalytics: /googletagmanager|google-analytics/i.test(raw),
    icpBeian: /(beian\.miit\.gov\.cn|ICP备|京ICP|鲁ICP)/i.test(raw),
    platform1688: /1688\.com/i.test(raw),
    taobaoOrTmall: /(taobao\.com|tmall\.com)/i.test(raw),
    wechatQr: /(微信|二维码|wx\d*\.png|ma\.png)/i.test(raw),
    qqContact: /(QQ[:：]|\.qq\.com|qrcode)/i.test(raw),
    guestbookForm: /\/gbook\//i.test(raw),
    templatePlaceholders: [...new Set([...raw.matchAll(/\[[a-z]+:[a-z_]+\]/gi)].map((m) => m[0]))],
  };

  return {
    url: pageUrl,
    title: titleM ? decodeEntities(titleM[1]).replace(/\s+/g, ' ').trim() : null,
    metaDescription: meta('description'),
    metaKeywords: meta('keywords'),
    metaRobots: meta('robots'),
    canonical: (() => {
      const m = raw.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
      if (!m) return null;
      const a = attrs(m[0]);
      return a.href ? resolveUrl(pageUrl, a.href) : null;
    })(),
    ogTitle: meta('og:title'),
    headings,
    links,
    images,
    stylesheets,
    scripts,
    videos,
    text,
    textLength: text.length,
    beacons,
    htmlBytes: Buffer.byteLength(raw, 'utf8'),
  };
}

export { DOC_EXT, VIDEO_EXT, IMG_EXT };
