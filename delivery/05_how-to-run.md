# 运行指南（How to Run）

**项目版本：Bowen-Website-Prototype-V1**
**最后验证：2026-09-25，Node.js v24.9.0，pnpm 10.34.5，Windows**

---

## 〇、唯一推荐的包管理器与版本（先看这一节）

| 项目 | 唯一推荐值 | 说明 |
|---|---|---|
| **包管理器** | **pnpm** | 不接受 npm / yarn。原因：仓库里只有 `pnpm-lock.yaml` 一份锁文件，用别的管理器会解析出不同的依赖树 |
| **pnpm 版本** | **10.34.5**（精确锁定） | 写在 `website/package.json` 的 `packageManager` 字段，Corepack 会强制使用该版本 |
| **pnpm 最低版本** | **>= 10.16.0** | 写在 `engines.pnpm`。低于此版本不认识 `pnpm.ignoredBuiltDependencies`，会出现构建脚本警告 |
| **Node.js 最低版本** | **>= 18.18.0**（Next.js 15 要求） | 写在 `engines.node` |
| **验证用 Node 版本** | v24.9.0 | 本项目的验证环境 |

`website/.npmrc` 里开启了 `engine-strict=true`：版本不满足会**直接报错**，
而不是静默继续跑出难以排查的问题。

```bash
node --version     # 需要 >= 18.18.0
pnpm --version     # 需要 >= 10.16.0（推荐 10.34.5）
```

如果本机没有 pnpm：

```bash
corepack enable          # Node 自带，会按 packageManager 字段自动拉取 pnpm 10.34.5
# 或
npm i -g pnpm@10.34.5
```

---

## 一、最快路径（3 步）

```bash
cd website
pnpm install --frozen-lockfile   # 首次安装，严格按锁文件（约 6 秒）
pnpm run dev                     # 一条命令启动
```

浏览器打开 **http://localhost:3000**，
看到「Automotive Thermostat Manufacturer」首页即为成功。

> 为什么推荐加 `--frozen-lockfile`：它会校验 `package.json` 与 `pnpm-lock.yaml`
> 是否一致。不一致就直接失败，避免"在我机器上能跑"的问题。
> 日常开发用 `pnpm install` 也可以。

---

## 二、前置条件与安装说明

### 2.1 环境

| 项目 | 要求 | 本项目验证环境 |
|---|---|---|
| Node.js | **>= 18.18.0** | **v24.9.0** |
| pnpm | **>= 10.16.0**（推荐 10.34.5） | **10.34.5** |
| 操作系统 | Windows / macOS / Linux | Windows |
| 浏览器 | Chromium 内核（Chrome / Edge）为佳 | Chrome |

### 2.2 sharp 的构建脚本：**不需要执行**

安装时你会看到（或曾经看到）这样一条提示：

```
Ignored build scripts: sharp@0.33.5.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

**这个提示现在已经被显式消除，而且结论是：sharp 的构建脚本不需要执行。**

原因：

1. `sharp` 不是本项目的直接依赖，它是 **Next.js 的 optionalDependency**
   （`next@15.5.26` 的 `optionalDependencies.sharp = ^0.33.5`）。
2. sharp 只在 Next.js 的**内置图片优化**（也就是 `next/image` 组件）时才会被用到。
3. 本项目**全部使用原生 `<img>`，全仓没有任何 `next/image` 用法**
   （可用 `grep -r "next/image" src/` 验证，结果为空）。
4. 因此跳过 sharp 的构建脚本**不影响** `pnpm install` / `typecheck` / `build` / `start`
   —— 这四步都已在干净目录实测通过。

所以项目在 `website/package.json` 里显式声明了这个决定：

```json
"pnpm": {
  "ignoredBuiltDependencies": ["sharp"]
}
```

这样既不会再弹警告，也把"为什么可以忽略"固化进了代码。

> **如果将来启用 `next/image`**：请把 `"sharp"` 从 `ignoredBuiltDependencies` 里移除，
> 重新 `pnpm install`，并执行 `pnpm approve-builds` 允许它运行安装脚本。
> 否则图片优化会在运行时失败。

### 2.3 安装命令

```bash
cd website

# 推荐：严格按锁文件安装（CI / 干净环境）
pnpm install --frozen-lockfile

# 日常开发
pnpm install
```

### 2.4 一条命令跑完全部验收（需要先启动网站）

```bash
cd website
pnpm run verify:data        # 网站数据集验收（36 项）
pnpm run verify:rfq         # RFQ 表单→payload 端到端（31 项，自动起临时服务器）
pnpm run verify:overflow    # 移动端 390px 横向溢出
pnpm run typecheck
pnpm run build
```

---

## 三、启动网站

### 3.1 开发模式（日常使用）

```bash
cd website
pnpm run dev
```

- 地址：**http://localhost:3000**
- 端口固定 3000（写在 `website/package.json` 的脚本里：`next dev -p 3000`）
- 支持热更新，改代码即时生效

> 本机没有全局 npm 时，也可以用项目自带的兼容层：
> `npm run dev` 或 `node tools/npm-run.mjs dev`（见第八节）。

### 3.2 手机 / 局域网访问

```bash
cd website
pnpm run dev:host
```

查看电脑局域网 IP：

```powershell
ipconfig | findstr IPv4
```

假设得到 `192.168.1.23`，手机浏览器打开 `http://192.168.1.23:3000`。

> 手机与电脑必须在同一 Wi-Fi 下。
> 打不开时检查 Windows 防火墙是否放行 Node.js 入站连接。

### 3.3 生产模式（验证构建产物）

```bash
cd website
pnpm run build     # 构建，约 25 秒，产出 390 个路由（378 个产品页 + 12 个其他）
pnpm start         # 启动生产服务器
```

### 3.4 类型检查

```bash
cd website
pnpm run typecheck
```

预期输出：无错误（exit code 0）。

---

## 四、全部可用命令

在 `website/` 目录下执行（把 `pnpm` 换成 `npm` 也可以，见第八节）：

| 命令 | 作用 |
|---|---|
| `pnpm install --frozen-lockfile` | 严格按锁文件安装（推荐用于干净环境 / CI） |
| `pnpm run dev` | 启动开发服务器（端口 3000） |
| `pnpm run dev:host` | 启动并监听 0.0.0.0，供手机/局域网访问 |
| `pnpm run build` | 生产构建（390 个路由） |
| `pnpm start` | 启动生产服务器 |
| `pnpm run start:host` | 生产服务器监听 0.0.0.0 |
| `pnpm run typecheck` | TypeScript 类型检查 |
| `pnpm run verify:data` | 网站数据集验收（36 项） |
| `pnpm run verify:rfq` | RFQ 表单→payload 端到端测试（31 项） |
| `pnpm run verify:overflow` | 移动端 390px 横向溢出探针 |
| `pnpm run data:refresh` | 重新生成并校验产品数据库 |

在项目根目录执行（数据处理）：

| 命令 | 作用 |
|---|---|
| `node tools/build-product-db-v2.mjs` | 从原始 Excel 重建产品数据库 + 网站数据集 |
| `node tools/verify-product-db-v2.mjs` | 数据库验收测试（65 项） |
| `node tools/extract-product-images.mjs` | 提取 Excel 嵌入图片并建立映射 |
| `node tools/verify-product-images.mjs` | 图片映射验收测试（39 项） |
| `node tools/build-review-lists-v2.mjs` | 生成 3 个人工参考 Excel |
| `cd website && node tools/verify-prototype-data.mjs` | 网站数据集验收测试（36 项） |
| `cd website && node tools/verify-category-copy.mjs` | 分类模型与文案守卫（12 项） |
| `cd website && node tools/verify-rfq-e2e.mjs` | RFQ 端到端测试（自动起临时服务器） |
| `cd website && node tools/find-overflow.mjs <url> 390` | 检查某页在 390px 下是否横向溢出 |
| `cd website && node tools/screenshot.mjs <url> <out.png> <宽>` | 用 CDP 截整页图 |

### 一条命令跑完全部验收

```bash
# 项目根目录
node tools/verify-product-db-v2.mjs
node tools/verify-product-images.mjs

# 网站目录
cd website
node tools/verify-prototype-data.mjs
node tools/verify-category-copy.mjs
node tools/verify-rfq-e2e.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

---

## 五、干净目录安装验证结果（已实测）

下面是**从 `git archive HEAD` 导出的干净目录**（没有 `node_modules`、没有 `.next`）
里逐步实测的结果，可以用来判断"全新环境能不能装起来"：

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | ✅ 成功，无 lockfile 警告、无 sharp 警告 |
| 2 | `pnpm run typecheck` | ✅ 0 error |
| 3 | `pnpm run build` | ✅ 成功，390 个路由 |
| 4 | `pnpm start` | ✅ 启动成功 |
| 5 | 逐页 HTTP 请求 10 个页面 | ✅ 全部 200，均带 `X-Robots-Tag: noindex, nofollow` |

### 如果 `--frozen-lockfile` 失败，按这个顺序排查

| 报错 / 现象 | 原因 | 解决办法 |
|---|---|---|
| `ERR_PNPM_LOCKFILE_VERSION_UNSUPPORTED`（或提示 lockfileVersion 9.0 不支持） | pnpm 版本太旧（< 9） | 升级到 **pnpm >= 10.16.0**（推荐 10.34.5） |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `package.json` 的依赖与 `pnpm-lock.yaml` 不一致（有人改了依赖没重装） | 先在干净环境执行 `pnpm install` 更新锁文件并提交；**不要**用 `--no-frozen-lockfile` 糊过去 |
| `Unsupported environment (bad pnpm and/or Node.js version)` | `engine-strict=true` 生效，Node 或 pnpm 版本不满足 `engines` | 升级 Node 到 **>= 18.18.0**、pnpm 到 **>= 10.16.0** |
| `Ignored build scripts: sharp`（警告） | 用了 pnpm < 10.16，不认 `pnpm.ignoredBuiltDependencies` | 升级 pnpm；这个警告**不影响**构建（见第 2.2 节） |
| 找不到 `pnpm` 命令 | 本机没装 pnpm | `corepack enable`（Node 自带，按 `packageManager` 字段自动拉取） |
| 出现 `package-lock.json` / `yarn.lock` | 有人用 npm / yarn 装了依赖 | 删掉它们；`.gitignore` 已忽略，仓库只接受 `pnpm-lock.yaml` |

---

## 六、本机没有全局 npm / pnpm 怎么办

有两种办法。

### 6.1 推荐：用 corepack 启用 pnpm

```bash
corepack enable
cd website
pnpm install --frozen-lockfile
pnpm run dev
```

`corepack` 是 Node 自带的，会读取 `package.json` 的 `packageManager: "pnpm@10.34.5"`
并自动使用该版本，不需要手动装。

### 6.2 备选：项目自带的 npm 兼容层

本项目的原开发机只装了 Node.js，没有全局 npm / pnpm。
为此项目带了一个极简的 npm 兼容层：

```
website/npm.cmd              Windows 批处理入口
website/tools/npm-run.mjs    实际实现（零依赖，约 110 行）
```

它做的事：读 `package.json` 的 `scripts`，用系统 shell 执行对应命令，
并把 `node_modules/.bin` 和 Node 自身所在目录放进 PATH。

**用法与 npm 一致**（在 `website/` 目录下）：

```bash
npm run dev            # 走 npm.cmd → tools/npm-run.mjs
npm run build
npm start
```

或者直接调用：

```bash
node tools/npm-run.mjs dev
node tools/npm-run.mjs run build      # "run" 前缀可省略也可保留
node tools/npm-run.mjs --list         # 列出所有可用脚本
```

**兼容层的局限（重要）**：

- 只支持 `npm run <script>` 与 `npm start`；**不支持 `npm install`**。
  装依赖请用 `pnpm install`（或标准 npm）。
- `npm.cmd` 里**故意不做 `where npm` 检查**：cmd.exe 会把 `npm` 解析回这个文件本身，
  造成 `Maximum setlocal recursion level reached` 无限递归。
- `npm.cmd` 必须是**纯 ASCII**：cmd.exe 用 OEM 代码页解析 `.cmd`，
  写中文注释会导致注释被当成命令执行。

> 在装有标准 npm 的机器上直接用真实 npm 即可，兼容层不会被触发。

---

## 七、首次运行的完整流程（从零开始）

```bash
# 1) 确认环境
node --version      # 需要 >= 18.18.0
pnpm --version      # 需要 >= 10.16.0（推荐 10.34.5）

# 2) 进入网站目录
cd website

# 3) 安装依赖（首次必须）
pnpm install --frozen-lockfile

# 4) 启动
pnpm run dev

# 5) 浏览器打开
#    http://localhost:3000
```

### 7.1 全新 clone 后必须多做一步：生成产品图片

产品图片的**二进制**没有纳入 Git（约 66.5 MB，且可由冻结的原始 Excel 完整重新生成），
但**映射文件已入库**。所以全新 clone 出来的目录里：

- ✅ 网站可以正常 `install` / `typecheck` / `build` / `start`（图片不是构建依赖）
- ✅ 数据测试与文案守卫测试可以直接跑
- ⚠️ 只有 `tools/verify-product-images.mjs` 会因为图片文件缺失而提示先执行提取

```bash
# 在项目根目录执行一次（约 30 秒）
node tools/extract-product-images.mjs
```

完成后 `data/processed/product-images/` 会有 798 个文件与映射完全对应。
如果忘了这一步直接跑图片验收测试，脚本会打印上面这段指引并以 exit code 2 退出，
不会给出一堆看不懂的失败项。

### 7.2 如果依赖已经装好，只想重新生成数据

```bash
# 在项目根目录
node tools/build-product-db-v2.mjs      # 重建数据库 + 网站数据集
node tools/verify-product-db-v2.mjs     # 65 项验收

# 网站会自动读取新生成的数据（开发服务器热更新）
```

---

## 七、依赖说明

### 运行依赖（3 个，全部是框架本身）

| 包 | 版本 | 用途 |
|---|---|---|
| next | **15.5.26** | 框架（App Router） |
| react | 19.0.0 | UI 库 |
| react-dom | 19.0.0 | DOM 渲染 |

> **Next.js 已从 15.1.6 升级到 15.5.26。**
> 原因：15.1.6 存在已知安全通告（CVE-2025-66478），npm 会给出
> `deprecated next@15.1.6: This version has a security vulnerability` 警告。
> 15.5.26 是 15.x 线的最新补丁版，升级后告警消失，
> typecheck / build / 全部测试仍通过。

**没有引入任何第三方 UI 库 / 图表库 / 状态管理库。**
所有样式是手写 CSS Modules，所有状态是 React 内置能力。

### sharp 是传递依赖，不是直接依赖

`sharp` 由 `next` 的 `optionalDependencies` 引入，只在 `next/image` 图片优化时使用。
本项目**不使用 `next/image`**，因此不执行它的构建脚本（见第 2.2 节）。

### 开发依赖

| 包 | 版本 |
|---|---|
| typescript | 5.7.2 |
| @types/node | 22.10.2 |
| @types/react | 19.0.2 |
| @types/react-dom | 19.0.2 |

### 数据处理脚本

`tools/` 下的所有 Node.js 脚本**零第三方依赖**，只用 Node 内置模块
（`fs` / `zlib` / `crypto` / `child_process`）。XLSX 的读写是自己实现的
（`tools/xlsx-reader.mjs` / `tools/lib/xlsx-writer.mjs`）。

---

## 八、常见问题

### Q1：`pnpm install --frozen-lockfile` 失败

见第五节末尾的排查表。

### Q2：`npm run dev` 提示找不到 npm

见第 6.2 节。用 `corepack enable` 启用 pnpm，或 `node tools/npm-run.mjs dev`。

### Q3：端口 3000 被占用

改 `website/package.json` 里脚本的端口号：

```json
"dev": "next dev -p 3001"
```

或临时指定：

```bash
node node_modules/next/dist/bin/next dev -p 3001
```

### Q4：手机打不开局域网地址

1. 确认用了 `pnpm run dev:host`（监听 0.0.0.0），不是 `pnpm run dev`
2. 确认手机和电脑在同一个 Wi-Fi
3. 检查 Windows 防火墙是否放行 Node.js
4. 用 `ipconfig` 确认 IP 地址正确（不要用 127.0.0.1）

### Q5：页面数据是空的 / 产品列表没内容

网站数据来自 `website/src/data/*.json`（由构建脚本生成）。重新生成：

```bash
node tools/build-product-db-v2.mjs
```

### Q6：构建报错 `spawn EPERM`

说明运行环境限制了 Node 启动子进程。Next.js 的构建与开发服务器
都需要启动 worker 进程，这是环境限制而非项目缺陷。
在正常的开发机或 CI 上不受影响。

### Q7：想确认原始 Excel 没被改过

```bash
node tools/verify-product-db-v2.mjs
```

看 TEST 1 那一组是否 PASS（会打印实际 SHA-256）。
冻结值在 `data/raw/SOURCE-MANIFEST.json`。

### Q8：提交 RFQ 后没有收到邮件

这是**预期行为**。原型阶段不发邮件（需求明确允许）。
提交后会展示将传输的完整 JSON payload（其中联系信息是用户实际填写的值），
用来验证数据链路。可用 `pnpm run verify:rfq` 自动验证这条链路。

### Q9：产品图片为什么还是占位符

图片**其实存在**（Excel 里有 681 个文件），已提取到
`data/processed/product-images/` 并映射到 398 个产品，
但按业务方要求**本阶段暂未接入网站**。详见 `docs/excel-image-audit.md`。

---

## 九、目录速查

```
B2B外贸独立站/
├── README.md                        总览
├── delivery/                        本阶段交付包（报告 / 截图 / 说明书）
├── docs/                            项目文档
│   ├── supabase-migration-boundary.md   ★ 接入数据库的边界说明
│   └── excel-image-audit.md            Excel 嵌入图片审计
├── website/                         ★ 网站源码（Next.js + TypeScript）
│   ├── package.json                 一条命令启动的入口 + packageManager 锁定
│   ├── .npmrc                       安装配置（engine-strict / peer 处理）
│   ├── npm.cmd                      npm 兼容层（本机没装 npm 时用）
│   ├── src/app/                     页面
│   ├── src/components/              组件
│   ├── src/lib/
│   │   ├── db.ts                    ★ 页面唯一数据入口（全部 async）
│   │   ├── repository.ts            ★ ProductRepository 接口定义
│   │   ├── repositories/json-repository.ts  ← 唯一 import JSON 数据的地方
│   │   ├── rfq-payload.ts           RFQ payload 纯函数构造器
│   │   └── oe-normalize.ts          OE 标准化
│   ├── src/data/                    网站使用的数据（由构建脚本生成）
│   └── tools/                       验收测试与截图工具
├── tools/                           数据处理脚本（零依赖）
│   ├── build-product-db-v2.mjs      数据库重建
│   ├── verify-product-db-v2.mjs     65 项验收测试
│   ├── extract-product-images.mjs   Excel 嵌入图片提取
│   ├── verify-product-images.mjs    39 项图片映射测试
│   └── config/product-types.mjs     产品类型词典 + 全部人工裁决点
├── data/
│   ├── raw/                         ⚠️ 原始资料，只读，永不修改
│   ├── derived/v2/                  重建后的数据库（可重新生成）
│   └── processed/                   提取出的产品图片 + 映射
└── review/                          人工参考清单（Excel）
```
