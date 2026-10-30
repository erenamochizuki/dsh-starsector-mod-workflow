// S2 语义清单（W）：render* 里调 addComponent，布局要等下一帧才生效，容易画错位置。
export default {
  id: 'S2',
  level: 'W',
  title: 'render 内改布局',
  check(ctx) {
    const out = [];
    for (const rel of ctx.byExt('.java')) {
      const lines = ctx.read(rel).split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (!/void\s+render(Below)?\s*\(/.test(lines[i])) continue;
        for (let j = i + 1; j < Math.min(i + 120, lines.length); j++) {
          if (/\baddComponent\s*\(/.test(lines[j])) {
            out.push({ file: rel, line: j + 1, msg: 'render 里 addComponent：布局延迟到下一帧，改到 advance/init' });
            break;
          }
        }
      }
    }
    return out;
  },
};
