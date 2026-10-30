#!/usr/bin/env node
/**
 * wrapup-selftest：验证收尾判据：缺 `- rule:` 的 B 记录必须被拒绝。
 *
 * 造一个临时 mod + SPEC + B 记录：
 *   1. B001 没 rule → wrapup 必须 exit 1，且原因里点名 B001。
 *   2. 补上 rule → wrapup exit 0，产出 HANDOFF.md 与备份 manifest。
 * 只测 wrapup 自己的判断，跳过编译与闸门（--skip-compile --skip-verify）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TMP = path.join(ROOT, '..', '_t08_selftest');

let failed = 0;
const ok = (name) => console.log('  ok   ' + name);
const bad = (name, why) => { failed++; console.log('  FAIL ' + name + (why ? ' — ' + why : '')); };

fs.rmSync(TMP, { recursive: true, force: true });
const mod = path.join(TMP, 'mod');
const backup = path.join(TMP, 'back');
const tasks = path.join(TMP, 'TASKS');
const specDir = path.join(tasks, 'demo');
for (const d of [path.join(mod, 'data', 'scripts', 'ok'), path.join(backup, 'note', 'bug'), specDir]) {
  fs.mkdirSync(d, { recursive: true });
}
fs.writeFileSync(path.join(mod, 'mod_info.json'), JSON.stringify({ id: 't08demo', name: 't08', version: '0.1' }, null, 2));
fs.writeFileSync(path.join(mod, 'data', 'scripts', 'ok', 'X.java'), 'package data.scripts.ok;\n\n/** A1 的落点。 */\npublic class X {}\n');

// SPEC：A 表 + 一个真审批哈希（算法同 Script\spec.mjs）
const specBody = `# SPEC demo

## 数值要求

| 名称 | 值 | 含义 |
|---|---|---|
| MAX | 3 | 上限 |

## 验收

| 编号 | 判据 | 自动化 |
|---|---|---|
| A1 | 点击后计数 +1 | L3 |

`;
const base = specBody + '## 审批\n\n';
const hash = crypto.createHash('sha256').update(base, 'utf8').digest('hex').slice(0, 12);
fs.writeFileSync(path.join(specDir, 'SPEC.md'), base + `approved: sha256:${hash} 2026-10-22T00:00:00Z selftest\n`, 'utf8');

// B001：缺 rule
const b1 = path.join(backup, 'note', 'bug', 'B001.md');
fs.writeFileSync(b1, '# B001 测试记录\n\n- 日期：2026-10-22\n\n## 现象\n\n## 根因\n\n## 修复\n', 'utf8');

function run() {
  return spawnSync(process.execPath, [path.join(HERE, 'wrapup.mjs'), mod, '--backup', backup, '--tasks', tasks, '--skip-compile', '--skip-verify'], { stdio: 'inherit' }).status;
}

console.log('1) 缺 - rule: 的 B 记录：');
const s1 = run();
if (s1 === 1) ok('wrapup 拒绝（exit 1）'); else bad('wrapup 拒绝', 'exit=' + s1);

console.log('2) 补上 - rule: 后：');
fs.appendFileSync(b1, '\n- rule: GATE\\rules\\r6-duplicate.mjs\n');
const s2 = run();
if (s2 === 0) ok('wrapup 通过（exit 0）'); else bad('wrapup 通过', 'exit=' + s2);
if (fs.existsSync(path.join(specDir, 'HANDOFF.md'))) ok('HANDOFF.md 已生成'); else bad('HANDOFF.md');
const backups = fs.existsSync(backup) ? fs.readdirSync(backup).filter((n) => n.startsWith('wrapup-')) : [];
if (backups.length && fs.existsSync(path.join(backup, backups[0], 'manifest.json'))) ok('备份 manifest 存在');
else bad('备份 manifest');

console.log(failed ? `\n收尾自检：失败 ${failed}` : '\n收尾自检：全部通过');
process.exit(failed ? 1 : 0);
