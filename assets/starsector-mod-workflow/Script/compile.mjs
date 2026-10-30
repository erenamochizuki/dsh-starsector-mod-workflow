#!/usr/bin/env node
/**
 * Script\compile.mjs：用游戏自带的 janino 编译 mod（与实机同源）
 *
 * 用法：
 *   node Script\compile.mjs <mod目录> [--root <游戏根>] [--out <输出目录>]
 *                           [--lib <积木目录>] [--no-lib] [--json]
 *
 * 为什么不是 javac：游戏运行期用 janino 2.7.8 编译 data\scripts，javac 的结果
 * 只能当代理；只有 janino 才能复现实机的语法边界。所以编译闸门走这条链。
 *
 * 退出码：0 无错误；1 有编译错误；2 用法/环境问题。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('compile');
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGameRoot } from './lib/sources.mjs';
import { warnStamp } from './lib/stamp.mjs';
import { buildIndex, classmapCache, collectJars, shadowWarnings } from './lib/classmap.mjs';
import { readData, workDirOf } from './lib/work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');

/** 收集目录下所有 .java（递归，跳过 .git 等）。 */
function walkJava(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.toLowerCase().endsWith('.java')) out.push(p);
    }
  }
  out.sort();
  return out;
}

/** core 目录里所有 jar。 */
function coreJars(core) {
  return fs.readdirSync(core)
    .filter((n) => n.toLowerCase().endsWith('.jar'))
    .map((n) => path.join(core, n));
}

/** 读 mod 的 mod_info：游戏允许注释和尾逗号，标准 JSON.parse 会失败。 */
function parseJsonLoose(text) {
  let s = String(text).replace(/^\uFEFF/, '');
  let out = '';
  let inStr = false;
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { out += c + (s[++i] || ''); continue; }
      if (c === quote) { inStr = false; out += '"'; continue; }
      if (quote === "'") {
        if (c === '"') out += '\\"';
        else if (c === '\n') out += '\\n';
        else out += c;
        continue;
      }
      out += c;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; out += '"'; continue; }
    if (c === '#') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  out = out.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(out);
}

/** mod 的依赖：mod_info 的 dependencies 按 mod_info.json 的 id 找目录，再取 jar。 */
function depJars(modDir, modsDir) {
  const info = path.join(modDir, 'mod_info.json');
  if (!fs.existsSync(info)) return [];
  let deps = [];
  try {
    const d = parseJsonLoose(fs.readFileSync(info, 'utf8'));
    deps = (d.dependencies || []).map((x) => (typeof x === 'string' ? x : x.id)).filter(Boolean);
  } catch {
    return [];
  }
  // 目录名不一定等于 id（如 lw_lazylib 在 LazyLib 目录），先建 id → 目录 表
  const idToDir = new Map();
  if (fs.existsSync(modsDir)) {
    for (const e of fs.readdirSync(modsDir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const mi = path.join(modsDir, e.name, 'mod_info.json');
      if (!fs.existsSync(mi)) continue;
      try {
        const id = parseJsonLoose(fs.readFileSync(mi, 'utf8')).id;
        if (id) idToDir.set(String(id).toLowerCase(), path.join(modsDir, e.name));
      } catch {
        /* 坏的 mod_info 跳过 */
      }
    }
  }
  const out = [];
  for (const id of deps) {
    const d = idToDir.get(String(id).toLowerCase());
    if (!d) continue;
    for (const sub of ['jars', 'lib', '.']) {
      const p = path.join(d, sub);
      if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) continue;
      for (const n of fs.readdirSync(p)) {
        if (n.toLowerCase().endsWith('.jar')) out.push(path.join(p, n));
      }
    }
  }
  return [...new Set(out)];
}

/** 用文件承接子进程输出：沙箱里管道会 EPERM，文件句柄可以。 */
function runToLog(cmd, argv, logPath) {
  const fd = fs.openSync(logPath, 'w');
  try {
    const r = spawnSync(cmd, argv, { stdio: ['ignore', fd, fd] });
    return { status: r.status, error: r.error, text: fs.readFileSync(logPath, 'utf8') };
  } finally {
    fs.closeSync(fd);
  }
}

/** 确保 JVerify.class 存在且不比源码旧。 */
function ensureDriver(toolsDir, cp) {
  const src = path.join(toolsDir, 'JVerify.java');
  const cls = path.join(toolsDir, 'JVerify.class');
  if (!fs.existsSync(src)) throw new Error('缺少驱动源码：' + src);
  const fresh = fs.existsSync(cls) && fs.statSync(cls).mtimeMs >= fs.statSync(src).mtimeMs;
  if (fresh) return;
  const log = path.join(os.tmpdir(), 'ssverify-javac.log');
  const r = runToLog('javac', ['-encoding', 'UTF-8', '-cp', cp, '-d', toolsDir, src], log);
  if (r.error && r.error.code === 'ENOENT') {
    throw new Error('没有 javac 可用来编译驱动 JVerify.java；请安装 JDK 或让 PATH 里有 javac。');
  }
  if (r.status !== 0) {
    throw new Error('编译驱动失败：\n' + r.text.trim());
  }
}

function usage(code) {
  console.error('用法：node Script\\compile.mjs <mod目录> [--root <游戏根>] [--out <目录>] [--lib <目录>] [--no-lib] [--json]');
  console.error('      node Script\\compile.mjs --lib-only [--root <游戏根>]   # 只编积木，验 janino 兼容');
  process.exit(code);
}

const args = process.argv.slice(2);
const opts = { json: false, noLib: false, lib: null, out: null, root: null, libOnly: false };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opts.json = true;
  else if (a === '--no-lib') opts.noLib = true;
  else if (a === '--lib-only') opts.libOnly = true;
  else if (a === '--lib') opts.lib = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--root') opts.root = args[++i];
  else if (a === '-h' || a === '--help') usage(0);
  else if (!a.startsWith('--')) pos.push(a);
  else usage(2);
}
if (pos.length !== 1 && !opts.libOnly) usage(2);

const modDir = pos.length ? path.resolve(pos[0]) : null;
if (modDir && !fs.existsSync(modDir)) { console.error('mod 目录不存在：' + modDir); process.exit(2); }

let gameRoot;
let apiZip;
try {
  ({ gameRoot, zip: apiZip } = resolveGameRoot(opts.root));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const core = path.join(gameRoot, 'starsector-core');
const toolsDir = path.join(SKILL_ROOT, 'VERIFY', 'tools');
const jars = coreJars(core);
const javaExe = fs.existsSync(path.join(gameRoot, 'jre', 'bin', 'java.exe'))
  ? path.join(gameRoot, 'jre', 'bin', 'java.exe')
  : 'java';

// 源码：mod 的 data\scripts + 可选积木目录
const libDir = opts.noLib ? null : path.resolve(opts.lib || path.join(SKILL_ROOT, 'LIB', 'sscore'));
const sources = [];
if (modDir) sources.push(...walkJava(path.join(modDir, 'data', 'scripts')));
if (libDir && fs.existsSync(libDir)) sources.push(...walkJava(libDir));
if (!sources.length) {
  console.error('没有找到 .java（' + (modDir ? path.join(modDir, 'data', 'scripts') : libDir) + '）');
  process.exit(2);
}

// 类路径：游戏 jar + mod 自带 jar + 依赖 jar
const modsDir = modDir ? path.dirname(modDir) : null;
const cpParts = [...jars, ...(modDir ? coreJars(modDir) : []), ...(modDir ? depJars(modDir, modsDir) : [])];
const cp = cpParts.join(';');
if (process.env.SS_DEBUG_CP) console.error('CP:\n' + cpParts.join('\n'));

// 临时产物优先落 <mod>\.work（可被 clean 白名单回收）；未绑定才用系统临时目录。
let tmpBase = os.tmpdir();
try {
  const d = readData(SKILL_ROOT) || {};
  if (d.mod && fs.existsSync(d.mod)) {
    const w = workDirOf(d.mod, d);
    fs.mkdirSync(w, { recursive: true });
    tmpBase = w;
  }
} catch {
  // 绑定信息坏了不阻断编译
}
const outDir = opts.out || fs.mkdtempSync(path.join(tmpBase, 'tmp-compile-'));
const tmpOut = path.join(outDir, '.jv');
fs.mkdirSync(tmpOut, { recursive: true });

try {
  ensureDriver(toolsDir, [...jars, path.join(toolsDir, 'JVerify.class')].join(';'));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}

/** 跑一轮 janino；返回 { errors, status, text }。 */
function runJanino(files, roots, extraCp) {
  const listFile = path.join(outDir, `sources-${runJanino.seq++}.txt`);
  fs.writeFileSync(listFile, files.join('\n'), 'utf8');
  const log = path.join(outDir, `jverify-${runJanino.seq}.log`);
  const r = runToLog(javaExe, [
    '-Dfile.encoding=UTF-8',
    '-cp', path.join(toolsDir) + ';' + jars.join(';'),
    'JVerify',
    [cp, extraCp].filter(Boolean).join(';'),
    tmpOut,
    roots.join(';'),
    '@' + listFile,
  ], log);
  const lines = r.text.split(/\r?\n/).filter(Boolean);
  let count = -1;
  const errors = [];
  for (const ln of lines) {
    const m = ln.match(/^__JV_ERRORS__\s+(\d+)/);
    if (m) { count = Number(m[1]); continue; }
    if (/^编译驱动异常:/.test(ln) || /\.java:\d+:/.test(ln)) errors.push(ln);
  }
  return { errors, count, status: r.status, text: r.text };
}
runJanino.seq = 0;

// janino 不会为同批源码自动排序：先整批试，失败再逐个补齐（已编出的 .class 进 cp）。
function compileGroup(files, roots) {
  const batch = runJanino(files, roots, tmpOut);
  if (batch.count === 0) return { errors: [], count: 0 };
  const pending = new Set(files);
  const errs = new Map();
  let progress = true;
  while (progress && pending.size) {
    progress = false;
    for (const f of [...pending]) {
      const r = runJanino([f], roots, tmpOut);
      if (r.count === 0) {
        pending.delete(f);
        errs.delete(f);
        progress = true;
      } else {
        errs.set(f, r.errors);
      }
    }
  }
  const out = [];
  for (const f of pending) out.push(...(errs.get(f) || []));
  return { errors: out, count: out.length };
}

// 积木先编：mod 源码 import sscore.* 时需要已产出的 .class
const libSources = (libDir && fs.existsSync(libDir)) ? walkJava(libDir) : [];
const modSources = modDir ? walkJava(path.join(modDir, 'data', 'scripts')) : [];

if (!libSources.length && !modSources.length) {
  console.error('没有找到 .java（' + path.join(modDir, 'data', 'scripts') + '）');
  process.exit(2);
}

let total = 0;
const allErrors = [];
if (libSources.length) {
  const r = compileGroup(libSources, [path.dirname(libDir)]);
  total += r.count;
  allErrors.push(...r.errors);
}
if (modSources.length) {
  const r = compileGroup(modSources, [modDir]);
  total += r.count;
  allErrors.push(...r.errors);
}

const fileCount = libSources.length + modSources.length;

/** 源码与 jar 同名时提示遮蔽（W 级，不改变退出码）。 */
let shadows = [];
if (total === 0 && modDir) {
  try {
    const data = readData(SKILL_ROOT) || {};
    const index = buildIndex({
      jars: collectJars({ gameRoot, modDir }),
      apiZip,
      cacheFile: classmapCache(SKILL_ROOT, data),
    });
    shadows = shadowWarnings(modDir, index);
  } catch {
    // 索引失败不影响编译结论
  }
}

if (opts.json) {
  console.log(JSON.stringify({ mod: modDir, files: fileCount, errors: total, shadows, details: allErrors }, null, 2));
} else {
  console.log(`编译：${fileCount} 个 .java（janino，游戏同源）`);
  for (const s of shadows) {
    console.log(`  W 遮蔽：${path.basename(s.file)}（${s.fqcn}）与 ${path.basename(s.jar)} 同名，运行时可能命中 jar`);
  }
  if (total > 0) {
    for (const e of allErrors) console.log('  E ' + e);
    console.log(`编译：E=${total} → 不通过`);
  } else {
    console.log('编译：E=0 → 通过');
  }
}

if (total === 0) warnStamp(SKILL_ROOT, '编译闸门缺 doctor 戳');
process.exit(total === 0 ? 0 : 1);
