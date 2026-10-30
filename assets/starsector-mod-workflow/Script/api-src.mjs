#!/usr/bin/env node
/**
 * api-src：从本地 starfarer.api.zip 取一个类的真实源码（带行号）。
 * 用法：node Script\api-src.mjs <类名|全限定名> [--grep <正则>] [--lines A-B] [--path] [--out <文件>] [--root <游戏根>]
 * 退出码：0 命中一个；1 参数/读取错误；2 没找到；3 命中多个（需更精确）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEntries, readSource, packageOf, typeOf } from './lib/sources.mjs';

function usage() {
  console.log('用法：node Script\\api-src.mjs <类名|全限定名> [--grep <正则>] [--lines A-B] [--path] [--out <文件>] [--root <游戏根>]');
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    usage();
    process.exit(1);
  }
  const query = argv[0];
  const opts = { grep: null, lines: null, pathOnly: false, out: null, root: null };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--grep') opts.grep = argv[++i];
    else if (a === '--lines') opts.lines = argv[++i];
    else if (a === '--path') opts.pathOnly = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--root') opts.root = argv[++i];
    else {
      console.error('未知参数：' + a);
      usage();
      process.exit(1);
    }
  }

  let hits;
  try {
    hits = findEntries(query, opts.root);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (!hits.length) {
    console.error(`没找到：${query}`);
    console.error('换个写法试试：简单类名 / 全限定名；或用 node Script\\api-grep.mjs <正则> 搜内容。');
    process.exit(2);
  }
  if (hits.length > 1) {
    console.error(`命中 ${hits.length} 个，需更精确：`);
    for (const h of hits.slice(0, 20)) console.error('  ' + h.name);
    if (hits.length > 20) console.error(`  …另有 ${hits.length - 20} 个`);
    process.exit(3);
  }

  const entry = hits[0];
  const text = readSource(entry, opts.root);
  const lines = text.split(/\r?\n/);
  if (opts.pathOnly) {
    console.log(entry.name);
    return;
  }
  if (opts.out) {
    const target = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
    console.log(`${target}  (${lines.length} 行，来自 ${entry.name})`);
    return;
  }

  let picked = lines.map((s, i) => ({ n: i + 1, s }));
  if (opts.lines) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(opts.lines);
    if (!m) {
      console.error('--lines 形如 60-120');
      process.exit(1);
    }
    const [a, b] = [Number(m[1]), Number(m[2])];
    picked = picked.filter((x) => x.n >= a && x.n <= b);
  }
  if (opts.grep) {
    let re;
    try {
      re = new RegExp(opts.grep);
    } catch (e) {
      console.error('--grep 正则不合法：' + e.message);
      process.exit(1);
    }
    picked = picked.filter((x) => re.test(x.s));
  }
  console.log(`# ${packageOf(entry.name)}.${typeOf(entry.name)}   （${entry.name}，${lines.length} 行）`);
  for (const x of picked) console.log(`${String(x.n).padStart(5)}| ${x.s}`);
  if (opts.grep && !picked.length) {
    console.error('（本文件没有匹配 --grep 的行）');
    process.exit(1);
  }
}

main();
