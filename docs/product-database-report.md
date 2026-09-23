# 产品数据库清洗与标准化报告（阶段一）

**项目**：博文外贸独立站（B2B，面向海外汽车零部件采购商）
**文档版本**：v1.0.0
**数据版本**：`source_version = v1.0.0`
**生成时间**：2026-09-23
**依据文档**：《博文外贸独立站规划 V1》第 10 节「产品数据库字段设计」、第 12 节「第一阶段上线范围」
**状态**：阶段一完成，**等待业务方确认后**才进入阶段二（网页开发）

---

## 0. 一句话结论

原始 Excel 已完整转成一套可追溯的标准化产品数据库：**1 份原始文件 / 17 个工作表 → 970 条原始记录 → 466 个产品 → 2,364 条 OE 明细**。
但有一件事必须先说清楚：**没有任何产品可以现在就上线**。原因是规划 V1 明确规定 `product_type` 必须人工确认，而这个字段原表里根本不存在。系统已经为每个产品给出了「产品类型建议」，需要业务方逐条确认后才能真正发布。

---

## 1. 数据来源与不可篡改保证

### 1.1 本次使用的原始文件

| 项目 | 值 |
|---|---|
| 文件名 | `产品信息表1_英文版.xlsx` |
| 项目内路径 | `data/raw/产品信息表1_英文版.xlsx` |
| 文件大小 | 48,680,077 字节（约 46.4 MB） |
| 修改时间 | 2026-09-07 14:41:28 |
| **SHA-256** | `22da11156fa4eb82a5b88c520263b06d56c39e0c291c3ed8952edccb1e8a062f` |

> ⚠️ **请注意一件事**：这个 Excel 原本**不在**项目文件夹里。它被发现于
> `C:\Users\asus\Documents\Codex\2026-09-07\new-chat-2\outputs\产品信息表1_英文版.xlsx`。
> 我已把它**复制**（不是移动）到项目的 `data/raw/` 目录，并校验过复制前后 SHA-256 完全一致。
> 原始位置的文件一个字都没动。

### 1.2 三件不可篡改保证

1. **原始文件只读**：清洗程序只读取 `data/raw/` 下的文件，从不写入。验收测试第 10 项会检查该目录下只有 `.xlsx`。
2. **哈希冻结**：每次运行都会重新计算 SHA-256 并与冻结值比对。只要原文件被改动过一个字节，验收测试第 1 项立刻失败。
3. **原文逐字留档**：`data/derived/staging-records.raw.csv` 保存了每条记录在 Excel 里的原始文本（含换行与多余空格）。验收测试第 2 项会**随机抽样 31 条回到 Excel 逐字比对**。

---

## 2. 原始记录数量

### 2.1 按工作表拆分

共 **17 个工作表**（与规划 V1 第 1.2 节描述一致：1 主目录 + 14 品牌目录 + 1 补充表 + 1 空白表）。

| # | 工作表 | 类型 | 最大行 | 最大列 | **提取记录数** |
|---|---|---|---|---|---|
| 1 | Product Information | 主目录 | 237 | X (24) | **385** |
| 2 | BYD | 品牌 | 26 | L (12) | 21 |
| 3 | Volkswagen | 品牌 | 37 | L (12) | 48 |
| 4 | Geely and Haval | 品牌 | 30 | L (12) | 12 |
| 5 | Changan | 品牌 | 37 | L (12) | 15 |
| 6 | Great Wall and Haval | 品牌 | 29 | L (12) | 9 |
| 7 | BMW and Mercedes-Benz | 品牌 | 15 | L (12) | 24 |
| 8 | Mitsubishi | 品牌 | 24 | L (12) | 14 |
| 9 | Chery | 品牌 | 25 | L (12) | 25 |
| 10 | GM | 品牌 | 41 | L (12) | 37 |
| 11 | Roewe and MG | 品牌 | 42 | L (12) | 10 |
| 12 | Japanese Vehicles | 品牌 | 42 | N (14) | 26 |
| 13 | Ford | 品牌 | 42 | N (14) | 25 |
| 14 | Trumpchi | 品牌 | 29 | N (14) | 6 |
| 15 | Peugeot and Citroen | 品牌 | 28 | N (14) | 36 |
| 16 | Sheet1 | 补充表 | 279 | M (13) | **277** |
| 17 | Sheet2 | 空白/孤立 | 1 | A (1) | 0 |

**原始记录合计：970 条**

### 2.2 与规划 V1 预估的差异说明

规划 V1 第 1.2 节预估「约 696 条目录记录 + Sheet1 约 277 条」。实测：

| 项目 | 规划预估 | 本次实测 | 差异原因 |
|---|---|---|---|
| 目录记录 | 约 696 | **693** | 完全吻合 |
| Sheet1 补充记录 | 约 277 | **277** | 完全吻合 |
| 合计 | 约 973 | **970** | 差 3 条：3 条记录 OEM 与 Bowen No. 同时为空，属空白块，未计入 |

> 规划 V1 的基数估算得到验证。这说明规划文档里的数字是可靠的，可以继续作为工作依据。

### 2.3 版面结构（重要）

原表的物理结构和普通表格不一样，这是导致「696 条 vs 432 个编号」的原因：

- **主目录**：一行里横向并排**两个产品块**（A–F 列一块，G–L 列一块），所以 237 行产生了 385 条记录。
- **品牌表**：同样是每行两块，每块 6 列（`Japanese Vehicles`、`Ford`、`Trumpchi`、`Peugeot and Citroen` 这 4 张表多一列 `Unit Price`，每块 7 列）。
- **Sheet1**：单块布局，表头是 `Image / OEM / Vehicle Model / Part No. / Temp. / Tianbo No.`。

**发现一个数据陷阱**：Sheet1 的列名写着「Vehicle Model（车型）」，但里面装的其实是 **OEM 号**。在 277 条 Sheet1 记录中，有 **39 条**该列内容实际是 OE 号。程序已按 OE 号处理，并写入 `issues-oe-kept-whole.csv` 待确认。

---

## 3. 产品数量

| 指标 | 数量 | 说明 |
|---|---|---|
| **产品数（按 Bowen No. 聚合）** | **466** | 多条原始记录指向同一个 Bowen No. 时合并为一个产品 |
| 有 Bowen No. 的产品 | 459 | |
| **无 Bowen No. 的产品** | **7** | 原表就没编号，给临时 ID `bwp-0001`~`bwp-0007`，待补录 |
| **不重复 Bowen No.** | **459** | |

### 3.1 与规划 V1 预估「约 432 个」的差异

实测 459 个，比预估多 27 个。原因已查明，不是错误：

1. **变体号被计入**：原表存在 `3004` / `3004-1` / `3004-3` / `3004-4` / `3004-5`、`3033` / `3033-Z`、`3654` / `3654-1` 这类「基础号相同、后缀不同」的编号，共 **18 个变体族**。规划 V1 估算 432 时很可能把变体算作同一产品。
2. **Sheet1 引入了主目录没有的编号**：Sheet1 有部分 Bowen No.（如 `3544`、`3312`、`3665`、`38241`）在主目录中不存在。

**这是一个需要业务方回答的问题**：`3004-3` 和 `3004` 是**同一个产品的不同状态**，还是**两个不同产品**？目前系统按「两个不同产品」处理（因为原表把它们写在不同的产品块里），但保留了 `bowen_base_key` 字段，随时可以合并。完整变体族清单见 `data/derived/duplicates-bowen.csv`。

### 3.2 产品分层结果

按规划 V1 第 12 节要求分三层：

| 状态 | 数量 | 占比 | 含义 | 可否站内搜索 | 可否被 Google 索引 |
|---|---|---|---|---|---|
| `PUBLISHED` | **72** | 15.5% | 资料最完整，可作为第一批样板 | ✅ | ❌（见 6.3） |
| `SEARCHABLE_BUT_NOINDEX` | **300** | 64.4% | 字段基本完整，但待业务确认 | ✅ | ❌ |
| `DRAFT` | **94** | 20.2% | 缺关键适配信息，不对外公开 | ❌ | ❌ |

**分层规则是写死在程序里的，可以复核**：

- `DRAFT`：缺 Bowen No.，或没有 OE 号，或没有车型/应用信息
- `SEARCHABLE_BUT_NOINDEX`：有编号、有 OE、有应用，但 OE 少于 2 个，或缺车型品牌，或缺温度，或缺尺寸；**或触发列错位风险告警（见 8.4）**
- `PUBLISHED`：Bowen No. + OE ≥ 2 个 + 车型品牌 + 开启温度 + 尺寸，五项齐全，且无列错位告警

### 3.3 产品来源分布（一个产品可能同时出现在多张表）

| 来源工作表 | 涉及产品数 |
|---|---|
| Product Information（主目录） | 375 |
| Sheet1（补充表） | 225 |
| Volkswagen | 48 |
| GM | 37 |
| Peugeot and Citroen | 36 |
| Japanese Vehicles | 26 |
| Chery | 25 |
| Ford | 24 |
| BMW and Mercedes-Benz | 24 |
| BYD | 20 |
| Changan | 15 |
| Mitsubishi | 14 |
| Geely and Haval | 12 |
| Roewe and MG | 10 |
| Great Wall and Haval | 9 |
| Trumpchi | 5 |

---

## 4. 重复数量

重复检测分四个层面做，因为「重复」在 B2B 产品目录里有好几种完全不同的含义。

### 4.1 汇总

| 检测项 | 数量 | 性质 |
|---|---|---|
| 同一 Bowen No. 在原表重复出现 | **303** 个编号 | ⚠️ 需业务处理 |
| 其中：跨工作表重复 | **303** 个编号全部跨表 | ⚠️ 最可能是重复录入 |
| 其中：同表内重复 | 0 | |
| 同一 Bowen No. 跨表登记的 OE 不一致 | **162** 个编号 | ⚠️ 需业务处理 |
| Bowen 变体族（基础号相同、后缀不同） | **18** 族 | ❓ 需业务定义 |
| 同一 OE 号被多个产品引用 | **136** 个 OE 号 | ⚠️ 需业务确认 |
| 同一产品内重复写同一个 OE 号 | 已自动去重 | ✅ 已处理 |
| 版面重复单元格（同一段 OEM 文本被写进两个产品块） | **2** 处 | ✅ 已剔除并留证 |

### 4.2 「303 个 Bowen No. 重复」怎么理解

这是**最重要的一条**。举例：Bowen No. `3005` 同时出现在 6 张表里：

```
Product Information + BYD + Geely and Haval + Great Wall and Haval + Mitsubishi + Sheet1
```

这**不一定是错误**——品牌目录本来就是主目录的子集，用来按品牌查货。但它带来两个实际风险：

1. **同一编号在不同表里登记了不同的 OE 号**（162 个编号存在这个问题，见下）。
2. 未来做网站时，如果直接按「表」发布，会出现大量重复页面。

**处理方式**：系统已把它们合并成**一个产品**（所以 693 条目录记录 → 466 个产品），并在 `source_sheet` 字段里记录全部来源，便于追溯。

### 4.3 最严重的发现：同一编号、不同 OE 清单

**162 个 Bowen No. 在不同工作表里登记的 OE 号不一致。** 举几个例子：

| Bowen No. | OE 并集 | 具体情况 |
|---|---|---|
| `3005` | 57 个 | Product Information 缺 44 个；BYD 缺 42 个；Geely and Haval / Great Wall and Haval 各缺 42 个；Mitsubishi 缺 56 个；Sheet1 缺 13 个 |
| `3016` | 25 个 | Product Information 缺 17 个；Ford 缺 19 个；Sheet1 缺 9 个 |
| `3020` | 20 个 | Product Information 缺 4 个；Ford 缺 14 个；Sheet1 缺 16 个 |
| `3001` | 19 个 | Product Information 缺 14 个；Volkswagen 缺 14 个；Sheet1 缺 5 个 |
| `3011` | 14 个 | Product Information 缺 10 个；Japanese Vehicles 缺 14 个；Sheet1 缺 4 个 |

**这意味着什么**：如果只拿 `Product Information` 一张表做网站，`3005` 这个产品会丢掉 44 个 OE 交叉号——海外采购商拿着其中一个号来搜，就搜不到博文的产品。**这是直接影响询盘转化率的漏损。**

**好消息**：系统的合并逻辑已经把这些 OE 号**全部收集到同一个产品下**（`3005` 现在挂 57 个 OE 号）。所以数据库层面已经修好了。但**哪张表是对的、有没有录错的号，必须业务方确认**——完整清单见 `data/derived/duplicates-bowen.csv`。

### 4.4 同一 OE 号被多个产品引用（136 个）

举个最典型的例子：

| OE 号 | 引用它的产品 |
|---|---|
| `LF7015170` | Bowen `3020`、`33910`、`3548` |
| `4M5G8575FC` | Bowen `3020`、`33910`、`3548` |
| `1302167` | Bowen `3020`、`33910`、`3548` |
| `1X4Z8575B` | Bowen `3203`、`32138`、`33663-1` |
| `938103K000` | Bowen `5016`、`5016B`、`5018` |

三种可能，**必须由业务方判定**：
1. **一号多型**（同一 OE 号对应多个不同结构的产品）→ 搜索时应全部展示
2. **替代/升级关系**（新号替换旧号）→ 搜索时应提示替代关系
3. **录错**（其中一个 Bowen No. 挂错了 OE）→ 应修正

**目前系统不猜，统一标记 `fitment_confidence = review_required`。** 完整清单见 `data/derived/duplicates-oe.csv`。

### 4.5 Bowen 变体族（18 族）

| 基础号 | 变体 | 个数 |
|---|---|---|
| `3004` | 3004 / 3004-1 / 3004-3 / 3004-4 / 3004-5 / `3004--33503` | 6 |
| `3033` | 3033 / `3033--1` / 3033-Z / `3033-Z138*95*251` | 4 |
| `3041` | 3041 / 3041-1 / 3041-2 / `3041-2(3003) Sealing ring` | 4 |
| `3654` | 3654 / `3654--2` / 3654-1 / 3654-3 | 4 |
| `3002` | 3002 / 3002-1 / 3002-DQ | 3 |
| `3003` | 3003 / 3003-1 / 3003-3 | 3 |
| `3665` | 3665 / 3665-1 / `3665-188℃` | 3 |
| 其余 11 族 | 各 2 个变体 | 22 |

注意 `3004--33503`、`3033-Z138*95*251`、`3665-188℃` 这类写法——它们把**两个编号或尺寸温度塞进了一个单元格**。这类记录已被打上「列错位风险」标记并**禁止自动上线**（见 8.4）。

---

## 5. OE 数量

| 指标 | 数量 |
|---|---|
| **OE 明细行数**（一行 = 一个产品的一个 OE 号） | **2,364** |
| **不重复 OE 号**（搜索标准化后） | **2,211** |
| 不重复 OE 号（同时忽略 `/` 和 `.` 的宽松匹配） | 2,211 |
| 平均每产品 OE 数 | 5.07 |
| 单个产品最多 OE 数 | **57**（Bowen `3005`） |

### 5.1 与规划 V1 预估「约 642 条有 OEM 号」的差异

实测有 OE 号的产品是 **449 个**，OE 明细行 **2,364 条**。规划里的「642 条」是**按原始记录块**数的，而 2,364 是**把单元格里的多个号拆开之后**数的。

举例说明拆分的威力：`Product Information!C6` 这一个单元格里装着 **16 个** OE 号：

```
4711306950  WV56TB SMD337408E SMW252165E MD158570 2551042100 1136000156
1023779300 LFB479Q1306100A 1014944100  9091603129 9091603075 9091603084
```

原表把 16 个号挤在一个单元格里，采购商**不可能**通过搜索找到其中任何一个。拆分后，这 16 个号都能独立命中。

### 5.2 OE 每产品分布

| OE 个数 | 产品数 |
|---|---|
| 0 个 | 17 |
| 1 个 | 126 |
| 2–3 个 | 130 |
| 4–5 个 | 63 |
| 6 个及以上 | **130** |
| 最多 | 57 |

### 5.3 多 OE 拆分规则（可复核）

拆分按三层优先级执行，**每一步都留证据**：

| 优先级 | 依据 | 处理 | 数量 |
|---|---|---|---|
| 1 | 换行符 | 直接拆 | — |
| 2 | 连续 2 个以上空格 | 直接拆 | — |
| 3 | 单个空格 | **仅当每一段看起来都是 OE 号时才拆**，并标记 `oe_split_ambiguous = yes` | **1,621** |
| 兜底 | 段落里混有品牌名等非 OE 片段 | **不拆，整段保留**并标记待人工确认 | **45** |

被剔除的异常 token：

| 情况 | 数量 | 例子 |
|---|---|---|
| 归一化后超过 25 位（两个号粘在一起） | 26 | `19300PDA01 0619359B306 WV52BC ...`（396 位） |
| 不标准（太短/纯品牌名） | 24 | `LCAR`、`TOYOTA`、`NISSAN`、`Assembly OE No`、`13H` |
| 版面重复单元格 | 2 | 主表某些行把同一段 OEM 文本写进了左右两个产品块 |

**兜底策略说明**：像 `9091603046 TOYOTA 9091603060 TOYOTA ...` 这种单元格，程序**拒绝猜测**——因为无法确定 `TOYOTA` 是分隔标记还是车型信息。整段原样保留并标记 `review_required`，交由人工处理。完整清单见 `data/derived/issues-oe-kept-whole.csv`。

### 5.4 OE 搜索标准化规则

按规划 V1 第 6.2 节实现，搜索时自动处理：

| 处理 | 规则 | 例子 |
|---|---|---|
| 忽略大小写 | 统一转大写 | `03c121113q` → `03C121113Q` |
| 忽略空格 | 删除所有空格（含全角） | `03C 121 113Q` → `03C121113Q` |
| 忽略短横线 | 删除各类短横线（`-` `‐` `‑` `‒` `–` `—` `―`） | `25500-35540` → `2550035540` |
| 保留 `/` 和 `.` | 它们是 OE 号的真实组成部分 | `V7920/J` 保持原样 |

**已验证**：`25500-35540` 和 `2550035540` 两种写法会命中**同一个** OE 记录（见验收测试第 4 组）。

同时另外提供 `oe_match_key` 字段（进一步忽略 `/` 和 `.`），供未来做更宽松的「Related reference（相关参考）」匹配使用。

---

## 6. 车型数量

| 指标 | 数量 |
|---|---|
| **车型品牌数**（标准化后） | **87** |
| **原始车型片段数**（按 `;` 和换行切分、去重） | **509** |
| 车型品牌关系行数 | 552 |
| 发动机代码候选数 | 213 个 token（**一律标记待确认**，见 6.4） |
| 排量候选数 | 37 种写法（**一律标记待确认**） |

### 6.1 车型品牌标准化规则

原文是一列自由文本（`Vehicle / Engine Applications`），混装品牌、车型、发动机、年份。处理原则：

- **只统一拼写，不新增原文没有的品牌。**
- 建立了一张 **87 个标准名 + 别名**的对照表（`tools/lib/normalize.mjs` 的 `MAKE_ALIASES`），长别名优先匹配，避免 `Ford` 抢先匹配掉 `Changan Ford`。
- 未命中品牌表的文本**原样保留在 `application_notes`**，不猜测、不丢弃。

标准化示例：

| 原文写法 | 标准化为 |
|---|---|
| `VW` / `大众` | `Volkswagen` |
| `SAIC GM` / `Shanghai GM` / `上汽通用` | `SAIC-GM` |
| `Liuzhou Wuling` / `Wuling` / `五菱` | `SAIC-GM-Wuling` |
| `Mercedes Benz` / `Benz` / `奔驰` | `Mercedes-Benz` |
| `Citroën` / `雪铁龙` | `Citroen` |
| `UZ-DAEWOO` | `Daewoo` |
| `Bestune` / `奔腾` | `FAW Mazda`（同集团条目，**建议业务复核**） |

### 6.2 87 个车型品牌全清单

```
Audi, BMW, BYD, Beijing Hyundai, Brilliance, Buick, Cadillac, Changan, Changan Ford,
Changfeng, Changhe Suzuki, Chery, Chevrolet, Chrysler, Citroen, Cowin, DFSK, Daewoo,
Delphi, Dodge, Dongan, Dongan Mitsubishi, Dongfeng, Dongfeng Peugeot Citroen, FAW,
FAW Mazda, FAW Toyota, Fiat, Ford, Foton, GAC FCA, GAC Toyota, GAC Trumpchi, GMC,
Geely, Great Wall, Haima, Haval, Hawtai, Honda, Hongqi, Huaihai, Hyundai, Infiniti,
Isuzu, JAC, Jeep, Jiangling, Kia, Lancia, Land Rover, Landwind, Lexus, Lifan, Lincoln,
MG, Maxus, Mazda, Mercedes-Benz, Mianyang Xinchen, Mitsubishi, Nissan, Opel, Peugeot,
Porsche, Renault, Roewe, SAIC, SAIC-GM, SAIC-GM-Wuling, SEAT, Shanghai Maple,
Shenyang Mitsubishi, Shenyang Xinguang, Skoda, Soueast, SsangYong, Subaru, Suzuki,
Toyota, UAES, Volkswagen, Volvo, WEY, Xiali, Zhejiang Gonow, Zotye
```

> ⚠️ **需要业务方复核 3 项**：
> 1. `UAES`（联合汽车电子）和 `Delphi` 是**零部件系统供应商**，不是整车品牌。它们出现在车型文本里通常表示「用 UAES 系统的发动机」。建议从「按品牌浏览」里移出，单列为「Engine management system」。
> 2. `Dongan`、`Mianyang Xinchen`、`Shenyang Xinguang`、`Shenyang Mitsubishi`、`Dongan Mitsubishi` 是**发动机厂**，同上处理。
> 3. `Ford` 与 `Changan Ford` 是否为独立品牌？目前分开计。

### 6.3 `vehicle_model`（车型）字段为空——这是刻意的

规划 V1 要求 `vehicle_model` 字段。但原表把品牌、车型、发动机、年份**混在一列自由文本**里：

```
"Mitsubishi 4G6 471Q Lancer BYD F3 Geely 4G13 Geely Emgrand Liuzhou Wuling engine
 Great Wall Peri Florid Haval 2.4"
```

从这种文本里可靠地切出「车型」而不猜测，是做得到的**反面**。所以：

- `vehicle_model` 字段**留空**（完整率 0%），并标记 `vehicle_model_status = review_required`
- 原文**完整保留**在 `application_notes` 字段
- 已经建好 `data/derived/product-vehicle-makes.csv` 关系表，只要业务方确认品牌-车型对应关系，就能批量补录

**这是遵守「不确定的数据不得自行补全」的结果，不是缺陷。**

### 6.4 `engine_code`（发动机代码）同样标记待确认

原表**没有独立的发动机代码列**。程序从自由文本抽取出 213 个候选 token，但抽出来的东西**混着发动机代码和车型名**：

| 是发动机代码（合理） | 是车型/底盘代号（混入） |
|---|---|
| `EA111`、`EA888`、`EA211`、`GW4B13`、`M274`、`JL476ZQCA`、`TU5JP4`、`D4G15`、`4G13`、`MR20`、`KA24` | `CS75`、`B70`、`C4L`、`A6L`、`GL8`、`RX5`、`GS8`、`H6`、`X80`、`F30` |

**处理方式**：程序**不声称**这些是发动机代码。
- 产品表的 `engine_code` 字段保存候选值，但**必须**带 `engine_code_status = review_required`
- 关系表 `product-engine-codes.csv` 里 `engine_code` 一律写 `REVIEW_REQUIRED`，候选值放在 `candidate_token` 列
- 验收测试会强制检查：`engine_code` 有值就必须有 `review_required` 状态

---

## 7. 字段完整率

**产品数 = 466**（分母）。

### 7.1 规划 V1 要求字段的完整率

| 字段 | 已填 | 完整率 | 状态 |
|---|---|---|---|
| `product_id` | 466 | **100.0%** | ✅ |
| `product_type` | 0 | **0.0%** | ⛔ 必须人工确认，程序禁止自动填 |
| `product_name_en` | 0 | **0.0%** | ⛔ 必须人工确认，程序禁止自动填 |
| `bowen_no` | 459 | **98.5%** | ✅ 7 个缺号待补录 |
| `status` | 466 | **100.0%** | ✅ |
| `oe_number_raw` | 449 | **96.4%** | ✅ |
| `oe_number_normalized` | 449 | **96.4%** | ✅ |
| `vehicle_make` | 317 | **68.0%** | ⚠️ 149 个产品未能识别出品牌 |
| `vehicle_model` | 0 | **0.0%** | ⛔ 原表未区分，见 6.3 |
| `engine_code` | 142 | **30.5%** | ⚠️ 候选值，全部待确认，见 6.4 |
| `engine_displacement` | 114 | **24.5%** | ⚠️ 候选值，全部待确认 |
| `application_notes` | 384 | **82.4%** | ✅ |
| `opening_temperature_c` | 250 | **53.6%** | ✅ 只提取带单位的数值 |
| `dimensions` | 97 | **20.8%** | ⚠️ 原表仅 97 个产品写了完整 D1/d2/A |
| `housing_type` | 0 | **0.0%** | ⛔ 必须人工确认，程序禁止自动填 |
| `source_sheet` | 466 | **100.0%** | ✅ |
| `source_row` | 466 | **100.0%** | ✅ |
| `source_version` | 466 | **100.0%** | ✅ |
| `fitment_confidence` | 466 | **100.0%** | ✅（全部 `review_required`） |
| `searchable` | 372 | **79.8%** | ✅ |
| `indexable` | 0 | **0.0%** | ⛔ 见 7.3 |
| `last_verified_at` | 0 | **0.0%** | ⛔ 尚无人工复核，必须为空 |
| `verified_by` | 0 | **0.0%** | ⛔ 尚无人工复核，必须为空 |

**平均核心字段完整率：60.6%**
**平均增强字段完整率：12.9%**

### 7.2 为什么 `product_type` 完整率是 0%

规划 V1 第 10.1 节原文：**「`product_type` | 产品分类 | 必须人工确认」**。

原表确实**没有任何产品类型列**，也没有可以可靠推断的结构化字段。程序**只给建议、不下结论**：

- 每个产品有 `product_type_suggestion` 字段，建议值来自 `application_notes` 里**明确写出**的关键词
- `product_type` 正式字段一律写 `REVIEW_REQUIRED`
- `product_type_evidence` 记录命中了哪些关键词，便于人工核对

**466 个产品的建议分布（实测）**：

| 建议值 | 产品数 | 是否有原文证据 |
|---|---|---|
| `Thermostat (unconfirmed)` | **420** | ❌ 原文没有任何区分性关键词 |
| `Thermostat Assembly`（含组合建议） | 20 | ✅ 原文写了 `assembly` / `subassembly` |
| `Thermostat Insert`（含组合建议） | 13 | ✅ 原文写了 `insert` |
| `Electronic Thermostat`（含组合建议） | 11 | ✅ 原文写了 `electronic` |
| `Thermostat Housing`（含组合建议） | 4 | ✅ 原文写了 `housing` |
| `Water Pump Assembly`（含组合建议） | 4 | ✅ 原文写了 `water pump` |
| `Temperature Sensor` | 1 | ✅ |
| `Switch` | 1 | ✅ |

（部分产品命中多个关键词，所以合计大于 466。）

**这里有一个必须让业务方知道的重要发现：**

> **420 个产品（占 90%）在原表里完全看不出产品类型。**
> 而规划 V1 第 4 节要求网站导航把 `Thermostats`、`Thermostat Assemblies`、`Thermostat Inserts`
> 做成**三个独立分类**，第 5.2 节还要求用 `With housing / insert / assembly` 做筛选器。

**这意味着**：如果现在就开始做网站，90% 的产品无法归类，三个分类页面里有两个会是空的。
`product_type` 不是「补一个字段」的问题，而是**需要人工逐条判定 466 个产品**的工作量。

**验收测试会强制检查这一点**：只要有任何一个产品的 `product_type` 不是 `REVIEW_REQUIRED`，测试就失败。

有原文证据的 46 个产品可以直接确认，这 46 个里包含了第一批推荐名单中的一部分，**建议从这里开始人工确认**。

### 7.3 为什么 `indexable` 全部是 0%

规划 V1 第 10.4 节要求把「能否被 Google 索引」和「能否站内搜索」**分开**。

我的建议是：**`product_type` 还没人工确认之前，任何产品都不应该被 Google 索引。**

理由：如果产品类型是错的，Google 收录的页面标题、面包屑、结构化数据全都是错的，等发现时已经积累了大量错误索引，清理成本远高于现在等一等。

所以：
- `searchable`（站内搜索）：`PUBLISHED` 和 `SEARCHABLE_BUT_NOINDEX` 两层都开放，共 372 个产品
- `indexable`（Google 索引）：**全部 `no`**，等 `product_type` 确认后再开放

### 7.4 未填充字段的证据来源

以下字段原表**完全没有对应列**，程序留空未填：`housing_type`、`connector_type`、`material`、`test_standard`、`image_urls`、`document_urls`、`model_year_from/to`。

**关于产品图片**：原表每个产品块都有 `Image` 列，但列里**没有任何文字或路径**（检查了全部 953 个产品块，0 个有内容）。图片应该是直接嵌在 Excel 里的浮动图片对象。**图片与 Bowen No. 的对应关系是阶段二必须补齐的前置条件**（规划 V1 第 14 节也列了这一条）。

---

## 8. 异常数据

### 8.1 异常汇总

| 异常类型 | 数量 | 处理 | 留证文件 |
|---|---|---|---|
| **列错位风险：Bowen 单元格含尺寸样式文本** | 见 8.4 | 降级为 `SEARCHABLE_BUT_NOINDEX`，禁止自动上线 | `products.csv` → `quality_flags` |
| Bowen No. 单元格含两个编号 | 见 8.4 | 同上 | 同上 |
| **Bowen No. 混入描述文字** | 43 处 | 拆分编号与描述，两段都保留 | `issues-bowen-anomalies.csv` |
| OE 单个空格推断拆分 | 1,621 处 | 已拆 + 标记 `oe_split_ambiguous` | `issues-oe-ambiguous-splits.csv` |
| OE 段落混有非 OE 片段 | 45 处 | **不拆**，整段保留待确认 | `issues-oe-kept-whole.csv` |
| OE 归一化后过长（两个号粘连） | 26 处 | 剔除 + 留证 | `issues-oe-oversized.csv` |
| OE 不标准（太短/纯品牌名） | 24 处 | 剔除 + 留证 | `issues-oe-nonstandard.csv` |
| 版面重复单元格 | 2 处 | 剔除 + 留证 | `issues-duplicate-oe-cells.csv` |
| Sheet1「Vehicle Model」列实为 OE 号 | 39 条 | 按 OE 号处理 | `sheet-inventory.json` |
| Sheet1 出现未解释字段 `Tianbo No.` | 73 条 | **原样保留**，不解读 | `staging-records.raw.csv` → `tianbo_raw` |
| 有 OE 号但无 Bowen No. | 6 条 | 保持缺失待补录 | — |
| 有 Bowen No. 但无 OE 号 | 19 条 | 保持缺失待补录 | — |
| Excel 浮点残留垃圾值 | 0 处 | 检测逻辑已就绪但未发现 | `issues-ignored-garbage-cells.csv` |

### 8.2 Bowen No. 混入描述文字（43 处）

`BMW and Mercedes-Benz` 表里的写法：

| 原始值 | 提取出的编号 | 提取出的描述 |
|---|---|---|
| `3511 With small pipe` | `3511` | With small pipe |
| `3579 With small pipe` | `3579` | With small pipe |
| `3588 Without small pipe` | `3588` | Without small pipe |
| `Without small pipe` | （空） | Without small pipe |

**最后一行是个真问题**：`BMW and Mercedes-Benz!K4` 的 Bowen 单元格里**只有描述、没有编号**。程序正确地留空了——没有猜它属于哪个编号。**请业务方补录。**

### 8.3 编号与尺寸/温度挤在同一单元格

| 位置 | 原始值 |
|---|---|
| `Product Information!E20` | `3033-z  138*95*251` |
| `Product Information!K55` | `3520  120*85*90` |
| `Product Information!K56` | `3522  15*14*8.5` |
| `Sheet1!D20` | `3029  92°` |
| `Mitsubishi!E6` | `3004--3  3503` ← **两个编号** |
| `Sheet1!D9` | `3011-2\n3565` ← **两个编号** |
| `Product Information!K115` | `35059  F059` |
| `Product Information!K107` | `3919(35401)` |
| `Japanese Vehicles!E6` | `3069（3076）` |
| `Product Information!E120` | `30302(3334 Sealing ring)` |
| `Product Information!K122` | `3929(3019 Sealing ring)` |
| `Product Information!K125` | `35116(Deben)` |
| `Sheet1!D24` | `3035(3403 Sealing ring)` |
| `Product Information!E129` | `3041-2(3003) Sealing ring` |

### 8.4 列错位风险 —— 本次最重要的数据质量发现

上表里 `3520  120*85*90` 这种写法暴露了一个**结构性风险**：

> 如果 Bowen No. 列里混进了尺寸 `120*85*90`，那么**尺寸列里装的很可能就是 Bowen No.**，温度列里装的很可能是别的产品的东西。

**也就是说：这些行的整行数据可能是错位的。**

程序的处理是**防御性的**（`has_attribute_warnings` 字段）：

1. 检测 Bowen 单元格里是否有 `数字*数字` 的尺寸样式文本 → 有则告警
2. 检测 Bowen 单元格里是否有两个编号 → 有则告警
3. **任何带告警的产品，一律禁止进入 `PUBLISHED`**，强制降为 `SEARCHABLE_BUT_NOINDEX`，并在 `quality_flags` 写明原因
4. **第一批推荐上线清单会再次过滤掉所有带告警的产品**

**这条规则是硬性的**：验收测试第 8 组会检查「第一批不含任何带列错位告警的记录」，以及「所有带告警的记录都不在 PUBLISHED 层」。

**需要业务方做的事**：把 `Product Information` 的 E、K 两列（以及 `Sheet1` 的 D 列）拿去和原表核对，确认这些行的温度、尺寸到底属于哪个编号。这不是程序能解决的问题。

### 8.5 未解读的字段：`Tianbo No.`

`Sheet1` 有一个列名叫 `Tianbo No.`（天博编号？），共 **73 条**有值。

规划 V1 第 1.2 节已提到「出现 Tianbo No. 等尚未解释的字段」。**程序原样保留在 `tianbo_raw` 字段，不解读、不用于任何逻辑。** 请业务方说明这是什么。

---

## 9. 第一批推荐上线产品（72 个）

### 9.1 筛选标准

从 466 个产品中筛选，**五道硬门槛全部通过**才进入推荐名单：

1. `status = PUBLISHED`（Bowen No. + OE + 车型 + 温度 + 尺寸五项齐全）
2. 有 Bowen No.
3. OE 号 ≥ 2 个
4. `has_attribute_warnings = no`（无列错位风险）
5. 按 `data_quality_score` 降序排列，取前 100 个

评分权重（可复核）：

| 加分项 | 分值 |
|---|---|
| 有 Bowen No. | +10 |
| OE 个数（每个 +3，上限 8 个） | 最多 +24 |
| OE ≥ 2 个 | +6 |
| 有车型品牌 | +8 |
| 有应用信息 | +8 |
| 有开启温度 | +6 |
| 有尺寸 | +6 |
| 有发动机代码候选 | +5 |
| 有排量 | +3 |
| 来自主目录 | +6 |
| 多来源记录（≥2 条） | +4 |

**合格池：72 个产品，全部入选**（72 已在 50–100 的目标区间内），**分数区间 56 ~ 86 分**。

另有 **11 个产品**因触发「列错位风险」告警被**主动排除**，不在推荐名单内 —— 它们全部被降级为 `SEARCHABLE_BUT_NOINDEX`，没有任何一个留在 `PUBLISHED` 层（验收测试会强制检查这一点）。这 11 个需要先由业务方核对原表列位置，才能重新参与评选。

### 9.2 推荐名单（按数据完整度降序）

| # | Bowen No. | OE 数 | 主要车型品牌 | 开启温度(℃) | 尺寸 | 来源表数 |
|---|---|---|---|---|---|---|
| 1 | `3005` | 57 | SAIC-GM-Wuling、Mitsubishi、Great Wall、Geely、Haval、BYD | 76.5、82 | D1=56 d2=28 A=43 | 6 |
| 2 | `3064` | 52 | Nissan | 82 | D1=54.5 d2=28 A=34 | 3 |
| 3 | `3061A` | 25 | Dongfeng、Honda | 78 | D1=52 d2=28 A=35 | 2 |
| 4 | `3069` | 20 | Zhejiang Gonow、Great Wall、Haval | 76.5、82 | D1=56 d2=28 A=36.5 | 4 |
| 5 | `3008` | 13 | Buick | 90 | D1=44 d2=23.4 A=33 | 3 |
| 6 | `3066` | 8 | SAIC-GM、SAIC-GM-Wuling、Lifan | 82 | D1=44 | 3 |
| 7 | `3503` | 8 | Hyundai、Changan | 76.5、82 | D1=64 d2=28 A=45 | 3 |
| 8 | `3051` | 49 | Shenyang Xinguang、Mianyang Xinchen、SAIC-GM-Wuling、Great Wall、Geely、Lifan、Toyota、Nissan | 76.5、82 | D1=48 d2=28 A=33 | 5 |
| 9 | `3077` | 31 | Haima、FAW | 82 | D1=52 d2=28 A=40 | 3 |
| 10 | `3025` | 30 | Changhe Suzuki | 82、87 | D1=44 | 3 |
| 11 | `3076` | 20 | Shenyang Xinguang、Mianyang Xinchen、Toyota | 76.5、82 | D1=56 d2=28 A=33.5 | 4 |
| 12 | `3027` | 15 | SAIC-GM-Wuling、Changan、Dongan、Haima、DFSK | 82、88、91、92 | D1=44 | 3 |
| 13 | `3019` | 12 | Geely、BYD | 82 | D1=52 d2=33 A=50 | 5 |
| 14 | `3074` | 12 | Shenyang Mitsubishi、Brilliance、Haima | 82、87 | D1=52 | 3 |
| 15 | `3023` | 11 | Dongfeng、DFSK | 82 | D1=56 | 3 |
| 16 | `3583` | 10 | Cadillac | 86 | D1=56 d2=40 A=50 | 2 |
| 17 | `3550` | 8 | Mianyang Xinchen、Toyota | 82 | D1=60 d2=30 A=41 | 3 |
| 18 | `3094` | 22 | Ford | 82 | D1=48 | 3 |
| 19 | `31515` | 22 | Dongfeng、Foton | 82 | D1=58 | 2 |
| 20 | `3061` | 20 | BYD、Honda | 78、82 | D1=52 d2=28 A=35 | 3 |

> 完整 72 个产品的清单（含全部字段）见 **`data/derived/first-batch-published.csv`**。

### 9.3 ⛔ 这 72 个产品现在**还不能**上线

**这一点必须说清楚，避免误解。**

这 72 个产品是**「数据最完整」**的，不是**「已经可以发布」**的。它们仍然卡在同一个地方：**`product_type` 未人工确认**。

所以 `first-batch-published.csv` 里每一行都带着：

```
publish_ready = blocked_until_product_type_confirmed
```

**要真正上线第一批，需要业务方完成 2 件事：**

1. **确认产品类型**：把 72 个产品的 `product_type_suggestion` 逐条确认或修正。
   实测结果：这 72 个产品的建议**全部都是 `Thermostat (unconfirmed)`** —— 也就是说，
   没有任何一个产品的原文里明确写出了 `assembly` / `insert` / `electronic` 等区分性关键词。
   这本身就是一个重要发现：**「节温器总成 / 插入式节温器」这个分类在原表里完全没有标记**，
   而规划 V1 第 4 节却要求把它们做成独立的导航分类。

   → **这意味着 `product_type` 不能靠程序推断，必须由业务方（或懂产品的人）逐条判定。**
   这是阶段二之前最大的一个数据缺口。

2. **确认这是不是想要的第一批**：如果你更希望第一批以「某几个品牌」或「某几类产品」为重点，可以换筛选条件重跑。

---

## 10. 产出文件清单

全部派生产物在 `data/derived/`，**均可安全重跑生成**（原始文件不受影响）。

### 10.1 数据库主文件

| 文件 | 行数 | 内容 |
|---|---|---|
| `products.csv` | 466 | **产品主表**，一行一个产品，含规划 V1 要求的全部字段 |
| `product-oe-index.csv` | 2,364 | **OE 搜索索引**，一行一个「产品 × OE 号」 |
| `product-vehicle-makes.csv` | 552 | 产品 × 车型品牌关系表 |
| `product-engine-codes.csv` | 142 | 发动机代码**候选**表（值全部标 `REVIEW_REQUIRED`） |
| `first-batch-published.csv` | 72 | 第一批上线推荐清单（带 `publish_ready` 标记） |
| `staging-records.raw.csv` | 970 | **原始记录留档**，逐字保留 Excel 原文 |
| `stats.json` | — | 全部统计数据（机器可读） |
| `source-files.json` | — | 原始文件清单 + SHA-256 |
| `sheet-inventory.json` | 17 | 工作表盘点 |

### 10.2 治理清单（待人工处理）

| 文件 | 内容 |
|---|---|
| `duplicates-bowen.csv` | Bowen 重复四种类型全清单 |
| `duplicates-oe.csv` | 共享 OE 号全清单 |
| `issues-bowen-anomalies.csv` | Bowen No. 异常 43 处 |
| `issues-oe-ambiguous-splits.csv` | 单空格拆分 1,621 处（已拆，待确认） |
| `issues-oe-kept-whole.csv` | 整段保留待确认 45 处 |
| `issues-oe-oversized.csv` | 过长剔除 26 处 |
| `issues-oe-nonstandard.csv` | 不标准剔除 24 处 |
| `issues-ignored-garbage-cells.csv` | Excel 浮点垃圾值（0 处） |
| `issues-duplicate-oe-cells.csv` | 版面重复单元格 2 处 |

---

## 11. 代码与可复现性

| 脚本 | 作用 |
|---|---|
| `tools/xlsx-reader.mjs` | 纯 Node.js 实现的 XLSX 读取器（不依赖任何第三方库） |
| `tools/lib/normalize.mjs` | OE / 规格 / 车型 / Bowen No. 标准化规则库 |
| `tools/build-product-db.mjs` | **主清洗程序** |
| `tools/verify-db.mjs` | **验收测试（57 项）** |
| `tools/report-inputs.mjs` | 报告数据导出 |
| `tools/docx-extract.mjs` | 从 .docx 提取规划文档正文 |

**重跑命令**：

```powershell
node tools/build-product-db.mjs   # 重新生成全部派生产物
node tools/verify-db.mjs          # 运行 57 项验收测试
```

**验收测试结果：57 项全部通过。**

测试覆盖：原始文件未被修改、原始记录逐字可追溯、字段完整性、OE 标准化规则、多 OE 拆分正确性、Bowen No. 唯一性、重复识别可用性、车型标准化、第一批推荐合规性、列错位防护、待确认字段未被臆造。

**另外做了几项针对性的正确性抽查**（结果全部符合预期）：

| 抽查项 | 结果 |
|---|---|
| 目录记录数（主目录 + 品牌表） | 693 条，与规划 V1 预估「约 696」吻合 |
| OE 归一化：`25500-35540` 与 `2550035540` | ✅ 命中**同一条** OE 记录 |
| 单单元格拆分 OE 数最多 | `Sheet1!B87` 拆出 **37 个** OE 号 |
| 带开启温度的产品 | 250 个 |
| 带尺寸的产品 | 97 个 |
| **压力规格未被误当温度** | ✅ `1.8±0.2bar`、`0.3±0.15bar` 等全部未进入 `opening_temperature_c`（混入数 = 0） |

最后一项特别重要：原表有一批产品的 Specs 是**压力值**（`bar`）而不是温度，例如 Bowen `2001`~`2005`。程序只提取带 `℃` / `°C` / `度` 单位的值，所以这些压力值被正确地留在了 `other_specs` 里，没有污染温度字段。这类产品大多是**压力开关/传感器**，不是节温器 —— 这也从侧面印证了 `product_type` 必须人工判定的必要性。

---

## 12. 诚实声明：哪些数据**不是**事实

按项目铁律「不得擅自编造公司、产品、认证、客户、MOQ、产能、交期等信息」，以下字段是**推导或建议值**，**不是**已确认事实：

| 字段 | 性质 | 状态 |
|---|---|---|
| `product_type` | 未填 | `REVIEW_REQUIRED` |
| `product_type_suggestion` | **程序建议**，来自原文关键词 | 待业务确认 |
| `product_name_en` | 未填 | 待业务确认 |
| `vehicle_make` | **从自由文本推导** | 待业务确认（另有 3 项分类疑问，见 6.2） |
| `vehicle_model` | 未填 | 待业务确认 |
| `engine_code` | **从自由文本抽取的候选值**，混有车型名 | `review_required` |
| `engine_displacement` | **从自由文本抽取的候选值** | `review_required` |
| `housing_type` | 未填 | 待业务确认 |
| `fitment_confidence` | 全部 `review_required` | 待业务确认 |
| `opening_temperature_c` | 从 Specs 提取，**只取带单位的数值** | 待抽查 |
| `dimensions` | 从 Specs 提取，**只取带 mm 单位的数值** | 待抽查 |
| `unit_price_raw_internal` | **内部单价，绝对不可公开** | 仅供内部参考 |

**图上标注的说明**：原表没有产品图片路径，`image_urls` 全部为空。图片与 Bowen No. 的对应关系待补。

---

## 13. 阶段一结论与下一步

### 13.1 阶段一交付确认

- [x] 读取全部产品 Excel（1 份文件、17 个工作表、970 条记录）
- [x] 建立标准化产品数据（466 个产品、2,364 条 OE 明细）
- [x] 原始数据永久保留（SHA-256 冻结 + 逐字留档 + 自动校验）
- [x] 不确定的数据未自行补全（`product_type` / `vehicle_model` / `indexable` 等全部留空标记）
- [x] 识别重复 Bowen No.（303 个编号重复，其中 162 个存在 OE 清单冲突）
- [x] 识别重复 OE Number（136 个 OE 号被多产品引用）
- [x] 拆分一个单元格中的多个 OE 号（最多一个单元格拆出 16 个号）
- [x] 统一 OE Number 搜索格式（忽略大小写/空格/短横线，已验证 `25500-35540` = `2550035540`）
- [x] 标准化 vehicle make（87 个标准品牌）
- [x] 输出数据质量报告（本文件）
- [x] 推荐 50–100 个第一批上线产品（**72 个**）
- [x] 其余产品分为 Published / Searchable-but-noindex / Draft（72 / 300 / 94）
- [x] **未进入网页开发**

### 13.2 需要业务方确认的 7 件事（进入阶段二的前置条件）

| # | 事项 | 影响 | 相关文件 |
|---|---|---|---|
| 1 | **确认 72 个第一批产品的 `product_type`** | 阻塞第一批上线 | `first-batch-published.csv` |
| 2 | **核对列错位行**：`Product Information` E/K 列、`Sheet1` D 列里混入尺寸或双编号的行 | 影响温度/尺寸正确性 | 本报告 8.4 |
| 3 | **确认 Bowen 变体关系**：`3004-3` 与 `3004` 是一个产品还是两个 | 影响产品数（466 vs 约 448） | `duplicates-bowen.csv` |
| 4 | **确认 136 个共享 OE 号**：一号多型 / 替代关系 / 录错 | 影响搜索结果准确性 | `duplicates-oe.csv` |
| 5 | **确认 3 项品牌分类**：`UAES`/`Delphi`（系统供应商）、发动机厂、`Ford` vs `Changan Ford` | 影响「按品牌浏览」 | 本报告 6.2 |
| 6 | **说明 `Tianbo No.` 是什么** | 可能是重要编号体系 | `staging-records.raw.csv` |
| 7 | **补齐产品图片与 Bowen No. 的对应关系** | 阶段二产品卡片必需 | 规划 V1 第 14 节 |

### 13.3 下一步（等你确认后才开始）

**阶段二：网页开发**——按规划 V1 第 12 节，从以下范围开始：

1. 英文首页（逐屏结构按规划 V1 第 7 节）
2. Thermostats 产品总览
3. OE 号搜索
4. 车型/发动机应用搜索
5. 产品详情页模板
6. RFQ 表单
7. Factory / Quality / About / Contact 页

**但第 1 件事必须先做**：把 72 个产品的 `product_type` 确认下来。否则产品页做出来也没有正确的分类和标题。

---

## 附录 A：Git 版本管理

本项目已建立 Git 仓库。阶段一完成时创建 commit，包含：

- 原始 Excel（`data/raw/`，只读留存）
- 全部派生产物（`data/derived/`）
- 全部脚本（`tools/`）
- 本报告（`docs/`）

**说明**：Git 已通过便携版安装（`git version 2.53.0.windows.3`）。

---

## 附录 B：环境与依赖

| 项目 | 版本/说明 |
|---|---|
| 运行环境 | Node.js v24.9.0 |
| 第三方依赖 | **无**。XLSX 解析、DOCX 解析均为自研纯 Node.js 实现 |
| 原始文件读取 | 只读 |
| 编码 | 全部输出 UTF-8（CSV 带 BOM，便于 Excel 直接打开） |
