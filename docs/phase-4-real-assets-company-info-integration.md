# Phase 4 — 核实公司资料与真实图片接入 Bowen Website Prototype

> ## ⚠️ 后续修订提示（2026-09-26 追加）
>
> 本文件描述的是 **Phase 4 当时的状态**。之后由**另一个并行任务 Phase 4.1**
> （`docs/phase-4.1-publication-gate-and-content-cleanup.md`）接管并修改了公开口径。
> 阅读本文件时请注意以下 3 处**已被取代**的结论：
>
> | 本文件的结论 | 当前实际状态（以 Phase 4.1 为准） |
> | --- | --- |
> | §6 / §7.4：ISO 14001:2015（05325E31120R0S）与 ISO 45001:2018（05325S31042R0S）**已随编号/范围/日期一起公开** | **已从全部公开页面撤下**。Phase 4.1 的公开准则是「只公开持有证书原图的认证」；手册未附 ISO 两张证书图片，故 `is_public: false`，编号等仍作为**内部证据**完整保留 |
> | §12.1：IATF 证书上的街道地址「未发布，需业务方决策」 | **业务方已确认可公开**（来源 IATF 证书原图，IATF USI: CCHE25），Phase 4.1 已发布该地址 |
> | §11：`p4-live-check` 70 项、`verify-prototype-data` 36 项等测试数字 | Phase 4.1 已把该脚本扩到 112 项，并新增 `verify-public-surface`（24）与 `verify-engine-code`（28）；断言口径随之改变。本文件里的旧数字仅代表 Phase 4 当时的构建 |
>
> 另：Phase 4.1 修复了本阶段引入的一个**真实缺陷** —— `layout.tsx` 把整个 `company` 对象传给客户端组件
> `SiteHeader`，导致 `company.certifications: ["IATF 16949","ISO 14001","ISO 45001"]` 被序列化进
> 每个页面的 RSC payload。正确做法是只传必要字段子集（Phase 4.1 已改，见其 §5.1）。
>
> **本阶段的图片交付未受影响、已被 Phase 4.1 采纳**：413 张资产（394 产品主图 + 13 工厂 + 2 公司 + 4 证书）
> 仍在 `website/public/assets/`，映射入口收敛到 Phase 4.1 的发布准入管线。

> 阶段目标：把**已经核实**的公司资料与**真实图片**接进现有 Next.js 原型，
> 用真实资料替换占位内容；证据不足的一律留空或 fallback，**不猜、不编**。
>
> 本阶段不推倒重做原型、不改写 `data/raw`、不碰 500+ 条需人工确认的产品图、
> 不做产能 / 标准交期 / Supabase / 邮件后端 / 部署 / 域名 / 取消 noindex。

- 执行日期：2026-09-26
- 仓库 HEAD：`2e89243010769d1c7e1117d060a6131598cee00a`（branch `main`，subject `Phase 3.5：审计 qfbowen.com 现有官网并提取可复用真实素材`）
- 主要证据源：`宣传手册最终PDF/博文公司宣传手册-英文版.pdf`、`..._中文版.pdf`

---

## 0. 环境事实（影响验收方式，需业务方知悉）

| 事实 | 说明 | 处理 |
| --- | --- | --- |
| **本机没有安装 git** | PATH、`Program Files`、`Program Files (x86)`、`%LOCALAPPDATA%\Programs`、DSH 安装目录递归查找均无 `git.exe`；全盘未发现 | 为满足「先看 git status、不得覆盖别人未提交修改」的要求，另行实现了一个**零依赖、直接读 `.git`** 的等价工具 `tools/_dsh-git-status.mjs`（解析 index v2 + 递归 walk HEAD tree + 按 `.gitattributes` 做 CRLF→LF 归一 + gitignore 语义），并经独立 .NET `DeflateStream`/`SHA1` 重新实现交叉校验 |
| `pnpm` 在受限沙箱下 `spawn EPERM` | 沙箱禁止 Node 子进程使用管道 stdio | 先改用项目自带的 `website/npm.cmd`（内部用 `stdio:'inherit'`）完成等价验证；沙箱放开后**已按原样补跑** `pnpm exec tsc --noEmit` 与 `pnpm build`，均 exit 0 |

### 0.1 接手时的工作区状态（不得破坏的既有改动）

`node tools/_dsh-git-status.mjs` 最终快照：**modified 49 / deleted 24 / untracked 476 / staged 0 / conflicts 0 / errors 0**，tracked 1219 个文件。

其中**与本阶段无关、接手时就已存在的改动**（未提交）包括：

- `data/derived/v2/*.json`（7 个）、`data/processed/product-image-map.json`、`data/processed/product-image-review/index.html`
- `delivery/01_database-v2-migration-report.md`、`delivery/02_ui-prototype-report.md`、`delivery/04_known-issues.md`、`delivery/prototype-info.txt`
- `docs/excel-image-audit.md`、`docs/product-image-review-needed.md`、`review/product-type-unconfirmed.xlsx`
- `tools/build-image-review-package.mjs`、`tools/extract-product-images.mjs`、`tools/lib/cdp-render.mjs`、`tools/verify-product-db-v2.mjs`、`tools/verify-product-images.mjs`
- `deleted 24`：全部在 `data/processed/product-image-review/` 下（前序任务重新生成评审表产生）

**本阶段全程未执行 `git reset`、未 checkout、未删除任何非本任务文件**，上述改动原样保留。

---

## 1. 修改了哪些页面和组件

### 1.1 页面（`website/src/app/`）

| 文件 | 本阶段改动 |
| --- | --- |
| `layout.tsx` | 改为 `async` 服务端组件；从 `getSiteFacts()` 取公司资料并注入页头/页脚（**单一来源**）；站点 description 换成正式全称 |
| `(site)/page.tsx`（Home） | Hero 换正式全称与核实事实；厂区照片替换占位；四道工序文案改为手册口径；质量区改用完整标准号并指向 Quality 页；移除「一个工作日内回复」等未核实承诺 |
| `(site)/about/page.tsx` | 全面重写：正式中英文名称、2009 成立 / 2014 建厂、占地与车间面积、产品范围、制造与质量描述、2 张真实图片；**删除**「Company story details still to be supplied」占位块；「Who we work with」收紧为手册口径（manufacturers / distributors） |
| `(site)/factory/page.tsx` | 重写：真实车间与设备照片 9 张 + 4 道工序（标题保持不变）+ 厂区事实；**删除整个「Capacity & lead time」模块** |
| `(site)/quality/page.tsx` | 重写：三张体系证书的真实编号/范围/日期、IATF 证书原件图、测试设备图 3 张、资质荣誉 3 项；**删除**「证书编号正在收集」占位说明 |
| `(site)/contact/page.tsx` | 重写：公司主体卡片（正式全称 + 中文名 + 邮箱 + 电话）、销售/技术卡片统一使用唯一已核实邮箱、**删除**「Company details — pending」占位卡、1688 移入次要位置并标注国内平台 |
| `(site)/rfq/page.tsx` | 去掉未核实的「within one working day」承诺（表单与产品上下文逻辑未动） |
| `(site)/products/[id]/page.tsx` | 接入真实主图 + 正确 alt；fallback 说明仅在确实无图时出现 |

### 1.2 组件（`website/src/components/`）

| 文件 | 本阶段改动 |
| --- | --- |
| `ProductVisual.tsx` / `.module.css` | 支持真实图片（`object-fit: contain` + 白底，防止不同长宽比源图变形）；无图时保留克制的工程图 fallback，占位文案改为可选且默认不显示 |
| `ProductCard.tsx` | 通过 `lib/media` 取产品主图与 alt；无图自动 fallback |
| `SiteHeader.tsx` / `.module.css` | 顶栏改为「正式全称 + 电话 + 邮箱」；品牌副标题改为 `Automotive Thermostat Manufacturer`；窄屏改为两行居中，避免挤压 |
| `SiteFooter.tsx` / `.module.css` | 正式全称 + 中文名、邮箱、电话、2009/2014、产品/公司/联系导航；新增国内平台说明条（明确 `China domestic marketplace`） |

### 1.3 数据与配置层

| 文件 | 本阶段改动 |
| --- | --- |
| `tools/config/product-types.mjs` | **公司资料的唯一权威来源**：扩充 `COMPANY_FACTS`（联系方式、全称、建厂年份、产品范围、证据来源、地址说明），新增 `CERTIFICATIONS_DETAIL` 与 `HONORS` |
| `tools/build-product-db-v2.mjs` | 生成 `site-facts.json` 时带上 `certifications_detail` 与 `honors` |
| `website/src/data/site-facts.json` | **构建产物**（由上面两个文件生成），不再是手工编辑对象 |
| `website/src/lib/repository.ts` | `SiteFacts` 接口扩展：`CertificationFact`、`HonorFact`、公司联系方式与产品范围字段 |
| `website/src/lib/media.ts` | **新增**：图片访问层（产品图映射 + 手册图清单），页面不再手写图片路径 |
| `website/src/data/product-images.json` | **新增（生成）**：`product_id → /assets/products/...`，394 条 |
| `website/src/data/site-media.json` | **新增（生成）**：公司/工厂/证书图片清单（含 alt、caption、手册页码、sha256） |
| `tools/p4-build-site-assets.mjs` | **新增**：唯一的图片入库入口（PDF 抽取 + 严格筛选 + 复制 + 生成 JSON + 自校验） |
| `tools/p4-live-check.mjs` | **新增**：页面实测脚本（70 项） |
| `website/tools/verify-prototype-data.mjs` | 修正一条**已过时**断言（见 §11.3） |
| `website/public/assets/**` | **新增**：413 个图片文件（394 产品 + 19 手册） |

---

## 2. 接入了多少个产品主图

**394 张**（18.1 MB），全部复制到 `website/public/assets/products/`。

选择规则（`tools/p4-build-site-assets.mjs`，可复核）：

```
data/processed/product-image-map.json
  → mapping_status === 'exact'  AND  is_primary_image === true  AND  product_id 非空
  → 且 product_id 必须在 website/src/data/products.json 中
```

| 口径 | 数量 |
| --- | --- |
| 候选可靠记录（exact + 主图） | 403 |
| 候选覆盖产品数 | 403 |
| 其中不在网站数据集、被跳过 | 9（属于已移出产品库的产品） |
| **实际写入产品图** | **394** |
| 占用空间 | 18.1 MB |

按网站分类：`thermostats 276`、`automotive-switches 74`、`temperature-sensors 41`、`related-cooling-parts 3`。

命名规则：`<product_id 小写>.<ext>`（如 `bw-3005.jpg`），保证路径稳定、可读、与产品一一对应。

---

## 3. 覆盖了多少个 website-visible 产品

**394 / 416 = 94.7%**

- 20 个 Prototype 重点产品：**20 / 20（100%）**
- 无可靠图片的产品：**22 个**，走简洁 fallback，不做任何猜测性绑定：
  - 21 个 thermostats，1 个 automotive-switches
  - `BW-2043, BW-3003-3, BW-3004-5, BW-3021-1, BW-3192, BW-3508, BW-3565-2, BW-3566, BW-3567, BW-3655-2, BW-3665, BW-3902, BW-3919, BW-3964, BW-31002, BW-32748-2, BW-33111, BW-33561, BW-33655, BW-35116, BW-36583, BW-403229`

alt 文本格式：`Bowen No. <bowen_no> — <product_name_en>`（例：`Bowen No. 3005 — Thermostat 3005`）。

---

## 4. 使用了多少张工厂图片

**13 张**，全部抽自宣传手册英文版内嵌原图（原生分辨率，非页面截图），位于 `website/public/assets/factory/`：

| 文件 | 手册页 | 手册图注（原样保留） | 原生尺寸 |
| --- | --- | --- | --- |
| `production-workshop.jpg` | P5 | Production workshop with defined aisles and workstations | 2300×1113 |
| `machining-workshop.jpg` | P5 | Machining workshop | 2040×1350 |
| `component-assembly-workshop.jpg` | P5 | Component assembly workshop | 2040×1350 |
| `automatic-assembly-area.jpg` | P6 | Automatic assembly area | 2300×1065 |
| `automatic-assembly-machine-20-series.jpg` | P6 | 20 series automatic assembly machine | 2040×1290 |
| `automatic-assembly-machine-211-series.jpg` | P6 | 211 series automatic assembly machine | 2040×1290 |
| `cnc-machining-equipment.jpg` | P7 | CNC machining equipment | 2040×1410 |
| `automatic-assembly-machine-24-series.jpg` | P7 | 24 series automatic assembly machine | 2040×1410 |
| `rubber-plug-assembly-machine.jpg` | P7 | Rubber plug automatic assembly machine | 2040×1410 |
| `automatic-riveting-machine.jpg` | P7 | Automatic riveting machine | 2040×1410 |
| `sensing-element-test-machine-211-series.jpg` | P8 | 211 series sensing element adjustment and testing machine | 2300×1015 |
| `sensing-element-test-machine-20-24-series.jpg` | P8 | 20 and 24 series sensing element adjustment and testing machine | 2040×1410 |
| `thermostat-life-test-bench.jpg` | P8 | Thermostat life test bench | 2040×1410 |

**每一张都实地打开原图与手册图注核对过内容**（例如 P7 的 4 张依次为数控车床 / 24 系列自动装配机 / 胶塞自动装配机 / 自动铆接机），并按手册的 XObject 顺序与渲染页版面顺序交叉确认，未凭文件名猜测。

> 说明：`cnc-machining-equipment.jpg` 原图上可见设备铭牌字串，但**页面文案不写任何设备型号**（见 §10）。

---

## 5. 使用了多少张公司图片

**2 张**，位于 `website/public/assets/company/`：

| 文件 | 手册页 | 手册图注 | 原生尺寸 |
| --- | --- | --- | --- |
| `factory-buildings.jpg` | P3 | Factory buildings at the Bowen manufacturing site | 2300×869 |
| `assembly-workshop.jpg` | P11 | Assembly workshop at the Bowen factory | 2300×869 |

用于 Home（厂区图）、About（厂区 + 装配车间）。Home 的 Factory 区另复用 4 张 `factory/` 车间照片。

---

## 6. 使用了多少张证书图片

**4 张**，位于 `website/public/assets/certificates/`：

| 文件 | 手册页 | 内容 | 原生尺寸 |
| --- | --- | --- | --- |
| `iatf-16949-certificate.jpg` | P12 | IATF 16949:2016 证书原件（NQA） | 1059×1500 |
| `high-tech-enterprise-certificate.jpg` | P13 | 高新技术企业证书 | 1992×1344 |
| `work-safety-standardization-certificate.jpg` | P13 | 安全生产标准化证书 | 898×1280 |
| `innovative-sme-2026-public-list.jpg` | P13 | 山东省 2026 年度创新型中小企业公示 | 2395×520 |

**ISO 14001 / ISO 45001 没有证书图片可用**：手册正文（P12）给出了这两张证书的编号与有效期，
但**没有附证书图片**。因此 Quality 页对这两项只展示文字数据、**不显示证书图**，
也没有拿 IATF 证书图或其他证书顶替。

**合计手册图：19 张（4.5 MB）**，公司 2 + 工厂 13 + 证书 4。

---

## 7. 哪些公司资料来自宣传手册（逐条标注来源）

全部写入 `tools/config/product-types.mjs → COMPANY_FACTS / CERTIFICATIONS_DETAIL / HONORS`，
经 `build-product-db-v2.mjs` 生成到 `website/src/data/site-facts.json`。

### 7.1 主体与联系方式（手册 P3 / 封底 P14）

| 项目 | 值 | 来源 |
| --- | --- | --- |
| 英文全称 | Qufu Bowen Auto Parts Manufacturing Co., Ltd. | 英文版 P3、P14 |
| 中文名称 | 曲阜市博文汽车零部件有限公司 | 中文版 P1、P3、P14 |
| 邮箱 | qfbowen@126.com | 英文版 P14、中文版 P14 |
| 电话（手册原样） | 18653750690 | 英文版 P14、中文版 P14 |
| 电话（展示格式） | +86 186 5375 0690 | 同一号码的标准国际写法，**未改变号码本身** |
| 国内平台 | bowen18653750690.1688.com | 英文版 P14、中文版 P14 |

### 7.2 规模与历史（手册 P3 / P9）

| 项目 | 值 | 来源 |
| --- | --- | --- |
| 成立年份 | 2009 | P3「Established in 2009」/「成立于 2009 年」 |
| 建厂 / 扩大规模 | 2014 | P3 |
| 公司占地总面积 | 10,000+ m² | P3 |
| 生产车间面积 | 3,500 m² | P3 |
| 恒温车间面积 | 超过 2,000 m² | P3、P5 |
| 生产设备数量 | 100+ 台 | P3、P7 |
| 自主研发项目 | 29 | P9 |
| 专利 | 16 | P9 |
| 软件著作权 | 5 | P9 |

### 7.3 产品范围（手册 P4）

Thermostats、Temperature Sensors、Oil Pressure Warning Switches、Thermal Switches、
Reversing Light Switches、Brake Light Switches。

> V1 网站分类**仍然只有 Thermostat 一个正式品类**。手册里的「Thermostat assembly」只作为来源词汇，
> 未新建类目或筛选项（`verify-category-copy.mjs` 12 项守卫全部通过）。

### 7.4 管理体系认证（手册 P12 + 证书原图）

| 项目 | 值 | 来源 |
| --- | --- | --- |
| IATF 16949:2016 | 认证机构 NQA；IATF 证书号 0513244；NQA 证书号 T184734；签发 25 April 2024；到期 24 April 2027 | **证书原图 IM69 逐字核对**，中文版 P12 文字层一致 |
| IATF 范围 | Manufacture of thermostats | 同上 |
| IATF 排除条款 | Clause 8.3 product design is excluded from the certification scope | 同上，**原样保留，未省略、未改写** |
| ISO 14001:2015 | 证书号 05325E31120R0S；范围：与节温器加工相关的环境管理活动；2025-07-10 → 2028-07-09；须持续监督 | 英文版 P12 与中文版 P12 文字层**分别提取、互相印证** |
| ISO 45001:2018 | 证书号 05325S31042R0S；范围：与节温器加工相关的职业健康安全管理活动；同上有效期 | 同上 |

> 按任务要求，ISO 两项"必须重新从证书图片或 PDF 核对后再写入"。
> 手册**没有**这两张证书的图片，因此核对方式是：从英文版与中文版 PDF 的文本层**各跑一次提取**，
> 两份独立结果对编号、范围、起止日期完全一致后才写入。两版文字层记录见
> `data/derived/_brochure-en.txt` / `_brochure-zh.txt`（前序任务产物，本阶段只读）。
> 因缺证书图片，页面**不展示**这两张的图片。

### 7.5 资质与荣誉（手册 P13，编号读自证书图片）

| 项目 | 编号 | 日期 / 有效期 | 来源 |
| --- | --- | --- | --- |
| High-tech Enterprise Certificate 高新技术企业证书 | GR202537000055 | 签发 2025-12-08；有效期三年 | 手册 P13 证书原图 IM72 |
| Work Safety Standardization Certificate 安全生产标准化证书 | 曲AQB XW 20250005 | 签发 2025-07；有效期至 2028-07 | 手册 P13 证书原图 IM73 |
| 山东省 2026 年度创新型中小企业公示 | 名单第 3380 项 | 公示 2026-06-04 | 手册 P13 公示截图 IM74 |

> ⚠️ 这三项的**编号在手册文字层里没有**（前序 `docs/company-info-from-brochure.md` §5 因此记为"手册未载"），
> 只在证书**图片**上可见。本阶段把图片按原生分辨率抽出后逐字读取，
> 因此这批编号的来源是"证书图片"，比文字层更权威，已在 `HONORS[].evidence` 中注明。

---

## 8. 哪些内容因为证据不足而没有使用

| 内容 | 为什么没用 |
| --- | --- |
| **街道地址** | 手册封底（P14）只有网址/邮箱/电话三项，无地址栏。**见 §12.1：IATF 证书图上有地址，但按业务方明确指示未发布**。页面上不显示任何地址，也没有"地址待补"占位 |
| 产能数字（件/年、件/月、日产量） | 手册未载；业务方明确"先不做了"。**已删除整块模块** |
| 标准交期 | 手册未载；同上。**已删除整块模块** |
| MOQ / 付款方式 / 贸易条款 | 手册未载 |
| 员工人数 / 注册资本 / 出口国家清单 / 客户名单 | 手册未载（About 页原来那一段"待补"占位块已删除） |
| 设备型号（如机身上的 VMC-L855H、TK-400P 字样） | 未核实，**页面文案一个字都不写**；照片本身是真实照片，保留原样 |
| 第二个邮箱（原 `quality@bowen-thermostat.com`） | 手册只有一个邮箱。技术/质量卡片统一使用 `qfbowen@126.com`，未虚构第二个信箱 |
| WhatsApp / WeChat / 营业时间 / 地图坐标 / 海外分公司 / 销售办公室 | 手册未载，任务明确禁止。实测确认页面均未出现 |
| "行业领先 / 全球第一 / 顶级供应商 / 最先进 / 全球客户覆盖数量" | 无证据，未使用；实测确认未出现 |
| "通常在 1 个工作日内回复" | 属于无法核实的宣传承诺，已从 Home / RFQ / Contact 移除 |
| 2026 重排版手册的任何内容 | 该 PDF 内容流无法解码（前序已确认），本阶段同样未能提取，故不引用 |

### 8.1 旧站（qfbowen.com）素材：一条都没用

任务只允许使用 `reuse_status = auto_match` 的旧站素材。而 `data/legacy-site/assets.json` 中，
**工厂 / 公司 / 证书类素材全部是 `review_required` 或 `not_recommended`，没有一条 `auto_match`**：

| 旧站类目 | 条数 | reuse_status 分布 | 结论 |
| --- | --- | --- | --- |
| factory | 10 | review_required 9、not_recommended 1 | 全部不可用 |
| company | 9 | review_required 2、not_recommended 7 | 全部不可用 |
| certificate | 7 | review_required 6、not_recommended 1 | 全部不可用 |
| contact | 2 | 不可用 | 全部不可用 |

因此工厂/公司/证书图片**只**来自宣传手册 PDF（公司资料的主要证据源），
这也正好满足"旧官网内容只能作为补充资料，不能覆盖宣传手册中的正式信息"。

---

## 9. 哪些 review_required 内容被明确跳过

本阶段**没有**把任何 `review_required` / `unresolved` / `draft` / `blocked` 数据改成已确认。

| 被跳过对象 | 数量 | 处理 |
| --- | --- | --- |
| 产品图 `mapping_status = review_required` | 21 条记录 | 不接入 |
| 产品图 `mapping_status = unresolved` | 5 条记录 | 不接入 |
| 非主图记录（`is_primary_image = false`） | 395 条 | 不接入（每个产品只用 1 张主图） |
| 业务方决定排除的图片（`business_excluded`） | 4 条 | 不接入 |
| `data/legacy-site/product-image-reconciliation.json` 中 `reuse_status = review_required` | 34 条（清洗后） | 不接入 |
| 旧站 `not_recommended` 素材（模板装饰/图标/Banner/二维码） | 29 条 | 不接入 |
| `data/processed/product-image-review/` 整包（待人工确认） | 26 个文件 | 完全未使用 |
| 22 个无可靠主图的网站产品 | 22 | 页面走简洁 fallback（工程图），**不绑定任何猜测图片** |
| 5 个 `draft` 产品、（当前 0 个）`blocked` 产品 | 5 / 0 | 未进入网站数据集（自动化断言覆盖） |

自动复核结果（`node tools/p4-build-site-assets.mjs --verify`）：

```
指向 data/ 目录的资源: 0（必须为 0）
review_required / 非网站产品泄漏: 0（必须为 0）
```

---

## 10. 是否删除了产能和标准交期模块

**是，已删除。**

| 位置 | 改动 |
| --- | --- |
| Factory 页 | 整块「Capacity & lead time / What we publish now — and what we do not」章节（含 Annual thermostat production capacity、Standard lead time by product family、Minimum order quantity、Packaging and container loading specification 四项占位清单）**整体删除**；替换为一个「Equipment on this page」说明块，只讲页面上的设备来自公司自有的公司简介、不含图库图 |
| Home 页 | 未出现产能/交期  
| About 页 | 未出现产能/交期 |
| 全站 | 未出现 `Annual Capacity` / `Standard Lead Time` 等待填写模块 |

实测断言（`tools/p4-live-check.mjs` 第 6 节）对 Home / Factory / About 三页扫描
`Annual capacity|Standard lead time|annual (production )?capacity|标准交期|年产能|日产量|月产量|MOQ|Minimum order quantity`，**三页全部 0 命中**。

> 说明：刻意**没有**写"我们不公布产能"这类解释性段落 —— 按任务原则"资料没有提供的就省略"，
> 避免又变成低质量占位文案。未核实的设备型号同样一个字都没写。

---

## 11. 所有测试及实际结果

### 11.1 任务要求的验收命令

| 命令 | 结果 |
| --- | --- |
| `node tools/verify-product-db-v2.mjs` | ✅ **PASS 69 / FAIL 0** —「全部 69 项通过。自动猜 product_type = 0」 |
| `node website/tools/verify-prototype-data.mjs` | ✅ **PASS 36 / FAIL 0** —「Phase 3 原型数据全部通过」 |
| `node website/tools/find-overflow.mjs` | ✅ 10 条路由 × 390px **横向溢出全部 0px**（见 11.2） |
| `pnpm exec tsc --noEmit` | ✅ exit 0，无输出 |
| `pnpm build` | ✅ exit 0，`Generating static pages (428/428)` |

### 11.2 移动端溢出实测（390px，`website/tools/find-overflow.mjs`）

| 路由 | 文档 scrollWidth | 横向溢出 | 结论 |
| --- | --- | --- | --- |
| `/` | 390px | 0px | ✅ |
| `/products` | 390px | 0px | ✅ |
| `/products/BW-3005` | 390px | 0px | ✅ |
| `/oe-search?q=25500-35540` | 390px | 0px | ✅ |
| `/oe-search?q=2550035540` | 390px | 0px | ✅ |
| `/factory` | 390px | 0px | ✅ |
| `/quality` | 390px | 0px | ✅ |
| `/about` | 390px | 0px | ✅ |
| `/contact` | 390px | 0px | ✅ |
| `/rfq?product=BW-3005` | 390px | 0px | ✅ |

### 11.3 附加回归（本阶段新增 / 修正）

| 命令 | 结果 |
| --- | --- |
| `node tools/p4-live-check.mjs`（**新增**，页面实测 70 项） | ✅ **PASS 70 / FAIL 0** |
| `node tools/p4-build-site-assets.mjs --verify`（**新增**） | ✅ 资产与 JSON 映射一致；0 个指向 `data/`；0 个越界产品 |
| `node website/tools/verify-category-copy.mjs` | ✅ **PASS 12 / FAIL 0** |
| `node website/tools/verify-rfq-e2e.mjs` | ✅ **PASS 31 / FAIL 0**（表单 → payload 端到端，`item.product_id = BW-3005`，含 matched_oe / vehicle / engine） |

`p4-live-check.mjs` 覆盖：10 条路由可达性、30 个被引用图片全部 200 + `image/*`、
旧占位邮箱 0 残留、正式名称/邮箱/电话到位、6 类编造信息未出现、
Factory 无产能/交期、Quality 证书 11 项字段与证书原件一致、About 无占位块、
BW-3005 图片与产品对应且 alt 正确、OE 两种写法结果一致、RFQ 上下文保留、1688 标注正确。

### 11.4 修正了一条已过时的断言（`website/tools/verify-prototype-data.mjs`）

**原断言**：

```js
check('完整数据库里有 blocked 产品，但一个都没进网站数据集', () => {
  const blockedCount = fullProducts.filter((p) => p.status === 'blocked').length;
  const leaked = products.filter((p) => p.status === 'blocked' || p.blocked);
  return blockedCount > 0 && leaked.length === 0 ? ... : `blocked=${blockedCount} leaked=${leaked.length}`;
});
```

**失败原因（已核实，与本阶段改动无关）**：`data/derived/v2/products.json` 当前是
`426 个产品 = searchable_noindex 401 + prototype_candidate 20 + draft 5`，**blocked = 0**。
即断言的**前提**（"全量库里存在 blocked 产品"）已经因为前序数据变更而不成立，
而不是网站数据集发生了泄漏。实测 `leaked = 0`。

**修正方式**（不是删除有效检查）：

- 把过时的前提从"必须有 blocked"泛化为"**全量库里必须存在至少一种不可发布状态**（blocked 或 draft）"，
  这样守卫仍然有实际约束力 —— 当前由 `draft = 5` 真实行使；
- **保留并加强**泄漏检查：`blocked` 与 `draft` **两个都查**（原来只查 blocked）；
- 若全量库里两种状态都不存在，直接报「守卫已失去约束力，请检查数据构建」，而不是静默通过。

修正后：`PASS 完整数据库里的不可发布状态（blocked / draft）一个都没进网站数据集 — 全量库 blocked=0 draft=5，网站数据集 0 泄漏`。

---

## 12. 仍然存在的已知问题

### 12.1 ⚠️ IATF 证书原件上有一个街道地址，本阶段按指示未发布（**请业务方决策**）

> **✅ Phase 4.1 已决策并实施（2026）**：业务方确认该地址**可以对外公开**。
> 现已在 `tools/config/product-types.mjs → COMPANY_FACTS.address_en / postal_code / country`
> 写入该地址，并由 Contact 页与页脚展示；本节下面「不发布该地址」的记录保留为当时的历史决策。
> 实施与验收见 `docs/phase-4.1-publication-gate-and-content-cleanup.md`。

本阶段把证书按原生分辨率（1059×1500）抽出后发现，IATF 证书上**清晰可读**地写着：

```
Qufu Bowen Auto Parts Manufacturing Co., Ltd.
No. 3, Duzhi Road, Qufu Electronic Information Industrial Park,
Jining City, Shandong Province, 273100, China
(IATF USI: CCHE25)
```

这与"宣传手册没有提供可确认的街道地址"的前提**不完全一致**：手册的**封底文字**确实没有地址，
但**证书图片**上有。

**本阶段的处理：不发布该地址。** 理由：

1. 任务边界明确要求"不得猜测地址""不要显示不存在的街道地址"，且 Contact 页的交付清单只列了公司名/邮箱/电话；
2. 证书地址是**认证注册地址**，是否等于当前实际经营/收发货地址，需要业务方确认；
3. 宁可留空，也不要把一个未经业务确认的地址放上外贸站。

**建议**：请业务方确认该地址是否可作为对外公布地址。确认后只需在
`tools/config/product-types.mjs → COMPANY_FACTS` 增加字段并在 Contact/Footer 展示即可（单一来源）。

### 12.2 `site-facts.json` 是构建产物，改它会被覆盖（**重要，已修复并留档**）

排查过程中发现两个相互叠加的既有机制：

1. `website/tools/verify-product-db-v2.mjs` 第 15 行 `import { oeSearchKey } from './build-product-db-v2.mjs'`，
   而 `build-product-db-v2.mjs` **没有 `main()` 守卫**，模块顶层直接跑完整构建 ——
   于是"跑一次校验"就会**顺带重建** `data/derived/v2/*` 与 `website/src/data/*.json`。
2. `site-facts.json` 由 `build-product-db-v2.mjs` 写出，因此**手工编辑该 JSON 会在下次校验/构建时被静默覆盖**。

本阶段确实踩到了这个坑：我先直接编辑了 `site-facts.json`，随后执行任务要求的
`node tools/verify-product-db-v2.mjs` 时被重新生成、公司字段全部丢失，`pnpm build` 随之中断在
首页预渲染（`Cannot read properties of undefined (reading 'map')`）。

**已修复**：把公司资料搬进**唯一权威来源** `tools/config/product-types.mjs`
（`COMPANY_FACTS` / `CERTIFICATIONS_DETAIL` / `HONORS`），由 `build-product-db-v2.mjs` 生成
`site-facts.json`；并重建验证通过。**建议后续把公司资料改动指向 `tools/config/product-types.mjs`，不要直接改 `site-facts.json`。**

> 附带说明：`data/derived/v2/*` 与 `website/src/data/{products,applications,oe-index}.json`
> 因此也被重建。这些文件在本阶段接手时**已经是未提交修改状态**；重建是**确定性**的
> （构建脚本自校验 `原始 Excel SHA-256 运行后一致：true`，原始 Excel 未被改动），
> 除时间戳外内容与前序状态一致。

### 12.3 其余已知问题

| # | 问题 | 影响 | 状态 |
| --- | --- | --- | --- |
| 1 | 22 个网站可见产品无可靠主图 | 这些产品页/卡片显示工程图 fallback | 按规则保留，等业务方补图 |
| 2 | ISO 14001 / ISO 45001 无证书图片 | Quality 页这两项只有文字数据 | 手册未附；需业务方提供证书扫描件 |
| 3 | IATF 证书 EXIF/清晰度 | 已足够逐字核对；页面按 `object-fit: contain` 展示，移动端可读性一般 | 可接受 |
| 4 | 21 + 5 条 `review_required` / `unresolved` 产品图 | 未接入 | 按任务要求留给后续业务人员 |
| 5 | `/blog` 仍是占位页（"still needed before this section goes live"） | 不在本阶段 7 个页面范围内 | 未改动，留待后续 |
| 6 | 全部页面 `noindex` | 原型阶段策略 | **按任务要求未取消** |
| 7 | RFQ 表单字段仍叫 `WhatsApp / Phone` | 这是**访客自己的**联系方式字段（payload 契约），不是把公司电话标成 WhatsApp | 未改动（`verify-rfq-e2e` 依赖该字段名） |
| 8 | `git` 不可用 | 无法用原生 git 提交/对比 | 用 `tools/_dsh-git-status.mjs` 等价替代；正式提交仍需在有 git 的环境执行 |
| 9 | `pnpm` 在受限沙箱下 `spawn EPERM` | 不影响产物 | 已在本轮放开沙箱后按原命令补跑通过 |

---

## 13. 图片覆盖统计（一页汇总）

| 类别 | 数量 | 目录 | 来源 |
| --- | --- | --- | --- |
| 产品主图 | **394** | `website/public/assets/products/` | `data/processed/product-image-map.json`（exact + 主图） |
| 工厂图片 | **13** | `website/public/assets/factory/` | 宣传手册英文版 P5–P8 内嵌原图 |
| 公司图片 | **2** | `website/public/assets/company/` | 宣传手册英文版 P3、P11 |
| 证书图片 | **4** | `website/public/assets/certificates/` | 宣传手册英文版 P12、P13 |
| **合计** | **413** | `website/public/assets/` | — |

- 覆盖 website-visible 产品：**394 / 416 = 94.7%**（Prototype 20/20 = 100%）
- 总占用：约 **22.6 MB**
- 页面运行时**零依赖** `data/` 目录（自动校验强制为 0）

---

## 14. 是否可以进入下一阶段

**可以进入下一阶段（在业务方确认 §12.1 地址问题后）。**

已具备的条件：

- 公司资料已由单一权威来源驱动（`tools/config/product-types.mjs`），页头/页脚/Contact/About/Home/Factory/Quality 共享同一份数据，无重复硬编码；
- 413 张真实图片已进入 `website/public/assets/`，产品图映射集中维护，页面不再手写路径；
- 18 项自动化验证全部通过（69 + 36 + 12 + 31 + 70 + 资产自校验），`tsc` 与 `pnpm build` 均 exit 0，428 页静态生成成功；
- 10 条验收路由在桌面端与 390px 移动端均无横向溢出，图片全部可加载且对应正确；
- 产能 / 标准交期模块已删除，低质量占位文案已清除，编造内容实测为 0。

进入下一阶段前需要业务方决策的一项：**IATF 证书注册地址是否对外公布（§12.1）**。

按任务要求，**本阶段到此停止**：未进行部署、未做 SEO 上线、未接邮件后端、未接 Supabase、未取消 noindex。
