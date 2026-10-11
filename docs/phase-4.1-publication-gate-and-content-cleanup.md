# Phase 4.1 — 公开产品准入与英文站内容收尾

> 阶段目标：把「哪些产品/认证可以对外公开」变成**代码里的规则**（而不是页面里的隐藏），
> 并清掉客户页面上的内部原型与数据处理文案；证据不足的一律不写。
>
> 本阶段**未**部署、未取消 noindex、未接 Supabase、未发送真实邮件、未配置正式域名、
> 未开始中文/西班牙语站、未做机器翻译、未处理需要业务人工确认的产品图片与产品类型。

- 执行日期：2026-09-26
- 仓库 HEAD：`2e89243010769d1c7e1117d060a6131598cee00a`（branch `main`）
- 依据：`docs/phase-4-independent-review-and-next-plan.md` 的 Phase 4.1 方案 + 业务方 2026 的四项最新决定
- 本机没有 git 可执行文件，工作区状态用项目自带的 `tools/_dsh-git-status.mjs`（直接读 `.git`）核对

---

## 0. 工作区保护（先做的事）

| 项目 | 结果 |
| --- | --- |
| 接手时工作区快照 | **modified 49 / deleted 24 / untracked 476 / staged 0 / conflicts 0**，tracked 1219 个文件 |
| 本阶段结束时快照 | **modified 61 / deleted 24 / untracked 484 / staged 0 / conflicts 0** |
| `deleted` 数量 | **24 → 24，一个都没增加**：接手时就存在的 24 个 `data/processed/product-image-review/` 删除原样保留 |
| 未执行的动作 | 全程**没有** `git reset --hard`、`git checkout --`、`git clean`；没有删除任何非本任务文件 |
| 原始 Excel | `data/raw/产品信息表1(1).xlsx` SHA-256 运行前后一致（构建脚本自带校验：`原始 Excel SHA-256 运行后一致：true`），未改动一个字节 |
| `review_required` / `unresolved` / 无图产品内部资料 | 全部保留，未删除（有测试守护，见 §10.1） |

新增的 12 个 modified + 8 个 untracked 全部是本阶段的改动，逐项列在 §11。

> 数据重建范围已事先确认：只重建 `data/derived/v2/*`（内部数据库，含新增的 `publication-gate.json`）、
> `website/src/data/*.json`（网站数据集）、`website/public/assets/{products,company,factory,certificates}`（图片）。
> `data/raw/*`、`data/processed/product-image-map.json`、`data/processed/product-images/*`、`data/legacy-site/*`
> 一律**只读**。重建是确定性的（同一份原始 Excel + 同一份配置 → 同一份结果）。

---

## 1. 最终公开产品数量

**394 个**（动态计算，代码里没有任何硬编码数字）。

| 口径 | 数量 |
| --- | ---: |
| 内部产品库（`data/derived/v2/products.json`） | 426 |
| 其中状态可发布（`prototype_candidate` / `searchable_noindex`） | 421 |
| 其中 draft（不可发布） | 5 |
| 其中 blocked | 0 |
| **进入网站的产品** | **394** |
| 排除：无可靠主图（有 application） | 22 |
| 排除：有图但没有可展示 application | 4 |
| 排除：既无图也无 application | 1 |
| 排除：draft | 5 |

按分类（与首页、`/products`、分类卡、筛选、OE 搜索、RFQ 完全一致）：

| 分类 | 数量 |
| --- | ---: |
| Thermostats | 276 |
| Temperature Sensors | 41 |
| Automotive Switches | 74 |
| Related Cooling Parts | 3 |
| **合计** | **394** |

与业务方给出的预计值（394）完全一致，与审阅报告的预计值也一致，但**全部由代码重新算出**。

---

## 2. 排除的无图产品清单

**22 个**，与业务方 2026 给出的清单**逐项一致**（测试断言两侧相等）：

```
BW-2043      BW-3003-3    BW-3004-5    BW-3021-1    BW-3192      BW-3508
BW-3565-2    BW-3566      BW-3567      BW-3655-2    BW-3665      BW-3902
BW-3919      BW-3964      BW-31002     BW-32748-2   BW-33111     BW-33561
BW-33655     BW-35116     BW-36583     BW-403229
```

这 22 个产品：

- 仍在 `data/derived/v2/products.json` 里完整保留（22/22 全部在库）；
- 仍有各自的 application 记录（22/22）；
- 有任何一条 application 或 OE 索引行进入网站数据集的数量：**0**；
- 直接访问 `/products/<id>` 返回 **404**（实测 BW-3004-5 / BW-3566 / BW-403229 都是 404，且响应里没有产品详情表格）；
- 不再出现在首页、`/products`、分类数量、品牌筛选、OE Search、Bowen No. Search、
  `generateStaticParams`、RFQ 产品选择、Related products、以及将来 sitemap 的数据源里
  —— 因为这些入口**全部**读同一组仓储方法，而仓储这一层只返回公开集合。

### 2.1 另外 5 个被排除的产品（本阶段新发现，供业务方参考）

按「状态可发布、但**没有任何可展示 application**」被排除，与图片无关：

| product_id | 原因 |
| --- | --- |
| `BW-3004--3` | 有可靠主图，但没有可对外展示的 application 行 |
| `BW-31016` | 同上 |
| `BW-33655A` | 同上 |
| `BW-35059` | 同上 |
| `BW-3011-2` | 既没有可靠主图，也没有可展示 application |

这 5 个在内部库里完整保留，不需要现在处理；如果业务方希望它们上线，需要先补 application 或图片。

---

## 3. 最终 application 与 OE 索引数量

| 项目 | 数量（网站公开集合） |
| --- | ---: |
| applications | **730** |
| OE 索引行 | **2881** |
| 不同 normalized OE | **2155** |

与业务方给出的预计值（730 / 2881 / 2155）完全一致。

**示例 OE 验证**（业务方指定）：

| 查询 | 结果 |
| --- | --- |
| `25500-35540` | 3 条 exact 命中 / 2 个产品 |
| `2550035540` | 3 条 exact 命中 / 2 个产品 |
| 命中的 Bowen No. | **BW-3503、BW-3004-3** |
| 无图产品 `BW-3004-5` | **不再命中**（两种写法都不出现） |
| 两种写法的页面正文 | 逐字符一致（查询回显归一后 1231 字符完全相同） |

原来的 4 条命中 / 3 个产品已经按真实数据变成 3 条 / 2 个 —— **没有为了迁就旧测试而保留无图产品**。

---

## 4. 最终公开认证与荣誉清单

### 4.1 管理体系认证：**公开只保留 IATF 16949:2016**

| 认证 | 有证书图片 | 公开 | 处理 |
| --- | --- | --- | --- |
| IATF 16949:2016 | ✅ `iatf-16949-certificate.jpg` | ✅ 公开展示 | Quality 卡片 + 证书原件图 + 范围 + Clause 8.3 排除条款 |
| ISO 14001:2015 | ❌ 手册未附证书图 | ❌ 不公开 | 编号/范围/有效期**完整保留在内部证据**（`is_public: false`） |
| ISO 45001:2018 | ❌ 手册未附证书图 | ❌ 不公开 | 同上 |

实施方式（不是靠删内容，而是加字段）：

- `tools/config/product-types.mjs`
  - 新增 `COMPANY_FACTS.public_certifications = ['IATF 16949']`
  - 新增 `COMPANY_FACTS.public_certification_standards = ['IATF 16949:2016']`
  - 新增 `COMPANY_FACTS.internal_only_certifications = ['ISO 14001','ISO 45001']`
  - 原有 `certifications` / `certification_standards`（三项）保留为**内部证据清单**
  - `CERTIFICATIONS_DETAIL[].is_public`（IATF `true`，ISO 两项 `false`）+ `public_hide_reason`
- 页面**只允许**读 `public_*` 字段，`verify-public-surface.mjs` 有专门断言禁止直接读 `certifications` / `certification_standards`。

**ISO 两项已从以下公开位置移除**：Home、About、Quality、Header/Footer、meta title/description、
页面结构化数据、客户可见的认证统计与文案。并已删除：

- “Three certificates” → 改为 “Certificate and scope”
- “Bowen operates under three management systems” → 改为单一体系表述
- 解释 ISO 为什么没有证书图片的内部说明（整段删除）
- 强制公开页面必须包含三项认证的旧测试断言（`verify-prototype-data.mjs` 已改写为
  「公开认证只有 IATF，且 ISO 两项内部证据仍在」）

> 验证方式不止看文案：`/quality` 与首页的**完整 HTML（含 Next RSC payload）**里
> 现在都搜不到 `ISO 14001` / `ISO 45001`。这一点是本阶段实测发现并修掉的真实泄漏（见 §5.1）。

### 4.2 资质与荣誉：3 项全部公开（都有图片）

| 名称 | document_kind | 展示口径 |
| --- | --- | --- |
| High-tech Enterprise Certificate / 高新技术企业证书 | `certificate` | 按证书展示（编号 GR202537000055，签发 2025-12-08） |
| Work Safety Standardization Certificate / 安全生产标准化证书 | `certificate` | 按证书展示（编号 曲AQB XW 20250005，有效期至 2028-07） |
| Shandong Province 2026 Innovative SME public list / 山东省2026年度创新型中小企业公示 | `public_list` | **必须**标注为 public list / 公示名单，页面徽标显示 `PUBLIC LIST`，列表项标签为 “Published”，**不**称作管理体系认证证书 |

---

## 5. 地址显示位置

业务方确认可公开的地址（来自 IATF 证书原图，IATF USI: CCHE25）：

```
No. 3, Duzhi Road, Qufu Electronic Information Industrial Park,
Jining City, Shandong Province, 273100, China
```

- **唯一权威来源**：`tools/config/product-types.mjs → COMPANY_FACTS`
  - 新增 `address_en`（上面整行）、`postal_code: '273100'`、`country: 'China'`
  - 新增 `address_evidence`（内部字段：说明来源是 IATF 证书原图 + 业务方已确认）
  - **删除**旧字段 `address_note`（“手册封底没有地址、网站因此不展示任何地址”）
- **展示位置**
  - `/contact` 公司主体卡片：新增 `<dt>Address</dt>`，展示完整地址（左对齐、可换行）
  - 页脚品牌栏：简要展示完整地址（`SiteFooter`）
- **删除的旧文案**：公司资料没有地址 / 地址未确认 / 不展示地址是因为宣传手册没有地址 / 不发布猜测地址
  —— 已全部清除，并有测试断言（`verify-public-surface.mjs` + `p4-live-check.mjs`）。
- **没有新增**：地图坐标、营业时间、海外办公室、收货地址、WhatsApp 公司账号
  （有专门断言扫描页面源码，0 命中）。
- `docs/company-info-from-brochure.md` 第 2 节与第 8 节已同步更新；
  `docs/phase-4-real-assets-company-info-integration.md` §12.1 加了「Phase 4.1 已决策并实施」的说明。

### 5.1 顺带修掉的一个真实泄漏：内部字段进了页面 HTML

排查地址/认证时发现：`SiteHeader` 是客户端组件，而 `app/layout.tsx` 把**整个** `company` 对象
传给它 → Next 会把 props 序列化进页面 HTML 的 RSC payload。
于是 `/quality` 的 HTML 里出现了 `"certifications":["IATF 16949","ISO 14001","ISO 45001"]`，
`/products/BW-3005` 的 HTML 里出现了 `"source_sheets":["综合产品信息表","工作表1",…]`、
`source_row`、`product_type_evidence`。

**修法**：所有跨客户端边界的 props 改成显式白名单。

| 组件 | 改动 |
| --- | --- |
| `app/layout.tsx` | 只传页头需要的 5 个字段、页脚需要的 9 个字段（不再传整个 `company`） |
| `components/AddToRfq.tsx` | 定义 `RfqProductLite` / `RfqApplicationLite`，只接收 3 + 4 个字段 |
| `app/(site)/products/[id]/page.tsx` | 显式映射出上面这两个精简对象再传入 |

现在实测：`/quality`、`/`、`/products/BW-3005` 的 HTML 里 `ISO 14001`、`ISO 45001`、
`source_sheets`、`product_type_evidence`、`综合产品信息表` **全部为 0 命中**。

---

## 6. 删除了哪些内部原型文案

以下内容已从**客户可见页面**删除（原始证据仍保留在 `data/derived`、`data/processed`、
`tools/config`、交付报告与开发模式里，**没有删除任何原始证据**）：

| 删除项 | 原位置 | 处理 |
| --- | --- | --- |
| `UI Prototype — Phase 3 · Not published · No index` | 页脚 | 整行删除 |
| `Prototype #N` / `Prototype candidate #N` | ProductCard 徽标、产品详情徽标 | 删除 |
| `Subtype: not used in V1` | 产品详情徽标 | 删除 |
| `Source sheets` + 工作表名列表 | 产品详情 specs、ProductCard meta | 删除（改为不提） |
| `综合产品信息表` / `工作表1` 等中文工作表名 | 产品详情表格「Source」列 | 整列删除 |
| `Source: … · row N`（审核表行号） | 产品详情表格 | 整列删除 |
| `How this classification was made` + `Source label` + 继承说明 | 产品详情 | 整块删除 |
| `Source sheets / 来源工作表` 统计 | ProductCard | 删除 |
| `Source: Bowen company profile, page N`（内部证据页码） | Home / About / Factory / Quality 图注 | 去掉页码，只保留出版物名称 |
| 「地址缺失」说明 | Contact | 删除并替换为真实地址 |
| 「证书缺图 / 为什么不放 ISO 证书图」说明 | Quality | 删除 |
| 「证书编号正在收集」说明 | Quality | 早已删除，本阶段加断言防回归 |
| `Source: … row N`（OE 搜索结果里的来源行） | `/oe-search` | 整行删除 |
| `product_type_source` / `classification evidence` | 页面 | 从不出现在页面，加断言防回归 |
| Blog 入口 | Header 主导航 + 页脚 Company 栏 | 隐藏（`/blog` 页面本身保留，无来源文章不临时编造） |

产品详情页现在只保留：真实产品图片、Bowen No.、产品类型、OE References、Opening Temperature、
Vehicle/Application 原文关系、以及 RFQ 入口。

补充：`next.config.ts` 的 `X-Prototype-Phase` 响应头由 `phase-3-ui-prototype` 改为
`phase-4.1-publication-gate`（这是技术标记，不是页面文案；`X-Robots-Tag: noindex, nofollow` 继续保留）。

---

## 7. 发动机代码问题如何处理

采用**保守处理**（不猜、不扩正则后照旧展示）：

### 7.1 修复提取逻辑本身（`website/src/lib/engine-code.ts`）

| 原始文本 | 修复前 | 修复后 |
| --- | --- | --- |
| `4G6` | `[]`（数字开头被整段漏掉） | `['4G6']` |
| `4G13` | `['G13']`（删掉首位数字，改变代号） | `['4G13']` |
| `4G15S` | `['G15S']` | `['4G15S']` |
| `476ZQA` | `[]` | `['476ZQA']` |
| `A4L` / `F150` | 当作发动机候选输出 | 仍会作为**候选**提取，但**不再出现在任何公开页面** |
| `EA888` | `['EA888']` | `['EA888']`（不变） |

关键改动：token 正则从 `/[A-Z][A-Z0-9]{2,11}/g` 改为 `/[A-Z0-9][A-Z0-9._-]{1,15}/g`
（允许数字开头 + 整段匹配），并新增「必须同时含字母与数字」「排除纯数字 / 数值+单位 / 温度写法」。
文件顶部写清了边界：**这是字符串特征匹配，不是人工复核过的发动机代号**。

### 7.2 暂停公开展示（本阶段的实质处理）

| 位置 | 处理 |
| --- | --- |
| 首页「By Engine」入口 | 删除；「Four ways」改为「Three ways」（OE / Bowen No. / 车型或 application 原文） |
| 首页结果示例卡 | 删除 `<dt>Engine</dt><dd>G6EA</dd>`，改为 `Application (as recorded)` |
| 首页 MakeExplorer | 删除每个品牌下的发动机代号 chips（原本链接到 `/products?engine=…`），首页 `/products?engine=` 链接数为 **0** |
| `MakeSummary` 类型 | 删除 `sampleEngines` 字段（`types.ts` 留有说明） |
| 产品详情表格 | 删除「Engine codes in text」整列与对应图例说明；表格只保留 OE / Vehicle-Application 原文 / Opening Temperature |
| `/products` 筛选面板 | 删除 `ENGINE_SUGGESTIONS` 与 `<datalist>`；标签从 “Engine / application” 改为 “Application text (as recorded)”，并注明「不把提取出的发动机代号当作已确认数据」 |
| `/oe-search` 结果 | 删除 “Engine / Application” 行（原样展示 `engine_application`），只保留 “Vehicle / Application (as recorded)” |
| RFQ 明细与表单 | 页面标签改为 “Vehicle / Application (as recorded)”；`payload.items[].engine` 字段**保留**（契约兼容、值为 application 原文，不是提取代号） |
| 中文 application 原文 | **原样保留**（例如 “三菱4G6 471Q 菱帅 … 吉利4G13 …”），页面明确写 “exactly as recorded … rather than presenting machine-split or machine-translated conclusions”，**没有**机器翻译成英文适配结论 |

实测：`/products/BW-3005` 页面里 `>G13<` / `>G15S<` 独立标签 **0 个**，而 `4G13` 原文出现 21 次（完整保留）；
首页 `A4L` / `F150` **0 次**，`/products?engine=` 链接 **0 个**；`/products` 的 `engine-suggestions` **0 次**。

### 7.3 新增测试（`website/tools/verify-engine-code.mjs`，28 项）

至少覆盖业务方点名的四条，并额外加了「公开展示已暂停」的结构性断言：

- `4G13` 不会变成 `G13`（且结果里不含 `G13`）
- `4G15S` 不会变成 `G15S`
- `4G6` 不会因为正则丢掉首位数字
- `A4L` / `F150` 只是候选 —— 断言**没有任何页面/组件 import `extractEngineCodes`**、
  页面不含 `Engine codes in text` / `sampleEngines` / `engineTags`、
  首页不含 `/products?engine=` 链接、筛选面板不含发动机候选 datalist

---

## 8. 删除或收敛了哪些无证据质量承诺

**保留**（宣传手册与图片能直接证明）：

- IATF 16949:2016 证书及其适用范围（manufacture of thermostats）
- Clause 8.3 product design 排除条款（原样保留）
- 调整测试设备（211 系列 / 20-24 系列 sensing element adjustment and testing machine，含照片）
- 节温器寿命试验台（thermostat life test bench，含照片）
- 工厂与设备照片（13 张）
- 已有证书及荣誉图片（IATF + 3 项荣誉）

**删除 / 收敛**（没有明确资料证明的流程承诺）：

| 原承诺 | 位置 | 处理 |
| --- | --- | --- |
| “Test results are linked to the production batch”（测试结果与生产批次绑定） | Quality 六个检验环节 | 删除整块 `CONTROLS` |
| “so supplied parts can be traced back”（所有产品均可完整追溯） | Quality / Home | 删除 |
| “Inspection happens at six points between goods-in and packing” + 每类产品固定检验 | Quality | 删除整块 |
| “Dimensional checks with calibrated instruments”（已校准量具） | Home | 删除该卡 |
| “Every thermostat type is verified at its rated opening temperature before release” | Home | 删除该卡 |
| “Critical purchased components are checked against drawing” | Home | 删除该卡 |
| “Sealing / leak test”“Final inspection” | Quality | 删除整块 |

替换为只讲证书与设备事实的四张卡：Certificate scope / Adjustment and testing equipment /
Thermostat life test bench / Document pack on request。

**没有新增**：产能、标准交期、MOQ、一天内回复、全球领先、顶级供应商、未核实客户与出口国家数量。
另外顺手收敛了两处旧文案：RFQ「What happens next」里的 “Price, MOQ and lead time per line”
改为 “Price and availability per line”。

> 说明：这不代表公司没有这些流程，只代表**当前网站资料不足以公开证明**。

---

## 9. 构建和验证脚本如何解除副作用

### 9.1 把纯函数移入独立模块

新增 `tools/lib/oe-keys.mjs`：`oeSearchKey` / `oeDisplayNormalized` / `looksLikeOeToken` /
`parseBowenCell` / `detectMisalignment` / `extractTemperatures` / `tokensOf` / `clean` / `isBlank`。
本模块不读文件、不写文件、无顶层副作用。

`tools/verify-product-db-v2.mjs` 第 15 行由

```js
import { oeSearchKey } from './build-product-db-v2.mjs';   // 顶层会写文件
```

改为

```js
import { oeSearchKey } from './lib/oe-keys.mjs';           // 纯函数
```

### 9.2 构建脚本加显式 main 入口

`tools/build-product-db-v2.mjs`：

```js
export function main() { /* 全部构建逻辑 */ }

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
```

**实测只读性**：记录 16 个数据文件（`data/derived/v2/*.json` 10 个 + `website/src/data/*.json` 6 个）的 SHA-256，
依次运行 `node tools/verify-product-db-v2.mjs` 与 `node tools/p4-build-site-assets.mjs --verify`，
之后重新计算：**0 / 16 个文件发生变化**；`stats.json` 的 mtime 也完全不变。
两个校验脚本现在都是纯只读。

### 9.3 发布集合单点实现，消除循环依赖

新增 `tools/lib/publication-gate.mjs`（纯函数 + 只读读取）：

```
公开产品 = 状态 ∈ {prototype_candidate, searchable_noindex}
         ∧ 未 blocked
         ∧ 有可靠主图（mapping_status === 'exact' ∧ is_primary_image === true
                       ∧ 每个 product_id 只有一张选定主图）
         ∧ 至少有 1 条可对外展示的 application
```

- `tools/build-product-db-v2.mjs` 调 `computePublicationGate({products, applications, imageMap})`
  决定网站 `products/applications/oe-index`，并写出审计产物 `data/derived/v2/publication-gate.json`；
- `tools/p4-build-site-assets.mjs` 调 `readPublicationGate(root)` 决定复制哪些产品图
  —— **不再读 `website/src/data/products.json`**。

两个脚本读同一组源文件（内部 products.json + product-applications.json + 源图片映射）、
跑同一个函数，因此发布集合必然一致，且**不存在「产品数据 ↔ 图片数据」互相依赖**。

### 9.4 明确的刷新顺序

新增 `tools/refresh-site-data.mjs`（`website/package.json` 里是 `pnpm data:refresh`），
按固定顺序逐步执行，任一步失败即停止：

| # | 步骤 | 命令 |
| --- | --- | --- |
| 1 | 构建内部产品数据 + 导出网站数据与发布集合审计 | `node tools/build-product-db-v2.mjs` |
| 2 | 复制网站图片 + 生成产品图片映射 | `node tools/p4-build-site-assets.mjs` |
| 3 | 只读校验：内部数据库 | `node tools/verify-product-db-v2.mjs` |
| 4 | 只读校验：资产与发布集合 | `node tools/p4-build-site-assets.mjs --verify` |
| 5 | 只读校验：网站数据集 | `node website/tools/verify-prototype-data.mjs` |
| 6 | 只读守卫：公开页面内容边界 | `node website/tools/verify-public-surface.mjs` |
| 7 | 只读回归：车型/机型提取 | `node website/tools/verify-engine-code.mjs` |

实测：7/7 步全部 PASS，整体 exit 0。

### 9.5 `p4-build-site-assets.mjs --verify` 的增强

原来名为 `reviewLeak` 的检查其实只判断 product_id 是否在网站产品表里，而且 verify 还会复制文件。
现在 `--verify` **只读**，并逐项验证：

| # | 检查 | 本次结果 |
| --- | --- | --- |
| 0 | 从源数据**重新计算**发布集合（不信任已有产物），并检查每个 product_id 只有唯一主图 | 426 → 394，`0` 个重复主图 |
| 1 | 源映射记录必须 `mapping_status === 'exact'` 且 `is_primary_image === true`，且源文件真实存在 | 403 条可靠主图产品，全部合规；源文件全部存在 |
| 2 | `product-images.json` ↔ 公开产品集合完全一致；`website/src/data/products.json` 也一致 | 394 / 394，缺失 0，越界 0 |
| 3 | 每个网站产品图与选定源文件**逐字节一致**（并比对 SHA-256） | **394 / 394 逐字节一致** |
| 4 | `review_required` / `unresolved` / 非主图不得泄漏；产品图目录不得有多余文件 | 选中主图全部 exact+primary；review 专属源文件被用作发布主图 **0**；多余文件 **0** |
| 5 | `site-media.json` 文件存在 + sha256 一致 + alt/caption 齐全 | company 2 / factory 13 / certificates 4，全部通过 |
| 6 | 无图产品（22）、无 application 产品（4+1）、draft（5）不得进入任何公开数据 | 进入公开数据 **0** |
| 7 | 产品图片不得指向 `data/` 目录 | **0** |

> 一个刻意保留的例外说明：Excel 里同一张照片可能既挂在某个已发布产品下、又出现在一条
> `unresolved` 记录里（内容重复）。因此泄漏检查按**源路径**判定，而不是按字节 ——
> 否则会把这种同图复用误报成泄漏。verify 会把这种「内容相同的孪生文件」数量作为参考信息打印出来（本次 2 张）。

---

## 10. 每项测试的实际结果

全部在最终代码上重跑，日志保存在 `tmp/p41-logs/`。

### 10.1 验收命令

| # | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| 1 | `node tools/verify-product-db-v2.mjs` | ✅ **PASS 75 / FAIL 0**，exit 0（“自动猜 product_type = 0”） | `01-verify-product-db-v2.txt` |
| 2 | `node tools/p4-build-site-assets.mjs --verify` | ✅ exit 0，见 §9.5 全部通过 | `02-assets-verify.txt` |
| 3 | `node website/tools/verify-prototype-data.mjs` | ✅ **PASS 49 / FAIL 0**，exit 0 | `03-verify-prototype-data.txt` |
| 4 | `node website/tools/verify-category-copy.mjs` | ✅ **PASS 12 / FAIL 0**，exit 0 | `04-verify-category-copy.txt` |
| 5 | `node website/tools/verify-rfq-e2e.mjs` | ✅ **PASS 31 / FAIL 0**，exit 0（真实 Chrome 填表 → payload） | `07-verify-rfq-e2e.txt` |
| 6 | `pnpm exec tsc --noEmit` | ✅ exit 0，无输出 | `08-tsc.txt` |
| 7 | `pnpm build` | ✅ exit 0，`Compiled successfully`，`Generating static pages (406/406)` | `09-build.txt` |

> 页面实测脚本 `tools/p4-live-check.mjs`（本阶段由 70 项扩到 112 项）：✅ **PASS 112 / FAIL 0**，exit 0。
> 移动端溢出：`website/tools/find-overflow.mjs` 10 条路由 × 390px，**全部 0px 横向溢出**。

### 10.2 本阶段新增的测试与守卫

| 工具 | 项数 | 结果 | 覆盖 |
| --- | ---: | --- | --- |
| `website/tools/verify-public-surface.mjs`（新增） | 24 | ✅ PASS 24 / FAIL 0 | 内部原型/数据处理文案、ISO 未公开认证、未确认发动机标签、地址、Blog 入口、内部字段序列化 |
| `website/tools/verify-engine-code.mjs`（新增） | 28 | ✅ PASS 28 / FAIL 0 | 代号完整保留、4G13≠G13、4G6/476ZQA 可提取、A4L/F150 不上页面、datalist 已移除 |
| `tools/verify-product-db-v2.mjs`（Phase 4.1 新增小节） | +6 | ✅ 全部 PASS | 校验脚本只读、构建脚本有 main 守卫、22 个无图产品仍在内部库、review_required/unresolved 未删、准入规则单点实现 |
| `website/tools/verify-prototype-data.mjs`（Phase 4.1 新增小节） | +14 | ✅ 全部 PASS | 公开集合双向一致、有图覆盖、无图产品 0 泄漏、22 个清单与业务方一致、OE 示例 3 条/2 产品、首页与列表口径一致、地址、public 认证、document_kind |
| `tools/p4-live-check.mjs`（新增小节 1b/13–17） | +42 | ✅ 全部 PASS | 三条无图路由 404、10 条路由无内部文案、发动机标签、地址、公开数量一致、RSC payload 不泄漏、Quality 证据边界 |

**自动化断言合计：331 项全部 PASS，0 FAIL**（75 + 49 + 12 + 24 + 28 + 31 + 112），
外加资产逐字节校验、`tsc` 与生产构建三项 exit 0。

### 10.3 验收条件逐条对照

| # | 验收条件 | 结果 |
| --- | --- | --- |
| 1 | 网站公开产品为 394 个（以实际计算结果为准） | ✅ 394（动态计算，无硬编码） |
| 2 | 所有公开产品都有可靠真实主图 | ✅ 394/394 有图，且与源文件逐字节一致 |
| 3 | BW-3004-5 直接访问不能显示公开产品详情 | ✅ HTTP 404，无详情表格（BW-3566 / BW-403229 同样 404） |
| 4 | 两种 OE 写法结果一致 | ✅ 页面正文归一后逐字符一致 |
| 5 | OE 示例不再返回无图产品 BW-3004-5 | ✅ 3 条 / 2 个产品（BW-3503、BW-3004-3） |
| 6 | 首页、产品、搜索和 RFQ 数量一致 | ✅ 首页 394 = 列表 394；统计口径同一公开集合（730 app / 2881 OE / 2155 OE） |
| 7 | 公开页面不显示 ISO 14001、ISO 45001 | ✅ 含 RSC payload 在内 0 命中 |
| 8 | Quality 只公开有证书图片的认证 | ✅ 只有 IATF 16949:2016（+ 证书原件图） |
| 9 | Contact 显示已确认街道地址 | ✅ 完整地址；页脚也简要展示 |
| 10 | 页面不再出现 Prototype、Source sheets 或内部审核说明 | ✅ 10 条路由 × 9 类禁用文案，0 命中 |
| 11 | 不把 4G13 显示为 G13 | ✅ `>G13<` 0 个；`4G13` 原文完整保留 |
| 12 | 不公开展示未经确认的发动机标签 | ✅ 首页 A4L/F150 0 次，引擎筛选列已移除，候选列表已删 |
| 13 | 工厂、产品、IATF 及荣誉图片均可加载 | ✅ p4-live-check 抓取页面引用的**全部**图片 URL，逐一 200 + `image/*` |
| 14 | 390px 移动端无横向溢出 | ✅ 10 条路由 × 390px，文档 scrollWidth 均等于 390px，溢出 0px |
| 15 | RFQ 保留 product_id / application_id / OE / 车型应用 / 数量上下文 | ✅ e2e payload 断言全通过（`BW-3005`、`APP-00388`、`4711306950`、原文、`500 pcs`） |
| 16 | noindex 继续保留 | ✅ `X-Robots-Tag: noindex, nofollow` + `metadata.robots` |
| 17 | 不发送真实邮件 | ✅ 仍只构造 payload（`delivery.transport = prototype_no_email_sent`） |

---

## 11. 实际检查的页面与移动端结果

预览服务器：`next start -p 3100`（生产构建），实测 URL **http://127.0.0.1:3100/**。

### 11.1 桌面端（1440px）逐页实看

| 路由 | HTTP | 实看结论 |
| --- | --- | --- |
| `/` | 200 | 2,155+ OE / 394 产品；「Three ways」；车型品牌 57 个（中英合并，无「大众 + Volkswagen」重复）；分类 276/41/74/3；无引擎 chips、无产能/交期 |
| `/products` | 200 | 计数 394；筛选面板无发动机候选列表；分类/品牌筛选正常 |
| `/products/BW-3005` | 200 | 真实主图（GXN 包装图）、Bowen No. 3005、Thermostat、OE 85 / Applications 7 / Opening 76.5–82°C；表格三列；无 Source/HOW/Prototype/Subtype |
| `/products/BW-3004-5` | **404** | 无图产品不显示详情 |
| `/oe-search?q=25500-35540` | 200 | 3 exact / 2 Bowen（3503 ×2、3004-3）；无 Engine 行、无 Source 行 |
| `/oe-search?q=2550035540` | 200 | 与上一条完全一致 |
| `/factory` | 200 | 13 张真实车间/设备照片；四道工序；无产能/交期 |
| `/quality` | 200 | 只有 IATF 卡片 + 证书原件 + 3 张测试设备图 + 3 项荣誉（公示名单标 PUBLIC LIST）；无 ISO、无六个检验环节 |
| `/about` | 200 | 2009/2014/10,000+ m²/3,500 m²/2,000+ m²/100+ 台；产品范围；无占位块 |
| `/contact` | 200 | 完整地址 + 邮箱 + 电话；1688 标注为中国国内平台；无「不展示地址」说明 |
| `/rfq?product=BW-3005` | 200 | 自动带入 1 条明细；「Vehicle / Application (as recorded)」；无 Prototype 文案 |

截图（桌面 1440px）保存在 `tmp/p41-shots/`：`home.png`、`products.png`、`detail.png`、
`oesearch.png`、`factory`→略、`quality.png`、`about.png`、`contact.png`、`rfq.png`。

### 11.2 移动端（390px）

| 路由 | scrollWidth | 横向溢出 |
| --- | ---: | ---: |
| `/` | 390px | 0px |
| `/products` | 390px | 0px |
| `/products/BW-3005` | 390px | 0px |
| `/oe-search?q=25500-35540` | 390px | 0px |
| `/oe-search?q=2550035540` | 390px | 0px |
| `/factory` | 390px | 0px |
| `/quality` | 390px | 0px |
| `/about` | 390px | 0px |
| `/contact` | 390px | 0px |
| `/rfq?product=BW-3005` | 390px | 0px |

移动端截图：`tmp/p41-shots/{home,detail,contact,quality}-mobile.png`，
实看 `/contact` 与 `/products/BW-3005` 版式正常、地址完整可读、表格单列不溢出。

### 11.3 遇到的运行环境问题（供后续参考）

- 本机没有 `git` 可执行文件（早前报告已记录），工作区状态用 `tools/_dsh-git-status.mjs` 核对。
- `next dev` 与 `next start` **共用 `website/.next`**：在 `next start` 运行期间跑一次自启 dev 服务器的
  `verify-rfq-e2e` 会把 `.next` 改坏，导致预览服务 500（页面缺 `viewport` meta，移动端探针读到 980px）。
  处理：重建后再启动生产预览，并把 `verify-rfq-e2e` 分别以
  `BASE_URL=http://127.0.0.1:3100` 与「自行起 dev 服务器」两种方式各跑一次，均 PASS 31 / FAIL 0。

---

## 12. 仍未处理的事项（本阶段不做）

| # | 事项 | 数量 / 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | 无可靠主图的产品 | 22 个 | 内部数据完整保留，等业务方补图后重新跑 `pnpm data:refresh` 即可自动上线 |
| 2 | 有图但没有可展示 application 的产品 | 4 个（`BW-3004--3`、`BW-31016`、`BW-33655A`、`BW-35059`） | 同上；`BW-3011-2` 两者都缺 |
| 3 | `review_required` / `unresolved` 产品图 | 21 + 5 条 | 按业务要求留给后续业务人员处理，本阶段未动 |
| 4 | draft 产品 | 5 个 | 未进网站数据集 |
| 5 | 需要人工确认的产品图片与产品类型 | 未处理 | 任务明确本阶段不处理 |
| 6 | ISO 14001 / ISO 45001 证书扫描件 | 缺失 | 内部证据已完整保留；拿到图片后把 `is_public` 改为 `true` 并重建即可公开 |
| 7 | Blog | `/blog` 页面保留但已从 Header/Footer 隐藏 | 不做没有来源的文章；后续有编辑与作者后再启用 |
| 8 | 真实询盘服务 | 未接 | Phase 5：服务端接收、校验、防重复、持久化、邮件通知 |
| 9 | SEO（域名、canonical、sitemap、结构化数据、多语言路由） | 未做 | Phase 6；本阶段只保证「只为实际发布的有图产品生成 SEO 数据」这一前提成立 |
| 10 | 产品图片的 width/height 元数据 | 仍为 `null` | `product-images.json` 未记录像素尺寸，未来做性能优化时可补 |
| 11 | 地图坐标、营业时间、海外办公室、收货地址、WhatsApp 公司账号 | 未添加 | 业务方明确禁止 |
| 12 | 产能 / 标准交期 / MOQ | 未添加 | 业务方明确不做，也没有写「待补」说明 |
| 13 | `X-Prototype-Phase` 响应头 | 已改为 `phase-4.1-publication-gate` | 仍是预览期技术标记，正式上线前应整条移除 |

按任务要求，**本阶段到此停止**：未部署、未取消 noindex、未接 Supabase、未发送真实邮件、
未配置正式域名、未开始中文或西班牙语站、未自动翻译适配数据、未处理需要业务人工确认的图片或产品类型。

---

## 13. 本阶段改动清单（可复核）

### 新增文件

| 文件 | 作用 |
| --- | --- |
| `tools/lib/publication-gate.mjs` | 公开产品准入规则（唯一判定，构建与资产脚本共用） |
| `tools/lib/oe-keys.mjs` | OE / Bowen 纯函数（从构建脚本抽出，使校验保持只读） |
| `tools/refresh-site-data.mjs` | 数据 + 资产 + 只读校验的固定顺序刷新入口 |
| `website/tools/verify-public-surface.mjs` | 公开页面内容边界守卫（24 项） |
| `website/tools/verify-engine-code.mjs` | 车型/机型提取回归 + 公开展示暂停断言（28 项） |
| `data/derived/v2/publication-gate.json` | 发布集合审计产物（构建生成） |
| `docs/phase-4.1-publication-gate-and-content-cleanup.md` | 本报告 |

### 修改文件（业务代码）

`tools/build-product-db-v2.mjs`、`tools/config/product-types.mjs`、`tools/verify-product-db-v2.mjs`、
`tools/p4-build-site-assets.mjs`、`tools/p4-live-check.mjs`、
`website/package.json`、`website/next.config.ts`、
`website/src/app/layout.tsx`、`website/src/app/(site)/layout.tsx`（未改）、
`website/src/app/(site)/page.tsx`、`products/page.tsx`、`products/[id]/page.tsx`、
`products/[id]/detail.module.css`、`quality/page.tsx`、`quality/quality.module.css`、
`about/page.tsx`、`contact/page.tsx`、`contact/contact.module.css`、`rfq/page.tsx`、`oe-search/page.tsx`、
`website/src/components/{SiteHeader,SiteFooter,SiteFooter.module.css,ProductCard,ProductVisual,MakeExplorer,ProductFilters,AddToRfq,RfqForm}.tsx`、
`website/src/lib/{types.ts,repository.ts,media.ts,engine-code.ts,rfq-payload.ts,repositories/json-repository.ts}`、
`website/tools/verify-prototype-data.mjs`、
`docs/company-info-from-brochure.md`、`docs/phase-4-real-assets-company-info-integration.md`

### 生成/重建的产物

`data/derived/v2/*.json`（含新增 `publication-gate.json`）、
`website/src/data/{products,applications,oe-index,site-facts,product-images,site-media}.json`、
`website/public/assets/products/*`（394 张）、`website/public/assets/{company,factory,certificates}/*`（19 张）。
