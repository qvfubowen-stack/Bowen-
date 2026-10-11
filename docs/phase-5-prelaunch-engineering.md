# Phase 5 — Pre-launch Engineering 交付报告

> **后续决策（2026-09-26）**：当前低成本上线版本不再运行自动邮件重试。
> 本文出现的 `pending_retry` 仅为历史阶段记录；当前失败状态为 `email_failed`，详情见
> `docs/phase-5.2-low-cost-email-delivery.md`。

**项目**：博文外贸独立站（B2B 英文站）· `C:\Users\asus\Desktop\B2B外贸独立站`
**网站目录**：`website/`
**报告日期**：2026-09-26
**本阶段结论**：代码、测试、真实浏览器实测均已完成并实测通过。**未部署、未绑定域名、未修改 DNS、未开启收录、未提交 Git**。RFQ 已具备服务端校验 / 存储 adapter / 邮件 adapter / 反垃圾；SEO 基础设施、隐私与条款、安全响应头、环境变量体系、部署文档与 4 个新增验收脚本全部就位。真实邮件与真实数据库尚未连通（缺少外部凭据，见第 22 节）。

> 阅读提示：本文严格区分 **① 已完成并实测** / **② 已完成代码但缺少真实凭据** /
> **③ 需要业务方确认** / **④ 尚未实施** / **⑤ 建议项**。凡是 mock 测试，一律不会写成"真实邮件已发送"；
> 凡是本地验证，一律不会写成"正式环境已上线"。

---

## 1. 接手时工作区状态

接手时先用仓库自带的零依赖工具 `tools/_dsh-git-status.mjs` 记录基线
（该工具直接解析 `.git` 目录；本机 PATH 上没有 `git` 可执行文件）。

原始快照保存在 `tmp/phase5-git-status-before.json`。

| 项目 | 接手时 | 结束时 | 说明 |
| --- | --- | --- | --- |
| 分支 | `main` | `main` | 未变 |
| HEAD | `2e8924301076…`（"Phase 3.5：审计 qfbowen.com…"） | 同一 SHA | **未提交、未推送、未建 PR** |
| 已跟踪文件 modified | 64（`worktreeDirty` 列 88 项，含规范化差异） | 68（列 92 项） | 见第 2 节 |
| deleted | 24 | 24 | **同一批 24 个文件，一个都没被恢复，也没新增删除** |
| untracked | 487 | 527 | 新增 40 个 = 本阶段新建文件（清单见第 3 节） |
| 冲突 | 0 | 0 | — |

**红线检查（结束时）**：
- `data/raw/`、`宣传手册最终PDF/`、`data/legacy-site/`、`review/`、`data/processed/` **均未被改动**（逐路径比对，0 命中）。
- 接手时已 deleted 的 24 个文件**全部保持 deleted**（都是 `data/processed/product-image-review/` 下的联系表与图片产物）。
- 接手时已 modified 的 88 个已跟踪文件**全部仍然 modified**（本阶段没有覆盖或还原任何既有修改）。
- 接手时遗留的与本任务无关的修改（例如 `data/derived/v2/*`、`data/processed/*`、`tools/*.mjs`、`delivery/*`）**原样保留**。

**接手时的一个既有失败**（重要，已如实记录）：
`website/tools/verify-category-copy.mjs` 在接手时是 **FAIL（PASS 11 / FAIL 1）**，
原因是上一个任务新增的 `website/src/lib/application-display.ts` 里的**术语翻译词典**包含
`['节温器总成', 'Thermostat assembly']`、`['节温器芯三件套', 'Thermostat insert kit']` 这两条映射，
被该守卫的禁用词正则误判为"把 insert/assembly 当产品分类"。
处理方式见第 2 节第 20 项：**只收窄守卫的误报范围，不放宽真规则，也没有删除词典内容**。

---

## 2. 实际修改文件清单（已跟踪文件，共 21 个）

| # | 文件 | 改动内容 |
| --- | --- | --- |
| 1 | `.gitignore` | 新增 `.rfq-data/`、`.rfq-mock/`、`rfq-outbox.jsonl`（询价记录与 mock outbox 含个人数据，绝不入库） |
| 2 | `website/package.json` | 更新 description；新增脚本 `verify:rfq:production`、`verify:seo`、`verify:headers`、`assets:brand` |
| 3 | `website/next.config.ts` | 安全响应头 + 安全 CSP + 收录开关驱动的 `X-Robots-Tag`；**移除 `X-Prototype-Phase`**；开启收录但没有正式 https 域名时**直接构建失败**；警告去重 |
| 4 | `website/src/app/layout.tsx` | `metadataBase` / canonical / Open Graph / Twitter card / icons / manifest；内联 Organization + WebSite JSON-LD；robots 改由开关决定 |
| 5 | `website/src/app/(site)/page.tsx` | 独立 metadata（title/description/canonical/OG） |
| 6 | `website/src/app/(site)/products/page.tsx` | metadata + canonical（筛选参数不单独收录）+ OG |
| 7 | `website/src/app/(site)/products/[id]/page.tsx` | `generateMetadata` 重写（title 不堆 OE、description 最多 4 个 OE + 确认适配口径）；新增 Product + BreadcrumbList JSON-LD |
| 8–11 | `about` / `factory` / `quality` / `contact` 的 `page.tsx` | canonical + OG URL |
| 12 | `website/src/app/(site)/rfq/page.tsx` | 声明始终 noindex；删除"邮件未接入"的原型提示，换成真实的询价号说明 |
| 13 | `website/src/app/(site)/oe-search/page.tsx` | 声明始终 noindex（查询结果页不参与索引） |
| 14 | `website/src/app/(site)/blog/page.tsx` | 声明始终 noindex（没有正式文章，不作 SEO 入口） |
| 15 | `website/src/components/RfqForm.tsx` | **生产化改造**：POST `/api/rfq`、Submitting 状态、成功页显示 Inquiry Number、字段级英文错误、防重复点击、保留用户输入、隐私同意框（默认不勾选）+ `/privacy` 链接、honeypot、最短耗时、删除 JSON payload 与全部原型文案 |
| 16 | `website/src/components/RfqForm.module.css` | 新增成功页/错误/honeypot/同意区样式；删除 `.payload*`（内部 JSON 展示样式） |
| 17 | `website/src/components/SiteFooter.tsx` | 新增 Legal 列：Privacy Policy / Terms of Use |
| 18 | `website/src/components/SiteFooter.module.css` | 网格由 4 列改 5 列（容纳 Legal 列） |
| 19 | `website/src/lib/rfq-payload.ts` | 由"构造待展示 payload"改为"构造 POST 请求体"；新增 honeypot / consent / elapsed_ms / source_page / privacy 版本；删除 `prototype_no_email_sent` |
| 20 | `website/tools/verify-category-copy.mjs` | **收窄误报**：新增"术语词典成对字面量"例外（只对 `src/lib/application-display.ts`、只对 `['中文','English'],` 形式的整行生效），并**新增一条断言**"该例外永不适用于 `app/` 与 `components/` 页面文案" |
| 21 | `website/tools/verify-rfq-e2e.mjs` | 由"原型 payload 断言"改写为"生产接口断言"（成功页询价号、无内部 JSON、无原型文案、同意框默认不勾选、明细可加可删、落库与 mock 邮件证据） |

> 关于第 20 项：原守卫的意图是"页面不得把 insert / assembly 当产品分类或筛选项"。
> 术语翻译词典不是分类，也不是筛选项，A 段已独立校验产品分类只允许
> `tools/config/product-types.mjs` 的 canonical 值。改动只影响误报行（3 行），
> 并额外加了一条"例外不适用于页面文件"的断言，因此**没有降低任何真实约束**。

---

## 3. 新增文件清单（40 个，含本报告）

### RFQ 生产化（16）
```
website/src/app/api/rfq/route.ts              POST 端点（含同源检查、体积上限、方法白名单）
website/src/lib/rfq/constants.ts              限额 / 状态 / 错误码 / 同意版本（前后端共用）
website/src/lib/rfq/types.ts                  领域类型（与 SQL 表结构一一对应）
website/src/lib/rfq/sanitize.ts               清 HTML/脚本、长度截断、邮箱与 URL 校验、HTML 转义
website/src/lib/rfq/validate.ts               服务端唯一可信校验（白名单 + 仓储交叉核对）
website/src/lib/rfq/service.ts                编排：限流→验证码→校验→去重→落库→发信→写状态
website/src/lib/rfq/store.ts                  存储适配层（驱动选择 / 凭据检测）
website/src/lib/rfq/stores/memory-store.ts    内存存储（自动化测试）
website/src/lib/rfq/stores/json-file-store.ts JSONL 持久化回退（无凭据时不丢单）
website/src/lib/rfq/stores/supabase-store.ts  Supabase REST 实现（无第三方 SDK 依赖）
website/src/lib/rfq/mail.ts                   邮件适配层（驱动选择 / 收件人 / 发件人）
website/src/lib/rfq/mail/templates.ts         主题 + 纯文本 + HTML 模板（全量转义）
website/src/lib/rfq/mail/resend-mailer.ts     Resend 实现（带超时、错误脱敏）
website/src/lib/rfq/mail/mock-mailer.ts       mock 实现（写 outbox，可注入失败）
website/src/lib/rfq/rate-limit.ts             内存限流 + HMAC 短期限流键 + 内容指纹
website/src/lib/rfq/turnstile.ts              Cloudflare Turnstile（可选项，未配置即跳过）
website/src/lib/rfq/errors.ts                 内部错误类型 + 可安全入日志的脱敏摘要
```

### SEO / 站点基础（8）
```
website/config/site-env.mjs / .d.mts   站点地址、收录开关、安全响应头、配置校验（唯一来源）
website/src/lib/site-url.ts            canonical / robots / 绝对 URL 封装
website/src/lib/structured-data.ts     Organization / WebSite / BreadcrumbList / Product + 安全序列化
website/src/app/robots.ts              robots.txt（按收录开关分支）
website/src/app/sitemap.ts             sitemap.xml（产品清单来自仓储方法）
website/src/app/manifest.ts            Web App Manifest
website/src/app/(site)/privacy/page.tsx Privacy Policy
website/src/app/(site)/terms/page.tsx   Terms of Use
website/src/app/(site)/legal.module.css 法务页共用排版
```

### 站点展示素材（3，脚本生成，非 AI 生成）
```
website/public/icon.png          512×512  站点现有 "BW" 字标 + 纯色底（可替换）
website/public/apple-icon.png    180×180  同上
website/public/og-image.png      1200×630 复用公司**现有 Logo 原图**（未裁剪/未改色）+ 英文品牌信息
website/tools/build-brand-assets.mjs     用本机 Chrome + CDP 截图生成上述三个素材（零图像库依赖）
```

### 测试与文档（6）
```
website/tools/lib/verify-helpers.mjs          验收脚本共用工具（服务器启动、断言、公开集合复算）
website/tools/verify-seo-readiness.mjs        SEO 就绪验收
website/tools/verify-rfq-production.mjs       RFQ 生产化验收
website/tools/verify-security-headers.mjs     安全响应头验收
website/tools/verify-live-browser.mjs         真实浏览器逐路由实测
website/.env.example                          环境变量模板（只有变量名与安全示例）
supabase/migrations/001_create_rfq_inquiries.sql  RFQ 询价表 + 索引 + RLS
docs/deployment-and-domain-guide.md           部署与域名接入指南
docs/phase-5-prelaunch-engineering.md         本报告
```

---

## 4. RFQ 架构

```
浏览器 (RfqForm.tsx, client)
  │  1. 客户端预校验（仅 UX）+ 组装 JSON 请求体（src/lib/rfq-payload.ts）
  │  2. POST /api/rfq  { name…, items[], consent, privacy_consent_version,
  │                      source_page, elapsed_ms, fax(honeypot), turnstile_token? }
  ▼
website/src/app/api/rfq/route.ts        （Node runtime，force-dynamic，响应全部 no-store）
  ├─ 同源检查（Origin ≠ 本站 → 403）
  ├─ 请求体上限 64KB（Content-Length 与实际字节双检 → 413）
  ├─ JSON 解析失败 → 400（不是 500）
  ├─ 其它 HTTP 方法 → 405 + Allow: POST
  ▼
src/lib/rfq/service.ts  submitRfq()
  ├─ ① 限流         checkRateLimit(HMAC(ip))            → 429 + Retry-After
  ├─ ② Turnstile    未配置即跳过；配置则 fail-closed     → 400
  ├─ ③ 服务端校验   validateRfqBody()（唯一可信点）      → 400 + field_errors
  ├─ ④ 去重         sha256(邮箱+留言+明细) 指纹          → 409
  ├─ ⑤ 落库         RfqStore.create()   ★先存后发       → 失败即 503，不假装成功
  └─ ⑥ 发信         RfqMailer.send()    → 成功 sent / 失败 pending_retry|email_not_configured
  ▼
存储驱动（RFQ_STORE_DRIVER / 自动判定）      邮件驱动（RFQ_MAIL_DRIVER / 自动判定）
  ├─ supabase  生产推荐（REST，service role）  ├─ resend       生产推荐（REST，带超时）
  ├─ json      无凭据时的持久化回退            ├─ mock         测试/预览（写 outbox，不外发）
  └─ memory    自动化测试                      └─ unconfigured 生产缺变量时显式失败
```

**分层原则**：页面只调 `src/lib/db.ts`；RFQ 只调 `service.ts`；
驱动实现藏在 `stores/` 与 `mail/` 后面，替换实现不影响路由层。
**产品数据边界**：产品 / application / OE 索引**继续**使用 `website/src/data/*.json`，未迁移到 Supabase。

---

## 5. RFQ 字段

### 5.1 客户端可提交（严格白名单，多一个键即整体拒绝）
```
name  company  country  email  whatsapp_phone  website  message
items[]  consent  privacy_consent_version  source_page  elapsed_ms  turnstile_token  fax(honeypot)
items[] 内层白名单：product_id  bowen_no  product_type  application_id  matched_oe  vehicle  quantity  remark
```
`product_type` / `matched_oe` / `vehicle` 虽然允许客户端携带，但**只用于比对**，
落库值一律由服务端从公开产品数据重新推导（见 5.4）。

### 5.2 服务端落库字段（与 SQL 列一一对应）
```
id  inquiry_number  name  company  country  email  whatsapp_phone  website  message
items_json  source_page  status  email_delivery_status  email_delivery_error
privacy_consent_version  user_agent  submission_fingerprint  created_at  updated_at
```
`inquiry_number` 形如 `BW-RFQ-20260926-D1352C`（UTC 日期 + 6 位随机十六进制）。

### 5.3 明确不落库 / 不返回
`source_sheets`、`source_row`、`product_type_evidence`、内部审核状态、
未公开证书信息、API Key、原始错误堆栈、**明文 IP**。
`user_agent` 仅保留 400 字符用于异常排查；IP 只用于内存限流（HMAC 截断键，不写库、不入日志）。

### 5.4 校验规则（服务端）
| 字段 | 规则 |
| --- | --- |
| 请求体 | 必须是 JSON 对象；出现白名单以外的键 → 整体拒绝 |
| `name` / `company` / `country` | 必填，清洗后非空，长度 120 / 160 / 80 |
| `email` | 必填，正则严格校验，≤ 200 |
| `whatsapp_phone` | 选填；填写时须含 5–25 位数字 |
| `website` | 选填；缺协议时自动补 `https://`，仍非法则拒绝 |
| `message` | ≤ 5000 字符（多行，保留换行，压缩连续空行） |
| `items` | ≤ 50 行；`product_id` 必须能在公开仓储取到（＝状态允许 + 未 blocked + 有可靠主图） |
| `application_id` | 选填；若给出必须属于该产品且是可对外展示的 application |
| `bowen_no` | 与服务端记录比对（忽略大小写/空格），不一致则拒绝 |
| `quantity` / `remark` | ≤ 60 / 240 字符 |
| `consent` | 必须显式 `true`（前端复选框默认不勾选） |
| `privacy_consent_version` | 必须等于当前版本 `2026-09-rfq-en-v1`，否则要求用户刷新页面重新确认 |
| `source_page` | 只允许站内相对路径（`/` 开头、无空白、非协议相对） |
| `elapsed_ms` | 小于 `RFQ_MIN_FILL_MS`（默认 3000）视为机器人 |
| 明细为空且留言为空 | 拒绝（`field_errors.message`） |

---

## 6. RFQ 数据存储流程

1. **先落库、后发信**。`store.create(record)` 成功之后才会渲染并发送邮件。
2. 落库失败 → 返回 `503 SERVICE_UNAVAILABLE`，客户看到"未记录成功，请稍后重试或直接发邮件"，
   **不会发出任何邮件**，也不会出现"半真半假"的成功。
3. 落库成功 → 发送邮件 → 无论成败都用 `updateEmailDelivery()` 回写投递状态；
   状态回写失败只记日志，不影响"询价已收到"这一事实。
4. 去重查询发生在落库之前；去重查询异常时**不阻断**真实客户（记日志后继续）。
5. 驱动选择：`RFQ_STORE_DRIVER` 显式指定 → 按它执行；否则配置了
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 用 `supabase`，否则用 `json`（本地 JSONL）。
6. 无凭据时的 `json` 回退写入 `<项目目录>/.rfq-data/rfq-inquiries.jsonl`（已在 `.gitignore`），
   目录不可写时 `create()` 抛错 → API 返回 503（宁可让客户重试，也不假装收到）。

**Supabase 侧安全**（`supabase/migrations/001_create_rfq_inquiries.sql`）：
启用 RLS 且**不创建任何策略**（`anon` / `authenticated` 一律读不到、写不进），
并显式 `revoke all ... from anon / authenticated / public`；
唯一写入口是服务端 API 使用 service role key；表内**没有 IP 列**。

---

## 7. 邮件发送流程

- 驱动：`resend`（生产）/ `mock`（测试与预览）/ `unconfigured`（生产缺变量时显式失败）。
- 收件人：`RFQ_RECIPIENT_EMAIL`，默认 `qfbowen@126.com`（业务方已确认）。
- 发件人：`RFQ_FROM_EMAIL`；**没有正式域名时保持为空，不编造**。为空且驱动为 resend 时
  抛出明确错误（`RFQ_FROM_EMAIL is not configured: a verified sender address is required…`）。
- `Reply-To` = 客户邮箱，销售可直接回复。
- 主题：`New RFQ — [Company] — [Inquiry Number]`。
- 正文同时提供**纯文本**与 **HTML** 两个版本，字段齐全：
  Inquiry Number / Customer Name / Company / Country / Email / Phone-WhatsApp / Website / Message /
  每行的 Bowen No. · OE Reference · Product Type · Vehicle-Application · Quantity · Application ID · Remark /
  Submitted At / Source Page / Privacy consent 版本。
- HTML 版本所有插值都经过 `escapeHtml()`；纯文本版本保留客户原文。
- 请求带 15s 超时；失败只保留 HTTP 状态码与供应商错误类型，**不打日志密钥、不回显响应体**。
- mock 驱动把邮件完整写入 outbox JSONL（`RFQ_MOCK_OUTBOX_PATH`），**绝不发起网络请求**。

---

## 8. 邮件失败时的处理

| 情形 | 询价记录 | 投递状态 | 客户看到 |
| --- | --- | --- | --- |
| 发送成功 | 保留 | `sent` | 询价号 + "已通知销售团队" |
| 邮件通道故障（网络/供应商拒绝/mock 注入失败） | **保留** | `pending_retry`（有错误摘要） | 询价号 + 诚实提示："如一个工作日内未回复，请直接发邮件到 qfbowen@126.com" |
| 生产环境未配置邮件凭据 | **保留** | `email_not_configured` | 同上 |
| 落库失败 | 无记录 | — | `SERVICE_UNAVAILABLE`："未能记录，未发送任何内容，请稍后重试或直接发邮件" |

实测证据（`verify-rfq-production.mjs` C 段，mock 注入失败）：
接口仍返回 `ok:true`，记录 `email_delivery_status = pending_retry`，
`email_delivery_error = "RfqMailError: mock transport is configured to fail (RFQ_MOCK_MAIL_FAIL=true)"`，
且 outbox 中**确实没有**该封邮件 —— 既没丢单，也没有假装发送。

---

## 9. 垃圾询价防护

| 手段 | 实现位置 | 说明 |
| --- | --- | --- |
| 隐藏 honeypot | `RfqForm`（字段名 `fax`，视口外 + `tabIndex=-1` + `aria-hidden`）→ `validate.ts` | 真实用户看不到；填了即 `SPAM_REJECTED`，且不给出可用反馈 |
| 最短填写耗时 | 前端记录挂载时间戳 → 服务端比对 `RFQ_MIN_FILL_MS`（默认 3000ms） | 低于阈值即拒绝 |
| 服务端限流 | `rate-limit.ts` + `service.ts` | 默认 5 次 / 10 分钟 / 连接，超限 429 + `Retry-After` |
| IP 隐私 | `buildRateLimitKey()` = HMAC-SHA256(secret, ip) 前 32 位 | **不保存明文 IP**，不入库、不入日志；未配置密钥时用进程内随机密钥 |
| 邮箱格式 | `isValidEmail()` | 严格正则，拒绝宽松匹配 |
| URL 格式 | `isValidHttpUrl()` + 自动补协议 | 非法即拒绝 |
| 字段长度 | `FIELD_LIMITS`（前后端共用一份） | 超长截断到上限后落库 |
| 请求体大小 | `MAX_BODY_BYTES = 64KB` | 声明长度与实际字节双检 → 413 |
| 重复提交检测 | `sha256(邮箱+留言+明细)` + `RFQ_DUPLICATE_WINDOW_SECONDS`（900s） | 409 `DUPLICATE_SUBMISSION`，并回显已有询价号 |
| 无效 / 非公开产品 | `getProductById()`（仓储层已保证有可靠主图） | 无图产品、draft、blocked、不存在的 ID 一律拒绝 |
| 非法 application | `getDisplayApplications()` 交叉核对 | 不属于该产品的 application 被拒绝 |
| 同源检查 | `route.ts` `isSameOrigin()` | 拒绝跨站 Origin（403） |
| Cloudflare Turnstile | `turnstile.ts`（可选） | **未配置即跳过，不伪造验证码通过**；配置后 fail-closed |

> 生产部署时必须注意：限流依赖客户端 IP，而 Next 的 Route Handler 拿不到 socket 地址。
> 只有在确认前置代理会覆写 `x-forwarded-for` 时才设置 `RFQ_TRUST_PROXY=true`，
> 否则客户端可伪造该头绕过限流（已写入部署文档第 10 节）。
> 单进程内存限流在多实例下不共享；接口已收敛到 `checkRateLimit()`，后续可换 Redis。

---

## 10. Privacy 与 Terms 内容边界

**已写进去的（全部有据可查）**：公司英文/中文全称、已确认的街道地址、邮箱、电话；
收集范围（表单字段 + 提交时间 + UA）；用途；RFQ 处理链路；邮件服务；
存储位置与访问控制；保守的保存期限措辞
（*"only for as long as reasonably necessary to respond to the inquiry, maintain business records and meet applicable legal obligations"*）；
安全措施；第三方服务**按类别**描述；查询/更正/删除请求方式（30 天响应目标）；政策更新；
童工条款；联系方式。

**刻意没有写的（不得编造）**：公司注册号、法定代表人、海外办公室、数据保护官（DPO）、
欧盟实体、未实际使用的第三方服务（没有写 Google Analytics / 广告像素 —— 本站确实没有）、
虚假保存期限、未经确认的司法管辖条款。

**Terms**：网站用途（B2B 采购参考）、产品资料仅供参考、OE 号是交叉参考且商标归原权利人、
**适配关系下单前必须确认**、不构成自动报价/无价格无库存、图片与内容权利、禁止滥用、
可用性、责任限制（含不可限制情形的保留）、条款更新、联系方式。

**管辖法律条款的处理**：没有猜测，而是在页面上明确标注待确认：
> "Governing law and the courts with jurisdiction over disputes have not been finalised.
> This section will be completed on the advice of our legal counsel and published here before orders are accepted."

这一项同时列入第 23 节"需要业务方确认"。

**页面还会如实说明的几点**（避免过度承诺）：
- RFQ 表单**不上传文件**（选择文件只是本地提示，需在回复确认邮件时作为附件发送）；
- RFQ 列表保存在浏览器本地存储（不是 cookie），提交前不会离开设备；
- 不保存明文 IP，反滥用只使用短期不可逆的键控哈希。

---

## 11. SEO 实现

| 组件 | 文件 | 说明 |
| --- | --- | --- |
| 站点 URL 唯一来源 | `config/site-env.mjs` + `src/lib/site-url.ts` | canonical / sitemap / 结构化数据共用同一 URL |
| 收录开关 | `SITE_INDEXING_ENABLED`（默认 `false`） | 同时驱动 meta robots、X-Robots-Tag、robots.txt、sitemap |
| robots.txt | `src/app/robots.ts` | 预览全站 Disallow；正式放行公开内容并指向 sitemap |
| sitemap.xml | `src/app/sitemap.ts` | 产品清单来自 `getPublishedProducts()`，**不硬编码 ID** |
| canonical | `canonicalFor()` | 未配置正式域名时**不输出** canonical（而不是输出 localhost） |
| metadata | 各页面 `metadata` / `generateMetadata` | title / description / canonical / OG / Twitter card |
| 结构化数据 | `src/lib/structured-data.ts` | Organization / WebSite / BreadcrumbList / Product |
| 分享与图标 | `public/og-image.png`、`icon.png`、`apple-icon.png`、`app/manifest.ts` | 见第 3 节 |

**构建期硬校验**：`SITE_INDEXING_ENABLED=true` 但 `NEXT_PUBLIC_SITE_URL` 缺失/非 https/localhost
→ `next.config.ts` 抛错，构建失败。默认（未开启收录）只打印两条警告。

---

## 12. sitemap 实际页面数量

在**正式索引配置**（`SITE_INDEXING_ENABLED=true` + `NEXT_PUBLIC_SITE_URL=https://www.bowen-tech.cn`）
下实测 `/sitemap.xml`：

| 类别 | 数量 | 路径 |
| --- | --- | --- |
| 静态公开页面 | **8** | `/`、`/products`、`/about`、`/factory`、`/quality`、`/contact`、`/privacy`、`/terms` |
| 产品详情页 | **394** | `/products/<product_id>` |
| **合计 `<loc>`** | **402** | 全部唯一（无重复 canonical 目标） |

明确**不在** sitemap 中：无图产品、draft、blocked、需要人工复核、unresolved 记录、
`/rfq`、`/oe-search`（含查询结果）、`/api`、隐藏的 Blog、无图片证书页面、
任何 localhost 或中文旧站 URL。

预览配置下 sitemap 返回**空 urlset**（宁可空，也不把 localhost 写进公开 sitemap）。

---

## 13. sitemap 实际产品数量

- sitemap 中产品页：**394**
- 站内公开产品（按 Phase 4.1 准入规则独立复算：状态允许 + 未 blocked + `product-images.json` 有可靠主图）：**394**
- 断言结果：**数量完全一致，且没有多出任何非公开产品**（`verify-seo-readiness` C 段）。
- 每个 sitemap 产品 URL 都对应一条可靠主图记录 → 无图产品不在 sitemap。
- 生产构建同时确认：`.next` 中预渲染的产品页正好 **394** 个（逐 ID 与公开集合比对，无多余、无缺失）。

产品总表（内部数据集）426 条 → 公开集合 394 条，差额 32 条全部是**没有可靠主图**的记录，按业务决定不公开。

---

## 14. canonical 规则

1. 单一来源：`NEXT_PUBLIC_SITE_URL` → `config/site-env.mjs` → `src/lib/site-url.ts`。
2. **未配置正式域名**（预览/本地）：`canonicalFor()` 返回 `undefined` → 页面**不输出 canonical**。
   理由：为本地地址生成 canonical 等于对外声明"正式地址是 127.0.0.1"。
3. 已配置正式域名：每个公开页面输出自己的 `https://www.bowen-tech.cn/<path>`。
   - 首页：Next 将 `canonical: '/'` 归一化为 `https://www.bowen-tech.cn`（无尾斜杠），
     **sitemap 首页 URL 已按同一写法输出**，两者完全一致。
   - 产品页：`/products/<product_id>`，**每个产品唯一**（已抽查 4 个产品逐一比对）。
4. 功能页（`/rfq`、`/oe-search`、`/blog`）始终 noindex，`/oe-search` 刻意不给 canonical。
5. 产品列表页带筛选参数时不单独生成 canonical，统一指向 `/products`，避免重复内容。
6. 实测：预览配置下 11 个页面 canonical 全部为空且无 localhost；
   索引配置下 6 个页面 canonical 全部等于正式域名对应路径。

---

## 15. robots 规则

**预览配置（默认交付配置）**
```
User-Agent: *
Disallow: /
```
（不输出 `Sitemap:` 行；配合页面 meta robots 与 `X-Robots-Tag` 三重保护）

**正式索引配置**
```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /rfq
Disallow: /oe-search
Disallow: /blog
Disallow: /_next/
Sitemap: https://www.bowen-tech.cn/sitemap.xml
```

---

## 16. noindex 开关

| 配置 | meta robots | X-Robots-Tag | robots.txt | sitemap |
| --- | --- | --- | --- | --- |
| `SITE_INDEXING_ENABLED` 未设置 / `false`（**默认**） | 全站 `noindex, nofollow` | 全站 `noindex, nofollow` | 全站 Disallow | 空 |
| `=true` + https 正式域名 | 公开页 `index, follow`；`/rfq`、`/oe-search`、`/blog` 仍 `noindex, nofollow` | 只对 `/api/*`、`/rfq`、`/oe-search`、`/blog` 下发 noindex | 见第 15 节 | 402 条 URL |
| `=true` 但域名缺失 / 非 https / localhost | — | — | — | **构建直接失败** |

补充：
- 页面级 meta 与响应头是两套独立机制，二者同时生效（避免只靠其中一个）。
- 已**移除** `X-Prototype-Phase` 响应头。
- 代码合并**不会**自动打开收录；该变量只在部署平台环境变量面板里显式修改，且必须重新构建。

---

## 17. 结构化数据字段

内联在 `<script type="application/ld+json">`，全部经 `safeJsonLd()` 把 `<` `>` `&` `U+2028/9`
转成 `\uXXXX`（实测原始文本中 0 个裸 `<`）。

| 类型 | 出现位置 | 字段 |
| --- | --- | --- |
| **Organization** | 全站（根 layout） | `@id`、`name`、`alternateName`、`url`、`email`、`telephone`、`foundingDate`、`address`（PostalAddress）、`contactPoint`（sales / en） |
| **WebSite** | 全站（根 layout） | `@id`、`name`、`url`、`inLanguage`、`publisher`、`potentialAction`（站内 OE 搜索 SearchAction） |
| **BreadcrumbList** | 产品详情页 | `itemListElement[]`（Home / Products / 类型 / Bowen No.） |
| **Product** | 产品详情页 | `name`、`description`、`url`、`category`、`manufacturer`、`sku`（= Bowen No.）、`image`（有可靠主图时）、`alternateName` |

**明确不包含**（实测断言 0 命中）：`offers`、`price` / `priceCurrency`、`aggregateRating`、
`review`、库存可售状态、`gtin`、品牌授权、任何适配结论。
`description` 统一带"下单前需与 Bowen 确认适配"的口径。
`Product` 的 `image` 只在有可靠主图时输出；没有主图的产品页本身已经 404。

---

## 18. 安全响应头

由 `config/site-env.mjs` 统一生成（与页面 metadata 共用同一份判定），实测下发：

| 响应头 | 值 |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'[ 'unsafe-eval'(仅开发)]; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'[ ws: wss:(仅开发)]; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'[+Cloudflare(仅配置 Turnstile 时)]; manifest-src 'self'; worker-src 'self' blob:` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()` |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Origin-Agent-Cluster` | `?1` |
| `X-Robots-Tag` | 见第 16 节（按收录开关） |
| `Strict-Transport-Security` | `max-age=31536000` —— **仅**在「开启收录 + https 正式域名」时出现，且**不带** `includeSubDomains` / `preload` |
| `Cache-Control`（`/api/*`） | `no-store, max-age=0` |
| `X-Powered-By` | 已关闭（`poweredByHeader: false`） |

**CSP 与 Next.js 的兼容性**（刻意为之，不是"看起来安全"）：
`script-src` / `style-src` 都带 `'unsafe-inline'` —— App Router 会内联 hydration 脚本与样式，
去掉会直接白屏；开发模式额外允许 `'unsafe-eval'`（React Refresh），生产模式**不含** `unsafe-eval`；
`img-src` 允许 `data:`（内联图标）；**未配置 Turnstile 时不放行任何第三方脚本源**；
`upgrade-insecure-requests` 只在已确认 HTTPS 且已允许收录时添加（否则本地 http 预览会被强制跳 https）。

**实测验证**：生产构建 + `next start` 下，14 个路由在真实浏览器中
hydration 正常、表单可交互、图片与 CSS 正常、**控制台 0 条 error / 0 条 hydration 报错**。

---

## 19. 环境变量清单

完整说明见 `website/.env.example` 与 `docs/deployment-and-domain-guide.md`。
本阶段**未写入任何真实值**（`.env.example` 全部为空值或说明性示例，已用脚本断言）。

```
# 站点与收录
NEXT_PUBLIC_SITE_URL=
SITE_INDEXING_ENABLED=false

# RFQ 邮件
RFQ_RECIPIENT_EMAIL=
RFQ_FROM_EMAIL=
RESEND_API_KEY=
RFQ_MAIL_DRIVER=

# RFQ 存储
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RFQ_STORE_DRIVER=
RFQ_JSON_STORE_PATH=

# 反垃圾与限流
RFQ_IP_HASH_SECRET=
RFQ_RATE_LIMIT_MAX=5
RFQ_RATE_LIMIT_WINDOW_SECONDS=600
RFQ_MIN_FILL_MS=3000
RFQ_DUPLICATE_WINDOW_SECONDS=900
RFQ_TRUST_PROXY=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

# 仅测试
RFQ_MOCK_OUTBOX_PATH=
RFQ_MOCK_MAIL_FAIL=
```

---

## 20. 测试命令与真实结果

全部命令在 `website/` 下执行（第一条除外）。结果为本机真实输出。

### 20.1 接手基线（Phase 5 改动之前）

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-product-db-v2.mjs` | PASS 75 / FAIL 0 |
| `node tools/verify-prototype-data.mjs` | 全通过 |
| `node tools/verify-public-surface.mjs` | 全通过 |
| `node tools/verify-engine-code.mjs` | 全通过 |
| `node tools/verify-category-copy.mjs` | **PASS 11 / FAIL 1（接手时既有失败）** |
| `node tools/verify-english-product-surface.mjs` | 全通过 |

### 20.2 现有测试（Phase 5 之后，全部通过）

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-product-db-v2.mjs` | **PASS 75 / FAIL 0** |
| `node tools/verify-prototype-data.mjs` | **PASS 49 / FAIL 0** |
| `node tools/verify-public-surface.mjs` | **PASS 24 / FAIL 0** |
| `node tools/verify-engine-code.mjs` | **PASS 28 / FAIL 0** |
| `node tools/verify-category-copy.mjs` | **PASS 13 / FAIL 0**（修掉接手时的误报，并新增 1 条断言） |
| `node tools/verify-english-product-surface.mjs` | **通过（exit 0）** |

### 20.3 新增测试

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-security-headers.mjs` | **PASS 28 / FAIL 0**（12.7s） |
| `node tools/verify-rfq-production.mjs` | **PASS 51 / FAIL 0**（13.5s，3 个独立服务器场景） |
| `node tools/verify-seo-readiness.mjs` | **PASS 55 / FAIL 0**（23.3s，2 个配置的服务器） |
| `node tools/verify-rfq-e2e.mjs` | **PASS 22 / FAIL 0**（21.3s，真实 Chrome） |
| `node tools/verify-live-browser.mjs`（对 `next start` 服务器） | **PASS 125 / FAIL 0**（57.4s，真实 Chrome，14 个路由） |

RFQ 生产化验收覆盖的关键用例（全部实测通过）：
正常提交 / 空姓名 / 空公司 / 空国家 / 无效邮箱 / 非法 URL / 无隐私同意 / 隐私版本过期 /
honeypot 命中 / 最短耗时不足 / 重复提交 409 / 限流 429 + Retry-After / 超长字段截断 /
请求体 > 64KB → 413 / 无效 product_id / 跨产品 application_id / Bowen No. 不符 /
**无图产品 BW-2043 被拒** / **draft 产品 BW-3932 被拒** / 客户端伪造的 OE/车型/类型不被采信 /
内部字段（`source_sheets` 等）被白名单拒绝 / HTML 与脚本注入被剥离且邮件 HTML 全量转义 /
`&` `"` `'` 转义为实体 / 邮件失败但记录保留（`pending_retry` + 诚实提示）/ 存储失败返回 503 且不发邮件 /
GET → 405 + `Allow: POST` / 跨站 Origin → 403 / 非法 JSON → 400 / 响应字段白名单 / 响应无中文 / 无密钥泄露。

### 20.4 类型与构建

| 命令 | 结果 |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | **exit 0，0 错误** |
| `node node_modules/next/dist/bin/next build` | **exit 0**，`✓ Compiled successfully`，`✓ Generating static pages (411/411)`，约 19–20s |
| 预渲染产品页数 | **394**（与公开集合逐 ID 比对一致；探测 404 URL 产生的 3 个按需缓存产物已清理） |

构建期只输出两条**预期警告**（未配置正式域名 → canonical 不输出、sitemap 为空、保持 noindex），
不阻断构建；开启收录但缺域名时才抛错。

### 20.5 移动端溢出

| 命令 | 结果 |
| --- | --- |
| `node tools/find-overflow.mjs http://127.0.0.1:3100/ 390` | 横向溢出 **0px** |
| `node tools/find-overflow.mjs http://127.0.0.1:3100/products/BW-3005 390` | 横向溢出 **0px** |
| `node tools/find-overflow.mjs http://127.0.0.1:3100/privacy 390` | 横向溢出 **0px** |
| `verify-live-browser.mjs` 内建检查 | 14 个路由 × 390px 与 1440px 全部 **无溢出** |

### 20.6 环境行为说明

- 本机 PATH 上**没有 `git` 可执行文件**；工作区状态用仓库自带的零依赖脚本
  `tools/_dsh-git-status.mjs` 解析 `.git` 得到（用法与限制见该文件头部）。
  接手/结束两份原始快照保存在 `tmp/phase5-git-status-before.json` 与
  `tmp/phase5-git-status-after.json`。
- 本机没有 `npm`，`pnpm` 位于 harness 目录。因此所有命令均直接调用
  `node node_modules/next/dist/bin/next` 与 `node node_modules/typescript/bin/tsc`，
  **没有删除 `node_modules`、没有重装依赖**。
- 无头 Chrome 需要更宽的运行时权限才能启动（它的多进程 IPC 依赖命名管道）；
  在受限沙箱下 Chrome 会立即退出。本轮在放开权限后正常完成，全部浏览器结论均为真实运行结果。
- 全部测试过程性产物（`tmp/phase5-*.txt`、临时 JSONL 落库与 mock outbox）都留在 `tmp/` 下，
  该目录已在 `.gitignore` 中，可随时删除。

### 20.7 密钥检查（每次交付前都跑）

对 `src/`、`config/`、`tools/`、`public/`、`.env.example`、`next.config.ts`、`package.json`
共 **109 个文件**逐行扫描：

- `re_…` / `eyJ….….…` / `sb_…` 形态的密钥：**0 命中**
- 非空的密钥类赋值（`RESEND_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`TURNSTILE_SECRET_KEY`、
  `RFQ_IP_HASH_SECRET`、`SUPABASE_URL`、`RFQ_FROM_EMAIL` 等）：**0 命中**
  （`.env.example` 中这些变量全部为空值，只有 `false` 与限流默认数字有值）

---

## 21. 浏览器实测结果

用**生产构建 + `next start`（端口 3100）**，通过 Chrome DevTools Protocol 实测。

| 路由 | 结果 | 备注 |
| --- | --- | --- |
| `/` | 200 | 标题、无溢出、无控制台错误、noindex |
| `/products` | 200 | 筛选器正常 |
| `/products/BW-3005` | 200 | Thermostat；产品区域纯英文；canonical 无本地地址 |
| `/products/BW-1001` | 200 | 非 Thermostat（TemperatureSensor） |
| `/oe-search?q=25500-35540` | 200 | 搜索结果页，仍 noindex |
| `/rfq?product=BW-3005` | 200 | 表单可交互、已带入 1 行、同意框未勾选、honeypot 存在且不可见、提交按钮可用 |
| `/factory`、`/quality`、`/about`、`/contact` | 200 | 无溢出、无错误 |
| `/privacy` | 200 | 含公司主体 / 收集范围 / 权利 / 联系方式 |
| `/terms` | 200 | 含适配确认 / 无自动报价 / 责任限制 / 管辖待确认标注 |
| `/products/BW-DOES-NOT-EXIST-0000` | **404** | 不存在产品返回 404 |
| `/products/BW-2043`（被排除的无图产品） | **404** | 无图产品不可访问 |
| `/robots.txt` | 200 | 预览环境全站 Disallow |
| `/sitemap.xml` | 200 | 预览环境为空 urlset，无 localhost |
| `/api/rfq`（GET） | 405 | `Allow: POST` |
| `/manifest.webmanifest`、`/icon.png`、`/apple-icon.png`、`/og-image.png` | 200 | 全部可访问 |

逐路由断言（共 125 条，全部通过）：
HTTP 状态、控制台 0 error / 0 未捕获异常 / **0 hydration 报错**、
390px 与 1440px 均无横向溢出、页面文本不含 15 类内部标记
（工作表名 / `source_row` / `product_type_evidence` / `How this classification was made` /
`review_required` / `unresolved` 等）、产品信息区域 0 个中文字符、默认 noindex、
canonical 不含本地地址；另外单独确认 Quality 页只出现 IATF、**不出现 ISO 14001 / ISO 45001**
（公开证书规则没有回退）。

RFQ 表单实测（真实浏览器，`verify-rfq-e2e.mjs`）：
空表单提交被拦下且**页面上不存在内部 JSON 区块**；
隐私同意默认**未勾选**、未勾选时提交被拦下、可手动勾选；
带 `product` 参数自动带入 1 行、点 Remove 后回到 0 行（可加可删）；
提交后进入成功页并显示 `BW-RFQ-20260926-4FDA0B` 形式的询价号；
成功页**不再显示任何内部 JSON**；落库文件里能看到 `Bowen 3005 / 4711306950 / 500 pcs`；
mock outbox 中存在对应邮件（主题 `New RFQ — E2E Auto Parts Import GmbH — BW-RFQ-…`）；
**没有真实外发任何邮件**。

---

## 22. 尚未配置的外部凭据

以下凭据**当前都不存在**，因此相关能力只完成了代码与 mock 验证：

| 凭据 | 当前状态 | 影响 | 已有替代实现 |
| --- | --- | --- | --- |
| 正式域名（`www.bowen-tech.cn`） | 未接入 | canonical / sitemap / 分享图仍是预览形态 | 本地 http 预览正常，已实测 |
| `RESEND_API_KEY` | **未配置** | 无法真实发信 | mock 驱动（写 outbox），邮件内容与失败路径已实测 |
| `RFQ_FROM_EMAIL` | **未配置（未编造）** | 生产缺它时邮件驱动 = `unconfigured`，会明确失败而不是假装成功 | 同上 |
| `SUPABASE_URL` | **未配置** | 询价写在服务器本地 JSONL | json 回退驱动，落库/失败路径已实测 |
| `SUPABASE_SERVICE_ROLE_KEY` | **未配置** | 同上 | 同上 |
| `RFQ_IP_HASH_SECRET` | **未配置** | 限流键使用进程内随机密钥（重启即失效、多实例不共享） | 功能可用，已实测 |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **未配置** | 验证码关闭；其余反垃圾手段全部生效 | 未配置即跳过，**不伪造通过**，已实测 |
| 126 邮箱授权码 | **未使用** | 本方案走事务邮件服务，不需要 126 授权码 | — |

**明确说明**：本阶段**没有**创建任何第三方账户、**没有**申请任何 API Key、
**没有**连接真实 Supabase、**没有**发送任何真实邮件（唯一"发送"都是 mock outbox）、
**没有**部署、**没有**绑定域名、**没有**修改 DNS、**没有**开启搜索引擎收录。

---

## 23. 仍需业务方完成的事项

**必须有业务方操作（涉及第三方账户 / 凭据 / 域名）**
1. 提供正式域名接入决策：主域采用 `www.bowen-tech.cn` 还是 `bowen-tech.cn`（建议前者），并完成 DNS 绑定与证书。
2. 注册/提供事务邮件服务（如 Resend）账户与 API Key，并**验证发件域**（例如 `bowen-tech.cn`），
   据此填写 `RFQ_FROM_EMAIL`。**在此之前生产环境邮件不会真实送达**。
3. 创建 Supabase 项目（或用既有项目），执行 `supabase/migrations/001_create_rfq_inquiries.sql`，
   提供 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`（只填在部署平台，不要写进仓库）。
4. 确认部署平台是否覆写 `x-forwarded-for`，据此决定 `RFQ_TRUST_PROXY`；并为 `RFQ_IP_HASH_SECRET` 生成随机值。
5. 决定是否启用 Cloudflare Turnstile；若启用，提供两个密钥。
6. 正式上线时把 `SITE_INDEXING_ENABLED` 改为 `true` 并**重新构建部署**（本阶段不做）。

**需要业务方 / 法律顾问确认（不得猜测）**
7. `Terms of Use` 的**管辖法律与管辖法院**（页面已明确标注"待法律顾问确认"）。
8. 隐私政策中的数据**具体保存期限**（当前使用保守措辞），以及是否需要指定数据保护联系人。
9. 是否需要公开 ISO 14001 / ISO 45001 证书图片（目前**没有证书图片，继续保持内部资料**；
   不得为了 SEO 重新公开）。若提供图片，再走一次公开准入。
10. 站点 Logo：目前 `favicon` 使用站点现有 "BW" 字标（纯色底，可替换）；
    `og-image` 复用公司现有 Logo 原图。若希望使用方形/反白版正式 Logo，请提供源文件替换 `public/icon.png`、`apple-icon.png`。
11. 反垃圾强度参数（限流阈值、最短填写耗时）是否需要按实际询盘量调整。

**仍未做的业务内容（按业务方决定，不在本阶段范围）**
12. 产能、标准交期、MOQ —— 业务方明确暂不做，页面上也没有任何此类数字或承诺。
13. 无图产品与无图证书 —— 继续不公开。
14. 多语言站点（中文站 / 西语站）与正式 Blog 内容 —— 本阶段未做。

---

## 24. 正式上线前最后检查清单

**配置**
- [ ] `NEXT_PUBLIC_SITE_URL=https://www.bowen-tech.cn`（无尾斜杠）
- [ ] `SITE_INDEXING_ENABLED=true`（最后一次构建时才打开）
- [ ] `RFQ_RECIPIENT_EMAIL` / `RFQ_FROM_EMAIL` / `RESEND_API_KEY` 已配置且发件域已验证
- [ ] `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 已配置，migration 已执行，RLS 已启用且无策略
- [ ] `RFQ_IP_HASH_SECRET` 已生成；`RFQ_TRUST_PROXY` 与代理实际行为一致
- [ ] 所有密钥只在部署平台环境变量里，**不在仓库、文档、日志、截图中**

**代码与测试**
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 通过（且构建日志无"未配置站点地址"警告）
- [ ] 第 20 节列出的全部 11 条命令通过
- [ ] `BASE_URL=<正式地址> node tools/verify-live-browser.mjs` 通过

**内容与合规**
- [ ] 正式域名首页无 `X-Robots-Tag`；`/rfq`、`/oe-search` 仍为 noindex
- [ ] `/robots.txt` 指向正式 sitemap；`/sitemap.xml` 402 条且无 localhost
- [ ] 394 个公开产品页可访问；无图产品 404
- [ ] `/privacy`、`/terms` 可访问且页脚有链接；管辖条款仍标注待法律确认
- [ ] Quality 页只展示 IATF 16949，未出现无图证书
- [ ] 客户页面无中文工作表名 / 内部字段（自动实测已覆盖）

**功能**
- [ ] 真实提交一次 RFQ：客户看到询价号；`qfbowen@126.com` 收到通知邮件；Supabase 有记录且状态 `sent`
- [ ] 故意让邮件失败一次：客户仍拿到询价号 + 兜底提示；数据库记录状态为 `pending_retry`
- [ ] 分享图链接在社交平台预览正常（`https://www.bowen-tech.cn/og-image.png`）
- [ ] 移动端真机（iOS Safari / Android Chrome）手动点一遍 RFQ 表单

**发布纪律**
- [ ] 未修改国内旧站、未把旧站代码引入本项目
- [ ] 原始资料（`data/raw`、宣传手册、Excel、旧站审计产物）未被修改
- [ ] Git 提交内容经业务方审阅后由业务方执行（本阶段未提交）

---

## 25. 是否具备进入 Phase 6 的条件

**结论：具备进入 Phase 6 的工程条件。**

理由（全部可验证）：

1. **RFQ 已是生产结构**：服务端严格白名单校验 + 公开产品交叉核对 + 存储 adapter + 邮件 adapter +
   反垃圾 + 失败不丢单不假装成功。51 条 RFQ 生产化断言、22 条真实浏览器 RFQ 断言全部通过。
2. **SEO 基础设施就位**：唯一 URL 来源、收录开关、robots、sitemap（402 = 8 + 394）、canonical、
   metadata、结构化数据；55 条 SEO 断言全部通过，且默认仍是 noindex。
3. **合规页面就位**：Privacy 与 Terms 已上线（预览），管辖等未确认事项明确标注为待确认，没有编造。
4. **安全配置就位**：CSP 与 Next.js 兼容（真实浏览器 0 报错）、其余安全响应头齐备、
   HSTS 只在正式 HTTPS + 允许收录时启用且不带 `includeSubDomains`/`preload`。
5. **回归无缺陷**：接手时存在的 1 个既有失败（`verify-category-copy` 误报）已修掉并加固；
   其余全部现有测试仍然通过；工作区既有修改与原始资料零破坏；未提交任何 Git 变更。

**进入 Phase 6 之前，业务方至少需要提供或确认**：

- **正式域名接入**（`www.bowen-tech.cn`，DNS 绑定 + 证书 + 301 方案），本阶段已完成全部代码准备，
  域名与收录是**唯一**被刻意留下的开关（`NEXT_PUBLIC_SITE_URL` + `SITE_INDEXING_ENABLED`）。
- **真实邮件凭据**：Resend API Key + 已验证发件域（对应 `RFQ_FROM_EMAIL`）。
  在此之前的 RFQ 邮件只在 mock 通道验证过，销售**收不到**真实询价通知。
- **真实数据库凭据**：Supabase URL + service role key，并执行已提供的 migration。
- **法律确认**：Terms 的管辖法律/法院条款、隐私政策的具体保存期限。
- **可选**：Turnstile 两把密钥（上线后视垃圾量决定是否启用）。

**Phase 6 建议方向**（需业务方明确后再启动，本阶段未做任何相关改动）：
无图产品图片补齐后重新走公开准入、产能/交期/MOQ 等业务数据接入、
产品数据迁移到数据库的评估（当前边界见 `docs/supabase-migration-boundary.md`）、
Blog 正式内容、多语言站点、Search Console 数据回看与页面优化。
