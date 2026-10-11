/**
 * Supabase RFQ 存储（生产推荐实现）
 * ===========================================================================
 * 为什么直接用 REST 而不是 @supabase/supabase-js：
 *   本项目工具链刻意保持零第三方依赖，而这里只需要 3 个 REST 调用
 *   （insert / patch / select），用 fetch 足够，且能完全控制错误信息的脱敏。
 *
 * 安全边界（务必遵守）：
 *   1. 只用 SUPABASE_SERVICE_ROLE_KEY，且**只在服务端**读取（不加 NEXT_PUBLIC_ 前缀）。
 *   2. 表上启用 RLS 且不创建任何匿名策略（见 supabase/migrations/001_*.sql），
 *      浏览器即使拿到 anon key 也读不到、写不进询价记录。
 *   3. 写入统一走 service role，绕过 RLS —— 所以 service role key 泄露等于全表泄露，
 *      必须只放在服务端环境变量里。
 *   4. 错误信息只保留 HTTP 状态码 + PostgREST 的错误码，绝不把响应体或密钥写进日志/返回体。
 */
import 'server-only';

import { RfqStoreError } from '../errors';
import type { RfqStore } from '../store';
import type { RfqEmailDeliveryUpdate, RfqInquiryRecord } from '../types';

const TABLE = 'rfq_inquiries';
const TIMEOUT_MS = 12_000;

interface SupabaseErrorBody {
  code?: string;
  message?: string;
  details?: string;
}

function readConfig(): { url: string; key: string } {
  const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    throw new RfqStoreError('config', 'supabase credentials are not configured');
  }
  return { url, key };
}

/** 把记录映射成数据库行（列名与 migration 完全一致） */
function toRow(record: RfqInquiryRecord): Record<string, unknown> {
  return {
    id: record.id,
    inquiry_number: record.inquiry_number,
    name: record.name,
    company: record.company,
    country: record.country,
    email: record.email,
    whatsapp_phone: record.whatsapp_phone,
    website: record.website,
    message: record.message,
    items_json: record.items,
    source_page: record.source_page,
    status: record.status,
    email_delivery_status: record.email_delivery_status,
    email_delivery_error: record.email_delivery_error,
    privacy_consent_version: record.privacy_consent_version,
    user_agent: record.user_agent,
    submission_fingerprint: record.submission_fingerprint,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/** 数据库行 → 记录 */
function fromRow(row: Record<string, unknown>): RfqInquiryRecord {
  return {
    id: String(row.id ?? ''),
    inquiry_number: String(row.inquiry_number ?? ''),
    name: String(row.name ?? ''),
    company: String(row.company ?? ''),
    country: String(row.country ?? ''),
    email: String(row.email ?? ''),
    whatsapp_phone: (row.whatsapp_phone as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    items: Array.isArray(row.items_json) ? (row.items_json as RfqInquiryRecord['items']) : [],
    source_page: (row.source_page as string | null) ?? null,
    status: String(row.status ?? ''),
    email_delivery_status: String(row.email_delivery_status ?? ''),
    email_delivery_error: (row.email_delivery_error as string | null) ?? null,
    privacy_consent_version: String(row.privacy_consent_version ?? ''),
    user_agent: (row.user_agent as string | null) ?? null,
    submission_fingerprint: String(row.submission_fingerprint ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export class SupabaseRfqStore implements RfqStore {
  readonly driver = 'supabase' as const;

  private async request(
    operation: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const { url, key } = readConfig();
    let res: Response;
    try {
      res = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (err) {
      // 网络层错误：只保留错误类型，绝不回显请求头（里面有密钥）
      throw new RfqStoreError(operation, `network error (${(err as Error).name})`);
    }
    if (!res.ok) {
      let code = '';
      try {
        const body = (await res.json()) as SupabaseErrorBody;
        code = String(body?.code ?? '').slice(0, 40);
      } catch {
        code = '';
      }
      throw new RfqStoreError(operation, `supabase responded ${res.status}${code ? ` (${code})` : ''}`);
    }
    return res;
  }

  async create(record: RfqInquiryRecord): Promise<void> {
    await this.request('insert', TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(toRow(record)),
    });
  }

  async updateEmailDelivery(id: string, update: RfqEmailDeliveryUpdate): Promise<void> {
    const body: Record<string, unknown> = {
      email_delivery_status: update.status,
      email_delivery_error: update.error,
      updated_at: update.updatedAt,
    };
    await this.request('update', `${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
  }

  async findRecentByFingerprint(
    fingerprint: string,
    sinceIso: string,
  ): Promise<{ id: string; inquiry_number: string } | null> {
    const query = `${TABLE}?select=id,inquiry_number&submission_fingerprint=eq.${encodeURIComponent(
      fingerprint,
    )}&created_at=gte.${encodeURIComponent(sinceIso)}&limit=1`;
    const res = await this.request('select', query, { method: 'GET' });
    const rows = (await res.json()) as { id?: string; inquiry_number?: string }[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return { id: String(rows[0].id ?? ''), inquiry_number: String(rows[0].inquiry_number ?? '') };
  }

  async getById(id: string): Promise<RfqInquiryRecord | null> {
    const query = `${TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`;
    const res = await this.request('select', query, { method: 'GET' });
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return fromRow(rows[0]);
  }
}
