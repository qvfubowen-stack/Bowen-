# 运行指南（How to Run）

**项目版本：Bowen-Website-Prototype-V1**
**最后验证：2026-09-25，Node.js v24.9.0，Windows**

---

## 一、最快路径（3 步）

```bash
cd website
npm install       # 首次运行需要，装依赖（约 10 秒）
npm run dev       # 一条命令启动
```

然后浏览器打开：

```
http://localhost:3000
```

看到「Automotive Thermostat Manufacturer」首页即为成功。

---

## 二、前置条件

| 项目 | 要求 | 本项目验证环境 |
|---|---|---|
| Node.js | 18 或以上 | **v24.9.0** |
| 包管理器 | npm 或 pnpm 任一 | pnpm 10.34.5（本机没有全局 npm，见第五节） |
| 操作系统 | Windows / macOS / Linux | Windows |
| 浏览器 | Chromium 内核（Chrome / Edge）为佳 | Chrome |

检查 Node 是否可用：

```bash
node --version
```

---

## 三、启动网站

### 3.1 开发模式（日常使用）

```bash
cd website
npm run dev
```

- 地址：**http://localhost:3000**
- 端口固定 3000（写在 `website/package.json` 的脚本里：`next dev -p 3000`）
- 支持热更新，改代码即时生效

### 3.2 手机 / 局域网访问

```bash
cd website
npm run dev:host
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
npm run build     # 构建，约 20 秒，产出 32 个页面
npm start         # 启动生产服务器
```

### 3.4 类型检查

```bash
cd website
npm run typecheck
```

预期输出：无错误（exit code 0）。

---

## 四、全部可用命令

在 `website/` 目录下执行：

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run dev:host` | 启动并监听 0.0.0.0，供手机/局域网访问 |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm start:host` | 生产服务器监听 0.0.0.0 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run data:refresh` | 重新生成并校验产品数据库 |

在项目根目录执行（数据处理）：

| 命令 | 作用 |
|---|---|
| `node tools/build-product-db-v2.mjs` | 从原始 Excel 重建产品数据库 + 网站数据集 |
| `node tools/verify-product-db-v2.mjs` | 数据库验收测试（65 项） |
| `node tools/build-review-lists-v2.mjs` | 生成 3 个人工参考 Excel |
| `cd website && node tools/verify-prototype-data.mjs` | 网站数据集验收测试（36 项） |
| `cd website && node tools/find-overflow.mjs <url> 390` | 检查某页在 390px 下是否横向溢出 |
| `cd website && node tools/screenshot.mjs <url> <out.png> <宽>` | 用 CDP 截整页图 |

---

## 五、本机没有全局 npm 怎么办

本项目的开发环境**只装了 Node.js，没有全局 npm**。
为此项目自带一个极简的 npm 兼容层：

```
website/npm.cmd              Windows 批处理入口
website/tools/npm-run.mjs    实际实现（零依赖，约 70 行）
```

它做的事：读 `package.json` 的 `scripts`，用系统 shell 执行对应命令，
并把 `node_modules/.bin` 放进 PATH。

**使用方式完全一样**（在 `website/` 目录下）：

```bash
npm run dev            # npm.cmd 会优先找真实 npm，找不到就用兼容层
```

或者直接绕过它：

```bash
node tools/npm-run.mjs dev
```

**如果用 pnpm**：

```bash
pnpm run dev
```

**兼容层的局限**：只支持 `npm run <script>`。
`npm install` 请用标准 npm 或 `pnpm install`（本机用 pnpm 安装依赖已验证可用）。

---

## 六、首次运行的完整流程（从零开始）

```bash
# 1) 进入网站目录
cd website

# 2) 安装依赖（首次必须）
pnpm install          # 或 npm install

# 3) 启动
npm run dev

# 4) 浏览器打开
#    http://localhost:3000
```

### 如果依赖已经装好，只想重新生成数据

```bash
# 在项目根目录
node tools/build-product-db-v2.mjs
node tools/verify-product-db-v2.mjs

# 网站会自动读取新生成的数据（开发服务器热更新）
```

---

## 七、依赖说明

### 运行依赖（3 个，全部是框架本身）

| 包 | 版本 | 用途 |
|---|---|---|
| next | 15.1.6 | 框架（App Router） |
| react | 19.0.0 | UI 库 |
| react-dom | 19.0.0 | DOM 渲染 |

**没有引入任何第三方 UI 库 / 图表库 / 状态管理库。**
所有样式是手写 CSS Modules，所有状态是 React 内置能力。

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

### Q1：`npm run dev` 提示找不到 npm

见第五节。用 `node tools/npm-run.mjs dev`，或 `pnpm run dev`。

### Q2：端口 3000 被占用

改 `website/package.json` 里脚本的端口号：

```json
"dev": "next dev -p 3001"
```

或临时指定：

```bash
node node_modules/next/dist/bin/next dev -p 3001
```

### Q3：手机打不开局域网地址

1. 确认用了 `npm run dev:host`（监听 0.0.0.0），不是 `npm run dev`
2. 确认手机和电脑在同一个 Wi-Fi
3. 检查 Windows 防火墙是否放行 Node.js
4. 用 `ipconfig` 确认 IP 地址正确（不要用 127.0.0.1）

### Q4：页面数据是空的 / 产品列表没内容

网站数据来自 `website/src/data/*.json`。重新生成：

```bash
node tools/build-product-db-v2.mjs
```

### Q5：构建报错 `spawn EPERM`

说明运行环境限制了 Node 启动子进程。Next.js 的构建与开发服务器
都需要启动 worker 进程，这是环境限制而非项目缺陷。
在正常的开发机或 CI 上不受影响。

### Q6：想确认原始 Excel 没被改过

```bash
node tools/verify-product-db-v2.mjs
```

看 TEST 1 那一组是否 PASS（会打印实际 SHA-256）。
冻结值在 `data/raw/SOURCE-MANIFEST.json`。

### Q7：提交 RFQ 后没有收到邮件

这是**预期行为**。原型阶段不发邮件（需求明确允许）。
提交后会展示将传输的完整 JSON payload，用来验证数据链路。

---

## 九、目录速查

```
B2B外贸独立站/
├── README.md                        总览
├── delivery/                        本阶段交付包（报告 / 截图 / 说明书）
├── docs/                            项目文档
├── website/                         ★ 网站源码（Next.js + TypeScript）
│   ├── package.json                 一条命令启动的入口
│   ├── npm.cmd                      npm 兼容层（本机没装 npm 时用）
│   ├── src/app/                     页面
│   ├── src/components/              组件
│   ├── src/lib/db.ts                ★ 唯一数据入口（未来换数据库只改这里）
│   └── src/data/                    网站使用的数据（由构建脚本生成）
├── tools/                           数据处理脚本（零依赖）
│   ├── build-product-db-v2.mjs      数据库重建
│   ├── verify-product-db-v2.mjs     65 项验收测试
│   └── config/product-types.mjs     产品类型词典 + 全部人工裁决点
├── data/
│   ├── raw/                         ⚠️ 原始资料，只读，永不修改
│   └── derived/v2/                  重建后的数据库（可重新生成）
└── review/                          人工参考清单（Excel）
```
