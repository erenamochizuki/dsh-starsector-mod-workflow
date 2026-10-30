#!/usr/bin/env node
/**
 * api-grep：在本地 API 源码里按正则搜索，输出 包/类.java:行: 文本。
 * 用法：node Script\api-grep.mjs <正则> [--max 200] [--in <路径片段>] [--files-only] [--ignore-case] [--root <游戏根>]
 * 退出码：0 有命中；1 正则错误；2 无命中。
 */
import { loadApi, readSource } from './lib/sources.mjs';

function usage() {
  console.log('用法：node Script\\api-grep.mjs <正则> [--max 200] [--in <路径片段>] [--files-only] [--ignore-case] [--root <游戏根>]');
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    usage();
    process.exit(1);
  }
  const pattern = argv[0];
  const opts = { max: 200, inPath: null, filesOnly: false, ignoreCase: false, root: null };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max') opts.max = Number(argv[++i]) || 200;
    else if (a === '--in') opts.inPath = argv[++i];
    else if (a === '--files-only') opts.filesOnly = true;
    else if (a === '--ignore-case' || a === '-i') opts.ignoreCase = true;
    else if (a === '--root') opts.root = argv[++i];
    else {
      console.error('未知参数：' + a);
      usage();
      process.exit(1);
    }
  }

  let re;
  try {
    re = new RegExp(pattern, opts.ignoreCase ? 'i' : '');
  } catch (e) {
    console.error('正则不合法：' + e.message);
    process.exit(1);
  }

  let api;
  try {
    api = loadApi(opts.root);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const seen = new Set();
  let shown = 0;
  let files = 0;
  for (const entry of api.entries) {
    if (opts.inPath && !entry.name.includes(opts.inPath)) continue;
    let text;
    try {
      text = readSource(entry, opts.root);
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    let matchedFile = false;
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      matchedFile = true;
      if (opts.filesOnly) break;
      if (shown >= opts.max) break;
      const key = entry.name + ':' + (i + 1);
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`${entry.name}:${i + 1}: ${lines[i].trim().slice(0, 240)}`);
      shown++;
    }
    if (matchedFile) files++;
    if (shown >= opts.max) {
      console.error(`（已到 --max ${opts.max} 条上限）`);
      break;
    }
  }

  if (!files) {
    console.error('无命中：' + pattern);
    process.exit(2);
  }
  console.error(`# 命中 ${files} 个文件${opts.filesOnly ? '' : `，${shown} 行`}`);
}

main();
