#!/usr/bin/env node
/**
 * Phase 4 — 把「已核实的真实图片」接进 Bowen Website Prototype
 * Phase 4.1 — 接入公开产品准入规则（无可靠主图的产品不进网站）
 * ===========================================================================
 * 这个脚本是**唯一的**图片入库入口，产出全部落在 website/ 内，
 * 网页运行时绝不读取 data/ 目录。
 *
 * 输入（只读，绝不修改）
 * ---------------------------------------------------------------------------
 *   data/processed/product-image-map.json   产品主图锚点映射（Excel 内嵌图 → Bowen No.）
 *   data/processed/product-images/*         产品图文件本体
 *   data/derived/v2/products.json           内部产品库（决定状态与是否 blocked）
 *   data/derived/v2/product-applications.json 内部 application 库
 *   宣传手册最终PDF/博文公司宣传手册-英文版.pdf   工厂 / 公司 / 证书图片的唯一来源
 *
 * 发布集合的来源（Phase 4.1 关键改动）
 * ---------------------------------------------------------------------------
 * 产品图**不再**根据 website/src/data/products.json 决定要复制哪些（那会形成
 * 「网站产品表 ↔ 图片映射」的循环依赖）。改为与 build-product-db-v2.mjs 共用
 * tools/lib/publication-gate.mjs：从「内部产品状态 + 源图片映射」共同算出发布集合。
 * 两个脚本因此必然得到同一组 product_id。
 *
 * 产出
 * ---------------------------------------------------------------------------
 *   website/public/assets/products/<bw-id>[-<sha8>].<ext>
 *   website/public/assets/factory/<name>.jpg
 *   website/public/assets/company/<name>.jpg
 *   website/public/assets/certificates/<name>.jpg
 *   website/src/data/product-images.json     product_id → /assets/products/...
 *   website/src/data/site-media.json         工厂/公司/证书图片清单（含 alt 与来源页）
 *   tmp/p4/asset-build-report.json           本次构建的完整账目（供验收复核）
 *
 * 用法
 *   node tools/p4-build-site-assets.mjs            # 构建
 *   node tools/p4-build-site-assets.mjs --verify   # 只校验（**只读**，不复制、不写文件）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  readPublicationGate,
  isReliablePrimaryImageRecord,
  sourceImageFileName,
} from './lib/publication-gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const R = (...p) => path.join(ROOT, ...p);

const WEBSITE = R('website');
const PUBLIC = path.join(WEBSITE, 'public');
const DATA_OUT = path.join(WEBSITE, 'src', 'data');

const IMAGE_MAP = R('data', 'processed', 'product-image-map.json');
const IMAGE_DIR = R('data', 'processed');
const INTERNAL_PRODUCTS = R('data', 'derived', 'v2', 'products.json');
const BROCHURE = R('宣传手册最终PDF', '博文公司宣传手册-英文版.pdf');

const VERIFY_ONLY = process.argv.includes('--verify');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const sha8 = (b) => sha256(b).slice(0, 8);

// ===========================================================================
// 宣传手册图片：抽取 + 人工核对过的命名表
// ===========================================================================
/**
 * 从 PDF 中按「页」抽出内嵌 DCTDecode 图片。
 * 该 PDF 是传统 xref 结构（无 ObjStm / 无 XRef 流），页面对象未压缩，
 * /Resources <</... /XObject <</IMnn nn 0 R ...>>>> 直接可读。
 */
function extractPdfImages(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');

  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  const starts = [];
  let m;
  while ((m = objRe.exec(s)) !== null) starts.push({ num: Number(m[1]), at: m.index, bodyAt: objRe.lastIndex });

  const objs = new Map();
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const endObj = s.indexOf('endobj', cur.bodyAt);
    const nextAt = i + 1 < starts.length ? starts[i + 1].at : s.length;
    const stop = endObj >= 0 && endObj < nextAt ? endObj : nextAt;
    const body = s.slice(cur.bodyAt, stop);
    const si = body.indexOf('stream');
    let streamStart = -1;
    let streamEnd = -1;
    if (si >= 0) {
      let d = cur.bodyAt + si + 6;
      if (buf[d] === 0x0d) d++;
      if (buf[d] === 0x0a) d++;
      streamStart = d;
      streamEnd = s.indexOf('endstream', d);
    }
    objs.set(cur.num, { dictText: body.slice(0, si >= 0 ? si : body.length), streamStart, streamEnd });
  }

  const pages = [];
  for (const [num, o] of objs) {
    if (!/\/Type\s*\/Page[^s]/.test(o.dictText)) continue;
    const candidates = [o.dictText];
    const resRef = o.dictText.match(/\/Resources\s+(\d+)\s+0\s+R/);
    if (resRef && objs.has(Number(resRef[1]))) candidates.push(objs.get(Number(resRef[1])).dictText);

    let imgs = [];
    for (const c of candidates) {
      const xo = c.match(/\/XObject\s*<<([^>]*)>>/);
      if (!xo) continue;
      imgs = [...xo[1].matchAll(/\/([A-Za-z0-9#_.-]+)\s+(\d+)\s+0\s+R/g)]
        .map((x) => ({ name: x[1], num: Number(x[2]) }))
        .filter((r) => objs.has(r.num) && /\/Subtype\s*\/Image/.test(objs.get(r.num).dictText));
      if (imgs.length) break;
    }
    pages.push({ pageObj: num, images: imgs });
  }
  pages.sort((a, b) => a.pageObj - b.pageObj);

  const byPage = new Map();
  pages.forEach((p, i) => {
    const list = [];
    for (const img of p.images) {
      const o = objs.get(img.num);
      if (!o || o.streamStart < 0) continue;
      const filter = (o.dictText.match(/\/Filter\s*\/(\w+)/) ?? [])[1] ?? '?';
      if (filter !== 'DCTDecode') continue; // 手册里的照片与证书全部是 JPEG
      list.push({
        name: img.name,
        obj: img.num,
        width: Number((o.dictText.match(/\/Width\s+(\d+)/) ?? [])[1] ?? 0),
        height: Number((o.dictText.match(/\/Height\s+(\d+)/) ?? [])[1] ?? 0),
        buffer: buf.subarray(o.streamStart, o.streamEnd),
      });
    }
    byPage.set(i + 1, list);
  });
  return byPage;
}

/**
 * 人工核对过的「手册页 → 站点资产名」表。
 * 每一条都实地打开过原图核对内容与手册图注（见 docs/phase-4-...md 第 4 节）。
 * 不在此表内的手册图片（封面、产品系列配图、仓库、封底等）本阶段不使用。
 */
const BROCHURE_ASSETS = [
  // ---- 公司 / 厂区 ----
  { group: 'company', file: 'factory-buildings.jpg', page: 3, obj: 26,
    caption: 'Factory buildings at the Bowen manufacturing site' },
  { group: 'company', file: 'assembly-workshop.jpg', page: 11, obj: 66,
    caption: 'Assembly workshop at the Bowen factory' },
  // ---- 工厂环境 ----
  { group: 'factory', file: 'production-workshop.jpg', page: 5, obj: 37,
    caption: 'Production workshop with defined aisles and workstations' },
  { group: 'factory', file: 'machining-workshop.jpg', page: 5, obj: 38,
    caption: 'Machining workshop' },
  { group: 'factory', file: 'component-assembly-workshop.jpg', page: 5, obj: 39,
    caption: 'Component assembly workshop' },
  // ---- 自动化生产 ----
  { group: 'factory', file: 'automatic-assembly-area.jpg', page: 6, obj: 42,
    caption: 'Automatic assembly area' },
  { group: 'factory', file: 'automatic-assembly-machine-20-series.jpg', page: 6, obj: 43,
    caption: '20 series automatic assembly machine' },
  { group: 'factory', file: 'automatic-assembly-machine-211-series.jpg', page: 6, obj: 44,
    caption: '211 series automatic assembly machine' },
  // ---- 生产设备 ----
  { group: 'factory', file: 'cnc-machining-equipment.jpg', page: 7, obj: 47,
    caption: 'CNC machining equipment' },
  { group: 'factory', file: 'automatic-assembly-machine-24-series.jpg', page: 7, obj: 48,
    caption: '24 series automatic assembly machine' },
  { group: 'factory', file: 'rubber-plug-assembly-machine.jpg', page: 7, obj: 49,
    caption: 'Rubber plug automatic assembly machine' },
  { group: 'factory', file: 'automatic-riveting-machine.jpg', page: 7, obj: 50,
    caption: 'Automatic riveting machine' },
  // ---- 检验与测试（Quality 页的设备图） ----
  { group: 'factory', file: 'sensing-element-test-machine-211-series.jpg', page: 8, obj: 53,
    caption: '211 series sensing element adjustment and testing machine' },
  { group: 'factory', file: 'sensing-element-test-machine-20-24-series.jpg', page: 8, obj: 54,
    caption: '20 and 24 series sensing element adjustment and testing machine' },
  { group: 'factory', file: 'thermostat-life-test-bench.jpg', page: 8, obj: 55,
    caption: 'Thermostat life test bench' },
  // ---- 证书 ----
  { group: 'certificates', file: 'iatf-16949-certificate.jpg', page: 12, obj: 69,
    caption: 'IATF 16949:2016 certificate, issued by NQA' },
  { group: 'certificates', file: 'high-tech-enterprise-certificate.jpg', page: 13, obj: 72,
    caption: 'High-tech Enterprise Certificate' },
  { group: 'certificates', file: 'work-safety-standardization-certificate.jpg', page: 13, obj: 73,
    caption: 'Work Safety Standardization Certificate' },
  { group: 'certificates', file: 'innovative-sme-2026-public-list.jpg', page: 13, obj: 74,
    caption: 'Shandong Province 2026 Innovative SME public list — entry No. 3380' },
];

/** alt 文本：图片内容 + 公司名，不含未核实信息 */
const ALT_PREFIX = {
  company: 'Bowen manufacturing site',
  factory: 'Bowen factory',
  certificates: 'Bowen certificate',
};
const altFor = (a) => `${ALT_PREFIX[a.group]} — ${a.caption}`;

// ===========================================================================
// 构建
// ===========================================================================
function build() {
  const report = {
    generated_at: new Date().toISOString(),
    product_images: {
      selected: 0, copied: 0, skipped_not_in_public_set: 0, bytes: 0,
      by_category: {}, files: [],
    },
    brochure_images: { copied: 0, bytes: 0, files: [] },
    notes: [],
  };

  // ---------- 1. 产品主图 ----------
  // 发布集合由 tools/lib/publication-gate.mjs 统一计算（与 build-product-db-v2.mjs 同一个函数）。
  const gate = readPublicationGate(ROOT);
  const internalProducts = JSON.parse(fs.readFileSync(INTERNAL_PRODUCTS, 'utf8'));
  const productById = new Map(internalProducts.map((p) => [p.product_id, p]));

  report.product_images.eligible_records = gate.counts.reliable_primary_image_products;
  report.product_images.eligible_distinct_products = gate.counts.reliable_primary_image_products;
  report.product_images.published_products = gate.counts.published_products;
  report.product_images.duplicate_primary_products = gate.duplicatePrimaryProducts.map((d) => d.product_id);
  report.product_images.excluded_no_reliable_image = gate.excluded.no_reliable_image.map((x) => x.product_id);
  report.product_images.skipped_not_in_public_set =
    gate.counts.reliable_primary_image_products - gate.counts.published_products;

  const productImages = {};
  const outDir = path.join(PUBLIC, 'assets', 'products');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [pid, rec] of [...gate.publishedImageByProduct.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const srcFile = sourceImageFileName(rec);
    const srcPath = path.join(IMAGE_DIR, srcFile);
    if (!fs.existsSync(srcPath)) { report.notes.push(`缺文件，已跳过：${srcFile} (${pid})`); continue; }
    const bytes = fs.readFileSync(srcPath);
    const ext = path.extname(srcFile).toLowerCase().replace('.jpeg', '.jpg');
    const outName = `${pid.toLowerCase()}${ext === '.jpg' ? '' : '-' + sha8(bytes)}${ext}`;
    fs.writeFileSync(path.join(outDir, outName), bytes);

    const src = `/assets/products/${outName}`;
    productImages[pid] = src;
    const cat = productById.get(pid)?.website_category ?? 'unknown';
    report.product_images.by_category[cat] = (report.product_images.by_category[cat] ?? 0) + 1;
    report.product_images.copied += 1;
    report.product_images.bytes += bytes.length;
    report.product_images.files.push({
      product_id: pid,
      bowen_no: productById.get(pid)?.bowen_no ?? rec.bowen_no,
      src,
      source_file: `data/processed/${srcFile}`,
      source_sha256: sha256(bytes),
      mapping_status: rec.mapping_status,
      is_primary_image: rec.is_primary_image,
      image_id: rec.image_id ?? null,
      width: null,
      height: null,
      product_type: productById.get(pid)?.product_type ?? null,
      website_category: cat,
    });
  }
  report.product_images.selected = Object.keys(productImages).length;

  // ---------- 2. 宣传手册图片 ----------
  const byPage = extractPdfImages(BROCHURE);
  const siteMedia = { generated_at: report.generated_at, source: {}, company: [], factory: [], certificates: [] };
  siteMedia.source = {
    primary_evidence: '宣传手册最终PDF/博文公司宣传手册-英文版.pdf',
    extraction: 'zero-dependency PDF object/xref scan (tools/p4-build-site-assets.mjs)',
    legacy_site_assets_excluded:
      'data/legacy-site/assets.json 中 page_category = factory(10) / company(9) / certificate(7) '
      + '共 26 条素材，reuse_status 全部为 review_required 或 not_recommended，本阶段一条未用。',
  };

  for (const a of BROCHURE_ASSETS) {
    const list = byPage.get(a.page) ?? [];
    const img = list.find((x) => x.obj === a.obj);
    if (!img) { report.notes.push(`手册第 ${a.page} 页找不到图片对象 ${a.obj}，已跳过 ${a.file}`); continue; }
    const dir = path.join(PUBLIC, 'assets', a.group);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, a.file), img.buffer);

    siteMedia[a.group].push({
      src: `/assets/${a.group}/${a.file}`,
      alt: altFor(a),
      caption: a.caption,
      brochure_page: a.page,
      source_object: `IM${a.obj}`,
      width: img.width,
      height: img.height,
      source_sha256: sha256(img.buffer),
      source_evidence: `宣传手册-英文版 P${a.page}`,
    });
    report.brochure_images.copied += 1;
    report.brochure_images.bytes += img.buffer.length;
    report.brochure_images.files.push({
      group: a.group, file: a.file, page: a.page, obj: a.obj,
      width: img.width, height: img.height, bytes: img.buffer.length, sha256: sha256(img.buffer),
    });
  }

  // ---------- 3. 写 JSON ----------
  const productImagesJson = {
    generated_at: report.generated_at,
    note:
      'product_id → 站点图片路径。内容 = tools/lib/publication-gate.mjs 计算的公开产品集合，'
      + "即同时满足：状态可展示 + 未 blocked + 源图片映射 mapping_status='exact' 且 "
      + 'is_primary_image=true（每个 product_id 只有一张选定主图）+ 至少 1 条可展示的 application。'
      + '没有可靠主图的产品不进网站数据集，也不会出现在这里。',
    source: 'data/processed/product-image-map.json + data/derived/v2/products.json（准入规则见 tools/lib/publication-gate.mjs）',
    count: Object.keys(productImages).length,
    images: productImages,
  };
  fs.mkdirSync(DATA_OUT, { recursive: true });
  fs.writeFileSync(path.join(DATA_OUT, 'product-images.json'), JSON.stringify(productImagesJson, null, 1) + '\n', 'utf8');

  siteMedia.counts = {
    company: siteMedia.company.length,
    factory: siteMedia.factory.length,
    certificates: siteMedia.certificates.length,
    total: siteMedia.company.length + siteMedia.factory.length + siteMedia.certificates.length,
  };
  fs.writeFileSync(path.join(DATA_OUT, 'site-media.json'), JSON.stringify(siteMedia, null, 1) + '\n', 'utf8');

  const reportPath = R('tmp', 'p4', 'asset-build-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1), 'utf8');

  return { report, productImages, siteMedia };
}

// ===========================================================================
// 校验（**只读**：不复制文件、不写 JSON、不改动任何数据）
// ===========================================================================
function verify() {
  const problems = [];
  const note = (m) => { problems.push(m); };
  const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const productsOutDir = path.join(PUBLIC, 'assets', 'products');

  const pi = readJson(path.join(DATA_OUT, 'product-images.json'));
  const sm = readJson(path.join(DATA_OUT, 'site-media.json'));
  const siteProducts = readJson(path.join(DATA_OUT, 'products.json'));
  const siteApps = readJson(path.join(DATA_OUT, 'applications.json'));
  const siteOe = readJson(path.join(DATA_OUT, 'oe-index.json'));
  const rawImageMap = readJson(IMAGE_MAP);

  // ---- 0. 从源数据重新计算发布集合（不信任已有产物）----
  const gate = readPublicationGate(ROOT);
  const published = gate.publishedProductIds;

  console.log('--- 0. 发布集合（从源数据重新计算，与 build-product-db-v2.mjs 同一函数）---');
  console.log(`内部产品 ${gate.counts.internal_products} 个 → 公开产品 ${gate.counts.published_products} 个；`
    + `无可靠主图被排除 ${gate.counts.excluded_no_reliable_image} 个`);
  if (gate.duplicatePrimaryProducts.length) {
    note(`同一 product_id 有多张 exact+primary 图: ${gate.duplicatePrimaryProducts.map((d) => d.product_id).join(', ')}`);
  }
  console.log(`每个 product_id 唯一主图: ${gate.duplicatePrimaryProducts.length === 0 ? '是' : '否'}`);

  // ---- 1. 源映射本身：exact + primary + 文件存在 ----
  console.log('\n--- 1. 源图片映射（data/processed/product-image-map.json）---');
  const statusTally = {};
  for (const r of rawImageMap.images) statusTally[r.mapping_status] = (statusTally[r.mapping_status] ?? 0) + 1;
  console.log(`映射记录 ${rawImageMap.images.length} 条：${JSON.stringify(statusTally)}`);
  console.log(`必查：source 端 exact+primary 记录数 = ${gate.counts.reliable_primary_image_products}`);
  for (const [pid, rec] of gate.publishedImageByProduct) {
    if (!isReliablePrimaryImageRecord(rec)) note(`发布主图记录不是 exact+primary: ${pid} (${rec.mapping_status})`);
    const f = path.join(IMAGE_DIR, sourceImageFileName(rec));
    if (!fs.existsSync(f)) note(`源文件不存在: ${pid} → ${sourceImageFileName(rec)}`);
  }

  // ---- 2. product-images.json 与发布集合必须完全一致 ----
  console.log('\n--- 2. product-images.json ↔ 公开产品集合 ---');
  console.log(`条目数: ${pi.count}`);
  const piIds = Object.keys(pi.images);
  if (pi.count !== piIds.length) note(`count 字段(${pi.count}) 与实际条目(${piIds.length}) 不一致`);
  const missingImage = [...published].filter((pid) => !piIds.includes(pid));
  const extraImage = piIds.filter((pid) => !published.has(pid));
  if (missingImage.length) note(`${missingImage.length} 个公开产品没有图片映射: ${missingImage.slice(0, 10).join(', ')}`);
  if (extraImage.length) note(`图片映射里有 ${extraImage.length} 个不在公开产品集合里的产品: ${extraImage.slice(0, 10).join(', ')}`);
  console.log(`公开产品: ${published.size}；有图: ${piIds.length}；缺失: ${missingImage.length}；越界: ${extraImage.length}`);

  // 网站 products.json 必须恰好等于发布集合
  const siteIds = new Set(siteProducts.map((p) => p.product_id));
  const siteMissing = [...published].filter((pid) => !siteIds.has(pid));
  const siteExtra = [...siteIds].filter((pid) => !published.has(pid));
  if (siteMissing.length) note(`website/src/data/products.json 缺少 ${siteMissing.length} 个公开产品`);
  if (siteExtra.length) note(`website/src/data/products.json 多出 ${siteExtra.length} 个非公开产品: ${siteExtra.slice(0, 10).join(', ')}`);
  console.log(`website/src/data/products.json: ${siteIds.size} 个（应与公开集合一致）`);

  // ---- 3. 每个网站产品图片：存在 + 字节/哈希与源文件一致 ----
  console.log('\n--- 3. 网站图片与选定源文件一致性 ---');
  let hashOk = 0;
  for (const [pid, src] of Object.entries(pi.images)) {
    const rec = gate.publishedImageByProduct.get(pid);
    const outFile = path.join(PUBLIC, src.replace(/^\//, ''));
    if (!fs.existsSync(outFile)) { note(`网站图片文件不存在: ${src}`); continue; }
    if (!rec) { note(`图片映射没有对应源记录: ${pid}`); continue; }
    const srcFile = path.join(IMAGE_DIR, sourceImageFileName(rec));
    if (!fs.existsSync(srcFile)) { note(`源文件不存在: ${sourceImageFileName(rec)}`); continue; }
    const a = fs.readFileSync(outFile);
    const b = fs.readFileSync(srcFile);
    if (!a.equals(b)) note(`网站图片与源文件字节不一致: ${pid} (${src})`);
    else if (sha256(a) !== sha256(b)) note(`sha256 不一致: ${pid}`);
    else hashOk += 1;
  }
  console.log(`逐字节一致: ${hashOk}/${piIds.length}`);

  // ---- 4. review_required / unresolved / 非主图 / 无图产品 不得泄漏 ----
  console.log('\n--- 4. 泄漏检查（review_required / unresolved / 非主图 / 无图产品）---');
  // 4a. 每个发布产品选中的源记录必须是 exact + primary
  const badSelected = [...gate.publishedImageByProduct.entries()]
    .filter(([, rec]) => rec.mapping_status !== 'exact' || rec.is_primary_image !== true)
    .map(([pid]) => pid);
  if (badSelected.length) note(`选中主图不是 exact+primary: ${badSelected.join(', ')}`);
  console.log(`选中主图全部 exact+primary: ${badSelected.length === 0 ? '是' : '否'}`);

  // 4b. review_required / unresolved 的源**路径**不得被当作发布主图使用。
  //     注意：Excel 里同一张照片可能既挂在某个已确认产品下、又出现在一条 unresolved 记录里，
  //     因此按「路径」判定，而不是按字节。按字节会把这种同图复用误报为泄漏。
  const selectedSourcePaths = new Set(
    [...gate.publishedImageByProduct.values()].map((r) => sourceImageFileName(r)).filter(Boolean),
  );
  const reviewSourcePaths = new Set();
  for (const r of rawImageMap.images) {
    if (r.mapping_status === 'review_required' || r.mapping_status === 'unresolved') {
      const name = sourceImageFileName(r);
      if (name) reviewSourcePaths.add(name);
    }
  }
  const sharedPaths = [...reviewSourcePaths].filter((p) => selectedSourcePaths.has(p));
  const reviewOnlyPaths = [...reviewSourcePaths].filter((p) => !selectedSourcePaths.has(p));
  const copiedFiles = fs.readdirSync(productsOutDir).filter((f) => fs.statSync(path.join(productsOutDir, f)).isFile());
  console.log(`review_required/unresolved 源路径 ${reviewSourcePaths.size} 个：`
    + `与已发布主图共用同一文件 ${sharedPaths.length} 个（Excel 同图复用，不算泄漏），`
    + `仅属于 review 记录 ${reviewOnlyPaths.length} 个`);
  console.log(`review_required/unresolved 记录被直接选为发布主图: ${badSelected.length}（必须为 0）`);
  // review-only 的源**路径**不得被用作发布主图（按路径判定，不看字节）
  const leakedReviewPaths = [...selectedSourcePaths].filter((p) => reviewOnlyPaths.includes(p));
  if (leakedReviewPaths.length) note(`review_required / unresolved 专属源文件被当作发布主图: ${leakedReviewPaths.join(', ')}`);
  console.log(`review_required/unresolved 专属源文件被用作发布主图: ${leakedReviewPaths.length}（必须为 0）`);
  // 说明：Excel 里同一张照片可能同时挂在某产品下和一条 unresolved 记录里（内容重复），
  // 因此这里刻意**不**按字节比对，否则会把同图复用误报成泄漏。
  const reviewOnlyHashes = new Set(
    reviewOnlyPaths.map((p) => path.join(IMAGE_DIR, p)).filter((p) => fs.existsSync(p)).map((p) => sha256(fs.readFileSync(p))),
  );
  const contentTwin = copiedFiles.filter((f) => reviewOnlyHashes.has(sha256(fs.readFileSync(path.join(productsOutDir, f)))));
  console.log(`（参考信息）与 review-only 源文件字节相同的已发布图片: ${contentTwin.length} 张 `
    + `— 同一张照片在源表里被两条记录引用，属正常同图复用`);

  // 4c. 网站产品图目录里不能有多余文件
  const expectedFiles = new Set(Object.values(pi.images).map((s) => path.basename(s)));
  const extraFiles = copiedFiles.filter((f) => !expectedFiles.has(f));
  if (extraFiles.length) note(`website/public/assets/products 有多余文件: ${extraFiles.slice(0, 10).join(', ')}`);
  console.log(`产品图目录文件数 ${copiedFiles.length} / 公开产品 ${piIds.length} / 多余 ${extraFiles.length}（必须为 0）`);

  // 4d. 无图产品（含同时没有 application 的）绝不能出现在公开数据里
  const excludedNoImage = gate.excluded.no_reliable_image.map((x) => x.product_id);
  const excludedNoApp = gate.excluded.no_displayable_application.map((x) => x.product_id);
  const excludedBoth = gate.excluded.both.map((x) => x.product_id);
  const excludedAll = [...new Set([
    ...excludedNoImage, ...excludedNoApp, ...excludedBoth,
    ...gate.excluded.not_publishable_status.map((x) => x.product_id),
  ])];
  const leakedIntoWebsite = excludedAll.filter((pid) => siteIds.has(pid));
  if (leakedIntoWebsite.length) note(`被排除产品进入网站产品表: ${leakedIntoWebsite.join(', ')}`);
  const leakedApps = [...new Set(siteApps.filter((a) => excludedAll.includes(a.product_id)).map((a) => a.product_id))];
  if (leakedApps.length) note(`被排除产品仍有 application 进网站: ${leakedApps.join(', ')}`);
  const leakedOe = [...new Set(siteOe.filter((e) => excludedAll.includes(e.product_id)).map((e) => e.product_id))];
  if (leakedOe.length) note(`被排除产品仍有 OE 索引行进网站: ${leakedOe.join(', ')}`);
  console.log(`被排除产品（无图 ${excludedNoImage.length} / 无 application ${excludedNoApp.length} / `
    + `两者都缺 ${excludedBoth.length} / 状态不允许 ${gate.excluded.not_publishable_status.length}）进入公开数据: `
    + `${leakedIntoWebsite.length + leakedApps.length + leakedOe.length}（必须为 0）`);
  if (excludedNoImage.length) console.log(`  无可靠主图（有 application）: ${excludedNoImage.join(', ')}`);

  // ---- 5. site-media.json ----
  console.log('\n--- 5. site-media.json ---');
  for (const g of ['company', 'factory', 'certificates']) {
    for (const it of sm[g]) {
      const f = path.join(PUBLIC, it.src.replace(/^\//, ''));
      if (!fs.existsSync(f)) note(`文件不存在: ${it.src}`);
      else if (sha256(fs.readFileSync(f)) !== it.source_sha256) note(`sha256 不一致: ${it.src}`);
      if (!it.caption || !it.alt) note(`缺 caption/alt: ${it.src}`);
    }
    console.log(`${g}: ${sm[g].length} 张`);
  }

  // ---- 6. 禁止项 ----
  console.log('\n--- 6. 禁止项检查 ---');
  const allSrcs = [...Object.values(pi.images), ...['company', 'factory', 'certificates'].flatMap((g) => sm[g].map((x) => x.src))];
  const fromData = allSrcs.filter((s) => /data\//.test(s));
  if (fromData.length) note(`有页面资源指向 data/ 目录: ${fromData.join(', ')}`);
  console.log(`指向 data/ 目录的资源: ${fromData.length}（必须为 0）`);

  if (problems.length) {
    console.log(`\n❌ ${problems.length} 个问题：`);
    for (const p of problems.slice(0, 40)) console.log('  - ' + p);
    process.exit(1);
  }
  console.log('\n✅ 资产与源映射逐字节一致；公开产品集合、product-images.json、website/src/data 三者一致；'
    + 'review_required / unresolved / 无图产品 0 泄漏；0 个指向 data/ 的引用。');
}

const mode = VERIFY_ONLY ? 'verify' : 'build';
console.log(`Phase 4.1 站点资产 — ${mode}${VERIFY_ONLY ? '（只读校验，不写任何文件）' : ''}`);
console.log(`根目录: ${ROOT}\n`);

if (VERIFY_ONLY) {
  verify();
} else {
  const { report } = build();
  console.log(`产品图：源端可靠主图产品 ${report.product_images.eligible_records} 个；`
    + `写入 ${report.product_images.copied} 张（${(report.product_images.bytes / 1048576).toFixed(1)} MB）`);
  console.log(`公开产品 ${report.product_images.published_products} 个；`
    + `因无可靠主图被排除 ${report.product_images.excluded_no_reliable_image.length} 个`);
  console.log('按分类：', JSON.stringify(report.product_images.by_category));
  console.log(`手册图：${report.brochure_images.copied} 张（${(report.brochure_images.bytes / 1048576).toFixed(1)} MB）`);
  if (report.notes.length) { console.log('\n提示：'); for (const n of report.notes) console.log('  - ' + n); }
  console.log('\n已写出：');
  console.log('  website/src/data/product-images.json');
  console.log('  website/src/data/site-media.json');
  console.log('  tmp/p4/asset-build-report.json');
  console.log('\n--- 自动复核 ---\n');
  verify();
}
