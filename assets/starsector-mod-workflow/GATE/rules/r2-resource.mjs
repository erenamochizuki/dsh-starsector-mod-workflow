// R2 资源不存在：代码字符串与 CSV 图标路径里的资源要在 mod 或本体里找得到。
import path from 'node:path';
import fs from 'node:fs';

const RES_RE = /"(graphics|sounds|data)\/[^"\n]*\.(png|jpg|jpeg|ogg|wav|fnt|json|csv|wpn|ship|variant)"/g;

function bases(ctx) {
  const list = [ctx.modDir];
  const g = ctx.opts.gameRoot;
  if (g) list.push(path.join(g, 'starsector-core'));
  return list;
}

function resolve(ctx, rel) {
  for (const b of bases(ctx)) {
    if (fs.existsSync(path.join(b, rel))) return true;
  }
  return false;
}

export default {
  id: 'R2',
  level: 'E',
  title: '资源不存在',
  check(ctx) {
    const out = [];
    const hasCore = Boolean(ctx.opts.gameRoot);
    for (const rel of ctx.byExt('.java')) {
      const text = ctx.read(rel);
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        RES_RE.lastIndex = 0;
        let m;
        while ((m = RES_RE.exec(lines[i]))) {
          const p = m[0].slice(1, -1);
          if (p.includes('%') || p.includes('{')) continue;
          if (resolve(ctx, p)) continue;
          const modOwned = p.startsWith('data/');
          out.push({ file: rel, line: i + 1, msg: `资源不存在：${p}`, level: modOwned || hasCore ? 'E' : 'W' });
        }
      }
    }
    // CSV 里的图标列
    for (const rel of ctx.byExt('.csv')) {
      const t = ctx.rowsOf(rel);
      if (!t) continue;
      const iconCols = ['icon', 'sprite', 'logo', 'crest'];
      for (const col of iconCols) {
        if (!t.header.includes(col)) continue;
        for (const row of t.rows) {
          const p = row[col];
          if (!p || !/^(graphics|data)\//.test(p)) continue;
          if (resolve(ctx, p)) continue;
          const modOwned = p.startsWith('data/');
          out.push({ file: rel, line: 1, msg: `CSV ${col} 指向不存在的资源：${p}`, level: modOwned || hasCore ? 'E' : 'W' });
        }
      }
    }
    return out;
  },
};
