/**
 * find-class：按关键词查类：api 源码 / core jar / mod 源码，多来源全列。
 *
 * 用法：node Script\find-class.mjs <关键词> [--pick N] [--json] [--rebuild]
 *       [--mod <mod目录>] [--game <游戏根>]
 * 退出：0 找到；2 没找到或参数错。
 */
'use strict';

import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('find-class');
import fs from 'node:fs';
import {
  buildIndex, classmapCache, collectJars, findCandidates,
} from './lib/classmap.mjs';
import { readData } from './lib/work.mjs';
import { SKILL_ROOT, resolveGameRoot } from './lib/sources.mjs';

function parseArgs(argv) {
  const o = { keyword: '', pick: 0, json: false, rebuild: false, mod: '', game: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--rebuild') o.rebuild = true;
    else if (a === '--pick') o.pick = parseInt(argv[++i], 10) || 0;
    else if (a === '--mod') o.mod = argv[++i] || '';
    else if (a === '--game') o.game = argv[++i] || '';
    else if (a === '-h' || a === '--help') {
      console.log('用法：node Script\\find-class.mjs <关键词> [--pick N] [--json] [--rebuild] [--mod <目录>] [--game <根>]');
      process.exit(0);
    } else if (!a.startsWith('-') && !o.keyword) o.keyword = a;
  }
  return o;
}

const opt = parseArgs(process.argv.slice(2));
if (!opt.keyword) {
  console.error('用法：node Script\\find-class.mjs <关键词> [--pick N] [--json]');
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

const jars = collectJars({ gameRoot: ctx.gameRoot, modDir });
const cacheFile = classmapCache(SKILL_ROOT, data);
const index = buildIndex({ jars, apiZip: ctx.zip, cacheFile, rebuild: opt.rebuild });
const hits = findCandidates(opt.keyword, { index, modDir });

if (opt.pick) {
  if (opt.pick < 1 || opt.pick > hits.length) {
    console.error(`ERR --pick ${opt.pick} 超出范围（找到 ${hits.length} 个）`);
    process.exit(2);
  }
  console.log(hits[opt.pick - 1].fqcn);
  process.exit(0);
}

if (opt.json) {
  console.log(JSON.stringify({ query: opt.keyword, jars: jars.length, hits }, null, 2));
  process.exit(hits.length ? 0 : 2);
}

if (!hits.length) {
  console.log(`没找到包含「${opt.keyword}」的类。`);
  console.log('换更短的关键词，或跑 node Script\\api-grep.mjs <正则> 搜源码正文。');
  process.exit(2);
}

console.log(`索引：jar ${jars.length} 个，api zip ${index.zip ? index.zip.fqcns.length : 0} 个源码类`);
console.log(`找到 ${hits.length} 个：`);
for (const h of hits) {
  const where = h.details.map((d) => d.replace(/^.*[\\/](?=[^\\/]+$)/, '')).join(' , ');
  const mark = h.kind === 'source+jar' ? '  ⚠ 可能被 jar 遮蔽' : '';
  console.log(`${h.fqcn}  [${h.kind}]  ${where}${mark}`);
}
if (hits.length > 1) {
  console.log('提示：同名多来源时用 --pick N 取一个 FQCN，不要默认取第一个。');
}
process.exit(0);
