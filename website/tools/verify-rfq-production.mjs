#!/usr/bin/env node
/**
 * Phase 5 — RFQ 生产化验收（mock 邮件 + mock/json 存储 adapter，真实 HTTP）
 * ===========================================================================
 * 为什么走 HTTP 而不是直接调用模块：
 *   生产路径是「浏览器 → POST /api/rfq → 校验 → 落库 → 发信」，
 *   只有真的发请求、真的读回落库文件与 mock outbox，才算验证了这条链路。
 *
 * 三个场景（每个场景一个独立服务器进程，因为驱动是进程启动时读入的环境变量）：
 *   1) main     RFQ_STORE_DRIVER=json + RFQ_MAIL_DRIVER=mock（含限流）
 *   2) mailfail RFQ_MOCK_MAIL_FAIL=true  → 邮件失败但询价必须已保存
 *   3) storefail RFQ_JSON_STORE_PATH 指向不可写路径 → 必须返回失败，绝不假装成功
 *
 * 用法：
 *   node tools/verify-rfq-production.mjs
 *   BASE_URL=http://127.0.0.1:3100 node tools/verify-rfq-production.mjs   # 只跑 main 场景
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import {
  WEBSITE_ROOT,
  createChecker,
  ensureServer,
  makeTempDir,
  pickNonPublicProduct,
  pickNonPublicProducts,
  pickRfqFixture,
  postJson,
  randomTestSecret,
  readApplications,
  readJsonl,
} from './lib/verify-helpers.mjs';

const { check, checkAsync, section, summary } = createChecker(
  '博文外贸独立站 — RFQ 生产化验收（Phase 5）',
);

/**
 * 直接从源码里读出隐私同意版本号。
 * 刻意**不** import 那个 .ts 文件：本套工具链要求零依赖且能在任意 Node 版本下运行，
 * 而 Node 的 TS 类型擦除只在较新版本默认开启。
 * 用正则读取同时也是一次独立核对（测试值与实现值必须字面一致）。
 */
function readConsentVersion() {
  const text = fs.readFileSync(path.join(WEBSITE_ROOT, 'src', 'lib', 'rfq', 'constants.ts'), 'utf8');
  const m = text.match(/PRIVACY_CONSENT_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('无法从 constants.ts 读取 PRIVACY_CONSENT_VERSION');
  return m[1];
}
const PRIVACY_CONSENT_VERSION = readConsentVersion();

const EXTERNAL_BASE = (process.env.BASE_URL ?? '').trim();
const PORT_MAIN = Number(process.env.RFQ_PORT ?? 3530);
const PORT_MAILFAIL = PORT_MAIN + 1;
const PORT_STOREFAIL = PORT_MAIN + 2;

const FIXTURE = pickRfqFixture();
const NON_PUBLIC = pickNonPublicProduct();
const NON_PUBLIC_SET = pickNonPublicProducts();
const APPLICATIONS = readApplications();

console.log(`公开产品：${FIXTURE.product_id}；拒绝路径样本：无图 ${NON_PUBLIC_SET.noImage?.product_id ?? '-'}`
  + ` / draft ${NON_PUBLIC_SET.draft?.product_id ?? '-'} / blocked ${NON_PUBLIC_SET.blocked?.product_id ?? '-'}`);

const TMP = makeTempDir('rfq-verify');
const STORE_MAIN = path.join(TMP, 'main', 'rfq-inquiries.jsonl');
const OUTBOX_MAIN = path.join(TMP, 'main', 'outbox.jsonl');
const STORE_MAILFAIL = path.join(TMP, 'mailfail', 'rfq-inquiries.jsonl');
const OUTBOX_MAILFAIL = path.join(TMP, 'mailfail', 'outbox.jsonl');

/** 一个不可写路径：把"目录"位置放一个普通文件，mkdir 必然失败（ENOTDIR） */
const UNWRITABLE_BLOCKER = path.join(TMP, 'storefail', 'blocker');
fs.mkdirSync(path.dirname(UNWRITABLE_BLOCKER), { recursive: true });
fs.writeFileSync(UNWRITABLE_BLOCKER, 'this is a file, not a directory\n', 'utf8');
const STORE_STOREFAIL = path.join(UNWRITABLE_BLOCKER, 'rfq-inquiries.jsonl');

const IP_SECRET = randomTestSecret();

/** 每个用例用独立的 x-forwarded-for，避免互相影响限流桶 */
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}.${Math.floor(ipCounter / 250) + 1}`;
}

function trustedHeaders(ip = nextIp()) {
  return { 'x-forwarded-for': ip };
}

const OWNER = Math.floor(Math.random() * 1e6);

/** 造一个合法提交体 */
function validBody(overrides = {}) {
  return {
    name: `Verify Buyer ${OWNER}`,
    company: `Verify Import ${OWNER} GmbH`,
    country: 'Germany',
    email: `verify.buyer.${OWNER}@example.com`,
    whatsapp_phone: '+49 151 2345678',
    website: 'https://verify-buyer.example.com',
    message: 'Sourcing list:\n2550035540 x 300\n4711306950 x 500',
    items: [
      {
        product_id: FIXTURE.product_id,
        bowen_no: FIXTURE.bowen_no,
        product_type: FIXTURE.product_type,
        application_id: FIXTURE.application_id,
        matched_oe: null,
        vehicle: null,
        quantity: '500 pcs',
        remark: 'verify run',
      },
    ],
    consent: true,
    privacy_consent_version: PRIVACY_CONSENT_VERSION,
    source_page: '/rfq?product=' + FIXTURE.product_id,
    elapsed_ms: 5000,
    fax: '',
    ...overrides,
  };
}

const HAN = /[\u3400-\u9fff\u3040-\u30ff]/u;
const INTERNAL_LEAKS = ['source_sheets', 'source_row', 'product_type_evidence', 'review_required', 'unresolved', '工作表', '综合产品信息表', 'internal_only_certifications'];

const serverEnvBase = {
  RFQ_STORE_DRIVER: 'json',
  RFQ_MAIL_DRIVER: 'mock',
  RFQ_RECIPIENT_EMAIL: 'qfbowen@126.com',
  RFQ_FROM_EMAIL: 'rfq@verify.invalid',
  RFQ_IP_HASH_SECRET: IP_SECRET,
  RFQ_TRUST_PROXY: 'true',
  RFQ_RATE_LIMIT_MAX: '8',
  RFQ_RATE_LIMIT_WINDOW_SECONDS: '600',
  RFQ_MIN_FILL_MS: '200',
  RFQ_DUPLICATE_WINDOW_SECONDS: '900',
  NEXT_PUBLIC_SITE_URL: '',
  SITE_INDEXING_ENABLED: 'false',
};

// ===========================================================================
section('A. 源码层：端点契约与安全边界');
// ===========================================================================
const read = (p) => fs.readFileSync(p, 'utf8');
const ROOT = WEBSITE_ROOT;
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/**
 * 用 node:http 发一个可以显式带 Origin 的 POST。
 * 为什么不用 fetch：Fetch 规范把 Origin 列为禁止由脚本设置的请求头，
 * 用 fetch 很可能发不出去，导致"跨站被拒"这条测试变成假通过。
 */
function rawPostOrigin(urlString, bodyObject, origin) {
  const url = new URL(urlString);
  const payload = JSON.stringify(bodyObject);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Origin: origin,
          'x-forwarded-for': nextIp(),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* 非 JSON */ }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

check('POST /api/rfq 路由存在且只导出 POST 作为写入入口', () => {
  const f = path.join(ROOT, 'src', 'app', 'api', 'rfq', 'route.ts');
  if (!fs.existsSync(f)) return '缺少 src/app/api/rfq/route.ts';
  const t = read(f);
  const need = ['export async function POST', 'export function GET', 'methodNotAllowed', 'MAX_BODY_BYTES'];
  const missing = need.filter((n) => !t.includes(n));
  return missing.length === 0 ? { ok: true, detail: 'POST 写入，其它方法 405' } : `缺少 ${missing.join(', ')}`;
});

check('服务端有独立的校验模块，且对 product_id / application_id / Bowen No. 交叉核对', () => {
  const t = read(path.join(ROOT, 'src', 'lib', 'rfq', 'validate.ts'));
  const need = ['getProductById', 'getDisplayApplications', 'ALLOWED_BODY_KEYS', 'normalizeBowen'];
  const missing = need.filter((n) => !t.includes(n));
  return missing.length === 0
    ? { ok: true, detail: 'product_id / application_id / Bowen No. 全部服务端复核' }
    : `缺少 ${missing.join(', ')}`;
});

check('请求体白名单里没有内部字段', () => {
  const t = read(path.join(ROOT, 'src', 'lib', 'rfq', 'validate.ts'));
  const bad = INTERNAL_LEAKS.filter((k) => t.includes(`'${k}'`));
  return bad.length === 0 ? { ok: true, detail: '白名单干净' } : `白名单里出现 ${bad.join(', ')}`;
});

check('不保存明文 IP：记录类型与数据库行都没有 IP 字段', () => {
  const rateLimit = read(path.join(ROOT, 'src', 'lib', 'rfq', 'rate-limit.ts'));
  const hasHmac = rateLimit.includes('createHmac') && rateLimit.includes('buildRateLimitKey');

  // 1) 存储记录类型里不能有 ip 字段
  const typesText = read(path.join(ROOT, 'src', 'lib', 'rfq', 'types.ts'));
  const recordBlock = typesText.match(/export interface RfqInquiryRecord \{([\s\S]*?)\n\}/);
  const recordHasIp = recordBlock ? /^\s*ip\w*\s*[?:]/m.test(recordBlock[1]) : true;

  // 2) 写库时的行映射里也不能有 ip 字段
  const storeText = read(path.join(ROOT, 'src', 'lib', 'rfq', 'stores', 'supabase-store.ts'));
  const toRowBlock = storeText.match(/function toRow\([\s\S]*?\n\}/);
  const rowHasIp = toRowBlock ? /^\s*ip\w*\s*:/m.test(toRowBlock[0]) : true;

  return hasHmac && !recordHasIp && !rowHasIp
    ? { ok: true, detail: '限流键是 HMAC 截断值；记录与数据库行都没有 ip 列' }
    : `hmac=${hasHmac} recordHasIp=${recordHasIp} rowHasIp=${rowHasIp}`;
});

check('service role key / Resend key 不加 NEXT_PUBLIC_ 前缀', () => {
  const files = [
    'src/lib/rfq/mail.ts', 'src/lib/rfq/mail/resend-mailer.ts',
    'src/lib/rfq/store.ts', 'src/lib/rfq/stores/supabase-store.ts',
  ].map((p) => path.join(ROOT, p));
  const bad = files.filter((f) => /NEXT_PUBLIC_(RESEND|SUPABASE)/.test(read(f)));
  return bad.length === 0 ? { ok: true, detail: '两个密钥都只在服务端读取' } : bad.map(rel).join(', ');
});

check('migration 启用了 RLS 且没有为匿名用户创建任何策略', () => {
  const f = path.resolve(ROOT, '..', 'supabase', 'migrations', '001_create_rfq_inquiries.sql');
  if (!fs.existsSync(f)) return '缺少 supabase/migrations/001_create_rfq_inquiries.sql';
  const t = read(f);
  const problems = [];
  if (!/enable row level security/i.test(t)) problems.push('未启用 RLS');
  if (/create policy/i.test(t)) problems.push('创建了策略（匿名用户可能可读）');
  for (const col of ['inquiry_number', 'items_json', 'email_delivery_status', 'submission_fingerprint', 'privacy_consent_version']) {
    if (!t.includes(col)) problems.push(`缺少列 ${col}`);
  }
  if (/\bip\b\s+text|ip_address/i.test(t)) problems.push('表里有明文 IP 列');
  return problems.length === 0 ? { ok: true, detail: 'RLS 开启 + 无策略 + 列齐全' } : problems.join('; ');
});

// ===========================================================================
section('B. 主场景：正常提交、校验、去重、限流、邮件内容');
// ===========================================================================
let main = null;
let mailfail = null;
let storefail = null;

try {
  if (EXTERNAL_BASE) {
    main = { base: EXTERNAL_BASE.replace(/\/+$/, ''), external: true, stop: async () => {} };
    console.log(`\n复用已有服务器：${main.base}（只跑 B 段；邮件/存储失败场景需要独立进程，已跳过）`);
  } else {
    main = await ensureServer({
      port: PORT_MAIN,
      env: {
        ...serverEnvBase,
        RFQ_JSON_STORE_PATH: STORE_MAIN,
        RFQ_MOCK_OUTBOX_PATH: OUTBOX_MAIN,
      },
      label: 'rfq-main',
    });
    console.log(`\n主场景服务器就绪：${main.base}`);
  }

  const api = `${main.base}/api/rfq`;

  // ---------------------------------------------------------------- 正常提交
  let success = null;
  await checkAsync('正常提交返回 ok:true 与询价号', async () => {
    const res = await postJson(api, validBody(), trustedHeaders());
    success = res;
    if (res.status !== 200) return `status=${res.status} body=${res.text.slice(0, 200)}`;
    if (!res.json?.ok) return `ok != true: ${res.text.slice(0, 200)}`;
    if (!/^BW-RFQ-\d{8}-[0-9A-F]{6}$/.test(res.json.inquiry_number ?? '')) {
      return `询价号格式不对: ${res.json.inquiry_number}`;
    }
    if (!res.json.inquiry_id) return '缺少 inquiry_id';
    return { ok: true, detail: `${res.json.inquiry_number} — "${res.json.message}"` };
  });

  await checkAsync('成功响应不泄露密钥/堆栈/数据库细节', async () => {
    const body = success?.text ?? '';
    const bad = [/re_[A-Za-z0-9]{12,}/, /eyJ[A-Za-z0-9_-]{10,}/, /service_role/i, /SUPABASE/i, /at .*\.ts:\d+/, /\bstack\b/i]
      .filter((re) => re.test(body));
    const keys = Object.keys(success?.json ?? {}).sort();
    const allowed = ['inquiry_id', 'inquiry_number', 'message', 'notice', 'ok'].sort();
    const extra = keys.filter((k) => !allowed.includes(k));
    if (bad.length) return `响应里出现敏感样式字符串: ${bad.join(', ')}`;
    if (extra.length) return `响应里出现计划外字段: ${extra.join(', ')}`;
    return { ok: true, detail: `字段只有 ${keys.join(', ')}` };
  });

  await checkAsync('询价记录已落库，且保留了 Bowen No. / OE / application_id / 数量', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过本地落库文件断言' };
    const records = readJsonl(STORE_MAIN);
    const rec = records.find((r) => r.inquiry_number === success?.json?.inquiry_number);
    if (!rec) return `落库文件里找不到 ${success?.json?.inquiry_number}`;
    const item = rec.items?.[0];
    const problems = [];
    if (item?.bowen_no !== FIXTURE.bowen_no) problems.push(`bowen_no=${item?.bowen_no}`);
    if (item?.application_id !== FIXTURE.application_id) problems.push(`application_id=${item?.application_id}`);
    if (!item?.matched_oe) problems.push('matched_oe 为空');
    if (item?.quantity !== '500 pcs') problems.push(`quantity=${item?.quantity}`);
    if (!item?.vehicle) problems.push('vehicle 为空');
    if (rec.email_delivery_status !== 'sent') problems.push(`email_delivery_status=${rec.email_delivery_status}`);
    if (rec.status !== 'received') problems.push(`status=${rec.status}`);
    if (rec.privacy_consent_version !== PRIVACY_CONSENT_VERSION) problems.push('consent 版本不对');
    if (!rec.submission_fingerprint) problems.push('缺少去重指纹');
    return problems.length === 0
      ? { ok: true, detail: `items[0] = Bowen ${item.bowen_no} / ${item.matched_oe} / ${item.quantity}` }
      : problems.join('; ');
  });

  await checkAsync('落库记录里没有任何内部字段或明文 IP', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过' };
    const blob = JSON.stringify(readJsonl(STORE_MAIN));
    const bad = [...INTERNAL_LEAKS, 'ip_address', '"ip"'].filter((k) => blob.includes(k));
    return bad.length === 0 ? { ok: true, detail: '0 命中' } : `发现 ${bad.join(', ')}`;
  });

  await checkAsync('落库记录里没有中文产品信息', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过' };
    const records = readJsonl(STORE_MAIN);
    const bad = records.filter((r) => HAN.test(JSON.stringify(r.items ?? [])));
    return bad.length === 0 ? { ok: true, detail: 'items 全部为英文展示文本' } : `${bad.length} 条记录含中文`;
  });

  await checkAsync('mock 邮件已发出，主题为 New RFQ — [Company] — [Inquiry Number]', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过 outbox 断言' };
    const mails = readJsonl(OUTBOX_MAIN);
    const mail = mails.find((m) => m.subject?.includes(success?.json?.inquiry_number ?? '__none__'));
    if (!mail) return `outbox 里没有对应邮件（共 ${mails.length} 封）`;
    const expected = `New RFQ — Verify Import ${OWNER} GmbH — ${success.json.inquiry_number}`;
    if (mail.subject !== expected) return `主题不符: ${mail.subject}`;
    if (mail.to !== 'qfbowen@126.com') return `收件人不符: ${mail.to}`;
    if (mail.reply_to !== `verify.buyer.${OWNER}@example.com`) return `reply_to 不符: ${mail.reply_to}`;
    return { ok: true, detail: mail.subject };
  });

  await checkAsync('邮件正文（纯文本）包含业务要求的全部字段', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过' };
    const mails = readJsonl(OUTBOX_MAIN);
    const mail = mails.find((m) => m.subject?.includes(success?.json?.inquiry_number ?? '__none__'));
    if (!mail) return '找不到该封邮件';
    const need = [
      'Inquiry Number:', 'Customer Name:', 'Company:', 'Country:', 'Email:',
      'Phone / WhatsApp:', 'Website:', 'Message', 'Bowen No.:', 'OE Reference:',
      'Product Type:', 'Vehicle / Application:', 'Quantity:', 'Submitted At:', 'Source Page:',
    ];
    const missing = need.filter((n) => !String(mail.text).includes(n));
    return missing.length === 0
      ? { ok: true, detail: `${need.length} 个字段齐全，正文 ${mail.text.length} 字符` }
      : `缺少 ${missing.join(', ')}`;
  });

  await checkAsync('邮件同时提供 HTML 与纯文本版本', async () => {
    if (main.external) return { ok: true, detail: '复用外部服务器，跳过' };
    const mails = readJsonl(OUTBOX_MAIN);
    const mail = mails.find((m) => m.subject?.includes(success?.json?.inquiry_number ?? '__none__'));
    if (!mail) return '找不到该封邮件';
    const okHtml = typeof mail.html === 'string' && mail.html.length > 200 && /<!doctype html>/i.test(mail.html);
    const okText = typeof mail.text === 'string' && mail.text.length > 100;
    return okHtml && okText ? { ok: true, detail: `html ${mail.html.length} 字符 / text ${mail.text.length} 字符` } : `html=${okHtml} text=${okText}`;
  });

  // ---------------------------------------------------------------- HTML 注入
  await checkAsync('客户输入里的 HTML/脚本被剥离（邮件与落库都不含标签）', async () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const res = await postJson(api, validBody({
      email: `evil.${OWNER}@example.com`,
      message: `Injection test ${evil} done`,
      company: `Evil <b>Corp</b> ${OWNER}`,
    }), trustedHeaders());
    if (res.status !== 200) return `status=${res.status} ${res.text.slice(0, 160)}`;
    if (main.external) return { ok: true, detail: '外部服务器：仅校验接口未报错' };

    const mails = readJsonl(OUTBOX_MAIN);
    const mail = mails.find((m) => m.subject?.includes(res.json.inquiry_number));
    if (!mail) return '找不到该封邮件';
    const problems = [];
    if (/<img/i.test(String(mail.html))) problems.push('HTML 邮件里出现未转义的 <img');
    if (/<script>alert\(2\)<\/script>/i.test(String(mail.html))) problems.push('HTML 邮件里出现未转义的 <script>');
    if (/<script>/i.test(String(mail.text))) problems.push('纯文本里仍含 <script>');
    if (/onerror/i.test(String(mail.text))) problems.push('纯文本里残留 onerror');

    const records = readJsonl(STORE_MAIN);
    const rec = records.find((r) => r.inquiry_number === res.json.inquiry_number);
    if (!rec) problems.push('该询价没有落库');
    else {
      if (/<[a-z]/i.test(rec.message ?? '')) problems.push('落库的 message 仍含标签');
      if (/<[a-z]/i.test(rec.company ?? '')) problems.push('落库的 company 仍含标签');
    }
    return problems.length === 0
      ? { ok: true, detail: '输入被剥成纯文本后才落库与发信' }
      : problems.join('; ');
  });

  await checkAsync('HTML 邮件的插值做了实体转义（& " \' 都转义）', async () => {
    const nasty = `Amp & Quotes "double" 'single' GmbH ${OWNER}`;
    const res = await postJson(api, validBody({
      email: `escape.${OWNER}@example.com`,
      company: nasty,
      message: `Escape probe & "quoted" 'single'`,
    }), trustedHeaders());
    if (res.status !== 200) return `status=${res.status} ${res.text.slice(0, 160)}`;
    if (main.external) return { ok: true, detail: '外部服务器：仅校验接口未报错' };

    const mail = readJsonl(OUTBOX_MAIN).find((m) => m.subject?.includes(res.json.inquiry_number));
    if (!mail) return '找不到该封邮件';
    const html = String(mail.html);
    const text = String(mail.text);
    const problems = [];
    if (!html.includes('Amp &amp; Quotes &quot;double&quot; &#39;single&#39; GmbH')) {
      problems.push('HTML 里没有看到转义后的实体');
    }
    if (!text.includes(nasty)) problems.push('纯文本版本丢失了原始文本');
    if (/Amp & Quotes/.test(html)) problems.push('HTML 里出现未转义的 &');
    return problems.length === 0
      ? { ok: true, detail: '& → &amp;，双引号 → &quot;，单引号 → &#39;' }
      : problems.join('; ');
  });

  // ---------------------------------------------------------------- 必填与格式
  const VALIDATION_CASES = [
    ['空姓名被拒绝', { name: '' }, 'name'],
    ['空公司被拒绝', { company: '' }, 'company'],
    ['空国家被拒绝', { country: '' }, 'country'],
    ['无效邮箱被拒绝', { email: 'not-an-email' }, 'email'],
    ['非法 URL 被拒绝', { website: 'not a url at all' }, 'website'],
    ['无隐私同意被拒绝', { consent: false }, 'consent'],
    ['隐私版本不匹配被拒绝', { privacy_consent_version: '2019-01-old' }, 'consent'],
  ];
  for (const [label, override, field] of VALIDATION_CASES) {
    await checkAsync(`${label}（返回 400 VALIDATION_ERROR + ${field}）`, async () => {
      const res = await postJson(api, validBody(override), trustedHeaders());
      if (res.status !== 400) return `status=${res.status}`;
      if (res.json?.code !== 'VALIDATION_ERROR') return `code=${res.json?.code}`;
      if (!res.json?.field_errors?.[field]) return `缺少 field_errors.${field}: ${res.text.slice(0, 160)}`;
      if (/re_|eyJ|stack/i.test(res.text)) return '错误响应里出现敏感内容';
      return { ok: true, detail: `field_errors.${field} = "${res.json.field_errors[field]}"` };
    });
  }

  await checkAsync('既无产品行也无留言被拒绝', async () => {
    const res = await postJson(api, validBody({ items: [], message: '' }), trustedHeaders());
    return res.status === 400 && res.json?.field_errors?.message
      ? { ok: true, detail: res.json.field_errors.message }
      : `status=${res.status} body=${res.text.slice(0, 160)}`;
  });

  await checkAsync('业务字段为空但只填留言 → 允许提交', async () => {
    const res = await postJson(api, validBody({
      items: [],
      message: 'Please quote 500 pcs of 25500-35540.',
      email: `messageonly.${OWNER}@example.com`,
    }), trustedHeaders());
    return res.status === 200 && res.json?.ok
      ? { ok: true, detail: res.json.inquiry_number }
      : `status=${res.status} body=${res.text.slice(0, 160)}`;
  });

  // ---------------------------------------------------------------- 超长与体积
  await checkAsync('超长文本被截断到上限（落库长度不超过 5000）', async () => {
    const long = 'A'.repeat(9000);
    const res = await postJson(api, validBody({
      email: `long.${OWNER}@example.com`,
      message: long,
      name: 'N'.repeat(400),
    }), trustedHeaders());
    if (res.status !== 200) return `status=${res.status} ${res.text.slice(0, 160)}`;
    if (main.external) return { ok: true, detail: '外部服务器：接口接受并被限制' };
    const rec = readJsonl(STORE_MAIN).find((r) => r.inquiry_number === res.json.inquiry_number);
    if (!rec) return '没有落库';
    if ((rec.message ?? '').length > 5000) return `message 长度 ${rec.message.length} > 5000`;
    if ((rec.name ?? '').length > 120) return `name 长度 ${rec.name.length} > 120`;
    return { ok: true, detail: `message=${rec.message.length} 字符, name=${rec.name.length} 字符` };
  });

  await checkAsync('超过请求体上限返回 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await postJson(api, validBody({
      email: `big.${OWNER}@example.com`,
      message: 'X'.repeat(80 * 1024),
    }), trustedHeaders());
    return res.status === 413 && res.json?.code === 'PAYLOAD_TOO_LARGE'
      ? { ok: true, detail: `status=413` }
      : `status=${res.status} code=${res.json?.code}`;
  });

  // ---------------------------------------------------------------- 反垃圾
  await checkAsync('honeypot 被填 → SPAM_REJECTED', async () => {
    const res = await postJson(api, validBody({ fax: '+1 555 0100', email: `spam.${OWNER}@example.com` }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'SPAM_REJECTED'
      ? { ok: true, detail: 'honeypot 命中，未给出可用反馈' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync('提交过快（低于最短耗时）→ SPAM_REJECTED', async () => {
    const res = await postJson(api, validBody({ elapsed_ms: 10, email: `fast.${OWNER}@example.com` }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'SPAM_REJECTED'
      ? { ok: true, detail: 'elapsed_ms=10 < RFQ_MIN_FILL_MS=200' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync('相同内容短时间重复提交 → 409 DUPLICATE_SUBMISSION', async () => {
    const ip = nextIp();
    const body = validBody({ email: `dupe.${OWNER}@example.com` });
    const first = await postJson(api, body, trustedHeaders(ip));
    const second = await postJson(api, body, trustedHeaders(ip));
    if (first.status !== 200) return `第一次就失败: status=${first.status}`;
    return second.status === 409 && second.json?.code === 'DUPLICATE_SUBMISSION'
      ? { ok: true, detail: `第二次被拒: ${second.json.message}` }
      : `第二次 status=${second.status} code=${second.json?.code}`;
  });

  if (main.external) {
    // 复用外部服务器时无法控制 RFQ_RATE_LIMIT_MAX，这条断言没有意义（会给出误导性的失败）
    check('超过速率上限 → 429 RATE_LIMITED（复用外部服务器，限流阈值由该服务器决定，跳过）', () => ({
      ok: true,
      detail: '已在自起服务器的模式中验证',
    }));
  } else {
    await checkAsync('超过速率上限 → 429 RATE_LIMITED（带 Retry-After）', async () => {
      const ip = nextIp();
      let last = null;
      for (let i = 0; i < 10; i += 1) {
        // 内容各不相同，避免命中"重复提交"去重
        last = await postJson(api, validBody({
          email: `ratelimit.${OWNER}.${i}@example.com`,
          message: `Rate limit probe #${i}`,
        }), trustedHeaders(ip));
        if (last.status === 429) break;
      }
      if (last?.status !== 429) return `10 次请求都没有触发限流（最后 status=${last?.status}）`;
      if (last.json?.code !== 'RATE_LIMITED') return `code=${last.json?.code}`;
      const retryAfter = last.headers.get('retry-after');
      return retryAfter ? { ok: true, detail: `429 + Retry-After: ${retryAfter}` } : '缺少 Retry-After 响应头';
    });
  }

  // ---------------------------------------------------------------- 产品校验
  await checkAsync('无效 product_id 被拒绝', async () => {
    const res = await postJson(api, validBody({
      email: `badproduct.${OWNER}@example.com`,
      items: [{ product_id: 'BW-NOT-A-REAL-PRODUCT', bowen_no: 'X', application_id: null, quantity: '1' }],
    }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
      ? { ok: true, detail: Object.values(res.json.field_errors ?? {})[0] ?? 'field error' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync('不属于该产品的 application_id 被拒绝', async () => {
    const foreign = APPLICATIONS.find((a) => a.product_id !== FIXTURE.product_id && !a.blocked && !a.needs_review);
    if (!foreign) return '找不到其它产品的 application（跳过）';
    const res = await postJson(api, validBody({
      email: `badapp.${OWNER}@example.com`,
      items: [{
        product_id: FIXTURE.product_id,
        bowen_no: FIXTURE.bowen_no,
        application_id: foreign.application_id,
        quantity: '1',
      }],
    }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
      ? { ok: true, detail: Object.values(res.json.field_errors ?? {})[0] ?? 'field error' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync('Bowen No. 与服务端记录不符时被拒绝', async () => {
    const res = await postJson(api, validBody({
      email: `badbowen.${OWNER}@example.com`,
      items: [{
        product_id: FIXTURE.product_id,
        bowen_no: 'BW-999999-WRONG',
        application_id: FIXTURE.application_id,
        quantity: '1',
      }],
    }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
      ? { ok: true, detail: Object.values(res.json.field_errors ?? {})[0] ?? 'field error' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync(`无图/非公开产品 ${NON_PUBLIC.product_id} 不允许提交`, async () => {
    const res = await postJson(api, validBody({
      email: `nopublic.${OWNER}@example.com`,
      items: [{ product_id: NON_PUBLIC.product_id, bowen_no: NON_PUBLIC.bowen_no, application_id: null, quantity: '1' }],
    }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
      ? { ok: true, detail: `无图产品 ${NON_PUBLIC.product_id} 被服务端拒绝` }
      : `status=${res.status} code=${res.json?.code}`;
  });

  for (const [label, product] of [['draft 状态产品', NON_PUBLIC_SET.draft], ['blocked 产品', NON_PUBLIC_SET.blocked]]) {
    if (!product) {
      check(`${label}不允许提交（内部数据集中没有该类记录，跳过）`, () => ({ ok: true, detail: '跳过' }));
      continue;
    }
    await checkAsync(`${label} ${product.product_id} 不允许提交`, async () => {
      const res = await postJson(api, validBody({
        email: `reject.${OWNER}.${product.product_id}@example.com`,
        items: [{ product_id: product.product_id, bowen_no: product.bowen_no, application_id: null, quantity: '1' }],
      }), trustedHeaders());
      return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
        ? { ok: true, detail: `status=${product.status}, blocked=${Boolean(product.blocked)}` }
        : `status=${res.status} code=${res.json?.code}`;
    });
  }

  await checkAsync('客户端伪造的 matched_oe / vehicle / product_type 不被采信', async () => {
    const res = await postJson(api, validBody({
      email: `forged.${OWNER}@example.com`,
      items: [{
        product_id: FIXTURE.product_id,
        bowen_no: FIXTURE.bowen_no,
        application_id: FIXTURE.application_id,
        matched_oe: 'FORGED-OE-999',
        vehicle: 'FORGED VEHICLE 中文车型',
        product_type: 'ForgedType',
        quantity: '2 pcs',
      }],
    }), trustedHeaders());
    if (res.status !== 200) return `status=${res.status} ${res.text.slice(0, 160)}`;
    if (main.external) return { ok: true, detail: '外部服务器：接口接受' };
    const rec = readJsonl(STORE_MAIN).find((r) => r.inquiry_number === res.json.inquiry_number);
    if (!rec) return '没有落库';
    const item = rec.items?.[0] ?? {};
    const problems = [];
    if (item.matched_oe === 'FORGED-OE-999') problems.push('matched_oe 采信了客户端值');
    if (String(item.vehicle).includes('FORGED') || HAN.test(String(item.vehicle))) problems.push('vehicle 采信了客户端值');
    if (item.product_type === 'ForgedType') problems.push('product_type 采信了客户端值');
    return problems.length === 0
      ? { ok: true, detail: `服务端重建: OE=${item.matched_oe}, type=${item.product_type}` }
      : problems.join('; ');
  });

  // ---------------------------------------------------------------- 内部字段
  await checkAsync('提交内部字段（source_sheets 等）被白名单拒绝', async () => {
    const res = await postJson(api, validBody({
      email: `internal.${OWNER}@example.com`,
      source_sheets: ['工作表1'],
      product_type_evidence: { kind: 'x' },
    }), trustedHeaders());
    return res.status === 400 && res.json?.code === 'VALIDATION_ERROR'
      ? { ok: true, detail: '多余字段被整体拒绝' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  // ---------------------------------------------------------------- 方法与来源
  await checkAsync('GET /api/rfq 返回 405 且 Allow: POST', async () => {
    const res = await fetch(api, { method: 'GET' });
    return res.status === 405 && (res.headers.get('allow') ?? '').includes('POST')
      ? { ok: true, detail: `status=405, allow=${res.headers.get('allow')}` }
      : `status=${res.status} allow=${res.headers.get('allow')}`;
  });

  await checkAsync('跨站 Origin 被拒绝（403）', async () => {
    const res = await rawPostOrigin(api, validBody({ email: `csrf.${OWNER}@example.com` }), 'https://evil.example.com');
    return res.status === 403 && res.json?.code === 'FORBIDDEN_ORIGIN'
      ? { ok: true, detail: '同源检查生效（Origin: https://evil.example.com）' }
      : `status=${res.status} code=${res.json?.code}`;
  });

  await checkAsync('非法 JSON 被拒绝（400）而不是 500', async () => {
    const res = await postJson(api, '{not json', trustedHeaders());
    return res.status === 400 ? { ok: true, detail: 'status=400' } : `status=${res.status}`;
  });

  await checkAsync('客户可见响应里没有中文', async () => {
    const res = await postJson(api, validBody({
      email: `hannone.${OWNER}@example.com`,
      message: 'All English message.',
    }), trustedHeaders());
    return res.status === 200 && !HAN.test(res.text)
      ? { ok: true, detail: '响应为纯英文' }
      : `status=${res.status} 含中文=${HAN.test(res.text)}`;
  });
} catch (err) {
  console.error(`\nB 段执行出错: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (main && !main.external) await main.stop();
}

// ===========================================================================
section('C. 邮件失败：询价必须仍然保存，不能丢单也不能假装成功');
// ===========================================================================
if (EXTERNAL_BASE) {
  console.log('跳过 C / D 段：使用 BASE_URL 时无法切换进程级环境变量。');
} else {
  try {
    mailfail = await ensureServer({
      port: PORT_MAILFAIL,
      env: {
        ...serverEnvBase,
        RFQ_JSON_STORE_PATH: STORE_MAILFAIL,
        RFQ_MOCK_OUTBOX_PATH: OUTBOX_MAILFAIL,
        RFQ_MOCK_MAIL_FAIL: 'true',
      },
      label: 'rfq-mailfail',
    });
    const api = `${mailfail.base}/api/rfq`;

    let res = null;
    await checkAsync('邮件通道故障时接口仍返回 ok:true（询价已记录）', async () => {
      res = await postJson(api, validBody({ email: `mailfail.${OWNER}@example.com` }), trustedHeaders());
      return res.status === 200 && res.json?.ok === true
        ? { ok: true, detail: res.json.inquiry_number }
        : `status=${res.status} body=${res.text.slice(0, 200)}`;
    });

    await checkAsync('询价记录仍然存在，状态是 email_failed', async () => {
      const rec = readJsonl(STORE_MAILFAIL).find((r) => r.inquiry_number === res?.json?.inquiry_number);
      if (!rec) return '记录丢失（这是不允许的）';
      const ok = rec.email_delivery_status === 'email_failed';
      if (!ok) return `email_delivery_status=${rec.email_delivery_status}`;
      if (!rec.email_delivery_error) return '没有记录失败原因';
      return { ok: true, detail: `${rec.email_delivery_status}: ${String(rec.email_delivery_error).slice(0, 80)}` };
    });

    await checkAsync('失败原因里不含密钥或堆栈', async () => {
      const rec = readJsonl(STORE_MAILFAIL).find((r) => r.inquiry_number === res?.json?.inquiry_number);
      const err = String(rec?.email_delivery_error ?? '');
      const bad = [/re_[A-Za-z0-9]{12,}/, /eyJ[A-Za-z0-9_-]{10,}/, /at .*\.ts:\d+/, /stack/i].filter((re) => re.test(err));
      return bad.length === 0 ? { ok: true, detail: err.slice(0, 90) } : `发现 ${bad.join(', ')}`;
    });

    await checkAsync('客户收到诚实的兜底提示（notice），而不是假装已发送', async () => {
      const notice = String(res?.json?.notice ?? '');
      return notice.includes('recorded') && notice.includes('qfbowen@126.com')
        ? { ok: true, detail: notice.slice(0, 120) }
        : `notice="${notice}"`;
    });

    await checkAsync('mock outbox 里确实没有该封邮件（没有假装发送）', async () => {
      const mails = readJsonl(OUTBOX_MAILFAIL);
      const found = mails.some((m) => m.subject?.includes(res?.json?.inquiry_number ?? '__none__'));
      return found ? 'outbox 里竟然有邮件，说明"失败"没有真正发生' : { ok: true, detail: 'outbox 为空，符合预期' };
    });
  } catch (err) {
    console.error(`\nC 段执行出错: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (mailfail) await mailfail.stop();
  }

  // =========================================================================
  section('D. 存储失败：必须返回失败，不能假装收到');
  // =========================================================================
  try {
    storefail = await ensureServer({
      port: PORT_STOREFAIL,
      env: {
        ...serverEnvBase,
        RFQ_JSON_STORE_PATH: STORE_STOREFAIL,
        RFQ_MOCK_OUTBOX_PATH: path.join(TMP, 'storefail', 'outbox.jsonl'),
      },
      label: 'rfq-storefail',
    });
    const api = `${storefail.base}/api/rfq`;

    await checkAsync('存储不可写时返回 503 SERVICE_UNAVAILABLE 且 ok:false', async () => {
      const res = await postJson(api, validBody({ email: `storefail.${OWNER}@example.com` }), trustedHeaders());
      if (res.json?.ok === true) return '存储失败却返回成功（绝不允许）';
      return res.status === 503 && res.json?.code === 'SERVICE_UNAVAILABLE'
        ? { ok: true, detail: `${res.status} ${res.json.message}` }
        : `status=${res.status} code=${res.json?.code} body=${res.text.slice(0, 160)}`;
    });

    await checkAsync('存储失败时不泄露服务器路径/堆栈', async () => {
      const res = await postJson(api, validBody({ email: `storefail2.${OWNER}@example.com` }), trustedHeaders());
      const bad = [/[A-Za-z]:\\\\/, /ENOTDIR/, /at .*\.ts:\d+/, /stack/i].filter((re) => re.test(res.text));
      return bad.length === 0 ? { ok: true, detail: '只给了通用英文提示' } : `泄露了 ${bad.join(', ')}`;
    });

    await checkAsync('存储失败时没有发出任何邮件（没有假装成功）', async () => {
      const mails = readJsonl(path.join(TMP, 'storefail', 'outbox.jsonl'));
      return mails.length === 0 ? { ok: true, detail: 'outbox 为空' } : `outbox 里有 ${mails.length} 封邮件`;
    });
  } catch (err) {
    console.error(`\nD 段执行出错: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (storefail) await storefail.stop();
  }
}

console.log(`\n（临时数据目录：${path.relative(process.cwd(), TMP)}，含 mock 邮件与落库文件，可删除）`);
process.exitCode = summary() ? (process.exitCode ?? 0) : 1;
