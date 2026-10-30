#!/usr/bin/env node
/**
 * Script\wrapup.mjs：收尾一条龙：编译 → 闸门 → A 覆盖 → B/W 记录 → 交接单 → 备份。
 *
 * 用法：
 *   node Script\wrapup.mjs <mod目录> [--backup <目录>] [--tasks <目录>]
 *                          [--root <游戏根>] [--skip-compile] [--skip-verify]
 *                          [--skip-backup] [--dry-run] [--since <ISO>] [--legacy]
 *
 * 判据：编译 E=0、闸门 E=0、B 记录都有 - rule:/ - test:。任一条不过 → exit 1。
 * 它只收尾 mod 与记录，不打 skill 包。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('wrapup');
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan } from '../GATE/engine.mjs';
import { checkNotes, noteDirs } from '../GATE/records.mjs';
import { checkFacts } from './lib/facts.mjs';
import { resolveGameRoot } from './lib/sources.mjs';
import { checkStamp } from './lib/stamp.mjs';
import { readData, pathsOf, ensureWorkDirs } from './lib/work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function usage() {
  console.error('用法：node Script\\wrapup.mjs <mod目录> [--backup <目录>] [--tasks <目录>] [--root <游戏根>]');
  console.error('       [--skip-compile] [--skip-verify] [--skip-backup] [--dry-run] [--since <ISO>]');
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = {
  backup: null, tasks: null, root: null, skipCompile: false, skipVerify: false,
  skipBackup: false, dryRun: false, since: null, legacy: false, allowStale: false,
};
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--backup') opts.backup = args[++i];
  else if (a === '--tasks') opts.tasks = args[++i];
  else if (a === '--root') opts.root = args[++i];
  else if (a === '--since') opts.since = args[++i];
  else if (a === '--skip-compile') opts.skipCompile = true;
  else if (a === '--skip-verify') opts.skipVerify = true;
  else if (a === '--skip-backup') opts.skipBackup = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--legacy') opts.legacy = true;
  else if (a === '--allow-stale') opts.allowStale = true;
  else if (a === '-h' || a === '--help') usage();
  else if (!a.startsWith('--')) pos.push(a);
  else usage();
}
if (pos.length !== 1) usage();
const modDir = path.resolve(pos[0]);
if (!fs.existsSync(modDir)) {
  console.error('mod 目录不存在：' + modDir);
  process.exit(2);
}

// 绑定配置（<mods>\.work\config.json）与工作目录
const data = readData(ROOT) || {};
const paths = data.mod ? ensureWorkDirs(data) : null;
if (!paths && !opts.tasks) {
  console.error('未绑定 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>');
  process.exit(2);
}
const noteBase = paths ? paths.modWork : null;
const backup = path.resolve(opts.backup || (paths ? paths.backups : path.join(path.dirname(modDir), '.back')));
const tasksRoot = path.resolve(opts.tasks || (paths ? paths.tasks : path.join(ROOT, 'TASKS')));

const errors = [];
const warnings = [];
const say = (s) => console.log(s);

// ── 0. doctor 戳（交付闸门）─────────────────────────────
const stamp = checkStamp(ROOT);
if (!stamp.ok) {
  if (paths) {
    if (opts.allowStale) warnings.push(`doctor 戳无效（--allow-stale 放行）：${stamp.reason}`);
    else errors.push(`doctor 戳无效：${stamp.reason}（先跑 node Script\\doctor.mjs；确认放行加 --allow-stale）`);
  } else {
    warnings.push('未绑定 .work 配置，跳过 doctor 戳检查');
  }
}

// ── 1. 编译 ───────────────────────────────────────────────
say('[1/7] 编译（janino）');
if (opts.skipCompile) say('  跳过（--skip-compile）');
else if (opts.dryRun) say('  dry-run：将运行 Script\\compile.mjs');
else {
  const r = spawnSync(process.execPath, [path.join(HERE, 'compile.mjs'), modDir, ...(opts.root ? ['--root', opts.root] : [])], { stdio: 'inherit' });
  if (r.status !== 0) errors.push('编译未通过');
}

// ── 2. 闸门 ───────────────────────────────────────────────
say('[2/7] 闸门');
let verifyE = 0;
let verifyW = 0;
if (opts.skipVerify) say('  跳过（--skip-verify）');
else {
  try {
    let gameRoot = null;
    try {
      gameRoot = opts.root || resolveGameRoot().gameRoot;
    } catch {
      /* 没有 gameRoot 时资源检查降为 W */
    }
    const res = await scan(modDir, { gameRoot });
    const e = res.findings.filter((f) => f.level === 'E');
    const w = res.findings.filter((f) => f.level === 'W');
    verifyE = e.length;
    verifyW = w.length;
    say(`  E=${verifyE} W=${verifyW}`);
    if (verifyE) errors.push(`闸门 E=${verifyE}`);
    for (const f of e.slice(0, 10)) say(`  E ${f.file}:${f.line} ${f.msg}`);
  } catch (err) {
    errors.push('闸门报错：' + err.message);
  }
}

// ── 3. SPEC 的 A 覆盖 ─────────────────────────────────────
say('[3/7] A 覆盖');
function newestSpec(dir) {
  if (!fs.existsSync(dir)) return null;
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name, 'SPEC.md');
    if (fs.existsSync(p)) found.push({ file: p, dir: path.join(dir, e.name), m: fs.statSync(p).mtimeMs });
  }
  found.sort((a, b) => b.m - a.m);
  return found[0] || null;
}
const spec = newestSpec(tasksRoot);
let covered = 0;
let totalA = 0;
if (!spec) {
  warnings.push('没有 SPEC，A 覆盖跳过');
  say('  没有 SPEC（TASKS 下无 SPEC.md）');
} else {
  const text = fs.readFileSync(spec.file, 'utf8');
  if (!/^\s*approved:\s*sha256:/m.test(text)) {
    warnings.push('SPEC 未批准（缺 approved 行）');
    say('  SPEC 未批准：' + path.relative(ROOT, spec.file));
  }
  const aIds = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(A\d+)\s*\|/);
    if (m) aIds.push(m[1]);
  }
  totalA = aIds.length;
  // 测试语料：LIB\test 与 mod 源码里的 A 编号引用
  const corpus = [];
  const pushDir = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pushDir(p);
      else if (e.name.endsWith('.java')) corpus.push(fs.readFileSync(p, 'utf8'));
    }
  };
  pushDir(path.join(ROOT, 'LIB', 'test'));
  pushDir(path.join(modDir, 'data', 'scripts'));
  const hay = corpus.join('\n');
  const missing = [];
  for (const id of aIds) {
    if (new RegExp('\\b' + id + '\\b').test(hay)) covered++;
    else missing.push(id);
  }
  say(`  ${covered}/${totalA}（${path.relative(ROOT, spec.file)}）`);
  if (missing.length) warnings.push(`A 未覆盖：${missing.join(', ')}`);

  // 案例蒸馏提示（可选，不阻塞收尾）
  const distId = path.basename(spec.dir);
  const distillBase = paths ? paths.distill : path.join(ROOT, 'DISTILL');
  if (!fs.existsSync(path.join(distillBase, distId))) {
    const tip = `案例可蒸馏（可选）：node Script\\distill.mjs ${distId}`;
    warnings.push(tip);
    say(`  W ${tip}`);
  }
}

// ── 4. 事实表（M/L 车道）─────────────────────────────────
say('[4/7] 事实表');
let factsText = null;
if (spec) {
  const factsFile = path.join(spec.dir, 'FACTS.md');
  if (fs.existsSync(factsFile)) factsText = fs.readFileSync(factsFile, 'utf8');
}
const laneOfSpec = spec ? (fs.readFileSync(spec.file, 'utf8').match(/^\s*-\s*lane:\s*([SML])/m) || [])[1] || '' : '';
let factsGameRoot = null;
try { factsGameRoot = opts.root || resolveGameRoot().gameRoot; } catch { /* 没游戏目录就只校验 mod 证据 */ }
const facts = checkFacts({ text: factsText, modDir, gameRoot: factsGameRoot, lane: laneOfSpec, legacy: opts.legacy });
for (const f of facts.findings) {
  if (f.level === 'E') { errors.push(f.msg); say(`  E ${f.msg}`); }
  else { warnings.push(f.msg); say(`  W ${f.msg}`); }
}
say(`  车道 ${laneOfSpec || '—'}：${facts.rows.length} 条事实，${facts.refs.length} 个稳定引用`);

// ── 5. B/W 记录 ───────────────────────────────────────────
say('[5/7] 记录');
const rec = checkNotes(noteBase || backup, [modDir], { legacy: opts.legacy });
for (const f of rec.findings) {
  if (f.level === 'E') { errors.push(f.msg); say(`  E ${path.basename(f.file)}: ${f.msg}`); }
  else { warnings.push(f.msg); say(`  W ${path.basename(f.file)}: ${f.msg}`); }
}
say(`  B=${rec.bugs.length} W=${rec.works.length}（${noteDirs(noteBase || backup)?.bug || '—'}）`);

// ── 5. 改动清单与交接单 ───────────────────────────────────
say('[6/7] 交接单');
const stateFile = paths ? path.join(paths.note, '.wrapup.json') : path.join(backup, 'note', '.wrapup.json');
let lastRun = opts.since || null;
if (!lastRun && fs.existsSync(stateFile)) {
  try {
    lastRun = JSON.parse(fs.readFileSync(stateFile, 'utf8')).lastRun || null;
  } catch {
    /* 坏了就当第一次 */
  }
}
const sinceMs = lastRun ? Date.parse(lastRun) : 0;

function walkFiles(root, rel = '') {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(root, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (e.name === 'graphics' || e.name === 'sounds') continue;
      out.push(...walkFiles(p, r));
    } else {
      out.push({ abs: p, rel: r, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size });
    }
  }
  return out;
}
const modFiles = [{ abs: path.join(modDir, 'mod_info.json'), rel: 'mod_info.json', mtime: fs.existsSync(path.join(modDir, 'mod_info.json')) ? fs.statSync(path.join(modDir, 'mod_info.json')).mtimeMs : 0, size: 0 }]
  .concat(walkFiles(path.join(modDir, 'data')));
const changed = modFiles.filter((f) => f.mtime > sinceMs);

function readSpecTitle() {
  if (!spec) return path.basename(modDir);
  const first = fs.readFileSync(spec.file, 'utf8').split(/\r?\n/).find((l) => /^#\s+/.test(l)) || '';
  return first.replace(/^#\s+/, '').replace(/^SPEC[:：]?\s*/, '').trim() || path.basename(modDir);
}
function specRows() {
  if (!spec) return [];
  return fs.readFileSync(spec.file, 'utf8').split(/\r?\n/).filter((l) => /^\|\s*A\d+\s*\|/.test(l));
}
function rowCells(line) {
  return line.split('|').slice(1, -1).map((s) => s.trim());
}
const rows = specRows().map(rowCells);
const steps = rows.slice(0, 5).map((c, i) => `${i + 1}. ${c[1] || c[0]}（判据：${c[2] || c[3] || '见 SPEC'}）`);
const manual = rows.filter((c) => /MANUAL|人工/i.test(c.join(' '))).map((c) => `${c[0]} ${c[1] || ''}`);

const handoff = `# HANDOFF ${readSpecTitle()}

> 由 \`Script\\wrapup.mjs\` 生成于 ${new Date().toISOString()}。
> 这份文件只写“你要点哪几步、看到什么算过”，不重复 SPEC。

## 操作步骤（≤5）

${steps.length ? steps.join('\n') : (spec ? '1. SPEC 没有 A 表：按上面「改动文件」冒烟，重点看新增交互。' : '1. 没有 SPEC；按改动清单冒烟')}

## 预期结果

- 每条步骤按 SPEC 的判据看到对应文本/数值。
- 控制台/日志无红色报错；有异常就跑 \`node Script\\logscan.mjs\`。

## 未自动化（需要你点）

${manual.length ? manual.map((m) => '- ' + m).join('\n') : '- 无'}

## 改动文件（${changed.length}）

${changed.length ? changed.map((f) => `- \`${f.rel}\``).join('\n') : '- 无'}

## 验证命令

\`\`\`
node Script\\compile.mjs <mod>
node Script\\verify.mjs <mod>
node Script\\logscan.mjs
\`\`\`

## 回滚

备份在 \`${backup}\`；把 \`wrapup-*\` 里的同名文件覆盖回去即可。

## 备注

- 最近一次收尾：${lastRun || '（无，首次）'}
- 闸门：E=${verifyE} W=${verifyW}${spec ? '' : '；SPEC 缺失'}
`;

const handoffPath = path.join(spec ? spec.dir : modDir, 'HANDOFF.md');
if (opts.dryRun) say('  dry-run：将写 ' + handoffPath);
else {
  fs.writeFileSync(handoffPath, handoff, 'utf8');
  say('  写入 ' + path.relative(ROOT, handoffPath));
}

// ── 6. 备份 ───────────────────────────────────────────────
say('[7/7] 备份');
if (opts.skipBackup) say('  跳过（--skip-backup）');
else if (opts.dryRun) say(`  dry-run：将备份 ${changed.length} 个文件到 ${backup}`);
else { try {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const dir = path.join(backup, 'wrapup-' + stamp);
  for (const f of changed) {
    const dst = path.join(dir, 'files', f.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f.abs, dst);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    at: new Date().toISOString(), mod: modDir, files: changed.map((f) => ({ rel: f.rel, size: f.size })),
  }, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ lastRun: new Date().toISOString(), mod: modDir }, null, 2), 'utf8');
  say(`  ${changed.length} 个文件 → ${dir}`);
  } catch (e) { errors.push('备份失败：' + e.message); say('  备份失败：' + e.message); }
}

// ── 结论 ─────────────────────────────────────────────────
console.log('');
if (warnings.length) {
  console.log('提醒：');
  for (const w of warnings) console.log('  W ' + w);
}
if (errors.length) {
  console.log('结论：不通过');
  for (const e of errors) console.log('  E ' + e);
  process.exit(1);
}
console.log('结论：通过');
