# 网站 UI Prototype 报告（Phase 3）

**项目版本：Bowen-Website-Prototype-V1**
**阶段：Phase 2.5（数据库重建）+ Phase 3（UI Prototype）**
**技术栈：Next.js 15.1.6 + React 19 + TypeScript 5.7（App Router）**
**Git commit：`4551b72`（Build Bowen B2B website UI prototype）／`9f5d193`（数据库重建）／`e12cc24`（交付整理）**
**当前状态：原型已完成，未上线，等待验收**

> 本报告按需求逐条回答 12 个问题。所有数字都可在项目里复现。
> 验收测试：数据库 **65 项 PASS**，网站数据 **36 项 PASS**，两项均为 0 FAIL。

---

## 1. 数据迁移是否通过

**通过。**

| 项目 | 结果 |
|---|---|
| 原始 Excel SHA-256（运行前 / 运行后 / 冻结值） | 三者一致 ✅ |
| 数据库验收测试 | **65 / 65 PASS** |
| 网站数据集验收测试 | **36 / 36 PASS** |
| 自动猜 product_type | **0** |
| blocked 数据进入网站 | **0 条** |

迁移结果：

| 指标 | 数量 |
|---|---|
| 原始记录 | 962 条 |
| 聚合产品 | 451 个 |
| Product Applications | 802 条 |
| OE 搜索索引 | 3,024 条（去重后 2,242 个标准化 OE） |
| 网站可展示产品 | 378 个（全部真实数据） |
| Prototype 重点产品 | 20 个 |

数据源已从旧的《产品信息表1_英文版.xlsx》切换为最新版 **《产品信息表1(1).xlsx》**
（SHA-256 `79d5995d…44a12`），旧文件保留在 `data/raw/` 仅作历史追溯。

详细的数据库重建过程、口径与全部统计数字见
[`01_database-v2-migration-report.md`](01_database-v2-migration-report.md)。

---

## 2. 自动测试结果

### 数据库测试 —— `node tools/verify-product-db-v2.mjs` → **65 PASS / 0 FAIL**

需求指定的 7 项全部通过：

| 测试 | 要求 | 结果 |
|---|---|---|
| TEST 1 | 原始 Excel 不得被修改（SHA-256） | ✅ 三重校验一致 |
| TEST 2 | 同一 Bowen 多 OE 不得判为冲突 | ✅ 321 个多 OE 产品，0 个被标冲突，无主/次 OE 字段 |
| TEST 3 | OE 与 Engine/Application 行级关系不得丢失 | ✅ 802 条 application 全部同时持有 OE 与车型原文 + 来源坐标 |
| TEST 4 | 25500-35540 / 2550035540 标准化后可查 | ✅ 4 种写法同一键，真实索引命中 |
| TEST 5 | blocked 数据不得进入 Prototype | ✅ 0 条产品 / 0 条 application 泄漏 |
| TEST 6 | 无人工标签不得猜 product_type | ✅ 自动猜 = 0，70 个留空待确认 |
| TEST 7 | Thermostat 不得拆 Insert/Assembly/Automotive | ✅ 四种写法归一，原始写法保留 |

### 网站数据集测试 —— `node tools/verify-prototype-data.mjs` → **36 PASS / 0 FAIL**

覆盖：数据集状态合法性、引用完整性、OE 四种写法一致性、多 OE 正常性、
来源可回溯、4 个分类与 4 个开关子分类都有真实产品、blocked/draft 不泄漏、
公司数字与认证与项目资料一致。

### 响应式测试 —— `node tools/find-overflow.mjs`

在 **390px**（手机）视口下逐页检查横向溢出：

| 页面 | 视口 | 文档 scrollWidth | 横向溢出 |
|---|---|---|---|
| 首页 | 390px | 390px | **0px** ✅ |
| Products | 390px | 390px | **0px** ✅ |
| OE Search 结果 | 390px | 390px | **0px** ✅ |
| Product Detail | 390px | 390px | **0px** ✅ |
| RFQ | 390px | 390px | **0px** ✅ |

---

## 3. 使用了哪些真实产品

**全部 378 个可展示产品都是真实数据**，没有一个是编造的。

其中 **20 个 Prototype 候选产品**（信息最完整、全部为 Thermostat）用于首页重点展示：

| # | Bowen No. | application | OE 数 | 出现的工作表 |
|---|---|---|---|---|
| 1 | 3005 | 7 | 85 | 综合产品信息表 / 三菱系列 / 吉利哈弗系列 / 比亚迪系列 / 长城哈弗系列 / 工作表1 |
| 2 | 3051 | 6 | 54 | 综合产品信息表 / 吉利哈弗系列 / 日系 / 长城哈弗系列 / 工作表1 |
| 3 | 3080 | 10 | 32 | 综合产品信息表 / 大众系列 / 工作表1 |
| 4 | 3004-3 | 4 | 49 | 综合产品信息表 / 工作表1 |
| 5 | 3061A | 2 | 59 | 综合产品信息表 / 工作表1 |
| 6 | 30101 | 2 | 29 | 综合产品信息表 / 日系 / 标致雪铁龙系列 / 福特系列 / 工作表1 |
| 7 | 3077 | 3 | 31 | 综合产品信息表 / 福特系列 / 工作表1 |
| 8 | 3016 | 5 | 25 | 综合产品信息表 / 福特系列 / 工作表1 |
| 9 | 3076 | 4 | 20 | 综合产品信息表 / 宝马奔驰系列 / 日系 / 工作表1 |
| 10 | 3001 | 5 | 20 | 综合产品信息表 / 大众系列 / 工作表1 |
| 11 | 3020 | 4 | 20 | 综合产品信息表 / 福特系列 / 工作表1 |
| 12 | 3069 | 3 | 20 | 综合产品信息表 / 吉利哈弗系列 / 长城哈弗系列 / 工作表1 |
| 13 | 3019 | 4 | 12 | 综合产品信息表 / 吉利哈弗系列 / 奇瑞系列 / 比亚迪系列 / 工作表1 |
| 14 | 3061 | 3 | 20 | 综合产品信息表 / 日系 / 比亚迪系列 |
| 15 | 3094 | 3 | 22 | 综合产品信息表 / 福特系列 / 工作表1 |
| 16 | 3035 | 3 | 20 | 综合产品信息表 / 宝马奔驰系列 / 工作表1 |
| 17 | 3203 | 3 | 20 | 综合产品信息表 / 福特系列 / 工作表1 |
| 18 | 3068 | 3 | 13 | 综合产品信息表 / 吉利哈弗系列 / 福特系列 / 长城哈弗系列 / 工作表1 |
| 19 | 31605 | 3 | 24 | 综合产品信息表 / 工作表1 |
| 20 | 3003-1 | 4 | 21 | 综合产品信息表 / 工作表1 |

**20 个产品合计 81 条 application、758 条 OE 索引记录。**

网站数据集实际构成（`website/src/data/`）：

| 项目 | 数量 |
|---|---|
| 可展示产品 | 378 个（20 个 prototype_candidate + 358 个 searchable_noindex） |
| Thermostat 产品 | 259 个 |
| Application | 711 条 |
| OE 索引行 | 2,787 条 |
| 有多个 OE 的产品 | 277 个 |

按网站产品架构分布：

| 分类 | 产品数 |
|---|---|
| Thermostats（核心） | 259 |
| Automotive Switches | 75（热敏开关 4 / 机油压力报警器 37 / 刹车灯开关 17 / 倒车灯开关 17） |
| Temperature Sensors | 41 |
| Related Cooling Parts | 3 |

> 每个分类都有真实产品，没有强行展示空分类。

> ⚠️ **产品图片（已于 Phase 2.6 更正）**：此前报告称「Excel 图片列为空、没有产品照片」，
> **该结论错误**。工作簿内实际嵌有 **681 个图片文件 / 798 个图片对象**，可关联到 **398 个产品**。
> 图片不在单元格值里，而是 OOXML 浮动绘图对象（`xl/drawings` + `xl/media`），
> 只读 `cell.value` 看不到。完整审计见 [`../docs/excel-image-audit.md`](../docs/excel-image-audit.md)。
>
> 图片来源已提取到 `data/processed/product-images/`，映射见
> `data/processed/product-image-map.json`（`exact` 767 / `review_required` 26 / `unresolved` 5）。
> **按业务方要求，本阶段暂未把图片接入网站**，页面仍显示 "Photo pending" 占位符。

---

## 4. 完成了哪些页面

| 页面 | 路径 | 状态 |
|---|---|---|
| **Home**（10 个 Screen） | `/` | ✅ 完成 |
| **Products**（列表 + 筛选 + 分页） | `/products` | ✅ 完成 |
| **Product Detail** | `/products/BW-3005` 等 20 个 | ✅ 完成，全部预渲染 |
| **OE Search** | `/oe-search` | ✅ 完成 |
| **Request a Quote** | `/rfq` | ✅ 完成 |
| **Factory** | `/factory` | ✅ 完成 |
| **Quality** | `/quality` | ✅ 完成 |
| **About Bowen** | `/about` | ✅ 完成 |
| **Contact** | `/contact` | ✅ 完成 |
| **Blog** | `/blog` | ✅ 仅框架（按需求） |
| 404 | 任意不存在路径 | ✅ 完成 |

首页 10 个 Screen 对应关系：

| Screen | 内容 | 实现 |
|---|---|---|
| 1 | Hero（Automotive Thermostat Manufacturer + OE 搜索 + 两个 CTA） | ✅ |
| 2 | Manufacturing Facts（2009 / 10,000m² / 3,500m² / 2,000m² / 100+） | ✅ 真实数字 |
| 3 | Product Categories（Thermostats 为主，其余为次级） | ✅ 数据不足的分类不展示 |
| 4 | Find by Application（Vehicle Make + Engine） | ✅ 73 个真实 vehicle make |
| 5 | OE Search Explanation（OE / Bowen / Vehicle / Engine 四种查法） | ✅ |
| 6 | Factory（Machining / Assembly / Automated Assembly / Testing） | ✅ |
| 7 | Quality（IATF 16949 / ISO 14001 / ISO 45001 + 检测环节） | ✅ 范围不夸大 |
| 8 | R&D（29 R&D Projects / 16 Patents / 5 Software Copyrights） | ✅ 真实数字 |
| 9 | RFQ CTA（Send Your OE Number or Sourcing List） | ✅ |
| 10 | Footer（Contact / Company / Products / Factory / Quality / RFQ） | ✅ |

### Products 页提供的筛选

- ✅ Search by OE Number（走标准化匹配）
- ✅ Search by Bowen No.
- ✅ Product Type Filter
- ✅ Vehicle Make Filter（73 个真实 make）
- ✅ Engine / Application Filter
- ✅ Category Filter（含汽车开关 4 个子分类）
- ✅ 分页
- ✅ 无结果时给出「把 OE 发给我们」的兜底入口

### Product Detail 页结构

- ✅ Product Image（占位符）+ Product Type + Bowen No.
- ✅ **OE References & Vehicle Applications 表格**：
  OE Reference / Vehicle / Application / 文本中的发动机代号 / Opening Temperature / Source(工作表+行号)
- ✅ **不显示 Main OE，不显示 Secondary OE**
- ✅ Add to RFQ + Request a Quote
- ✅ 展示「分类是怎么来的」（人工标签原文 + 来源工作表 + 行号）

---

## 5. OE Search 如何测试

### 方式一：页面操作

1. 打开 http://localhost:3000
2. 在首屏 Hero 的搜索框输入 `25500-35540`，点 **Search OE**
3. 结果页显示 `Exact OE Match`，并列出 Bowen 3503 / 3004-5 / 3004-3
4. 回到首页，改输入 `2550035540`（去掉短横线），点搜索
5. **两次结果完全一致** —— 证明标准化检索生效

### 方式二：直接访问 URL

```
http://localhost:3000/oe-search?q=4711306950
http://localhost:3000/oe-search?q=25500-35540
http://localhost:3000/oe-search?q=2550035540
```

### 方式三：Products 页综合筛选

```
http://localhost:3000/products?q=4711306950
http://localhost:3000/products?type=Thermostat&make=Toyota
http://localhost:3000/products?engine=EA111
http://localhost:3000/products?category=automotive-switches
```

### 搜索逻辑说明

| 用户输入 | 标准化键 | 说明 |
|---|---|---|
| `25500-35540` | `2550035540` | 去掉短横线 |
| `2550035540` | `2550035540` | 原样 |
| `25500 35540` | `2550035540` | 去掉空格 |
| `25500/35540` | `2550035540` | 去掉斜线 |
| `wv56tb` | `WV56TB` | 忽略大小写 |

**「Exact OE Match」的含义**：用户输入与数据库中的 normalized OE 完全相等，
**不代表这个 OE 是唯一的**。若同一 OE 出现在多个 Bowen 产品上，页面会全部列出。

---

## 6. 使用哪个真实 OE 可以演示

推荐 **6 个真实 OE**（全部已在原型上实测通过）：

| OE Number | 精确命中 | 对应 Bowen No. | 用途 |
|---|---|---|---|
| `25500-35540` | 4 条 | **3503 / 3004-5 / 3004-3** | 主推演示：多产品命中 |
| `2550035540` | 4 条 | **3503 / 3004-5 / 3004-3** | 与上一条对比，演示忽略短横线 |
| `4711306950` | 3 条 | **3005** | 演示一个 OE 命中多条 application |
| `056121113D` | 2 条 | **3001** | 演示字母+数字混合 OE |
| `9091603092` | 1 条 | **3076** | 演示单一命中 |
| `S13069010-37K` | 2 条 | **3016** | 演示带短横线的长 OE |

**最推荐的演示脚本**：
先搜 `25500-35540`，再搜 `2550035540` —— 结果完全一致；
然后搜 `4711306950`，点进 **Bowen 3005**（85 个 OE、7 条 application）看详情页表格。

---

## 7. RFQ 如何测试

### 完整流程

1. 打开 http://localhost:3000/products/BW-3005
2. 右侧 **Add to RFQ** 面板：下拉选择要询价的 OE 引用
3. 填写 Quantity（可选），点 **Add to RFQ**
4. 屏幕底部出现 RFQ 汇总条，显示「1 item in your RFQ list」+ 最后加入的
   Bowen / OE / 车型 → 证明数据已带入
5. 点 **Review & Request Quote** 进入 `/rfq`
6. RFQ 页第 1 段显示带入的明细：Bowen No.、Matched OE、Vehicle、Engine，
   并可就地填 Quantity 和 Remark
7. 填第 2 段联系信息：Name / Company / Country / Email / WhatsApp·Phone / Website
8. 填第 3 段：Message（可粘贴多行 OE 清单）+ Upload Sourcing List（可选）
9. 点 **Send RFQ**

### 表单校验（故意留空即可测试）

- 未填 Name / Company / Country / Email → 逐项报错并聚焦第一个错误字段
- Email 格式非法 → 提示格式错误
- 既没有 RFQ 明细、又没有 Message、又没有上传文件 → 提示至少提供一项

### 提交后会发生什么

**原型阶段不真的发邮件。** 提交后页面展示
**「Data that would be transmitted」** 的完整 JSON payload，包含：

```json
{
  "contact": { "name": "...", "company": "...", "country": "...", "email": "...", "whatsapp_phone": "..." },
  "items": [
    {
      "product_id": "BW-3005",
      "bowen_no": "3005",
      "product_type": "Thermostat",
      "matched_oe": "4711306950",
      "vehicle": "三菱4G6 471Q 菱帅 比亚迪F3 …",
      "engine": "…",
      "application_id": "APP-00005",
      "quantity": "500 pcs"
    }
  ],
  "sourcing_list_file": "my-list.xlsx"
}
```

这样可以在不发邮件的前提下，**验证整条数据传递链路是通的**。

### 快捷测试入口

```
http://localhost:3000/rfq?product=BW-3005     ← 直接从产品链接进入，自动带入该产品
http://localhost:3000/rfq                     ← 从空列表开始
```

RFQ 明细存在浏览器 localStorage（键名 `bowen.rfq.v1`），
刷新页面不会丢失，点「Clear the whole list」或「Start a new RFQ」可清空。

---

## 8. 哪些地方还是 placeholder

页面上一律**显式标注**，不会让访客误以为是真实信息：

| 位置 | Placeholder 内容 | 页面如何标注 |
|---|---|---|
| 产品图片 | 占位符（**图片其实存在，见下方说明**） | 工程图占位符 + "Photo pending" 角标 |
| RFQ 邮件 | 不真正发送 | 提交后展示 payload，并写明 "This is a prototype — nothing was emailed" |
| 联系邮箱 | sales@ / quality@bowen-thermostat.com | Contact 页写明「占位邮箱，上线前必须替换」 |
| 公司信息 | 注册全称/地址、电话、WhatsApp、微信、营业时间、地图 | Contact 页 "Company details — pending" 清单 |
| 产能与交期 | 年产能、标准交期、MOQ、包装装柜规范 | Factory 页 "Placeholder — pending confirmation from the production department" |
| 认证范围 | 只有体系名称，无证书编号与范围 | Quality 页 "Certificate scope and registration numbers are not published yet" |
| 检测设备 | 无设备型号清单 | Quality 页 "Placeholder — pending confirmation from the quality department" |
| 公司沿革 | 历史、员工数、出口市场、客户见证 | About 页 "Company story details still to be supplied" |
| Blog | 只有 6 个计划选题 | Blog 页 "Framework only — no articles published yet" |
| 产品类型 | 70 个产品类型未确认（不在网站展示） | 已生成 `review/product-type-unconfirmed.xlsx` |

**没有为了填满页面而编造任何数据。**

---

## 9. 如何启动网站

### 前置条件

- Node.js 18+（本项目用 **v24.9.0** 验证）
- 首次运行需装依赖：`cd website && npm install`

### 一条命令启动

```bash
cd website
npm run dev
```

**如果本机没有全局 npm**：项目自带一个极简 npm 兼容层，
`website/npm.cmd` + `website/tools/npm-run.mjs`，行为与 `npm run` 一致：

```bash
cd website
node tools/npm-run.mjs dev
```

**如果已装 pnpm**：

```bash
cd website
pnpm run dev
```

### 其他命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run dev:host` | 监听 0.0.0.0，供手机/局域网访问 |
| `npm run build` | 生产构建（390 个路由，378 个产品页全部预渲染） |
| `npm start` | 启动生产服务器 |
| `npm run typecheck` | TypeScript 类型检查（0 error） |
| `npm run data:refresh` | 重新生成并校验产品数据库 |

### 重新生成数据库（可选）

```bash
node tools/build-product-db-v2.mjs      # 重建数据库 + 网站数据集
node tools/verify-product-db-v2.mjs     # 65 项数据库验收测试
node tools/build-review-lists-v2.mjs    # 生成人工参考清单
cd website && node tools/verify-prototype-data.mjs   # 36 项网站数据测试
```

---

## 10. 本地访问地址

| 地址 | 说明 |
|---|---|
| **http://localhost:3000** | 首页 |
| http://localhost:3000/products | 产品列表 |
| http://localhost:3000/products/BW-3005 | 产品详情（推荐演示） |
| http://localhost:3000/oe-search?q=4711306950 | OE 搜索结果 |
| http://localhost:3000/rfq | RFQ |
| http://localhost:3000/factory | Factory |
| http://localhost:3000/quality | Quality |
| http://localhost:3000/about | About Bowen |
| http://localhost:3000/contact | Contact |
| http://localhost:3000/blog | Blog 框架 |

端口固定为 **3000**（写在 `website/package.json` 的脚本里）。

---

## 11. 手机端如何查看

### 方式 A：同一局域网用手机浏览器打开（推荐）

```bash
cd website
npm run dev:host
```

然后查看电脑的局域网 IP：

```powershell
ipconfig | findstr IPv4
```

假设得到 `192.168.1.23`，手机浏览器打开：

```
http://192.168.1.23:3000
```

> 手机与电脑必须连同一个 Wi-Fi。
> 若打不开，检查 Windows 防火墙是否放行了 Node.js 的入站连接。

### 方式 B：电脑上用浏览器模拟手机

Chrome / Edge 按 `F12` → 点左上角设备图标（Toggle device toolbar）→
选择 **iPhone 14 Pro** 或 **Pixel 7**，然后刷新页面。

### 重点检查的四个地方（按需求）

| 检查项 | 怎么看 |
|---|---|
| **OE Search** | 首页搜索框在 390px 下会变成上下排列的全宽按钮；输入 `25500-35540` 提交，结果卡片会由三列变单列 |
| **Products** | 筛选面板从左侧栏变成页面顶部整块；产品卡片由三列 → 两列 → 单列 |
| **Application Table** | 详情页的 OE / 车型表格可**横向滑动**（表头会吸顶），不会把页面撑宽 |
| **RFQ** | 明细行由左右布局变为上下堆叠，Remove 按钮变全宽；表单字段单列排列 |

已用自动化探针在 **390px** 下逐页验证：**5 个页面横向溢出均为 0px**。

---

## 12. 下一阶段建议做什么

按优先级排列：

### 第一优先：补齐数据缺口（阻塞上线）

1. **确认 70 个产品类型** —— 填 `review/product-type-unconfirmed.xlsx`
   （40 个只在系列表/辅助表出现，30 个 Bowen No. 为空）
2. **确认错位判定口径** —— 当前口径是「编号可读就标 needs_review 不阻断」，
   如需从严（凡 Bowen 字段出现尺寸/温度一律 blocked），改一行重跑即可
3. **人工核对 125 个共享 OE** —— `review/shared-oe-across-products.xlsx`
4. **产品照片** —— ~~Excel 图片列为空~~ **已更正：图片存在**。
   已提取 798 张并映射到 398 个产品（见 `docs/excel-image-audit.md`）。
   仍需业务方：确认主图规则、处理 26 张待确认 + 5 张无法映射、确认水印可用性。
5. **公司信息 + 认证证书** —— 注册全称/地址/电话/邮箱、证书编号与范围、
   产能/交期/MOQ/包装规范
6. **真实邮箱地址** —— 替换两个占位邮箱

### 第二优先：把原型变成可上线站点

7. **接入真实数据库** —— 把 `website/src/lib/db.ts` 的 `loadDataset()`
   换成 PostgreSQL / Supabase 查询（接口签名已设计好，页面代码不用改）
8. **RFQ 真正发信** —— 服务端接收 payload → 写入数据库 → 发邮件给销售 →
   回执邮件给客户
9. **站点级 SEO** —— metadata、sitemap、robots、结构化数据（当前是 noindex）
10. **图片与资源** —— 产品图、工厂照片、认证证书扫描件
11. **部署** —— 选定托管方案 + 绑定域名（本阶段明确禁止，下一阶段再做）

### 第三优先：内容与增长

12. **Blog 内容** —— 按 6 个计划选题写，需要指定技术审稿人
13. **多语言** —— 是否做西语/俄语/阿语版本
14. **产品线扩展** —— 目前 262 个 Thermostat，可考虑补充更多车型覆盖

### 技术债（不阻塞，但建议尽早处理）

15. **数据库为 JSON 静态数据**（约 3MB），产品量再翻几倍需要考虑
    构建期分页或改用数据库
16. **`review/first-batch-business-review.xlsx` 的用户改动未提交**
    （业务方手填的 3 个产品类型已提取到 `data/raw/review-overrides-v2.json`，
    但那个 Excel 本身还在工作区里未纳入版本控制，建议确认后一并提交）

---

## 附：本阶段完成的代码与产物

### 网站源码（`website/`）

```
website/
├── package.json / tsconfig.json / next.config.ts / npm.cmd
├── src/
│   ├── app/
│   │   ├── layout.tsx  globals.css
│   │   └── (site)/
│   │       ├── layout.tsx  page.tsx  home.module.css  not-found.tsx
│   │       ├── products/page.tsx + products.module.css
│   │       ├── products/[id]/page.tsx + detail.module.css
│   │       ├── oe-search/page.tsx + oe-search.module.css
│   │       ├── rfq/page.tsx + rfq.module.css
│   │       ├── factory/  quality/  about/  contact/  blog/
│   ├── components/    （15 个组件 + 各自 CSS Module）
│   ├── lib/
│   │   ├── db.ts          ★ 唯一数据入口（未来换 Supabase 只改这里）
│   │   ├── types.ts       领域类型
│   │   └── engine-code.ts 从原文提取发动机代号（纯字符串规则）
│   └── data/              构建产物：products / applications / oe-index / site-facts
└── tools/
    ├── npm-run.mjs              极简 npm 兼容层
    ├── verify-prototype-data.mjs 36 项网站数据测试
    ├── find-overflow.mjs        移动端横向溢出探针
    └── screenshot.mjs           CDP 截图工具
```

### 截图（`delivery/screenshots/`）

| 文件 | 内容 |
|---|---|
| `home-desktop.png` | 首页（1440px） |
| `home-mobile.png` | 首页手机版（390px） |
| `products.png` | Products 列表 + 筛选 |
| `oe-search-result.png` | OE 搜索 `4711306950` 结果 |
| `product-detail.png` | Bowen 3005 详情 + 应用表格 |
| `rfq.png` | RFQ 表单（已带入 Bowen 3005） |

### 启动方式回顾

```bash
cd website
npm install     # 首次
npm run dev     # → http://localhost:3000
```
