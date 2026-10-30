#!/usr/bin/env node
/**
 * Script\mod-test.mjs：mod 侧 L3 行为测试（JDK 直跑，不启动游戏）。
 *
 * 做法：用 javac 编 VERIFY\test\*.java + mod 的 -sourcepath（只带纯逻辑类），
 * 再用 java 跑每个测试类的 main。测试类约定：无包、有 main、自己打印通过/失败。
 *
 * 用法：node Script\mod-test.mjs <mod目录> [--test-dir <目录>] [--src <文件>]... [--keep]
 * 退出码：0 全过；1 编译或测试失败；2 用法/环境问题。
 *
 * 注意：非 ASCII 的 mod 目录下 javac 的 -sourcepath 隐式编译不可靠，
 * 所以测试要用的 mod 纯逻辑类用 --src 显式传进来。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('mod-test');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGameRoot } from './lib/sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TESTS = path.join(HERE, '..', 'VERIFY', 'test');

const args = process.argv.slice(2);
let modDir = null;
let testsDir = DEFAULT_TESTS;
let keep = false;
const srcFiles = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--test-dir') testsDir = path.resolve(args[++i]);
  else if (args[i] === '--src') srcFiles.push(path.resolve(args[++i]));
  else if (args[i] === '--keep') keep = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.error('用法：node Script\\mod-test.mjs <mod目录> [--test-dir <目录>] [--src <文件>]... [--keep]');
    process.exit(2);
  } else if (!modDir) modDir = path.resolve(args[i]);
  else {
    console.error('多余参数：' + args[i]);
    process.exit(2);
  }
}
if (!modDir || !fs.existsSync(modDir)) {
  console.error('mod 目录不存在：' + (modDir || '(空)'));
  process.exit(2);
}
if (!fs.existsSync(testsDir)) {
  console.error('测试目录不存在：' + testsDir);
  process.exit(2);
}

const { gameRoot } = resolveGameRoot(modDir);
const core = path.join(gameRoot, 'starsector-core');
if (!fs.existsSync(core)) {
  console.error('找不到 starsector-core：' + core);
  process.exit(2);
}
const tests = fs.readdirSync(testsDir).filter((n) => n.endsWith('.java'));
if (!tests.length) {
  console.error('测试目录里没有 .java：' + testsDir);
  process.exit(2);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mod-test-'));
const cp = path.join(core, '*');
const javacArgs = ['-encoding', 'UTF-8', '-cp', cp, '-sourcepath', modDir, '-d', out];
if (srcFiles.length) javacArgs.push(...srcFiles);
javacArgs.push(...tests.map((n) => path.join(testsDir, n)));
const javac = spawnSync('javac', javacArgs, { stdio: 'inherit' });
if (javac.status !== 0) {
  console.error('测试编译失败');
  console.error(`  源码根：${modDir}（-sourcepath 指向包含 data/ 的目录）`);
  console.error('  若报「程序包 X 不存在」：用 --src 显式列出该包下被引用的 .java（非 ASCII 路径下隐式编译不可靠）');
  process.exit(1);
}

let failed = 0;
for (const n of tests) {
  const cls = n.replace(/\.java$/, '');
  console.log(`运行 ${cls}`);
  const run = spawnSync('java', ['-Dfile.encoding=UTF-8', '-cp', out + path.delimiter + cp, cls], { stdio: 'inherit' });
  if (run.status !== 0) failed++;
}
if (!keep) fs.rmSync(out, { recursive: true, force: true });
console.log(`mod 测试：${tests.length - failed} / ${tests.length} 个类通过`);
process.exit(failed ? 1 : 0);
