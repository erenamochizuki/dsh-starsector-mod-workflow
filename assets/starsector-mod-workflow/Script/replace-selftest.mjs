#!/usr/bin/env node
/**
 * Script\replace-selftest.mjs：替换流程自检。
 *
 * 造一个 0.4.x 形状的旧目录（旧标记 + data.json + 用户文件），
 * 跑 replace.mjs，断言：归档完整、旧目录清空、新构建就位、绑定保留、非框架文件进归档。
 * 然后回滚（把归档放回），断言旧文件回来了。
 *
 * 退出码：0 通过；1 失败。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'replace-selftest-'));
const INSTALL = path.join(ROOT, 'install');
const BACKUP = path.join(ROOT, 'archive');
let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
};

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

console.log('替换自检：' + ROOT);

// 旧目录
write(path.join(INSTALL, 'SKILL.md'), '# 旧技能');
write(path.join(INSTALL, 'SS_INDEX.md'), '旧索引');
write(path.join(INSTALL, 'Skill', 'ui-fx.md'), '旧文档');
write(path.join(INSTALL, 'data.json'), JSON.stringify({ gameRoot: 'C:\\mods\\demo', mod: '测试mod', backupDir: 'C:\\mods\\demo\\mods\\.back' }));
write(path.join(INSTALL, '我的笔记.txt'), '别删我');

const run = spawnSync(process.execPath, [path.join(SKILL, 'Script', 'replace.mjs'),
  '--target', INSTALL, '--backup', BACKUP, '--from', SKILL], { stdio: 'inherit' });

ok(run.status === 0, 'replace 退出 0', 'status=' + run.status);
const archives = fs.existsSync(BACKUP)
  ? fs.readdirSync(BACKUP).filter((n) => n.startsWith('install-')).map((n) => path.join(BACKUP, n))
  : [];
ok(archives.length === 1, '归档目录存在', String(archives[0] || ''));
const A = archives[0] || '';
ok(fs.existsSync(path.join(A, 'SKILL.md')), '归档里有旧 SKILL.md');
ok(fs.existsSync(path.join(A, '我的笔记.txt')), '归档里有用户文件');
ok(fs.existsSync(path.join(A, 'archive.json')), '归档有 archive.json');

ok(fs.existsSync(path.join(INSTALL, 'META.json')), '新构建已就位（META.json）');
ok(!fs.existsSync(path.join(INSTALL, 'SS_INDEX.md')), '旧文件已清空');
ok(!fs.existsSync(path.join(INSTALL, 'data.json')), '旧 data.json 不留在安装目录（绑定在 <mods>\\.work）');

// 回滚：清空后放回归档
for (const n of fs.readdirSync(INSTALL)) fs.rmSync(path.join(INSTALL, n), { recursive: true, force: true });
fs.cpSync(A, INSTALL, { recursive: true, force: true });
ok(fs.existsSync(path.join(INSTALL, 'SS_INDEX.md')) && fs.existsSync(path.join(INSTALL, '我的笔记.txt')), '回滚后旧文件与用户文件都回来了');
ok(!fs.existsSync(path.join(INSTALL, 'META.json')), '回滚后新构建不在');

console.log('');
console.log(failed ? `替换自检：失败 ${failed}` : '替换自检：通过');
process.exit(failed ? 1 : 0);
