/**
 * 极简静态文件服务器（零依赖）
 * ===========================================================================
 * 用途：把 data/processed/ 通过 http 暴露出来，让无头浏览器能加载图片。
 * 为什么不用 file://：Chrome 对 file:// 下的跨目录资源加载有额外限制，
 * 用本地 http 更可靠，行为也更接近真实网站。
 *
 * 只监听 127.0.0.1，只在构建/截图期间存活，用完即关。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * @param {string} rootDir 要暴露的根目录（绝对路径）
 * @returns {Promise<{origin: string, close: () => Promise<void>}>}
 */
export function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const rel = urlPath === '/' ? '/index.html' : urlPath;
      const target = path.resolve(root, '.' + rel);

      // 目录逃逸保护
      if (!target.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(target).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e.message));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
