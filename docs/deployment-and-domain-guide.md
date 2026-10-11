# 部署与域名接入指南（Phase 5）

> 本文只写**怎么做**，不代表已经做过。
> Phase 5 结束时：**未部署、未绑定域名、未修改 DNS、未开启搜索引擎收录**。
> 下列步骤中凡涉及"创建第三方账户 / 申请 API Key / 绑定域名 / 修改 DNS / 开启收录"
> 的部分，都必须由业务方自己执行或明确确认后再做。

- 站点目录：`website/`
- 当前状态：noindex 预览环境（`SITE_INDEXING_ENABLED=false`，未配置 `NEXT_PUBLIC_SITE_URL`）
- 计划正式域名：`www.bowen-tech.cn`（业务方已确认；本阶段**未**接入）

---

## 1. 运行时版本

| 项目 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 20 LTS**（当前验证使用 v24.9.0） | `website/package.json` 的 `engines` 要求 ≥ 18.18.0；实际建议 20 或 22 LTS |
| pnpm | **10.34.5** | 由 `packageManager` 字段锁定；`pnpm-lock.yaml` 为 lockfileVersion 9.0 |
| Next.js | 15.5.26 | App Router |
| React | 19.0.0 | — |

> 为什么必须用 pnpm：仓库只保留 `pnpm-lock.yaml` 一份锁文件（见 `.npmrc` 注释）。
> 用 npm/yarn 安装会生成第二份锁文件，导致依赖解析不一致。

## 2. 安装

```bash
cd website
pnpm install --frozen-lockfile
```

首次在新机器上安装时，pnpm 10 会提示忽略 `sharp` 的构建脚本 —— 这是**预期行为**：
本站全部使用原生 `<img>`，没有任何 `next/image` 用法，不需要 sharp。
该决定显式写在 `website/package.json` 的 `pnpm.ignoredBuiltDependencies` 里。

## 3. 环境变量

复制 `website/.env.example` 为 `website/.env.local`（本地）或在部署平台的环境变量面板逐条配置。

### 3.1 站点地址与收录

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 空 | 正式站点地址，例如 `https://www.bowen-tech.cn`。留空时 canonical 不输出、sitemap 为空，且全站保持 noindex |
| `SITE_INDEXING_ENABLED` | `false` | 收录总开关。只有 `true` 且地址是 https 正式域名时才允许收录 |

**构建期硬校验**：`SITE_INDEXING_ENABLED=true` 但没有正式 https 域名（或域名是 localhost）时，
`next.config.ts` 会直接抛错让构建失败 —— 避免"没域名却放开了收录"。

### 3.2 RFQ 邮件

| 变量 | 说明 |
| --- | --- |
| `RFQ_RECIPIENT_EMAIL` | 销售收件邮箱，留空 = `qfbowen@126.com`（业务方已确认） |
| `RFQ_FROM_EMAIL` | 发件人地址，必须是邮件服务商**已验证**的发件域，例如 `Bowen RFQ <rfq@bowen-tech.cn>`。没有正式域名时留空 |
| `RESEND_API_KEY` | Resend API Key（服务端专用，**绝不加** `NEXT_PUBLIC_` 前缀） |
| `RFQ_MAIL_DRIVER` | 留空 = 自动；可选 `mock` / `resend` / `unconfigured` |

邮件驱动判定顺序：
1. 显式设置 `RFQ_MAIL_DRIVER` → 按它执行；
2. 否则有 `RESEND_API_KEY` + `RFQ_FROM_EMAIL` → `resend`；
3. 否则生产环境 → `unconfigured`（发送必然失败，但**询价记录仍然保存**，状态写 `email_not_configured`）；
4. 否则非生产环境 → `mock`（写本地 outbox，不对外发送）。

### 3.3 RFQ 存储

| 变量 | 说明 |
| --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端专用；此密钥可绕过 RLS |
| `RFQ_STORE_DRIVER` | 留空 = 自动；可选 `memory` / `json` / `supabase` |
| `RFQ_JSON_STORE_PATH` | `json` 驱动的落库文件，留空 = `<项目目录>/.rfq-data/rfq-inquiries.jsonl` |

> **产品数据不迁移**：产品 / application / OE 索引继续使用 `website/src/data/*.json`。
> Supabase 只用于保存 RFQ 询价记录。

### 3.4 反垃圾与限流

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `RFQ_IP_HASH_SECRET` | 空 | 限流键的 HMAC 密钥。生成：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`。留空时使用进程内随机密钥 |
| `RFQ_RATE_LIMIT_MAX` | 5 | 单连接在时间窗内允许的询价次数 |
| `RFQ_RATE_LIMIT_WINDOW_SECONDS` | 600 | 时间窗 |
| `RFQ_MIN_FILL_MS` | 3000 | 最短填写耗时（毫秒） |
| `RFQ_DUPLICATE_WINDOW_SECONDS` | 900 | 相同内容去重窗口 |
| `RFQ_TRUST_PROXY` | `false` | **部署在会覆写 `x-forwarded-for` 的代理后面时必须设为 `true`**，否则所有访客共用一个限流桶 |
| `TURNSTILE_SECRET_KEY` | 空 | 配置后必须携带有效 token，否则拒绝提交 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 空 | 会进入浏览器；同时决定 CSP 是否放行 Cloudflare 域名 |

### 3.5 仅测试用（**不要**在生产环境设置）

| 变量 | 说明 |
| --- | --- |
| `RFQ_MAIL_DRIVER=mock` | 邮件只写 outbox 文件，不外发 |
| `RFQ_MOCK_OUTBOX_PATH` | mock outbox 路径 |
| `RFQ_MOCK_MAIL_FAIL=true` | 让 mock 邮件故意失败，用于验证"邮件失败但询价已保存" |
| `RFQ_STORE_DRIVER=memory` | 内存存储，进程重启即丢 |

## 4. 构建与启动

```bash
cd website

# 类型检查
pnpm typecheck

# 生产构建
pnpm build

# 启动（默认 3000 端口；只监听本机）
pnpm start

# 需要被反向代理访问时（绑定 0.0.0.0）
pnpm start:host
```

`next start` 必须能读到与 `next build` **相同**的 `NEXT_PUBLIC_SITE_URL` 与
`SITE_INDEXING_ENABLED`，否则 canonical / robots 会与构建结果不一致。

## 5. Preview（预览）环境配置

预览环境的作用是给业务方和同事看，**绝不能被收录**。

```env
NEXT_PUBLIC_SITE_URL=https://preview.example-provider.app   # 预览地址，用于分享图等绝对 URL
SITE_INDEXING_ENABLED=false                                  # 必须 false
RFQ_STORE_DRIVER=json                                        # 或用独立的 Supabase 项目
RFQ_MAIL_DRIVER=mock                                         # 预览环境不要发真实邮件给销售
RFQ_TRUST_PROXY=true                                         # 预览平台一般会覆写 XFF
```

验收检查（应全部成立）：
- `/robots.txt` 全站 `Disallow: /`
- `/sitemap.xml` 为空
- 任意页面响应头带 `X-Robots-Tag: noindex, nofollow`，页面 `<meta name="robots">` 也是 noindex

> 即使 `NEXT_PUBLIC_SITE_URL` 已配置成预览地址，只要 `SITE_INDEXING_ENABLED=false`，
> 就仍然不会收录（域名存在 ≠ 允许收录）。

## 6. Production（正式）环境配置

### 6.1 生产环境硬保护（Phase 5.1）

**判断依据是平台标志，不是 `NODE_ENV`。**

| 平台标志 | 含义 | 行为 |
| --- | --- | --- |
| `VERCEL_ENV=production` | 真正的托管生产环境（Vercel 自动注入，**不要手工设置**） | 下方 11 项缺任何一项 → **构建与启动直接失败** |
| `VERCEL_ENV=preview` / `development` / 未设置 | Preview、本地、其它平台 | 仍可用 json + mock，仍默认 noindex，不因缺凭据阻断构建 |

为什么不用 `NODE_ENV=production`：本地 `next build` 与 Vercel Preview 也都是
`NODE_ENV=production` 的构建；用它判断会直接把本地和预览卡死。

生产环境必须同时满足的 11 项（由 `website/config/site-env.mjs` 的
`validateProductionReadiness()` 校验，`next.config.ts` 在构建与启动时执行）：

1. `NEXT_PUBLIC_SITE_URL` 是正式 https 地址（不能是 localhost）
2. `SUPABASE_URL` 存在
3. `SUPABASE_SERVICE_ROLE_KEY` 存在
4. `RFQ_STORE_DRIVER` 解析结果为 `supabase`
5. `RESEND_API_KEY` 存在
6. `RFQ_FROM_EMAIL` 存在
7. `RFQ_MAIL_DRIVER` 解析结果为 `resend`
8. `RFQ_IP_HASH_SECRET` 存在
9. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 存在
10. `TURNSTILE_SECRET_KEY` 存在
11. 两个 Turnstile key **成对**存在

另有两条测试开关在生产环境一律视为错误（构建失败）：
`RFQ_TURNSTILE_MODE=mock`、`NEXT_PUBLIC_TURNSTILE_MOCK=1`。

失败时的行为：
- 只输出**变量名**，绝不输出变量值、密钥或堆栈；
- 不允许静默回退成 `json` / `memory` / `mock` / `unconfigured`；
- `next build` 与 `next start` 都会失败（配置在两者都会被加载）。

### 6.2 正式环境变量

```env
# 站点
NEXT_PUBLIC_SITE_URL=https://www.bowen-tech.cn
SITE_INDEXING_ENABLED=true

# 邮件（生产必填）
RFQ_RECIPIENT_EMAIL=qfbowen@126.com
RFQ_FROM_EMAIL=Bowen RFQ <rfq@bowen-tech.cn>     # 必须是已验证发件域
RESEND_API_KEY=<在部署平台的环境变量面板里填，不要写进仓库>

# 数据库（生产必填）
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<同上，只在服务端>

# 反滥用
RFQ_IP_HASH_SECRET=<32 字节随机十六进制>
RFQ_TRUST_PROXY=true

# Turnstile（生产必填，且必须成对）
TURNSTILE_SECRET_KEY=<Cloudflare Turnstile secret>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<与上面成对的 site key>
```

> 本地与 Preview 不要配置真实生产密钥；`RFQ_TURNSTILE_MODE` /
> `NEXT_PUBLIC_TURNSTILE_MOCK` 只在自动化测试里使用。

### 6.3 Vercel 项目设置

1. **Root Directory 设为 `website`**（Next.js 应用和 `next.config.ts` 都在这里）。
2. Framework Preset = Next.js；Build Command = `pnpm build`；Install Command = `pnpm install --frozen-lockfile`。
3. Node 版本 ≥ 20。
4. 按 6.2 配置全部环境变量（Supabase / Resend / Turnstile 密钥只填在平台面板）。
5. **先部署 Preview**，确认页面、RFQ、robots/sitemap 都正常，再考虑 Production。
6. Production 域名的绑定与 DNS 由业务方操作（见第 8 节），本阶段未执行。

## 7. `SITE_INDEXING_ENABLED` 切换方法

这是**唯一**允许打开收录的开关，按下面的顺序操作：

1. 确认正式域名已解析、HTTPS 证书有效、站点能正常打开。
2. 确认 `NEXT_PUBLIC_SITE_URL` 已设为 `https://www.bowen-tech.cn`。
3. 在部署平台把 `SITE_INDEXING_ENABLED` 改为 `true`。
4. **重新构建并重新部署**（该变量在构建期被读取，热改环境变量不会生效）。
5. 部署后逐条验证：
   - `https://www.bowen-tech.cn/robots.txt` → `Allow: /`，且 `Sitemap:` 指向正式域名
   - `https://www.bowen-tech.cn/sitemap.xml` → 有 URL，且不含 localhost
   - 首页响应头**不再**有 `X-Robots-Tag`
   - `/rfq`、`/oe-search` 仍然是 noindex
6. 回滚时把它改回 `false` 并重新部署即可（见第 15 节）。

> 注意：代码合并**不会**自动打开收录。默认值永远是 `false`。

## 8. 域名与 DNS 绑定步骤

> 以下操作由业务方在域名注册商 / DNS 服务商控制台完成，本阶段未执行。

1. 确定主域形态：`www.bowen-tech.cn` 与 `bowen-tech.cn` 二选一作为**唯一**主域。
   - 建议主域 = `www.bowen-tech.cn`（与本项目已确认的域名一致），
     裸域 `bowen-tech.cn` 做 301 跳转到 `www`。
2. 在部署平台添加自定义域名：先加 `www.bowen-tech.cn`，再加 `bowen-tech.cn`。
3. 平台会给出目标记录，通常是：
   - `www` → `CNAME` 指向平台提供的域名
   - 裸域 → `A` 记录指向平台 IP，或使用平台提供的 `ALIAS`/`ANAME`
4. 在 DNS 控制台按平台要求添加记录，**删除**与之冲突的旧记录
   （例如旧的 A 记录、泛解析 `*`）。
5. 等待解析生效（通常几分钟，最长 24 小时）：
   ```bash
   nslookup www.bowen-tech.cn
   ```
6. 在平台为两个域名都申请 HTTPS 证书（多数平台自动签发并自动续期）。
7. 确认 `http://` 和裸域都能跳到 `https://www.bowen-tech.cn`。

## 9. www 与非 www 主域选择

- 只能有一个主域对外提供内容，另一个必须 301。
- 本项目 `NEXT_PUBLIC_SITE_URL` 一旦确定就**不要**再改：canonical、sitemap、结构化数据
  全部由它生成，改动会让搜索引擎看到两套地址。
- 建议：主域 `https://www.bowen-tech.cn`，`bowen-tech.cn` → 301 → `www.bowen-tech.cn`。

## 10. 301 跳转方案

按部署环境任选一种：

**A. 部署平台自带的重定向（推荐）**
在平台域名设置里把 `bowen-tech.cn` 配置为 "Redirect to `www.bowen-tech.cn`"（301）。

**B. 反向代理（nginx）**

```nginx
server {
  listen 443 ssl;
  server_name bowen-tech.cn;
  ssl_certificate     /etc/ssl/bowen-tech.cn.pem;
  ssl_certificate_key /etc/ssl/bowen-tech.cn.key;
  return 301 https://www.bowen-tech.cn$request_uri;
}

server {
  listen 80;
  server_name bowen-tech.cn www.bowen-tech.cn;
  return 301 https://www.bowen-tech.cn$request_uri;
}

server {
  listen 443 ssl;
  server_name www.bowen-tech.cn;
  ssl_certificate     /etc/ssl/www.bowen-tech.cn.pem;
  ssl_certificate_key /etc/ssl/www.bowen-tech.cn.key;

  # 代理时必须覆写这两个头，否则限流会失效（见下方说明）
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header Host $host;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

**限流与代理的关系（重要）**
`/api/rfq` 默认**不信任**客户端传来的 IP 头（否则任何人伪造 `x-forwarded-for` 就能绕过限流）。
只有在确认前置代理会覆写该头之后，才设置 `RFQ_TRUST_PROXY=true`。
不要在没有代理的裸 Node 服务上打开它。

## 11. HTTPS 检查

1. 证书链完整（`curl -vI https://www.bowen-tech.cn` 无证书警告）。
2. TLS 版本 ≥ 1.2。
3. 自动续期已开启（Let's Encrypt 类证书 90 天到期）。
4. HSTS：只有 `SITE_INDEXING_ENABLED=true` + https 正式域名时才会下发
   `Strict-Transport-Security: max-age=31536000`。
   本地 http 与预览环境**不会**下发（避免把本地开发锁死在 HTTPS 上）。
   项目刻意**不使用** `includeSubDomains` / `preload` —— 业务方尚未确认所有子域都支持 HTTPS，
   确认之后再考虑加上。
5. 混合内容检查：全站资源必须走 https（本站不使用任何外部 CDN，正常情况下不会出现）。

## 12. 上线前检查清单

```bash
cd website

pnpm typecheck
pnpm build

pnpm verify:data
pnpm verify:surface
pnpm verify:english
pnpm verify:engine
pnpm verify:category
pnpm verify:seo
pnpm verify:headers
pnpm verify:rfq:production
pnpm verify:rfq
pnpm verify:launch-hardening      # 低成本上线：确认已移除 Cron 重试且失败语义正确
pnpm verify:production-guards     # Phase 5.1：生产就绪硬保护（含两次真实构建）

# 对已经跑起来的生产服务器做真实浏览器实测
BASE_URL=http://127.0.0.1:3000 node tools/verify-live-browser.mjs

# 移动端横向溢出
node tools/find-overflow.mjs https://www.bowen-tech.cn/ 390
```

另外人工确认：
- [ ] `<title>` / `<meta name="description">` 正确，canonical 是正式域名
- [ ] 394 个公开产品页可访问；无图产品 404
- [ ] `/privacy` 与 `/terms` 可访问，页脚有链接
- [ ] `SITE_INDEXING_ENABLED=true` 时 `/rfq`、`/oe-search` 仍为 noindex
- [ ] 分享图 `https://www.bowen-tech.cn/og-image.png` 能打开
- [ ] RFQ 提交后销售邮箱收到通知（见第 16 节）
- [ ] 成功页只显示"已收到询价 + 询价号"，**没有**声称邮件已发送
- [ ] RFQ 表单里**没有**文件选择框；表单提示改为粘贴 OE 号或直接发邮件
- [ ] 客户可见页面里没有"一个工作日内回复"等未确认时效承诺
- [ ] `/terms` 里**没有**未完成的管辖法律章节
- [ ] 配置了 Turnstile 时表单能显示验证码并成功提交；未配置时不显示验证码也能提交
- [ ] 故意让首次发信失败时，询盘仍然落库且状态为 `email_failed`

## 13. 环境变量缺失时的行为（排错用）

> 前 6 行只在 **VERCEL_ENV=production** 下升级为"构建/启动直接失败"；
> Preview 与本地只会打印警告，不会阻断。

| 缺失项 | 现象 | 处理 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 构建日志出现警告；页面不输出 canonical；sitemap 为空；全站 noindex | 配置正式域名后重新构建 |
| `SITE_INDEXING_ENABLED=true` 但地址非 https | **构建直接失败** | 二者必须同时满足 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`（仅生产） | 生产构建失败，错误里只出现变量名 | 配置 Supabase 后再部署 |
| `RESEND_API_KEY` / `RFQ_FROM_EMAIL`（仅生产） | 生产构建失败 | 配置并验证发件域 |
| `RFQ_STORE_DRIVER=json` 或 `memory`（仅生产） | 生产构建失败（不允许非持久化存储） | 保持留空，让它自动解析为 supabase |
| `RFQ_MAIL_DRIVER=mock`（仅生产） | 生产构建失败 | 保持留空，让它自动解析为 resend |
| `RFQ_IP_HASH_SECRET`（仅生产） | 生产构建失败 | 生成 32 字节随机值 |
| Turnstile 两个 key 只配了一个（仅生产） | 生产构建失败（提示必须成对） | 两个都配，或两个都不配 |
| `RFQ_TURNSTILE_MODE=mock` / `NEXT_PUBLIC_TURNSTILE_MOCK=1`（仅生产） | 生产构建失败 | 移除这两个测试开关 |
| `RESEND_API_KEY` / `RFQ_FROM_EMAIL` | 邮件驱动 = `unconfigured`；询价仍保存，状态 `email_not_configured`，客户看到"如未回复请直接发邮件"的提示 | 补齐两个变量 |
| `SUPABASE_*` | 驱动退回 `json`，询价写在服务器本地文件 | 配置 Supabase 后会在下一次启动切换到 supabase |
| `RFQ_IP_HASH_SECRET` | 使用进程内随机密钥：重启后限流桶清空，多实例之间不共享 | 生产必须配置 |
| `RFQ_TRUST_PROXY=true` 但前面没有代理 | 客户端可伪造 IP 头绕过限流 | 只在有代理时打开 |

## 14. 上线前检查（数据库）

1. 在 Supabase SQL Editor 执行 `supabase/migrations/001_create_rfq_inquiries.sql`。
2. 确认表上 RLS 已启用、**没有任何策略**：
   ```sql
   select relname, relrowsecurity from pg_class where relname = 'rfq_inquiries';
   select * from pg_policies where tablename = 'rfq_inquiries';  -- 应当返回 0 行
   ```
3. 用 anon key 试读一次，应当被拒绝（返回空 / 权限错误）。
4. 用网站表单提交一次，确认记录写入、`email_delivery_status` 为 `sent`。

## 15. 回滚方法

| 场景 | 回滚动作 |
| --- | --- |
| 新版本上线后页面异常 | 在部署平台回滚到上一个成功部署（或 `git revert` 后重新部署） |
| 担心被搜索引擎收录 | 把 `SITE_INDEXING_ENABLED` 改回 `false` → 重新构建部署；此时全站恢复 noindex + `X-Robots-Tag` |
| RSS 出现重复内容 | 确认 `NEXT_PUBLIC_SITE_URL` 只有一个写法（不要 www / 非 www 混用），修正 301 |
| 邮件发送异常 | 把 `RFQ_MAIL_DRIVER` 设为 `unconfigured` 或修复 Key；询价记录不会丢，可稍后按 `email_delivery_status` 补发 |
| 数据库写入异常 | API 会返回 `SERVICE_UNAVAILABLE`，客户看到"稍后重试或直接发邮件"；不会产生半真半假的成功记录 |

## 16. RFQ 邮件实测方法

**先不要用真实客户数据测试。**

1. 在预览/本地把驱动设为 mock，跑一次自动测试：
   ```bash
   cd website
   pnpm verify:rfq:production     # 校验校验/落库/邮件内容/失败路径，全部使用 mock
   pnpm verify:rfq                # 真实浏览器跑一遍表单
   ```
2. 配置真实凭据后，在**预览**环境把 `RFQ_MAIL_DRIVER=resend`、`RFQ_FROM_EMAIL` 指到已验证发件域，
   提交一条自测询价（姓名写 "Internal test"），确认：
   - `qfbowen@126.com` 收到主题 `New RFQ — Internal test — BW-RFQ-...` 的邮件
   - 邮件里 `Reply-To` 是自测时填的邮箱（销售可以直接回复客户）
   - 纯文本与 HTML 两个版本都正常显示
3. 故意填错 `RESEND_API_KEY` 再提交一次，确认：
   - 客户页面仍显示询价号（询价已保存）
   - 同时出现兜底提示："Your enquiry has been recorded. If you have not received a reply,
     please email qfbowen@126.com directly and include your inquiry number."
   - 数据库里该记录 `email_delivery_status = email_failed`
4. 恢复正确配置并重新部署。失败记录不会自动补发，应由业务人员在数据库中发现后人工跟进。

## 16.1 邮件失败处理（低成本方案）

- 网站只在 RFQ 提交时尝试发送一次通知邮件，不运行任何 Cron 或后台重试任务。
- 首次发送失败不会丢单：数据库记录保留，状态为 `email_failed`。
- 客户会看到询价号以及直接联系 `qfbowen@126.com` 的提示。
- 业务人员应定期查看 `email_failed` / `email_not_configured` 记录并人工跟进。
- 生产环境不需要配置 `CRON_SECRET` 或任何 `RFQ_EMAIL_RETRY_*` 变量。

## 17. Sitemap 检查

```bash
curl -s https://www.bowen-tech.cn/sitemap.xml | grep -c "<loc>"        # 应为 402（8 个页面 + 394 个公开产品）
curl -s https://www.bowen-tech.cn/sitemap.xml | grep -c "localhost"    # 应为 0
curl -s https://www.bowen-tech.cn/sitemap.xml | grep -E "/(rfq|oe-search|api|blog)"  # 应为空
curl -s https://www.bowen-tech.cn/robots.txt
```

sitemap 只包含：首页、`/products`、`/about`、`/factory`、`/quality`、`/contact`、
`/privacy`、`/terms`，以及 394 个公开产品页。
不包含：无图产品、draft/blocked 记录、RFQ、OE 搜索结果、API、隐藏 Blog、无图证书页面。

## 18. Search Console 后续接入步骤

> 本阶段**未**接入，以下为业务方后续操作说明。

1. 用业务方账号登录 [Google Search Console](https://search.google.com/search-console)（需自行注册）。
2. 添加"网域"资源：`bowen-tech.cn`，按提示在 DNS 加一条 TXT 验证记录。
   （或添加"网址前缀"资源 `https://www.bowen-tech.cn`，用 HTML 文件/标签验证。）
3. 验证通过后进入 **Sitemaps**，提交 `https://www.bowen-tech.cn/sitemap.xml`。
4. 用 **URL 检查** 工具抽查首页与 2~3 个产品页，确认"已编入索引"且 canonical 正确。
5. 观察 **页面 / 覆盖率** 报告：
   - 应被排除：`/rfq`、`/oe-search`（页面自身声明 noindex，属正常）
   - 不应出现"已发现但未编入索引"的大量产品页 —— 若出现，检查内链与 sitemap
6. Bing 可在 [Bing Webmaster Tools](https://www.bing.com/webmasters) 用同样方式添加（可导入 GSC 数据）。
7. 首次收录通常需要数天到数周；不要因为短期没有排名而反复改动域名或 canonical。

---

### 附：本阶段验证过的命令与结果

见 `docs/phase-5-prelaunch-engineering.md` 第 20 节。
