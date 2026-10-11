/**
 * 内存 RFQ 存储（自动化测试 / 本地演示）
 * ===========================================================================
 * ⚠️ 进程重启即丢失。只在 RFQ_STORE_DRIVER=memory 时使用，
 *    生产环境不应选择它（部署文档已注明）。
 */
import 'server-only';

import type { RfqStore } from '../store';
import type { RfqEmailDeliveryUpdate, RfqInquiryRecord } from '../types';

export class MemoryRfqStore implements RfqStore {
  readonly driver = 'memory' as const;

  private static instance: MemoryRfqStore | null = null;

  private readonly records = new Map<string, RfqInquiryRecord>();

  static shared(): MemoryRfqStore {
    if (!MemoryRfqStore.instance) MemoryRfqStore.instance = new MemoryRfqStore();
    return MemoryRfqStore.instance;
  }

  async create(record: RfqInquiryRecord): Promise<void> {
    this.records.set(record.id, { ...record });
  }

  async updateEmailDelivery(id: string, update: RfqEmailDeliveryUpdate): Promise<void> {
    const found = this.records.get(id);
    if (!found) return;
    found.email_delivery_status = update.status;
    found.email_delivery_error = update.error;
    found.updated_at = update.updatedAt;
  }

  async findRecentByFingerprint(
    fingerprint: string,
    sinceIso: string,
  ): Promise<{ id: string; inquiry_number: string } | null> {
    for (const rec of this.records.values()) {
      if (rec.submission_fingerprint !== fingerprint) continue;
      if (rec.created_at >= sinceIso) return { id: rec.id, inquiry_number: rec.inquiry_number };
    }
    return null;
  }

  async getById(id: string): Promise<RfqInquiryRecord | null> {
    return this.records.get(id) ?? null;
  }

  /** 仅供测试脚本使用 */
  async all(): Promise<RfqInquiryRecord[]> {
    return [...this.records.values()];
  }
}
