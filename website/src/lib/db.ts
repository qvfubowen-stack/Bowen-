/**
 * 数据访问入口（页面层唯一使用的 API）
 * ===========================================================================
 * 页面组件**只**通过这里导出的函数取数据，不知道数据存在哪。
 *
 * 分层：
 *   src/lib/repository.ts                 接口定义（ProductRepository）
 *   src/lib/repositories/json-repository.ts  当前实现（构建期 JSON）
 *   src/lib/db.ts                         ← 本文件：注册实现 + 暴露给页面的 API
 *
 * 重要：这里导出的函数**全部是 async**。
 * 即使当前 JSON 实现同步就能算完，也统一按异步暴露 ——
 * 这样将来接入 PostgreSQL / Supabase 时，页面层不需要改动。
 *
 * ⚠️ 接入 Supabase 需要做的配套工作不止「换一个实现类」，
 *    见 src/lib/repository.ts 顶部注释与 docs/supabase-migration-boundary.md。
 */
import 'server-only';

import { JsonProductRepository } from './repositories/json-repository';
import { getRepository, setRepository } from './repository';

import type { ProductFilters } from './types';

// 注册默认实现（原型阶段：JSON）
setRepository(new JsonProductRepository());

export { getRepository, setRepository };
export type { ProductRepository, OeSearchResult, SiteFacts, DatasetStats } from './repository';
export { looksLikeOeQuery, normalizeOeInput } from './oe-normalize';

// ---------------------------------------------------------------------------
// 页面使用的查询 API —— 全部 async
// ---------------------------------------------------------------------------

/** 网站可见产品（原型候选 + 可搜索，不含 blocked / draft） */
export async function getPublishedProducts() {
  return getRepository().getPublishedProducts();
}

export async function getProductById(id: string) {
  return getRepository().getProductById(id);
}

export async function getProductByBowen(bowenNo: string) {
  return getRepository().getProductByBowen(bowenNo);
}

export async function listProducts(filters: ProductFilters = {}) {
  return getRepository().listProducts(filters);
}

/** 产品全部 application（含 blocked / needs_review，内部审计用） */
export async function getApplicationsForProduct(productId: string) {
  return getRepository().getApplicationsForProduct(productId);
}

/** 只含可对外展示的 application */
export async function getDisplayApplications(productId: string) {
  return getRepository().getDisplayApplications(productId);
}

export async function searchByOe(rawQuery: string) {
  return getRepository().searchByOe(rawQuery);
}

export async function searchByBowen(rawQuery: string) {
  return getRepository().searchByBowen(rawQuery);
}

export async function getCategorySummaries() {
  return getRepository().getCategorySummaries();
}

export async function getProductTypeOptions() {
  return getRepository().getProductTypeOptions();
}

export async function getMakeSummaries() {
  return getRepository().getMakeSummaries();
}

export async function getSiteFacts() {
  return getRepository().getSiteFacts();
}

export async function getDatasetStats() {
  return getRepository().getDatasetStats();
}
