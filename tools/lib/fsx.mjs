/**
 * 文件系统小工具
 * ===========================================================================
 * 为什么需要这个：本机的运行环境里 `fs.rmSync()` 会**静默失效**——
 * 调用不报错，但文件/目录依然存在（实测 `fs.rmSync(dir,{recursive:true})`
 * 之后 `fs.existsSync(dir)` 仍为 true）。而 `fs.unlinkSync` / `fs.rmdirSync`
 * 是正常工作的。所以需要删除目录树时统一走这里，不要用 rmSync。
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 递归删除文件或目录（unlinkSync + rmdirSync 实现，不依赖 rmSync）。
 * @param {string} target
 * @returns {{ removed: number, dirs: number }}
 */
export function removeTree(target) {
  if (!fs.existsSync(target)) return { removed: 0, dirs: 0 };
  let removed = 0;
  let dirs = 0;
  const walk = (p) => {
    const st = fs.lstatSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
      fs.rmdirSync(p);
      dirs += 1;
    } else {
      fs.unlinkSync(p);
      removed += 1;
    }
  };
  walk(target);
  return { removed, dirs };
}

/**
 * 尽力删除单个文件（Windows 上 Chrome 可能短暂占用文件句柄，失败就重试）。
 * @param {string} file
 * @param {number} [attempts]
 * @param {number} [delayMs]
 */
export async function unlinkWithRetry(file, attempts = 12, delayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.unlinkSync(file);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') return true;
      if (i === attempts - 1) return false;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}
