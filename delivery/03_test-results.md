# 测试结果（Test Results）

**项目版本：Bowen-Website-Prototype-V1**
**最后更新：2026-09-25（第二次修复轮）**
**总体结果：188 项自动断言全部 PASS，0 FAIL**
（数据库 65 + 图片映射 39 + 原型数据 36 + 分类文案守卫 12 + RFQ 端到端 31）

---

## 〇、第二次修复轮的验证总览

| 测试套件 | 命令 | 结果 |
|---|---|---|
| 数据库验收 | `node tools/verify-product-db-v2.mjs` | **65 / 65 PASS** |
| 图片映射验收 | `node tools/verify-product-images.mjs` | **39 / 39 PASS** |
| 原型数据验收 | `cd website && node tools/verify-prototype-data.mjs` | **36 / 36 PASS** |
| **分类文案与模型守卫（新增）** | `cd website && node tools/verify-category-copy.mjs` | **12 / 12 PASS** |
| **RFQ 端到端（新增）** | `cd website && node tools/verify-rfq-e2e.mjs` | **31 / 31 PASS** |
| 响应式 390px | `cd website && node tools/find-overflow.mjs <url> 390` | **5 / 5 PASS** |
| 类型检查 | `cd website && pnpm run typecheck` | **0 error** |
| 生产构建 | `cd website && pnpm run build` | **成功，390 个路由** |

### 干净环境全流程验证（从 `git archive HEAD` 导出，无 node_modules / .next）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | ✅ 成功，6.3 秒，**零警告**（无 lockfile 警告、无 sharp 警告） |
| 2 | `pnpm run typecheck` | ✅ 0 error |
| 3 | `pnpm run build` | ✅ 成功，390 个路由 |
| 4 | `pnpm start` | ✅ 启动成功 |
| 5 | 逐页 HTTP（12 个页面） | ✅ 全部 200，均带 `X-Robots-Tag: noindex, nofollow` |
| 6 | `node tools/verify-product-db-v2.mjs` | ✅ 65 / 65 |
| 7 | `node tools/verify-prototype-images.mjs`（图片未生成时） | ✅ 给出可执行指引，exit 2（不是一堆看不懂的失败） |
| 8 | `node tools/extract-product-images.mjs` → 再验收 | ✅ 798 个文件生成，39 / 39 PASS |
| 9 | `node tools/verify-prototype-data.mjs` | ✅ 36 / 36 |
| 10 | `node tools/verify-category-copy.mjs` | ✅ 12 / 12 |
| 11 | `node tools/verify-rfq-e2e.mjs`（对 production server） | ✅ 31 / 31 |
| 12 | `find-overflow.mjs` 5 个页面 390px | ✅ 横向溢出均为 0px |

> 这一步是本次修复的重点：**证明全新环境真的能装起来、跑起来、测通过**，
> 而不是只在原开发机上能跑。

---

## 一、如何复现全部测试

```bash
# 0) 环境（唯一推荐：pnpm 10.34.5 + Node >= 18.18.0）
node --version
pnpm --version

# 1) 安装
cd website
pnpm install --frozen-lockfile

# 2) 数据库与图片（项目根目录）
cd ..
node tools/build-product-db-v2.mjs
node tools/verify-product-db-v2.mjs          # 65 项
node tools/extract-product-images.mjs
node tools/verify-product-images.mjs         # 39 项
node tools/build-review-lists-v2.mjs

# 3) 网站（website 目录）
cd website
node tools/verify-prototype-data.mjs         # 36 项
node tools/verify-category-copy.mjs          # 12 项
node tools/verify-rfq-e2e.mjs                # 31 项（自动起临时服务器）

# 4) 类型检查与构建
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build

# 5) 响应式（需先 pnpm start 或 pnpm run dev）
node tools/find-overflow.mjs http://127.0.0.1:3000/ 390
node tools/find-overflow.mjs http://127.0.0.1:3000/products 390
node tools/find-overflow.mjs http://127.0.0.1:3000/oe-search?q=4711306950 390
node tools/find-overflow.mjs http://127.0.0.1:3000/products/BW-3005 390
node tools/find-overflow.mjs http://127.0.0.1:3000/rfq 390
```

---

## 二、本轮新增的两个测试套件

### 2.1 `verify-category-copy.mjs`（12 项 PASS）— 分类模型与文案守卫

需求：V1 产品分类统一使用 Thermostat；Insert / Assembly 只能作为制造工艺或原始资料词汇；
不得生成独立分类、筛选项或主次产品逻辑。

| 组 | 覆盖内容 | 结果 |
|---|---|---|
| A | product_type 只能是 canonical 值；不存在 Thermostat Insert / Assembly / Automotive Thermostat 作为类型；分类里不出现 insert/assembly；开关之外没有子分类；subtype 全为 null | 5/5 PASS |
| B | 产品数据里没有主/次产品字段，也没有主/次 OE 字段 | 2/2 PASS |
| C | 源码 57 个文件里没有把 Insert/Assembly 当产品分类或筛选项的文案；没有写进筛选项数组；分类描述不再列举它们 | 3/3 PASS |
| D | 允许的用法仍然保留：品牌定位「Automotive Thermostat Manufacturer」；Factory 页的 Machining / Assembly / Automated Assembly / Testing 四步 | 2/2 PASS |

这一套测试同时守两件事：**不许把它们变成分类**，也**不许把合法的工艺用词误删**。

### 2.2 `verify-rfq-e2e.mjs`（31 项 PASS）— RFQ 表单 → payload 端到端

用**真实浏览器**（Chrome DevTools Protocol）跑，因为只有真填表、真提交、真读回，
才能证明"表单控件 → FormData → React state → 渲染"这条链路是通的。

| 场景 | 覆盖内容 | 结果 |
|---|---|---|
| A | 空表单提交被拦下、不生成 payload、显示必填校验提示 | 4/4 PASS |
| B | URL 带 product 参数自动带入明细、全部字段写入成功、提交后渲染 payload、payload 是合法 JSON | 4/4 PASS |
| B | **联系信息 7 项**：name / company / country / email / whatsapp_phone / website / message 必须等于用户实际填写的值 | 7/7 PASS |
| B | **不得残留占位符**：不出现 `(from form)`、不出现 `(not provided)`、不出现 `{{ }}` `<% %>` `FROM_FORM` `PLACEHOLDER` | 3/3 PASS |
| B | **业务字段保留**：items 非空、product_id、application_id、bowen_no、matched_oe、vehicle、engine、quantity、items_count 一致 | 9/9 PASS |
| B | **不发送邮件**：payload 明确标注 `prototype_no_email_sent` | 1/1 PASS |
| B | 成功页正文能看到用户填写的姓名与邮箱；整页文本没有 `(from form)` | 3/3 PASS |

测试数据（自动填写）：

```
name     = Zhang Wei (E2E)
company  = E2E Auto Parts Import GmbH
country  = Germany
email    = e2e.buyer@example.com
whatsapp = +49 151 2345678
website  = https://e2e-buyer.example.com
message  = Sourcing list:\n2550035540 x 300\n4711306950 x 500
quantity = 500 pcs
```

实测回读的 payload 片段：

```json
{
  "contact": {
    "name": "Zhang Wei (E2E)",
    "company": "E2E Auto Parts Import GmbH",
    "country": "Germany",
    "email": "e2e.buyer@example.com",
    "whatsapp_phone": "+49 151 2345678",
    "website": "https://e2e-buyer.example.com",
    "message": "Sourcing list:\n2550035540 x 300\n4711306950 x 500",
    "consent": true
  },
  "items": [{
    "product_id": "BW-3005",
    "bowen_no": "3005",
    "product_type": "Thermostat",
    "matched_oe": "4711306950",
    "vehicle": "三菱4G6 471Q 菱帅 比亚迪F3 …",
    "engine": "三菱4G6 471Q 菱帅 比亚迪F3 …",
    "application_id": "APP-00388",
    "quantity": "500 pcs"
  }],
  "items_count": 1,
  "sourcing_list_file": null,
  "delivery": { "transport": "prototype_no_email_sent", "note": "…" }
}
```

---

## 三、数据库验收测试（65 项 PASS）

命令：`node tools/verify-product-db-v2.mjs`

### TEST 1 — 原始 Excel 不得被修改（SHA-256 校验）

| # | 测试项 | 结果 |
|---|---|---|
| 1 | 冻结清单里的 SHA-256 与当前文件一致 | PASS |
| 2 | 统计报告记录的运行前 SHA-256 与冻结值一致 | PASS |
| 3 | 统计报告记录的运行后 SHA-256 与冻结值一致 | PASS |
| 4 | data/raw 下仅有只读原始资料（无脏文件） | PASS |

冻结值：`79d5995d437ea5a4393faba87f237ea59f1361f51f22d6d5b28eb34bcd144a12`

### TEST 2 — 同一 Bowen 多个 OE 不得被判定为冲突

| # | 测试项 | 结果 |
|---|---|---|
| 5 | 存在大量「一个 Bowen 多个 OE」产品（321 个） | PASS |
| 6 | 不存在 main_oe / primary_oe / secondary_oe 字段 | PASS |
| 7 | 不存在把「同 Bowen 多 OE」标成冲突的记录 | PASS |
| 8 | product_type_conflict 只用于类型标签矛盾 | PASS |
| 9 | 共享 OE 未触发任何删除或合并 | PASS |

### TEST 3 — OE 与 Engine/Application 的行级关系不得丢失

| # | 测试项 | 结果 |
|---|---|---|
| 10 | 每条 application 都同时带 OE 原文与 Engine/车型原文 | PASS |
| 11 | 不存在「OE 数组与 Engine 数组各自独立」的结构 | PASS |
| 12 | 每条 application 的 source_sheet + source_row 可回溯 | PASS |
| 13 | OE 索引每条都指回真实 application | PASS |
| 14 | 统计报告声明行级关系未丢失 | PASS |
| 15 | oe_tokens_split_into_standalone_arrays 必须为 false | PASS |
| 16 | 抽查 Bowen 3005 的 OE 与车型来自同一行同一区块 | PASS |

### TEST 4 — 不同格式 OE 标准化后可查

| # | 测试项 | 结果 |
|---|---|---|
| 17 | 业务规则要求的 4 种写法标准化键一致 | PASS |
| 18 | 忽略大小写 | PASS |
| 19 | 忽略全角空格 | PASS |
| 20 | 标准化键在真实索引中可命中 | PASS |
| 21 | 索引同时保留 oe_number_raw 供展示 | PASS |
| 22 | 同一 application 内重复 OE 已去重 | PASS |
| 23 | 所有索引键仅由 A-Z0-9 与点组成 | PASS |

### TEST 5 — blocked 数据不得进入 Prototype

| # | 测试项 | 结果 |
|---|---|---|
| 24 | Prototype 产品数量在 15–20 之间（20 个） | PASS |
| 25 | 没有任何 blocked 产品进入 Prototype | PASS |
| 26 | Prototype 产品不含 blocked application | PASS |
| 27 | Prototype 产品不含「错位待复核」application | PASS |
| 28 | blocked application 不出现在 OE 搜索索引 | PASS |
| 29 | 网站数据集里没有 blocked 产品 | PASS |
| 30 | 网站数据集里没有 blocked application | PASS |
| 31 | blocked 记录保留了原始来源 | PASS |

### TEST 6 — 没有人工类型标签不得自动猜

| # | 测试项 | 结果 |
|---|---|---|
| 32 | 自动猜 product_type 计数 = 0 | PASS |
| 33 | product_type_source 只取 4 个合法值 | PASS |
| 34 | product_type 非空的产品必有证据对象 | PASS |
| 35 | product_type 为空的产品标 review_required | PASS |
| 36 | 每个已分类产品的证据都能追到单元格或审核表行 | PASS |
| 37 | 变体编号的继承证据指向其基础编号 | PASS |
| 38 | 没有产品的类型来自「按 OE/车型/发动机/温度/尺寸推断」 | PASS |
| 39 | 无法确定类型的产品仍然入库（70 个） | PASS |
| 40 | staging 原始记录数与抽取数一致 | PASS |

### TEST 7 — Thermostat 不得再拆分

| # | 测试项 | 结果 |
|---|---|---|
| 41 | product_type 取值只能是词典里的 canonical 值 | PASS |
| 42 | 不存在 Thermostat Insert / Assembly / Automotive Thermostat | PASS |
| 43 | 四种节温器写法全部归一为 Thermostat | PASS |
| 44 | product_subtype 全为 null，且不阻止上线（381 个可上线） | PASS |
| 45 | 人工填的 Insert/Assembly 原始值保留在 product_type_raw_labels | PASS |
| 46 | 审核表确认的 3 个产品标为 human_review_confirmed | PASS |

### 附加 — 项目铁律与数据完整性

| # | 测试项 | 结果 |
|---|---|---|
| 47 | 不存在重复 product_id | PASS |
| 48 | 不存在重复 application_id | PASS |
| 49 | 每个产品的 application_ids 都能找到对应记录 | PASS |
| 50 | 每条 application 的 product_id 都存在 | PASS |
| 51 | OE 索引条数与 stats 一致 | PASS |
| 52 | application 条数与 stats 一致 | PASS |
| 53 | 产品条数与 stats 一致 | PASS |
| 54 | 参与入库的工作表里人工区段标签全部可识别 | PASS |
| 55 | 辅助表天博编号孤立行已被正确排除并留档 | PASS |
| 56 | 综合产品信息表的 7 个人工区段标签全部被识别 | PASS |
| 57 | 共享 OE 参考清单已生成 | PASS |
| 58 | 共享 OE 清单覆盖所有「一个 OE 对多个 Bowen」（125 个） | PASS |
| 59 | 共享 OE 情况没有阻止 Prototype 开发 | PASS |
| 60 | Prototype 产品全部来自核心品类 Thermostat | PASS |
| 61 | 每个 Prototype 产品都有 ≥1 条可用 application | PASS |
| 62 | 没有中文 token 被当成 OE 写进索引 | PASS |
| 63 | 状态取值只能是 4 个合法值 | PASS |
| 64 | 不存在 published 状态 | PASS |
| 65 | 不存在对原始 Excel 的写操作 | PASS |

**结果：PASS 65 / FAIL 0 —— 自动猜 product_type = 0**

---

## 四、网站数据集验收测试（36 项 PASS）

命令：`cd website && node tools/verify-prototype-data.mjs`
数据集：**378 products / 711 applications / 2,787 OE rows**（最终交付版本实测）

### 数据集完整性（8 项，全部 PASS）

- website/src/data 只包含可展示状态（20 个 prototype_candidate + 358 个 searchable_noindex，共 378 个）
- 数据集里没有 blocked 产品
- 数据集里没有 blocked 或错位待复核的 application
- 原型重点产品数量在 15–20 之间（20 个）
- 首页重点展示的产品恰好是 prototype_candidate
- 每个产品的 application_ids 都能在数据集里找到
- 每条 application 的 product_id 都在数据集里
- 所有 OE 索引行都指向数据集内的 application

### OE 搜索（10 项，全部 PASS）

- 四种写法得到同一个标准化键（`2550035540`）
- `2550035540` 能搜到结果（4 条精确命中 → Bowen 3503, 3004-5, 3004-3）
- `25500-35540` 与 `2550035540` 结果一致（均为 4 条）
- 小写输入也能命中
- 搜索结果带完整应用上下文（OE + Bowen + 车型/Engine 字段 + 来源）
- 存在「同一行同时有 OE 和车型」的真实 application（537 / 711 条）
- 抽一条同时有 OE 与车型的 application，其 OE 可被搜索命中
- 抽 10 个真实 OE 索引键全部命中（10/10）
- 搜不到的 OE 能优雅返回空结果（不报错）
- 空查询不会报错

### OE ↔ Engine 行级关系（5 项，全部 PASS）

- 每条 application 都有 OE 原文字段与车型/发动机字段（值可为空但字段必须在）
- 无 OE 的 application 其来源行在原表中 OE 单元格确实为空（不是解析丢失）
- 每条 application 至少有 OE 或车型内容之一（无空壳行）
- 产品详情页表格每一行都能查到来源工作表与行号
- 不存在 main / primary / secondary OE 字段
- 存在 277 个「同一 Bowen 多个 OE」的真实例子（最多 85 个 OE）

### 页面所需数据齐备（9 项，全部 PASS）

- 每个产品都有 product_type
- 20 个 Prototype 重点产品全部是 Thermostat
- 网站产品架构的 4 个分类都有真实产品（thermostats=259 / automotive-switches=75 /
  temperature-sensors=41 / related-cooling-parts=3）
- 汽车开关的 4 个子分类都各自有产品（热敏 4 / 机油压力 37 / 刹车灯 17 / 倒车灯 17）
- product_subtype 全为 null
- 每个产品都有分类证据对象
- 每个产品都有来源工作表列表
- site-facts.json 的公司数字与项目资料一致（2009 / 10,000 / 3,500 / 2,000 / 100+ / 29 / 16 / 5）
- 认证只有 IATF 16949 / ISO 14001 / ISO 45001 三项

### 客户可见范围（3 项，全部 PASS）

- 完整库 23 个 blocked 产品，网站数据集 0 个
- 完整库 47 个 draft 产品，网站数据集 0 个
- 网站数据集里没有 published 状态

**结果：PASS 36 / FAIL 0**

---

## 五、响应式测试（5 个页面 PASS）

命令：`node tools/find-overflow.mjs <url> 390`
方法：Chrome DevTools Protocol + `Emulation.setDeviceMetricsOverride` 真实 390px 视口，
遍历所有元素找出比视口宽的元素。

| 页面 | 视口 | 文档 scrollWidth | 横向溢出 | 结果 |
|---|---|---|---|---|
| `/` 首页 | 390px | 390px | 0px | PASS |
| `/products` | 390px | 390px | 0px | PASS |
| `/oe-search?q=4711306950` | 390px | 390px | 0px | PASS |
| `/products/BW-3005` | 390px | 390px | 0px | PASS |
| `/rfq` | 390px | 390px | 0px | PASS |

需求特别要求检查的 4 个地方均已覆盖：
OE Search ✅ / Products ✅ / Application Table ✅（表格容器可横向滑动，不撑宽页面）/ RFQ ✅

---

## 六、类型检查与构建（PASS）

| 项目 | 命令 | 结果 |
|---|---|---|
| TypeScript 类型检查 | `npm run typecheck`（tsc --noEmit） | **0 error** |
| 生产构建 | `npm run build` | **成功，390 个路由** |

构建输出摘要：

```
Route (app)                              Size     First Load JS
┌ ○ /                                    2.87 kB         112 kB
├ ○ /_not-found                          977 B           106 kB
├ ○ /about                               547 B           110 kB
├ ○ /blog                                500 B           110 kB
├ ○ /contact                             526 B           110 kB
├ ○ /factory                             545 B           110 kB
├ ƒ /oe-search                           2.52 kB         112 kB
├ ƒ /products                            2.76 kB         112 kB
├ ● /products/[id]                       3.36 kB         112 kB
├   ├ /products/BW-3005
├   ├ /products/BW-3051
├   ├ /products/BW-3080
├   └ [+375 more paths]        ← 全部 378 个可展示产品页均在构建时预渲染
├ ○ /quality                             603 B           110 kB
└ ƒ /rfq                                 5.34 kB         114 kB
+ First Load JS shared by all            105 kB
```

`○ Static` 静态预渲染 · `● SSG` 静态生成 · `ƒ Dynamic` 按需服务端渲染

### 通过 `next start` 生产模式实测全部页面

在**从交付 ZIP 解压出来的干净副本**上安装依赖、构建、启动生产服务器，
逐个页面请求验证：

| 路径 | 状态 | 响应大小 |
|---|---|---|
| `/` | 200 | 113,603 B |
| `/products` | 200 | 132,975 B |
| `/oe-search?q=4711306950` | 200 | 32,134 B |
| `/oe-search?q=25500-35540` | 200 | 33,514 B |
| `/oe-search?q=2550035540` | 200 | 33,508 B |
| `/products/BW-3005` | 200 | 65,595 B |
| `/rfq?product=BW-3005` | 200 | 92,713 B |
| `/factory` | 200 | 30,074 B |
| `/quality` | 200 | 31,899 B |
| `/about` | 200 | 29,330 B |
| `/contact` | 200 | 24,870 B |
| `/blog` | 200 | 26,697 B |

生产构建上的 OE 搜索正确性：

```
25500-35540  → Bowen 3503, 3004-5, 3004-3
2550035540   → Bowen 3503, 3004-5, 3004-3     ← 结果完全一致
```

### 从交付 ZIP 的完整复现验证

| 步骤 | 结果 |
|---|---|
| 解压 `Bowen-Website-Prototype-V1.zip` | 成功，226 个条目 |
| `node tools/verify-product-db-v2.mjs`（干净副本） | **65 / 65 PASS** |
| `node website/tools/verify-prototype-data.mjs`（干净副本） | **36 / 36 PASS** |
| `pnpm install --frozen-lockfile` | 成功（5.1 秒） |
| `tsc --noEmit` | **0 error** |
| `next build` | **成功，390 个路由** |
| `next start` + 逐页请求 | **12 个页面全部 200** |
| ZIP 泄漏检查 | node_modules / .next / .git / 缓存 / 密钥 / 日志 **均为 0** |

### 文档里承诺的启动命令实测

需求要求「项目能够一条命令启动，例如 npm run dev」。已在 `website/` 目录实测：

| 命令 | 结果 |
|---|---|
| `npm run dev`（走 `npm.cmd` → `tools/npm-run.mjs`） | **成功，http://localhost:3000/ 返回 200，160,493 字节，页面含预期标题** |
| `node tools/npm-run.mjs dev` | 成功 |
| `node tools/npm-run.mjs run build` | 成功（`run` 前缀可省略也可保留） |
| `next start`（生产模式） | 成功，12 个页面全部 200 |

> 修复记录：兼容层在实测中发现并修掉了 3 个真实缺陷 ——
> `where npm` 自引用导致的无限递归、`npm run dev` 里的 `run` token 未被剥离、
> cmd.exe 继承的 PATH 里没有 `node`。详见第七节。

---

## 七、端到端 HTTP 验证

在开发服务器上对真实 URL 发起请求，验证页面确实返回了正确数据：

| 请求 | 结果 |
|---|---|
| `GET /` | 200，147,719 字节 |
| `GET /oe-search?q=4711306950` | 200，命中 Bowen 3005（3 条） |
| `GET /oe-search?q=056121113D` | 200，命中 Bowen 3001（2 条） |
| `GET /oe-search?q=25500-35540` | 200，命中 Bowen 3004-3 等（4 条） |
| `GET /oe-search?q=2550035540` | 200，与上一条结果一致（4 条） |
| `GET /oe-search?q=9091603092` | 200，命中 Bowen 3076（1 条） |
| `GET /oe-search?q=S13069010-37K` | 200，命中 Bowen 3016（2 条） |

---

## 八、测试过程中发现并修掉的真实缺陷

重建与原型开发不是一次就对的。以下是**通过审计与测试发现**并已修复的缺陷
（全部有测试兜底，不会回归）：

| # | 缺陷 | 影响 | 修复 |
|---|---|---|---|
| 1 | 区段标签只作用于自己所在的列块 | 综合表右半区 **141 个产品**拿不到人工分类，Thermostat 只有 130 个 | 改为「按行生效，管辖同一行以下的所有记录区块」，Thermostat 恢复到 262 个 |
| 2 | `ensureProduct` 被调用两次 | 产生 **60 个空壳重复产品** | 改为按 `source_record_id` 记忆化 |
| 3 | blocked 记录被 `continue` 静默丢弃 | 23 条读不出编号的记录没有入库 | 改为保留成 blocked 产品，保留原始来源 |
| 4 | 辅助表编号列里的天博编号被当成产品类型标签 | `5 157 411` 被误判为区段标签 | 双重约束：标签必须在第一条编号列左侧，且必须能在产品类型词典里查到 |
| 5 | `oe_tokens` 在写 application 行时被解构掉 | 网站拿不到逐 token 的 OE，OE 索引上下文不完整 | 保留 `oe_tokens` 字段 |
| 6 | 网站数据集只含 20 个原型产品 | 分类链接与车型筛选指向空结果，381 个可搜索产品无法浏览 | 扩展为全部可展示产品（378 个），原型候选仍单独标记 |
| 7 | 网站数据集的 `application_ids` 指向被过滤掉的记录 | 16 个产品、55 条 OE 索引出现悬空引用 | 生成网站数据集时同步裁剪引用 |
| 8 | `npm.cmd` 里的 `where npm` 自引用 | cmd.exe 把 `npm` 解析回 `npm.cmd` 自身，报 `Maximum setlocal recursion level reached` | 去掉 PATH 查找；调用真实 npm 请用全路径 |
| 9 | `npm.cmd` 用 UTF-8 写中文注释 | cmd.exe 按 OEM 代码页解析 .cmd，注释被当成命令执行，报 "'��机只装了' is not recognized" | `npm.cmd` 改为纯 ASCII |
| 10 | 兼容层不认 `npm run dev` 的 `run` token | 报「未知脚本: run」 | 剥离开头的 `run` / `run-script`，并支持 `--list` |
| 11 | cmd.exe 继承的 PATH 里没有 `node` | 报 "'node' is not recognized"，脚本命令全部失败 | 兼容层自动把 Node 自身所在目录加进 PATH |
| 12 | 自研 ZIP 写出器的 external attributes 溢出 | `0o100644 << 16` 超出有符号 32 位，报 `ERR_OUT_OF_RANGE` | 改为无符号写入 `>>> 0`；同时补上 ZIP64 支持（源 Excel 超 4 GiB 需要） |

### 第二次修复轮（本轮）新发现并修掉的缺陷

| # | 缺陷 | 影响 | 修复 |
|---|---|---|---|
| 13 | **`OeSearchBox` 渲染自己的 `<form>`，被嵌在 RFQ 页的 `<form>` 里** | **非法嵌套 HTML，导致 RFQ 页整页 hydration 失败 —— 表单根本无法交互**，用户点提交没有任何反应。这是一个此前"测试通过"却实际坏掉的功能 | 改为 `role="search"` + 手动处理 Enter 键；语义与可访问性等价。浏览器 E2E 复测已可交互 |
| 14 | RFQ 成功页的 contact 字段是硬编码 `'(from form)'` | 用户看不到自己填的内容，payload 无法作为"将传输的数据"凭证 | 新增纯函数 `buildRfqPayload()` / `readContactFromForm()`，7 个联系字段全部取真实值；并加 E2E 断言禁止占位符 |
| 15 | 从 `/rfq?product=...` 快捷进入时 `application_id` 丢失 | 破坏"保留 Bowen → OE → Vehicle/Engine 的 application 级关系" | `RfqPage` 补传 `first_application_id`，E2E 断言 `application_id` 必须非空 |
| 16 | `.npmrc` 里写了 `package-lock=false` | pnpm 把它理解为"禁止读写 lockfile"，出现 `The current configuration prohibits to read or write a lockfile` 警告，`--frozen-lockfile` 失去意义 | 删除该行；改为 `.gitignore` 忽略 `package-lock.json` / `yarn.lock` |
| 17 | `verify-product-images.mjs` 在全新 clone 里给出 3 个看不懂的失败项 | 图片二进制不入 Git，但测试没有预检 | 增加预检：图片缺失时打印可执行指引并以 exit 2 退出 |
| 18 | Next.js 15.1.6 存在安全通告（CVE-2025-66478） | 安装时 `deprecated` 警告；上线后是安全风险 | 升级到 15.5.26（15.x 最新补丁），告警消失，全部测试仍通过 |
| 19 | 我自己的 E2E 测试脚本用了裸 `document.querySelector('form')` | 命中的是**页头搜索表单**而不是 RFQ 表单，导致反复点击无效、测试假失败 | 给 RFQ 表单加 `data-testid="rfq-form"`，测试选择器全部限定到它 |

> 第 13 项值得单独强调：它说明**"HTTP 200 + 页面能渲染"不等于功能可用**。
> 之前的验收只做了 GET 请求断言，没有做真实交互，所以漏掉了整页 hydration 失败。
> 现在 RFQ 有 31 项真实浏览器交互断言兜底。

---

## 九、已知未通过 / 未覆盖的部分（诚实声明）

| 项目 | 状态 | 说明 |
|---|---|---|
| 邮件真实发送 | **未实现** | 原型按需求不发送邮件，改为展示将传输的完整 payload（联系信息为真实填写值） |
| 真实数据库（PostgreSQL / Supabase） | **未接入** | 本阶段明确禁止。页面层已与数据源解耦（全部 async），但**分页 / 车型聚合 / OE 搜索**三处仍是内存算法，接入时必须用 SQL 重写。详见 [`../docs/supabase-migration-boundary.md`](../docs/supabase-migration-boundary.md) |
| **产品图片未接入网站** | **未做（按业务方要求）** | 图片已提取并映射（798 张 / 398 个产品），但本阶段按要求不改网站，页面仍显示占位符 |
| Lighthouse / 性能评分 | **未测** | 原型阶段未做性能基线 |
| Safari / Firefox 实测 | **未做** | 只用 Chromium 内核（Chrome）验证 |
| 无障碍（WCAG）审计 | **部分** | 已做：skip link、语义标签、`role="search"`、focus-visible、aria-label、表格 caption、表单 label 与 `aria-invalid`；未做完整审计 |
| 跨进程并发压测 | **未做** | 未验证多实例部署下的缓存一致性（当前是进程内 memo） |
| `npm` 兼容层只支持 `run` | **已知限制** | 不支持 `npm install`；装依赖请用 pnpm。这不是缺陷，是刻意的范围限制 |

---

## 十、结论

| 测试套件 | 结果 |
|---|---|
| 数据库验收（`verify-product-db-v2.mjs`） | **65 / 65 PASS** |
| 图片映射验收（`verify-product-images.mjs`） | **39 / 39 PASS** |
| 网站数据集验收（`verify-prototype-data.mjs`） | **36 / 36 PASS** |
| 分类文案与模型守卫（`verify-category-copy.mjs`） | **12 / 12 PASS** |
| RFQ 端到端（`verify-rfq-e2e.mjs`） | **31 / 31 PASS** |
| 响应式（`find-overflow.mjs`，5 个页面） | **5 / 5 PASS** |
| 类型检查 + 生产构建 | **PASS**（0 error，390 个路由） |
| **合计** | **188 项 PASS，0 FAIL** |

**数据库迁移通过，原型验证通过，全新环境可安装可运行可测试。可以进入验收。**
