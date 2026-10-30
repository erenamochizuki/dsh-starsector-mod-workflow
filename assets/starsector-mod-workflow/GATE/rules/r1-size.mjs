// R1 文件过大：>800 行 W，>1500 行 E。存量由 baseline 降级为债务。
export default {
  id: 'R1',
  level: 'E',
  title: '文件过大',
  check(ctx) {
    const out = [];
    for (const rel of ctx.byExt('.java')) {
      const n = ctx.read(rel).split(/\r?\n/).length;
      if (n > 1500) out.push({ file: rel, line: 1, msg: `文件 ${n} 行（>1500），拆成核心/适配/界面` });
      else if (n > 800) out.push({ file: rel, line: 1, msg: `文件 ${n} 行（>800），考虑拆分`, level: 'W' });
    }
    return out;
  },
};
