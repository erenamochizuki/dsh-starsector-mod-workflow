#!/usr/bin/env node
/**
 * stamp：doctor 戳：证明“环境已自检、文档已发现”。
 *
 * 戳落在 <mods>\.work\<mod>\cache\doctor.json，内容含：
 *   version / schema / at / gameRoot / configHash / skillHash / node / platform
 * configHash 与 skillHash 任一变化即视为过期；改 .work\config.json、改脚本、换版本都会失效。
 *
 * 用法：import { checkStamp, writeStamp, stampPath } from './lib/stamp.mjs'
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readData, configFileOf, modCacheOf, ensureDir } from './work.mjs';

export function shortHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export function skillHash(skillRoot) {
  const files = [];
  for (const name of ['SKILL.md', 'META.json']) {
    const f = path.join(skillRoot, name);
    if (fs.existsSync(f)) files.push(f);
  }
  const scriptDir = path.join(skillRoot, 'Script');
  if (fs.existsSync(scriptDir)) {
    for (const name of fs.readdirSync(scriptDir).sort()) {
      if (name.endsWith('.mjs')) files.push(path.join(scriptDir, name));
    }
  }
  const lines = files.map((f) => {
    const st = fs.statSync(f);
    return `${path.relative(skillRoot, f)}=${st.size}@${Math.round(st.mtimeMs)}`;
  });
  return shortHash(lines.join('\n'));
}

export function configHash(skillRoot) {
  const f = configFileOf(skillRoot);
  if (!f) return 'none';
  return shortHash(fs.readFileSync(f, 'utf8'));
}

/** 兼容旧名。 */
export function dataHash(skillRoot) {
  return configHash(skillRoot);
}

export function stampPath(skillRoot, data) {
  const dir = modCacheOf(data || readData(skillRoot));
  return dir ? path.join(dir, 'doctor.json') : null;
}

export function writeStamp(skillRoot) {
  const data = readData(skillRoot);
  if (!data || !data.mod) return { ok: false, reason: '未绑定 mod（先运行 doctor --game <游戏根> --mod <mod 目录>）' };
  const target = stampPath(skillRoot, data);
  if (!target) return { ok: false, reason: '无法从配置解析 .work 目录' };
  const mod = path.resolve(data.mod);
  if (!fs.existsSync(mod)) return { ok: false, reason: `mod 目录不存在：${mod}` };
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(skillRoot, 'META.json'), 'utf8'));
  } catch {
    meta = {};
  }
  const stamp = {
    version: meta.version || null,
    schema: meta.schema || null,
    at: new Date().toISOString(),
    gameRoot: data.gameRoot || null,
    configHash: configHash(skillRoot),
    skillHash: skillHash(skillRoot),
    node: process.version,
    platform: process.platform,
  };
  try {
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, JSON.stringify(stamp, null, 2), 'utf8');
    return { ok: true, file: target, stamp };
  } catch (e) {
    return { ok: false, reason: e.message, file: target };
  }
}

export function checkStamp(skillRoot, { maxAgeHours = 24 } = {}) {
  const data = readData(skillRoot);
  if (!data || !data.mod) return { ok: false, unbound: true, reason: '未绑定 mod（先运行 doctor --game <游戏根> --mod <mod 目录>）' };
  const file = stampPath(skillRoot, data);
  if (!file) return { ok: false, reason: '配置里没有 mod，无法定位戳' };
  if (!fs.existsSync(file)) return { ok: false, reason: `没有 doctor 戳：${file}` };
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { ok: false, reason: `戳不是合法 JSON：${e.message}` };
  }
  if (stamp.skillHash !== skillHash(skillRoot)) {
    return { ok: false, reason: '技能文件已变化（skillHash 不符），重跑 doctor', file };
  }
  if (stamp.configHash !== configHash(skillRoot)) {
    return { ok: false, reason: '配置已变化（configHash 不符），重跑 doctor', file };
  }
  const ageH = (Date.now() - Date.parse(stamp.at)) / 3600000;
  if (!Number.isFinite(ageH) || ageH > maxAgeHours) {
    return { ok: false, reason: `戳已过期（${Math.round(ageH)}h > ${maxAgeHours}h），重跑 doctor`, file };
  }
  return { ok: true, file, stamp };
}

/** 缺戳只提示、不阻塞（compile / verify 用）。 */
export function warnStamp(skillRoot, label) {
  const r = checkStamp(skillRoot);
  if (r.ok) return r;
  console.error(`  ! ${label}：${r.reason}${r.unbound ? '' : '（可运行 node Script\\doctor.mjs 刷新）'}`);
  return r;
}
