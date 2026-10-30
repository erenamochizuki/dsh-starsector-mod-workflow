// 极简画布：RGBA 缓冲、矩形、描边、文字；线框只用这些。
export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.rgba = Buffer.alloc(w * h * 4);
  }

  blend(x, y, color, alpha = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = (alpha / 255) * ((color[3] ?? 255) / 255);
    if (a <= 0) return;
    const i = (y * this.w + x) * 4;
    this.rgba[i] = Math.round(this.rgba[i] * (1 - a) + color[0] * a);
    this.rgba[i + 1] = Math.round(this.rgba[i + 1] * (1 - a) + color[1] * a);
    this.rgba[i + 2] = Math.round(this.rgba[i + 2] * (1 - a) + color[2] * a);
    this.rgba[i + 3] = 255;
  }

  fill(color) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.blend(x, y, color);
  }

  rect(x, y, w, h, color) {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, color);
  }

  frame(x, y, w, h, color, t = 1) {
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y, t, h, color);
    this.rect(x + w - t, y, t, h, color);
  }

  hline(x, y, w, color, t = 1) { this.rect(x, y, w, t, color); }
}
