/**
 * JSONL 文件 RFQ 存储（无数据库凭据时的持久化回退）
 * ===========================================================================
 * 为什么需要它：
 *   业务方尚未提供 Supabase 凭据。Phase 5 的要求是「不得因为缺少凭据丢掉客户询价」，
 *   所以默认驱动在没有 Supabase 配置时写本地 JSONL 文件，而不是用内存假装成功。
 *
 * 文件位置（RFQ_JSON_STORE_PATH）：默认 <cwd>/.rfq-data/rfq-inquiries.jsonl
 *   - 已在 .gitignore 里排除，不会被提交
 *   - 生产环境如果文件系统只读，create() 会抛错 → API 返回 SERVICE_UNAVAILABLE
 *     （宁可让客户看到"稍后再试"，也不能假装收到）
 *
 * 并发：同一进程内用 promise 链串行化；跨进程并发不在本回退方案的覆盖范围内
 *       （正式方案请用 Supabase，见 supabase-store.ts）。
 */
import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { RfqStoreError } from '../errors';
import type { RfqStore } from '../store';
import type { RfqEmailDeliveryUpdate, RfqInquiryRecord } from '../types';

export function resolveStorePath(): string {
  const configured = (process.env.RFQ_JSON_STORE_PATH ?? '').trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), '.rfq-data', 'rfq-inquiries.jsonl');
}

export class JsonFileRfqStore implements RfqStore {
  readonly driver = 'json' as const;

  private static instance: JsonFileRfqStore | null = null;

  private queue: Promise<unknown> = Promise.resolve();

  static shared(): JsonFileRfqStore {
    if (!JsonFileRfqStore.instance) JsonFileRfqStore.instance = new JsonFileRfqStore();
    return JsonFileRfqStore.instance;
  }

  private get filePath(): string {
    return resolveStorePath();
  }

  /** 串行化所有读写，避免并发 append/rewrite 互相踩踏 */
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async readAll(): Promise<RfqInquiryRecord[]> {
    try {
      const text = await fs.readFile(this.filePath, 'utf8');
      const out: RfqInquiryRecord[] = [];
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          out.push(JSON.parse(trimmed) as RfqInquiryRecord);
        } catch {
          // 单行损坏不应让整表不可读；跳过即可（不做静默修复）
        }
      }
      return out;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new RfqStoreError('read', `cannot read store file (${(err as NodeJS.ErrnoException).code ?? 'unknown'})`);
    }
  }

  private async writeAll(records: RfqInquiryRecord[]): Promise<void> {
    const dir = path.dirname(this.filePath);
    const tmp = `${this.filePath}.tmp`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tmp, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    await fs.rename(tmp, this.filePath);
  }

  async create(record: RfqInquiryRecord): Promise<void> {
    return this.run(async () => {
      try {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
      } catch (err) {
        throw new RfqStoreError(
          'write',
          `cannot append to store file (${(err as NodeJS.ErrnoException).code ?? 'unknown'})`,
        );
      }
    });
  }

  async updateEmailDelivery(id: string, update: RfqEmailDeliveryUpdate): Promise<void> {
    return this.run(async () => {
      try {
        const records = await this.readAll();
        let changed = false;
        for (const rec of records) {
          if (rec.id !== id) continue;
          rec.email_delivery_status = update.status;
          rec.email_delivery_error = update.error;
          rec.updated_at = update.updatedAt;
          changed = true;
        }
        if (changed) await this.writeAll(records);
      } catch (err) {
        if (err instanceof RfqStoreError) throw err;
        throw new RfqStoreError('update', 'cannot update delivery status');
      }
    });
  }

  async findRecentByFingerprint(
    fingerprint: string,
    sinceIso: string,
  ): Promise<{ id: string; inquiry_number: string } | null> {
    return this.run(async () => {
      const records = await this.readAll();
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const rec = records[i];
        if (rec.submission_fingerprint !== fingerprint) continue;
        if (rec.created_at >= sinceIso) return { id: rec.id, inquiry_number: rec.inquiry_number };
      }
      return null;
    });
  }

  async getById(id: string): Promise<RfqInquiryRecord | null> {
    return this.run(async () => {
      const records = await this.readAll();
      return records.find((r) => r.id === id) ?? null;
    });
  }
}
