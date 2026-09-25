#!/usr/bin/env node
/**
 * 极简 npm 运行器（零依赖）
 * ---------------------------------------------------------------------------
 * 为什么需要它：本机没有全局安装 npm，只有 Node.js。
 * 为了让需求里的「一条命令启动」真正可用（npm run dev / npm run build），
 * 这里实现 npm run <script> 的最小可用子集：读取 package.json 的 scripts，
 * 用系统 shell 执行，并把命令自身所在的 node_modules/.bin 放进 PATH。
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

function usage() {
  console.log(`用法: node tools/npm-run.mjs <script> [-- 额外参数...]

可用脚本（来自 package.json）:`);
  const scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts ?? {};
  for (const [name, cmd] of Object.entries(scripts)) console.log(`  ${name.padEnd(14)} ${cmd}`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const scriptName = args[0];
const passthrough = args[1] === '--' ? args.slice(2) : args.slice(1);

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const command = pkg.scripts?.[scriptName];
if (!command) {
  console.error(`未知脚本: ${scriptName}`);
  usage();
  process.exit(1);
}

if (passthrough.length) {
  console.error(`说明: "${scriptName}" 不接受额外参数，已忽略: ${passthrough.join(' ')}`);
}

// 把本地 .bin 放到 PATH 最前面，让脚本里的 next / tsc 等能被找到
const localBin = path.join(ROOT, 'node_modules', '.bin');
const env = { ...process.env };
env.PATH = localBin + path.delimiter + (env.PATH ?? '');

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
