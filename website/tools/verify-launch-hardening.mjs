#!/usr/bin/env node
/**
 * 低成本上线收口验收
 *
 * 业务决定：不运行定时邮件重试。RFQ 仍然先落库再尝试发送一次；
 * 首次发送失败时保留询盘、记录 email_failed，并提示客户直接联系销售邮箱。
 */
import fs from 'node:fs';
import path from 'node:path';
import { WEBSITE_ROOT, createChecker } from './lib/verify-helpers.mjs';

const { check, section, summary } = createChecker('博文外贸独立站 — 低成本上线收口验收');
const repoRoot = path.resolve(WEBSITE_ROOT, '..');
const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);

const service = read(path.join(WEBSITE_ROOT, 'src/lib/rfq/service.ts'));
const constants = read(path.join(WEBSITE_ROOT, 'src/lib/rfq/constants.ts'));
const privacy = read(path.join(WEBSITE_ROOT, 'src/app/(site)/privacy/page.tsx'));
const envExample = read(path.join(WEBSITE_ROOT, '.env.example'));

section('A. 定时重试已完全移除');

check('没有 Vercel Cron 配置', () =>
  !exists(path.join(WEBSITE_ROOT, 'vercel.json'))
    ? { ok: true, detail: 'website/vercel.json 不存在' }
    : 'website/vercel.json 仍存在');

check('没有重试路由和重试引擎', () => {
  const leftovers = [
    path.join(WEBSITE_ROOT, 'src/app/api/cron/retry-rfq-email/route.ts'),
    path.join(WEBSITE_ROOT, 'src/lib/rfq/retry.ts'),
  ].filter(exists);
  return leftovers.length === 0
    ? { ok: true, detail: 'Cron 路由与 retry.ts 均不存在' }
    : `残留：${leftovers.join(', ')}`;
});

check('不再需要重试数据库迁移', () =>
  !exists(path.join(repoRoot, 'supabase/migrations/002_add_rfq_email_retry.sql'))
    ? { ok: true, detail: '只需执行 001 migration' }
    : '002_add_rfq_email_retry.sql 仍存在');

check('环境变量模板不再要求 Cron 或重试参数', () => {
  const forbidden = ['CRON_SECRET', 'RFQ_EMAIL_MAX_RETRIES', 'RFQ_EMAIL_RETRY_DELAY_SECONDS', 'RFQ_EMAIL_RETRY_LEASE_SECONDS', 'RFQ_EMAIL_RETRY_BATCH'];
  const found = forbidden.filter((name) => envExample.includes(name));
  return found.length === 0 ? { ok: true, detail: '0 个重试环境变量' } : `仍包含：${found.join(', ')}`;
});

section('B. 单次发信失败语义');

check('邮件通道故障直接记录 email_failed', () =>
  /EMAIL_STATUS\.failed/.test(service) && !/pendingRetry|pending_retry/.test(service)
    ? { ok: true, detail: '首次失败不入队' }
    : 'service.ts 仍包含待重试状态');

check('询盘仍然先保存，失败时仍向客户提供直接联系提示', () => {
  const ok = /await store\.create\(record\)/.test(service)
    && /Your enquiry has been recorded/.test(service)
    && /please email/.test(service);
  return ok ? { ok: true, detail: '先落库 + 诚实兜底提示' } : '保存顺序或兜底提示不完整';
});

check('运行时状态常量不包含 pending_retry', () =>
  !/pending_retry|pendingRetry/.test(constants)
    ? { ok: true, detail: '仅保留 pending/sent/email_failed/email_not_configured' }
    : 'constants.ts 仍包含 pending_retry');

check('隐私政策明确说明不会自动重试', () =>
  /failed notifications are not retried automatically/i.test(privacy)
    ? { ok: true, detail: '公开说明与实际流程一致' }
    : '隐私政策未同步');

process.exitCode = summary() ? 0 : 1;
