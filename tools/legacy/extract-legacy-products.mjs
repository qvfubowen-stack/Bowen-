/**
 * Phase 3.5 / D 的前置步骤 —— 从已抓取的详情页中提取产品结构化字段
 * ---------------------------------------------------------------------
 * 运行：node tools/legacy/extract-legacy-products.mjs
 *
 * 只提取**页面自己写明的**字段（OEM号码 / 适用车型 / 博文编号 / 技术参数），
 * 不做任何推断。页面没写就是 null，绝不从图片外观或标题猜编号。
 *
 * 产物：data/legacy-site/legacy-products.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePage, stripTags, decodeEntities } from './lib/html.mjs';
import { SPEC_COLUMNS, classifyPage, contentIdOf } from './lib/classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CRAWL = path.join(ROOT, 'data', 'legacy-site', 'crawl');
const HTML_DIR = path.join(CRAWL, 'html');

/** 解析所有 <table> 为 rows/cells */
export function parseTables(html) {
  const tables = [];
  for (const tm of String(html).matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const rows = [];
    for (const rm of tm[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rm[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

/** 在表格里找出规格表：表头命中已知中文列名 */
export function extractSpecTable(tables) {
  for (const rows of tables) {
    const header = rows[0] || [];
    const map = {};
    for (const col of SPEC_COLUMNS) {
      const idx = header.findIndex((h) => col.zh.some((z) => (h || '').replace(/\s/g, '').includes(z)));
      if (idx >= 0) map[col.key] = idx;
    }
    if (map.bowen_no !== undefined || map.oe !== undefined) {
      const dataRows = rows.slice(1).filter((r) => r.some((c) => (c || '').trim()));
      return {
        header,
        columnMap: map,
        rows: dataRows.map((r) => ({
          oe: map.oe !== undefined ? (r[map.oe] || '') : '',
          vehicle: map.vehicle !== undefined ? (r[map.vehicle] || '') : '',
          bowenNo: map.bowen_no !== undefined ? (r[map.bowen_no] || '') : '',
          spec: map.spec !== undefined ? (r[map.spec] || '') : '',
        })),
      };
    }
  }
  return null;
}

function splitMulti(s) {
  return String(s || '')
    .split(/[\s,，、;；\/|]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function main() {
  const pagesFile = path.join(CRAWL, 'pages.json');
  if (!fs.existsSync(pagesFile)) throw new Error('缺少 pages.json，请先运行 crawl-legacy-site.mjs');
  const crawl = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));

  // 先用粗分类建立"来源列表页归属"，供详情页继承
  const byUrl = new Map(crawl.pages.map((p) => [p.url, p]));
  const coarseOf = new Map();
  for (const p of crawl.pages) {
    coarseOf.set(p.url, classifyPage(p).coarse);
  }
  for (const p of crawl.pages) {
    p.discoveredFromCoarse = p.discoveredFrom ? coarseOf.get(p.discoveredFrom) || null : null;
  }

  const products = [];
  const nonProducts = [];

  for (const p of crawl.pages) {
    const cid = contentIdOf(p.url);
    if (cid === null) continue;
    const file = path.join(HTML_DIR, p.name + '.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const parsed = parsePage(html, p.url);
    const tables = parseTables(html);
    const spec = extractSpecTable(tables);

    // 面包屑：您现在的位置： 网站首页 > 产品中心 > 奇瑞系列
    const crumbM = html.match(/您现在的位置[：:]([\s\S]{0,400}?)<\/(?:div|p|td|h\d)>/i);
    let crumbs = [];
    if (crumbM) {
      crumbs = [...crumbM[1].matchAll(/>([^<>]+)/g)]
        .map((m) => decodeEntities(m[1]).trim())
        // 过滤掉纯分隔符（> / >> / » 等），只保留真实栏目名
        .filter((s) => s && !/^[>»›\-\s/|]+$/.test(s));
    }

    // 产品名取 <title> 首段。旧站 title 形如「产品名-栏目/系列-公司全称-关键词堆砌」，
    // 面包屑末级在部分页面是"系列"而非产品名，因此不能直接当产品名用。
    const titleSegs = String(p.title || '').split('-').map((s) => s.trim()).filter(Boolean);
    const productNameFromTitle = titleSegs[0] || null;
    const categoryFromTitle = titleSegs[1] || null;

    // 主图：详情区里的产品图（/upLoad/product/ 优先，其次 /upload/image/）
    const detailImgs = parsed.images
      .map((i) => i.abs)
      .filter((u) => /\/upLoad\/product\//i.test(u) || /\/upload\/image\//i.test(u));

    const rec = {
      legacy_page_id: cid,
      source_url: p.url,
      page_title: p.title,
      breadcrumbs: crumbs,
      product_name_zh: productNameFromTitle || (crumbs.length ? crumbs[crumbs.length - 1] : null),
      product_name_source: productNameFromTitle ? 'title_first_segment' : 'breadcrumb_last',
      series_zh: categoryFromTitle || null,
      first_category_zh: crumbs.length > 1 ? crumbs[1] : null,
      has_spec_table: !!spec,
      spec_header: spec ? spec.header : null,
      spec_rows: spec ? spec.rows : [],
      oe_numbers: spec ? [...new Set(spec.rows.flatMap((r) => splitMulti(r.oe)))] : [],
      bowen_nos: spec ? [...new Set(spec.rows.flatMap((r) => splitMulti(r.bowenNo)))] : [],
      vehicles: spec ? [...new Set(spec.rows.flatMap((r) => splitMulti(r.vehicle)))] : [],
      specs: spec ? [...new Set(spec.rows.map((r) => (r.spec || '').trim()).filter(Boolean))] : [],
      published_at: (html.match(/发布时间[：:]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/) || [])[1] || null,
      detail_image_urls: [...new Set(detailImgs)],
      all_image_urls: p.imageUrls,
      text: p.text,
    };
    rec.page_category = classifyPage({ ...p, legacyProduct: { bowenNo: rec.bowen_nos[0] || null, oeNumbers: rec.oe_numbers } }).coarse;

    if (rec.page_category === 'product') products.push(rec);
    else nonProducts.push(rec);
  }

  products.sort((a, b) => a.legacy_page_id - b.legacy_page_id);
  nonProducts.sort((a, b) => a.legacy_page_id - b.legacy_page_id);

  const out = {
    generated_at: new Date().toISOString(),
    source: crawl.origin,
    product_detail_page_count: products.length,
    other_detail_page_count: nonProducts.length,
    with_spec_table: products.filter((p) => p.has_spec_table).length,
    with_bowen_no: products.filter((p) => p.bowen_nos.length).length,
    with_oe_only: products.filter((p) => !p.bowen_nos.length && p.oe_numbers.length).length,
    with_no_structured_fields: products.filter((p) => !p.bowen_nos.length && !p.oe_numbers.length).length,
    products,
    other_detail_pages: nonProducts,
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'legacy-site', 'legacy-products.json'), JSON.stringify(out, null, 2));

  console.log(`product detail pages : ${products.length}`);
  console.log(`  with spec table    : ${out.with_spec_table}`);
  console.log(`  with Bowen No.     : ${out.with_bowen_no}`);
  console.log(`  OE only            : ${out.with_oe_only}`);
  console.log(`  no structured data : ${out.with_no_structured_fields}`);
  console.log(`other detail pages   : ${nonProducts.length}`);
  console.log('sample:', JSON.stringify(products.find((p) => p.bowen_nos.length) || products[0], null, 1).slice(0, 900));
}

main();
