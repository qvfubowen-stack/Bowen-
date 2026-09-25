#!/usr/bin/env node
/**
 * 打包交付 ZIP
 * ===========================================================================
 * 产出两个包：
 *   Bowen-Website-Prototype-V1.zip          给业务方验收用（源码 + 数据 + 文档 + 交付包）
 *   Bowen-Website-Prototype-V1-SOURCE.zip   给其他 AI / 开发人员审查用（同上，另附源码清单）
 *
 * 两个包都排除：node_modules、.next、缓存、临时文件、.env、密钥、构建产物。
 * 只依赖 Node 内置模块（自己写 ZIP，不引第三方库）。
 *
 * 用法：node tools/make-delivery-zips.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTDIR = path.join(ROOT, 'delivery', 'zips');
const NAME = 'Bowen-Website-Prototype-V1';

// ------------------------------------------------------------------ ZIP 写出
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

const U32_MAX = 0xffffffff;

function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const dataBuf = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const comp = zlib.deflateRawSync(dataBuf, { level: 9 });
    const crc = crc32(dataBuf);
    const mtime = e.mtime ?? new Date();
    const t = dosTime(mtime);
    const d = dosDate(mtime);

    // 单个文件超过 4 GiB（或总偏移超过 4 GiB）时用 ZIP64 扩展信息
    const needZip64 = comp.length > U32_MAX || dataBuf.length > U32_MAX || offset > U32_MAX;
    const extra = needZip64
      ? (() => {
        const b = Buffer.alloc(20);
        b.writeUInt16LE(0x0001, 0);       // ZIP64 extended information
        b.writeUInt16LE(16, 2);           // 数据长度
        b.writeBigUInt64LE(BigInt(dataBuf.length), 4);
        b.writeBigUInt64LE(BigInt(comp.length), 12);
        return b;
      })()
      : Buffer.alloc(0);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(needZip64 ? 45 : 20, 4);
    local.writeUInt16LE(0x0800, 6);      // UTF-8 flag
    local.writeUInt16LE(8, 8);           // deflate
    local.writeUInt16LE(t, 10);
    local.writeUInt16LE(d, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(needZip64 ? U32_MAX : comp.length, 18);
    local.writeUInt32LE(needZip64 ? U32_MAX : dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(extra.length, 28);
    chunks.push(local, nameBuf, extra, comp);

    const cdExtra = needZip64
      ? (() => {
        const b = Buffer.alloc(32);
        b.writeUInt16LE(0x0001, 0);
        b.writeUInt16LE(28, 2);
        b.writeBigUInt64LE(BigInt(dataBuf.length), 4);
        b.writeBigUInt64LE(BigInt(comp.length), 12);
        b.writeBigUInt64LE(BigInt(offset), 20);
        return b;
      })()
      : Buffer.alloc(0);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(needZip64 ? 45 : 20, 4);   // version made by
    cd.writeUInt16LE(needZip64 ? 45 : 20, 6);   // version needed
    cd.writeUInt16LE(0x0800, 8);                // UTF-8 flag
    cd.writeUInt16LE(8, 10);                    // deflate
    cd.writeUInt16LE(t, 12);
    cd.writeUInt16LE(d, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(needZip64 ? U32_MAX : comp.length, 20);
    cd.writeUInt32LE(needZip64 ? U32_MAX : dataBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(cdExtra.length, 30);
    cd.writeUInt16LE(0, 32);                    // comment
    cd.writeUInt16LE(0, 34);                    // disk
    cd.writeUInt16LE(0, 36);                    // internal attrs
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs（必须无符号）
    cd.writeUInt32LE(needZip64 ? U32_MAX : offset, 42);
    central.push(cd, nameBuf, cdExtra);

    offset += local.length + nameBuf.length + extra.length + comp.length;
  }

  const centralBuf = Buffer.concat(central);
  const fileCount = central.length / 3;

  // 中央目录偏移或条目数超限时写 ZIP64 end of central directory
  const needZip64Eocd = offset > U32_MAX || centralBuf.length > U32_MAX || fileCount > 0xffff;
  if (needZip64Eocd) {
    const z64 = Buffer.alloc(56);
    z64.writeUInt32LE(0x06064b50, 0);
    z64.writeBigUInt64LE(BigInt(44), 4);              // size of this record - 12
    z64.writeUInt16LE(45, 12);
    z64.writeUInt16LE(45, 14);
    z64.writeUInt32LE(0, 16);
    z64.writeUInt32LE(0, 20);
    z64.writeBigUInt64LE(BigInt(fileCount), 24);
    z64.writeBigUInt64LE(BigInt(fileCount), 32);
    z64.writeBigUInt64LE(BigInt(centralBuf.length), 40);
    z64.writeBigUInt64LE(BigInt(offset), 48);
    chunks.push(z64);

    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    loc.writeUInt32LE(0, 4);
    loc.writeBigUInt64LE(BigInt(offset + centralBuf.length), 8);
    loc.writeUInt32LE(1, 16);
    chunks.push(loc, centralBuf);
  } else {
    chunks.push(centralBuf);
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Math.min(fileCount, 0xffff), 8);
  end.writeUInt16LE(Math.min(fileCount, 0xffff), 10);
  end.writeUInt32LE(Math.min(centralBuf.length, U32_MAX), 12);
  end.writeUInt32LE(Math.min(offset, U32_MAX), 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);

  return Buffer.concat(chunks);
}

// ------------------------------------------------------------------ 排除规则
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', '.cache', '.pnpm-store', '.pnpm-cache', '.pnpm-state',
  'out', 'dist', 'build', 'zips', 'tmp', 'temp', '.tmp', '.vscode', '.idea',
  '_sheets-v2',
]);

const EXCLUDE_FILE_RE = [
  /\.log$/i,
  /\.tsbuildinfo$/i,
  /^\.env$/,
  /^\.env\.(?!example)/,
  /\.pem$/i,
  /\.key$/i,
  /\.xlsx\.lock$/i,
  /^~\$/,
  /^Thumbs\.db$/i,
  /^\.DS_Store$/i,
  /^desktop\.ini$/i,
  /^\.~lock\./,
];

/** 明确不放行的敏感文件名（双保险，即使上面规则漏了也不会进包） */
const DENY_NAMES = new Set(['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519']);

function walk(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      out.push({ name: relPath + '/', dir: true });
      out.push(...walk(abs, relPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (DENY_NAMES.has(entry.name)) continue;
    if (EXCLUDE_FILE_RE.some((re) => re.test(entry.name))) continue;
    out.push({ name: relPath, abs });
  }
  return out;
}

function buildEntries(prefix, extraFiles = []) {
  const files = walk(ROOT).filter((f) => !f.dir);
  const entries = [];
  // 目录条目（保持结构可读）
  for (const f of walk(ROOT)) {
    if (f.dir) entries.push({ name: `${prefix}/${f.name}`, data: Buffer.alloc(0), mtime: new Date() });
  }
  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    entries.push({
      name: `${prefix}/${f.name}`,
      data,
      mtime: fs.statSync(f.abs).mtime,
    });
  }
  for (const e of extraFiles) entries.push({ name: `${prefix}/${e.name}`, data: e.data, mtime: new Date() });
  return entries;
}

// ------------------------------------------------------------------ 生成清单
function gitInfo() {
  const git = 'C:\\Users\\asus\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe';
  try {
    return {
      head: execFileSync(git, ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
      log: execFileSync(git, ['log', '--oneline', '-5'], { cwd: ROOT }).toString().trim(),
    };
  } catch {
    return { head: '(git 不可用)', log: '(git 不可用)' };
  }
}

const git = gitInfo();

function manifestText(files) {
  const lines = [
    `${NAME} — 文件清单（FILE MANIFEST）`,
    '='.repeat(78),
    '',
    `生成时间 : ${new Date().toISOString()}`,
    `Git HEAD : ${git.head}`,
    '',
    'Git 历史：',
    ...git.log.split('\n').map((l) => '  ' + l),
    '',
    `文件总数 : ${files.filter((f) => !f.dir).length}`,
    `总字节数 : ${files.filter((f) => !f.dir).reduce((s, f) => s + fs.statSync(f.abs).size, 0).toLocaleString('en-US')}`,
    '',
    '已排除（不打包）：',
    '  node_modules / .next / .git / .cache / .pnpm-store / .pnpm-cache / .pnpm-state',
    '  out / dist / build / tmp / temp / .vscode / .idea / *.log / *.tsbuildinfo',
    '  .env 及其变体（真实密钥）/ *.pem / *.key / Excel 锁文件 / 系统临时文件',
    '',
    '='.repeat(78),
    '文件列表',
    '='.repeat(78),
    '',
  ];
  for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
    if (f.dir) continue;
    const size = fs.statSync(f.abs).size;
    lines.push(`${String(size).padStart(12)}  ${f.name}`);
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ 输出
fs.mkdirSync(OUTDIR, { recursive: true });

const allFiles = walk(ROOT).filter((f) => !f.dir);
console.log(`待打包文件：${allFiles.length} 个`);
console.log(`排除：node_modules / .next / .git / 缓存 / 临时文件 / .env / 密钥\n`);

// 1) 业务方验收包
const zip1 = makeZip(buildEntries(NAME));
const p1 = path.join(OUTDIR, `${NAME}.zip`);
fs.writeFileSync(p1, zip1);

// 2) 源码审查包（额外附文件清单）
const zip2 = makeZip(buildEntries(`${NAME}-SOURCE`, [
  { name: 'FILE-MANIFEST.txt', data: manifestText(allFiles) },
]));
const p2 = path.join(OUTDIR, `${NAME}-SOURCE.zip`);
fs.writeFileSync(p2, zip2);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`${NAME}.zip              ${kb(zip1.length)}   ${p1}`);
console.log(`${NAME}-SOURCE.zip       ${kb(zip2.length)}   ${p2}`);

// 3) 自检：确认排除项没有混进去
console.log('\n包内自检：');
const names = buildEntries(NAME).map((e) => e.name);
const leaks = names.filter((n) =>
  /node_modules|\.next\/|\.git\/|\.pnpm-|\.env$|\.pem$|\.key$|\.log$/i.test(n));
console.log(leaks.length === 0 ? '  ✅ 无 node_modules / .next / 缓存 / 密钥 / 日志' : `  ❌ 发现泄漏: ${leaks.slice(0, 5).join(', ')}`);
const keyFiles = ['README.md', 'website/package.json', 'website/pnpm-lock.yaml', 'docs/',
  'delivery/', 'tools/build-product-db-v2.mjs', 'website/src/data/products.json'];
const missing = keyFiles.filter((k) => !names.some((n) => n.startsWith(`${NAME}/${k}`)));
console.log(missing.length === 0 ? '  ✅ 关键文件齐全（README / package.json / lock / docs / delivery / 数据脚本 / 原型数据）' : `  ❌ 缺少: ${missing.join(', ')}`);
