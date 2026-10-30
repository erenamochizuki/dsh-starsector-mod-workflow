// S3 语义清单（W）：Serializable 类没有显式无参构造，读档时可能反序列化失败。
export default {
  id: 'S3',
  level: 'W',
  title: '可序列化类缺无参构造',
  check(ctx) {
    const out = [];
    for (const rel of ctx.byExt('.java')) {
      const text = ctx.read(rel);
      const m = /\bclass\s+(\w+)[^{]*implements[^{]*\bSerializable\b/.exec(text);
      if (!m) continue;
      const re = new RegExp(`(?:public|protected|private)?\\s*${m[1]}\\s*\\(\\s*\\)`);
      if (!re.test(text)) {
        out.push({ file: rel, line: 1, msg: `${m[1]} 实现 Serializable 但没有无参构造` });
      }
    }
    return out;
  },
};
