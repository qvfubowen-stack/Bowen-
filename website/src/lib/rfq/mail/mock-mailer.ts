/**
 * Mock 邮件驱动（自动化测试 / 本地预览）
 * ===========================================================================
 * 行为：
 *   - 把每一封"本该发出"的邮件完整写进 outbox JSONL 文件，供测试逐字段断言；
 *   - 绝不发起任何网络请求，绝不外发；
 *   - RFQ_MOCK_MAIL_FAIL=true 时抛错，用于验证"邮件失败但询价记录仍在"的路径。
 *
 * outbox 路径：RFQ_MOCK_OUTBOX_PATH，默认 <cwd>/.rfq-mock/outbox.jsonl
 */
import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { RfqMailError } from '../errors';
import type { RfqMailMessage, RfqMailResult, RfqMailer } from '../mail';

export function resolveOutboxPath(): string {
  const configured = (process.env.RFQ_MOCK_OUTBOX_PATH ?? '').trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), '.rfq-mock', 'outbox.jsonl');
}

export class MockMailer implements RfqMailer {
  readonly driver = 'mock' as const;
  readonly configured = true;

  async send(message: RfqMailMessage): Promise<RfqMailResult> {
    if ((process.env.RFQ_MOCK_MAIL_FAIL ?? '').trim().toLowerCase() === 'true') {
      throw new RfqMailError('mock transport is configured to fail (RFQ_MOCK_MAIL_FAIL=true)');
    }

    const file = resolveOutboxPath();
    // mock 的"服务商消息 ID"：格式与真实实现区分开，便于测试断言与人工识别
    const providerMessageId = `mock-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const entry = {
      at: new Date().toISOString(),
      transport: 'mock',
      to: message.to,
      from: message.from,
      reply_to: message.replyTo,
      subject: message.subject,
      provider_message_id: providerMessageId,
      text: message.text,
      html: message.html,
    };
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (err) {
      throw new RfqMailError(`mock outbox is not writable (${(err as NodeJS.ErrnoException).code ?? 'unknown'})`);
    }
    return { providerMessageId };
  }
}
