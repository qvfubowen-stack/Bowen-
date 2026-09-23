# 博文外贸独立站（Bowen B2B Website）

面向海外汽车零部件采购商的 B2B 独立站项目。

**当前进度：阶段一（产品数据库清洗与标准化）已完成，等待业务方确认后进入阶段二（网页开发）。**

---

## 一、先看这个

**如果你只想看结论，只读这一个文件：**

> ### 📄 [`docs/product-database-report.md`](docs/product-database-report.md)

这是阶段一的完整数据质量报告，用中文写，不需要懂代码就能读完。

---

## 二、项目文件说明

```
B2B外贸独立站/
├── 博文外贸独立站规划_V1.docx      ← Source of Truth（产品需求 + 业务规则）
├── 宣传手册最终PDF/                 ← 公司宣传册（中/英/日/重排版）
│
├── data/
│   ├── raw/                        ← ⚠️ 原始资料，只读，永不修改
│   │   └── 产品信息表1_英文版.xlsx      （SHA-256 冻结）
│   └── derived/                    ← ✅ 清洗后的产品数据库（全部可重新生成）
│       ├── products.csv                产品主表（466 个产品）
│       ├── product-oe-index.csv        OE 搜索索引（2364 条）
│       ├── product-vehicle-makes.csv   产品 × 车型品牌
│       ├── product-engine-codes.csv    发动机代码候选（待确认）
│       ├── first-batch-published.csv   第一批上线推荐（72 个）
│       ├── staging-records.raw.csv     原始记录逐字留档（970 条）
│       ├── duplicates-*.csv            重复识别报告
│       ├── issues-*.csv                异常清单（待人工处理）
│       └── stats.json                  全部统计数据
│
├── docs/
│   ├── product-database-report.md  ← ✅ 阶段一交付：数据质量报告
│   └── _source/                    ← 中间产物（规划文档正文、诊断输出）
│
└── tools/                          ← 自研工具链（纯 Node.js，零第三方依赖）
    ├── build-product-db.mjs            主清洗程序
    ├── verify-db.mjs                   验收测试（57 项）
    ├── xlsx-reader.mjs                 XLSX 读取器
    ├── lib/normalize.mjs               标准化规则库
    └── ...                             诊断 / 报告脚本
```

**只读 vs 可重新生成**：
- `data/raw/` 里的文件是**原始资料**，程序绝不写入，靠 SHA-256 校验保护。
- `data/derived/` 里的文件全部是**派生产物**，随时可以删掉重新生成，不会丢数据。

---

## 三、如何重新运行

需要 Node.js（本项目用 v24.9.0 验证）。

```powershell
# 重新生成全部派生数据
node tools/build-product-db.mjs

# 运行验收测试（57 项）
node tools/verify-db.mjs
```

**验证数据是否被别人改动过**（最重要的一条）：

```powershell
node tools/verify-db.mjs
```

只要第 1 组测试「原始 Excel SHA-256 与冻结值一致」显示 PASS，就说明原始 Excel 一个字节都没被改动。

**想要逐字节完全可复现的结果**：

```powershell
$env:BOWEN_NOW = "2026-09-23T09:00:00.000Z"
node tools/build-product-db.mjs
```

---

## 四、项目铁律（写在代码里的约束）

1. **绝不修改原始资料**。`data/raw/` 下的 Excel、PDF 只读。
2. **绝不编造事实**。公司、产品、认证、客户、MOQ、产能、交期等信息一律来自项目资料，或明确标记为待确认。
3. **不确定的数据用状态标记，不猜**：
   - `draft` / `review_required` / `related` / `exact`
   - 具体到字段：`product_type = REVIEW_REQUIRED`、`fitment_confidence = review_required`
4. **每个阶段必须先测试通过，再进入下一阶段**。
5. **每个重大阶段创建 Git commit**。

**其中第 2、3 条由验收测试强制执行**——例如只要有任何一个产品的 `product_type` 被程序自动填写（而不是留 `REVIEW_REQUIRED`），验收测试就会失败。

---

## 五、Git 版本管理

```powershell
git log --oneline
```

| Commit | 内容 |
|---|---|
| `阶段一：产品数据库清洗与标准化` | 原始数据入库 + 全部派生产物 + 报告 + 工具链 |
| `阶段一修正：派生 CSV 统一为 LF 换行` | 消除换行符造成的虚假 diff |

> 本机没有全局安装 Git。项目使用的是便携版：
> `C:\Users\asus\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`

---

## 六、下一步

**阶段二（网页开发）现在还不能开始**，卡在一件事上：

> **需要懂产品的人逐条确认 466 个产品的 `product_type`（产品类型）。**

原因：原表里没有产品类型列，其中 **420 个产品（90%）的原文里完全没有任何类型线索**。
而规划 V1 要求把 `Thermostats` / `Thermostat Assemblies` / `Thermostat Inserts` 做成三个独立导航分类——
不确认类型，这三个分类页面里有两个是空的。

完整说明见报告第 7.2 节和第 9.3 节。另外还有 6 项待确认事项，见报告第 13.2 节。
