/**
 * 领域类型定义
 * ---------------------------------------------------------------------------
 * 这些类型刻意与「存哪里」无关：当前由本地 JSON 仓库实现，
 * 未来换成 PostgreSQL / Supabase 时，只要返回同样形状的对象，页面代码一行都不用改。
 * 字段命名与 docs/database-v2-migration-report.md 里的数据库结构保持一致。
 */

export type ProductStatus =
  | 'prototype_candidate'
  | 'searchable_noindex'
  | 'draft'
  | 'blocked';

export type ProductTypeSource =
  | 'human_section_label'
  | 'human_review_confirmed'
  | 'inherited_from_bowen'
  | 'review_required';

export type VerificationStatus =
  | 'unverified'
  | 'needs_review_misaligned'
  | 'blocked_misaligned';

export interface ProductTypeEvidence {
  kind: string;
  raw_label?: string;
  source_sheet?: string;
  source_row?: number;
  source_file?: string;
  inherited_from_sheet?: string;
  inherited_from_row?: number;
  inherited_from_bowen_no?: string;
  note?: string;
}

export interface Product {
  product_id: string;
  bowen_no: string | null;
  product_type: string | null;
  product_subtype: string | null;
  product_name_en: string;
  product_name_zh: string;
  website_category: string | null;
  switch_subcategory: string | null;
  image: string | null;
  status: ProductStatus;
  product_type_source: ProductTypeSource;
  product_type_verified: boolean;
  product_type_evidence: ProductTypeEvidence | null;
  product_type_raw_labels: string[];
  product_type_conflict: unknown;
  blocked: boolean;
  blocked_reasons: string[];
  blocked_application_count: number;
  needs_review_application_count: number;
  review_notes: string[];
  data_status: string;
  source_sheets: string[];
  source_sheet_count: number;
  source_record_ids: string[];
  application_ids: string[];
  application_count: number;
  searchable_application_count: number;
  oe_token_count: number;
  distinct_oe_count: number;
  opening_temperatures_c: number[];
  prototype_rank: number | null;
  completeness_score: number | null;
  has_resolvable_bowen_no?: boolean;
  variant_of_bowen_no?: string | null;
}

export interface ProductApplication {
  application_id: string;
  product_id: string;
  bowen_no: string | null;
  /** 该 Excel 行的 OE 单元格完整原文（可能含多个 OE） */
  oe_numbers_raw: string;
  /** 每个 OE token 的标准化写法，与 source_tokens 一一对应 */
  oe_numbers_normalized: string[];
  oe_number_raw: string;
  oe_number_normalized: string[];
  oe_tokens: string[];
  oe_tokens_not_oe_like: string[];
  oe_token_count: number;
  oe_tokens_not_oe_like_count: number;
  /** 该 Excel 行的车型/发动机单元格完整原文 */
  vehicle_application_raw: string;
  vehicle_make: string | null;
  vehicle_make_raw: string | null;
  vehicle_model: string | null;
  engine_code: string | null;
  engine_displacement: string | null;
  engine_application: string | null;
  opening_temperature_c: number[] | null;
  application_notes: string | null;
  source_sheet: string;
  source_row: number;
  source_record_id: string;
  source_cell_refs: { oe: string; vehicle: string | null; bowen: string; specs: string | null; seq: string | null };
  section_label_raw: string | null;
  verification_status: VerificationStatus;
  blocked: boolean;
  needs_review: boolean;
  data_status: string;
  blocked_reasons: string[];
  misalignment_notes: string[];
  bowen_cell_raw: string;
  bowen_overflow_raw: string | null;
  merged_source_record_count: number;
  merged_source_records: string[];
  source_sheets: string[];
}

export interface OeIndexEntry {
  oe_index_id: string;
  oe_number_raw: string;
  oe_number_normalized: string;
  oe_search_key: string;
  token_position: number;
  application_id: string;
  product_id: string;
  bowen_no: string | null;
  source_sheet: string;
  source_row: number;
  source_record_id: string;
  oe_cell_raw: string;
}

/** 搜索/筛选结果：Product + 命中的 Application 上下文 */
export interface OeSearchHit {
  oe_number_raw: string;
  oe_search_key: string;
  product: Product;
  application: ProductApplication;
}

export interface ProductFilters {
  q?: string;
  type?: string;
  make?: string;
  engine?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategorySummary {
  category: string;
  labelEn: string;
  labelZh: string;
  productCount: number;
  description: string;
  subcategories?: { key: string; labelEn: string; labelZh: string; productCount: number }[];
}

export interface MakeSummary {
  make: string;
  productCount: number;
  applicationCount: number;
  sampleEngines: string[];
}
