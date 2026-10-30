// S1 语义清单（W）：processInput 里读事件前不判 isConsumed()，被消费的事件会抛异常。
export default {
  id: 'S1',
  level: 'W',
  title: '事件未判 isConsumed',
  check(ctx) {
    const out = [];
    for (const rel of ctx.byExt('.java')) {
      const text = ctx.read(rel);
      if (!/void\s+processInput\s*\(/.test(text)) continue;
      if (/isConsumed\s*\(/.test(text)) continue;
      out.push({ file: rel, line: 1, msg: 'processInput 未判 isConsumed()（API 源码：访问已消费事件会抛异常）' });
    }
    return out;
  },
};
