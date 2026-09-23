# 博文外贸独立站（Bowen B2B Website）

面向海外汽车零部件采购商的 B2B 独立站项目。

**当前进度：Phase 2（人工业务审核包）已完成，等待工厂/业务人员人工审核。尚未开始网站开发。**

---

## 一、先看这个

**如果你只想看结论，只读这两个文件：**

> ### 📄 [`docs/phase2-business-review-package.md`](docs/phase2-business-review-package.md)
> **当前阶段报告**（Phase 2）。中文，不需要懂代码。
>
> ### 📄 [`docs/product-database-report.md`](docs/product-database-report.md)
> 数据清洗报告（Phase 1）。中文。

**如果你是来填审核表的，直接打开：**

> ### 📊 `review/first-batch-business-review.xlsx`
> 双击就能用 Excel / WPS 打开。第一个工作表是中文填表说明。

---

## 二、现在的状态（一句话）

| 项目 | 数量 |
|---|---|
| 产品总数 | **466** 个 |
| 第一批候选（`publish_candidate`，**不是已发布**） | **72** 个 |
| 已发布（`published`） | **0** 个 |
| 产品类型未知（需要人工确认） | **466 个（全部）** |
| 被硬性阻断（`blocked`） | **11** 个 |

**为什么要人工审核**：原始 Excel 里**没有产品类型列**，466 个产品中有 420 个（90%）
连一丝类型线索都没有。程序**不允许猜**，所以全部标记 `review_required`，等人工填。

---

## 三、人工审核包（`review/` 目录）

4 个 Excel 文件，双击打开，有下拉菜单、冻结表头、自动筛选。

| 文件 | 内容 |
|---|---|
| **`review/first-batch-business-review.xlsx`** | ⭐ **主表**：72 个产品，填 6 个字段 |
| `review/oe-cross-sheet-review.xlsx` | OE 跨工作表差异（1,843 行，其中优先 881 行） |
| `review/bowen-number-variant-review.xlsx` | Bowen 编号变体（18 族 49 个编号） |
| `review/row-misalignment-review.xlsx` | 疑似字段错位（29 条） |

**每个文件的第一个工作表都是中文「填表说明」。**

**颜色约定**：🔵 表头（别动） ｜ 🟡 手工填写 ｜ 🟢 下拉选择 ｜ 🔴 系统警告

**最少审核量**：如果只想先上线 50 个产品，需要确认 **332 条记录（约 7.2 小时）**。
详见报告第 8 节。

---

## 四、项目文件说明

```
B2B外贸独立站/
├── 博文外贸独立站规划_V1.docx      ← Source of Truth（产品需求 + 业务规则）
├── 宣传手册最终PDF/                 ← 公司宣传册（中/英/日/重排版）
│
├── review/                         ← ⭐ 人工审核包（你要打开的文件）
│   ├── first-batch-business-review.xlsx
│   ├── oe-cross-sheet-review.xlsx
│   ├── bowen-number-variant-review.xlsx
│   ├── row-misalignment-review.xlsx
│   └── _archive_phase2-csv/            上一版 CSV 审核表（已取代，仅留档）
│
├── data/
│   ├── raw/                        ← ⚠️ 原始资料，只读，永不修改
│   │   └── 产品信息表1_英文版.xlsx      （SHA-256 冻结）
│   └── derived/                    ← ✅ 清洗后的数据库（可重新生成）
│       ├── products-v2.csv             ⭐ 当前产品主库（466 行，新状态模型）
│       ├── product-oe-index-v2.csv     ⭐ 当前 OE 索引（2364 行）
│       ├── phase2-package-summary.json 全部统计数字
│       ├── products.csv                Phase 1 产出（历史审计用，状态已废弃）
│       ├── product-oe-index.csv        Phase 1 产出（历史审计用）
│       └── ...                         其他 Phase 1 派生文件与治理清单
│
├── docs/
│   ├── phase2-business-review-package.md  ← ⭐ 当前阶段报告
│   ├── product-database-report.md         Phase 1 报告
│   ├── phase2-data-readiness-report.md    ⚠️ 已被取代（保留作历史记录）
│   └── _source/                           中间产物与诊断输出
│
└── tools/                          ← 自研工具链（纯 Node.js，零第三方依赖）
    ├── build-product-db.mjs             Phase 1 清洗程序
    ├── verify-db.mjs                    Phase 1 验收测试（57 项）
    ├── build-phase2-package.mjs         Phase 2 审核包生成器
    ├── verify-phase2-package.mjs        Phase 2 验收测试（85 项）
    ├── lib/xlsx-writer.mjs              自研 XLSX 写出器（支持下拉菜单）
    ├── lib/normalize.mjs                标准化规则库
    ├── xlsx-reader.mjs                  自研 XLSX 读取器
    └── ...                              诊断 / 统计脚本
```

**只读 vs 可重新生成**：
- `data/raw/` 是**原始资料**，程序绝不写入，靠 SHA-256 校验保护。
- `data/derived/` 与 `review/` 是**派生产物**，随时可以删掉重新生成。

**⚠️ 重要**：网站开发请以 **`products-v2.csv`** 为准，不要用 `products.csv`
（Phase 1 的状态模型已废弃，其中 72 个 `PUBLISHED` 是旧的错误口径）。

---

## 五、如何重新运行

需要 Node.js（本项目用 v24.9.0 验证）。

```powershell
# Phase 1：重新生成产品数据库
node tools/build-product-db.mjs
node tools/verify-db.mjs              # 57 项验收测试

# Phase 2：重新生成人工审核包
node tools/build-phase2-package.mjs
node tools/verify-phase2-package.mjs  # 85 项验收测试

# 自研 XLSX 写出器自测
node tools/selftest-xlsx-writer.mjs
```

**验证原始文件有没有被人改过**（最重要的一条）：

```powershell
node tools/verify-phase2-package.mjs
```

只要第 11 组「原始 Excel SHA-256 仍与冻结值一致」显示 PASS，
就说明原始 Excel 一个字节都没被改动。

**想要逐字节完全可复现的结果**：

```powershell
$env:BOWEN_NOW = "2026-09-23T09:00:00.000Z"
node tools/build-product-db.mjs
node tools/build-phase2-package.mjs
```

---

## 六、项目铁律（写在代码和测试里的约束）

1. **绝不修改原始资料**。`data/raw/` 下的 Excel、PDF 只读。
2. **绝不编造事实**。公司、产品、认证、客户、MOQ、产能、交期等信息一律来自项目资料，或明确标记为待确认。
3. **不确定的数据用状态标记，不猜**。
4. **每个阶段必须先测试通过，再进入下一阶段**。
5. **每个重大阶段创建 Git commit**。

### Phase 2 阶段的 6 条额外禁令（全部由验收测试强制执行）

| 禁令 | 检查方式 |
|---|---|
| 不允许根据经验猜 `product_type` | 全库 466 个必须都是 `review_required` |
| 不允许为满足规划强行分类 | 审核表该列必须 100% 为空 |
| 第一批不得标为 `published` | 全库 `published` 必须 = 0 |
| 疑似错位必须 `blocked = true` | 全部 HIGH 记录必须被阻断 |
| 不得自动删除 OE / 合并 Bowen No. | 产品数必须仍是 466、OE 行数必须仍是 2364 |
| 未经确认不得 `fitment_confidence = exact` | 全库 `exact` 必须 = 0 |

**只要有任何一个产品被程序自动填了类型、或自动设了 `exact`，验收测试立刻失败。**

---

## 七、Git 版本管理

```powershell
git log --oneline
```

> 本机没有全局安装 Git。项目使用的是便携版：
> `C:\Users\asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`

---

## 八、下一步

1. **填 `review/first-batch-business-review.xlsx`**（先做 50 个，详见报告第 8 节）
2. **填 `review/oe-cross-sheet-review.xlsx`**（这是主要工作量，约 279 行）
3. 把填好的文件放回 `review/` 目录，告诉我

**然后我会**：

1. 校验你填的值是否合法
2. 把你的确认结果写回数据库
3. 生成 `data/derived/products-v3.csv`（网站开发用的正式数据库）

**之后才进入 UI Prototype 阶段。**
