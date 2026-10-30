// R8 死链：skill 与 mod 文档里的相对链接必须指向存在的文件。
import fs from 'node:fs';
import path from 'node:path';

const DOCS = ['INDEX.md', 'SKILL.md', 'WORKFLOW.md', 'FACTS.md'];

export default {
  id: 'R8',
  level: 'E',
  title: '文档死链',
  check(ctx) {
    const out = [];
    const targets = [];
    if (ctx.opts.scanSkillDocs) {
      for (const d of DOCS) {
        const abs = path.join(ctx.skillRoot, d);
        if (fs.existsSync(abs)) targets.push({ abs });
      }
      const refDir = path.join(ctx.skillRoot, 'REF');
      for (const ref of fs.existsSync(refDir) ? fs.readdirSync(refDir) : []) {
        if (ref.endsWith('.md')) targets.push({ abs: path.join(refDir, ref) });
      }
    }
    for (const rel of ctx.byExt('.md')) {
      if (rel.startsWith('HANDOFF')) targets.push({ abs: path.join(ctx.modDir, rel) });
    }
    for (const t of targets) {
      const text = fs.readFileSync(t.abs, 'utf8');
      const baseDir = path.dirname(t.abs);
      const re = /\[[^\]]*\]\(([^)]+)\)/g;
      let m;
      while ((m = re.exec(text))) {
        let target = m[1].trim();
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        target = target.split('#')[0];
        if (!target) continue;
        const resolved = path.resolve(baseDir, target);
        if (!fs.existsSync(resolved)) {
          const line = text.slice(0, m.index).split(/\r?\n/).length;
          out.push({ file: path.relative(ctx.skillRoot, t.abs).replace(/\\/g, '/'), line, msg: `死链：${target}` });
        }
      }
    }
    return out;
  },
};
