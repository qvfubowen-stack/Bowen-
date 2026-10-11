# Phase 5.1 — Launch Hardening 交付报告

> **后续决策（2026-09-26）**：为压缩托管成本，业务方已取消自动邮件重试。
> 本文中的 Cron、`pending_retry`、`CRON_SECRET`、migration 002 和 `vercel.json` 内容仅记录当时实现，
> 不再代表当前代码。当前方案见 `docs/phase-5.2-low-cost-email-delivery.md`。

**项目**：博文外贸独立站（B2B 英文站）· `C:\Users\asus\Desktop\B2B外贸独立站`
**网站目录**：`website/`
**报告日期**：2026-09-26
**范围**：只做上线前收口 —— RFQ 文案、附件流程、Turnstile 前端、生产环境硬保护、邮件失败重试、部署源整理。

**结论**：Phase 5.1 完成。代码、自动化测试（含 3 次真实 `next build`）、真实浏览器实测全部通过。
**未部署、未绑定域名、未修改 DNS、未创建任何第三方账号、未开启搜索引擎收录、未提交 Git、未使用真实客户数据。**
所有邮件与数据库验证都在 **mock 通道** 完成；Cron 代码已就位并有 mock 测试，但**生产 Cron 尚未运行过**（没有部署）。

> 分类约定：① 已完成并实测 / ② mock 环境验证 / ③ 已完成代码但缺少真实凭据 /
> ④ 需要业务方提供 / ⑤ 尚未实施。凡是 mock 的地方一律不会写成"真实邮件已发送"。

---

## 1. 接手时工作区状态

用仓库自带的零依赖工具 `tools/_dsh-git-status.mjs` 记录基线（本机 PATH 上没有 `git` 可执行文件），
快照保存于 `tmp/phase51-git-status-before.json`。

| 项目 | 接手时 | 结束时 | 说明 |
| --- | --- | --- | --- |
| 分支 | `main` | `main` | 未变 |
| HEAD | `2e8924301076…`（"Phase 3.5：审计 qfbowen.com…"） | 同一 SHA | **未提交、未推送、未建 PR** |
| 已跟踪 modified | 68（`worktreeDirty` 列 92 项） | 68（列 92 项） | 本阶段没有新增进入该集合的文件 —— 被修改的都已在前几个阶段处于 modified |
| deleted | 24 | 24 | **一个都没被恢复，也没有新增删除** |
| untracked | 527 | 532 | +8 新建，−3 误生成空文件 |
| 冲突 | 0 | 0 | — |

**红线检查（结束时）**：
- `data/raw/`、`宣传手册最终PDF/`、`data/legacy-site/`、`review/`：**零改动**。
- 接手时 92 个 modified 已跟踪文件**全部仍然 modified**（没有覆盖或还原任何既有修改）。
- 接手时 24 个 deleted 文件**全部保持 deleted**。
- 未执行 `git reset --hard` / `git checkout --` / `git clean`。

---

## 2. 修改文件清单

### 2.1 已跟踪文件（本阶段实际改动，均在前几阶段已处于 modified 状态）

| 文件 | 改动 |
| --- | --- |
| `website/next.config.ts` | 接入 `validateProductionReadiness()`；托管生产环境缺项时**构建与启动直接抛错**；打印脱敏运行摘要（store/mail/turnstile） |
| `website/package.json` | description 更新为 Phase 5.1；新增 `verify:launch-hardening`、`verify:production-guards` |
| `website/src/lib/rfq/constants.ts` | 新增重试默认值（`DEFAULT_EMAIL_MAX_RETRIES=3` / 延迟 600s / 租约 300s / 批量 20） |
| `website/src/lib/rfq/types.ts` | 记录新增 `email_retry_count` / `last_email_attempt_at` / `next_retry_at` / `email_provider_message_id`；新增 `RfqEmailDeliveryUpdate` |
| `website/src/lib/rfq/store.ts` | 接口新增 `listEmailRetriesDue()` / `claimEmailRetry()`；`updateEmailDelivery()` 改为接收结果对象 |
| `website/src/lib/rfq/stores/memory-store.ts` | 实现重试查询 + 租约占位 |
| `website/src/lib/rfq/stores/json-file-store.ts` | 同上（仍在串行队列内，保证同进程不并发写） |
| `website/src/lib/rfq/stores/supabase-store.ts` | 新增重试字段映射；`listEmailRetriesDue()` 走 PostgREST 过滤；`claimEmailRetry()` 用**带条件的原子 UPDATE + return=representation** 实现租约 |
| `website/src/lib/rfq/mail.ts` | `send()` 返回 `RfqMailResult { providerMessageId }` |
| `website/src/lib/rfq/mail/resend-mailer.ts` | 成功后解析并返回服务商 `id` |
| `website/src/lib/rfq/mail/mock-mailer.ts` | 生成并返回 mock 消息 ID，写入 outbox |
| `website/src/lib/rfq/turnstile.ts` | 新增 hostname 比对（来源 `NEXT_PUBLIC_SITE_URL`，不硬编码域名）；新增**受控 mock 模式**（生产强制失效） |
| `website/src/lib/rfq/service.ts` | 首次失败写入 `next_retry_at` 排入队列；回写 `last_email_attempt_at` / `providerMessageId`；**兜底提示删除时效承诺** |
| `website/src/lib/rfq-payload.ts` | 请求体新增 `turnstile_token`；`BuildRfqBodyOptions` 新增 `turnstileToken` |
| `website/src/components/RfqForm.tsx` | **成功页文案重写**；**删除文件选择框 + fileName 状态 + 附件流程文案**；新增长清单替代提示（邮箱取自 site-facts）；接入 Turnstile；提交失败后重置验证码；删除"usually within one business day" |
| `website/src/components/RfqForm.module.css` | 删除 `.upload` / `.file` / `.fileName`；新增 `.longListHint` |
| `website/src/app/(site)/rfq/page.tsx` | 传入 `contactEmail`（来自 `getSiteFacts()`）；侧边提示改为"保留询价号"，不再声称销售已收到邮件 |
| `website/src/app/(site)/privacy/page.tsx` | 第 5 节改为"直接发邮件到公司邮箱"；第 10 节删除固定 30 天承诺，改为"合理期限内、依适用要求" |
| `website/src/app/(site)/terms/page.tsx` | **删除"Governing law and jurisdiction"整节**，后续章节重新编号（11 变更 / 12 联系） |
| `website/src/app/(site)/contact/page.tsx` | "attach your sourcing list" → "send your sourcing list"（两处） |
| `website/src/app/(site)/page.tsx` | 首页 RFQ CTA "upload your full sourcing list" → "your full sourcing list" |
| `website/tools/verify-rfq-e2e.mjs` | 新增成功页事实性文案断言、无文件框断言、无时效承诺断言；新增**场景 E：启用 Turnstile（mock）** |
| `website/tools/verify-live-browser.mjs` | 探针新增 `fileInputCount` / `h2Headings`；新增 RFQ 附件流程与时效承诺断言、Privacy/Terms 内容断言、Terms 章节编号连续性断言 |

### 2.2 Phase 5 新建、本阶段继续更新（仍为未跟踪）

| 文件 | 改动 |
| --- | --- |
| `website/config/site-env.mjs` | 新增 `isManagedProduction()` / `resolveStoreDriverFromEnv()` / `resolveMailDriverFromEnv()` / `resolveTurnstileState()` / **`validateProductionReadiness()`**（11 条硬校验） |
| `website/config/site-env.d.mts` | 同步类型声明 |
| `website/.env.example` | 新增第 0 节（生产硬保护说明）、`CRON_SECRET`、重试参数、两个测试开关；Turnstile 标注生产必填且成对 |
| `docs/deployment-and-domain-guide.md` | 第 6 节拆为 6.1 硬保护 / 6.2 正式环境变量 / 6.3 Vercel 项目设置；新增 16.1 邮件重试与 Cron；第 12/13 节检查清单与排错表更新 |

---

## 3. 新增文件清单（8 个）

| 文件 | 作用 |
| --- | --- |
| `website/src/components/TurnstileWidget.tsx` | Turnstile 前端组件（未配置 site key 时返回 null；explicit 渲染；token/过期/失败/重置/可访问性；测试模式不加载外部脚本） |
| `website/src/components/TurnstileWidget.module.css` | 验证区样式（与表单其它区块一致） |
| `website/src/lib/rfq/retry.ts` | 邮件重试引擎（到期筛选 → 租约占位 → 复用同一模板重发 → 回写状态；逐条隔离） |
| `website/src/app/api/cron/retry-rfq-email/route.ts` | Cron 端点（Bearer `CRON_SECRET`、常量时间比较、未授权 401、未配置 503、响应只含计数与询价号） |
| `website/vercel.json` | Vercel Cron 配置：`/api/cron/retry-rfq-email`，`*/10 * * * *`，**不含任何密钥** |
| `supabase/migrations/002_add_rfq_email_retry.sql` | 增量迁移：4 个重试字段 + 2 个索引（可叠加在已执行过的 001 之上） |
| `website/tools/verify-launch-hardening.mjs` | 新增验收脚本（58 条断言） |
| `website/tools/verify-production-guards.mjs` | 新增验收脚本（19 条断言，含 3 次真实构建） |

---

## 4. 删除的三个误生成文件及证据

仓库根目录的三个文件确认为命令转义错误产生的**空文件**：

| 文件名（原样） | 大小 | SHA-256 | 引用情况 |
| --- | --- | --- | --- |
| `console.log('ERR'` | **0 字节** | `E3B0C442…7852B855`（空内容哈希） | 仅出现在我自己的 `tmp/*.json` 快照里 |
| `console.log('HTTP'` | **0 字节** | 同上 | 同上 |
| `console.log(Object.keys(m)))` | **0 字节** | 同上 | 同上 |

判定依据：
1. 三个文件都是 0 字节，SHA-256 等于空内容的哈希；
2. 在 `*.mjs/*.js/*.ts/*.tsx/*.json/*.md` 全仓库搜索这三个名字，**唯一命中是我自己生成的 git 状态快照**；
3. 文件名形态是 PowerShell 转义失败留下的残缺代码片段。

处理：只删除这三个明确文件，**没有扩展删除范围**，没有执行 `git clean`。
结果验证：git 状态对比显示"本阶段消失的未跟踪文件"正好是这三个，其余未跟踪文件一个未动。

---

## 5. RFQ 成功文案修复

**问题**：成功页无条件显示 "our sales team has been notified by email"，而服务端允许"已保存但邮件失败"，
于是可能同时出现"销售已收到邮件"和"邮件失败兜底提示"，误导客户。

**修复**（`RfqForm.tsx`）：

| 位置 | 修复前 | 修复后 |
| --- | --- | --- |
| 成功页主文案 | "Your enquiry has been recorded and our sales team has been notified by email. We reply to every enquiry with …" | **"Thank you. Your enquiry has been recorded. Our sales team will reply by email."** |
| 成功页提示行 | "If you selected a sourcing list file, remember to attach it when you reply to our confirmation email." | "Keep the inquiry number above for reference. If your sourcing list is long, you can email it to `<qfbowen@126.com>` and quote this number." |
| 提交按钮下方 | "Replies come by email, usually within one business day." | "Our sales team will reply by email." |
| RFQ 页面侧栏 | "Your enquiry is sent to our sales team …" | "Keep the inquiry number shown after you submit. It identifies your request, and you can quote it if you email us at …" |

保留不变：Inquiry Number 展示；服务端返回 `notice` 时**必定显示**（`data-testid="rfq-notice"`）；
不向客户暴露任何邮件内部状态（`sent` / `pending_retry` / `email_failed` 都不出现在页面上）。

实测：真实浏览器提交后成功页主文案为
`Thank you. Your enquiry has been recorded. Our sales team will reply by email.`，
且整页 0 处 "notified by email" / "confirmation email" / "business day"。

---

## 6. 附件流程删除

**为什么删**：文件选择框既不真实上传、也不进入 API 与邮件，系统也不会给客户发确认邮件，
但页面却要求客户"回复确认邮件并附文件" —— 这条流程实际上无法完成。

**删除清单**（全部完成）：

- `RfqForm.tsx`：`<input type="file">`、`fileName` 状态、`sourcing_list` 输入、`Selected: …` 文案、
  "This form does not upload files …"、"attach it to your reply email"、"reply to our confirmation email"；
- `RfqForm.module.css`：`.upload` / `.file` / `.fileName` 三组样式；
- `Privacy Policy` 第 5 节：删除"把文件作为附件回复确认邮件"的描述；
- `Contact` 页两处 "attach your …" 链接文案、首页 CTA "upload your full sourcing list"。

**替换为**（邮箱从 `site-facts` 读取，未重复硬编码）：

> For long sourcing lists, paste the key OE numbers in the message field or email the file directly to **qfbowen@126.com**.

Privacy 中对应表述改为："For a long sourcing list, either paste the key OE numbers into the message field,
or email the file to qfbowen@126.com and quote your inquiry number."

**未做**（按任务要求）：文件上传、附件存储、客户自动确认邮件 —— 一律没有开发。

---

## 7. 时效承诺删除

全仓库搜索并清除客户可见的未确认时效：

| 位置 | 原文 | 现文 |
| --- | --- | --- |
| `lib/rfq/service.ts` 邮件失败兜底 notice | "If you do not hear back from us within one business day, please email …" | **"Your enquiry has been recorded. If you have not received a reply, please email qfbowen@126.com directly and include your inquiry number."** |
| `RfqForm.tsx` 提交提示 | "usually within one business day" | "Our sales team will reply by email." |
| `privacy/page.tsx` 数据权利 | "We aim to respond within 30 days." | **"We will respond within a reasonable period and in accordance with applicable requirements."** |

核查结果：`src/` 全部 `.ts/.tsx` 中 `business day`、`within N hours/days`、`usually within`、`within 30 days` **0 命中**；
没有新增任何标准回复时间、交期、MOQ、产能或报价时效。

---

## 8. Terms 管辖章节处理

- 整段删除 "11. Governing law and jurisdiction"（含"have not been finalised / legal counsel"字样）。
- 后续章节重新编号：`11. Changes to these terms`、`12. Contact`；
  实测浏览器读取的 `main h2` 编号为 **1…12 连续**。
- **没有**擅自填写中国法、山东法院、仲裁机构或任何海外法律（脚本断言 `Chinese law` / `PRC` /
  `Shandong … court` / `arbitration` / `courts of` 全部 0 命中）。
- 该项列入第 20 节"需要业务方提供"：管辖法律条款等待业务方或法律人员确认，**当前不公开**。
  报告、迁移与代码注释里都保留了这个待办提示，没有编造任何法律意见。

---

## 9. Turnstile 前端实现

**新组件** `website/src/components/TurnstileWidget.tsx`（+ CSS），逐条对应任务要求：

| 要求 | 实现 |
| --- | --- |
| 1 只有配置 site key 才加载 | 构建期常量 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`；未配置时组件 `return null`，不注入任何脚本 |
| 2 使用官方脚本 | `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`（explicit 渲染，带 `data-bowen-turnstile` 去重） |
| 3 token 写入提交数据 | `onToken` → `RfqForm` 状态 → `buildRfqSubmitBody({ turnstileToken })` → 请求体 `turnstile_token` |
| 4 token 过期清空 | `expired-callback` / `timeout-callback` → `onToken(null)` |
| 5 失败可重试 | `error-callback` → 错误提示 + "Try the verification again" 按钮（`data-testid="turnstile-retry"`） |
| 6 提交失败后重置 | 提交失败或网络异常 → `setTurnstileToken(null)` + `setTurnstileReset(n+1)` → widget `reset()` |
| 7 可访问性 | 容器 `aria-labelledby`，状态文字 `role="status"` + `aria-live="polite"`，失败时按钮可键盘操作 |
| 8 不下发 secret | 组件只读 `NEXT_PUBLIC_*`；实测渲染出的 HTML 中不含 secret 占位串 |
| 9 无 site key 时不显示 | 本地/Preview 实测：`/rfq` HTML 中 0 处 turnstile 相关内容 |
| 10 生产必须两个 key | `validateProductionReadiness()` 把两项都列为必填 |
| 11 只配一个必须构建失败 | 生产环境下报 "must be configured together"；纯逻辑与真实构建都已验证 |
| 12 CSP 只在启用时放行 | `securityHeaders()` 仅当 site key 存在时加入 `challenges.cloudflare.com` |
| 13 不放宽其它 CSP 来源 | 实测启用后 CSP 中唯一外部来源就是 `https://challenges.cloudflare.com`，无其它新增来源 |

**服务端**（`turnstile.ts`）继续验证 token，并新增：
- **hostname 比对**：siteverify 返回 `hostname` 时，与 `NEXT_PUBLIC_SITE_URL` 的主机名比较，不一致即 `hostname_mismatch`（**没有硬编码任何正式域名**）；
- **受控 mock**：`RFQ_TURNSTILE_MODE=mock` 时**不发起任何网络请求**，只接受固定测试 token `bowen-turnstile-mock-pass`；
  该开关在 `VERCEL_ENV=production` 下**强制失效**（`turnstileMode()` 直接返回 `live`），
  且生产就绪校验把 `RFQ_TURNSTILE_MODE=mock` 与 `NEXT_PUBLIC_TURNSTILE_MOCK=1` 都判为错误（构建失败）。

**实测（mock，未访问真实 Cloudflare）**：
未配置时 `Postman` 式提交不带 token → 200 成功；启用后不带 token → 400 `CAPTCHA_FAILED`；
伪造 token → 400；有效 mock token → 200 且落库记录里**不含 token 字段**；
真实浏览器中组件产生 token 并提交成功，且页面**没有加载任何第三方脚本**。

---

## 10. Production 环境硬保护

**判定依据是平台标志，不是 `NODE_ENV`**：只用 `VERCEL_ENV === 'production'`。
（本地 `next build` 与 Vercel Preview 也都是 `NODE_ENV=production`，用它判断会卡死本地与预览。）

实现在 `website/config/site-env.mjs` 的 **`validateProductionReadiness()`**，
由 `next.config.ts` 在**构建与启动时**执行；`errors` 非空即 `throw`。

生产必须同时满足的 11 项：

1 `NEXT_PUBLIC_SITE_URL` 正式 https（非 localhost） · 2 `SUPABASE_URL` · 3 `SUPABASE_SERVICE_ROLE_KEY` ·
4 `RFQ_STORE_DRIVER` 解析为 `supabase` · 5 `RESEND_API_KEY` · 6 `RFQ_FROM_EMAIL` ·
7 `RFQ_MAIL_DRIVER` 解析为 `resend` · 8 `RFQ_IP_HASH_SECRET` · 9 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ·
10 `TURNSTILE_SECRET_KEY` · 11 两个 Turnstile key 成对

另有两条测试开关在生产被拒绝：`RFQ_TURNSTILE_MODE=mock`、`NEXT_PUBLIC_TURNSTILE_MOCK=1`。

安全约束（均已验证）：
- 错误信息**只出现变量名**，不出现变量值（构建日志 canary 测试通过）；
- **不允许静默回退**为 json / memory / mock / unconfigured —— 驱动解析结果也被校验；
- `next build` 与 `next start` 都会失败；
- 本地与 Preview **不受影响**：仍可用 json + mock，仍默认 noindex，不因缺凭据阻断构建。

---

## 11. 邮件重试架构

```
Vercel Cron (*/10 * * * *)
      │  GET /api/cron/retry-rfq-email   Authorization: Bearer $CRON_SECRET
      ▼
src/app/api/cron/retry-rfq-email/route.ts
      ├─ 未配置 CRON_SECRET → 503（明确拒绝，不会无鉴权放行）
      ├─ 密钥不匹配 / 缺 Bearer → 401（常量时间比较）
      └─ 通过 → retryPendingRfqEmails()
                 │
                 ├─ listEmailRetriesDue()   只取 email_delivery_status='pending_retry'
                 │                          且 next_retry_at 为空或已到期
                 ├─ claimEmailRetry()       原子占位：把 next_retry_at 推到 now+租约(300s)
                 │                          抢不到 → skip（另一实例在处理）
                 ├─ 复用 renderRfqEmail()   同一套模板，只发给 RFQ_RECIPIENT_EMAIL
                 ├─ 成功 → sent + email_provider_message_id
                 └─ 失败 → retry_count+1；未到上限 → pending_retry + 下次时间
                                              达到上限 → email_failed（不再发送）
```

| 要求 | 实现与验证 |
| --- | --- |
| 只处理 pending_retry | SQL/JSON 过滤 `email_delivery_status=eq.pending_retry` |
| 最多重试 3 次 | `RFQ_EMAIL_MAX_RETRIES`（默认 3），达到上限即 `email_failed`；**实测**：故障场景下重试 3 次后停止 |
| 记录 4 个字段 | `email_retry_count` / `last_email_attempt_at` / `next_retry_at` / `email_provider_message_id`，**实测**均写入 |
| 成功改 sent | **实测**：邮件恢复后 `sent`，`retry_count=1`，记录了 mock 消息 ID |
| 上限后 email_failed | **实测**：`email_failed`，`next_retry_at` 置空 |
| 单条失败不阻断 | 逐条 try/catch；连状态回写失败也只记日志后继续 |
| 防止两个 Cron 重复发送 | 租约（带条件的原子 UPDATE / 序列化写入）→ **实测**：并发两次 `processed=0/0`，outbox 未新增邮件 |
| CRON_SECRET 保护 | 未配置 503；无 Authorization / 错密钥 / 缺 Bearer → **实测** 401 |
| 响应与日志不含客户资料 | 响应只有 `processed/sent/failed/skipped/exhausted/results[{inquiry_number,status,retry_count}]`；日志只写询价号 + 脱敏错误摘要；**实测**无姓名/邮箱/留言 |
| 不返回任何密钥 | 静态断言 + 实测响应体扫描 |
| 不给客户重复发信 | 重试固定发往 `RFQ_RECIPIENT_EMAIL`（销售），`replyTo` 才是客户 |
| 复用同一套模板 | 直接调用 `renderRfqEmail()`，无第二套模板；**实测**重试邮件主题与首次完全一致 |
| mock 可完整测试 | 未访问真实 Resend / Supabase（驱动为 mock + json） |
| 无凭据不访问外部服务 | 同上；`RFQ_TURNSTILE_MODE=mock` 时连 Cloudflare 都不访问 |

**注意（写成文档的不确定性）**：`email_not_configured`（当时根本没有邮件凭据）**不会**被自动重试 ——
补齐凭据后需按 `002` 迁移里的注释 SQL 把历史记录重新排入队列。这是刻意设计，避免在凭据未修好时反复空跑。

---

## 12. Supabase migration 变化

新增 **`supabase/migrations/002_add_rfq_email_retry.sql`**（**没有改动 001**，保证已执行过 001 的环境可平滑升级）：

```sql
alter table public.rfq_inquiries
  add column if not exists email_retry_count         integer not null default 0,
  add column if not exists last_email_attempt_at     timestamptz,
  add column if not exists next_retry_at             timestamptz,
  add column if not exists email_provider_message_id text;

create index if not exists rfq_inquiries_email_retry_due_idx
  on public.rfq_inquiries (next_retry_at)
  where email_delivery_status = 'pending_retry';

create index if not exists rfq_inquiries_email_retry_count_idx
  on public.rfq_inquiries (email_delivery_status, email_retry_count);
```

边界保持：
- **没有**创建任何 RLS 策略（脚本断言 `create policy` 0 命中）；RLS 仍为"启用 + 无策略"；
- 没有新增 IP 列，仍然不保存明文 IP、`source_sheets`、`source_row`、`product_type_evidence`、
  内部审核状态、未公开证书、API Key、错误堆栈；
- 使用 `add column if not exists`，可重复执行。

**尚未在真实 Supabase 执行**（无凭据）。

---

## 13. Vercel Cron 配置

`website/vercel.json`：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/retry-rfq-email", "schedule": "*/10 * * * *" }
  ]
}
```

- 每 10 分钟触发；**配置里不含任何密钥**（脚本断言 `secret` / `key` / 密钥样式字符串 0 命中）。
- Vercel 会在调用时自动带上 `Authorization: Bearer $CRON_SECRET`。
- 注意：Vercel **Hobby 计划**对 Cron 频率有限制（通常每天 1 次）；每 10 分钟需要 **Pro**。
  若暂时只能用低频 Cron，请把 `RFQ_EMAIL_RETRY_DELAY_SECONDS` 调大以匹配实际频率（已写入部署文档）。
- **尚未在 Vercel 上运行过**：没有部署，因此生产 Cron 从未实际触发（见第 15 节分类）。

---

## 14. 环境变量变化

新增（全部写入 `website/.env.example` 与部署文档）：

| 变量 | 生产必填 | 说明 |
| --- | --- | --- |
| `CRON_SECRET` | ✅ | Cron 端点 Bearer 密钥；未配置时接口返回 503（明确拒绝） |
| `RFQ_EMAIL_MAX_RETRIES` | 默认 3 | 最大自动重试次数 |
| `RFQ_EMAIL_RETRY_DELAY_SECONDS` | 默认 600 | 两次重试间隔 |
| `RFQ_EMAIL_RETRY_LEASE_SECONDS` | 默认 300 | 重试租约（防重复发送） |
| `RFQ_EMAIL_RETRY_BATCH` | 默认 20 | 单次 Cron 最多处理条数 |
| `RFQ_TURNSTILE_MODE` | **禁止在生产设置** | 服务端 mock（不访问 Cloudflare）；生产强制失效并判为构建错误 |
| `NEXT_PUBLIC_TURNSTILE_MOCK` | **禁止在生产设置** | 前端 mock；生产判为构建错误 |
| `VERCEL_ENV` | — | 由 Vercel 自动注入，**不要手工设置**；`.env.example` 中仅作说明 |

语义变化：
- Turnstile 两把 key 从"可选"变为**生产必填且必须成对**；
- `SUPABASE_*` / `RESEND_API_KEY` / `RFQ_FROM_EMAIL` / `RFQ_IP_HASH_SECRET` 在 `VERCEL_ENV=production` 下由"警告"变为"**构建失败**"；
- 本地/Preview 的默认行为不变（json + mock + noindex）。

密钥检查（119 个文件逐行扫描）：**凭据类变量被填入真实值 0 处，密钥样式字符串 0 处**；
文档中仅有的两处"非空"是说明性示例（`NEXT_PUBLIC_SITE_URL=https://www.bowen-tech.cn`、
`RFQ_RECIPIENT_EMAIL=qfbowen@126.com`），不是凭据。

---

## 15. 自动化测试结果

全部为本机真实输出。

### 15.1 现有测试（全部保留并通过）

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-product-db-v2.mjs` | **PASS 75 / FAIL 0** |
| `node website/tools/verify-prototype-data.mjs` | **PASS 49 / FAIL 0** |
| `node website/tools/verify-public-surface.mjs` | **PASS 24 / FAIL 0** |
| `node website/tools/verify-engine-code.mjs` | **PASS 28 / FAIL 0** |
| `node website/tools/verify-category-copy.mjs` | **PASS 13 / FAIL 0** |
| `node website/tools/verify-english-product-surface.mjs` | **通过（exit 0）** |
| `node website/tools/verify-rfq-production.mjs` | **PASS 51 / FAIL 0** |
| `node website/tools/verify-seo-readiness.mjs` | **PASS 55 / FAIL 0** |
| `node website/tools/verify-security-headers.mjs` | **PASS 28 / FAIL 0** |
| `node website/tools/verify-rfq-e2e.mjs` | **PASS 32 / FAIL 0**（36.7s，真实 Chrome，2 个服务器场景） |
| `node website/tools/verify-live-browser.mjs` | **PASS 131 / FAIL 0**（57.4s，生产构建 + `next start`） |

### 15.2 新增测试

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-launch-hardening.mjs` | **PASS 58 / FAIL 0**（44.2s，5 个 dev 服务器场景） |
| `node tools/verify-production-guards.mjs` | **PASS 19 / FAIL 0**（58.6s，**含 3 次真实 `next build`**） |

新增测试对任务清单的覆盖（逐条对应）：

| # | 要求 | 覆盖位置 | 结果 |
| --- | --- | --- | --- |
| 1 | 成功页不再无条件声称邮件已发送 | launch-hardening A + rfq-e2e D | ✅ |
| 2 | 邮件失败时只显示"已记录"+诚实 notice | launch-hardening F（`pending_retry` 场景断言 notice 无时效承诺） | ✅ |
| 3 | 页面不再出现 confirmation email | launch-hardening A + rfq-e2e D + live-browser | ✅ |
| 4 | 页面不再出现 one business day | 同上 | ✅ |
| 5 | 页面不存在 sourcing-list 文件输入 | launch-hardening A/D + rfq-e2e D + live-browser（`input[type=file]` = 0） | ✅ |
| 6 | Privacy 不再描述不存在的附件回复流程 | launch-hardening A/D + live-browser /privacy | ✅ |
| 7 | Terms 不再公开未完成的管辖条款 | launch-hardening A/D + live-browser /terms | ✅ |
| 8 | 未配置 Turnstile 时 Preview 正常运行 | launch-hardening D（提交成功、页面无验证码） | ✅ |
| 9 | 只配置一个 Turnstile key 时 Production 失败 | launch-hardening B + production-guards（真实构建） | ✅ |
| 10 | 两个 key 齐全时组件可产生 token 字段 | launch-hardening E（服务端接受）+ rfq-e2e 场景 E（浏览器产生 token 并提交成功） | ✅ |
| 11 | 服务端缺少 token 时拒绝正式 Turnstile 提交 | launch-hardening E（400 CAPTCHA_FAILED）+ 伪造 token 用例 | ✅ |
| 12 | Production 缺少 Supabase 时构建失败 | production-guards（纯逻辑 + **真实构建 #1**） | ✅ |
| 13 | Production 选择 JSON 或 memory 时构建失败 | production-guards A（json / memory / 自动解析三种） | ✅ |
| 14 | Production 缺少 Resend 时构建失败 | production-guards A + 构建 #1 | ✅ |
| 15 | Production 选择 mock 邮件时构建失败 | production-guards A（mock / unconfigured / 自动解析） | ✅ |
| 16 | Production 缺少 RFQ_IP_HASH_SECRET 时构建失败 | production-guards A | ✅ |
| 17 | Cron 无授权时返回 401 | launch-hardening D/F（无 Authorization、错密钥、缺 Bearer 三种） | ✅ |
| 18 | Cron 授权正确时可以处理 mock pending_retry | launch-hardening F | ✅ |
| 19 | 成功重试改为 sent | launch-hardening F（含 `provider_message_id`） | ✅ |
| 20 | 超过最大重试次数改为 email_failed | launch-hardening F（3 次后停止） | ✅ |
| 21 | Cron 响应和日志不包含客户完整资料或密钥 | launch-hardening F（响应体扫描） | ✅ |
| 22 | 394 个公开产品仍然存在 | 构建产物逐 ID 比对（394/394，无多余无缺失）+ 现有测试 | ✅ |
| 23 | 无图产品仍然返回 404 | verify-live-browser（`/products/BW-2043` → 404） | ✅ |
| 24 | 英文产品信息没有回退 | verify-english-product-surface + live-browser 产品区域 0 中文字符 | ✅ |
| 25 | 默认环境仍然 noindex | verify-seo-readiness B 段（11 个页面 meta + 响应头） | ✅ |
| 26 | sitemap 正式配置仍为 402 条 URL | verify-seo-readiness C 段 | ✅ |
| 27 | RFQ 和 OE Search 正式环境仍为 noindex | verify-seo-readiness C 段（/rfq、/oe-search、/blog） | ✅ |

### 15.3 类型与构建

| 项目 | 结果 |
| --- | --- |
| `tsc --noEmit` | **exit 0，0 错误** |
| `next build`（交付默认配置） | **exit 0**，约 19.3s，新增路由 `ƒ /api/cron/retry-rfq-email` 已生成 |
| 预渲染产品页 | **394**（与公开集合逐 ID 比对：无多余、无缺失） |
| 生产构建 #1/#2/#3 | 缺项 → exit 1；齐全 → exit 0；本地形态 → exit 0 |

### 15.4 环境行为说明

- 本机 PATH 上没有 `git`，工作区状态用 `tools/_dsh-git-status.mjs` 解析 `.git` 得到。
- 本机没有 `npm`。全部命令直接调用 `node node_modules/next/dist/bin/next` 与
  `node node_modules/typescript/bin/tsc`：**没有删除 `node_modules`、没有重装依赖**，
  也没有触发 pnpm 的依赖清理保护。
- 无头 Chrome 需要更宽的运行时权限才能启动（多进程 IPC 依赖命名管道）；本轮全部浏览器结论都是真实运行结果。
- 所有测试产物（`tmp/phase51-*`、临时 JSONL 落库与 mock outbox）都留在 `tmp/`（已 gitignore）。

---

## 16. 浏览器实测结果

**生产构建 + `next start`（端口 3100）**，Chrome DevTools Protocol 实测。

| 路由 | 结果 |
| --- | --- |
| `/` | 200，noindex，无溢出，0 控制台错误 |
| `/products` | 200 |
| `/products/BW-3005` | 200，产品区域纯英文 |
| `/oe-search?q=25500-35540` | 200，仍 noindex |
| `/rfq?product=BW-3005` | 200，表单可交互、带入 1 行、同意框未勾选、honeypot 不可见、**0 个文件选择框** |
| `/privacy` | 200，含公司主体/收集范围/权利/联系方式；无附件流程、无 30 天承诺 |
| `/terms` | 200，含适配确认/无自动报价/责任限制；**无 Governing law 章节**；编号 1…12 连续 |
| `/robots.txt` | 200，预览配置全站 Disallow |
| `/sitemap.xml` | 200，预览配置空 urlset、无 localhost |
| `/products/BW-DOES-NOT-EXIST-0000` | **404** |
| `/products/BW-2043`（无图产品） | **404** |
| `/api/cron/retry-rfq-email`（无 token） | **401** |
| `/api/cron/retry-rfq-email`（正确 token） | 200，`{"ok":true,"processed":0,…}`，无客户资料、无密钥 |

逐路由断言共 **131 条全部通过**：HTTP 状态、0 控制台 error / 0 hydration 报错、
390px 与 1440px 均无横向溢出、页面无 15 类内部标记、产品区域 0 中文字符、
默认 noindex、canonical 不含本地地址、RFQ 附件流程与时效承诺全部 0 命中。

RFQ 浏览器端到端（**32 条全部通过**）：
空表单被拦下且无内部 JSON；隐私同意默认**未勾选**、未勾选不能提交、可手动勾选；
明细可加可删；提交后进入成功页并显示 `BW-RFQ-YYYYMMDD-XXXXXX`；
成功页**只陈述"已记录"**、不显示内部 JSON、不声称邮件已发送、无时效承诺、**无文件框**；
落库与 mock outbox 证据齐全（`transport=mock, to=qfbowen@126.com`，**未真实外发**）；
启用 Turnstile（mock）后：页面不加载任何第三方脚本、无 token 被拒、伪造 token 被拒、携带 token 提交成功。

横向溢出：`/`、`/products/BW-3005`、`/rfq`、`/terms` 在 **390px 均为 0px**；`/rfq` 在 **1440px 为 0px**。

---

## 17. 394 个产品是否保持

**是，保持 394 个。**
- 交付默认构建产物中 `.next/server/app/products/*.html` 共 **394** 个；
- 与按 Phase 4.1 准入规则独立复算的公开集合 **逐 ID 完全一致**（无多余、无缺失）；
- 公开产品数仍为 394（内部总表 426 条，差额 32 条仍是无可靠主图、按业务决定不公开的记录）；
- 本阶段**没有**新增任何产品、没有重新公开无图产品。

## 18. 无图产品是否继续排除

**是，继续排除。**
- 仓储准入（状态允许 + 未 blocked + 有可靠主图）未改动；
- 浏览器实测 `/products/BW-2043`（无图产品）→ **404**；
- RFQ 服务端仍拒绝无图/draft 产品的提交（verify-rfq-production 51 条断言含这两类拒绝路径）。

## 19. noindex 是否继续保持

**是，继续保持 noindex。**
- `SITE_INDEXING_ENABLED` 默认 `false`，本阶段**没有**打开收录；
- 预览配置下 11 个页面 meta robots 与 `X-Robots-Tag` 均为 `noindex, nofollow`，`robots.txt` 全站 Disallow，sitemap 为空；
- 正式索引配置（仅用于验收的临时进程）下：公开页允许收录、sitemap 402 条 URL、
  `/rfq` 与 `/oe-search` 与 `/blog` 仍为 noindex —— 该配置**未用于交付产物**。

## 20. 仍缺少的真实外部凭据

| 凭据 | 状态 | 影响 |
| --- | --- | --- |
| 正式域名接入（`www.bowen-tech.cn`） | **未接入** | canonical/sitemap 仍为预览形态 |
| Vercel 账号 + 项目 | **未创建** | Cron 从未在生产运行；Preview 未部署 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **未配置** | 询价写在本地 JSONL；migration 001/002 均未执行 |
| `RESEND_API_KEY` / `RFQ_FROM_EMAIL`（已验证发件域） | **未配置** | **没有任何真实邮件发出**；邮件内容与失败/重试路径均为 mock 验证 |
| `RFQ_IP_HASH_SECRET` | **未配置** | 限流键使用进程内随机密钥 |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **未配置** | 表单不显示验证码；服务端跳过校验（其余反垃圾手段仍生效） |
| `CRON_SECRET` | **未配置** | Cron 接口会返回 503；本地实测时使用临时值 |

**明确说明**：本阶段没有创建任何第三方账号、没有申请任何 API Key、没有连接真实 Supabase、
没有发送任何真实邮件、没有部署到 Vercel、没有绑定域名、没有修改 DNS、没有开启收录。

---

## 21. 建议提交文件清单

> 只生成清单，**未执行 `git add` / `git commit` / `git push`**。
> 工作区当前有 532 个未跟踪文件（含前几个阶段的产物），下表只列本阶段相关且**生产必需**的文件。

**本阶段新建（8）**

```
supabase/migrations/002_add_rfq_email_retry.sql
website/src/app/api/cron/retry-rfq-email/route.ts
website/src/components/TurnstileWidget.tsx
website/src/components/TurnstileWidget.module.css
website/src/lib/rfq/retry.ts
website/vercel.json
website/tools/verify-launch-hardening.mjs
website/tools/verify-production-guards.mjs
```

**本阶段修改的已跟踪文件（23）**

```
website/next.config.ts
website/package.json
website/src/lib/rfq/constants.ts
website/src/lib/rfq/types.ts
website/src/lib/rfq/store.ts
website/src/lib/rfq/stores/memory-store.ts
website/src/lib/rfq/stores/json-file-store.ts
website/src/lib/rfq/stores/supabase-store.ts
website/src/lib/rfq/mail.ts
website/src/lib/rfq/mail/mock-mailer.ts
website/src/lib/rfq/mail/resend-mailer.ts
website/src/lib/rfq/turnstile.ts
website/src/lib/rfq/service.ts
website/src/lib/rfq-payload.ts
website/src/components/RfqForm.tsx
website/src/components/RfqForm.module.css
website/src/app/(site)/rfq/page.tsx
website/src/app/(site)/privacy/page.tsx
website/src/app/(site)/terms/page.tsx
website/src/app/(site)/contact/page.tsx
website/src/app/(site)/page.tsx
website/tools/verify-rfq-e2e.mjs
website/tools/verify-live-browser.mjs
```

**本阶段修改、Phase 5 新建的未跟踪文件（4）**

```
website/config/site-env.mjs
website/config/site-env.d.mts
website/.env.example
docs/deployment-and-domain-guide.md
```

**本阶段删除的 3 个误生成空文件（需在提交里体现删除）**

```
console.log('ERR'
console.log('HTTP'
console.log(Object.keys(m)))
```

**提交前需要注意**
- 本阶段报告 `docs/phase-5.1-launch-hardening.md` 与 Phase 5 报告一并提交；
- 仓库整体仍有大量前几阶段未跟踪产物（`data/`、`delivery/`、`tools/`、`docs/` 等），
  是否提交不属于本任务范围，建议由业务方决定后再一起提交；
- **不要**把 `tmp/`、`.rfq-data/`、`.rfq-mock/` 提交（已在 `.gitignore`）；
- 建议按主题拆分提交：① RFQ 文案与附件流程 ② Turnstile ③ 生产硬保护 ④ 邮件重试与 Cron ⑤ 测试与文档。

---

## 22. 是否具备进入 Vercel Preview 阶段的条件

**具备。**

理由：

1. **工程门禁全绿**：`tsc` 0 错误；`next build` 通过（394 个产品页、新增 Cron 路由）；
   12 个测试脚本全部通过（现有 6 个 + Phase 5 的 4 个 + 本阶段新增 2 个，
   其中 `verify-rfq-e2e` 与 `verify-live-browser` 是真实浏览器）。
2. **生产硬保护已实测生效**：3 次真实构建证明"生产缺项必失败、齐全可通过、本地不被阻断"，
   且失败日志只报变量名、不泄露值。
3. **RFQ 收口完成**：成功页不再误报邮件已发送；附件流程与不存在的确认邮件流程彻底删除；
   未确认的回复时效承诺清除。
4. **合规文本收敛**：Terms 不再公开未完成的管辖章节（并保留待确认提示，未编造法律意见）。
5. **Turnstile 前后端闭环**：未配置时不显示也不加载任何第三方脚本；配置后 token 端到端可用，
   服务端校验 + hostname 比对 + 只配一个 key 时构建失败。
6. **邮件失败可自愈**：重试代码 + Cron 端点 + 迁移 + `vercel.json` 全部就位并已 mock 验证；
   租约机制防止重复发送；达到上限落终态。
7. **没有回归**：394 个公开产品、无图产品 404、英文产品面、默认 noindex、sitemap 402 条全部保持；
   工作区既有修改零破坏（HEAD 未变、24 个 deleted 未动、红线资料未改）。

**进入 Vercel Preview 前业务方需要提供 / 操作**：

| 需要什么 | 用途 | 是否阻断 Preview |
| --- | --- | --- |
| Vercel 账号 + 创建项目（Root Directory = `website`） | 部署 Preview | **必须**（业务方操作） |
| 部署平台的 Preview 环境变量 | 至少 `NEXT_PUBLIC_SITE_URL=<预览地址>`；Preview **不要**开 `SITE_INDEXING_ENABLED` | **必须** |
| Supabase 项目 + 执行 `001` 与 `002` 迁移 | Preview 需要持久化询价（也可先用 json 临时验证） | 建议（Preview 可用 json 回退） |
| Resend 账号 + 已验证发件域 + `RFQ_FROM_EMAIL` | 真实邮件通知 | 建议（Preview 可用 mock，不会发真实邮件） |
| Cloudflare Turnstile 两把 key | Preview 验证验证码链路 | 可选（Preview 不配则不显示） |
| `CRON_SECRET` | Preview 上手工触发重试端点 | 可选 |
| Terms 管辖法律条款的最终文本 | 补回被删除的章节 | 上线前必须（当前不公开） |

> Preview 阶段**不要**把 `SITE_INDEXING_ENABLED` 设为 `true`，也**不要**绑定正式域名；
> 这两件事属于 Production 上线动作，需要业务方明确确认后再做（详见
> `docs/deployment-and-domain-guide.md` 第 6–8 节）。
