/**
 * 公开产品准入规则（Phase 4.1）—— 网站数据导出层的**唯一**发布判定
 * ===========================================================================
 * 业务规则（业务方 2026 决定）：
 *   1. 没有可靠主图的产品暂不进入网站产品库；
 *   2. 网站公开产品必须同时满足：
 *        - 产品状态允许展示（prototype_candidate / searchable_noindex）；
 *        - 不属于 draft / blocked；
 *        - product_id 在可靠产品图片映射中；
 *        - 对应图片记录 mapping_status === 'exact' 且 is_primary_image === true；
 *        - 每个 product_id 只有一张选定主图；
 *        - 至少有 1 条可对外展示的 application。
 *
 * 为什么单独一个模块
 * ---------------------------------------------------------------------------
 * 发布集合必须由「内部产品状态 + 源图片映射」**共同**算出来，
 * 不能反过来用已过滤的网站产品表去决定图片资格（那会形成循环依赖）。
 * 因此：
 *   tools/build-product-db-v2.mjs   ← 用本模块决定网站 products/applications/oe-index
 *   tools/p4-build-site-assets.mjs  ← 用本模块决定复制哪些产品图
 * 两个脚本读同一组源文件、跑同一个函数，因此发布集合必然一致。
 *
 * 本模块不写任何文件；只读源数据（由调用方传入或由 readPublicationGate 读取）。
 * 不删除任何内部资料：被排除的产品在原数据里完整保留，只是不进网站数据集。
 */
import fs from 'node:fs';
import path from 'node:path';

/** 允许对外展示的产品状态 */
export const PUBLISHABLE_STATUSES = ['prototype_candidate', 'searchable_noindex'];

/** 唯一被接受的图片映射状态 */
export const RELIABLE_MAPPING_STATUS = 'exact';

/** 一条图片记录是否是「可靠主图」 */
export function isReliablePrimaryImageRecord(rec) {
  return Boolean(
    rec
    && rec.mapping_status === RELIABLE_MAPPING_STATUS
    && rec.is_primary_image === true
    && rec.product_id,
  );
}

/** 源图片文件名（优先使用裁剪后的文件） */
export function sourceImageFileName(rec) {
  return rec?.cropped_image_file ?? rec?.image_file ?? null;
}

/**
 * 某条 application 是否可对外展示。
 * 与 Phase 4 的网站导出规则保持一致：未阻断、不需人工复核，且至少有 OE 或车型内容。
 */
export function isDisplayableApplication(a) {
  if (!a) return false;
  if (a.blocked || a.needs_review) return false;
  return Boolean(a.oe_numbers_raw || a.vehicle_application_raw);
}

/**
 * 计算发布集合。
 *
 * @param {object} input
 * @param {any[]} input.products      内部产品库（data/derived/v2/products.json 的形状）
 * @param {any[]} input.applications  内部 application 库
 * @param {any}   input.imageMap      data/processed/product-image-map.json
 * @returns {object} 发布集合与审计信息
 */
export function computePublicationGate({ products, applications, imageMap }) {
  const images = imageMap?.images ?? [];

  // ---- 1. 可靠主图（exact + 主图 + 有 product_id）----
  const reliableByProduct = new Map();
  const duplicatePrimaryProducts = [];
  for (const rec of images) {
    if (!isReliablePrimaryImageRecord(rec)) continue;
    if (!reliableByProduct.has(rec.product_id)) reliableByProduct.set(rec.product_id, []);
    reliableByProduct.get(rec.product_id).push(rec);
  }
  const chosenImage = new Map();
  for (const [pid, list] of reliableByProduct) {
    if (list.length > 1) duplicatePrimaryProducts.push({ product_id: pid, count: list.length });
    chosenImage.set(pid, list[0]);
  }

  // ---- 2. 可对外展示的 application ----
  const displayableByProduct = new Map();
  for (const a of applications) {
    if (!isDisplayableApplication(a)) continue;
    if (!displayableByProduct.has(a.product_id)) displayableByProduct.set(a.product_id, []);
    displayableByProduct.get(a.product_id).push(a);
  }

  // ---- 3. 三个条件同时满足 ----
  // 排除原因按「维度」独立统计，不互相掩盖：
  //   no_reliable_image            = 有可展示 application，但没有可靠主图（业务方说的「无图产品」）
  //   no_displayable_application   = 有（或没有）图，但没有任何可展示的 application
  //   both                         = 两个都缺
  const publishableStatus = new Set(PUBLISHABLE_STATUSES);
  const publicProducts = [];
  const visibleApplicationIdsByProduct = new Map();
  const excluded = {
    not_publishable_status: [],
    blocked: [],
    no_reliable_image: [],
    no_displayable_application: [],
    both: [],
  };
  const allExcluded = [];

  for (const p of products) {
    if (!publishableStatus.has(p.status)) {
      const rec = { product_id: p.product_id, bowen_no: p.bowen_no, status: p.status, reasons: ['not_publishable_status'] };
      excluded.not_publishable_status.push(rec);
      allExcluded.push(rec);
      continue;
    }
    if (p.blocked) {
      const rec = { product_id: p.product_id, bowen_no: p.bowen_no, status: p.status, reasons: ['blocked'] };
      excluded.blocked.push(rec);
      allExcluded.push(rec);
      continue;
    }
    const apps = displayableByProduct.get(p.product_id) ?? [];
    const hasApp = apps.length > 0;
    const hasImage = chosenImage.has(p.product_id);
    if (hasApp && hasImage) {
      publicProducts.push(p);
      visibleApplicationIdsByProduct.set(p.product_id, apps.map((a) => a.application_id));
      continue;
    }
    const reasons = [];
    if (!hasImage) reasons.push('no_reliable_image');
    if (!hasApp) reasons.push('no_displayable_application');
    const rec = { product_id: p.product_id, bowen_no: p.bowen_no, status: p.status, reasons };
    if (!hasImage && !hasApp) excluded.both.push(rec);
    else if (!hasImage) excluded.no_reliable_image.push(rec);
    else excluded.no_displayable_application.push(rec);
    allExcluded.push(rec);
  }

  const publishedProductIds = new Set(publicProducts.map((p) => p.product_id));
  const publishedApplicationIds = new Set(
    [...visibleApplicationIdsByProduct.values()].flat(),
  );
  const publishedImageByProduct = new Map(
    [...chosenImage.entries()].filter(([pid]) => publishedProductIds.has(pid)),
  );

  const counts = {
    internal_products: products.length,
    publishable_status_products: products.filter((p) => publishableStatus.has(p.status)).length,
    published_products: publicProducts.length,
    excluded_not_publishable_status: excluded.not_publishable_status.length,
    excluded_blocked: excluded.blocked.length,
    excluded_no_reliable_image: excluded.no_reliable_image.length,
    excluded_no_displayable_application: excluded.no_displayable_application.length,
    excluded_both_image_and_application: excluded.both.length,
    reliable_primary_image_products: chosenImage.size,
    published_applications: publishedApplicationIds.size,
  };

  // 分类数量（审计用，页面不写死这些数字）
  const byCategory = {};
  for (const p of publicProducts) {
    const k = p.website_category ?? '(none)';
    byCategory[k] = (byCategory[k] ?? 0) + 1;
  }

  return {
    publishableStatuses: PUBLISHABLE_STATUSES,
    reliableMappingStatus: RELIABLE_MAPPING_STATUS,
    publicProducts,
    publishedProductIds,
    publishedApplicationIds,
    visibleApplicationIdsByProduct,
    publishedImageByProduct,
    duplicatePrimaryProducts,
    excluded,
    allExcluded,
    counts,
    byCategory,
  };
}

/**
 * 只读入口：从工作区读取源数据并计算发布集合。
 * 源文件（只读）：
 *   data/derived/v2/products.json            内部产品库（含 status / blocked）
 *   data/derived/v2/product-applications.json 内部 application 库
 *   data/processed/product-image-map.json     源图片映射（Excel 内嵌图 → Bowen No.）
 */
export function readPublicationGate(root) {
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const products = read(path.join(root, 'data/derived/v2/products.json'));
  const applications = read(path.join(root, 'data/derived/v2/product-applications.json'));
  const imageMap = read(path.join(root, 'data/processed/product-image-map.json'));

  const gate = computePublicationGate({ products, applications, imageMap });
  return {
    ...gate,
    sources: {
      products: 'data/derived/v2/products.json',
      applications: 'data/derived/v2/product-applications.json',
      image_map: 'data/processed/product-image-map.json',
    },
  };
}

/** 序列化为可写入 JSON 的审计产物（Map/Set → 数组/对象） */
export function publicationGateAudit(gate, { now = new Date().toISOString() } = {}) {
  const imageByProduct = {};
  for (const [pid, rec] of [...gate.publishedImageByProduct.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    imageByProduct[pid] = {
      image_id: rec.image_id ?? null,
      source_file: `data/processed/${sourceImageFileName(rec)}`,
      mapping_status: rec.mapping_status,
      is_primary_image: rec.is_primary_image,
      primary_rank: rec.primary_rank ?? null,
      bowen_no: rec.bowen_no ?? null,
    };
  }
  return {
    generated_at: now,
    rule:
      '公开产品 = 状态属于 [' + gate.publishableStatuses.join(', ') + ']'
      + ' 且未 blocked 且存在可靠主图（mapping_status=exact 且 is_primary_image=true）'
      + ' 且至少有 1 条可对外展示的 application。',
    note:
      '这是网站数据导出层的准入规则。被排除的产品在 data/derived/v2 与 data/processed 中完整保留，'
      + '仅不进入 website/src/data。',
    sources: gate.sources ?? null,
    counts: gate.counts,
    published_products_by_category: gate.byCategory,
    published_product_ids: [...gate.publishedProductIds].sort(),
    excluded_products: gate.excluded,
    all_excluded_products: gate.allExcluded,
    duplicate_primary_image_products: gate.duplicatePrimaryProducts,
    published_primary_image_by_product: imageByProduct,
  };
}
