// clean：只删 .work 下本工具产物（compile-*/preview-*/probe-*/tmp-*/*.class），白名单之外不碰。
// 用法：node Script\clean.mjs [--keep N] [--dry-run] [--mod <目录>]
// 默认保留最近 3 份；cache/ 与受保护目录一律不删。
'use strict';

import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('clean');
import fs from 'node:fs';
import path from 'node:path';
import { readData, workDirOf } from './lib/work.mjs';
import { SKILL_ROOT } from './lib/sources.mjs';

const PROTECT = new Set(['.back', 'TASKS', 'HARVEST', 'dist', '.git', 'cache', 'node_modules']);
const WHITELIST = [/^(compile|preview|probe|tmp)-/i, /\.class$/i];

const argv = process.argv.slice(2);
let keep = 3;
let dry = false;
let modArg = '';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--keep') keep = Math.max(0, parseInt(argv[++i], 10) || 0);
  else if (a === '--dry-run') dry = true;
  else if (a === '--mod') modArg = argv[++i] || '';
  else if (a === '-h' || a === '--help') {
    console.log('用法：node Script\\clean.mjs [--keep N] [--dry-run] [--mod <目录>]');
    process.exit(0);
  } else {
    console.error('未知参数：' + a);
    process.exit(2);
  }
}

const data = readData(SKILL_ROOT) || {};
const modDir = modArg || data.mod || '';
if (!modDir) {
  console.error('ERR 未绑定目标 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>，或用 --mod 指定。');
  process.exit(2);
}
if (!fs.existsSync(modDir)) {
  console.error('ERR mod 目录不存在：' + modDir);
  process.exit(2);
}

const work = workDirOf(modDir, data);
if (!fs.existsSync(work)) {
  console.log(`没有工作目录：${work}（没生成过临时产物）`);
  process.exit(0);
}

const entries = [];
for (const name of fs.readdirSync(work)) {
  if (PROTECT.has(name)) continue;
  const abs = path.join(work, name);
  const st = fs.statSync(abs);
  // 目录只清本工具的 tmp-*/compile-* 等；cache 与其它目录一律不碰。
  if (st.isDirectory() && !/^(compile|preview|probe|tmp)-/i.test(name)) continue;
  if (!WHITELIST.some((re) => re.test(name))) continue;
  entries.push({ name, abs, mtime: st.mtimeMs });
}

entries.sort((a, b) => b.mtime - a.mtime);
const doomed = entries.slice(keep);

if (!doomed.length) {
  console.log(`工作目录：${work}`);
  console.log(`可清理 ${entries.length} 份，保留 ${entries.length} 份（--keep ${keep}），无需清理。`);
  process.exit(0);
}

console.log(`工作目录：${work}`);
console.log(`${dry ? '将删除' : '删除'} ${doomed.length} 份（保留最近 ${keep} 份）：`);
for (const e of doomed) {
  console.log(`  ${dry ? '·' : '-'} ${e.name}`);
  if (!dry) {
    try {
      fs.rmSync(e.abs, { recursive: true, force: true });
    } catch (err) {
      console.error(`  ! 删除失败：${e.name}：${err.message}`);
    }
  }
}
console.log(dry ? '（--dry-run，未改动）' : '清理完成。');
process.exit(0);
