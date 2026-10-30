#!/usr/bin/env node
/**
 * lib-test：编译并运行 LIB 积木的单元测试（javac/java，零依赖）。
 * 用法：node Script\lib-test.mjs [--keep]
 * 退出码：0 测试通过；1 编译失败、越界依赖或测试失败。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('lib-test');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGameRoot } from './lib/sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'LIB', 'sscore');
const TEST = path.join(ROOT, 'LIB', 'test');
const keep = process.argv.includes('--keep');

function javaFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.java')).sort().map((f) => path.join(dir, f));
}

const sources = [...javaFiles(SRC), ...javaFiles(TEST)];
if (!sources.length) {
  console.error('没有找到 LIB 源码：' + SRC);
  process.exit(1);
}

// 边界检查：积木层不许碰游戏 API，否则无法 javac 单测、也无法进预览。
let boundary = 0;
for (const f of javaFiles(SRC)) {
  const text = fs.readFileSync(f, 'utf8');
  const m = /com\.fs\.|\bimport\s+org\.lwjgl\b/.exec(text);
  if (m) {
    boundary++;
    console.error(`越界依赖 ${path.relative(ROOT, f)}: ${m[0]}（LIB 必须是纯 Java）`);
  }
}
if (boundary) process.exit(1);

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sscore-test-'));
// 用 inherit 而不是管道：受限环境下 Node 抓子进程输出会 EPERM，直接继承控制台最稳。
const javac = spawnSync('javac', ['-encoding', 'UTF-8', '-d', out, ...sources], { stdio: 'inherit' });
if (javac.status !== 0) {
  console.error('javac 失败（退出码 ' + javac.status + '，错误见上）');
  process.exit(1);
}

const run = spawnSync('java', ['-Dfile.encoding=UTF-8', '-cp', out, 'sscore.T'], { stdio: 'inherit' });
if (!keep) fs.rmSync(out, { recursive: true, force: true });
else console.log('class 输出保留在：' + out);
if (run.status !== 0) process.exit(1);

// javac 能过不代表 janino 能过（实机用 janino 2.7.8）。这一步专门抓泛型擦除之类的差异。
console.log('janino 兼容性：');
let bound = true;
try {
  resolveGameRoot();
} catch {
  bound = false;
}
if (!bound) {
  console.log('跳过：找不到 starfarer.api.zip，先 doctor --game <游戏根> --mod <mod 目录> 完成绑定');
  process.exit(0);
}
const janino = spawnSync(process.execPath, [path.join(HERE, 'compile.mjs'), '--lib-only'], { stdio: 'inherit' });
process.exit(janino.status === 0 ? 0 : 1);
