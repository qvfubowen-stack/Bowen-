# Phase 2 数据就绪度报告：上线产品确认（⚠️ 已被取代）

> ## ⚠️ 本文件已被取代 — 请勿作为当前工作依据
>
> 本报告是 Phase 2 的**第一版**，当时的阶段目标是「自动确认 72 个 Published 产品」。
>
> **该目标已被取消。** 现阶段的阶段目标改为**「建立人工业务审核包，而不是让 Agent 猜产品信息」**。
>
> ### 请阅读：**[`docs/phase2-business-review-package.md`](phase2-business-review-package.md)**
>
> 两个版本的关键区别：
>
> | | 本文件（已取代） | 新报告（当前有效） |
> |---|---|---|
> | 阶段目标 | 确认 72 个 Published 产品 | 建立人工业务审核包 |
> | 首批产品状态 | `PUBLISHED` | **`publish_candidate`**（未确认不得发布） |
> | `published` 数量 | 72（**已废弃此口径**） | **0** |
> | 审核交付物 | 4 个 CSV | **4 个带下拉菜单的 Excel（.xlsx）** |
> | `product_type` | `REVIEW_REQUIRED` | `review_required` |
> | 疑似错位处理 | 11 个降级 | 11 个 **`blocked = true`**（硬性阻断） |
>
> **本文件保留仅作为历史记录。** 其中的数字、文件路径和结论均已被新版取代。

---

**项目**：博文外贸独立站（B2B，面向海外汽车零部件采购商）
**阶段**：Phase 2 — 上线产品确认（第一版，已取代）
**数据版本**：`v2.0.0-phase2`
**生成时间**：2026-09-23
**状态**：⚠️ 已被 `docs/phase2-business-review-package.md` 取代

---

## 0. 一句话结论

我已经把 72 个首批推荐产品做成了一份**你直接双击就能打开的 Excel 审核表**，只需要填 6 列。
但有一件必须先讲清楚的事：**72 个产品全部需要你确认产品类型，另外 3 个产品的编号有问题必须先修**。
所以**在你确认之前，可以进入 Published 的产品数量是 0**。

---

## 1. 你只需要的 6 个数字

| # | 问题 | 答案 | 说明 |
|---|---|---|---|
| 1 | 72 个产品中多少个**可以直接确认**？ | **10 个** | 数据本身没发现问题，只需补产品类型和产品名 |
| 2 | 多少个需要确认 `product_type`？ | **72 个（全部）** | 原表没有产品类型列，程序不能猜 |
| 3 | 多少个涉及**共享 OE**？ | **33 个** | 宽口径：与全库任意产品共享同一个 OE 号 |
| 3b | 其中与**首批内部**产品共享的 | **19 个** | 窄口径：会直接影响首批上线结果，优先处理 |
| 4 | 多少个存在**编号变体**？ | **13 个** | 例如 `3004` / `3004-1` / `3004-3` |
| 5 | 多少个存在**疑似错位**？ | **3 个** | 编号列里混进了别的东西 |
| 6 | **最终建议多少个可以进入 Published**？ | **当前 0 个；人工确认后最多 69 个** | 见第 7 节 |

**为什么"人工确认后最多 69 个"而不是 72 个？**
因为 72 个里面有 **3 个产品的 Bowen 编号是脏的**（见第 6 节），必须先修。`72 - 3 = 69`。

---

## 2. 本阶段产出的审核文件

全部放在项目根目录的 **`review/`** 文件夹里。**用 Excel 或 WPS 直接双击打开即可**，中文不会乱码（文件带 UTF-8 BOM）。

| 文件 | 行数 | 用来做什么 |
|---|---|---|
| **`review/first-72-products-review.csv`** | 72 | ⭐ **主表。72 个产品逐项确认。只需要填 `reviewer_` 开头的 6 列** |
| `review/shared-oe-review.csv` | 136 | 共享 OE 号审核（一个 OE 被多个产品引用） |
| `review/bowen-variant-review.csv` | 49 | 18 个编号变体族的审核 |
| `review/row-misalignment-review.csv` | 29 | 疑似错位记录的审核（含 3 个首批产品） |
| `data/derived/phase2-review-flags.csv` | 466 | 机器可读的标记表（全库，供系统用） |
| `data/derived/phase2-summary.json` | — | 本报告全部数字的机器可读版本 |

### 2.1 每张表的开头都有中文使用说明

打开文件后，**最上面几行是以 `#` 开头的中文说明**，告诉你每一列该怎么填、可选值有哪些。表格真正的表头在第 15 行左右（`#` 说明行的下面）。

### 2.2 系统列 vs 人工列（重要）

**主表把两类列严格分开了**，请不要搞混：

| 列名前缀 | 谁负责 | 说明 |
|---|---|---|
| `phase2_` | 🤖 系统 | 系统算出来的标记和建议。**请不要修改** |
| `reviewer_` | 👤 你 | **只需要填这 6 列**，其余留空 |

**只需要你填的 6 列：**

| 列名 | 填什么 | 可选值 |
|---|---|---|
| `reviewer_product_type` | 产品类型 | `Thermostat` / `Thermostat Assembly` / `Thermostat Insert` / `Thermostat Housing` / `Electronic Thermostat` / `Water Pump Assembly` / `Temperature Sensor` / `Thermal Switch` / `Oil Pressure Warning Switch` / `Reverse Light Switch` / `Brake Light Switch` / `NOT_A_PRODUCT` |
| `reviewer_product_name_en` | 英文产品名 | 例：`Automotive Thermostat 82°C for Volkswagen EA111` |
| `reviewer_vehicle_make` | 确认或修正车型品牌 | 多个用 `\|` 分隔；如果是发动机厂，填 `ENGINE_MAKER:名字` |
| `reviewer_vehicle_model` | 车型 | 不确定就留空（留空 = 网站不展示车型字段） |
| `reviewer_engine_code` | 发动机代码 | 只保留真正的发动机代码，去掉车型名；不确定留空 |
| `reviewer_decision` | 最终结论 | `APPROVE` / `NEEDS_FIX` / `REJECT` |
| `reviewer_notes` | 备注 | 随便写 |

### 2.3 主表的 14 个必备字段都在

你要求的字段全部在表里：`product_id`、`bowen_no`、`product_type`、`product_name_en`、`oe_number_raw`、`oe_number_normalized`、`vehicle_make`、`vehicle_model`、`engine`、`opening_temperature`、`source_sheet`、`source_row`、`fitment_confidence`、`publish_status`。

另外还多给了这些有用的列：

- `bowen_no_raw`：Bowen 编号的原始写法（便于发现问题）
- `product_type_suggestion`：系统的**建议**类型（只是建议，不是结论）
- `application_notes`：原表里的车型/应用原文（判断类型的主要依据）
- `dimensions`：尺寸
- `oe_all_count_note`：如果一个产品有 57 个 OE 号，主表只显示前 6 个，这里会写明总数和完整清单的位置
- `phase2_review_flags`：这个产品命中了哪些问题
- `phase2_suggested_action`：系统建议怎么处理
- `phase2_blocking_issue_count`：有几个"必须人工判断"的问题（**0 = 数据没问题，只需补录**）

**关于 `oe_number_raw` 只显示前 6 个**：Bowen `3005` 有 57 个 OE 号，全塞进一个单元格会看不清。
完整清单在 `data/derived/product-oe-index.csv`（2364 行，一行一个"产品 × OE 号"）。

---

## 3. 主表 72 个产品的字段现状

先看清楚**哪些字段是齐的、哪些是空的**，这决定了你需要花多少力气。

| 字段 | 已填 | 谁的问题 |
|---|---|---|
| `bowen_no` | 72 / 72 ✅ | 齐 |
| `oe_number_raw` / `oe_number_normalized` | 72 / 72 ✅ | 齐 |
| `vehicle_make`（车型品牌） | 72 / 72 ✅ | 齐，但**建议你复核**（见第 5.3 节） |
| `opening_temperature`（开启温度） | 72 / 72 ✅ | 齐 |
| `dimensions`（尺寸） | 72 / 72 ✅ | 齐 |
| `application_notes`（应用原文） | 72 / 72 ✅ | 齐 |
| `source_sheet` / `source_row` | 72 / 72 ✅ | 齐，可回表核对 |
| **`product_type`** | **0 / 72** ❌ | **必须你确认**（原表无此列） |
| **`product_name_en`** | **0 / 72** ❌ | **必须你确认**（程序不编名字） |
| **`vehicle_model`** | **0 / 72** ❌ | 原表把品牌/车型/发动机混在一列，需你拆分或决定不展示 |
| `engine`（发动机代码） | 28 / 72 ⚠️ | 程序抽取的**候选值**，混有车型名，需你筛 |
| 产品图片 | 0 / 72 ❌ | 原表图片是嵌入式对象，与编号的对应关系待补 |
| `fitment_confidence` | 72 / 72 | **全部 `review_required`**（不许写 exact） |
| `indexable` | 72 / 72 | **全部 `no`**（未确认不许索引） |

**这条是设计上的硬约束，不是漏做：**
`product_type`、`product_name_en`、`vehicle_model`、`image_urls` 之所以是空的，是因为**它们的值无法从原表可靠读出**。
项目铁律要求「不确定的数据不得自行补全」，所以程序留空并标记，等人工填。**这是正确行为。**

---

## 4. 十个"数据没问题"的产品（可以最先处理）

这 10 个产品**没有命中任何阻塞性问题**，只需要补产品类型、产品名、图片就能上线。
**建议从这里开始，先把流程跑通。**

| 主表行号 | Bowen No. | OE 数 | 车型品牌 | 温度(℃) | 尺寸 |
|---|---|---|---|---|---|
| 31 | `3001` | 19 | Hongqi | 79、81 | D1=54 d2=33 A=32 |
| 38 | `3028` | 12 | Nissan | 82 | D1=54.5 |
| 41 | `3582` | 11 | Chevrolet、Cadillac | 86 | D1=54 d2=40 A=47 |
| 45 | `3334` | 6 | Isuzu | 85 | D1=54 |
| 50 | `3555` | 4 | Hongqi、FAW | 90.5 | D1=46 |
| 55 | `3012` | 3 | Chery、Cowin | 82 | D1=52 d2=33 A=50 |
| 56 | `3024` | 3 | SAIC-GM-Wuling、Changan、Dongan、Buick | 70、82、92 | D1=52 |
| 65 | `3013` | 2 | Brilliance、Mitsubishi | 82 | D1=56 d2=28 A=43 |
| 66 | `3014` | 2 | JAC | 82 | D1=54 d2=28 A=43 |
| 67 | `3340` | 2 | Isuzu | 82 | D1=54 d2=30 A=32 |

**注意**：这 10 个"数据没问题"不等于"可以上线"，它们**仍然缺产品类型和产品名**。

**怎么快速筛出这 10 个**：在主表里筛选 `phase2_blocking_issue_count` 列 = `0`。

---

## 5. 共享 OE（33 个首批产品涉及）

### 5.1 什么是共享 OE

同一个 OE 号被 2 个及以上的**博文编号**同时引用。

**为什么这件事很要紧**：海外采购商拿着 OE 号来搜，网站必须决定"给他看几个产品"。
给少了→丢单；给多了→他以为这些产品通用，发错货。

### 5.2 规模

| 指标 | 数量 |
|---|---|
| 全库共享 OE 号 | **136 个** |
| 涉及的产品-OE 关系 | 289 条 |
| **首批 72 个产品中涉及共享 OE 的** | **33 个**（宽口径） |
| 其中**仅与首批内部产品**共享的 | **19 个**（窄口径，影响最大） |
| 首批内部互相共享的 OE 号 | 17 个 |

**两个口径为什么不一样？** 举个例子：

- Bowen `3008` 的 OE `12559575` 同时被 `3008` 和 `32899` 引用。
  `32899` **不在**首批 72 个里 → 算宽口径，不算窄口径。
- Bowen `3061` 的 OE `0619359B306` 同时被 `3061` 和 `3061A` 引用，
  两个**都**在首批里 → 同时算宽口径和窄口径。

**处理优先级：先处理窄口径的 19 个**，因为它们会直接让首批产品之间打架。

### 5.3 审核表怎么用

打开 `review/shared-oe-review.csv`，一行一个共享 OE 号。每行包含：

| 列 | 内容 |
|---|---|
| `oe_number_normalized` | OE 号（标准化后，搜索用） |
| `oe_number_raw` | OE 号原始写法 |
| `referencing_bowen_nos` | 涉及哪些 Bowen No. |
| `bowen_1`~`bowen_3` + `vehicle_make_1`~`_3` + `engine_1`~`_3` | **每个产品各自的车型/发动机**（最多展开 3 个） |
| `source_1`~`source_3` + `all_source_locations` | **原始来源位置**，形如 `Product Information!C4` = 主目录 C4 单元格 |
| `suggested_handling` | 系统**推荐**处理方式（不是结论） |
| `suggested_reason` | 为什么这么推荐 |
| `needs_human_confirmation` | 全部是 `yes` |
| `reviewer_decision` | ⭐ **你填这一列** |

`reviewer_decision` 可选值：

| 值 | 含义 |
|---|---|
| `SAME_PRODUCT` | 其实是同一个产品，应合并 |
| `ONE_TO_MANY` | 一号多型，这些是不同产品，搜索时全部展示 |
| `SUPERSEDED` | 替代关系，搜索时应提示（另填 `reviewer_primary_bowen`） |
| `WRONG_ENTRY` | 其中一个录错了，应删除该 OE 关联 |
| `KEEP_AS_IS` | 确认没问题，保持现状 |

### 5.4 系统的推荐逻辑（可复核，不替你下结论）

| 观测到的证据 | 推荐值 |
|---|---|
| 涉及产品的温度、尺寸、车型品牌**完全一致** | `LIKELY_SAME_PRODUCT`（需人工确认） |
| 温度有 ≥2 种或尺寸有 ≥2 种写法 | `LIKELY_ONE_TO_MANY`（需人工确认） |
| 其他 | `NEEDS_MANUAL_REVIEW` |

**为什么只能给"推荐"**：从数据上看不出哪个是对的。这个判断需要懂产品的人。

### 5.5 顺手发现的一个问题

共享 OE 表里有 **14 行**涉及**没有 Bowen 编号的"临时产品"**（`bwp-xxxx`）。
这些是原表里 OE 有值但编号为空的记录，Phase 1 已经把它们全部归到 `DRAFT`（不上线）。
它们不阻塞首批上线，但**建议补上编号**。

---

## 6. 三个必须先修的首批产品（疑似错位）

### 6.1 问题是什么

72 个首批产品里有 **3 个**的 Bowen 编号列**装的不只是编号**：

| 主表行号 | Bowen No.（现状） | 问题 |
|---|---|---|
| 54 | `3041-2(3003) Sealing ring` | 括号里是**另一个编号** `3003`，后面还跟着零件描述 `Sealing ring` |
| 63 | `30302(3334 Sealing ring)` | 括号里是**另一个编号** `3334`，后面跟着 `Sealing ring` |
| 60 | `35116(Deben)` | 括号里是 `Deben`（可能是供应商名或产地） |

### 6.2 为什么严重

Bowen 编号列里混进了**另一个编号**，说明这一行的数据可能是错位的。
如果编号列错位，**同一行的温度列、尺寸列也可能装的是别的产品的东西** → 整行数据都不可信。

### 6.3 这是 Phase 2 新发现的问题（要说明白）

Phase 1 我报告过"11 个产品有列错位风险，已全部禁止上线"。
**Phase 1 的检测规则更窄**，只抓"编号列里出现尺寸（如 `120*85*90`）"和"出现两个纯数字编号"。
**Phase 2 我用了更严格的规则重新扫描全库**，多抓了 18 个，包括上面这 3 个。

所以现在的准确数字是：

| 口径 | 数量 |
|---|---|
| Phase 1 已拦截（`has_attribute_warnings = yes`） | 11 个 |
| Phase 2 新发现 | 18 个 |
| **合计疑似错位** | **29 个** |
| 其中属于首批 72 个 | **3 个**（全部是 Phase 2 新发现的） |
| 严重度 HIGH（编号列混入尺寸/温度单位） | 11 个（**全部已被 Phase 1 拦截，无一在首批**） |
| 严重度 MEDIUM（编号列出现第二个编号） | 12 个（其中 2 个在首批） |
| 严重度 LOW（编号列括号内是零件描述） | 6 个（其中 1 个在首批） |

**我没有擅自改动 Phase 1 已确认的数据库。**
这 3 个产品在 `products.csv` 里**仍然是 `PUBLISHED`**，因为：
1. 修改已确认的数据需要你的授权；
2. 这 3 个问题的严重度是 MEDIUM/LOW，不是"整行确定错了"；
3. 正确做法是让懂产品的人看了原表再决定。

**但审核表里已经明确标注了** `phase2_status_recommendation` 列：
这 3 个产品都写着「建议降级为 SEARCHABLE_BUT_NOINDEX」。

### 6.4 你要做什么

打开 `review/row-misalignment-review.csv`，找到 `in_first_batch = yes` 的 3 行
（已排在最前面），拿着 `source_sheet` + `source_row` 去原始 Excel 核对那一行，然后填 `reviewer_decision`：

| 值 | 含义 |
|---|---|
| `FIX_DATA` | 数据确实错了，需修正（请在 `reviewer_notes` 写明正确值） |
| `DATA_OK` | 原表就是这么写的，是特殊写法，可以保留 |
| `SPLIT_PRODUCT` | 两个编号应拆成两个产品 |
| `EXCLUDE` | 这个产品先不上线 |

**核对时请打开 `data/raw/产品信息表1_英文版.xlsx`，但不要修改它。**
例：`source_sheet = Product Information`、`source_row = Product Information!E129`
表示"主目录工作表，E129 单元格"。

---

## 7. 最终建议：多少产品可以进入 Published

### 7.1 现在的答案：**0 个**

**理由**：`product_type` 是 0/72。规划 V1 第 10.1 节明确规定这个字段"必须人工确认"。
规划 V1 第 4 节还要求网站把 `Thermostats` / `Thermostat Assemblies` / `Thermostat Inserts` 做成三个独立导航分类。
**类型没确认，分类页面就是空的，产品页也没有正确的标题和面包屑。**

所以：**未经人工确认的数据，`indexable` 一律保持 `no`，`fitment_confidence` 一律保持 `review_required`。**
这条已由验收测试强制检查（61 项全部通过，其中多项专门检查这个）。

### 7.2 人工确认后的预估

| 情况 | 可以进入 Published |
|---|---|
| 现在（未确认） | **0 个** |
| 完成 62 个产品的类型确认 + 名称填写，且第 6 节 3 个问题都判为 `DATA_OK` | **69 个** |
| 第 6 节 3 个问题判为 `EXCLUDE` 或需拆分 | **66 个或更少** |
| 10 个"数据没问题"的产品先走通流程 | **10 个**（可作为第一批试点） |

### 7.3 我的建议：分两步走

**第一步：先做 10 个"数据没问题"的产品。**
目的不是上线，而是**验证整条流程**：类型确认 → 名称撰写 → 图片对应 → 生成页面 → 前台验收。
这 10 个跑通了，后面 62 个就是重复劳动。

**第二步：处理 62 个有问题的产品**，按这个顺序：

1. 先处理**窄口径共享 OE 的 19 个**（影响最大）
2. 再处理**3 个疑似错位**
3. 再处理**13 个编号变体**
4. 最后处理剩余的共享 OE 和空格推断拆分

---

## 8. 硬约束执行情况（验收测试）

本阶段新增验收测试 **`tools/verify-phase2.mjs`，61 项全部通过**。

关键检查项：

| 检查 | 结果 |
|---|---|
| 4 张审核表都存在、带 UTF-8 BOM、LF 换行、含中文使用说明 | ✅ |
| 主表恰好 72 行，14 个必备字段齐全 | ✅ |
| 主表中 `indexable` 全部为 `no` | ✅ |
| 主表中 `fitment_confidence` 全部为 `review_required` | ✅ |
| 主表中 `product_type` 全部为 `REVIEW_REQUIRED`（未猜类型） | ✅ |
| 主表中 `product_name_en` 全部为空（未编造名称） | ✅ |
| 主表中 `vehicle_model` 全部为空（未编造车型） | ✅ |
| 所有 `reviewer_*` 人工列初始为空 | ✅ |
| **主库 `products.csv` 中 `indexable=yes` 的数量 = 0** | ✅ |
| **主库 `products.csv` 中 `fitment_confidence=exact` 的数量 = 0** | ✅ |
| **主库 `products.csv` 中被程序填写的 `product_type` 数量 = 0** | ✅ |
| 共享 OE 表每行都有 OE 号 / 涉及 Bowen / 车型发动机 / 来源位置 / 推荐处理 / 需人工确认 | ✅ |
| 变体表 18 族 49 行，每族 ≥2 个变体，含 OE 重叠证据 | ✅ |
| 错位表每行都有原始位置、证据、严重度、需人工确认 | ✅ |
| HIGH 级错位记录一律不在 PUBLISHED | ✅ |
| PUBLISHED 状态的错位记录都已标注"建议降级" | ✅ |
| 汇总数字自洽（10 + 62 = 72） | ✅ |

**重跑命令**：

```powershell
node tools/build-phase2-review.mjs   # 重新生成 review/ 下全部文件
node tools/verify-phase2.mjs         # 运行 61 项验收测试
```

---

## 9. 仍然不能做的事（明确声明）

| 事项 | 状态 | 原因 |
|---|---|---|
| 设置 `indexable=yes` | ⛔ 禁止 | 未经人工确认 |
| 设置 `fitment_confidence=exact` | ⛔ 禁止 | 未经人工确认 |
| 填写 `product_type` | ⛔ 禁止 | 必须人工确认 |
| 填写 `product_name_en` | ⛔ 禁止 | 程序不编产品名 |
| 填写 `vehicle_model` | ⛔ 禁止 | 原表无法可靠拆分 |
| 把图片路径填进数据库 | ⛔ 禁止 | 原表图片与编号的对应关系未知 |
| 修改 `data/raw/` 下的原始文件 | ⛔ 禁止 | 项目铁律 |
| 修改 Phase 1 已确认的 `products.csv` | ⛔ 禁止 | 需你的授权 |
| 开发网站页面 | ⛔ 禁止 | 等 UI Prototype 阶段 |

---

## 10. 下一步

1. **打开 `review/first-72-products-review.csv`**（Excel 双击即可）
2. **先筛 `phase2_blocking_issue_count = 0`**，把这 10 个的类型和名称填完
3. **打开 `review/row-misalignment-review.csv`**，核对那 3 个首批产品
4. **打开 `review/shared-oe-review.csv`**，先处理 `blocks_first_batch = yes` 的 17 行
5. 填完告诉我，我会：
   - 把你的确认结果写回数据库（这一步**需要你授权**，因为会修改 `products.csv`）
   - 更新 `indexable` / `fitment_confidence` 状态
   - 生成确认后的 V1 产品数据库

**在你确认之前，我不会开始写网站。等你确认后再进入 UI Prototype 阶段。**

---

## 附录：审核文件位置速查

```
C:\Users\asus\Desktop\B2B外贸独立站\
├── review\                                    ← ⭐ 你要打开的文件都在这里
│   ├── first-72-products-review.csv            ⭐ 主表，72 个产品
│   ├── shared-oe-review.csv                    共享 OE（136 个）
│   ├── bowen-variant-review.csv                编号变体（18 族）
│   └── row-misalignment-review.csv             疑似错位（29 个，含 3 个首批）
│
├── docs\
│   ├── product-database-report.md              Phase 1 数据质量报告
│   └── phase2-data-readiness-report.md         ← 本文件
│
└── data\
    ├── raw\产品信息表1_英文版.xlsx              ⚠️ 原始文件，只读，请勿修改
    └── derived\
        ├── products.csv                        产品主库（466 个）
        ├── product-oe-index.csv                OE 索引（2364 条）
        ├── phase2-review-flags.csv             Phase 2 标记（466 行）
        └── phase2-summary.json                 本报告数字的机器版本
```
