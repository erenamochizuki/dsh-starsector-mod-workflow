/**
 * API 源码访问：定位 starfarer.api.zip，按类名或正则查源码。
 * 只用本地文件；找不到就报错，绝不猜签名。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listEntries, readText } from './zip.mjs';
import { readData } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..', '..');

/** 游戏根：显式参数 > 环境变量 > .work 配置。找不到就问用户，不猜盘符。 */
export function resolveGameRoot(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.SS_GAME_ROOT) candidates.push(process.env.SS_GAME_ROOT);
  const data = readData(SKILL_ROOT);
  const g = data && (data.gameRoot || (data.paths && data.paths.gameRoot));
  if (g) candidates.push(g);
  for (const c of candidates) {
    const zip = path.join(c, 'starsector-core', 'starfarer.api.zip');
    if (fs.existsSync(zip)) return { gameRoot: c, zip };
  }
  throw new Error('找不到 starfarer.api.zip。请设置 SS_GAME_ROOT，或先运行 doctor --game <游戏根> --mod <mod 目录> 完成绑定。');
}

let cache = null;

/** 读入 zip 并缓存条目（同一进程内只读一次）。 */
export function loadApi(explicitRoot) {
  if (cache && (!explicitRoot || cache.gameRoot === explicitRoot)) return cache;
  const data = readData(SKILL_ROOT);
  if (!explicitRoot && data?.profile === 'moci-maven') {
    const roots = data.apiSourceRoots || [path.join(data.projectRoot, 'starfarer.api')];
    const entries = [];
    const visit = (root, rel = '') => {
      for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
        const name = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) visit(root, name);
        else if (e.name.endsWith('.java')) entries.push({ name, file: path.join(root, name) });
      }
    };
    for (const root of roots) if (fs.existsSync(root)) visit(root);
    if (entries.length) {
      cache = { gameRoot: data.gameRoot, entries, sourceRoot: roots, zip: null, buf: null };
      return cache;
    }
  }
  const { gameRoot, zip } = resolveGameRoot(explicitRoot);
  const buf = fs.readFileSync(zip);
  const all = listEntries(buf).filter((e) => e.name.endsWith('.java'));
  if (!all.length) throw new Error('zip 里没有 .java 条目，路径可能不对：' + zip);
  cache = { gameRoot, zip, buf, entries: all };
  return cache;
}

/** 把 com.fs.starfarer.api.ui.CustomUIPanelPlugin / a/b/X.java / X 统一成查询。 */
export function normalizeQuery(q) {
  return String(q || '').trim().replace(/\.java$/i, '').replace(/\\/g, '/').replace(/\./g, '/');
}

/** 按查询找条目：全路径优先，最后按简单类名（大小写敏感）。 */
export function findEntries(query, explicitRoot) {
  const api = loadApi(explicitRoot);
  const q = normalizeQuery(query);
  if (!q) return [];
  const byPath = api.entries.filter((e) => e.name.toLowerCase() === q.toLowerCase() + '.java' || e.name.toLowerCase().endsWith('/' + q.toLowerCase() + '.java'));
  if (byPath.length) return byPath;
  const simple = q.split('/').pop().toLowerCase();
  return api.entries.filter((e) => path.posix.basename(e.name).toLowerCase() === simple + '.java');
}

/** 读一个条目的源码文本。 */
export function readSource(entry, explicitRoot) {
  if (entry.file) return fs.readFileSync(entry.file, 'utf8');
  const api = loadApi(explicitRoot);
  return readText(api.buf, entry);
}

/** 包名 ← 路径。 */
export function packageOf(name) {
  return path.posix.dirname(name).replace(/\//g, '.');
}

/** 类名 ← 路径。 */
export function typeOf(name) {
  return path.posix.basename(name, '.java');
}

/** 带行号的源码（1 基），可选只输出命中行。 */
export function numberLines(text, onlyRegex) {
  const re = onlyRegex ? new RegExp(onlyRegex) : null;
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (re && !re.test(lines[i])) continue;
    out.push(`${String(i + 1).padStart(5)}| ${lines[i]}`);
  }
  return out.join('\n');
}
