// 读游戏自带的 BMFont（文本 .fnt + PNG 图集），用同一套字形画线框，中文宽度与实机一致。
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './png.mjs';

export function loadFont(fntPath) {
  const text = fs.readFileSync(fntPath, 'utf8');
  const atlasFile = (text.match(/^page id=0 file="([^"]+)"/m) || [])[1];
  const common = text.match(/^common\s+(.+)$/m);
  if (!atlasFile || !common) throw new Error(`无法解析 .fnt：${fntPath}`);
  const kv = (s) => Object.fromEntries(s.trim().split(/\s+/).map((x) => x.split('=')).filter((p) => p.length === 2));
  const c = kv(common[1]);
  const glyphs = new Map();
  const re = /^char id=(\d+)\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const g = kv(m[2]);
    glyphs.set(Number(m[1]), {
      x: +g.x, y: +g.y, w: +g.width, h: +g.height,
      xo: +g.xoffset, yo: +g.yoffset, xa: +g.xadvance,
    });
  }
  const atlasPath = path.join(path.dirname(fntPath), atlasFile);
  const atlas = decodePng(fs.readFileSync(atlasPath));
  return {
    path: fntPath,
    lineHeight: +c.lineHeight || 25,
    base: +c.base || 22,
    glyphs,
    atlas,
    fallback: 63,
  };
}

export function measure(font, text, px) {
  const s = px / font.lineHeight;
  let w = 0;
  for (const ch of String(text)) {
    const g = font.glyphs.get(ch.codePointAt(0)) || font.glyphs.get(font.fallback);
    w += (g ? g.xa : px * 0.5) * s;
  }
  return Math.round(w);
}

export function drawText(canvas, font, text, x, y, px, color = [220, 220, 220, 255]) {
  const s = px / font.lineHeight;
  let penX = x;
  const penY = y;
  for (const ch of String(text)) {
    const g = font.glyphs.get(ch.codePointAt(0)) || font.glyphs.get(font.fallback);
    if (!g) { penX += px * 0.5; continue; }
    const dx = Math.round(penX + g.xo * s);
    const dy = Math.round(penY + g.yo * s);
    const dw = Math.max(1, Math.round(g.w * s));
    const dh = Math.max(1, Math.round(g.h * s));
    const a = font.atlas;
    for (let yy = 0; yy < dh; yy++) {
      const sy = g.y + Math.floor(yy / s);
      if (sy < 0 || sy >= a.height) continue;
      for (let xx = 0; xx < dw; xx++) {
        const sx = g.x + Math.floor(xx / s);
        if (sx < 0 || sx >= a.width) continue;
        const src = (sy * a.width + sx) * 4;
        const alpha = a.rgba[src + 3];
        if (!alpha) continue;
        canvas.blend(dx + xx, dy + yy, color, alpha);
      }
    }
    penX += g.xa * s;
  }
  return penX - x;
}

export function wrap(font, text, px, maxWidth) {
  const out = [];
  let line = '';
  for (const ch of String(text)) {
    const next = line + ch;
    if (line && measure(font, next, px) > maxWidth) {
      out.push(line);
      line = ch === ' ' ? '' : ch;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
