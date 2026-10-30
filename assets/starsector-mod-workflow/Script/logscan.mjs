#!/usr/bin/env node
/**
 * Script\logscan.mjs：把游戏日志里的栈帧归因到 mod 的 文件:行。
 *
 * 用法：
 *   node Script\logscan.mjs [日志] [--mod <mod目录>] [--top N] [--json]
 *
 * 默认日志：<游戏根>\starsector.log；默认 mod 取 .work 配置的 mod 字段。
 * 只认 data.scripts.* 之类的 mod 栈帧；其它帧分组计数后略过。
 *
 * 退出码：0 扫完；2 参数错误。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('logscan');
import fs from 'node:fs';
import path from 'node:path';
import { readData } from './lib/work.mjs';
import { fileURLToPath } from 'node:url';
import { resolveGameRoot } from './lib/sources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const args = process.argv.slice(2);
const opts = { mod: null, top: 20, json: false };
let logArg = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mod') opts.mod = args[++i];
  else if (a === '--top') opts.top = Number(args[++i]) || 20;
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') { console.error('用法：node Script\\logscan.mjs [日志] [--mod <目录>] [--top N] [--json]'); process.exit(0); }
  else if (a.startsWith('--')) { console.error('未知参数：' + a); process.exit(2); }
  else logArg = a;
}

// mod 目录：参数 > .work 配置
let modDir = opts.mod;
if (!modDir) {
  const d = readData(ROOT);
  modDir = d && d.mod ? d.mod : null;
}
if (!modDir) {
  console.error('不知道 mod 目录：加 --mod，或先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>。');
  process.exit(2);
}

// 日志路径
let logFile = logArg;
if (!logFile) {
  try {
    logFile = path.join(resolveGameRoot().gameRoot, 'starsector.log');
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
if (!fs.existsSync(logFile)) {
  console.error('日志不存在：' + logFile);
  process.exit(2);
}

// 类名 → 源文件（只收 mod 目录下的 .java）
const classFiles = new Map();
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.java')) classFiles.set(e.name.slice(0, -5), p);
  }
}
walk(path.join(modDir, 'data', 'scripts'));

const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
const frames = [];
const seen = new Map();

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\s*at\s+([\w.$]+)\.([\w$<>]+)\(([\w$]+)\.java:(\d+)\)/);
  if (!m) continue;
  const [, cls, method, fileBase, lineNo] = m;
  const simple = fileBase.replace(/\$.*$/, '');
  const src = classFiles.get(simple) || classFiles.get(fileBase);
  if (!src) continue;
  const abs = path.join(modDir, 'data', 'scripts', path.relative(path.join(modDir, 'data', 'scripts'), src));
  const key = `${src}:${lineNo}|${method}`;
  const seenRec = seen.get(key);
  if (seenRec) {
    seenRec.count++;
    continue;
  }
  let sourceLine = '';
  try {
    sourceLine = (fs.readFileSync(src, 'utf8').split(/\r?\n/)[Number(lineNo) - 1] || '').trim();
  } catch {
    /* 读不到就留空 */
  }
  const rec = { count: 1, file: src, line: Number(lineNo), method, source: sourceLine, logLine: i + 1, cls };
  seen.set(key, rec);
  frames.push(rec);
}

frames.sort((a, b) => b.count - a.count || a.logLine - b.logLine);
if (opts.json) {
  console.log(JSON.stringify({ log: logFile, mod: modDir, frames: frames.slice(0, opts.top) }, null, 2));
} else if (!frames.length) {
  console.log('未发现可归因到 mod 的栈帧：' + logFile);
} else {
  console.log(`日志：${logFile}`);
  console.log(`mod 栈帧：${frames.length} 处（按次数）`);
  for (const f of frames.slice(0, opts.top)) {
    console.log(`  ×${f.count}  ${f.file}:${f.line}  ${f.cls}.${f.method}`);
    if (f.source) console.log(`        ${f.source}`);
  }
}
process.exit(0);
