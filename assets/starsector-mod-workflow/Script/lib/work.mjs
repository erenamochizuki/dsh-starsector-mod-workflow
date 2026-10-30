#!/usr/bin/env node
/**
 * work：工作目录 / 配置的单一解析点。
 *
 * 布局（全部落在 <mods>\.work，skill 安装目录零写入）：
 *   <mods>\.work\config.json          绑定：gameRoot / mod / backupDir
 *   <mods>\.work\cache\               共享：classmap、API 抽取、反编译、janino 临时
 *   <mods>\.work\<mod目录名>\         每个 mod 一个分区
 *     cache\ tasks\ distill\ harvest\ note\{bug,work}\ backups\ reports\ verify\
 *
 * 配置发现顺序：SSMOD_CONFIG → 当前目录向上找 .work\config.json → skill 根 .work
 *               → 旧版 skill 根 data.json（读到后由 doctor --migrate 迁移）。
 * 旧字段 cacheDir / workDir 仍认，但新代码只写 paths。
 *
 * 用法：import { readData, pathsOf, cacheDirOf, workDirOf } from './lib/work.mjs'
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const IGNORED = ['.work', '.back', 'TASKS', 'HARVEST', 'DISTILL', 'dist'];

function resolveIn(root, p) {
  return path.isAbsolute(p) ? p : path.resolve(root, p);
}

function parseJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 可能存放配置的路径，按优先级。 */
export function configCandidates(skillRoot, startDir = process.cwd()) {
  const out = [];
  if (process.env.SSMOD_CONFIG) out.push(path.resolve(process.env.SSMOD_CONFIG));
  let d = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    out.push(path.join(d, 'mods', '.work', 'config.json'));
    out.push(path.join(d, '.work', 'config.json'));
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  out.push(path.join(skillRoot, '.work', 'config.json'));
  out.push(path.join(skillRoot, 'data.json'));
  out.push(path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'starsector-projects', 'moci.json'));
  return [...new Set(out)];
}

/** 当前生效的配置文件（不存在返回 null）。 */
export function configFileOf(skillRoot, startDir) {
  return configCandidates(skillRoot, startDir).find((f) => fs.existsSync(f)) || null;
}

export function readData(skillRoot, startDir) {
  const f = configFileOf(skillRoot, startDir);
  return f ? parseJson(f) : null;
}

/** 该 mod 的 .work 根（mods 目录下）。 */
export function workRootOf(data) {
  if (!data || !data.mod) return null;
  return path.join(path.dirname(path.resolve(data.mod)), '.work');
}

/** 该 mod 的分区目录。 */
export function modWorkOf(data) {
  const root = workRootOf(data);
  if (!root) return null;
  return path.join(root, path.basename(path.resolve(data.mod)));
}

/** 所有工作目录；未绑定 mod 时返回 null。 */
export function pathsOf(data) {
  if (!data || !data.mod) return null;
  const workRoot = workRootOf(data);
  const mine = modWorkOf(data);
  return {
    config: path.join(workRoot, 'config.json'),
    workRoot,
    modWork: mine,
    cache: path.join(workRoot, 'cache'),
    modCache: path.join(mine, 'cache'),
    tasks: path.join(mine, 'tasks'),
    distill: path.join(mine, 'distill'),
    harvest: path.join(mine, 'harvest'),
    note: path.join(mine, 'note'),
    backups: path.join(mine, 'backups'),
    reports: path.join(mine, 'reports'),
    verify: path.join(mine, 'verify'),
  };
}

/** 旧接口：某个 mod 的工作目录。 */
export function workDirOf(modDir, data) {
  if (data && data.workDir) return data.workDir;
  const p = path.resolve(modDir);
  return path.join(path.dirname(p), '.work', path.basename(p));
}

/** 旧接口：缓存目录。优先 data.cacheDir，其次共享 cache。 */
export function cacheDirOf(skillRoot, data) {
  if (!data) return null;
  if (data.cacheDir) return resolveIn(skillRoot, data.cacheDir);
  const root = workRootOf(data);
  if (root) return path.join(root, 'cache');
  if (data.backupDir) return path.join(resolveIn(skillRoot, data.backupDir), 'cache');
  return null;
}

/** 该 mod 私有的缓存（doctor 戳、编译临时）。 */
export function modCacheOf(data) {
  return pathsOf(data)?.modCache || null;
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function ensureWorkDirs(data) {
  const p = pathsOf(data);
  if (!p) return null;
  for (const d of [p.workRoot, p.modWork, p.cache, p.modCache, p.tasks, p.distill, p.harvest, p.note, path.join(p.note, 'bug'), path.join(p.note, 'work'), p.backups, p.reports, p.verify]) {
    ensureDir(d);
  }
  return p;
}

/** 写配置：优先写到已有配置文件；否则写到该 mod 的 .work\config.json。 */
export function saveData(data, skillRoot) {
  const existing = configFileOf(skillRoot);
  const target = existing && path.basename(existing) === 'config.json' ? existing : pathsOf(data)?.config;
  if (!target) throw new Error('没有 mod 字段，无法确定 .work\\config.json 的位置');
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return target;
}

/** 生成物/备份/任务目录一律不参与闸门与打包。 */
export function isIgnoredPath(p) {
  const parts = path.resolve(p).split(/[\\/]+/);
  return parts.some((s) => IGNORED.includes(s));
}

/** 把旧版散落在 skill 根的 TASKS/DISTILL/HARVEST 搬进 .work 分区（不覆盖已有）。 */
export function adoptLegacyDirs(skillRoot, data) {
  const p = pathsOf(data);
  if (!p) return [];
  const moved = [];
  for (const [name, dest] of [['TASKS', p.tasks], ['DISTILL', p.distill], ['HARVEST', p.harvest]]) {
    const src = path.join(skillRoot, name);
    if (!fs.existsSync(src)) continue;
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      const from = path.join(src, entry);
      const target = name === 'TASKS' && /^PROBE\.md$/i.test(entry) ? p.reports : dest;
      ensureDir(target);
      const to = path.join(target, entry);
      if (fs.existsSync(to)) continue;
      fs.renameSync(from, to);
      moved.push(`${name}/${entry}`);
    }
    try {
      if (!fs.readdirSync(src).length) fs.rmdirSync(src);
    } catch {
      /* 非空或占用，留着 */
    }
  }
  return moved;
}

export function describe(skillRoot) {
  const data = readData(skillRoot);
  const paths = pathsOf(data);
  return { data, config: configFileOf(skillRoot), workRoot: paths?.workRoot || null, paths };
}
