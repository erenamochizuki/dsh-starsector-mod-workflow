// 线框预览：把 SPEC 里的「## 线框」块或 LAYOUT.json 画成 PNG。
// 用游戏自带的 BMFont 字形，中文宽度与实机一致；只表达构图，不代表最终配色。
// node Script\preview.mjs --spec TASKS\x\SPEC.md --out preview.png
// node Script\preview.mjs --layout TASKS\x\LAYOUT.json --out preview.png [--font 字体.fnt] [--game 游戏根]
import fs from 'node:fs';
import path from 'node:path';
import { Canvas } from '../GATE/preview/canvas.mjs';
import { loadFont, measure, drawText, wrap } from '../GATE/preview/font.mjs';
import { writePng } from '../GATE/preview/png.mjs';
import { resolveGameRoot } from './lib/sources.mjs';

const COL = {
  bg: [9, 13, 22, 255],
  panel: [15, 21, 34, 255],
  border: [45, 72, 110, 255],
  gold: [212, 175, 55, 255],
  text: [214, 210, 196, 255],
  dim: [120, 138, 158, 255],
  hilite: [28, 40, 60, 255],
  danger: [190, 90, 80, 255],
};

function tokens(line) {
  return line.match(/"[^"]*"|\S+/g)?.map((t) => t.startsWith('"') ? t.slice(1, -1) : t) || [];
}
const num = (v) => Number(v);

export function parseDsl(text, file = '') {
  const model = { width: 1500, height: 900, regions: [], rows: [], lines: [], buttons: [], notes: [], footer: null, title: '', subtitle: '' };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//')) continue;
    const t = tokens(raw);
    const cmd = t[0];
    switch (cmd) {
      case 'size': model.width = num(t[1]); model.height = num(t[2]); break;
      case 'title': model.title = t[1] || ''; break;
      case 'subtitle': model.subtitle = t[1] || ''; break;
      case 'region': model.regions.push({ x: num(t[1]), y: num(t[2]), w: num(t[3]), h: num(t[4]), label: t[5] || '' }); break;
      case 'row': model.rows.push({ x: num(t[1]), y: num(t[2]), w: num(t[3]), h: num(t[4]), text: t[5] || '', selected: t.includes('selected') }); break;
      case 'line': model.lines.push({ x: num(t[1]), y: num(t[2]), text: t[3] || '' }); break;
      case 'button': model.buttons.push({ x: num(t[1]), y: num(t[2]), w: num(t[3]), h: num(t[4]), label: t[5] || '', primary: t.includes('primary') }); break;
      case 'note': model.notes.push({ x: num(t[1]), y: num(t[2]), w: num(t[3]), text: t[4] || '' }); break;
      case 'footer': model.footer = { x: num(t[1]), y: num(t[2]), text: t[3] || '' }; break;
      default: throw new Error(`${file}:${i + 1} 未知指令「${cmd}」`);
    }
  }
  return model;
}

function specBlock(specText) {
  const m = specText.match(/##\s*(?:线框|界面要求)[^\n]*\n+```[^\n]*\n([\s\S]*?)```/);
  if (!m) throw new Error('SPEC 里没有「## 线框」代码块；用 ``` 包住 size/region/row 指令');
  return m[1];
}

function render(model, font) {
  const cv = new Canvas(model.width, model.height);
  cv.fill(COL.bg);
  if (model.title) drawText(cv, font, model.title, 24, 16, 22, COL.text);
  if (model.subtitle) drawText(cv, font, model.subtitle, 24, 50, 13, COL.dim);

  for (const r of model.regions) {
    cv.rect(r.x, r.y, r.w, r.h, COL.panel);
    cv.frame(r.x, r.y, r.w, r.h, COL.border);
    if (r.label) {
      drawText(cv, font, r.label, r.x + 10, r.y + 7, 15, COL.gold);
      const lw = measure(font, r.label, 15);
      cv.hline(r.x + 10, r.y + 27, Math.min(lw, r.w - 20), COL.border);
    }
    if (model.annotate) {
      const t = `${r.w}×${r.h}`;
      drawText(cv, font, t, r.x + r.w - measure(font, t, 10) - 8, r.y + r.h - 16, 10, COL.dim);
    }
  }
  for (const r of model.rows) {
    if (r.selected) {
      cv.rect(r.x, r.y, r.w, r.h, COL.hilite);
      cv.rect(r.x, r.y, 3, r.h, COL.gold);
    }
    const parts = r.text.split('|').map((s) => s.trim());
    const left = parts[0] || '';
    const ty = r.h >= 44 ? r.y + 10 : r.y + (r.h - 15) / 2 + 2;
    drawText(cv, font, left, r.x + 14, ty, 15, COL.text);
    if (parts[1]) drawText(cv, font, parts[1], r.x + r.w - measure(font, parts[1], 13) - 12, r.y + (r.h - 13) / 2 + 2, 13, COL.dim);
  }
  for (const l of model.lines) drawText(cv, font, l.text, l.x, l.y, 14, COL.text);
  for (const b of model.buttons) {
    cv.rect(b.x, b.y, b.w, b.h, COL.panel);
    cv.frame(b.x, b.y, b.w, b.h, b.primary ? COL.gold : COL.border);
    const tw = measure(font, b.label, 15);
    drawText(cv, font, b.label, b.x + (b.w - tw) / 2, b.y + (b.h - 15) / 2 + 2, 15, b.primary ? COL.gold : COL.text);
  }
  for (const n of model.notes) {
    let y = n.y;
    for (const line of wrap(font, n.text, 12, n.w)) { drawText(cv, font, line, n.x, y, 12, COL.dim); y += 16; }
  }
  if (model.footer) {
    drawText(cv, font, model.footer.text, model.footer.x ?? 24, model.footer.y, 12, COL.dim);
  }
  const tag = `${model.width}×${model.height} · 线框（构图级）`;
  drawText(cv, font, tag, model.width - measure(font, tag, 11) - 16, model.height - 22, 11, COL.dim);
  return cv;
}

const argv = process.argv.slice(2);
const opt = new Map();
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--') && argv[i + 1]) opt.set(argv[i].slice(2), argv[i + 1]);
const spec = opt.get('spec');
const layoutFile = opt.get('layout');
const out = opt.get('out');
if (!spec && !layoutFile) {
  console.error('用法：node Script\\preview.mjs --spec SPEC.md | --layout LAYOUT.json --out preview.png [--font x.fnt] [--game 游戏根]');
  process.exit(2);
}
if (!out) { console.error('缺少 --out'); process.exit(2); }

const gameRoot = opt.get('game') || resolveGameRoot().gameRoot;
const fontPath = opt.get('font') || path.join(gameRoot, 'starsector-core', 'graphics', 'fonts', 'insignia25LTaa.fnt');
if (!fs.existsSync(fontPath)) {
  console.error(`找不到字体：${fontPath}（用 --font 指定）`);
  process.exit(2);
}
const font = loadFont(fontPath);

let model;
if (layoutFile) {
  model = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
  model.regions ||= []; model.rows ||= []; model.lines ||= []; model.buttons ||= []; model.notes ||= [];
} else {
  model = parseDsl(specBlock(fs.readFileSync(spec, 'utf8')), spec);
}
model.annotate = argv.includes('--annotate');
const cv = render(model, font);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writePng(out, model.width, model.height, cv.rgba);
console.log(`已生成：${out}（${model.width}×${model.height}，字体 ${path.basename(fontPath)}）`);
if (!layoutFile) {
  const at = path.join(path.dirname(path.resolve(spec)), 'LAYOUT.json');
  fs.writeFileSync(at, JSON.stringify(model, null, 2) + '\n', 'utf8');
  console.log(`同步布局数据：${at}`);
}
