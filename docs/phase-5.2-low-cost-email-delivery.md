# Phase 5.2 — 低成本邮件投递方案

**日期**：2026-09-26  
**业务决定**：取消 RFQ 通知邮件的定时自动重试，以移除高频 Cron 依赖并压缩托管成本。

## 当前流程

1. 客户提交 RFQ。
2. 服务端完成反垃圾、字段校验、产品与 application 复核、重复提交检测。
3. 询盘先写入持久化数据库；落库失败则返回 `503`，不会假装成功。
4. 落库成功后只尝试发送一次销售通知邮件。
5. 发送成功：`email_delivery_status = sent`。
6. 邮件服务配置缺失：`email_delivery_status = email_not_configured`。
7. 邮件服务请求失败：`email_delivery_status = email_failed`。
8. 失败时客户仍获得询价号，并看到直接联系 `qfbowen@126.com` 的提示。

## 已移除

- Vercel Cron 配置 `website/vercel.json`
- `/api/cron/retry-rfq-email`
- `website/src/lib/rfq/retry.ts`
- `supabase/migrations/002_add_rfq_email_retry.sql`
- `CRON_SECRET`
- 所有 `RFQ_EMAIL_RETRY_*` 环境变量
- `pending_retry` 状态、重试次数、下次重试时间和租约逻辑

## 数据库上线要求

新项目只执行：

`supabase/migrations/001_create_rfq_inquiries.sql`

不需要执行 migration 002。

## 运营边界

自动重试被取消后，销售或运营人员应定期查看 `email_failed` 和
`email_not_configured` 记录。必要时根据询价记录中的客户邮箱人工联系，或修复邮件配置后由人工处理。

## 验证结果

- 低成本上线收口：8/8 PASS
- RFQ 生产化测试：51/51 PASS
- TypeScript：PASS
- Next.js production build：PASS，411 个静态页面生成完成
- 构建路由只保留 `POST /api/rfq`，不再存在 Cron 路由
