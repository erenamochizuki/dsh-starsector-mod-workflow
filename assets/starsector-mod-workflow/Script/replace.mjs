#!/usr/bin/env node
/**
 * Script\replace.mjs：把旧 skill 目录替换成当前构建。
 *
 * 顺序：归档旧目录 → 列出非框架文件 → 清空 → 放入新目录 → 跑 doctor。
 * 不做“安装器”：路径由 --target 指定；回滚就是把归档目录原样放回。
 *
 * 用法：
 *   node Script\replace.mjs --target <旧skill目录> [--from <新构建目录>]
 *                          [--backup <归档根>] [--dry-run] [--force]
 *
 * 退出码：0 替换成功；1 失败；2 用法错误。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('replace');
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF_ROOT = path.resolve(HERE, '..');

function usage() {
  console.error('用法：node Script\\replace.mjs --target <旧skill目录> [--from <新构建目录>] [--backup <归档根>] [--dry-run] [--force]');
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = { target: null, from: SELF_ROOT, backup: null, dryRun: false, force: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--target') opts.target = args[++i];
  else if (a === '--from') opts.from = path.resolve(args[++i]);
  else if (a === '--backup') opts.backup = path.resolve(args[++i]);
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--force') opts.force = true;
  else if (a === '-h' || a === '--help') usage();
  else usage();
}
if (!opts.target) usage();
const target = path.resolve(opts.target);
if (!fs.existsSync(target)) {
  console.error('目标目录不存在：' + target);
  process.exit(2);
}
if (path.resolve(target) === path.resolve(opts.from)) {
  console.error('目标与源是同一个目录，拒绝替换：' + target);
  process.exit(2);
}
if (!fs.existsSync(path.join(opts.from, 'META.json'))) {
  console.error('源目录不像新构建（缺 META.json）：' + opts.from);
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const archiveRoot = opts.backup || path.join(path.dirname(target), '.skill-archive');
const archiveDir = path.join(archiveRoot, path.basename(target) + '-' + stamp);

/** 框架自带名字；不在表里的就是用户自己放的东西。 */
const FRAMEWORK = new Set([
  'API', 'CASES', 'CHECK', 'DB', 'GATE', 'KIT', 'LIB', 'REF', 'Script', 'Skill', 'TPL', 'VERIFY',
  'SKILL.md', 'WORKFLOW.md', 'SS_WORKFLOW.md', 'SS_INDEX.md', 'INDEX.md', 'META.json', 'FACTS.md',
  'CHANGELOG.md', 'UPGRADE.md', 'README.md', 'data.json', 'manifest.json', 'install.mjs',
]);
const extras = fs.readdirSync(target).filter((n) => !FRAMEWORK.has(n) && !n.startsWith('.'));

function detectLegacy(dir) {
  const has = (n) => fs.existsSync(path.join(dir, n));
  let version = '未知';
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'META.json'), 'utf8'));
    version = m.version || version;
  } catch {
    /* 没有 META.json 再看旧 manifest */
  }
  if (has('manifest.json') || has('SS_INDEX.md') || has('Skill') || has('SS_WORKFLOW.md')) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      version = m.version || version;
    } catch {
      /* 没有 manifest 就按结构判断 */
    }
    return { legacy: true, version };
  }
  return { legacy: false, version };
}

const legacy = detectLegacy(target);
console.log(`目标：${target}`);
console.log(`检测：${legacy.legacy ? '旧版结构（v' + legacy.version + '）' : '新版结构（v' + legacy.version + '）'}`);
if (extras.length) {
  console.log(`非框架文件（${extras.length}，会一起归档）：`);
  for (const n of extras) console.log('  - ' + n);
} else {
  console.log('非框架文件：无');
}

if (!legacy.legacy && !opts.force) {
  console.error('目标没有旧版标记。确认要覆盖就加 --force。');
  process.exit(1);
}

// 先读绑定：清空后就读不到了
let oldBindings = null;
try {
  oldBindings = JSON.parse(fs.readFileSync(path.join(target, 'data.json'), 'utf8'));
} catch {
  oldBindings = null;
}

console.log(`归档：${archiveDir}`);
console.log(`清空：${target}`);
console.log(`放入：${opts.from}`);
if (opts.dryRun) {
  console.log('dry-run：未做任何改动。');
  process.exit(0);
}

// 1. 归档（整目录原样拷贝，跳过运行期缓存 .work）
fs.mkdirSync(archiveDir, { recursive: true });
fs.cpSync(target, archiveDir, {
  recursive: true,
  force: true,
  filter: (src) => !src.split(path.sep).includes('.work'),
});
fs.writeFileSync(path.join(archiveDir, 'archive.json'), JSON.stringify({
  at: new Date().toISOString(), source: target, version: legacy.version, legacy: legacy.legacy, extras,
}, null, 2), 'utf8');

// 2. 清空（只删顶层内容）
for (const n of fs.readdirSync(target)) {
  fs.rmSync(path.join(target, n), { recursive: true, force: true });
}

// 3. 放入新构建（跳过运行期目录与绑定）
const SKIP = new Set(['data.json', 'TASKS', 'HARVEST', 'DISTILL', 'dist', '.pack-tmp', 'node_modules', '.work', '.back']);
for (const n of fs.readdirSync(opts.from)) {
  if (SKIP.has(n) || n.startsWith('_') || n.startsWith('.')) continue;
  fs.cpSync(path.join(opts.from, n), path.join(target, n), { recursive: true, force: true });
}

// 4. 绑定不在 skill 目录：配置在 <mods>\.work\config.json，替换不会碰它
if (oldBindings) {
  console.log('绑定：旧 data.json 已随归档保留；新绑定在 <mods>\\.work\\config.json，替换不影响');
} else {
  console.log('绑定：未发现旧 data.json；如未绑定，运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>');
}

// 5. 自检（INDEX 依赖目录内容，先按目标目录重建，避免带进源目录的任务/案例条目）
const gi = spawnSync(process.execPath, [path.join(target, 'Script', 'gen-index.mjs'), '--root', target], { stdio: 'inherit' });
if (gi.status !== 0) console.warn('警告：目标目录的 INDEX.md 重建失败，请手动跑 node Script\\gen-index.mjs');
const doc = spawnSync(process.execPath, [path.join(target, 'Script', 'doctor.mjs')], { stdio: 'inherit' });
if (doc.status !== 0) {
  console.error('替换后 doctor 未通过；回滚：把 ' + archiveDir + ' 的内容放回 ' + target);
  process.exit(1);
}
console.log('');
console.log('替换完成。回滚：把归档目录内容原样放回目标目录。');
console.log('提醒：新开对话才会加载新的 SKILL.md。');
process.exit(0);
