#!/usr/bin/env node
/**
 * Script\note.mjs：写一条 B（错误）或 W（完工）记录，先查重。
 *
 * 落在 <mods>\.work\<mod>\note\{bug,work}\：
 *   node Script\note.mjs bug  "标题" [--force]
 *   node Script\note.mjs work "标题" [--force]
 *
 * 为什么强制：同类错误第二次出现时，如果不落成规则或测试，第三次一定还会犯。
 * 记录里的 `- rule:` / `- test:` 由 wrapup 检查，缺失会拒绝收尾。
 *
 * 退出码：0 写入；2 疑似重复；1 参数/环境错误。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('note');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteDirs, listNotes, nextId, findSimilar, noteTemplate } from '../GATE/records.mjs';
import { readData, pathsOf, ensureWorkDirs } from './lib/work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function usage() {
  console.error('用法：node Script\\note.mjs <bug|work> "标题" [--force]');
  process.exit(2);
}

const args = process.argv.slice(2);
const pos = [];
let force = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--force') force = true;
  else if (args[i] === '-h' || args[i] === '--help') usage();
  else if (args[i].startsWith('--')) usage();
  else pos.push(args[i]);
}
if (pos.length < 2) usage();
const kind = pos[0];
if (kind !== 'bug' && kind !== 'work') usage();
const title = pos.slice(1).join(' ').trim();
if (!title) usage();

const data = readData(ROOT);
const paths = data ? ensureWorkDirs(data) : null;
if (!paths) {
  console.error('未绑定 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>');
  process.exit(1);
}

const dirs = noteDirs(paths.modWork);
const target = dirs[kind];
fs.mkdirSync(target, { recursive: true });

const existing = listNotes(target, kind);
const similar = findSimilar(title, existing);
if (similar.length && !force) {
  console.error('疑似重复，先看这些：');
  for (const s of similar) console.error(`  - ${path.basename(s.file)}  ${s.title}`);
  console.error('确认是新问题就加 --force。');
  process.exit(2);
}

const prefix = kind === 'bug' ? 'B' : 'W';
const id = nextId(target, prefix);
const file = path.join(target, id + '.md');
if (fs.existsSync(file)) {
  console.error('编号冲突：' + file);
  process.exit(1);
}
fs.writeFileSync(file, noteTemplate(id, kind, title), 'utf8');
console.log('已写入：' + file);
console.log('下一步：填现象/根因，并给出 - rule: 或 - test:（wrapup 会检查）。');
