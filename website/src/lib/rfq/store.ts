/**
 * RFQ 记录存储适配层
 * ===========================================================================
 * 边界（重要）：
 *   - 产品 / application / OE 索引**继续**使用当前静态 JSON，不迁移到 Supabase。
 *   - 只有 RFQ 询价记录会写数据库。
 *   - 浏览器**永远不能**直接写表：只有服务端 API 通过 service role key 写入。
 *     service role key 只在服务端进程内读取，不加 NEXT_PUBLIC_ 前缀，绝不进客户端 bundle。
 *
 * 三个实现：
 *   memory   —— 自动化测试用，进程内 Map
 *   json     —— 无凭据时的持久化回退（JSONL 文件），保证询价不会因为缺凭据而丢失
 *   supabase —— 生产推荐（REST，无需额外依赖）
 *
 * 驱动选择（RFQ_STORE_DRIVER）：
 *   memory | json | supabase | 未设置 = auto
 *   auto：配置了 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 时用 supabase，否则用 json。
 */
import 'server-only';

import type { RfqEmailDeliveryUpdate, RfqInquiryRecord } from './types';

export interface RfqStore {
  readonly driver: 'memory' | 'json' | 'supabase';
  /** 写入一条新询价；失败必须抛出（调用方据此返回 SERVICE_UNAVAILABLE，绝不假装成功） */
  create(record: RfqInquiryRecord): Promise<void>;
  /** 更新首次邮件投递状态；失败只记录，不影响询价本身是否已保存。 */
  updateEmailDelivery(id: string, update: RfqEmailDeliveryUpdate): Promise<void>;
  /** 去重查询：同指纹、在 sinceIso 之后是否已有记录 */
  findRecentByFingerprint(
    fingerprint: string,
    sinceIso: string,
  ): Promise<{ id: string; inquiry_number: string } | null>;
  getById(id: string): Promise<RfqInquiryRecord | null>;
}

/** Supabase 凭据是否已配置（只检查存在性，不返回任何值） */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL ?? '').trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  );
}

export type RfqStoreDriver = 'memory' | 'json' | 'supabase';

/** 解析驱动名（未设置或非法值 → auto 判定） */
export function resolveStoreDriver(): RfqStoreDriver {
  const raw = (process.env.RFQ_STORE_DRIVER ?? '').trim().toLowerCase();
  if (raw === 'memory' || raw === 'json' || raw === 'supabase') return raw;
  return isSupabaseConfigured() ? 'supabase' : 'json';
}

/**
 * 读取驱动。这里用动态 import 是为了让 memory/json 驱动不被 Supabase 代码牵连，
 * 同时保证真正的实现在 server-only 边界内。
 */
export async function getRfqStore(): Promise<RfqStore> {
  const driver = resolveStoreDriver();
  if (driver === 'memory') {
    const { MemoryRfqStore } = await import('./stores/memory-store');
    return MemoryRfqStore.shared();
  }
  if (driver === 'supabase') {
    const { SupabaseRfqStore } = await import('./stores/supabase-store');
    return new SupabaseRfqStore();
  }
  const { JsonFileRfqStore } = await import('./stores/json-file-store');
  return JsonFileRfqStore.shared();
}

/** 供部署文档与自检脚本使用的驱动说明（不含任何密钥） */
export function describeStoreConfig(): { driver: RfqStoreDriver; supabaseConfigured: boolean } {
  return { driver: resolveStoreDriver(), supabaseConfigured: isSupabaseConfigured() };
}
