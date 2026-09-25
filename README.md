# 博文外贸独立站（Bowen B2B Website）

面向海外汽车零部件采购商的 B2B 独立站项目。

**当前进度：Phase 2.5（产品数据库重建）+ Phase 3（网站 UI Prototype）已完成，等待业务方验收。**
**网站原型可本地启动，尚未正式上线，未绑定域名，未接入 Supabase。**

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

---

## 二、30 秒启动网站

```bash
cd website
npm install      # 首次需要
npm run dev      # 一条命令启动
```

打开 **http://localhost:3000**

> 本机没装全局 npm？用 `node tools/npm-run.mjs dev`（项目自带兼容层）。
> 已装 pnpm？用 `pnpm run dev`。

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
├── tools/                          数据处理工具链（纯 Node.js，零第三方依赖）
│   ├── build-product-db-v2.mjs     ⭐ 数据库重建程序
│   ├── verify-product-db-v2.mjs    ⭐ 65 项验收测试
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

# 3) 生成人工参考 Excel
node tools/build-review-lists-v2.mjs

# 4) 网站数据集验收测试（36 项）
cd website && node tools/verify-prototype-data.mjs
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
- [ ] **等待业务方验收**
