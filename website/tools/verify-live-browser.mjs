#!/usr/bin/env node
/**
 * Phase 5 — 真实浏览器上线前实测（必须真跑一遍，不能只看脚本自报成功）
 * ===========================================================================
 * 用 Chrome DevTools Protocol 逐个打开页面，检查：
 *   - HTTP 状态（公开页 200、不存在/无图产品 404）
 *   - 控制台错误与未捕获异常（hydration 错误会在这里暴露）
 *   - 移动端（390px）与桌面端（1440px）横向溢出
 *   - 页面可见文本里不含内部工作表名 / 内部字段 / 原型标记
 *   - 产品信息区域保持英文（不含中文）
 *   - 默认仍是 noindex；canonical 不含本地地址
 *   - RFQ 表单可交互：隐私同意默认未勾选、honeypot 存在、明细已带入
 *
 * 用法：
 *   node tools/verify-live-browser.mjs                                   # 自己起 dev 服务器
 *   BASE_URL=http://127.0.0.1:3100 node tools/verify-live-browser.mjs    # 对生产服务器实测（推荐）
 */
import {
  createChecker,
  ensureServer,
  pickNonPublicProduct,
  pickRfqFixture,
  readPublicProductSet,
  sleep,
} from './lib/verify-helpers.mjs';

const { check, checkAsync, section, summary } = createChecker(
  '博文外贸独立站 — 真实浏览器实测（Phase 5）',
);

const EXTERNAL_BASE = (process.env.BASE_URL ?? '').trim();
const PORT = Number(process.env.LIVE_PORT ?? 3540);
const CHROME = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9600 + Math.floor(Math.random() * 300);

const PUBLIC = readPublicProductSet();
const FIXTURE = pickRfqFixture();
const NON_PUBLIC = pickNonPublicProduct();
/** 一个非 Thermostat 的公开产品（用于验证"另一类产品页"） */
const NON_THERMOSTAT = PUBLIC.publicProducts.find((p) => p.product_type && p.product_type !== 'Thermostat');

const ROUTES = [
  { path: '/', status: 200, label: '首页' },
  { path: '/products', status: 200, label: '产品列表' },
  { path: `/products/${FIXTURE.product_id}`, status: 200, label: `产品页 ${FIXTURE.product_id}（Thermostat）` },
  ...(NON_THERMOSTAT
    ? [{ path: `/products/${NON_THERMOSTAT.product_id}`, status: 200, label: `产品页 ${NON_THERMOSTAT.product_id}（${NON_THERMOSTAT.product_type}）`, productArea: true }]
    : []),
  { path: '/oe-search?q=25500-35540', status: 200, label: 'OE 搜索 25500-35540' },
  { path: `/rfq?product=${FIXTURE.product_id}`, status: 200, label: 'RFQ（带产品）', rfq: true },
  { path: '/factory', status: 200, label: 'Factory' },
  { path: '/quality', status: 200, label: 'Quality' },
  { path: '/about', status: 200, label: 'About Bowen' },
  { path: '/contact', status: 200, label: 'Contact' },
  { path: '/privacy', status: 200, label: 'Privacy Policy' },
  { path: '/terms', status: 200, label: 'Terms of Use' },
  { path: '/products/BW-DOES-NOT-EXIST-0000', status: 404, label: '不存在的产品 URL' },
  { path: `/products/${NON_PUBLIC.product_id}`, status: 404, label: `被排除的无图产品 ${NON_PUBLIC.product_id}` },
];

const INTERNAL_MARKERS = [
  '工作表1', '工作表2', '综合产品信息表', '三菱系列', '大众系列', '比亚迪系列', '长城哈弗系列',
  'source_sheets', 'source_row', 'product_type_evidence', 'classification evidence',
  'How this classification was made', 'Prototype candidate', 'review_required', 'unresolved',
  'internal_only_certifications', 'address_evidence', 'brochure_page',
];
const HAN_RE = /[\u3400-\u9fff]/u;

// ---------------------------------------------------------------- CDP 基础设施
let chrome = null;
let ws = null;

async function chromeWsUrl() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('无法连接 Chrome 调试端口');
}

let msgId = 0;
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch { return; }
      if (d.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (d.error) reject(new Error(`${method}: ${d.error.message}`));
      else resolve(d.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await rpc('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate failed');
  return result.value;
}

/** 当前页面的控制台错误收集器 */
let consoleSink = [];
function attachConsoleCollector() {
  ws.addEventListener('message', (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch { return; }
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params?.type)) {
      const text = (d.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
      consoleSink.push(`${d.params.type}: ${text}`.slice(0, 240));
    }
    if (d.method === 'Runtime.exceptionThrown') {
      const t = d.params?.exceptionDetails;
      consoleSink.push(`exception: ${(t?.exception?.description ?? t?.text ?? '').slice(0, 240)}`);
    }
    if (d.method === 'Log.entryAdded' && d.params?.entry?.level === 'error') {
      consoleSink.push(`log: ${String(d.params.entry.text).slice(0, 240)}`);
    }
  });
}

async function setViewport(width, height, mobile) {
  await rpc('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
  });
}

const PROBE = `
(() => {
  const q = (s) => document.querySelector(s);
  const txt = (el) => (el ? (el.innerText || el.textContent || '') : '');
  const robotsMeta = q('meta[name="robots"]');
  const canonical = q('link[rel="canonical"]');
  const forms = Array.from(document.querySelectorAll('form'));

  // 产品信息区域：H1 + 规格 dl + 明细表（不含页头页脚）
  const productArea = [
    txt(q('main h1')),
    txt(q('main dl')),
    txt(q('main table')),
    txt(q('main h2')),
  ].join(' ');

  const rfqForm = q('[data-testid="rfq-form"]');
  const consent = rfqForm ? rfqForm.querySelector('input[name="consent"]') : null;
  const honeypot = rfqForm ? rfqForm.querySelector('input[name="fax"]') : null;
  const honeypotStyle = honeypot ? getComputedStyle(honeypot.closest('div') || honeypot) : null;

  return {
    title: document.title,
    lang: document.documentElement.lang,
    robots: robotsMeta ? robotsMeta.getAttribute('content') : null,
    canonical: canonical ? canonical.getAttribute('href') : null,
    h1: txt(q('main h1') || q('h1')).trim().slice(0, 120),
    bodyText: (document.body.innerText || '').slice(0, 80000),
    productArea: productArea.slice(0, 40000),
    formCount: forms.length,
    fileInputCount: document.querySelectorAll('input[type="file"]').length,
    h2Headings: Array.from(document.querySelectorAll('main h2')).map((h) => (h.textContent || '').trim()).slice(0, 20),
    rfq: rfqForm ? {
      present: true,
      consentChecked: consent ? consent.checked : null,
      honeypotPresent: !!honeypot,
      honeypotHidden: honeypotStyle ? (honeypotStyle.position === 'absolute' || honeypotStyle.display === 'none') : false,
      lines: (() => {
        const m = (document.body.innerText || '').match(/(\\d+)\\s+line/);
        return m ? Number(m[1]) : 0;
      })(),
      submitDisabled: (() => { const b = q('[data-testid="rfq-submit"]'); return b ? b.disabled : null; })(),
      privacyLink: !!Array.from(rfqForm.querySelectorAll('a')).find((a) => a.getAttribute('href') === '/privacy'),
    } : { present: false },
    viewport: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    },
    hasNextErrorOverlay: !!document.querySelector('nextjs-portal'),
  };
})()
`;

async function visit(route) {
  consoleSink = [];
  await rpc('Page.navigate', { url: `${BASE}${route.path}` });
  await sleep(2600);

  // 移动端检查
  await setViewport(390, 900, true);
  await sleep(700);
  const mobile = await evaluate(PROBE);

  // 桌面端检查
  await setViewport(1440, 1000, false);
  await sleep(700);
  const desktop = await evaluate(PROBE);

  const status = await evaluate('performance.getEntriesByType("navigation")[0]?.responseStatus ?? null');

  return { mobile, desktop, status, console: [...consoleSink] };
}

// ---------------------------------------------------------------- 主流程
let server = null;

try {
  if (EXTERNAL_BASE) {
    server = { base: EXTERNAL_BASE.replace(/\/+$/, ''), external: true, stop: async () => {} };
  } else {
    server = await ensureServer({
      port: PORT,
      env: {
        NEXT_PUBLIC_SITE_URL: '',
        SITE_INDEXING_ENABLED: 'false',
        RFQ_STORE_DRIVER: 'json',
        RFQ_JSON_STORE_PATH: 'tmp-live-rfq.jsonl',
        RFQ_MAIL_DRIVER: 'mock',
        RFQ_MOCK_OUTBOX_PATH: 'tmp-live-outbox.jsonl',
        RFQ_MIN_FILL_MS: '200',
      },
      label: 'live-browser',
    });
  }
} catch (err) {
  console.error(`\n无法启动/连接服务器: ${err.message}`);
  process.exit(2);
}
const BASE = server.base;
console.log(`\n实测目标：${BASE}${server.external ? '（BASE_URL）' : '（脚本自起服务器）'}`);

const { spawn } = await import('node:child_process');
const fs = await import('node:fs');
const os = await import('node:os');
const path = await import('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bowen-live-'));
chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

try {
  ws = new WebSocket(await chromeWsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Log.enable');
  attachConsoleCollector();

  section('A. 逐个路由实测（状态码 / 控制台 / 溢出 / 内容边界）');
  for (const route of ROUTES) {
    const r = await visit(route);

    await checkAsync(`${route.label} ${route.path} → HTTP ${route.status}`, () => {
      // responseStatus 在部分 Chrome 版本为 0/undefined，退化为用标题与内容判断
      if (r.status && r.status !== route.status) return `实际 status=${r.status}`;
      const is404 = /not found|404/i.test(r.mobile.title ?? '');
      if (route.status === 404 && !is404 && !r.status) return `期望 404，标题="${r.mobile.title}"`;
      if (route.status === 200 && is404) return `期望 200，标题="${r.mobile.title}"`;
      return { ok: true, detail: r.status ? `status=${r.status}` : `标题="${String(r.mobile.title).slice(0, 60)}"` };
    });

    check(`${route.label} 控制台无 error / 未捕获异常`, () => {
      const bad = r.console.filter((c) => {
        if (/favicon|Download the React DevTools/i.test(c)) return false;
        // 期望 404 的页面，浏览器必然记录一条"资源 404"，这不是脚本错误
        if (route.status === 404 && /status of 404/i.test(c)) return false;
        return true;
      });
      // hydration 错误无论什么情况都算失败
      const hydration = r.console.filter((c) => /hydrat/i.test(c));
      if (hydration.length) return `hydration 相关报错: ${hydration.slice(0, 2).join(' | ')}`;
      return bad.length === 0 ? { ok: true, detail: `${r.console.length} 条消息，无 error` } : bad.slice(0, 3).join(' | ');
    });

    check(`${route.label} 移动端 390px 无横向溢出`, () => {
      const o = r.mobile.viewport;
      return o.overflow <= 1
        ? { ok: true, detail: `scrollWidth=${o.scrollWidth} clientWidth=${o.clientWidth}` }
        : `溢出 ${o.overflow}px（scrollWidth=${o.scrollWidth}）`;
    });

    check(`${route.label} 桌面端 1440px 无横向溢出`, () => {
      const o = r.desktop.viewport;
      return o.overflow <= 1
        ? { ok: true, detail: `scrollWidth=${o.scrollWidth}` }
        : `溢出 ${o.overflow}px`;
    });

    check(`${route.label} 页面没有内部工作表名 / 内部字段`, () => {
      const bad = INTERNAL_MARKERS.filter((m) => r.mobile.bodyText.includes(m));
      return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
    });

    check(`${route.label} 默认仍是 noindex`, () => {
      const robots = r.mobile.robots ?? '';
      return /noindex/i.test(robots) ? { ok: true, detail: `meta robots="${robots}"` } : `meta robots="${robots}"`;
    });

    check(`${route.label} canonical 不含本地地址`, () => {
      const c = r.mobile.canonical;
      return !c || !/localhost|127\.0\.0\.1/.test(c) ? { ok: true, detail: c ?? '(未输出，符合预览配置)' } : `canonical=${c}`;
    });

    if (route.productArea !== false) {
      check(`${route.label} 产品信息区域保持英文（无中文）`, () => {
        const area = r.mobile.productArea;
        return !HAN_RE.test(area)
          ? { ok: true, detail: `区域文本 ${area.length} 字符，0 个中文字符` }
          : `出现中文: ${(area.match(/[\u3400-\u9fff]+/gu) ?? []).slice(0, 5).join(' / ')}`;
      });
    }

    if (route.rfq) {
      check(`${route.label} RFQ 表单可交互且隐私同意默认未勾选`, () => {
        const f = r.mobile.rfq;
        if (!f.present) return '没有渲染出 RFQ 表单';
        if (f.consentChecked !== false) return `consent 默认状态 = ${f.consentChecked}`;
        if (!f.privacyLink) return '表单里没有 /privacy 链接';
        return { ok: true, detail: `consent 未勾选、隐私链接存在、明细 ${f.lines} 行` };
      });
      check(`${route.label} honeypot 字段存在且对客户不可见`, () => {
        const f = r.mobile.rfq;
        return f.honeypotPresent && f.honeypotHidden
          ? { ok: true, detail: '字段存在且定位在视口外' }
          : `present=${f.honeypotPresent} hidden=${f.honeypotHidden}`;
      });
      check(`${route.label} 表单已带入 1 条 RFQ 明细`, () => {
        const f = r.mobile.rfq;
        return f.lines >= 1 ? { ok: true, detail: `${f.lines} 行` } : `实际 ${f.lines} 行`;
      });
      check(`${route.label} 提交按钮处于可用状态（未提交时不禁用）`, () => {
        const f = r.mobile.rfq;
        return f.submitDisabled === false ? { ok: true, detail: 'enabled' } : `disabled=${f.submitDisabled}`;
      });

      // ---- Phase 5.1：附件流程已删除、无时效承诺 ----
      check(`${route.label} 表单里没有任何文件选择框（附件流程已删除）`, () =>
        r.mobile.fileInputCount === 0
          ? { ok: true, detail: '0 个 input[type=file]' }
          : `有 ${r.mobile.fileInputCount} 个文件选择框`);

      check(`${route.label} 页面没有 confirmation email / 附件回复文案`, () => {
        const bad = ['confirmation email', 'attach it to your reply', 'reply to our confirmation', 'upload files']
          .filter((s) => r.mobile.bodyText.toLowerCase().includes(s.toLowerCase()));
        return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
      });

      check(`${route.label} 页面没有未确认的回复时效承诺`, () => {
        const bad = [/business day/i, /within \d+ (?:hours|days)/i, /usually within/i]
          .filter((re) => re.test(r.mobile.bodyText));
        return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.map(String).join(', ')}`;
      });

      check(`${route.label} 提供了"长清单请粘贴 OE 号或直接发邮件"的替代路径`, () => {
        const t = r.mobile.bodyText;
        return /For long sourcing lists/.test(t) && /qfbowen@126\.com/.test(t)
          ? { ok: true, detail: '替代路径已展示（含公司邮箱）' }
          : '没有找到长清单替代路径';
      });
    }

    if (route.status === 200 && route.path === '/privacy') {
      check('Privacy Policy 页面包含公司主体、数据用途、权利与联系方式', () => {
        const t = r.mobile.bodyText;
        const need = ['Qufu Bowen Auto Parts Manufacturing Co., Ltd.', 'What we collect', 'Your choices and rights', 'qfbowen@126.com'];
        const missing = need.filter((n) => !t.includes(n));
        return missing.length === 0 ? { ok: true, detail: `${need.length} 个必备小节都在` } : `缺少 ${missing.join(', ')}`;
      });
      check('Privacy 不再描述附件回复流程、不承诺固定 30 天', () => {
        const t = r.mobile.bodyText;
        const problems = [];
        if (/confirmation email/i.test(t)) problems.push('仍有 confirmation email');
        if (/within 30 days/i.test(t)) problems.push('仍承诺 30 天');
        if (!/reasonable period/i.test(t)) problems.push('缺少替换后的措辞');
        return problems.length === 0 ? { ok: true, detail: '已按 Phase 5.1 更新' } : problems.join('; ');
      });
    }

    if (route.status === 200 && route.path === '/terms') {
      check('Terms of Use 包含适配确认、无自动报价与责任限制', () => {
        const t = r.mobile.bodyText;
        const need = ['confirm fitment', 'No automatic quotation', 'Limitation of liability'];
        const missing = need.filter((n) => !t.includes(n));
        return missing.length === 0 ? { ok: true, detail: `${need.length} 个必备小节都在` } : `缺少 ${missing.join(', ')}`;
      });
      check('Terms 不再公开未完成的管辖法律章节', () => {
        const t = r.mobile.bodyText;
        const problems = [];
        if (/Governing law/i.test(t)) problems.push('仍有 Governing law 章节');
        if (/have not been finalised/i.test(t)) problems.push('仍有"尚未确定"字样');
        if (/jurisdiction/i.test(t)) problems.push('仍出现 jurisdiction');
        return problems.length === 0 ? { ok: true, detail: '章节已整段删除' } : problems.join('; ');
      });
      check('Terms 章节编号在删除后连续（11 变化 / 12 联系）', () => {
        const headings = r.mobile.h2Headings.filter((h) => /^\d+\./.test(h));
        const numbers = headings.map((h) => Number(h.match(/^(\d+)\./)?.[1]));
        const expected = numbers.map((_, i) => i + 1);
        const ok = numbers.length >= 10 && numbers.every((n, i) => n === expected[i]);
        return ok ? { ok: true, detail: `1…${numbers.length} 连续` } : `实际 ${numbers.join(',')}`;
      });
    }

    console.log(`    · ${route.path} 标题="${String(r.mobile.title).slice(0, 70)}"`);
  }

  section('B. 非浏览器端点（robots / sitemap / API）');
  await checkAsync('robots.txt 预览环境全站 Disallow', async () => {
    const text = await (await fetch(`${BASE}/robots.txt`)).text();
    return /Disallow:\s*\/\s*$/m.test(text) ? { ok: true, detail: text.replace(/\s+/g, ' ').trim() } : text.slice(0, 120);
  });
  await checkAsync('sitemap.xml 预览环境为空且不含 localhost', async () => {
    const text = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const urls = (text.match(/<url>/g) ?? []).length;
    return urls === 0 && !/localhost|127\.0\.0\.1/.test(text)
      ? { ok: true, detail: '空 urlset' }
      : `urls=${urls} localhost=${/localhost|127\.0\.0\.1/.test(text)}`;
  });
  await checkAsync('GET /api/rfq 返回 405', async () => {
    const res = await fetch(`${BASE}/api/rfq`);
    return res.status === 405 ? { ok: true, detail: `allow=${res.headers.get('allow')}` } : `status=${res.status}`;
  });
  await checkAsync('manifest.webmanifest 可访问', async () => {
    const res = await fetch(`${BASE}/manifest.webmanifest`);
    const json = await res.json().catch(() => null);
    return res.status === 200 && json?.name ? { ok: true, detail: json.name } : `status=${res.status}`;
  });
  await checkAsync('站点图标与分享图可访问', async () => {
    const paths = ['/icon.png', '/apple-icon.png', '/og-image.png'];
    const results = [];
    for (const p of paths) {
      const res = await fetch(`${BASE}${p}`);
      results.push(`${p}=${res.status}`);
    }
    const bad = results.filter((r) => !r.endsWith('=200'));
    return bad.length === 0 ? { ok: true, detail: results.join(', ') } : bad.join(', ');
  });
  await checkAsync('公开证书规则没有回退：Quality 页只出现 IATF，不出现 ISO 14001/45001', async () => {
    const html = await (await fetch(`${BASE}/quality`)).text();
    const hasIatf = /IATF 16949/.test(html);
    const iso = /ISO\s*14001|ISO\s*45001/.test(html);
    return hasIatf && !iso ? { ok: true, detail: 'IATF 在、ISO 两项不在' } : `IATF=${hasIatf} ISO=${iso}`;
  });
} catch (err) {
  console.error(`\n执行出错: ${err.message}`);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill(); } catch { /* ignore */ }
  if (server) await server.stop();
}

process.exitCode = summary() ? (process.exitCode ?? 0) : 1;
