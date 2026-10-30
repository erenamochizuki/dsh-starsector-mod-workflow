/**
 * javap：反汇编（不是反编译）一个类，自动拼好 classpath，不用手写一长串 jar。
 *
 * 用法：node Script\javap.mjs <类名|全限定名> [--code] [-p] [--mod <目录>] [--game <根>]
 * 默认带 -p（含私有成员）；--code 加字节码（-c）。
 * 退出：0 成功；2 找不到类或多义、工具缺失。
 */
'use strict';

import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('javap');
import fs from 'node:fs';
import path from 'node:path';

import { classPath, findCandidates, buildIndex, classmapCache, collectJars } from './lib/classmap.mjs';
import { capture, discoverJdkHome, majorOf, resolveTool, toolVersion } from './lib/env.mjs';
import { readData } from './lib/work.mjs';
import { SKILL_ROOT, resolveGameRoot } from './lib/sources.mjs';

function parseArgs(argv) {
  const o = { query: '', code: false, priv: true, mod: '', game: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--code') o.code = true;
    else if (a === '-p' || a === '--private') o.priv = true;
    else if (a === '--public') o.priv = false;
    else if (a === '--mod') o.mod = argv[++i] || '';
    else if (a === '--game') o.game = argv[++i] || '';
    else if (a === '-h' || a === '--help') {
      console.log('用法：node Script\\javap.mjs <类名|全限定名> [--code] [-p] [--mod <目录>] [--game <根>]');
      process.exit(0);
    } else if (!a.startsWith('-') && !o.query) o.query = a;
  }
  return o;
}

const opt = parseArgs(process.argv.slice(2));
if (!opt.query) {
  console.error('用法：node Script\\javap.mjs <类名|全限定名> [--code]');
  process.exit(2);
}

const data = readData(SKILL_ROOT) || {};
let ctx;
try {
  ctx = resolveGameRoot(opt.game || data.gameRoot || '');
} catch (e) {
  console.error(`ERR ${e.message}`);
  process.exit(2);
}
const modDir = opt.mod || data.mod || '';

/** 找 javap：优先真 JDK17（PATH 里的 javap 常是 JDK8，读不了 class 61）。 */
function findJavap() {
  const java = resolveTool('java', { jdkHome: data.jdkHome });
  const javac = resolveTool('javac', { jdkHome: data.jdkHome });
  const homes = [
    data.jdkHome,
    java ? discoverJdkHome(java) : null,
    javac ? discoverJdkHome(javac) : null,
  ].filter(Boolean);
  for (const h of homes) {
    const p = resolveTool('javap', { jdkHome: h });
    if (p) {
      const v = toolVersion(p, 'javap');
      if (majorOf(v.version) >= 17) return { path: p, version: v.version, major: majorOf(v.version) };
    }
  }
  // 备用：扫描常见 JDK 安装目录，挑 17+。
  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
    'C:\\Program Files\\Microsoft',
  ];
  const found = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const n of fs.readdirSync(root)) {
      const p = path.join(root, n, 'bin', 'javap.exe');
      if (!fs.existsSync(p)) continue;
      const v = toolVersion(p, 'javap');
      if (majorOf(v.version) >= 17) found.push({ path: p, version: v.version, major: majorOf(v.version) });
    }
  }
  if (found.length) return found.sort((a, b) => b.major - a.major)[0];
  const fallback = resolveTool('javap', { jdkHome: data.jdkHome });
  if (!fallback) return null;
  const v = toolVersion(fallback, 'javap');
  return { path: fallback, version: v.version, major: majorOf(v.version) };
}

const javap = findJavap();
if (!javap) {
  console.error('ERR 找不到 javap：需要 JDK（不是 JRE），或用 --jdk 指定 JDK 目录。');
  process.exit(2);
}

/** 解析类名：全限定名直接用；短名要求唯一。 */
function resolveClass(q) {
  if (q.includes('.')) return { fqcn: q, note: '按全限定名' };
  const index = buildIndex({
    jars: collectJars({ gameRoot: ctx.gameRoot, modDir }),
    apiZip: ctx.zip,
    cacheFile: classmapCache(SKILL_ROOT, data),
  });
  const hits = findCandidates(q, { index, modDir });
  const exact = hits.filter((h) => h.fqcn.split('.').pop() === q);
  if (exact.length === 1) return { fqcn: exact[0].fqcn, note: `短名唯一（${exact[0].kind}）` };
  const pool = exact.length ? exact : hits;
  if (!pool.length) return null;
  if (pool.length > 1) {
    const title = exact.length ? `类名「${q}」有 ${pool.length} 个候选` : `没有精确同名的「${q}」；包含它的类有 ${pool.length} 个`;
    console.error(`${title}，先选一个：`);
    for (const h of pool.slice(0, 20)) console.error(`  ${h.fqcn}  [${h.kind}]`);
    if (pool.length > 20) console.error(`  … 其余 ${pool.length - 20} 个省略`);
    console.error('再跑：node Script\\javap.mjs <全限定名>');
    return { multi: pool };
  }
  return { fqcn: pool[0].fqcn, note: `短名唯一（${pool[0].kind}）` };
}

const resolved = resolveClass(opt.query);
if (!resolved) {
  console.error(`没找到类「${opt.query}」。先用 node Script\\find-class.mjs ${opt.query} 查。`);
  process.exit(2);
}
if (resolved.multi) process.exit(2);

const cp = classPath({ gameRoot: ctx.gameRoot, modDir });
const args = [opt.priv ? '-p' : '-public'];
if (opt.code) args.push('-c');
args.push('-cp', cp, resolved.fqcn);

const runJavap = (fqcn) => {
  const a = args.slice(0, -1).concat(fqcn);
  return capture(javap.path, a, { timeout: 60000 });
};

let r = runJavap(resolved.fqcn);

/** 内部类：Outer.Inner 常要写成 Outer$Inner；失败时按索引换一次。 */
function asInner(fqcn) {
  const parts = fqcn.split('.');
  const inner = parts.pop();
  const outer = parts.pop();
  if (!outer) return null;
  const index = buildIndex({
    jars: collectJars({ gameRoot: ctx.gameRoot, modDir }),
    apiZip: ctx.zip,
    cacheFile: classmapCache(SKILL_ROOT, data),
  });
  const want = `${outer}$${inner}`;
  return findCandidates(outer, { index, modDir }).find((h) => h.fqcn.endsWith(want))?.fqcn || null;
}

if (r.status !== 0 && /找不到类|class not found|Cannot find/i.test(r.stderr + r.stdout)) {
  const inner = asInner(resolved.fqcn);
  if (inner) {
    console.error(`提示：内部类改用 ${inner}`);
    r = runJavap(inner);
  }
}
if (r.status !== 0) {
  console.error(`ERR javap 失败（${javap.version || '?'}）${resolved.note}`);
  console.error((r.stderr || r.stdout || '').trim().split('\n').slice(0, 8).join('\n'));
  if (javap.major && javap.major < 17) {
    console.error('提示：javap 不是 17，可能读不了 class 61；用 --jdk 指向 JDK17。');
  }
  process.exit(2);
}
process.stdout.write(r.stdout);
process.exit(0);
