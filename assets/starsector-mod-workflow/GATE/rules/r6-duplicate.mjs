// R6 重复实现：同一 mod 里出现第二份滑块/列表/输入实现，修一处漏一处。
export default {
  id: 'R6',
  level: 'E',
  title: '重复实现',
  check(ctx) {
    const out = [];
    const declRe = /\b(?:class|interface)\s+(\w+)/;
    const groups = new Map();
    const wheel = [];
    const drag = [];
    for (const rel of ctx.byExt('.java')) {
      if (rel.includes('sscore/')) continue;
      const text = ctx.read(rel);
      const m = declRe.exec(text);
      if (m && /(Slider|ListPanel|ListView|InputRouter|HitMap|ScrollableList|ScrollList)/i.test(m[1])) {
        if (!groups.has(m[1])) groups.set(m[1], []);
        groups.get(m[1]).push(rel);
      }
      if (/getDWheel\s*\(/.test(text)) wheel.push(rel);
      if (/isButtonDown\s*\(/.test(text) && /\bwasDown\b/.test(text)) drag.push(rel);
    }
    for (const [name, files] of groups) {
      if (files.length > 1) {
        for (const f of files.slice(1)) out.push({ file: f, line: 1, msg: `重复实现 ${name}（另一份：${files[0]}），改用 sscore 积木` });
      }
    }
    if (wheel.length > 1) {
      for (const f of wheel.slice(1)) out.push({ file: f, line: 1, msg: `第二套滚轮/滑块实现（另一份：${wheel[0]}），改用 sscore/slider` });
    }
    if (drag.length > 1) {
      for (const f of drag.slice(1)) out.push({ file: f, line: 1, msg: `第二套手写拖拽（另一份：${drag[0]}），改用 sscore/inputrouter` });
    }
    return out;
  },
};
