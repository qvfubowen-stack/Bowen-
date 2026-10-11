# 已知问题清单（Known Issues）

**项目版本：Bowen-Website-Prototype-V1**
**最后更新：2026-09-26（Phase 2.7 业务方决定落实后）**

> **本轮已修复的问题不再列在下面**（清单见
> [`03_test-results.md`](03_test-results.md) 第八节）。
> 本文只保留**仍然存在的**问题与待确认事项。
>
> **Phase 2.7 结案的三项**：B1（70 个产品类型）已由业务方审阅并落实；
> B5（31 张待定图片）已由 D1–D9 逐条作答并落实；
> B3/B11 的部分素材已从公司宣传手册提取（见
> [`../docs/company-info-from-brochure.md`](../docs/company-info-from-brochure.md)）。

---

## 〇、上线阻塞项清单（一句话版）

下面这些**没做完就不能正式上线**。按优先级排列：

| # | 阻塞项 | 谁来做 | 说明 |
|---|---|---|---|
| ~~B1~~ | ~~70 个产品类型待确认~~ **已结案**（40 个 = Thermostat，30 个舍弃） | 业务方 | 已落实进产品库 |
| B2 | 字段错位判定口径待确认 | **业务方** | 当前是"编号可读就不阻断"；如需从严改一行重跑 |
| ~~B3~~ | ~~真实邮箱地址~~ **已取得** `qfbowen@126.com`（等授权落页面） | 业务方 | 源码本阶段冻结 |
| B4 | 产品图片接入网站 | 开发 | 图片已提取映射完毕，主图规则与可用性已由 D7–D9 确定，等授权 |
| ~~B5~~ | ~~31 张图片待处理~~ **已结案**（D1–D9 全部作答并落实） | 业务方 | 剩余 22 张只缺 Bowen No. |
| **B12（新）** | **22 张图片缺「博文编号」** | **业务方** | 14 张编号读不出 + 7 张该行未填 + 1 张已裁剪的 IMG-0780；补齐即自动归位 |
| B6 | 接入 PostgreSQL / Supabase | 开发 | 需按 `docs/supabase-migration-boundary.md` 重写 3 处查询 + 7 项配套 |
| B7 | RFQ 真正发信 + 落库 | 开发 | 现在只展示 payload，不发送 |
| B8 | 站点 SEO（sitemap / robots / 结构化数据） | 开发 | 当前全站 `noindex`，是刻意的 |
| B9 | 部署与域名 | **业务方决策** | 本阶段禁令 |
| B10 | 跨浏览器测试 + 无障碍审计 + 性能基线 | 开发 | 上线前建议补 |
| B11 | 公司注册信息（**街道地址手册未载**）、证书编号（**已提取**）、产能/交期（**业务方已声明不做**） | **业务方** | 仅街道地址仍缺 |

---

## 一、需要业务方决策的（阻塞上线，但不阻塞原型验收）

### 1.1 【已结案】产品类型未确认的 70 个产品

> **Phase 2.7 已结案。** 业务方审阅 `review/product-type-unconfirmed.xlsx` 后确认：
> **未标黄部分 40 个类型均为 `Thermostat`**，**标黄部分 30 个整体舍弃**（不再出现在产品库）。
> 落实结果：40 个已标为 `Thermostat`（`product_type_source = human_review_confirmed`，证据含审核表行号），
> 30 个（及其 application）已按业务方要求整体移出产品库。
> 数据库里**类型未确认的产品现在只剩 5 个**（即 1.5 节里 D3 补入库、但没有人工类型标签的编号）。

| 项目 | 内容 |
|---|---|
| 业务方决定 | 未标黄 40 个 = `Thermostat`；标黄 30 个 = 舍弃 |
| 程序处理 | 40 个写入 `product_type = Thermostat` + 行号级证据；30 个按 Map key 删除，并做原文交叉校验（不一致即退出码 6） |
| 决定文件 | `data/raw/business-decisions-v3.json` → `product_type_review` |
| 影响 | 分类浏览里现在包含这 40 个节温器；被舍弃的 30 个不再出现 |
| 需要你做什么 | **无** |

### 1.2 【需确认】字段错位的判定口径

| 项目 | 内容 |
|---|---|
| 背景 | 需求原文是「尺寸/温度/压力值错位进入 Bowen No. 等字段 → `blocked = true`」 |
| 实测发现 | 35 个异常单元格里有 **33 个仍以合法 Bowen No. 开头**（如 `3029  92°`、`3033-z  138*95*251`），只有 2 个真的读不出编号 |
| 当前口径 | 拆成两级：**编号可读 → `needs_review`（不阻断，错位原文原样保留）**；**编号不可读 → `blocked`（隔离）** |
| 为什么这样定 | 如果一律 blocked，会连带阻断 3005、3064 等**业务方已人工确认过**的产品 |
| 如果你要从严 | 改 `tools/build-product-db-v2.mjs` 里 `blocked` 判定的一行，重跑即可（约 30 秒） |
| 需要你做什么 | 确认当前口径是否可接受 |

### 1.3 【需核对】125 个 OE 对应多个 Bowen

| 项目 | 内容 |
|---|---|
| 现象 | 同一个标准化 OE 出现在多个不同 Bowen No. 上 |
| 已生成 | `review/shared-oe-across-products.xlsx`（125 个 OE / 323 行） |
| 程序处理 | **全部保留，不删除、不合并、不自动判定谁正确** |
| 影响 | OE 搜索会把这几个产品都列出来，不会只显示一个 |
| 是否需要现在处理 | **不需要**。不阻塞原型开发，仅供以后人工核对 |

### 1.5 【已结案】产品图片的 31 张待处理

> **Phase 2.7 已结案。** 业务方对 D1–D9 逐条作答，程序已全部落实。
> 结论见 [`../docs/product-image-review-needed.md`](../docs/product-image-review-needed.md)，
> 依据是 `data/raw/business-decisions-v3.json` → `image_review`。

| 项目 | 内容 |
|---|---|
| 背景 | 此前「Excel 图片列为空」的判断**有误**。工作簿内实际有 **681 个图片文件 / 798 个图片对象** |
| 已映射（更新后） | `exact` **772** 张 → **403** 个产品；其中 20 个 Prototype 产品 100% 有图 |
| D3 已归位 | `38169 / 38298 / 3932 / 32603 / 32748-1` 已补入产品库，对应 5 张图从 `review_required` 升级为 `exact` |
| D4/D5 已删除 | `IMG-0723`（含内部进价的系统截图）、`IMG-0787`、`IMG-0797`、`IMG-0798` 共 4 张，**未导出、无副本** |
| D6 已裁剪 | `IMG-0780` 按 D6 裁剪掉手机界面（1080×2392 → 1080×814），原图保留可回溯 |
| D7 已更正 | **「GXN」是博文自有商标，不是外部品牌水印**；水印原样保留，不做任何去水印处理 |
| D8 已确认 | 随手拍照片保留，不要求重拍 |
| D9 已实现 | 主图规则已按确定性优先级实现，为 **403** 个有图产品各选出 1 张主图 |
| **仍未解决** | **22 张缺「博文编号」**（14 张编号读不出 + 7 张该行未填 + 1 张已裁剪的 `IMG-0780`）。补齐编号后程序自动归位 |
| 产物 | `data/processed/product-images/`（**795** 个文件 = 794 导出 + 1 裁剪派生）、`data/processed/product-image-map.json` |
| 验收 | `node tools/verify-product-images.mjs` → **56 项全部 PASS** |
| 完整报告 | [`../docs/product-image-review-needed.md`](../docs/product-image-review-needed.md)、[`../docs/excel-image-audit.md`](../docs/excel-image-audit.md) |

### 1.6 【已解决】占位邮箱

Phase 2.7 从公司宣传手册提取到真实联系方式：**`qfbowen@126.com`**、TEL **18653750690**、
网址 **bowen18653750690.1688.com**（见 [`../docs/company-info-from-brochure.md`](../docs/company-info-from-brochure.md)）。

网站源码目前仍使用占位邮箱 `sales@bowen-thermostat.com` / `quality@bowen-thermostat.com`，
因为**本阶段网站源码处于冻结状态**，未经业务方授权不修改页面。
替换工作已具备全部素材，授权后即可执行（1 处常量 + Contact 页文案）。

---

## 二、Placeholder（页面上已显式标注，不会误导访客）

| # | 位置 | 内容 | 页面如何标注 |
|---|---|---|---|
| 2.1 | 产品图片 | **已更正**：图片其实存在（681 个文件 / 798 个对象）。已完成提取、映射与业务方决定落实（4 张删除、1 张裁剪、403 个产品选出主图），但**按业务方要求暂未接入网站** | 页面仍显示工程图占位符 + "Photo pending" 角标；详见 [`../docs/product-image-review-needed.md`](../docs/product-image-review-needed.md) |
| 2.2 | RFQ 邮件 | 不真正发送邮件 | 提交后展示将传输的完整 JSON payload，并写明 "This is a prototype — nothing was emailed" |
| 2.3 | 公司信息 | 注册地址（街道门牌）、WhatsApp、微信、营业时间、地图 | Contact 页 "Company details — pending" 清单。**部分已可补**：全称 / 邮箱 / 电话 / 网址已从宣传手册提取（[`../docs/company-info-from-brochure.md`](../docs/company-info-from-brochure.md)），但**手册未载街道地址**，且网站源码本阶段冻结，未改动 |
| 2.4 | 产能与交期 | ~~年产能、标准交期~~ → **业务方明确「先不做了」**；MOQ、包装装柜规范手册未载 | Factory 页占位标注保留，但**不再作为待补项推进**，也不编造数字 |
| 2.5 | 认证范围 | ~~只有体系名称，没有证书编号与认证范围~~ → **已从宣传手册提取到证书编号与范围** | Quality 页文案本阶段未改（源码冻结）；素材见 [`../docs/company-info-from-brochure.md`](../docs/company-info-from-brochure.md)：IATF 16949:2016（NQA 0513244 / T184734，范围=节温器制造，Clause 8.3 设计除外）、ISO 14001:2015（05325E31120R0S）、ISO 45001:2018（05325S31042R0S） |
| 2.6 | 检测设备 | 无设备型号、量程、校准周期清单 | Quality 页 "Placeholder — pending confirmation from the quality department" |
| 2.7 | 公司沿革 | ~~历史里程碑、员工人数、出口市场、客户见证~~ → 手册可提供：成立 2009、建厂 2014、占地 10,000+ m²、车间 3,500 m²、恒温车间 2,000+ m²、设备 100+ 台 | About 页文案本阶段未改（源码冻结）；素材见宣传手册提取文档 |
| 2.8 | Blog | 只有 6 个计划选题，**没有文章正文** | Blog 页 "Framework only — no articles published yet" |
| 2.9 | 产品数据完整性 | 部分产品的车型/发动机原文为空（原表就没写） | 表格里显示 "Not recorded in source"，不编造 |

---

## 三、技术限制（原型阶段的已知边界）

### 3.1 数据存储为静态 JSON

| 项目 | 内容 |
|---|---|
| 现状 | 全站数据来自 `website/src/data/*.json`，共约 **3.0 MB**（products 564KB + applications 1.0MB + oe-index 1.3MB） |
| 影响 | 构建期全量载入内存；产品量再翻几倍时构建时间和内存会明显上升 |
| 为什么这样做 | 本阶段明确禁止接入 Supabase；原型用静态数据最稳、最可复现 |
| 何时需要处理 | 产品量超过约 2,000 个，或需要实时库存/价格时 |
| 迁移成本 | **页面层低，查询层不低**。页面层已全部 `await`（因为 API 已经是 async），但 `listProducts()` / `getMakeSummaries()` / `searchByOe()` 三处仍是内存算法，接入时必须用 SQL 重写。详见 3.2 |

### 3.2 未接入真实数据库（边界已明确，但工作量不小）

本阶段禁止接入 Supabase / PostgreSQL。已完成的解耦：

- `src/lib/repository.ts` 定义 `ProductRepository` 接口，**所有方法都是 async**
- `src/lib/repositories/json-repository.ts` 是**唯一** import `@/data/*.json` 的地方
- 页面层只调用 `src/lib/db.ts` 的 async API，已确认**没有任何页面直接 import JSON**
- 因此换实现时页面层不用改

**但以下 8 项必须同时处理**（早期文档说"只改一个函数"是不准确的，已更正）：

| # | 事项 | 不改的后果 |
|---|---|---|
| 1 | 新增 `SupabaseProductRepository` + 行→领域类型映射 | 无法接入 |
| 2 | `listProducts()` 改为 SQL `WHERE` + `LIMIT/OFFSET` + `COUNT` | 每次翻页把全表拉到应用层 |
| 3 | `getMakeSummaries()` 改为聚合视图 / 物化视图 | 首页每次请求扫描全表 |
| 4 | `searchByOe()` 改为索引精确匹配 + 前缀匹配 | OE 搜索随库增长线性变慢 |
| 5 | `getSiteFacts()` 换数据源（settings 表或环境配置） | 公司对外声明没有受控的存放位置 |
| 6 | 明确缓存与失效策略（`fetch` 缓存 / `unstable_cache` / `revalidate`） | 后台改价后前台不知何时生效 |
| 7 | 明确构建期渲染策略（ISR / 按需渲染） | 构建时间随产品量线性增长 |
| 8 | 新增 RFQ 写路径、文件上传、通知、回执、鉴权、限流、RLS | RFQ 收不到、被刷、越权读到 blocked 数据 |

完整清单见 [`../docs/supabase-migration-boundary.md`](../docs/supabase-migration-boundary.md)。

### 3.3 页面预渲染

| 项目 | 内容 |
|---|---|
| 现状 | **全部 378 个可展示产品页在构建时静态生成**（SSG），加上 9 个静态页与 3 个动态页，共 390 个路由 |
| 说明 | 这一点在开发过程中先只有 20 个产品预渲染，扩展到全部可展示产品后已改为全量预渲染 |
| 后续 | 产品数据改为数据库后，建议改为 ISR 或按需渲染，避免构建时间随产品量线性增长 |

### 3.4 单浏览器内核验证

只在 **Chromium 内核（Chrome）** 上验证过。Safari / Firefox 未实测。
用到的 CSS 特性（Grid、Flexbox、`clamp()`、`aspect-ratio`、CSS Modules）
都是广泛支持的，但**未做跨浏览器回归**。

### 3.5 端到端测试：已补 RFQ，其余仍缺

**本轮已补**：`website/tools/verify-rfq-e2e.mjs` 用真实 Chrome（CDP）
跑「填表 → 提交 → 读回 payload」全流程，31 项断言。这一套正是靠它发现
"RFQ 页 hydration 失败、表单无法交互"的真实缺陷。

**仍然缺**（未引入 Playwright / Puppeteer，避免为原型增加重量依赖）：

- 其他页面的交互回归：Products 筛选器、分页、OE 搜索框的键盘操作
- 多浏览器 E2E
- 视觉回归（截图对比）

当前验证手段汇总：数据库 65 项 + 图片映射 39 项 + 网站数据 36 项 +
分类守卫 12 项 + RFQ E2E 31 项 + 响应式探针 5 页 + 生产服务器逐页 HTTP 断言。

### 3.6 未做性能基线

没有 Lighthouse 评分、没有 Core Web Vitals 基线。原型阶段未做性能优化
（唯一的性能工作是静态预渲染与零第三方 UI 库）。

### 3.7 无障碍只做了基础项

已做：skip link、语义化标签（`header`/`nav`/`main`/`footer`/`table`/`caption`）、
`role="search"`、`:focus-visible` 焦点样式、`aria-label`、`aria-expanded`、
表单 label 关联、`aria-invalid` + `aria-describedby`、`prefers-reduced-motion`。
**未做**：完整 WCAG 2.1 AA 审计、屏幕阅读器实测、色彩对比度全量校验。

### 3.8 npm 兼容层（范围刻意受限）

原开发机只装了 Node.js，没有全局 npm / pnpm。项目自带 `website/npm.cmd` +
`website/tools/npm-run.mjs` 作为 `npm run` 的最小兼容层。
**唯一推荐的包管理器仍是 pnpm**（版本锁定见 `package.json` 的 `packageManager`）。
在装有标准 pnpm 的机器上直接用 pnpm 即可，兼容层不会被触发。

已知限制：

| 限制 | 说明 |
|---|---|
| 只支持 `npm run <script>` 与 `npm start` | **不支持 `npm install`**，装依赖请用 `pnpm install` |
| 不能做 `where npm` 检查 | cmd.exe 会把 `npm` 解析回 `npm.cmd` 自身，导致 `Maximum setlocal recursion level reached` |
| `npm.cmd` 必须纯 ASCII | cmd.exe 用 OEM 代码页解析 .cmd，写非 ASCII 字符会导致命令解析失败 |
| 需要把 Node 目录放进 PATH | 通过包装脚本调用时 cmd.exe 继承的 PATH 可能没有 `node`，兼容层已自动补上 |

### 3.9 产品图片二进制不入 Git

提取出的 798 张图片（66.5 MB）**没有纳入 Git**，因为它们可由冻结的原始 Excel
用一条命令完整重新生成。映射文件 `product-image-map.json` 已入库。

- 网站构建**不依赖**这些图片，所以全新 clone 可以直接 install / build / start
- 只有 `tools/verify-product-images.mjs` 需要图片存在；缺失时它会打印可执行指引
  并以 exit code 2 退出（不会给出难懂的失败项）
- 解决：`node tools/extract-product-images.mjs`（约 30 秒）
- 交付 ZIP 里**包含**这些图片

---

## 四、已知的小瑕疵（不影响使用）

| # | 位置 | 现象 | 严重度 | 说明 |
|---|---|---|---|---|
| 4.1 | 工作表1 来源的 application | 车型/发动机列为空（原表该表没有车型列） | 低 | OE 搜索结果的 Vehicle 会显示 "Not recorded in this source row"，产品详情页可看到其他行 |
| 4.2 | 部分产品 | `opening_temperatures_c` 为空（原表技术参数列为空） | 低 | 表格显示 "—"，不编造温度 |
| 4.3 | 车型筛选 | 基于原文中的品牌关键词匹配，不是结构化的 make 字段 | 低 | 可能少匹配（原文写法罕见时）或重复匹配（一行提多个品牌） |
| 4.4 | 发动机代号列 | 由纯字符串规则从原文提取，可能多提或少提 | 低 | 表格里明确写着「the authoritative value is always the original text」，并把原文完整保留在前一列 |
| 4.5 | 产品排序 | 编号排序对非数字编号（如 `3004-3`）按数字段+字典序处理 | 极低 | 排序结果稳定但不完全等于人工直觉顺序 |
| 4.6 | `review/first-batch-business-review.xlsx` | 业务方手填的 3 个产品类型已提取入库，但该 Excel 文件本身仍在工作区未提交 | 低 | 建议确认后一并提交，或保持现状（提取结果已固化在 `data/raw/review-overrides-v2.json`） |

---

## 五、明确没有做、且本阶段禁止做的事

以下项目**不是遗漏，是按需求刻意不做**：

| 项目 | 状态 |
|---|---|
| 购买域名 / 绑定正式域名 | ❌ 本阶段禁止 |
| 正式发布上线 | ❌ 本阶段禁止 |
| 接入正式 Supabase | ❌ 本阶段禁止 |
| 支付系统 | ❌ 本阶段禁止 |
| 购物车 | ❌ 本阶段禁止 |
| 用户注册 / 登录 | ❌ 本阶段禁止 |
| 批量生成 SEO 页面 | ❌ 本阶段禁止 |
| 几百篇 AI Blog | ❌ 本阶段禁止 |
| 自动报价 | ❌ 本阶段禁止 |
| 自动修改 Excel | ❌ 本阶段禁止 |
| 删除 OE | ❌ 本阶段禁止 |
| 选择 Main OE | ❌ 本阶段禁止 |
| 猜 product_type | ❌ 本阶段禁止（实测 = 0） |

---

## 六、优先级建议（与第〇节阻塞清单对应）

| 优先级 | 事项 | 谁来做 | 阻塞什么 |
|---|---|---|---|
| ~~P0~~ | ~~确认 70 个产品类型（B1）~~ **已结案**：40 个确认为 Thermostat、30 个舍弃 | 业务方 | 阻塞解除 |
| P0 | 确认错位判定口径（B2） | 业务方 | 阻塞 18 条 needs_review 记录的最终归属 |
| ~~P0~~ | ~~提供真实邮箱地址（B3）~~ **已从宣传手册取得**（`qfbowen@126.com`），等授权后替换页面占位 | 业务方授权 | 阻塞解除（仅剩落页面） |
| ~~P0~~ | ~~处理 31 张待定图片（B5）~~ **已结案**：D1–D9 全部作答并落实 | 业务方 | 阻塞解除 |
| **P0（新）** | **补 22 张图片的「博文编号」**（14 张编号读不出 + 7 张该行未填 + 1 张已裁剪的 IMG-0780） | 业务方 | 不阻塞原型；补齐后这 22 张自动归位 |
| P1 | ~~提供证书编号与认证范围（B11）~~ **已从宣传手册提取**（IATF 16949 / ISO 14001 / ISO 45001 编号与范围齐全） | 业务方授权后落页面 | 阻塞解除（仅剩落页面） |
| ~~P1~~ | ~~提供产能 / 交期 / MOQ / 包装规范（B11）~~ **业务方明确「先不做了」**；手册亦未载 | 业务方 | 不再作为待补项 |
| P1 | ~~提供公司注册信息与联系方式（B11）~~ **部分已提取**（全称/邮箱/电话/网址/沿革/面积/设备数）；**街道地址手册未载，仍需业务方提供** | 业务方 | 部分阻塞 Contact 页完整 |
| P1 | 接入 PostgreSQL / Supabase（B6）：3 处查询重写 + 7 项配套 | 开发 | 上线前必须 |
| P1 | RFQ 真正发信 + 落库 + 限流（B7） | 开发 | 上线前必须 |
| P1 | 站点 SEO：sitemap / robots / 结构化数据（B8） | 开发 | 上线前必须 |
| P1 | 部署方案与域名（B9） | 业务方决策 | 上线前必须 |
| P2 | 产品图片接入网站（B4） | 开发 | 依赖业务方授权（图片已就绪） |
| P2 | 把宣传手册里的公司信息落到 Contact / About / Quality / Factory 页面 | 开发 | 依赖业务方授权（源码本阶段冻结） |
| P2 | 核对 125 个共享 OE | 业务方 | 不阻塞，长期数据质量 |
| P2 | Blog 内容 + 技术审稿人 | 业务方 | 不阻塞 |
| P3 | 跨浏览器测试、无障碍审计、性能基线（B10） | 开发 | 上线前建议 |
