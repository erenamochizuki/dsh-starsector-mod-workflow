// R7 数值要求：已批准的 SPEC 数值必须与 SpecConstants.java 一致。
import fs from 'node:fs';
import path from 'node:path';

function specValues(spec) {
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s*数值要求/.test(l.trim()));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^##\s/.test(l)) break;
    if (!l.startsWith('|')) continue;
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (/^[-: ]+$/.test(cells[0])) continue;
    if (/^(常量|名称|name)$/i.test(cells[0]) || cells[2] === '值') continue;
    out.push({ name: cells[0], type: cells[1], value: cells[2] });
  }
  return out;
}

function constMap(java) {
  const map = new Map();
  const re = /static\s+final\s+[\w<>[\]]+\s+(\w+)\s*=\s*([^;]+);/g;
  let m;
  while ((m = re.exec(java))) map.set(m[1], m[2].trim());
  return map;
}

function norm(v) {
  return String(v).trim().replace(/[fFdDlL]$/, '').replace(/^\((.*)\)$/, '$1').trim();
}

export default {
  id: 'R7',
  level: 'E',
  title: '数值要求不一致',
  check(ctx) {
    const out = [];
    const tasks = ctx.opts.tasks || path.join(ctx.skillRoot, 'TASKS');
    if (!fs.existsSync(tasks)) return out;
    for (const name of fs.readdirSync(tasks)) {
      const dir = path.join(tasks, name);
      const specPath = path.join(dir, 'SPEC.md');
      if (!fs.existsSync(specPath)) continue;
      const spec = fs.readFileSync(specPath, 'utf8');
      if (!/^approved:\s*sha256:[0-9a-f]{12}/m.test(spec)) continue;
      const constantsCandidates = [
        path.join(dir, 'SpecConstants.java'),
        path.join(ctx.modDir, 'data', 'scripts', 'spec', 'SpecConstants.java'),
      ];
      const cPath = constantsCandidates.find((p) => fs.existsSync(p));
      if (!cPath) {
        out.push({ file: `TASKS/${name}/SPEC.md`, line: 1, msg: '已批准但没有 SpecConstants.java' });
        continue;
      }
      const cm = constMap(fs.readFileSync(cPath, 'utf8'));
      for (const v of specValues(spec)) {
        if (!cm.has(v.name)) {
          out.push({ file: path.relative(ctx.modDir, cPath), line: 1, msg: `SpecConstants 缺 ${v.name}（SPEC 写 ${v.value}）` });
        } else if (norm(cm.get(v.name)) !== norm(v.value)) {
          out.push({ file: path.relative(ctx.modDir, cPath), line: 1, msg: `${v.name} 不一致：SPEC=${v.value} 常量=${cm.get(v.name)}` });
        }
      }
    }
    return out;
  },
};
