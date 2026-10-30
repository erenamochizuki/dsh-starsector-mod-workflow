// R4 硬编码绝对路径：F:\ / C:/ 之类，换机即坏。
export default {
  id: 'R4',
  level: 'E',
  title: '硬编码绝对路径',
  check(ctx) {
    const out = [];
    const re = /(^|[^\w])([A-Za-z]:[\\/][^"'\s]*)/g;
    for (const rel of ctx.files) {
      if (rel.endsWith('.md')) continue;
      const lines = ctx.read(rel).split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        const m = re.exec(line);
        if (m) out.push({ file: rel, line: i + 1, msg: `绝对路径：${m[2].slice(0, 60)}` });
      }
    }
    return out;
  },
};
