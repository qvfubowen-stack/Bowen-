# 产品数据库重建报告（Phase 2.5）

**数据库版本：v2（Products + Product Applications + OE Search Index）**
**生成时间：2026-09-25**
**数据源（Source of Truth）：`data/raw/产品信息表1(1).xlsx`**
**原始文件 SHA-256：`79d5995d437ea5a4393faba87f237ea59f1361f51f22d6d5b28eb34bcd144a12`（51,576,159 字节）**

> 本报告所有数字都由 `data/derived/v2/stats.json` 直接读取，可用
> `node tools/build-product-db-v2.mjs && node tools/verify-product-db-v2.mjs` 一键复现。
> 验收测试结果：**65 项全部 PASS，自动猜 product_type = 0**。

---

## 一、一句话结论

产品数据库已经从「一个产品一行、OE 和车型被拍平」的旧结构，重建为
**两层结构**：`451 个 Products` + `802 条 Product Applications` + `3024 条 OE 搜索索引`。
每一条 application 都同时保留 **该 Excel 行的 OE 原文** 与 **该 Excel 行的车型/发动机原文**，
OE 与 Engine 的行级对应关系**没有丢失**。

产品类型完全由业务方的人工标注决定，程序**一次都没有猜过**。

---

## 二、业务方指定要回答的 15 个问题

| # | 问题 | 答案 |
|---|---|---|
| 1 | 原始记录数量 | **962 条**（另有 11 条辅助表天博编号孤立行被排除，见第 5.3 节） |
| 2 | 聚合产品数量 | **451 个** |
| 3 | Product Application 数量 | **802 条**（其中可用 761 条，错位待复核 18 条，blocked 23 条） |
| 4 | Thermostat 产品数量 | **262 个** |
| 5 | 其他各产品类型数量 | Temperature Sensor **41**、Oil Pressure Warning Switch **37**、Brake Light Switch **17**、Reverse Light Switch **17**、Thermal Switch **4**、Related Cooling Part **3** |
| 6 | product_type 仍未知的产品数量 | **70 个**（占 15.5%） |
| 7 | OE 总数量 | application 里的 OE token 合计 **3,312 个**（其中 105 个是「总成OE」这类说明文字 token，不计入搜索索引） |
| 8 | normalized OE 总数量 | 索引 **3,024 条**，去重后 **2,242 个**标准化 OE |
| 9 | 一个产品平均多少 OE / Application | 平均 **7.34 个 OE**、**1.78 条 application** |
| 10 | 一个 OE 对应多个 Bowen 的数量 | **125 个**标准化 OE（涉及 320 行，已生成 `review/shared-oe-across-products.xlsx`） |
| 11 | blocked 数据数量 | **23 条记录 / 23 个产品**（Bowen No. 单元格读不出合法编号） |
| 12 | 是否存在 OE ↔ Engine 对应关系丢失 | **不存在**。每条 application 同时持有 OE 与 Engine 原文，OE 没有被抽成独立数组 |
| 13 | 选出的 Prototype 产品 | **20 个**（见第六节） |
| 14 | 每个 Prototype 产品有多少条 application | 2 ~ 10 条，合计 81 条（见第六节表格） |
| 15 | 是否发生 Agent 自动猜 product_type | **没有，自动猜 = 0** |

---

## 三、数据库结构

### 3.1 两层模型

```
Products (451)
  └── Product Applications (802)      一条 Excel 记录 = 一条 application
        └── OE Search Index (3024)    从 application 的 OE 单元格逐 token 展开
```

### 3.2 Products 表字段

`product_id`、`bowen_no`、`product_type`、`product_subtype`、`product_name_en`、`image`、`status`、
`product_type_source`、`product_type_verified`，外加可追溯性字段：
`product_type_evidence`、`product_type_raw_labels`、`source_sheets`、`source_record_ids`、
`application_ids`、`blocked`、`blocked_reasons`、`needs_review_application_count`。

### 3.3 Product Applications 表字段

`application_id`、`product_id`、`oe_number_raw`、`oe_number_normalized`、
`vehicle_make`、`vehicle_model`、`engine_code`、`engine_displacement`、`engine_application`、
`opening_temperature_c`、`application_notes`、`source_sheet`、`source_row`、`verification_status`。

### 3.4 关于「一条 Excel 记录 = 一条 application」这个决定

重建前先做了一次结构分析，结论是：**最新版 Excel 没有行级的 OE↔Engine 对应关系**。

- 973 条原始记录（排除辅助表孤立行后 962 条）中，**424 条同时**在 OE 单元格和车型单元格里放多个值；
- 两个单元格里的值数量几乎从不相等，例：Bowen 3005 的 OE 有 13 个、车型有 10 个；Bowen 3004 的 OE 有 2 个、车型有 8 个。

因此**任何 1:1 的 OE↔车型配对都只能是程序编出来的**。按项目铁律「不猜数据」，本阶段采用：

| 层级 | 存放内容 |
|---|---|
| `oe_number_raw`（application） | **该 Excel 行 OE 单元格的完整原文**（可含多个 OE，保留原始换行/空格） |
| `vehicle_application_raw` / `engine_application`（application） | **该 Excel 行车型单元格的完整原文** |
| `oe_number_normalized`（application） | 该行每个 OE token 的标准化键数组 |
| OE Search Index | 把每个 OE token 单独展开成一行，指回它所属的 application |

这样做同时满足三条要求：OE 能逐个搜索、OE 与 Engine 的行级关系完整保留、
不会凭空生成任何 Excel 里不存在的配对。

### 3.5 关于 `oe_number_normalized`

按业务规则，一个 application 的 OE 单元格可能有多个 OE，所以：

- `oe_number_raw`：整格原文（字符串），用于网站展示；
- `oe_number_normalized`：字符串数组，元素是每个 OE 的标准化写法，与 `oe_token_positions` 一一对应；
- 检索引擎实际使用的是 **OE Search Index 表**的 `oe_search_key`（一 OE 一行）。

---

## 四、产品类型是怎么定的（这是本阶段最关键的部分）

### 4.1 四条合法来源，一条都没有多

| `product_type_source` | 产品数 | 含义 |
|---|---|---|
| `human_section_label` | **365** | 业务方在《综合产品信息表》里写下的产品区段标签 |
| `human_review_confirmed` | **3** | 业务方在 Phase 2 审核表里逐行手填的确认值 |
| `inherited_from_bowen` | **13** | 变体编号继承其基础编号在综合表里的分类 |
| `review_required` | **70** | 无人工证据，程序不做任何推断 |
| **合计** | **451** | |

**自动猜 product_type = 0。**

### 4.2 识别到的 7 个人工区段标签

最新版《综合产品信息表》里，业务方在空白位置写下了 7 个产品区段标签，程序逐个识别如下：

| 区段标签 | 标签位置 | 覆盖行范围 | 记录数 | 归一化产品类型 |
|---|---|---|---|---|
| 节温器 | A3 | 4 – 138 | 267 | Thermostat（另有 13 个变体编号经基础编号继承，1 个被审核表确认，共 262 个产品，含其他表的同一编号） |
| 冷却水管 | B139 | 140 – 141 | 3 | Related Cooling Part |
| 温度传感器 | B142 | 143 – 163 | 42 | Temperature Sensor |
| 机油压力报警器 | B164 | 165 – 183 | 37 | Oil Pressure Warning Switch |
| 热敏开关 | B184 | 185 – 186 | 4 | Thermal Switch |
| 刹车灯开关 | B187 | 188 – 196 | 17 | Brake Light Switch |
| 倒车灯开关 | B197 | 198 – 206 | 17 | Reverse Light Switch |

规则实现：**识别到一个标签后，把它应用到下面连续的记录，直到遇到下一个标签**。
区段标签是「按行」生效的：综合表把一条产品线横跨左右两个并列区块（A–F / G–L），
业务方只在其中一个区块写一次标签，因此同一行以下的所有记录区块都受它管辖。

### 4.3 节温器四种写法已统一

按业务方最新规则，以下四种写法在 V1 全部统一为 `Thermostat`：

```
Automotive Thermostat  ┐
Thermostat             ├──►  product_type = "Thermostat"
Thermostat Insert      │     product_subtype = null
Thermostat Assembly    ┘
```

- `product_subtype` 全库 **451 个产品全部为 `null`**；
- **没有**任何产品因为 subtype 缺失被阻止上线（当前 381 个产品可展示）；
- 但业务方在审核表里手填的原始写法 **没有丢**：
  - Bowen 3005 → `product_type_raw_labels: ["Automotive Thermostat"]`
  - Bowen 3064 → `product_type_raw_labels: ["Thermostat Insert"]`
  - Bowen 3061A → `product_type_raw_labels: ["Thermostat Assembly"]`

未来要做 `product_subtype` 时，直接读这个字段即可。

### 4.4 变体编号的继承（13 个）

像 `3002-1`、`3004--3`、`3654--2`、`3033--1` 这类变体编号，只在车型系列表里出现。
它们的**基础编号**（3002 / 3004 / 3654 / 3033）在综合表里有明确的人工分类，
因此标 `inherited_from_bowen`，并在证据里写清继承自哪个编号、哪一行。
程序只做了「去掉尾部 - 后缀」这一纯字符串操作，**没有**用 OE、车型、发动机、温度、尺寸做过任何推断。

### 4.5 70 个仍然未知的类型

这 70 个产品**已入库、可搜索**，只是 `product_type = null`、`product_type_source = "review_required"`：

- 40 个只在车型系列表或辅助表《工作表1》出现，综合表里没有它们的分类；
- 30 个 Bowen No. 单元格为空或无编号。

**没有强行分类、没有为凑数而填、没有为了好看而合并。**
已导出 `review/product-type-unconfirmed.xlsx`（带下拉菜单），等业务方批量确认后回填。

---

## 五、其他数据治理结果

### 5.1 同一 Bowen 多个 OE —— 不再是冲突

全库 **321 个产品有 2 个以上 OE**，最多的是 Bowen 3005（85 个 OE）。
数据库里**不存在** `main_oe` / `primary_oe` / `secondary_oe` / `is_main` / `oe_rank` 任何字段，
也没有任何产品因为「多个 OE」被标为冲突或异常。

### 5.2 一个 OE 对应多个 Bowen —— 全部保留

**125 个**标准化 OE 出现在多个 Bowen No. 上。按业务规则：

- ✅ 全部保留，**不删除、不合并、不自动判定谁正确**；
- ✅ 生成 `review/shared-oe-across-products.xlsx`（125 个 OE / 320 行）供以后人工参考；
- ✅ **没有阻止** Prototype 开发（Prototype 仍是 20 个产品）。

### 5.3 辅助表天博编号孤立行的处理

《工作表1》是「天博编号对照表」性质的辅助表。其中有 **11 行**整行只有编号列或天博编号列有值、
既没有 OE 也没有车型，例如 `32588`、`5 157 411`、`3722`。这类行不是产品记录，本阶段不入库。

- 原始单元格内容完整保存在 `data/derived/v2/auxiliary-excluded-rows.json`；
- 验收测试确认**没有任何有效记录被误排除**；
- 《工作表1》里正常的编号记录（277 条）**全部入库**。

### 5.4 错位数据的处理（blocked）

按业务规则「疑似错位的记录 blocked = true，不得进入网站任何入口，但保留原始来源」。
实测发现最新版 Excel 的错位情况分两类，处理方式不同：

| 类型 | 数量 | 例子 | 处理 |
|---|---|---|---|
| **A. 编号可读、后面跟错位内容** | 18 条 | `3029  92°`、`3033-z  138*95*251`、`3064\n77℃`、`35059 \nF059` | `needs_review = true`；编号读出来用，错位原文**原样**存进 `bowen_overflow_raw` 与 `application_notes`；**不阻断产品**（同一 Bowen 在其他表通常还有干净记录） |
| **B. 完全读不出编号** | 23 条 | `无小管`、`芯子编号：31052`、`1919(35401)`、`同3025尺寸相同，原件阀座有3处豁口…` | `blocked = true`；整条产品状态 `blocked`；**不进入产品列表、不进入 OE 搜索、不进入 Prototype**；原始来源完整保留 |

- blocked 产品：**23 个**，`review/row-misalignment-v2.xlsx` 记录了全部明细；
- 错位记录 **没有**被自动修复、自动合并或删除；
- 验收测试确认：**0 条 blocked 数据进入 Prototype，0 条 blocked application 进入 OE 搜索索引**。

### 5.5 发布状态

按业务方要求，本阶段不再使用 `published` 口径：

| 状态 | 产品数 | 含义 |
|---|---|---|
| `prototype_candidate` | **20** | 用于网站原型的真实产品（**不代表已正式上线**） |
| `searchable_noindex` | **361** | 数据完整、可搜索、暂不被搜索引擎收录 |
| `draft` | **47** | 数据不足或类型待确认 |
| `blocked` | **23** | 疑似字段错位，隔离 |
| `published` | **0** | 本阶段禁止 |

---

## 六、Prototype 产品清单（20 个）

挑选规则（写在 `tools/config/product-types.mjs`，可复核）：
必须是核心品类 Thermostat、无 blocked 记录、无错位待复核记录、
至少 2 条 application、至少 2 个 OE、按信息完整度排序取前 20。

| # | Bowen No. | application 数 | OE 数 | 出现的工作表 | 完整度 |
|---|---|---|---|---|---|
| 1 | 3005 | 7 | 85 | 综合产品信息表 / 三菱系列 / 吉利哈弗系列 / 比亚迪系列 / 长城哈弗系列 / 工作表1 | 75.5 |
| 2 | 3051 | 6 | 54 | 综合产品信息表 / 吉利哈弗系列 / 日系 / 长城哈弗系列 / 工作表1 | 75.0 |
| 3 | 3080 | 10 | 32 | 综合产品信息表 / 大众系列 / 工作表1 | 65.0 |
| 4 | 3004-3 | 4 | 49 | 综合产品信息表 / 工作表1 | 56.0 |
| 5 | 3061A | 2 | 59 | 综合产品信息表 / 工作表1 | 52.0 |
| 6 | 30101 | 2 | 29 | 综合产品信息表 / 日系 / 标致雪铁龙系列 / 福特系列 / 工作表1 | 50.0 |
| 7 | 3077 | 3 | 31 | 综合产品信息表 / 福特系列 / 工作表1 | 50.0 |
| 8 | 3016 | 5 | 25 | 综合产品信息表 / 福特系列 / 工作表1 | 49.5 |
| 9 | 3076 | 4 | 20 | 综合产品信息表 / 宝马奔驰系列 / 日系 / 工作表1 | 46.0 |
| 10 | 3001 | 5 | 20 | 综合产品信息表 / 大众系列 / 工作表1 | 43.0 |
| 11 | 3020 | 4 | 20 | 综合产品信息表 / 福特系列 / 工作表1 | 43.0 |
| 12 | 3069 | 3 | 20 | 综合产品信息表 / 吉利哈弗系列 / 长城哈弗系列 / 工作表1 | 42.0 |
| 13 | 3019 | 4 | 12 | 综合产品信息表 / 吉利哈弗系列 / 奇瑞系列 / 比亚迪系列 / 工作表1 | 41.5 |
| 14 | 3061 | 3 | 20 | 综合产品信息表 / 日系 / 比亚迪系列 | 41.0 |
| 15 | 3094 | 3 | 22 | 综合产品信息表 / 福特系列 / 工作表1 | 40.5 |
| 16 | 3035 | 3 | 20 | 综合产品信息表 / 宝马奔驰系列 / 工作表1 | 39.0 |
| 17 | 3203 | 3 | 20 | 综合产品信息表 / 福特系列 / 工作表1 | 39.0 |
| 18 | 3068 | 3 | 13 | 综合产品信息表 / 吉利哈弗系列 / 福特系列 / 长城哈弗系列 / 工作表1 | 38.0 |
| 19 | 31605 | 3 | 24 | 综合产品信息表 / 工作表1 | 38.0 |
| 20 | 3003-1 | 4 | 21 | 综合产品信息表 / 工作表1 | 37.5 |

**20 个产品合计 81 条 application、758 条 OE 索引记录。**
网站原型只消费这 20 个产品，完整数据库（451 个产品）保留在 `data/derived/v2/`。

---

## 七、验收测试结果（TEST 1 – 7 全部通过）

`node tools/verify-product-db-v2.mjs` → **PASS 65 / FAIL 0**

| 测试 | 要求 | 结果 |
|---|---|---|
| **TEST 1** | 原始 Excel 不得被修改（SHA-256 校验） | ✅ 冻结值、运行前、运行后三者一致 |
| **TEST 2** | 同一 Bowen 多 OE 不得被判定为冲突 | ✅ 321 个多 OE 产品，0 个被标冲突，无主/次 OE 字段 |
| **TEST 3** | OE 与 Engine/Application 的行级关系不得丢失 | ✅ 802 条 application 全部同时持有 OE 与车型原文 + 来源坐标 |
| **TEST 4** | `25500-35540` / `2550035540` / `25500 35540` / `25500/35540` 标准化后一致 | ✅ 4 种写法同一个键，真实索引命中 Bowen 3004-5 |
| **TEST 5** | blocked 数据不得进入 Prototype | ✅ 0 条 blocked 产品 / 0 条 blocked application 进入 Prototype 与 OE 搜索 |
| **TEST 6** | 没有人工类型标签的数据不得自动猜 product_type | ✅ 自动猜 = 0，70 个留空待确认 |
| **TEST 7** | Thermostat 不得再拆分 Insert / Assembly / Automotive Thermostat | ✅ 四种写法全部归一，原始写法保留在 `product_type_raw_labels` |

另外 58 项附加测试覆盖：`product_id`/`application_id` 唯一性、引用完整性、
来源可回溯、状态取值合法性、无 `published`、构建脚本不写 `data/raw`、中文 token 不被当成 OE 等。

### 过程中修掉的 4 个真实缺陷

重建不是一次就对的，以下是过程中通过审计发现并修掉的 bug（都有测试兜底）：

1. **区段标签作用域错误**：只作用于标签自己所在的列块，导致综合表右半区 141 个产品拿不到人工分类。
   修正为「按行生效，管辖同一行以下的所有记录区块」，Thermostat 从 130 涨到 262 个。
2. **聚合产品被重复创建**：`ensureProduct` 被调用两次，产生 60 个空壳重复产品。已改为按 `source_record_id` 记忆化。
3. **blocked 记录被静默丢弃**：23 条读不出编号的记录被 `continue` 掉，没有入库。已改为保留成 blocked 产品。
4. **数据列里的孤立值被误当成区段标签**：辅助表编号列里的天博编号 `5 157 411` 被当成产品类型标签。
   已加双重约束：标签必须在第一条编号列左侧，且必须能在产品类型词典里查到。

### 关于「错位」判定口径的一处重要说明

原始需求写的是「部分尺寸/温度/压力值可能错位进入 Bowen No. 等字段，这类数据继续 `blocked = true`」。
实测后发现，**35 个异常单元格里有 33 个仍然以合法 Bowen No. 开头**（如 `3029  92°`），
只有 2 个是真的读不出编号。如果把这 33 条一律 blocked，会连带阻断 3005、3064 等已由业务方
人工确认过的产品。因此本阶段拆成两级：**编号可读 → `needs_review`（不阻断）；编号不可读 → `blocked`**。
两种情况下错位原文都完整保留。**这一口径需要业务方确认**，如需从严（一律 blocked），
改 `tools/build-product-db-v2.mjs` 的 `blocked` 判定一行即可重跑。

---

## 八、产物清单

### 数据库（可重新生成）

| 文件 | 内容 |
|---|---|
| `data/derived/v2/products.json` | 451 个产品 |
| `data/derived/v2/product-applications.json` | 802 条 application |
| `data/derived/v2/product-oe-search-index.json` | 3,024 条 OE 索引 |
| `data/derived/v2/staging-records.json` | 962 条原始记录（含 blocked 与全部错位痕迹） |
| `data/derived/v2/shared-oe-across-products.json` | 125 个共享 OE |
| `data/derived/v2/section-labels.json` | 识别到的 7 个人工区段标签 |
| `data/derived/v2/rejected-label-candidates.json` | 被拒绝的候选标签及原因 |
| `data/derived/v2/auxiliary-excluded-rows.json` | 排除的 11 条天博编号孤立行 |
| `data/derived/v2/stats.json` | 全部统计数字 |

### 网站原型数据（由上面的库裁剪而来）

`website/src/data/products.json`（20）、`applications.json`（81）、`oe-index.json`（758）、`site-facts.json`

### 人工参考清单

| 文件 | 内容 |
|---|---|
| `review/shared-oe-across-products.xlsx` | 125 个 OE → 320 行 |
| `review/product-type-unconfirmed.xlsx` | 70 个类型待确认产品（带下拉菜单） |
| `review/row-misalignment-v2.xlsx` | 18 条错位待复核 |

### 代码

| 文件 | 说明 |
|---|---|
| `tools/build-product-db-v2.mjs` | 重建程序（唯一入口） |
| `tools/build-review-lists-v2.mjs` | 人工参考清单生成器 |
| `tools/verify-product-db-v2.mjs` | 验收测试（65 项） |
| `tools/config/product-types.mjs` | 产品类型词典 + 全部人工裁决点 |
| `tools/lib/v2-layout.mjs` | Excel 版式识别（表头 / 区块 / 区段标签） |

### 一条命令复现

```powershell
node tools/build-product-db-v2.mjs
node tools/verify-product-db-v2.mjs
node tools/build-review-lists-v2.mjs
```

---

## 九、本阶段没有做的事（按禁令）

- ❌ 没有修改原始 Excel（SHA-256 三重校验）
- ❌ 没有接入 Supabase、没有连接正式域名、没有正式发布
- ❌ 没有购买/绑定域名
- ❌ 没有批量生成 SEO 页面
- ❌ 没有删除任何 OE、没有选择 Main OE、没有合并 Bowen No.
- ❌ 没有猜 product_type（= 0）
- ❌ 没有自动修复或自动合并错位数据
- ❌ 没有把 `published` 当作「数据完整」的同义词

---

## 十、需要业务方确认的两件事

1. **70 个类型待确认产品** —— 填 `review/product-type-unconfirmed.xlsx`。
   其中 40 个是只在系列表/辅助表出现的编号，30 个是 Bowen No. 为空的记录。
2. **错位判定口径** —— 见第七节末尾。当前口径是「编号可读就不阻断」，
   如果业务方认为凡是 Bowen 字段出现尺寸/温度就该一律阻断，请告知，改一行重跑即可。

另外，`review/shared-oe-across-products.xlsx`（125 个共享 OE）供以后人工核对，
**不阻塞**任何后续开发。
