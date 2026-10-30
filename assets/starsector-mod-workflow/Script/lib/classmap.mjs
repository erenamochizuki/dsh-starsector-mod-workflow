/**
 * classmap：类名索引：本体 zip 源码 + 各 jar 的 .class + 目标 mod 的 .java。
 * 只读；缓存 key 用 path+size+mtime，任一 jar 更新即重建。
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { listEntries } from './zip.mjs';
import { cacheDirOf } from './work.mjs';

/** jar 的缓存 key：大小 + 修改时间。 */
export function jarKey(file) {
  const st = fs.statSync(file);
  return `${st.size}:${Math.round(st.mtimeMs)}`;
}

/** 从 entry 名取 FQCN；跳过匿名内部类。 */
function fqcnOf(entry) {
  return entry.replace(/\.(class|java)$/i, '').replace(/\//g, '.');
}

/** 读一个 jar 的类清单（不反编译，只读中央目录）。 */
function scanJar(file) {
  const buf = fs.readFileSync(file);
  const entries = listEntries(buf);
  const classes = [];
  const java = new Set();
  for (const e of entries) {
    if (/\.java$/i.test(e.name)) {
      java.add(fqcnOf(e.name));
    } else if (/\.class$/i.test(e.name) && !/\$\d+\.class$/i.test(e.name)) {
      classes.push({ fqcn: fqcnOf(e.name), entry: e.name });
    }
  }
  return { classes, java: [...java] };
}

/** 本体 API zip 的 .java 清单。 */
function scanApiZip(zip) {
  if (!zip || !fs.existsSync(zip)) return [];
  const entries = listEntries(fs.readFileSync(zip));
  return entries.filter((e) => /\.java$/i.test(e.name)).map((e) => fqcnOf(e.name));
}

/** 目标 mod 的 jars：mod_info.jars + jars/*.jar。 */
function modJars(modDir) {
  const out = [];
  const info = path.join(modDir, 'mod_info.json');
  if (fs.existsSync(info)) {
    const text = fs.readFileSync(info, 'utf8');
    const m = text.match(/"jars"\s*:\s*\[([\s\S]*?)\]/);
    if (m) {
      for (const x of m[1].match(/"([^"]+)"/g) || []) {
        const rel = x.slice(1, -1);
        const p = path.join(modDir, rel);
        if (fs.existsSync(p)) out.push(p);
      }
    }
  }
  const dir = path.join(modDir, 'jars');
  if (fs.existsSync(dir)) {
    for (const n of fs.readdirSync(dir)) if (/\.jar$/i.test(n)) out.push(path.join(dir, n));
  }
  return [...new Set(out)];
}

/** 依赖 mod 的 jar（按 mod_info.dependencies 的 id 找目录，最多两层）。 */
function depJars(gameRoot, modDir) {
  const modsDir = path.join(gameRoot, 'mods');
  const out = [];
  const seen = new Set();
  function depsOf(dir) {
    const info = path.join(dir, 'mod_info.json');
    if (!fs.existsSync(info)) return [];
    const text = fs.readFileSync(info, 'utf8');
    const m = text.match(/"dependencies"\s*:\s*\[([\s\S]*?)\]/);
    if (!m) return [];
    return (m[1].match(/"id"\s*:\s*"([^"]+)"/g) || []).map((x) => x.split('"')[3]);
  }
  function visit(dir, depth) {
    if (depth > 2 || !fs.existsSync(dir)) return;
    for (const j of modJars(dir)) if (!out.includes(j)) out.push(j);
    for (const id of depsOf(dir)) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const n of fs.existsSync(modsDir) ? fs.readdirSync(modsDir) : []) {
        const info = path.join(modsDir, n, 'mod_info.json');
        if (!fs.existsSync(info)) continue;
        const got = (fs.readFileSync(info, 'utf8').match(/"id"\s*:\s*"([^"]+)"/) || [])[1];
        if (got === id) { visit(path.join(modsDir, n), depth + 1); break; }
      }
    }
  }
  visit(modDir, 1);
  return out;
}

/** 所有要索引的 jar。 */
export function collectJars({ gameRoot, modDir }) {
  const out = [];
  const core = gameRoot ? path.join(gameRoot, 'starsector-core') : null;
  if (core && fs.existsSync(core)) {
    for (const n of fs.readdirSync(core)) if (/\.jar$/i.test(n)) out.push(path.join(core, n));
  }
  if (modDir) out.push(...depJars(gameRoot, modDir));
  return [...new Set(out)];
}

/** 缓存文件位置：cacheDir 优先，否则临时目录（不写 skill 目录）。 */
export function classmapCache(skillRoot, data) {
  const dir = cacheDirOf(skillRoot, data || {});
  return dir ? path.join(dir, 'classmap.json') : path.join(process.env.TEMP || '.', 'ssmod-classmap.json');
}

/** 建/读索引；只重扫 key 变了的 jar。 */
export function buildIndex({ jars, apiZip, cacheFile, rebuild = false }) {
  let cache = { v: 1, jars: {}, zip: null };
  if (!rebuild && fs.existsSync(cacheFile)) {
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = { v: 1, jars: {}, zip: null }; }
    if (cache.v !== 1) cache = { v: 1, jars: {}, zip: null };
  }

  const next = { v: 1, jars: {}, zip: cache.zip };
  for (const jar of jars) {
    const key = jarKey(jar);
    const old = cache.jars[jar];
    if (!rebuild && old && old.key === key) {
      next.jars[jar] = old;
      continue;
    }
    try {
      const { classes, java } = scanJar(jar);
      next.jars[jar] = { key, classes, java };
    } catch {
      // 坏 jar 跳过，不阻断索引
    }
  }

  if (apiZip && fs.existsSync(apiZip)) {
    const key = jarKey(apiZip);
    if (rebuild || !cache.zip || cache.zip.key !== key || cache.zip.path !== apiZip) {
      try { next.zip = { path: apiZip, key, fqcns: scanApiZip(apiZip) }; } catch { next.zip = cache.zip; }
    }
  }

  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(next), 'utf8');
  } catch {
    // 缓存写不了不影响查询
  }
  return next;
}

/** 目标 mod 的源码类：data/scripts 下按 package 行取 FQCN。 */
export function scanModSources(modDir) {
  const out = [];
  const root = path.join(modDir, 'data', 'scripts');
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.java$/i.test(n)) {
        const text = fs.readFileSync(p, 'utf8');
        const pkg = (text.match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1] || '';
        const cls = n.replace(/\.java$/i, '');
        out.push({ fqcn: pkg ? `${pkg}.${cls}` : cls, file: p });
      }
    }
  };
  walk(root);
  return out;
}

/** 查类：返回去重后的候选，带来源与遮蔽标记。 */
export function findCandidates(keyword, { index, modDir }) {
  const k = keyword.toLowerCase();
  const hit = new Map();
  const add = (fqcn, origin, detail) => {
    if (!fqcn.toLowerCase().includes(k)) return;
    const cur = hit.get(fqcn) || { fqcn, origins: [], details: [] };
    if (!cur.origins.includes(origin)) cur.origins.push(origin);
    if (detail && !cur.details.includes(detail)) cur.details.push(detail);
    hit.set(fqcn, cur);
  };
  if (index.zip) for (const f of index.zip.fqcns) add(f, 'zip', index.zip.path);
  const jarJava = new Set();
  const jarClass = new Set();
  for (const [jar, v] of Object.entries(index.jars)) {
    for (const f of v.java) jarJava.add(f);
    for (const c of v.classes) { jarClass.add(c.fqcn); add(c.fqcn, 'jar', jar); }
  }
  const sources = modDir ? scanModSources(modDir) : [];
  for (const s of sources) add(s.fqcn, 'src', s.file);
  for (const c of hit.values()) {
    const src = c.origins.includes('src');
    const jar = c.origins.includes('jar');
    const zip = c.origins.includes('zip');
    if (src && jar) c.kind = 'source+jar';
    else if (src) c.kind = 'source-only';
    else if (jar && jarJava.has(c.fqcn)) c.kind = 'source-in-jar';
    else if (jar) c.kind = 'jar-only';
    else c.kind = 'source-only';
    if (zip) c.kind += '+zip';
  }
  return [...hit.values()].sort((a, b) => {
    const la = a.fqcn.split('.').pop().toLowerCase() === k ? 0 : 1;
    const lb = b.fqcn.split('.').pop().toLowerCase() === k ? 0 : 1;
    return la - lb || a.fqcn.length - b.fqcn.length || a.fqcn.localeCompare(b.fqcn);
  });
}

/** javap 用的 classpath：本体 jar + mod jar。 */
export function classPath({ gameRoot, modDir }) {
  return collectJars({ gameRoot, modDir }).join(path.delimiter);
}

/** 源码与 jar 同名的遮蔽检查（W 级，不阻断）。 */
export function shadowWarnings(modDir, index) {
  const out = [];
  const sources = scanModSources(modDir);
  for (const [jar, v] of Object.entries(index.jars)) {
    const set = new Set(v.classes.map((c) => c.fqcn));
    for (const s of sources) {
      if (set.has(s.fqcn)) out.push({ file: s.file, fqcn: s.fqcn, jar });
    }
  }
  return out;
}
