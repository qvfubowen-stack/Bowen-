/**
 * Phase 3.5 —— 媒体文件基础信息（纯 Node.js，零第三方依赖）
 * ---------------------------------------------------------------------
 * 只解析文件头拿宽高，不解码像素——审计只需要尺寸与格式，
 * 不需要为了读几个数字引入 sharp/jimp 这类二进制依赖。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

export function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 按真实字节判断格式（不信任扩展名） */
export function sniffFormat(buf) {
  if (!buf || buf.length < 12) return 'unknown';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') return 'gif';
  const b4 = buf.subarray(0, 4).toString('latin1');
  if (b4 === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(0, 2).toString('latin1') === 'BM') return 'bmp';
  const head = buf.subarray(0, 300).toString('latin1');
  if (/<svg[\s>]/i.test(head) || /^\s*<\?xml[^>]*\?>\s*<svg/i.test(buf.subarray(0, 300).toString('utf8'))) return 'svg';
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.subarray(0, 4).toString('latin1') === 'PK\x03\x04') return 'zip(ooxml)';
  if (buf.subarray(0, 4).toString('latin1') === 'Rar!') return 'rar';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm/mkv';
  return 'unknown';
}

/** 读常见图片格式的宽高；不支持则返回 null */
export function imageSize(buf, format) {
  try {
    if (format === 'png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (format === 'gif') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (format === 'bmp') return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
    if (format === 'webp') {
      const kind = buf.subarray(12, 16).toString('latin1');
      if (kind === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width: w, height: h };
      }
      if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    if (format === 'jpeg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
      return null;
    }
    if (format === 'svg') {
      const s = buf.toString('utf8').slice(0, 2000);
      const w = s.match(/\bwidth\s*=\s*["']?([\d.]+)/i);
      const h = s.match(/\bheight\s*=\s*["']?([\d.]+)/i);
      if (w && h) return { width: Math.round(+w[1]), height: Math.round(+h[1]) };
      const vb = s.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/i);
      if (vb) {
        const p = vb[1].trim().split(/[\s,]+/).map(Number);
        if (p.length === 4) return { width: Math.round(p[2]), height: Math.round(p[3]) };
      }
      return null;
    }
  } catch { return null; }
  return null;
}

export function fileInfo(absPath) {
  const buf = fs.readFileSync(absPath);
  const format = sniffFormat(buf);
  const size = imageSize(buf, format);
  return {
    bytes: buf.length,
    format,
    width: size ? size.width : null,
    height: size ? size.height : null,
    sha256: sha256Buf(buf),
  };
}
