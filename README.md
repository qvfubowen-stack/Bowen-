# 博文外贸独立站（Bowen B2B Website）

面向海外汽车零部件采购商的 B2B 独立站项目。

**当前进度：Phase 2.5（产品数据库重建）+ Phase 3（网站 UI Prototype）+ Phase 3.5（旧站资产迁移审计）已完成，等待业务方验收。**
**网站原型可本地启动，尚未正式上线，未绑定域名，未接入 Supabase。**

---

## 〇、Phase 3.5：旧站资产迁移审计（最新）

已审计公司现有国内站 `www.qfbowen.com`，抽取**可复用的真实素材**。

> ### 📄 [`docs/qfbowen-legacy-site-audit.md`](docs/qfbowen-legacy-site-audit.md)
> **主报告**：逐条回答需求书的 12 个问题（抓了多少页、多少图、匹配了多少产品、哪些能用、哪些不能用……）。
>
> ### 📊 [`review/legacy-product-image-mapping.xlsx`](review/legacy-product-image-mapping.xlsx)
> **需要业务方填写的确认表**：520 张产品图因旧站页面没写编号，必须人工对应产品。

| 结论 | 数字 |
|---|---|
| 抓取旧站公开页面 | **943 个**（站内遍历完整，队列已排空） |
| 下载真实素材 | **870 张图片 / 64.7 MB** |
| 产品图 / 工厂图 / 证书图 / 公司图 | **783 / 9 / 6 / 2** |
| 有编号证据、可自动对应产品 | **274 张**（覆盖 223 个当前产品） |
| 需人工确认 | **520 张** |
| 旧站代码是否复用 | **不复用**（IIS + AspCms、无移动端、0 viewport、HTTPS 不可用） |

**本阶段的硬性边界（已遵守）**：不修改任何 Prototype 文件、不用旧站代码替换 Next.js、
不自动把中文内容上线、不绕验证码、不提交表单、无编号证据绝不自动绑定产品图。
验收测试 `tools/legacy/verify-legacy-audit.mjs` **60/60 PASS**。

---

## 一、先看这个

**只想看结论，按顺序读这 3 份：**

> ### 📦 [`delivery/prototype-info.txt`](delivery/prototype-info.txt)
> **一页纸说清**：版本、commit、用的哪个 Excel、怎么启动、访问地址、
> 演示用真实 OE 号、用了多少真实产品、完成了什么、哪些还是 placeholder。
>
> ### 📄 [`delivery/02_ui-prototype-report.md`](delivery/02_ui-prototype-report.md)
> **UI Prototype 报告**。逐条回答 12 个验收问题。
>
> ### 📄 [`delivery/01_database-v2-migration-report.md`](delivery/01_database-v2-migration-report.md)
> **数据库重建报告**。451 个产品是怎么从 962 条原始记录聚合出来的。

**完整交付包在 [`delivery/`](delivery/)：**

| 文件 | 内容 |
|---|---|
| [`01_database-v2-migration-report.md`](delivery/01_database-v2-migration-report.md) | 数据库重建报告（15 项统计） |
| [`02_ui-prototype-report.md`](delivery/02_ui-prototype-report.md) | UI Prototype 报告（12 项验收问答） |
| [`03_test-results.md`](delivery/03_test-results.md) | 测试结果（106 项断言逐条列明） |
| [`04_known-issues.md`](delivery/04_known-issues.md) | 已知问题 + 待业务方确认事项 |
| [`05_how-to-run.md`](delivery/05_how-to-run.md) | 运行指南（含常见问题） |
| [`prototype-info.txt`](delivery/prototype-info.txt) | 一页纸信息清单 |
| `screenshots/` | 6 张真实截图（Desktop + Mobile） |

**另有专项文档：**

| 文档 | 内容 |
|---|---|
| [`docs/excel-image-audit.md`](docs/excel-image-audit.md) | **Excel 嵌入图片审计**（Phase 2.6）：681 个图片文件 / 798 个对象，映射到 398 个产品 |
| [`docs/supabase-migration-boundary.md`](docs/supabase-migration-boundary.md) | **Supabase 接入边界**：说明"换实现类"之外还必须做的 8 项工作 |

---

## 二、30 秒启动网站

```bash
cd website
pnpm install --frozen-lockfile   # 首次（约 6 秒）
pnpm run dev                     # 一条命令启动
```

打开 **http://localhost:3000**

**环境要求（唯一推荐）**：Node.js **>= 18.18.0**，pnpm **>= 10.16.0（推荐 10.34.5）**。
版本已由 `website/package.json` 的 `packageManager` 字段 + `.npmrc` 的
`engine-strict=true` 强制，装错版本会直接报错。

> 本机没有 pnpm？`corepack enable`（Node 自带，会按 `packageManager` 自动拉取）。
> 原开发机没有全局 npm 时的备选：`npm run dev` 或 `node tools/npm-run.mjs dev`
> （兼容层，**不支持 `npm install`**）。

**马上试这几个真实 OE 号**（在首页搜索框输入）：

| OE Number | 命中 Bowen No. |
|---|---|
| `25500-35540` | 3503 / 3004-5 / 3004-3 |
| `2550035540` | 3503 / 3004-5 / 3004-3（与上面结果相同，演示忽略短横线） |
| `4711306950` | 3005（85 个 OE 的产品） |
| `056121113D` | 3001 |

---

## 三、现在的状态（一句话）

| 项目 | 数量 |
|---|---|
| 原始记录 | **962** 条 |
| 聚合产品 | **451** 个 |
| Product Applications | **802** 条 |
| OE 搜索索引 | **3,024** 条（去重后 2,242 个标准化 OE） |
| 网站可展示产品 | **378** 个（全部真实数据） |
| 首页重点展示（Prototype 候选） | **20** 个 |
| 产品类型已由人工确定 | **381** 个 |
| 产品类型待人工确认 | **70** 个 |
| 被阻断（字段错位，不外露） | **23** 个 |
| **自动猜 product_type** | **0** |
| 已发布（`published`） | **0**（本阶段禁止上线） |

**验收测试：数据库 65/65 PASS，网站数据 36/36 PASS，响应式 5/5 PASS。**

---

## 四、产品数据库结构（两层）

```
Products (451)
  └── Product Applications (802)      一条 Excel 记录 = 一条 application
        └── OE Search Index (3024)    从 application 的 OE 单元格逐 token 展开
```

**关键设计**：最新版 Excel 在 OE 单元格和车型单元格里各放多个值，
两者数量几乎从不相等（例如 Bowen 3005 有 13 个 OE、10 个车型名）。
所以**不存在**行级的 OE↔Engine 一一对应关系。

程序的做法是：**一条 Excel 记录 = 一条 application**，
同时保留该行的 **OE 整格原文** 与 **车型/发动机整格原文**，
再把 OE 逐 token 展开成搜索索引指回原 application。

这样既能让 OE 逐个搜索，又**不会编造任何 Excel 里不存在的配对关系**。

---

## 五、产品类型是怎么定的（本阶段最关键的部分）

**产品类型只认人工标注，程序一次都没猜过。**

| 来源 | 产品数 | 含义 |
|---|---|---|
| `human_section_label` | 365 | 业务方在《综合产品信息表》里写下的 7 个区段标签（按行向下连续适用） |
| `human_review_confirmed` | 3 | 业务方在 Phase 2 审核表里逐行手填的确认值 |
| `inherited_from_bowen` | 13 | 变体编号继承其基础编号的分类 |
| `review_required` | 70 | 无人工证据，留空等确认 |
| **合计** | **451** | |

识别到的 7 个人工区段标签：

| 标签 | 位置 | 行范围 | 归一化类型 |
|---|---|---|---|
| 节温器 | A3 | 4–138 | Thermostat |
| 冷却水管 | B139 | 140–141 | Related Cooling Part |
| 温度传感器 | B142 | 143–163 | Temperature Sensor |
| 机油压力报警器 | B164 | 165–183 | Oil Pressure Warning Switch |
| 热敏开关 | B184 | 185–186 | Thermal Switch |
| 刹车灯开关 | B187 | 188–196 | Brake Light Switch |
| 倒车灯开关 | B197 | 198–206 | Reverse Light Switch |

按业务规则，**Automotive Thermostat / Thermostat / Thermostat Insert /
Thermostat Assembly 全部统一为 `Thermostat`**，`product_subtype = null`
且不阻止产品上线。业务方手填的原始写法保留在 `product_type_raw_labels`
（未来要做 subtype 时有据可依）。

---

## 六、项目文件说明

```
B2B外贸独立站/
├── delivery/                       ⭐ 交付包（报告 / 截图 / 说明书）
├── website/                        ⭐ 网站源码（Next.js 15 + TypeScript）
│   ├── package.json                一条命令启动的入口
│   ├── npm.cmd                     npm 兼容层（本机没装 npm 时用）
│   ├── src/app/                    页面（10 个页面 + 404）
│   ├── src/components/             15 个组件（各自带 CSS Module）
│   ├── src/lib/
│   │   ├── db.ts                   ★ 唯一数据入口（未来换 Supabase 只改这里）
│   │   ├── types.ts                领域类型
│   │   └── engine-code.ts          从原文提取发动机代号（纯字符串规则）
│   ├── src/data/                   网站数据（由构建脚本生成，勿手改）
│   └── tools/                      测试与截图工具
│
├── docs/
│   ├── ui-prototype-report.md      Phase 3 报告（简版）
│   ├── database-v2-migration-report.md  Phase 2.5 报告
│   ├── product-database-report.md  Phase 1 报告（历史）
│   └── _source/                    中间产物与提交信息留档
│
├── review/                         ⭐ 需要人工处理的 Excel
│   ├── product-type-unconfirmed.xlsx    70 个类型待确认（带下拉菜单）
│   ├── shared-oe-across-products.xlsx   125 个共享 OE（供以后核对）
│   ├── row-misalignment-v2.xlsx         18 条错位待复核
│   ├── first-batch-business-review.xlsx Phase 2 审核表（业务方已填 3 行）
│   └── _archive_phase2-csv/             上一版 CSV（已取代，仅留档）
│
├── data/
│   ├── raw/                        ⚠️ 原始资料，只读，永不修改
│   │   ├── 产品信息表1(1).xlsx          ⭐ 当前 Source of Truth（SHA-256 冻结）
│   │   ├── 产品信息表1_英文版.xlsx      历史版本，仅作追溯
│   │   ├── SOURCE-MANIFEST.json        冻结清单
│   │   └── review-overrides-v2.json    业务方人工确认值
│   └── derived/v2/                 ✅ 重建后的数据库（可重新生成）
│       ├── products.json               451 个产品
│       ├── product-applications.json   802 条 application
│       ├── product-oe-search-index.json 3,024 条 OE 索引
│       ├── staging-records.json        962 条原始记录（含 blocked 与全部错位痕迹）
│       ├── shared-oe-across-products.json
│       ├── section-labels.json         识别到的 7 个人工区段标签
│       └── stats.json                  全部统计数字
│
├── data/processed/                 ✅ Phase 2.6：Excel 嵌入图片
│   ├── product-images/                 798 个图片文件（66.5 MB）
│   └── product-image-map.json          图片 → 工作表 → 行 → Bowen No. 映射
│
├── data/legacy-site/               ✅ Phase 3.5：旧站 www.qfbowen.com 抓取与素材
│   ├── crawl/                         943 个页面的 HTML + pages.json + probes.json
│   ├── images/{products,factory,certificates,company,other}/  870 张实拍素材
│   ├── documents/                     旧站无任何 PDF/文档（0 个）
│   ├── legacy-products.json           旧站产品页规格表解析结果（552 页有博文编号）
│   ├── product-image-matching.json    图片 → Bowen No. → product_id 匹配结论 + 证据链
│   ├── assets.json                    ⭐ 需求书要求的资产清单（875 条）
│   ├── downloads.json                 每个文件的下载结果 / 尺寸 / SHA-256
│   ├── legacy-site-audit.json         技术审计 + 内容审核 + 映射建议 + 多语言规划
│   └── phase-state.json               阶段起始时间戳（用于证明未改动 Prototype）
│
├── tools/legacy/                   ✅ Phase 3.5：旧站审计工具链（纯 Node.js，零依赖）
│   ├── lib/{http,html,classify,media,match}.mjs   抓取/解析/分类/匹配规则
│   ├── crawl-legacy-site.mjs       A：抓取公开页面（支持断点续抓）
│   ├── download-legacy-assets.mjs  B：下载公开素材（本地复用缓存）
│   ├── build-legacy-asset-manifest.mjs  C：生成 assets.json
│   ├── extract-legacy-products.mjs      D 前置：解析产品规格表
│   ├── match-legacy-product-images.mjs  D：匹配 + 生成人工审核 XLSX
│   ├── audit-legacy-site.mjs       E/F/G/H：综合审计
│   ├── build-legacy-audit-report.mjs    I：生成报告
│   └── verify-legacy-audit.mjs     ⭐ 60 项验收测试
│
├── tools/                          数据处理工具链（纯 Node.js，零第三方依赖）
│   ├── build-product-db-v2.mjs     ⭐ 数据库重建程序
│   ├── verify-product-db-v2.mjs    ⭐ 65 项验收测试
│   ├── extract-product-images.mjs  ⭐ Excel 嵌入图片提取（读 OOXML 绘图层）
│   ├── verify-product-images.mjs   ⭐ 39 项图片映射验收测试
│   ├── build-review-lists-v2.mjs   生成 3 个人工参考 Excel
│   ├── config/product-types.mjs    ⭐ 产品类型词典 + 全部人工裁决点
│   ├── lib/v2-layout.mjs           Excel 版式识别
│   ├── lib/xlsx-writer.mjs         自研 XLSX 写出器
│   ├── xlsx-reader.mjs             自研 XLSX 读取器
│   └── audit/                      审计与诊断脚本
│
├── 博文外贸独立站规划_V1.docx        Source of Truth（产品需求 + 业务规则）
└── 宣传手册最终PDF/                 公司宣传册（中/英/日/重排版）
```

**只读 vs 可重新生成**：
- `data/raw/` 是**原始资料**，程序绝不写入，靠 SHA-256 校验保护。
- `data/derived/`、`website/src/data/`、`review/` 是**派生产物**，随时可重新生成。

---

## 七、如何重新运行数据管线

需要 Node.js（本项目用 v24.9.0 验证）。

```bash
# 1) 从原始 Excel 重建数据库与网站数据集
node tools/build-product-db-v2.mjs

# 2) 数据库验收测试（65 项，含 SHA-256 校验）
node tools/verify-product-db-v2.mjs

# 3) 提取 Excel 嵌入图片并建立映射（Phase 2.6）
#    图片二进制不入 Git，全新 clone 需先跑这一步（约 30 秒）
node tools/extract-product-images.mjs
node tools/verify-product-images.mjs   # 39 项验收测试

# 4) 生成人工参考 Excel
node tools/build-review-lists-v2.mjs

# 5) 网站数据集验收测试（36 项）
cd website && node tools/verify-prototype-data.mjs

# 6) 分类模型与文案守卫（12 项）
node tools/verify-category-copy.mjs

# 7) RFQ 表单 → payload 端到端（31 项，自动起临时服务器）
node tools/verify-rfq-e2e.mjs

# 8) Phase 3.5：旧站资产迁移审计（需联网访问 www.qfbowen.com）
#    只抓公开页面；旧站较慢，完整抓取约 20 分钟。已有结果时可用 BOWEN_CRAWL_RESUME=1 续抓。
node tools/legacy/crawl-legacy-site.mjs            # A 抓取 943 个公开页面
node tools/legacy/download-legacy-assets.mjs       # B 下载 870 张素材
node tools/legacy/extract-legacy-products.mjs      # 解析产品规格表（博文编号 / OEM）
node tools/legacy/match-legacy-product-images.mjs  # D 匹配 + 生成 review/*.xlsx
node tools/legacy/build-legacy-asset-manifest.mjs  # C 生成 assets.json
node tools/legacy/audit-legacy-site.mjs            # E/F/G/H 综合审计
node tools/legacy/build-legacy-audit-report.mjs    # I 生成 docs/qfbowen-legacy-site-audit.md
node tools/legacy/verify-legacy-audit.mjs          # 60 项验收测试
```

**验证原始文件有没有被人改过**（最重要的一条）：

```bash
node tools/verify-product-db-v2.mjs
```

只要 TEST 1 那一组全部 PASS，就说明原始 Excel 一个字节都没被改动。

**想要逐字节完全可复现的结果**：

```bash
BOWEN_NOW="2026-09-25T09:00:00.000Z" node tools/build-product-db-v2.mjs
```

---

## 八、项目铁律（写在代码和测试里的约束）

1. **绝不修改原始资料**。`data/raw/` 下的 Excel、PDF 只读，SHA-256 冻结。
2. **绝不编造事实**。公司、产品、认证、客户、MOQ、产能、交期一律来自项目资料，
   或明确标记为待确认。页面上所有 placeholder 都显式标注。
3. **不确定的数据用状态标记，不猜**。`product_type` 只认人工标注，自动猜 = 0。
4. **用户人工标注优先于程序推断**。
5. **保留数据来源**。每条 application 都能追到工作表 + 行号。
6. **每个阶段必须先测试通过，再进入下一阶段**。
7. **每个重大阶段创建 Git commit**。

### 本阶段（Phase 2.5 + 3）的额外禁令 —— 全部遵守

| 禁令 | 状态 |
|---|---|
| 购买域名 / 绑定正式域名 | ❌ 未做 |
| 正式发布上线 | ❌ 未做 |
| 接入 Supabase | ❌ 未做 |
| 支付系统 / 购物车 / 用户注册 | ❌ 未做 |
| 批量生成 SEO 页面 | ❌ 未做（站点为 noindex） |
| 几百篇 AI Blog | ❌ 未做（Blog 仅框架） |
| 自动报价 | ❌ 未做 |
| 自动修改 Excel | ❌ 未做 |
| 删除 OE / 选择 Main OE | ❌ 未做 |
| 猜 product_type | ❌ 未做（实测 = 0） |

---

## 九、需要业务方处理的三件事

1. **填 [`review/product-type-unconfirmed.xlsx`](review/product-type-unconfirmed.xlsx)**
   —— 70 个产品类型待确认（带下拉菜单）
2. **确认字段错位的判定口径** —— 当前是「编号可读就不阻断」，
   如需从严（凡 Bowen 字段出现尺寸/温度一律 blocked），改一行重跑即可
   （详见 [`delivery/04_known-issues.md`](delivery/04_known-issues.md) 第 1.2 节）
3. **提供真实数据** —— 产品照片、公司注册信息与联系方式、证书编号与范围、
   产能/交期/MOQ/包装规范、真实邮箱地址
4. **填写 [`review/legacy-product-image-mapping.xlsx`](review/legacy-product-image-mapping.xlsx)**
   —— Phase 3.5：520 张来自旧站的产品图需要人工对应到 Bowen No.
   （旧站只有 552 个页面写了博文编号，其余页面没有任何编号信息，程序按铁律不猜）

`review/shared-oe-across-products.xlsx`（125 个共享 OE）供以后核对，**不阻塞**开发。

---

## 十、Git 版本管理

```bash
git log --oneline -5
```

> 本机没有全局安装 Git。项目使用的是便携版：
> `C:\Users\asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`

主要提交：

| Commit | 内容 |
|---|---|
| `Build Bowen B2B website UI prototype` | Phase 3：Next.js UI Prototype |
| `Rebuild product database with application-level OE mapping` | Phase 2.5：数据库重建 |
| `Phase 2 收尾：防止过时脚本误生成旧版审核文件` | Phase 2 收尾 |
| `Phase 2（调整后）：建立人工业务审核包` | Phase 2 |

---

## 十一、验收清单

- [x] 产品数据库重建为 Products + Applications 两层结构
- [x] OE 与 Engine 的行级关系完整保留（不拆成两个无关系数组）
- [x] 同一 Bowen 多 OE 不再视为冲突，无 Main OE 概念
- [x] 一个 OE 对多个 Bowen 全部保留 + 生成人工参考清单
- [x] blocked 数据隔离，保留原始来源，不进任何前台入口
- [x] 自动猜 product_type = 0
- [x] Thermostat 四种写法统一，subtype 不阻止上线
- [x] TEST 1–7 全部通过
- [x] OE 搜索支持忽略大小写/空格/短横线/斜线
- [x] OE 搜索结果带 Product + Matched Application 上下文
- [x] 首页 10 个 Screen
- [x] Products / Product Detail / OE Search / RFQ / Factory / Quality / About / Contact 完成
- [x] Blog 仅框架
- [x] 响应式 Desktop / Tablet / Mobile 无横向溢出
- [x] `npm run dev` 一条命令启动
- [x] **Phase 3.5**：旧站 943 个公开页面抓取完整（队列排空）
- [x] **Phase 3.5**：870 张真实素材下载并分类归档，保留原始 URL 与文件名
- [x] **Phase 3.5**：`assets.json` 资产清单（875 条，含需求书要求的 9 个字段）
- [x] **Phase 3.5**：274 张产品图有编号证据可自动匹配，520 张交人工确认
- [x] **Phase 3.5**：`review/legacy-product-image-mapping.xlsx` 人工审核表
- [x] **Phase 3.5**：技术审计 / 内容质量审核 / 公司素材映射建议 / 多语言规划
- [x] **Phase 3.5**：60/60 验收测试通过（含"未修改 Prototype"与"无证据不绑定"红线）
- [ ] **等待业务方验收**
