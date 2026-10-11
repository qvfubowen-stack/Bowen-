# 产品图片复核结论（Phase 2.7）

**生成时间：2026-09-26T01:16:03.562Z**
**数据来源：`data/processed/product-image-map.json`（SHA-256 `fda22323c6b9fd53561cd92a20ca1a77bbf93bb58142205a05d457d959a2ae18`）**
**业务决定：`data/raw/business-decisions-v3.json`（schema `bowen-business-decisions/v3`，2026-09-25）**
**复核包目录：`data/processed/product-image-review/`**

> 本清单**只做整理，不改任何状态**。`product-image-map.json` 在原样读取后经过
> SHA-256 校验，确认字节未变（见第七节）。
> 本阶段**未修改 `website/`、未把图片接入网站、未重建网站 ZIP**。

---

## 一、业务方决定与执行结果（D1–D9）

业务方原话逐条记录在 `business-decisions-v3.json` 的 `image_review` 段。下表是本轮的**最终结论**。

| # | 业务方回答 | 程序执行结果 |
|---|---|---|
| **D1** | 「编号读不出的部分先忽略」 | ✅ 已执行：14 张保持原状，**未做任何归属推断** |
| **D2** | 「记录行但没编号的类别都是节温器」 | ✅ 已执行：7 张只记录品类为 **Thermostat**；因仍无 Bowen No.，**不生成产品、不做归属** |
| **D3** | 「已入库」 | ✅ 已执行：`38169 / 38298 / 3932 / 32603 / 32748-1` 已补入产品库，对应 5 张图片**已从 review_required 升级为 exact** |
| **D4** | 「确认删除」 | ✅ 已执行：`IMG-0723 / IMG-0787 / IMG-0797 / IMG-0798` 共 4 张已删除，**未导出、无副本、不出现在任何产品下** |
| **D5** | 「忽略这个产品」 | ✅ 已执行：`IMG-0723`（含内部进价的系统截图）已删除，与 D4 一致 |
| **D6** | 「先裁剪」 | ✅ 已执行：`IMG-0780` 已裁剪为 `product-images/unresolved_工作表1_063_cropped.png`（1080×814），原图保留可回溯 |
| **D7** | 「水印保留，这是我们公司商标」 | ✅ 已执行：**重要更正——「GXN」是博文自有商标，不是外部品牌水印**。图片水印原样保留，程序不做任何去水印处理；此前的“水印风险”说明作废 |
| **D8** | 「保留」 | ✅ 已执行：随手拍照片（如 `IMG-0793`）保留，**不要求重拍** |
| **D9** | 「主图你自己选择」 | ✅ 已执行：按确定性规则为 **403** 个有图产品各选出 1 张主图（规则见第六节） |

除此之外：

- 「产能/标准交期先不做了」→ Factory 页的产能/交期**不再作为待补项**推进，也不编造数字。
- 「公司全称、邮箱等看宣传手册」→ 已提取到 `docs/company-info-from-brochure.md`（含公司全称、邮箱、电话、网址、成立年份、厂房面积、三张体系证书等；手册中**没有**街道地址，已注明“手册未载”）。

---

## 二、本轮图片总量与处置分布

| 项目 | 数量 |
|---|---|
| 图片对象总数（锚点） | 798 |
| **exact**（自动关联，无需人工） | 772 |
| **review_required**（能定位到行、缺编号） | 21 |
| **unresolved**（无法映射，程序不猜） | 5 |
| 按业务决定**删除** | 4 |
| 按业务决定**裁剪保留** | 1 |
| 导出到 `product-images/` 的文件 | 794 |
| 实际落盘文件（含裁剪派生图） | 795 |
| **仍需业务方行动** | **22 张（只缺 Bowen No.）** |

> 上一轮复核包的 26 + 5 = 31 张里，**5 张已由 D3 归位、4 张已删除、1 张已裁剪**，
> 剩下的 **22 张**（14 张编号读不出 + 7 张该行未填编号 + 1 张已裁剪的 IMG-0780）
> 现在只缺「博文编号」这一件事。

---

## 三、仍缺 Bowen No. 的 22 张

这 22 张的共同点：**图片本身与它在原表里的位置都已经确定，唯一缺的是「博文编号」**。
补上编号后，程序会自动把它们归位到对应产品（不需要再做别的决定）。

### 3.1 原因分类

| 原因（match_kind） | 数量 | 含义 |
|---|---|---|
| `record_row_bowen_unreadable` | 14 | 锚点行是产品记录行，但「博文编号」单元格读不出合法编号（业务方 D1：**先忽略**） |
| `record_row_without_bowen` | 7 | 锚点行是产品记录行，但没填「博文编号」（业务方 D2：**品类是节温器**） |
| `anchor_outside_record_blocks` | 3 | 锚点列不在任何记录区块内；`IMG-0780` 已按 D6 裁剪保留，同样还缺编号 |

### 3.2 总表

| # | image_id | 图片文件 | 工作表 | 锚点 | 行号 | Bowen No. | product_id | 状态 | 处置 | 原因 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `IMG-0097` | `images/IMG-0097_unresolved_综合产品信息表_097.jpeg` | 综合产品信息表 | `H52` | 52 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 2 | `IMG-0131` | `images/IMG-0131_unresolved_综合产品信息表_131.jpeg` | 综合产品信息表 | `H69` | 69 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 3 | `IMG-0209` | `images/IMG-0209_unresolved_综合产品信息表_209.jpeg` | 综合产品信息表 | `H107` | 107 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 4 | `IMG-0233` | `images/IMG-0233_unresolved_综合产品信息表_233.jpeg` | 综合产品信息表 | `B120` | 120 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 5 | `IMG-0238` | `images/IMG-0238_unresolved_综合产品信息表_238.jpeg` | 综合产品信息表 | `H122` | 122 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 6 | `IMG-0245` | `images/IMG-0245_unresolved_综合产品信息表_245.jpeg` | 综合产品信息表 | `H125` | 125 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 7 | `IMG-0252` | `images/IMG-0252_unresolved_综合产品信息表_252.jpeg` | 综合产品信息表 | `B129` | 129 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 8 | `IMG-0452` | `images/IMG-0452_unresolved_大众系列_046.jpeg` | 大众系列 | `H27` | 27 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 9 | `IMG-0454` | `images/IMG-0454_unresolved_大众系列_048.jpeg` | 大众系列 | `H28` | 28 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 10 | `IMG-0494` | `images/IMG-0494_unresolved_宝马奔驰系列_005.jpeg` | 宝马奔驰系列 | `H4` | 4 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 11 | `IMG-0607` | `images/IMG-0607_unresolved_日系_007.jpeg` | 日系 | `B6` | 6 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 12 | `IMG-0653` | `images/IMG-0653_unresolved_福特系列_027.jpeg` | 福特系列 | `I9` | 9 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 13 | `IMG-0654` | `images/IMG-0654_unresolved_福特系列_028.jpeg` | 福特系列 | `I9` | 9 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 14 | `IMG-0740` | `images/IMG-0740_unresolved_工作表1_023.png` | 工作表1 | `A58` | 58 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 15 | `IMG-0741` | `images/IMG-0741_unresolved_工作表1_024.png` | 工作表1 | `A77` | 77 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 16 | `IMG-0742` | `images/IMG-0742_unresolved_工作表1_025.png` | 工作表1 | `A79` | 79 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 17 | `IMG-0746` | `images/IMG-0746_unresolved_工作表1_029.png` | 工作表1 | `A96` | 96 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 18 | `IMG-0748` | `images/IMG-0748_unresolved_工作表1_031.png` | 工作表1 | `A98` | 98 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 19 | `IMG-0751` | `images/IMG-0751_unresolved_工作表1_034.jpeg` | 工作表1 | `A107` | 107 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 20 | `IMG-0781` | `images/IMG-0781_unresolved_工作表1_064.png` | 工作表1 | `A158` | 158 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 该行未填编号 |
| 21 | `IMG-0793` | `images/IMG-0793_unresolved_工作表1_075.jpeg` | 工作表1 | `A245` | 245 | *（空）* | *（空）* | review_required | 待业务方补 Bowen No. | 编号读不出 |
| 22 | `IMG-0780` | `images/IMG-0780_unresolved_工作表1_063.jpeg` | 工作表1 | `G157` | — | **（不猜）** | **（不猜）** | unresolved | 已裁剪保留（D6） | 锚点在记录区块外 |

### 3.3 逐条明细

#### 1. `IMG-0097` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0097` |
| 图片文件（复核包内） | `images/IMG-0097_unresolved_综合产品信息表_097.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_097.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `H52` |
| 关联到的记录行 | 52 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image118.jpeg` |
| 图片体积 | 37 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `K52` 的内容：*（空）*
- 该行原表内容：`A: 95`　`C: 2742000615`　`D: 奔驰 C200 E200 GLA200 GLC200  CLA200 C180 C260 E200 E260L GLC260 GLK200 GLK260`　`E: 3511`　`F: 97℃`　`G: 96`　`I: 2742000015`　`J: 奔驰 C200 E200 GLA200 GLC200  CLA200 C180 C260 E200 E260L GLC260 GLK200 GLK260`　`L: 97℃`


---

#### 2. `IMG-0131` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0131` |
| 图片文件（复核包内） | `images/IMG-0131_unresolved_综合产品信息表_131.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_131.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `H69` |
| 关联到的记录行 | 69 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image152.jpeg` |
| 图片体积 | 51 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `K69` 的内容：*（空）*
- 该行原表内容：`A: 129`　`C: 2485613A`　`D: 珀金斯`　`E: 3528`　`F: D1=54mm / d2=28mm / A=33m / 83℃`　`G: 130`　`I: 271664  7431397947  7436842409  7439180811  271417  9180811`　`J: 沃尔沃`　`L: D1=54mm / d2=35mm / A=33mm / 90℃ / 82℃`


---

#### 3. `IMG-0209` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0209` |
| 图片文件（复核包内） | `images/IMG-0209_unresolved_综合产品信息表_209.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_209.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `H107` |
| 关联到的记录行 | 107 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image226.jpeg` |
| 图片体积 | 51 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `K107` 的内容：`3919(35401)`
- 该行原表内容：`A: 203`　`C: 34078  1601479128  699180  39108  49108   31831  455778  7031639  XXT49108 68148113AA(总成）4892312AB`　`D: 克莱斯勒300 道奇CHALLENGER CHARGER MAGNUM`　`E: 38278`　`F: D1=41mm  82℃`　`G: 204`　`I: 4837166SE 98463637 97210294 500329622 98463647`　`J: 南京依维柯 福田483`　`K: 3919(35401)`


---

#### 4. `IMG-0233` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0233` |
| 图片文件（复核包内） | `images/IMG-0233_unresolved_综合产品信息表_233.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_233.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `B120` |
| 关联到的记录行 | 120 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image247.jpeg` |
| 图片体积 | 42 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `E`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `E120` 的内容：`30302（3334胶圈）`
- 该行原表内容：`C: 2120058G04 21200C1201`　`D: 朝柴QD32 丰田4500`　`E: 30302（3334胶圈）`　`F: D1=54mm / d2=28mm / A=34mm / 76℃ /`　`G: 220`　`I: 94810603401 94810603400`　`J: 保时捷 卡宴 3.0`　`K: 35006`　`L: 92℃`


---

#### 5. `IMG-0238` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0238` |
| 图片文件（复核包内） | `images/IMG-0238_unresolved_综合产品信息表_238.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_238.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `H122` |
| 关联到的记录行 | 122 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image251.jpeg` |
| 图片体积 | 42 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `K122` 的内容：`3929(3019胶圈)`
- 该行原表内容：`C: 2550002500 2550002800 / 25500-02500`　`D: 进口现代\起亚 1.1`　`E: 3369`　`F: D1=48mm / d2=28mm / A=32mm / 82℃ / 含胶圈`　`I: 21200-2HB0B`　`J: 郑州日产  Y24`　`K: 3929(3019胶圈)`　`L: D1=52mm / d2=28mm / A=41mm /`


---

#### 6. `IMG-0245` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0245` |
| 图片文件（复核包内） | `images/IMG-0245_unresolved_综合产品信息表_245.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_245.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `H125` |
| 关联到的记录行 | 125 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image257.jpeg` |
| 图片体积 | 50 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `K125` 的内容：`35116（德本）`
- 该行原表内容：`C: 1603138010`　`D: 丰田/雷克萨斯GX/LS/LX`　`E: 35013`　`F: 82℃`　`I: 8980170272 8974357940 8980170271       8-98017-027-2    8-98017027-1    8-98017-027-0`　`J: 五十铃D-MAX 4JJ11 1.9T`　`K: 35116（德本）`　`L: D1=64mm d2=28mm A=40mm  / 85℃  / 常规28mm副阀门`


---

#### 7. `IMG-0252` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0252` |
| 图片文件（复核包内） | `images/IMG-0252_unresolved_综合产品信息表_252.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_综合产品信息表_252.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 综合产品信息表 |
| 锚点单元格 | `B129` |
| 关联到的记录行 | 129 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image264.jpeg` |
| 图片体积 | 51 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `E`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `E129` 的内容：`3041-2（3003）胶圈`
- 该行原表内容：`C: 1634054010 9091603062 9091603072 9091603099 9091603106 9091603142`　`D: 丰田`　`E: 3041-2（3003）胶圈`　`F: D1=52mm d2=30mm A=33mm / 88℃`　`I: X03004-1013271`　`J: 节温器总成 东风柳汽B18T/B20T 风行景逸 风行M7/M6`　`K: 35119`　`L: 103℃`


---

#### 8. `IMG-0452` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0452` |
| 图片文件（复核包内） | `images/IMG-0452_unresolved_大众系列_046.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_大众系列_046.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 大众系列 |
| 锚点单元格 | `H27` |
| 关联到的记录行 | 27 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image407.jpeg` |
| 图片体积 | 45 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `K27` 的内容：*（空）*
- 该行原表内容：`A: 49`　`C: 084941521  014919361`　`D: 桑塔纳 短杆`　`E: 6001`　`G: 50`　`I: 084941521  014919361`　`J: 桑塔纳 长杆`


---

#### 9. `IMG-0454` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0454` |
| 图片文件（复核包内） | `images/IMG-0454_unresolved_大众系列_048.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_大众系列_048.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 大众系列 |
| 锚点单元格 | `H28` |
| 关联到的记录行 | 28 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image414.jpeg` |
| 图片体积 | 53 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `K28` 的内容：*（空）*
- 该行原表内容：`A: 51`　`C: 020945415A  UMB10003  002945515A  002945515B  005566119  029945415A 020945415AA`　`D: 捷达 奇瑞旗云风云`　`E: 6003`　`G: 52`　`I: 02T945415  02K945415C  02K945415D  02K945415E  02T945415D  1119746  1213353  1M2115520AA`　`J: 宝来、波罗.新桑塔纳新捷达 途观 斯柯达系列`


---

#### 10. `IMG-0494` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0494` |
| 图片文件（复核包内） | `images/IMG-0494_unresolved_宝马奔驰系列_005.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_宝马奔驰系列_005.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 宝马奔驰系列 |
| 锚点单元格 | `H4` |
| 关联到的记录行 | 4 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image464.jpeg` |
| 图片体积 | 47 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 7 列（`G`）开始的区块；该区块的「博文编号」列是 `K`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `K4` 的内容：`无小管`
- 该行原表内容：`A: 3`　`C: 2742000615 2742003300 A2742000615 A2742003300`　`D: 奔驰 C200 E200 GLA200 GLC200  CLA200 C180 C260 E200 E260L GLC260 GLK200 GLK260`　`E: 3511 带小管`　`F: 97℃`　`G: 4`　`I: 2742000015`　`J: 奔驰 C200 E200 GLA200 GLC200  CLA200 C180 C260 E200 E260L GLC260 GLK200 GLK260`　`K: 无小管`　`L: 97℃`


---

#### 11. `IMG-0607` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0607` |
| 图片文件（复核包内） | `images/IMG-0607_unresolved_日系_007.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_日系_007.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 日系 |
| 锚点单元格 | `B6` |
| 关联到的记录行 | 6 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image548.jpeg` |
| 图片体积 | 59 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `E`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `E6` 的内容：`3069（3076）`
- 该行原表内容：`C: 9091603092 9091603093  9091603123 9091603101 9091603123 9091603143 9091603201`　`D: 丰田`　`E: 3069（3076）`　`F: 9`　`G: 82℃`　`H: 12`　`J: 2550027000 2550023010 2550023001 2551042010 255104A700 2550026100（88℃）`　`K: 索纳塔 伊兰特1.8 1.6 千里马1.6`　`L: 3011`　`M: 9.5`　`N: D1=54mm / d2=28mm / A=34mm / 82℃`


---

#### 12. `IMG-0653` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0653` |
| 图片文件（复核包内） | `images/IMG-0653_unresolved_福特系列_027.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_福特系列_027.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 福特系列 |
| 锚点单元格 | `I9` |
| 关联到的记录行 | 9 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image554.jpeg` |
| 图片体积 | 63 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 8 列（`H`）开始的区块；该区块的「博文编号」列是 `L`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `L9` 的内容：*（空）*
- 该行原表内容：`C: 1089796 / 1148164 / 1313546 / 3S6G8575A2A / XS6E8575A`　`D: 福特`　`E: 3203`　`F: 9`　`G: 82℃`　`K: 一汽ET3(马自达6芯子）`　`M: 12`　`N: D1=58.5mm / d2=23mm / A=39.8m / 82℃`


---

#### 13. `IMG-0654` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0654` |
| 图片文件（复核包内） | `images/IMG-0654_unresolved_福特系列_028.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_福特系列_028.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 福特系列 |
| 锚点单元格 | `I9` |
| 关联到的记录行 | 9 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image576.jpeg` |
| 图片体积 | 67 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 8 列（`H`）开始的区块；该区块的「博文编号」列是 `L`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `L9` 的内容：*（空）*
- 该行原表内容：`C: 1089796 / 1148164 / 1313546 / 3S6G8575A2A / XS6E8575A`　`D: 福特`　`E: 3203`　`F: 9`　`G: 82℃`　`K: 一汽ET3(马自达6芯子）`　`M: 12`　`N: D1=58.5mm / d2=23mm / A=39.8m / 82℃`


---

#### 14. `IMG-0740` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0740` |
| 图片文件（复核包内） | `images/IMG-0740_unresolved_工作表1_023.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_023.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A58` |
| 关联到的记录行 | 58 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image630.png` |
| 图片体积 | 136 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D58` 的内容：`3064塑料外壳`
- 该行原表内容：`B: 12557563`　`D: 3064塑料外壳`


---

#### 15. `IMG-0741` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0741` |
| 图片文件（复核包内） | `images/IMG-0741_unresolved_工作表1_024.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_024.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A77` |
| 关联到的记录行 | 77 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image631.png` |
| 图片体积 | 51 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D77` 的内容：`3583铝外壳`
- 该行原表内容：`B: 12587395`　`D: 3583铝外壳`


---

#### 16. `IMG-0742` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0742` |
| 图片文件（复核包内） | `images/IMG-0742_unresolved_工作表1_025.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_025.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A79` |
| 关联到的记录行 | 79 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image632.png` |
| 图片体积 | 285 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D79` 的内容：`同3025尺寸相同，原件阀座有3处豁口，胶圈内圈有3处定位，外圈有定位`
- 该行原表内容：`B: 23913353`　`C: 宝骏`　`D: 同3025尺寸相同，原件阀座有3处豁口，胶圈内圈有3处定位，外圈有定位`


---

#### 17. `IMG-0746` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0746` |
| 图片文件（复核包内） | `images/IMG-0746_unresolved_工作表1_029.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_029.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A96` |
| 关联到的记录行 | 96 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image636.png` |
| 图片体积 | 14 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D96` 的内容：`芯子编号：31052`
- 该行原表内容：`B: 1427919总成OE`　`D: 芯子编号：31052`


---

#### 18. `IMG-0748` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0748` |
| 图片文件（复核包内） | `images/IMG-0748_unresolved_工作表1_031.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_031.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A98` |
| 关联到的记录行 | 98 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image638.png` |
| 图片体积 | 14 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D98` 的内容：`芯子编号：3130`
- 该行原表内容：`B: 11512247269 / 11512354056 / 11517787052 / 总成OE`　`D: 芯子编号：3130`


---

#### 19. `IMG-0751` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0751` |
| 图片文件（复核包内） | `images/IMG-0751_unresolved_工作表1_034.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_034.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A107` |
| 关联到的记录行 | 107 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image641.jpeg` |
| 图片体积 | 44 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D107` 的内容：`3025（胶圈不同）`
- 该行原表内容：`B: 1767077G10 / 96610574`　`D: 3025（胶圈不同）`


---

#### 20. `IMG-0781` — 该行未填编号

| 字段 | 值 |
|---|---|
| image_id | `IMG-0781` |
| 图片文件（复核包内） | `images/IMG-0781_unresolved_工作表1_064.png` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_064.png` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A158` |
| 关联到的记录行 | 158 |
| mapping_status | `review_required` |
| match_kind | `record_row_without_bowen` |
| 源 media 部件 | `xl/media/image644.png` |
| 图片体积 | 234 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行是一条产品记录行，但该行没有填写「博文编号」。

- 原表 Bowen 单元格 `D158` 的内容：*（空）*
- 该行原表内容：`B: 55111016AE / 55111016AC`　`E: 9.5`　`F: 77°`　`I: 都邦：36512-1`　`J: 38241`


---

#### 21. `IMG-0793` — 编号读不出

| 字段 | 值 |
|---|---|
| image_id | `IMG-0793` |
| 图片文件（复核包内） | `images/IMG-0793_unresolved_工作表1_075.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_075.jpeg` |
| 裁剪派生图 | — |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `A245` |
| 关联到的记录行 | 245 |
| mapping_status | `review_required` |
| match_kind | `record_row_bowen_unreadable` |
| 源 media 部件 | `xl/media/image676.jpeg` |
| 图片体积 | 145 KB |

- Bowen No.：*（空）*
- product_id：*（空）*
- 锚点所属记录区块：从第 1 列（`A`）开始的区块；该区块的「博文编号」列是 `D`
- 业务处置：**待业务方补 Bowen No.**

**原因**：锚点所在行确实是一条产品记录行，但该行的「博文编号」单元格读不出合法编号（例如写着“无小管”“芯子编号：31052”这类说明文字）。

- 原表 Bowen 单元格 `D245` 的内容：`3014数据一样 外观结构不同`
- 该行原表内容：`B: 1041200GH030`　`D: 3014数据一样 / 外观结构不同`


---

#### 22. `IMG-0780` — 锚点在记录区块外

| 字段 | 值 |
|---|---|
| image_id | `IMG-0780` |
| 图片文件（复核包内） | `images/IMG-0780_unresolved_工作表1_063.jpeg` |
| 图片文件（原始提取目录） | `data/processed/product-images/unresolved_工作表1_063.jpeg` |
| 裁剪派生图 | `data/processed/product-images/unresolved_工作表1_063_cropped.png` |
| 来源工作表 | 工作表1 |
| 锚点单元格 | `G157` |
| 关联到的记录行 | — |
| mapping_status | `unresolved` |
| match_kind | `anchor_outside_record_blocks` |
| 源 media 部件 | `xl/media/image664.jpeg` |
| 图片体积 | 89 KB |

- **Bowen No.：不猜（留空）**
- **product_id：不猜（留空）**
- 锚点不属于任何记录区块（该表没有可识别的产品表结构，或锚点列落在区块之外）
- 业务处置：**已裁剪保留（D6）**
- 裁剪结果：`product-images/unresolved_工作表1_063_cropped.png`（1080×814，原图 1080×2392；方法 black_letterbox_gap）

**原因**：图片锚点所在列不在该工作表的任何产品记录区块内，无法判断它属于哪条记录。

- 该行原表内容：`B: 55111017AD / 55111017AC / 55111017AB / K55111017AD / K55111017AA`　`D: 32703`　`E: 8`　`F: 95°`　`H: 04884568AC / 04884569AC / 68003582AB / 总成OE号`　`I: 都邦：36512-2`

**图片内容观察（人工看图记录，非程序推断）**：手机截图：顶部状态栏 + 纯黑信筒区 + 中间一张带水印的节温器总成产品照 + 底部相册「1/1」。
- 顶部状态栏：17:09、电量 85%、信号图标
- 中间：黑色塑料节温器总成产品照（带 GXN 商标水印）
- 底部：相册进度「1/1」、圆形返回按钮

**风险判定**：🟡 已按 D6 裁剪掉界面部分，裁剪后只剩产品图，可用于后续使用。


---

### 3.4 图片质量观察（目视联系表得出，**非程序判定**）

从联系表目视可见，这 21 张图**质量参差**，大致两类：

| 形态 | 说明 | 能否直接用于网站 |
|---|---|---|
| **棚拍产品照（较多）** | 白底 / 浅灰底、构图规整的节温器或传感器产品照 | 构图可用；图上的「GXN」是**博文自有商标**（业务方 D7 确认），按 D7 保留，不需要处理 |
| **随手拍的实物照（部分）** | 例如 `IMG-0793`（1080 × 1920）是把节温器放在一张纸上、背后是键盘的随手拍 | 业务方已按 D8 决定**保留**，不要求重拍 |

> **说明**：以上是**人看联系表得出的观察**，不是程序对图片内容的判定。

**这 21 张现在唯一缺的只有一样东西：Bowen No.**
图本身与所属工作表行都已经确定，只差编号，所以业务方补上编号即可自动归位。


---

## 四、已处置的 5 张（D4 / D5 / D6）

### 4.1 已删除的 4 张（D4 + D5）

这 4 张按业务方决定**整体删除**：不导出文件、不留副本、不挂到任何产品、不进网站。

| image_id | 工作表 | 锚点 | 图上实际内容（人工观察） | 处置 |
|---|---|---|---|---|
| `IMG-0723` | 工作表1 | `H25` | 🔴 **内部系统产品页面截图**，含 零件号 `1106013088`、**进价 15**、**售价 19.5** | **删除**（D4 + D5） |
| `IMG-0787` | 工作表1 | `H185` | 干净产品照：金属节温器，浅色背景棚拍 | **删除**（D4） |
| `IMG-0797` | 工作表2 | `B1` | 干净产品照：黑色塑料节温器总成 / 壳体 | **删除**（D4） |
| `IMG-0798` | 工作表2 | `C1` | 干净产品照：黑色塑料节温器壳体（正面法兰） | **删除**（D4） |

> **特别提示（IMG-0723）**：该截图里的「进价 15 / 售价 19.5」是内部价格。
> 本清单**没有**把它当作任何产品的价格记录，也**没有**写进任何数据库字段；
> 只是把它作为「这张图不能对外用」的理由留档在此。
> 删除后该风险已彻底消除。

### 4.2 已裁剪保留的 1 张（D6）

| image_id | 原图 | 裁剪后 | 裁剪方法 |
|---|---|---|---|
| `IMG-0780` | `product-images/unresolved_工作表1_063.jpeg`（1080×2392） | `product-images/unresolved_工作表1_063_cropped.png`（1080×814） | 程序测量像素找上下纯黑信筒行带，取两段黑边之间**最大**的非黑行区间裁切 |

裁剪只去掉**界面部分**（系统状态栏、纯黑信筒区、相册底栏），**宽度不变、产品本体未被裁**。
原图保留在 `product-images/` 里可回溯，裁剪图并存，供后续使用。
水印按 D7 保留（博文自有商标）。

---

## 五、编号补齐后的归位方式（无需业务方再做别的决定）

业务方只要提供「哪个 image_id 对应哪个 Bowen No.」，程序会：

1. 把该图片的 `mapping_status` 从 `review_required` 改为 `exact`；
2. 填入 `bowen_no` 与 `product_id`（指向产品库里已存在的产品）；
3. 重新计算该产品的主图（D9 规则）；
4. 重跑 `node tools/verify-product-images.mjs`（当前 56 项全通过）确认没有回归。

**程序不会自己猜编号，也不会按图片外观去匹配产品。**

---

## 六、D9 主图规则（已实现，确定性可复现）

同一 Bowen 有多张图时，按以下优先级选主图（业务方原话：「主图你自己选择」）：

1. 来源工作表 = `综合产品信息表`（主目录优先）
2. 其次按系列工作表在 Excel 中的顺序（`sheet_index` 升序）
3. 同一工作表内按锚点行号升序
4. 仍相同则按源 media 部件名（`media_part`）字典序

结果：**403 个有图产品各恰好 1 张主图**，
映射里以 `is_primary_image` / `primary_rank` / `primary_image_rule` 三个字段记录，可逐条复核。

---

## 七、完整性声明

| 校验项 | 结果 |
|---|---|
| `product-image-map.json` 运行前后 SHA-256 | `fda22323c6b9fd53561cd92a20ca1a77bbf93bb58142205a05d457d959a2ae18` → `fda22323c6b9fd53561cd92a20ca1a77bbf93bb58142205a05d457d959a2ae18`（**未变**） |
| review_required 数量 | 21（期望 21） |
| unresolved 数量 | 5（期望 5） |
| 删除集合与业务决定文件是否一致 | **是**（`IMG-0723,IMG-0787,IMG-0797,IMG-0798`） |
| unresolved 是否带 bowen_no / product_id | **0 条**（必须为 0，保持“不猜”） |
| 是否修改 `website/` | **否** |
| 是否把图片接入网站 | **否** |
| 是否重建网站 ZIP | **否** |
| 被删除图片是否留有副本 | **否**（4 张均未复制到本包） |
| 复制的图片文件 | 23 个文件（来自 22 条记录），合计 2.00 MB |
| 含内部价格信息的图片 | **1 张（`IMG-0723`，已删除）**，理由已在 4.1 与 D5 留档 |

---

## 八、复核包文件清单

| 文件 | 内容 |
|---|---|
| `contact-sheet-all-26.png` | 本轮 26 张的最终处置（总览，推荐先看这张） |
| `contact-sheet-pending-22.png` | 仍缺 Bowen No. 的 22 张 |
| `contact-sheet-removed-5.png` | 已处置的 5 张（4 张删除 + 1 张裁剪） |
| `index.html` | 可滚动的可浏览版本 |
| `contact-sheet-*.html` | 上述三张联系表的 HTML 源（可自行放大查看） |
| `images/` | 23 个图片文件（`IMG-0780` 的原图与裁剪图各一份），命名 `<image_id>_<原文件名>`；已删除的图片**不在其中** |
| `../product-image-map.json` | 原始映射（**未被修改**） |
| `../../data/raw/business-decisions-v3.json` | 业务方决定文件（本包的唯一依据） |
| `../../docs/company-info-from-brochure.md` | 从宣传手册提取的公司信息 |
