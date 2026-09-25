#!/usr/bin/env node
/**
 * 极简 npm 运行器（零依赖）
 * ---------------------------------------------------------------------------
 * 为什么需要它：本机没有全局安装 npm，只有 Node.js。
 * 为了让需求里的「一条命令启动」真正可用（npm run dev / npm run build），
 * 这里实现 npm 的最小可用子集：读取 package.json 的 scripts，
 * 用系统 shell 执行，并把命令自身所在的 node_modules/.bin 放进 PATH。
 *
 * 支持的写法：
 *   node tools/npm-run.mjs dev
 *   node tools/npm-run.mjs run dev          （等价，兼容 npm run 语法）
 *   node tools/npm-run.mjs start            （npm start 的别名）
 *   node tools/npm-run.mjs --list
 *
 * 它不安装依赖、不发布、不处理 npm 的其他子命令。
 * 如果本机装了真正的 npm，用真正的 npm 即可，行为一致。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const pkgPath = path.join(ROOT, 'package.json');

function readScripts() {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts ?? {};
  } catch {
    console.error(`找不到或无法解析 ${pkgPath}`);
    process.exit(1);
  }
}

function usage(scripts, code) {
  console.log(`用法: node tools/npm-run.mjs [run] <script> [-- 额外参数...]

可用脚本（来自 package.json）:`);
  for (const [name, cmd] of Object.entries(scripts)) console.log(`  ${name.padEnd(14)} ${cmd}`);
  console.log(`
示例:
  node tools/npm-run.mjs dev
  node tools/npm-run.mjs run build`);
  process.exit(code);
}

const scripts = readScripts();
let args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') usage(scripts, args.length === 0 ? 1 : 0);
if (args[0] === '--list' || args[0] === 'ls') usage(scripts, 0);

// 兼容 "npm run <script>" 的写法：去掉开头的 run / run-script
if (args[0] === 'run' || args[0] === 'run-script') args = args.slice(1);
// 兼容 "npm start" / "npm test"（不带 run 的隐式脚本）
if (args.length === 0) usage(scripts, 1);

const scriptName = args[0];
const passthrough = args[1] === '--' ? args.slice(2) : args.slice(1);

const command = scripts[scriptName];
if (!command) {
  console.error(`未知脚本: ${scriptName}\n`);
  usage(scripts, 1);
}

if (passthrough.length) {
  console.error(`说明: "${scriptName}" 不接受额外参数，已忽略: ${passthrough.join(' ')}`);
}

// 把本地 .bin 放到 PATH 最前面，让脚本里的 next / tsc 等能被找到。
// 同时把当前 Node 可执行文件所在目录也加进去 —— 本机的 node 可能不在
// cmd.exe 继承到的 PATH 里（例如通过包装脚本调用时），而脚本命令里会写 "node ..."。
const localBin = path.join(ROOT, 'node_modules', '.bin');
const nodeDir = path.dirname(process.execPath);
const env = { ...process.env };
env.PATH = [localBin, nodeDir, env.PATH ?? ''].filter(Boolean).join(path.delimiter);

console.log(`> ${scriptName}: ${command}\n`);

const child = spawn(command, {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error(`启动失败: ${err.message}`);
  process.exit(1);
});
