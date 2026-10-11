-- ===========================================================================
-- 001_create_rfq_inquiries.sql
-- ===========================================================================
-- 博文外贸独立站 — RFQ 询价记录表（Phase 5）
--
-- 边界（先读这段再改）：
--   1. 本表**只**存 RFQ 询价记录。
--      产品 / application / OE 索引继续使用网站当前的静态 JSON，不迁移到这个库。
--   2. 浏览器**永远不能**直接读写本表：
--        - 启用 RLS，且**不创建任何 anon / authenticated 策略**；
--        - 唯一写入路径是网站服务端 API（POST /api/rfq）；
--        - 服务端使用 service role key（绕过 RLS），该密钥只存在于服务端环境变量，
--          不加 NEXT_PUBLIC_ 前缀，绝不下发到客户端。
--   3. 本表**不保存**以下内容：
--        明文 IP 地址、source_sheets、source_row、product_type_evidence、
--        内部审核状态、未公开的证书信息、API Key、原始错误堆栈。
--      限流所需的客户端标识使用带服务器密钥的 HMAC 短键，只存在于服务端内存。
--   4. 本表也不保存客户提交的"展示文本"（产品名 / 车型 / OE 的客户端版本）：
--      items_json 里的 bowen_no / product_type / matched_oe / vehicle
--      全部由服务端从公开产品数据重新推导后写入。
--
-- 执行方式：
--   Supabase SQL Editor 直接粘贴执行，或 supabase db push（需已 link 项目）。
-- ===========================================================================

-- gen_random_uuid() 需要 pgcrypto（Supabase 默认已启用，这里做幂等兜底）
create extension if not exists pgcrypto;

create table if not exists public.rfq_inquiries (
  -- 主键：服务端生成的 UUID
  id                       uuid        primary key default gen_random_uuid(),

  -- 对客户展示的询价号，格式 BW-RFQ-YYYYMMDD-XXXXXX
  inquiry_number           text        not null unique,

  -- 联系信息（客户填写，已由服务端清洗与长度限制）
  name                     text        not null,
  company                  text        not null,
  country                  text        not null,
  email                    text        not null,
  whatsapp_phone           text,
  website                  text,
  message                  text,

  -- RFQ 明细行（JSON 数组）。每行字段：
  --   product_id, bowen_no, product_type, application_id,
  --   matched_oe, vehicle, quantity, remark
  items_json               jsonb       not null default '[]'::jsonb,

  -- 提交来源页面（只允许站内相对路径，服务端已校验）
  source_page              text,

  -- 内部状态
  status                   text        not null default 'received',
  email_delivery_status    text        not null default 'pending',
  email_delivery_error     text,

  -- 隐私同意版本（隐私文本变更时应递增，见 website/src/lib/rfq/constants.ts）
  privacy_consent_version  text        not null,

  -- 浏览器 UA（仅用于排查异常提交，不用于识别个人）
  user_agent               text,

  -- 去重指纹：服务端对「邮箱 + 留言 + 明细」计算的 sha256 前 32 位。
  -- 用途只有一个：拒绝短时间内完全相同的重复提交。
  submission_fingerprint   text        not null,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table  public.rfq_inquiries is
  'RFQ enquiries submitted through the Bowen website. Written only by the server-side API (service role); never readable by the browser.';
comment on column public.rfq_inquiries.inquiry_number is
  'Customer-facing reference, e.g. BW-RFQ-20260926-A1B2C3.';
comment on column public.rfq_inquiries.items_json is
  'Validated RFQ lines. bowen_no / product_type / matched_oe / vehicle are derived server-side from published product data.';
comment on column public.rfq_inquiries.submission_fingerprint is
  'sha256 prefix over (email + message + line items); used only to reject identical repeat submissions within a short window.';
comment on column public.rfq_inquiries.email_delivery_status is
  'pending | sent | email_failed | email_not_configured. An inquiry is kept even when email delivery fails; notifications are not retried automatically.';
comment on column public.rfq_inquiries.email_delivery_error is
  'Sanitised delivery error summary. Never contains API keys, provider response bodies or stack traces.';

-- 去重查询：按指纹 + 时间窗口
create index if not exists rfq_inquiries_fingerprint_created_idx
  on public.rfq_inquiries (submission_fingerprint, created_at desc);

-- 运营查看：按时间倒序
create index if not exists rfq_inquiries_created_at_idx
  on public.rfq_inquiries (created_at desc);

-- 运营查看：邮件发送失败或尚未完成的询盘
create index if not exists rfq_inquiries_email_status_idx
  on public.rfq_inquiries (email_delivery_status)
  where email_delivery_status in ('pending', 'email_failed', 'email_not_configured');

-- ---------------------------------------------------------------------------
-- updated_at 自动维护
-- ---------------------------------------------------------------------------
create or replace function public.rfq_inquiries_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rfq_inquiries_set_updated_at on public.rfq_inquiries;
create trigger rfq_inquiries_set_updated_at
  before update on public.rfq_inquiries
  for each row execute function public.rfq_inquiries_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 行级安全（RLS）
-- ---------------------------------------------------------------------------
-- 关键：启用 RLS 并且**不创建任何策略**。
--   * anon（浏览器中可以拿到的公开 key）→ 无策略 → 读写全部被拒绝。
--   * authenticated（如果将来有登录后台）→ 同样无策略 → 也被拒绝。
--   * service_role（仅服务端）→ 绕过 RLS → 可以写入。
-- 也就是说：即使有人拿到 anon key，也读不到、改不了、删不掉任何一条询价。
--
-- ⚠️ 将来若要给运营做一个查看后台，请**新增一个明确的策略**（例如按 authenticated
--    用户 + 角色判断），不要为了省事把 RLS 关掉。
alter table public.rfq_inquiries enable row level security;
-- 刻意不使用 FORCE ROW LEVEL SECURITY：那会把 RLS 也套到表 owner 上，
-- 万一 service_role 的 bypassrls 属性被改动，所有写入会直接失败。
-- 保持 enable + 无策略的组合已经足够（anon / authenticated 一律拒绝）。

-- 明确收回匿名与登录用户的表级权限（与 RLS 双保险）
revoke all on table public.rfq_inquiries from anon;
revoke all on table public.rfq_inquiries from authenticated;
revoke all on table public.rfq_inquiries from public;

-- ---------------------------------------------------------------------------
-- 数据保留提示（业务方需确认后再自动化）
-- ---------------------------------------------------------------------------
-- 隐私政策里对客户承诺："只在答复询价、保留业务记录和履行法定义务所必需的期间保留"。
-- 具体保留期限业务方尚未确认，因此这里**不**写入任何自动删除任务，避免公开一个
-- 未经确认的期限。确认后可用如下形式实现（示例，未启用）：
--
--   -- 例：删除 24 个月前已结束的询价
--   -- delete from public.rfq_inquiries
--   --  where created_at < now() - interval '24 months';
--
-- 建议通过 Supabase 的定时任务（pg_cron）运行，并先在预发环境验证。
