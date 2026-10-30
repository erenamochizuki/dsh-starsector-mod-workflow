// pack：把当前构建打成可分发的 zip（不含任务、草稿、基线、绑定）。
// 用法：node Script\pack.mjs [--out <目录>]
// 产物：dist\starsector-mod-workflow-<version>.zip，内含同名目录 + SHA256SUMS.txt + PACKAGE.json
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('pack');
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeZip } from './lib/zipwrite.mjs';
import { collectRoots, scrubDoc, findLocalRoots, describeRoots, isDocFile, isCodeFile } from './lib/redact.mjs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'META.json'), 'utf8'));

const argv = process.argv.slice(2);
let outDir = path.join(ROOT, 'dist');
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outDir = path.resolve(argv[++i]);
  else if (argv[i] === '--help' || argv[i] === '-h') {
    console.log('用法：node Script\\pack.mjs [--out <目录>]');
    process.exit(0);
  } else {
    console.error('未知参数：' + argv[i]);
    process.exit(2);
  }
}

const EXCLUDE_DIRS = new Set(['dist', 'TASKS', 'HARVEST', 'DISTILL', 'node_modules', '.git', '.pack-tmp', '.work', '.back', 'profile']);
const EXCLUDE_REL = new Set(['data.json', 'GATE/baseline', 'Script/local-roots.json']);
const EXCLUDE_EXT = new Set(['.zip', '.7z', '.rar', '.log', '.tmp', '.bak']);

// 交付物只含框架文件；缓存与工作产物都在 <mods>\.work，天然不进来。

function excluded(rel) {
  const segs = rel.split('/');
  if (segs.some((s) => EXCLUDE_DIRS.has(s))) return true;
  if (segs.some((s, i) => i > 0 && s.startsWith('.'))) return true;
  if (EXCLUDE_REL.has(rel)) return true;
  if (rel.startsWith('GATE/baseline/')) return true;
  // 只排除根目录下的 _ 开头草稿（如 _tmp），不误伤 KIT\_guide-data.json 这类正经资产。
  if (!rel.includes('/') && path.basename(rel).startsWith('_')) return true;
  if (EXCLUDE_EXT.has(path.extname(rel).toLowerCase())) return true;
  return false;
}

function collect(rel = '', out = []) {
  const dir = path.join(ROOT, rel);
  for (const name of fs.readdirSync(dir)) {
    const r = rel ? `${rel}/${name}` : name;
    const abs = path.join(ROOT, r);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (excluded(r + '/x')) continue;
      collect(r, out);
    } else {
      if (excluded(r)) continue;
      out.push(r);
    }
  }
  return out;
}

const files = collect().sort();
const name = META.name || 'starsector-mod-workflow';
const version = META.version || '0.0.0';
const pkgRoot = path.join(ROOT, '.pack-tmp', `${name}-${version}`);

fs.rmSync(path.join(ROOT, '.pack-tmp'), { recursive: true, force: true });
fs.mkdirSync(pkgRoot, { recursive: true });

const sums = [];
let bytes = 0;
for (const rel of files) {
  const src = path.join(ROOT, rel);
  const dst = path.join(pkgRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  const buf = fs.readFileSync(src);
  bytes += buf.length;
  sums.push(`${crypto.createHash('sha256').update(buf).digest('hex')}  ${rel.replace(/\\/g, '/')}`);
}

// INDEX 依赖目录内容（任务/案例不进包），在暂存目录里重新生成，保证包内 --check 一致。
const gi = spawnSync(process.execPath, [path.join(pkgRoot, 'Script', 'gen-index.mjs'), '--root', pkgRoot], { stdio: 'inherit' });
if (gi.status !== 0) {
  console.error('包内 INDEX 生成失败');
  process.exit(1);
}

// 以暂存目录的最终内容为准重算清单与哈希（INDEX 已被改写）。
const staged = [];
(function walk(rel = '') {
  for (const nm of fs.readdirSync(path.join(pkgRoot, rel))) {
    const r = rel ? `${rel}/${nm}` : nm;
    const st = fs.statSync(path.join(pkgRoot, r));
    if (st.isDirectory()) walk(r);
    else staged.push(r);
  }
})();
staged.sort();

// 剔除本机路径：文档换成占位符，代码里出现本机根即中止打包。
const roots = collectRoots(ROOT);
const docHits = [];
const codeProblems = [];
for (const rel of staged) {
  const abs = path.join(pkgRoot, rel);
  if (isDocFile(rel)) {
    const { text, hits } = scrubDoc(fs.readFileSync(abs, 'utf8'), roots);
    if (hits) {
      fs.writeFileSync(abs, text, 'utf8');
      docHits.push({ file: rel, hits });
    }
  } else if (isCodeFile(rel)) {
    const text = fs.readFileSync(abs, 'utf8');
    const found = findLocalRoots(text, roots);
    if (found.length) codeProblems.push({ file: rel, found });
  }
}
if (codeProblems.length) {
  console.error('打包中止：以下代码文件含本机路径，改成占位符或从 .work 配置读取：');
  for (const p of codeProblems) {
    for (const f of p.found) console.error(`  ${p.file}:${f.line}  ${f.text}  应改为 ${f.to}`);
  }
  fs.rmSync(path.join(ROOT, '.pack-tmp'), { recursive: true, force: true });
  process.exit(1);
}
const docHitTotal = docHits.reduce((a, b) => a + b.hits, 0);

sums.length = 0;
bytes = 0;
for (const rel of staged) {
  const buf = fs.readFileSync(path.join(pkgRoot, rel));
  bytes += buf.length;
  sums.push(`${crypto.createHash('sha256').update(buf).digest('hex')}  ${rel.replace(/\\/g, '/')}`);
}

const pkg = {
  name,
  version,
  schema: META.schema,
  stage: META.stage,
  builtAt: new Date().toISOString(),
  files: staged.length,
  bytes,
  excludes: [...EXCLUDE_DIRS].filter((d) => !d.startsWith('.')).concat(['GATE/baseline/*', '_*', '*.zip|*.log|*.tmp']),
  redaction: {
    placeholders: describeRoots(roots),
    docFiles: docHits.length,
    docHits: docHitTotal,
    codeFiles: 'checked',
  },
  notes: '解压后把顶层目录放进 skills 目录；旧版用 Script\\replace.mjs 替换。绑定信息在 <mods>\\.work\\config.json，不在包内。',
};
fs.writeFileSync(path.join(pkgRoot, 'PACKAGE.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(pkgRoot, 'SHA256SUMS.txt'), sums.join('\n') + '\n', 'utf8');

fs.mkdirSync(outDir, { recursive: true });
const zipPath = path.join(outDir, `${name}-${version}.zip`);
fs.rmSync(zipPath, { force: true });

// 自己写 zip（Script\lib\zipwrite.mjs），不依赖 PowerShell 模块。
const entries = [];
function walkPkg(rel = '') {
  const dir = path.join(pkgRoot, rel);
  for (const nm of fs.readdirSync(dir)) {
    const r = rel ? `${rel}/${nm}` : nm;
    const abs = path.join(pkgRoot, r);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      entries.push({ name: `${name}/${r}/`, data: Buffer.alloc(0), mtime: st.mtime });
      walkPkg(r);
    } else {
      entries.push({ name: `${name}/${r}`, data: fs.readFileSync(abs), mtime: st.mtime });
    }
  }
}
walkPkg();
writeZip(zipPath, entries);

const zipBuf = fs.readFileSync(zipPath);
const zipHash = crypto.createHash('sha256').update(zipBuf).digest('hex');
fs.rmSync(path.join(ROOT, '.pack-tmp'), { recursive: true, force: true });
console.log(`已打包：${zipPath}`);
console.log(`本机路径：剔除 ${docHitTotal} 处 / ${docHits.length} 个文件，代码文件零命中；占位符 ${describeRoots(roots).join(' ')}`);
for (const d of docHits) console.log(`  ${d.file}  ${d.hits} 处`);
console.log(`版本：${version}    文件：${files.length}    原始：${(bytes / 1024).toFixed(1)} KiB    zip：${(zipBuf.length / 1024).toFixed(1)} KiB`);
console.log(`sha256：${zipHash}`);
