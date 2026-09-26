/**
 * Phase 3.5 / D —— 旧站产品图 → Bowen No. → 当前 product_id 的匹配规则
 * ---------------------------------------------------------------------
 * 匹配优先级（完全按需求书）：
 *   1. Bowen No.（旧站规格表里的「博文编号」列）
 *   2. 产品编号
 *   3. OE Number
 *   4. 产品标题
 *   5. 原网页 URL
 *
 * 铁律：**禁止只根据图片外观猜产品**。
 *   - 只有"旧站页面自己写明的编号"或"唯一可解析的 OE"才算 auto_match。
 *   - 一个 OE 命中多个产品（DB 里确实存在 125 个共享 OE）→ review_required。
 *   - 只有标题/车型信息 → review_required，绝不自动绑定。
 */
import { normalizeOeNumber, bowenKey } from '../../lib/normalize.mjs';

/**
 * @param {object} db  { products, oeIndex }
 * @param {object} legacyProduct  legacy-products.json 里的一条
 * @returns {object} 匹配结论（含证据链）
 */
export function matchLegacyProduct(db, legacyProduct) {
  const { byBowenExact, byBowenBase, oeToProducts, productById } = db;

  const evidence = [];
  const bowenHits = new Map();   // product_id -> [bowen_no]
  const oeHits = new Map();      // product_id -> { oes:[], ambiguous:bool }
  const unresolvedBowen = [];
  const unmatchedOe = [];

  // ---- 1/2. Bowen No. ----
  for (const raw of legacyProduct.bowen_nos || []) {
    const k = bowenKey(raw);
    let hit = byBowenExact.get(k.exact) || null;
    let how = 'exact';
    if (!hit && byBowenBase.has(k.base)) { hit = byBowenBase.get(k.base); how = 'base'; }
    if (hit) {
      if (!bowenHits.has(hit.product_id)) bowenHits.set(hit.product_id, []);
      bowenHits.get(hit.product_id).push(`${raw}(${how})`);
      evidence.push(`旧站规格表「博文编号」= ${raw} → ${hit.product_id}（bowen_no=${hit.bowen_no}，${how} 匹配）`);
    } else {
      unresolvedBowen.push(raw);
    }
  }

  // ---- 3. OE Number ----
  for (const raw of legacyProduct.oe_numbers || []) {
    const key = normalizeOeNumber(raw);
    if (!key) continue;
    const ids = oeToProducts.get(key);
    if (!ids || !ids.size) { unmatchedOe.push(raw); continue; }
    if (ids.size > 1) {
      evidence.push(`旧站 OEM ${raw} 在当前数据库中对应 ${ids.size} 个产品（${[...ids].join('/')}）→ 存在歧义`);
    } else {
      // 唯一命中同样必须留证据链：否则 auto_match 会缺少可核对依据
      const only = [...ids][0];
      evidence.push(`旧站规格表「OEM号码」= ${raw} → ${only}（标准化后 ${key}，在当前 OE 索引中唯一命中）`);
    }
    for (const pid of ids) {
      if (!oeHits.has(pid)) oeHits.set(pid, { oes: [], ambiguous: ids.size > 1 });
      oeHits.get(pid).oes.push(raw);
      if (ids.size > 1) oeHits.get(pid).ambiguous = true;
    }
  }

  // ---- 汇总判定 ----
  let reuse_status = 'review_required';
  let matchedProductId = null;
  let matchMethod = null;
  let reason = '';

  const bowenIds = [...bowenHits.keys()];
  const oeIds = [...oeHits.keys()];

  if (bowenIds.length === 1) {
    matchedProductId = bowenIds[0];
    matchMethod = 'bowen_no';
    reuse_status = 'auto_match';
    reason = '旧站页面规格表明确写明博文编号，且在当前数据库中唯一命中';
  } else if (bowenIds.length > 1) {
    matchMethod = 'bowen_no';
    reason = `旧站页面写明的博文编号在当前数据库命中 ${bowenIds.length} 个产品，需人工裁决`;
  } else if (oeIds.length === 1 && !oeHits.get(oeIds[0]).ambiguous) {
    matchedProductId = oeIds[0];
    matchMethod = 'oe_number_unique';
    reuse_status = 'auto_match';
    reason = '旧站页面写明的 OEM 号码在当前数据库中唯一命中该产品';
  } else if (oeIds.length >= 1) {
    matchMethod = 'oe_number_ambiguous';
    reason = oeIds.length > 1
      ? `旧站页面的 OEM 号码在当前数据库命中 ${oeIds.length} 个产品，需人工裁决`
      : '该 OEM 号码在当前数据库中为多个产品共享，需人工裁决';
  } else if (unresolvedBowen.length) {
    matchMethod = 'bowen_no_unresolved';
    reason = `旧站写明的博文编号 ${unresolvedBowen.join('/')} 在当前数据库中不存在，需人工确认`;
  } else if (unmatchedOe.length) {
    matchMethod = 'oe_number_unresolved';
    reason = `旧站写明的 OEM 号码 ${unmatchedOe.slice(0, 5).join('/')} 在当前数据库中不存在，需人工确认`;
  } else {
    matchMethod = 'none';
    reason = '旧站页面未提供任何可核对的编号（无规格表），不得自动绑定';
  }

  const matched = matchedProductId ? productById.get(matchedProductId) : null;

  return {
    reuse_status,
    match_method: matchMethod,
    matched_product_id: matchedProductId,
    matched_bowen_no: matched ? matched.bowen_no : null,
    matched_product_name_en: matched ? matched.product_name_en : null,
    matched_product_name_zh: matched ? matched.product_name_zh : null,
    matched_product_type: matched ? matched.product_type : null,
    matched_website_category: matched ? matched.website_category : null,
    candidate_product_ids: [...new Set([...bowenIds, ...oeIds])],
    evidence,
    reason,
    unresolved_bowen_nos: unresolvedBowen,
    unmatched_oe_numbers: unmatchedOe,
  };
}

/** 载入当前产品数据库，建立匹配索引 */
export function buildMatchDb(products, oeIndexRows) {
  const byBowenExact = new Map();
  const byBowenBase = new Map();
  const productById = new Map();
  for (const p of products) {
    productById.set(p.product_id, p);
    if (!p.has_resolvable_bowen_no || !p.bowen_no) continue;
    const k = bowenKey(p.bowen_no);
    if (!byBowenExact.has(k.exact)) byBowenExact.set(k.exact, p);
    if (!byBowenBase.has(k.base)) byBowenBase.set(k.base, p);
  }
  const oeToProducts = new Map();
  for (const r of oeIndexRows) {
    if (!oeToProducts.has(r.oe_search_key)) oeToProducts.set(r.oe_search_key, new Set());
    oeToProducts.get(r.oe_search_key).add(r.product_id);
  }
  return { byBowenExact, byBowenBase, oeToProducts, productById };
}
