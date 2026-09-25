# 网站 UI Prototype 报告（Phase 3）

**项目版本：Bowen-Website-Prototype-V1**
**阶段：Phase 2.5（产品数据库重建）+ Phase 3（UI Prototype）**
**技术栈：Next.js 15 + React 19 + TypeScript（App Router）**
**状态：原型完成，未上线，等待验收**

> **完整版报告见 [`../delivery/02_ui-prototype-report.md`](../delivery/02_ui-prototype-report.md)**
> （含全部截图、逐项测试明细、页面清单、placeholder 清单、下一阶段建议）
>
> 本文件是同一份报告的简版，放在 `docs/` 下便于随项目文档一起查阅。

---

## 一句话结论

产品数据库已从旧结构重建为 **451 Products + 802 Product Applications + 3,024 OE 索引**，
其中 **378 个真实产品**已接入网站原型。数据库 **65 项测试全部通过**，
网站数据 **36 项测试全部通过**，响应式 **5 个页面 390px 下零横向溢出**，
`npm run dev` 一条命令即可启动。

**自动猜 product_type = 0。**

---

## 逐条回答需求里的 12 个问题

### 1. 数据迁移是否通过

**通过。** 原始 Excel SHA-256 运行前后一致；数据库 65/65 PASS；网站数据 36/36 PASS。
数据源已切换到最新版 `data/raw/产品信息表1(1).xlsx`
（SHA-256 `79d5995d…44a12`）。

### 2. 自动测试结果

| 测试套件 | 命令 | 结果 |
|---|---|---|
| 数据库验收 | `node tools/verify-product-db-v2.mjs` | **65 / 65 PASS** |
| 网站数据集 | `cd website && node tools/verify-prototype-data.mjs` | **36 / 36 PASS** |
| 响应式（390px） | `cd website && node tools/find-overflow.mjs <url> 390` | **5 / 5 PASS** |
| 类型检查 | `cd website && npm run typecheck` | **0 error** |
| 生产构建 | `cd website && npm run build` | **成功，32 页** |

需求指定的 TEST 1–7 全部通过（详见 `../delivery/03_test-results.md`）。

### 3. 使用了哪些真实产品

**全部 378 个可展示产品都是真实数据**，没有一个是编造的。

其中 20 个 Prototype 候选产品（信息最完整，全部为 Thermostat）用于首页重点展示：
`3005 / 3051 / 3080 / 3004-3 / 3061A / 30101 / 3077 / 3016 / 3076 / 3001 /
3020 / 3069 / 3019 / 3061 / 3094 / 3035 / 3203 / 3068 / 31605 / 3003-1`

**20 个产品合计 81 条 application、758 条 OE 索引记录。**

网站数据分布：Thermostats 259 / Automotive Switches 75 / Temperature Sensors 41 /
Related Cooling Parts 3 —— 每个分类都有真实产品，没有空分类。

> **产品图片（已于 Phase 2.6 更正）**：此前称「Excel 图片列为空」是**错误**的。
> 工作簿内实际嵌有 681 个图片文件 / 798 个图片对象，已全部提取并映射到 398 个产品
> （`exact` 767 / `review_required` 26 / `unresolved` 5）。
> 图片不在单元格值里，而在 OOXML 绘图层，只读 `cell.value` 看不到。
> 完整审计见 [`excel-image-audit.md`](excel-image-audit.md)。
> **按业务方要求，本阶段暂未把图片接入网站**，页面仍显示 "Photo pending"。

### 4. 完成了哪些页面

Home（10 个 Screen）· Products · Product Detail · OE Search · Request a Quote ·
Factory · Quality · About Bowen · Contact · 404 —— 全部完成。
**Blog 仅页面框架**（按需求本阶段不批量生成内容）。

### 5. OE Search 如何测试

1. 打开 http://localhost:3000
2. 首屏搜索框输入 `25500-35540` → Search OE → 显示 `Exact OE Match`
3. 改输入 `2550035540` → **结果完全一致**（证明标准化检索生效）

或直接访问 URL：

```
http://localhost:3000/oe-search?q=4711306950
http://localhost:3000/oe-search?q=25500-35540
http://localhost:3000/products?q=4711306950
```

标准化规则：忽略大小写、空格、短横线、斜线。

### 6. 使用哪个真实 OE 可以演示

| OE Number | 精确命中 | 对应 Bowen No. |
|---|---|---|
| `25500-35540` | 4 条 | **3503 / 3004-5 / 3004-3** |
| `2550035540` | 4 条 | **3503 / 3004-5 / 3004-3**（与上一条相同，用于对比） |
| `4711306950` | 3 条 | **3005** |
| `056121113D` | 2 条 | **3001** |
| `9091603092` | 1 条 | **3076** |
| `S13069010-37K` | 2 条 | **3016** |

推荐演示 `25500-35540` 与 `2550035540` 的对比，再进
http://localhost:3000/products/BW-3005 看详情页（85 个 OE、7 条 application）。

### 7. RFQ 如何测试

1. 打开 http://localhost:3000/products/BW-3005
2. 右侧 **Add to RFQ** 选 OE → 填数量 → 点击
3. 底部出现 RFQ 汇总条（显示带入的 Bowen / OE / 车型）
4. 点 **Review & Request Quote** 进入 `/rfq`
5. 明细已自动带入 product_id / Bowen No. / Matched OE / Vehicle / Engine
6. 填 Name / Company / Country / Email / WhatsApp·Phone / Quantity / Message
7. 可 **Upload Sourcing List**（原型不上传不存储）
8. 提交 → **不发邮件**，但展示将传输的完整 JSON payload，证明数据流跑通

表单校验可测：留空必填项、填非法邮箱、不选产品也不写需求 → 均有明确报错。

### 8. 哪些地方还是 placeholder

产品图片（已提取映射，暂未接入）· RFQ 邮件（展示 payload）· 占位邮箱 ·
公司注册信息与联系方式 · 产能/交期/MOQ/包装规范 · 认证证书编号与范围 ·
检测设备清单 · 公司沿革 · Blog 正文 · 70 个待确认产品类型。

**全部在页面上显式标注，没有为了填满页面而编造数据。**
完整清单见 `../delivery/04_known-issues.md`。

### 9. 如何启动网站

```bash
cd website
npm install     # 首次
npm run dev     # 一条命令启动
```

本机没有全局 npm 时：`node tools/npm-run.mjs dev`（项目自带兼容层）。
用 pnpm 时：`pnpm run dev`。

### 10. 本地访问地址

**http://localhost:3000**

主要页面：`/products` · `/products/BW-3005` · `/oe-search` · `/rfq` ·
`/factory` · `/quality` · `/about` · `/contact` · `/blog`

### 11. 手机端如何查看

```bash
cd website
npm run dev:host
ipconfig | findstr IPv4      # 查电脑局域网 IP
```

手机浏览器打开 `http://<你的IP>:3000`。

重点检查四处：**OE Search**（按钮变上下全宽）· **Products**（筛选面板移到顶部，
卡片三列→单列）· **Application Table**（表格可横向滑动，表头吸顶）·
**RFQ**（明细上下堆叠，Remove 变全宽）。

已用 CDP 探针在 390px 下逐页验证：**5 个页面横向溢出均为 0px**。

### 12. 下一阶段建议做什么

**P0 先补数据**：确认 70 个产品类型 · 确认错位判定口径 · 提供产品照片 ·
替换占位邮箱 · 补公司注册信息
**P1 再上线**：接入 PostgreSQL/Supabase（只改 `website/src/lib/db.ts` 一个函数）·
RFQ 真正发信 · 站点 SEO（当前 noindex）· 部署与域名
**P2 内容**：Blog 按 6 个计划选题撰写 · 多语言评估 · 核对 125 个共享 OE

---

## 本阶段产物

| 产物 | 位置 |
|---|---|
| 网站源码 | `website/`（Next.js + TypeScript，15 个组件，10 个页面） |
| 数据访问层 | `website/src/lib/db.ts` ← 未来换数据库只改这里 |
| 数据库 | `data/derived/v2/*.json` |
| 网站数据 | `website/src/data/*.json` |
| 人工参考清单 | `review/*.xlsx`（共享 OE / 类型待确认 / 错位待复核） |
| 交付包 | `delivery/`（报告 + 截图 + 说明书） |
| 截图 | `delivery/screenshots/`（6 张，Desktop + Mobile） |
