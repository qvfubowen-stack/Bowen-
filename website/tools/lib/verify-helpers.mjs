/**
 * website/tools/lib/verify-helpers.mjs
 * ===========================================================================
 * Phase 5 验收脚本共用的零依赖工具：
 *   - createChecker()   统一 PASS/FAIL 输出与退出码
 *   - ensureServer()    按需启动一个 Next 服务器（dev 或 start），用完即关
 *   - fetchText/json/headers 等小工具
 *   - readSiteData()    直接读取网站公开数据文件（用于独立复算公开产品集合）
 *
 * 设计约定：
 *   - 所有新增验收脚本都支持 BASE_URL=http://127.0.0.1:xxxx 复用已有服务器；
 *     未提供时才自己启动，方便「先构建再统一验收」。
 *   - 自己启动时统一使用 dev 模式（无需先 build，路由按需编译），
 *     并严格串行：同一时刻只有一个 Next 进程写 .next，避免构建产物被并发破坏。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEBSITE_ROOT = path.resolve(HERE, '..', '..');
export const REPO_ROOT = path.resolve(WEBSITE_ROOT, '..');
export const DATA_DIR = path.join(WEBSITE_ROOT, 'src', 'data');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 断言
// ---------------------------------------------------------------------------
export function createChecker(title) {
  let pass = 0;
  let fail = 0;
  const failures = [];

  if (title) {
    console.log(`\n${'='.repeat(74)}`);
    console.log(title);
    console.log('='.repeat(74));
  }

  function section(text) {
    console.log(`\n${'─'.repeat(74)}\n${text}\n${'─'.repeat(74)}`);
  }

  function check(name, fn) {
    let ok = false;
    let detail = '';
    try {
      const r = typeof fn === 'function' ? fn() : fn;
      if (r === true) ok = true;
      else if (r === false || r === undefined || r === null) ok = false;
      else if (typeof r === 'string') { ok = false; detail = r; }
      else if (typeof r === 'object') { ok = !!r.ok; detail = r.detail ?? ''; }
    } catch (e) {
      detail = `异常: ${e.message}`;
    }
    if (ok) { pass += 1; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
    else { fail += 1; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
    return ok;
  }

  /** 异步断言（需要发请求时用） */
  async function checkAsync(name, fn) {
    let r;
    try {
      r = await fn();
    } catch (e) {
      r = `异常: ${e.message}`;
    }
    return check(name, () => r);
  }

  function summary() {
    console.log(`\n${'='.repeat(74)}`);
    console.log(`结果：PASS ${pass}  FAIL ${fail}`);
    if (fail) {
      console.log('\n失败项：');
      for (const f of failures) console.log('  - ' + f);
    }
    return fail === 0;
  }

  return { check, checkAsync, section, summary, get pass() { return pass; }, get fail() { return fail; } };
}

// ---------------------------------------------------------------------------
// 服务器
// ---------------------------------------------------------------------------
/**
 * 确保有一个可访问的 Next 服务器。
 *   - 若设置了 BASE_URL，直接复用（不会启动任何进程）。
 *   - 否则用 node_modules/next/dist/bin/next 启动 dev 或 start。
 * 返回 { base, stop(), external, output() }
 */
export async function ensureServer(options = {}) {
  const {
    port,
    env = {},
    mode = 'dev',
    readyPath = '/',
    timeoutMs = 180_000,
    label = 'verify',
  } = options;

  const external = (process.env.BASE_URL ?? '').trim();
  if (external) {
    const base = external.replace(/\/+$/, '');
    const ok = await waitForServer(`${base}${readyPath}`, 60_000);
    if (!ok) throw new Error(`BASE_URL ${base} 不可访问`);
    return { base, external: true, stop: async () => {}, output: () => '' };
  }

  if (!port) throw new Error('ensureServer 需要一个 port');

  const bin = path.join(WEBSITE_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  let output = '';
  const child = spawn(process.execPath, [bin, mode, '-p', String(port)], {
    cwd: WEBSITE_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });

  const base = `http://127.0.0.1:${port}`;
  const ok = await waitForServer(`${base}${readyPath}`, timeoutMs);
  if (!ok) {
    try { child.kill(); } catch { /* ignore */ }
    throw new Error(`[${label}] 服务器未在 ${timeoutMs}ms 内就绪。输出尾部:\n${output.slice(-2000)}`);
  }

  return {
    base,
    external: false,
    output: () => output,
    async stop() {
      if (child.killed) return;
      try { child.kill(); } catch { /* ignore */ }
      // 等端口真正释放，避免下一个 dev 进程与它抢 .next
      for (let i = 0; i < 40; i += 1) {
        try {
          await fetch(`${base}/`, { signal: AbortSignal.timeout(800) });
        } catch { return; }
        await sleep(250);
      }
    },
  };
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'manual' });
      if (res.status < 500) return true;
    } catch { /* 还没起来 */ }
    await sleep(600);
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTTP 小工具
// ---------------------------------------------------------------------------
export async function getHtml(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

export async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应 */ }
  return { status: res.status, headers: res.headers, text, json };
}

/** 从 HTML 里取 <link rel="canonical"> */
export function readCanonical(html) {
  const m = html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i);
  return m ? m[1] : null;
}

/** 从 HTML 里取 meta robots 内容 */
export function readMetaRobots(html) {
  const m = html.match(/<meta[^>]+name="robots"[^>]*content="([^"]*)"/i);
  return m ? m[1] : null;
}

/** 从 HTML 里取所有 JSON-LD 块 */
export function readJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

// ---------------------------------------------------------------------------
// 公开产品集合（独立复算，不依赖应用代码）
// ---------------------------------------------------------------------------
const PUBLISHABLE_STATUSES = new Set(['prototype_candidate', 'searchable_noindex']);

/**
 * 按 Phase 4.1 的公开准入规则复算公开产品集合：
 *   状态允许 + 未 blocked + 在 product-images.json 里有可靠主图。
 * 这是对仓储层 isPublic() 的**独立重算**，用来验证 sitemap 没有多也没有少。
 */
export function readPublicProductSet() {
  const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
  const images = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'product-images.json'), 'utf8'));
  const imageMap = images.images ?? {};
  const isPublic = (p) => !!p
    && !p.blocked
    && PUBLISHABLE_STATUSES.has(p.status)
    && Boolean(imageMap[p.product_id]);

  return {
    all: products,
    imageMap,
    publicProducts: products.filter(isPublic),
    /** 有记录但不在公开集合里（无图 / 状态不允许 / blocked），用于 404 与 sitemap 断言 */
    nonPublicProducts: products.filter((p) => !isPublic(p)),
    isPublic,
  };
}

export function readApplications() {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'applications.json'), 'utf8'));
}

/** 提取一条可用的 (product, application) 组合，供 RFQ 测试使用 */
export function pickRfqFixture({ preferBowen = 'BW-3005' } = {}) {
  const { publicProducts, imageMap } = readPublicProductSet();
  const applications = readApplications();
  // bowen_no 存的是 "3005" 这类裸号，product_id 才是 "BW-3005"，两个都比一次
  const ordered = [
    ...publicProducts.filter((p) => p.product_id === preferBowen || p.bowen_no === preferBowen),
    ...publicProducts,
  ];
  for (const product of ordered) {
    const app = applications.find((a) => a.product_id === product.product_id && !a.blocked && !a.needs_review);
    if (!app) continue;
    return {
      product_id: product.product_id,
      bowen_no: product.bowen_no,
      product_type: product.product_type,
      image: imageMap[product.product_id],
      application_id: app.application_id,
      application_oe_tokens: app.oe_tokens ?? [],
      application_vehicle_raw: app.vehicle_application_raw,
    };
  }
  throw new Error('找不到可用的公开产品 + application 组合');
}

/**
 * 内部完整产品数据集（426 条，含未公开记录）。
 * 只用于"非公开产品必须被拒绝"这类**拒绝路径**测试：
 *   website/src/data/products.json 已经是过滤后的公开集合（394 条），
 *   里面找不到无图 / draft 产品，所以必须回到内部数据集取样。
 */
export function readInternalProducts() {
  const f = path.join(REPO_ROOT, 'data', 'derived', 'v2', 'products.json');
  if (!fs.existsSync(f)) return [];
  const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(parsed) ? parsed : (parsed.products ?? []);
}

/** 取"在产品总表里、但不在公开集合里"的记录，用于拒绝路径测试 */
export function pickNonPublicProducts() {
  const { imageMap, isPublic } = readPublicProductSet();
  const outside = readInternalProducts().filter((p) => !isPublic(p));
  return {
    /** 状态允许但**没有可靠主图**的产品 */
    noImage: outside.find((p) => !p.blocked && !imageMap[p.product_id]) ?? null,
    /** 状态本身就不允许公开（draft）的产品 */
    draft: outside.find((p) => p.status === 'draft') ?? null,
    /** 被 blocked 的产品 */
    blocked: outside.find((p) => p.blocked) ?? null,
    all: outside,
  };
}

/**
 * 一条可用于"不可提交"测试的产品。
 * 优先用真实的无图产品；内部数据集不可用时退回一个目录里不存在的 ID
 * （仓储层同样会返回 null，走的还是同一条拒绝路径）。
 */
export function pickNonPublicProduct() {
  const { noImage, draft, blocked } = pickNonPublicProducts();
  const found = noImage ?? draft ?? blocked;
  if (found) return found;
  return { product_id: 'BW-NOT-IN-CATALOGUE', bowen_no: null, product_type: null, __synthetic: true };
}

/** 随机 32 字节十六进制（仅用于测试用 RFQ_IP_HASH_SECRET，不是真实密钥） */
export function randomTestSecret() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 读取 JSONL 文件 → 对象数组（文件不存在返回空数组） */
export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* 跳过损坏行 */ }
  }
  return out;
}

export function makeTempDir(prefix) {
  const dir = path.join(REPO_ROOT, 'tmp', `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
