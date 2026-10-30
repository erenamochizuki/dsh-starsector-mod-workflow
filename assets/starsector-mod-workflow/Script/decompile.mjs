// decompile：取第三方 jar 的源码：先抽 jar 内自带 .java/.kt，没有才用外置反编译器。
// 默认不整包解：不给 --only 且源/类很多时直接拒绝，避免一次吐出几百个文件。
'use strict';

import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('decompile');
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { listEntries, readEntry } from './lib/zip.mjs';
import { SKILL_ROOT } from './lib/sources.mjs';
import { readData, cacheDirOf } from './lib/work.mjs';
import { capture, discoverJdkHome, resolveTool } from './lib/env.mjs';

const argv = process.argv.slice(2);
const pos = argv.filter((a) => !a.startsWith('--'));
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--only') opts.only = argv[++i];
  else if (a === '--out') opts.out = argv[++i];
  else if (a === '--jdk') opts.jdk = argv[++i];
  else if (a === '--all') opts.all = true;
  else if (a === '--force') opts.force = true;
}

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

if (!pos.length) die(2, '用法：node Script\\decompile.mjs <jar|class> [--only 类名|包] [--out 目录] [--jdk JDK目录] [--all] [--force]');
const input = path.resolve(pos[0]);
if (!fs.existsSync(input)) die(2, `输入不存在：${input}`);

const data = readData(SKILL_ROOT);
let outDir = opts.out ? path.resolve(opts.out) : null;
if (!outDir) {
  const cache = cacheDirOf(SKILL_ROOT, data);
  if (!cache) die(2, '未绑定 mod，无法确定缓存目录；先运行 doctor，或用 --out 指定输出目录');
  outDir = path.join(cache, 'decompiled', path.basename(input).replace(/\.(jar|class)$/i, ''));
}
fs.mkdirSync(outDir, { recursive: true });

function want(name) {
  if (opts.all) return true;
  if (!opts.only) return false;
  return name.includes(opts.only.replace(/\./g, '/')) || name.includes(opts.only);
}

// ── 1. jar 内自带源码 ───────────────────────────────────────
if (/\.jar$/i.test(input)) {
  const buf = fs.readFileSync(input);
  let entries;
  try { entries = listEntries(buf); } catch (e) { die(2, `不是可读的 jar：${e.message}`); }
  const srcs = entries.filter((e) => /\.(java|kt)$/i.test(e.name) && !e.name.endsWith('/'));
  const classes = entries.filter((e) => e.name.endsWith('.class') && !e.name.includes('$'));

  if (srcs.length) {
    const picked = srcs.filter((e) => want(e.name));
    if (!picked.length && !opts.all && srcs.length > 1) {
      die(2, `jar 内含 ${srcs.length} 个源文件；用 --only <类名|包> 指定，或 --all 全抽（默认不整包）`);
    }
    const use = picked.length ? picked : srcs;
    for (const e of use) {
      const dst = path.join(outDir, e.name);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, readEntry(buf, e));
    }
    console.log(`jar 内自带源码：抽出 ${use.length} 个 → ${outDir}`);
    console.log('（未调用反编译器；源码优先，反编译仅作参考）');
    process.exit(0);
  }

  // 2. 无源码：需要外置工具
  if (!opts.only && !opts.all) {
    die(2, `jar 内没有源码，共 ${classes.length} 个类；用 --only 指定要反编译的类/包（默认不整包）`);
  }
  decompile(input, { kind: 'jar', entries: classes });
  process.exit(0);
}

if (/\.class$/i.test(input)) {
  decompile(input, { kind: 'class' });
  process.exit(0);
}

die(2, '只接受 .jar 或 .class');

// ── 外置反编译器 ───────────────────────────────────────────
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pickTool() {
  const tools = path.join(SKILL_ROOT, 'tools');
  for (const name of ['vineflower.jar', 'cfr.jar']) {
    const p = path.join(tools, name);
    if (!fs.existsSync(p)) continue;
    const sums = path.join(tools, 'SHA256SUMS.txt');
    if (fs.existsSync(sums)) {
      const line = fs.readFileSync(sums, 'utf8').split(/\r?\n/).find((l) => l.trim().endsWith(name));
      if (line) {
        const want = line.trim().split(/\s+/)[0].toLowerCase();
        const got = sha256(p);
        if (want !== got) die(2, `工具校验失败：${name}\n  期望 ${want}\n  实际 ${got}`);
      }
    }
    return { name, file: p };
  }
  return null;
}

function javaOf(jdkHome) {
  const java = resolveTool('java', { jdkHome });
  if (!java) die(2, '找不到 java；用 --jdk <JDK17 目录> 指定');
  return java;
}

function checkJdk(java) {
  const home = opts.jdk ? path.resolve(opts.jdk) : discoverJdkHome(java);
  const release = home ? path.join(home, 'release') : null;
  if (!release || !fs.existsSync(release)) {
    console.warn(`W 无法确认 JDK 版本（${home || '未知'}），继续；反编译器需 JDK17+`);
    return java;
  }
  const m = fs.readFileSync(release, 'utf8').match(/JAVA_VERSION="([^"]+)"/);
  const ver = m ? m[1] : '';
  const major = ver.startsWith('1.') ? parseInt(ver.split('.')[1], 10) : parseInt(ver.split('.')[0], 10);
  if (!(major >= 17)) {
    die(2, `反编译器需 JDK17+，当前 java 是 ${ver || '未知'}（${home}）。用 --jdk 指向 JDK17。`);
  }
  return java;
}

function decompile(file, info) {
  const tool = pickTool();
  if (!tool) {
    die(2, [
      'jar 内没有源码，且没有外置反编译器。',
      `把以下任一 jar 放到 ${path.join(SKILL_ROOT, 'tools')}\：`,
      '  - Vineflower: https://github.com/Vineflower/vineflower/releases （vineflower.jar，需 JDK17+）',
      '  - CFR:        https://www.benf.org/other/cfr/ （cfr.jar）',
      '放好后在 tools\\SHA256SUMS.txt 写一行 "<sha256>  <文件名>" 供校验；工具只影响反编译，不参与打包。',
    ].join('\n'));
  }
  const java = checkJdk(javaOf(opts.jdk ? path.resolve(opts.jdk) : undefined));

  let args;
  if (tool.name === 'cfr.jar') {
    args = ['-jar', tool.file, file, '--outputdir', outDir];
    if (opts.only) args.push('--jarfilter', opts.only);
  } else {
    args = ['-jar', tool.file, file, outDir];
    if (opts.only) args.push(`--only=${opts.only}`);
  }

  if (info.kind === 'jar' && !opts.only && !opts.all) die(2, '需要 --only（默认不整包解）');
  const r = capture(java, args, { timeout: 300000 });
  if (r.status !== 0) {
    die(1, `反编译失败（exit ${r.status}）：\n${(r.stderr || r.stdout || '').slice(0, 2000)}`);
  }
  console.log(`已反编译 → ${outDir}（${tool.name}）`);
  if (opts.only) console.log(`只处理：${opts.only}`);
}
