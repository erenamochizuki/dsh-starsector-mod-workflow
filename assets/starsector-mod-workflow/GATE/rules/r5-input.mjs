// R5 输入：Mouse/Keyboard 轮询只允许出现在 inputrouter（sscore 里的统一路由器）。
export default {
  id: 'R5',
  level: 'E',
  title: '绕过输入路由',
  check(ctx) {
    const out = [];
    const re = /\b(?:org\.lwjgl\.input\.)?(Mouse|Keyboard)\s*\./g;
    for (const rel of ctx.byExt('.java')) {
      if (rel.includes('sscore/') && /inputrouter/i.test(rel)) continue;
      const lines = ctx.read(rel).split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) out.push({ file: rel, line: i + 1, msg: `直接轮询 ${m[1]}，改用 sscore/inputrouter` });
      }
    }
    return out;
  },
};
