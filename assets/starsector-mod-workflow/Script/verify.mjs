// verify：闸门：跑 R1–R8 + S1–S3，按 baseline 只判新增/增长。
// 闸门入口：node Script\verify.mjs <mod目录> [--baseline|--rebaseline] [--tasks 目录] [--game 游戏根] [--json]
// 退出码：0 无 E（含基线内的存量债务）；1 有 E；2 用法错误。
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('verify');
import fs from 'node:fs';
import path from 'node:path';
import { scan, keyOf, baselinePath } from '../GATE/engine.mjs';
import { SKILL_ROOT } from './lib/sources.mjs';
import { warnStamp } from './lib/stamp.mjs';
import { readData, pathsOf } from './lib/work.mjs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const opt = new Map();
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) opt.set(argv[i].slice(2), argv[i + 1]);
}

const mod = positional[0];
if (!mod) {
  console.error('用法：node Script\\verify.mjs <mod目录> [--baseline|--rebaseline] [--tasks 目录] [--game 游戏根] [--json]');
  process.exit(2);
}
if (!fs.existsSync(mod)) {
  console.error(`目录不存在：${mod}`);
  process.exit(2);
}

const wantBaseline = flags.has('--baseline') || flags.has('--rebaseline');
const data = readData(SKILL_ROOT);
const paths = pathsOf(data);
const scanOpts = {
  tasks: opt.get('tasks') || (paths ? paths.tasks : null),
  gameRoot: opt.get('game') || (data ? data.gameRoot : null),
  scanSkillDocs: flags.has('--skill-docs'),
  rebaseline: wantBaseline,
};
let result = await scan(mod, scanOpts);

if (wantBaseline) {
  const bp = baselinePath(mod);
  fs.mkdirSync(path.dirname(bp), { recursive: true });
  const keys = {};
  for (const f of result.findings) keys[keyOf(f.rule, f)] = (keys[keyOf(f.rule, f)] || 0) + 1;
  fs.writeFileSync(bp, JSON.stringify({ mod: path.resolve(mod), createdAt: new Date().toISOString(), keys }, null, 2) + '\n', 'utf8');
  console.log(`已写基线：${bp}（${Object.keys(keys).length} 条存量）`);
  result = await scan(mod, { ...scanOpts, rebaseline: false });
}

const findings = result.findings;
if (flags.has('--json')) {
  console.log(JSON.stringify({ mod: path.resolve(mod), findings }, null, 2));
} else {
  const order = ['E', 'W'];
  findings.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file));
  for (const f of findings) {
    const mark = f.level === 'E' ? 'E' : 'W';
    const debt = f.debt ? '（存量）' : '';
    console.log(`${mark} ${f.rule} ${f.file}:${f.line || 1} ${f.msg}${debt}`);
  }
  const e = findings.filter((f) => f.level === 'E').length;
  const w = findings.filter((f) => f.level === 'W').length;
  const rules = [...new Set(findings.map((f) => f.rule))].sort().join(' ') || '—';
  console.log(`\n规则命中：${rules}`);
  console.log(`E=${e} W=${w}  基线：${wantBaseline ? '已重建' : result.baseline ? '生效' : '无'}`);
  console.log(e ? '结论：不通过' : '结论：通过');
}

if (!flags.has('--json')) warnStamp(SKILL_ROOT, '闸门缺 doctor 戳');
process.exit(findings.some((f) => f.level === 'E') ? 1 : 0);
