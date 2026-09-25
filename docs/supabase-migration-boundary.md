# Supabase / PostgreSQL 接入边界说明

**目的：把钱花在正确的地方——明确接入真实数据库时"什么会变、什么不会变"，而不是给一个过于乐观的承诺。**

**当前状态：Phase 3 原型，数据来自构建期生成的 JSON。本阶段**禁止**接入 Supabase。**

---

## 一、先纠正一个说法

早期版本的 `src/lib/db.ts` 里写过：

> ❌ "未来换成 PostgreSQL / Supabase 时，只要返回同样形状的对象，页面代码一行都不用改"
> ❌ "唯一改动点已标注在 `loadDataset()`"

**这个说法不准确，已经删除。** 它把一个 8 项的迁移工作说成了 1 项。

真实情况分两面：

| 方面 | 结论 |
|---|---|
| ✅ **页面层确实不用改** | 因为页面只调用 `src/lib/db.ts` 导出的函数，而这些函数**现在就已经全部是 async** |
| ❌ **但「换一个实现类」远远不够** | 至少还有 8 项配套工作，其中 3 项（分页、聚合、OE 搜索）如果照搬当前实现会直接把全表拉进应用层 |

下面把边界说清楚。

---

## 二、当前分层（已完成的重构）

```
页面 / 路由 (src/app/**)
        │  只 import '@/lib/db'，只知道函数名与返回类型
        ▼
数据访问 API (src/lib/db.ts)
        │  注册实现 + 转发调用；全部 async
        ▼
接口契约 (src/lib/repository.ts)
        │  interface ProductRepository（全部 async 方法）
        ▼
实现 (src/lib/repositories/json-repository.ts)
        │  ★ 全项目唯一 import '@/data/*.json' 的地方
        ▼
构建期数据 (website/src/data/*.json)
        └─ 由 tools/build-product-db-v2.mjs 从原始 Excel 生成
```

### 已经达成的三个约束

1. **页面层不依赖 JSON 文件结构**
   已用测试确认：`src/app/` 与 `src/components/` 下**没有任何** `from '@/data/...'` 的 import。
   页面只认识 `Product` / `ProductApplication` 这样的领域类型。

2. **所有查询已经是 async**
   `db.ts` 导出的 13 个函数全部返回 Promise，页面已经 `await`。
   接入真实数据库时，页面**不需要**加 `await`、不需要改签名。

3. **实现可替换**
   `setRepository()` 允许在启动时注入另一个实现，便于灰度或测试替身。

---

## 三、接入 Supabase 时**实际要改**的东西

### 3.1 必改：新增一个实现类

```ts
// src/lib/repositories/supabase-repository.ts（新增）
export class SupabaseProductRepository implements ProductRepository {
  async getPublishedProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('status', ['prototype_candidate', 'searchable_noindex'])
      .eq('blocked', false);
    if (error) throw error;
    return data.map(mapProductRow);
  }
  // …其余方法同理
}
```

然后在 `src/lib/db.ts` 里换一行：

```ts
setRepository(new SupabaseProductRepository());
```

**注意**：还需要一个 `mapProductRow()` 把数据库行映射成领域类型。
如果数据库列名与领域字段不一致，映射层就是新的维护点——这一点现在无法避免。

### 3.2 必改：这 3 个查询**必须重写**，不能照搬

| 方法 | 当前实现（JSON） | 真库必须改成 | 不改的后果 |
|---|---|---|---|
| `listProducts()` | 内存 `filter` + `slice(page)` | SQL `WHERE` + `LIMIT/OFFSET` + `COUNT(*)` 取 total | 每次翻页把全表拉到应用层 |
| `getMakeSummaries()` | 遍历全部 application，在 Node 里按关键词聚合 | SQL 聚合视图 / 物化视图 + 车型维度表 | 首页每次请求扫描全表 |
| `searchByOe()` | 对 oe_index 全表做 `includes()` 模糊匹配 | 索引列精确匹配 + 前缀匹配（必要时 `pg_trgm`） | OE 搜索随库增长线性变慢 |

> 这三项是本次重构**明确没有解决**的问题：接口已经是异步的，但**算法仍是 O(全表)**。
> 它们不是"换实现类"能解决的，需要写 SQL。

### 3.3 必改：站点事实要换存放方式

`site-facts.json`（公司规模、认证、研发数字）现在是一个构建产物文件。
真库里应改为 `settings` 表或环境配置，并明确谁有权修改（这些是**对外声明**，改动需要审批）。

### 3.4 必改：缓存策略

现在 `json-repository.ts` 用模块级变量 `cached` 做进程内 memo。
换成数据库后要决定：

- 用 Next 的 `fetch` 缓存 / `unstable_cache` / `revalidate`？
- 后台改动产品数据后，前台多久生效？
- 是否需要按 tag 精确失效？

**这一点现在没有答案，需要在接入时明确。**

### 3.5 必改：构建期渲染策略

目前 378 个产品页在 `next build` 时**全部静态生成**（`generateStaticParams`）。
真库里产品量增长后，构建会线性变慢。需要改成：

- ISR（`revalidate`）？
- 按需渲染 + CDN 缓存？
- 还是保留全量静态生成（配合产品数量上限）？

### 3.6 必改：RFQ 落库与通知

当前 RFQ 只在浏览器里构造 payload 并展示（**不发送邮件**）。
真库接入需要新增（**这些都不在 `ProductRepository` 范围内**）：

```ts
// 新增：写仓储，不是读仓储
interface RfqRepository {
  createRequest(payload: RfqPayload): Promise<{ id: string }>;
}
```

配套还要有：文件上传（Sourcing List）的存储方案、给销售的邮件/通知、
给客户的回执、以及防重复提交。

### 3.7 必改：鉴权与限流

- 公开读接口：是否需要限流防爬？
- 任何写接口（RFQ、后台）：需要服务端会话 + 速率限制。
- 现在这一层**完全没有**，属于上线前必须补的。

### 3.8 建议：环境与密钥

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` 走环境变量，**绝不入库**（`.gitignore` 已挡 `.env`）。
- 服务端专用密钥只能用在不经过客户端的路径上。
- 数据库开启 RLS，公开只读角色只能读 `status in (...)` 且 `blocked = false` 的行
  —— 这与前台"blocked/draft 不对外"的业务规则一致，应该在数据库层再挡一道。

---

## 四、哪些查询会变成异步（清单）

**实际上：已经全部是异步了。** 下面是"在真库上会真正产生 I/O"的方法，
以及它们对应的页面。

| 方法 | 真库上的行为 | 使用它的页面 |
|---|---|---|
| `getPublishedProducts()` | 每次查询（或走缓存） | 首页、Products、RFQ |
| `getProductById(id)` | 主键查询 | 产品详情页（含 `generateMetadata`、`generateStaticParams`） |
| `getProductByBowen(bowenNo)` | 唯一索引查询 | 暂未在页面使用，已预留 |
| `listProducts(filters)` | 带 WHERE/LIMIT/COUNT 的分页查询 | Products 页 |
| `getApplicationsForProduct(id)` | 一对多查询 | 内部审计用 |
| `getDisplayApplications(id)` | 一对多查询（过滤 blocked/needs_review） | 产品详情页、RFQ 页 |
| `searchByOe(query)` | 索引查询（+ 前缀匹配） | OE Search 页 |
| `searchByBowen(query)` | 模糊查询 | 暂未使用，已预留 |
| `getCategorySummaries()` | 聚合查询 | 首页、Products 页筛选器 |
| `getProductTypeOptions()` | 聚合查询 | Products 页筛选器 |
| `getMakeSummaries()` | 重聚合（建议物化视图） | 首页、Products 页筛选器 |
| `getSiteFacts()` | 单行配置查询 | 首页、Factory、Quality、About |
| `getDatasetStats()` | 多个 COUNT | 首页、About |

**页面侧的影响：无。** 因为这些调用点已经全部 `await`。
唯一需要注意的是 **Server Component 的并发**：现在 `rfq/page.tsx` 里用了
`Promise.all` 并发取每个产品的 application；真库上这会产生 N 次查询，
应改成一次带 `IN (...)` 的批量查询（这属于 3.2 类的算法问题）。

---

## 五、迁移检查清单（接入时逐项确认）

- [ ] 新增 `SupabaseProductRepository implements ProductRepository`
- [ ] 写 `mapProductRow()` 行→领域类型映射，并测试 blocked/draft 被过滤
- [ ] `listProducts()` 改为 SQL 分页 + COUNT，验证 total 正确
- [ ] `getMakeSummaries()` 改为聚合视图，验证首页性能
- [ ] `searchByOe()` 改为索引查询，验证 `25500-35540` 与 `2550035540` 命中一致
- [ ] `getSiteFacts()` 换数据源，确认页面数字不变
- [ ] 明确缓存与失效策略
- [ ] 明确构建期渲染策略（ISR / 按需）
- [ ] 新增 RFQ 写路径 + 文件上传 + 通知 + 回执
- [ ] 加限流与鉴权
- [ ] 开 RLS，把"blocked/draft 不对外"下沉到数据库
- [ ] 重跑全部验收：`verify-product-db-v2` / `verify-prototype-data` / `verify-category-copy` / `verify-rfq-e2e` / `find-overflow` / `typecheck` / `build`

---

## 六、一句话总结

> **页面层已经和"数据存在哪里"解耦了，这是本次重构的收益；
> 但"查询怎么写"没有解耦——分页、聚合、OE 搜索这三处仍然是内存算法，
> 接入 Supabase 时必须以 SQL 重写，不能只换一个实现类。**
