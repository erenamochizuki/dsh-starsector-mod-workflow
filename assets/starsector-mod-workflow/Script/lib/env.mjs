/**
 * env：环境探测：工具链、javac 编译探针、janino、依赖 mod、日志、绑定与缓存。
 * 只读；不下载；不探 pwsh（DSH 依赖）。
 */
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cacheDirOf, ensureDir } from './work.mjs';

/** 解码子进程输出：UTF-8 优先，坏字节回退 GBK（JDK8 控制台是 GBK）。 */
function decode(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('gbk').decode(buf);
  } catch {
    return utf8;
  }
}

/** 跑一条命令并把输出落到临时文件（沙箱下父进程收管道会 EPERM）。 */
export function capture(cmd, args, { cwd, timeout = 30000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssmod-env-'));
  const outFile = path.join(dir, 'out.txt');
  const errFile = path.join(dir, 'err.txt');
  const fo = fs.openSync(outFile, 'w');
  const fe = fs.openSync(errFile, 'w');
  try {
    const r = spawnSync(cmd, args, {
      cwd,
      timeout,
      windowsHide: true,
      stdio: ['ignore', fo, fe],
    });
    return {
      status: r.status,
      error: r.error || null,
      stdout: decode(fs.readFileSync(outFile)),
      stderr: decode(fs.readFileSync(errFile)),
    };
  } finally {
    fs.closeSync(fo);
    fs.closeSync(fe);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 在 PATH（以及给定的 bin 目录）里找一个可执行文件；preferDir 优先。 */
export function resolveTool(name, { jdkHome, preferDir } = {}) {
  const exts = (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean);
  const dirs = [];
  if (preferDir) dirs.push(preferDir);
  if (jdkHome) dirs.push(path.join(jdkHome, 'bin'));
  for (const d of (process.env.PATH || '').split(path.delimiter)) if (d) dirs.push(d);
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext.toLowerCase());
      if (fs.existsSync(p)) return p;
      const q = path.join(dir, name + ext);
      if (fs.existsSync(q)) return q;
    }
  }
  return null;
}

/** 读一个工具的版本号；java/javac/javap 用 -version，jar 先试 --version。 */
export function toolVersion(exe, kind = 'java') {
  if (!exe) return { path: null, version: null, raw: '' };
  let r = capture(exe, kind === 'jar' ? ['--version'] : ['-version']);
  if (kind === 'jar' && (r.status !== 0 || !/\d/.test(r.stdout + r.stderr))) {
    r = capture(exe, ['-version']);
  }
  const raw = `${r.stdout}\n${r.stderr}`;
  const m = raw.match(/(\d+(?:\.\d+){1,3})(?=[_\s."]|$)/);
  let version = m ? m[1] : null;
  if (!version) {
    // JDK8 的 jar 没有版本开关；读取 JDK 的 release 文件作为备用。
    const release = path.join(path.dirname(exe), '..', 'release');
    if (fs.existsSync(release)) {
      const rv = fs.readFileSync(release, 'utf8').match(/JAVA_VERSION="([^"]+)"/);
      if (rv) version = rv[1];
    }
  }
  return { path: exe, version, raw: raw.trim(), status: r.status };
}

/** 版本号主次：17 > 8。 */
export function majorOf(version) {
  if (!version) return 0;
  const parts = version.split('.').map((x) => parseInt(x, 10) || 0);
  if (parts[0] === 1) return parts[1] || 0;
  return parts[0] || 0;
}

/** javac 编译探针：能 import 本体 API，才说明 classpath 真可读。 */
export function javacProbe({ javac, coreDir, probeBase }) {
  if (!javac) {
    return { ok: false, detail: '未找到 javac（只影响 mod-test/探针；janino 编译不受影响）' };
  }
  if (!coreDir || !fs.existsSync(coreDir)) {
    return { ok: false, detail: `找不到本体目录：${coreDir || '（未绑定 gameRoot）'}` };
  }
  const dir = path.join(probeBase, 'javac-probe');
  try {
    ensureDir(dir);
    const src = path.join(dir, 'Probe.java');
    fs.writeFileSync(src, [
      'import com.fs.starfarer.api.Global;',
      '',
      '/** 探针：只验证 javac 能读到本体 API。 */',
      'public class Probe {',
      '    public static Class<?> api() {',
      '        return Global.class;',
      '    }',
      '}',
      '',
    ].join('\n'), 'utf8');
    const outDir = path.join(dir, 'out');
    ensureDir(outDir);
    const r = capture(javac, ['--release', '8', '-encoding', 'UTF-8', '-cp', path.join(coreDir, '*'), '-d', outDir, src], { timeout: 60000 });
    if (r.status === 0) return { ok: true, detail: 'javac --release 8 编译 import com.fs.starfarer.api.Global 成功' };
    const text = `${r.stderr}\n${r.stdout}`.trim();
    const line = text.split(/\r?\n/).find((x) => /error|错误|wrong version|invalid/i.test(x)) || text.split(/\r?\n/)[0] || '未知错误';
    return { ok: false, detail: line.trim() };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 从 mod_info 文本里取版本：字符串或 {major,minor,patch} 对象。 */
export function modVersionFromText(text) {
  const s = text.match(/"version"\s*:\s*"([^"]*)"/);
  if (s) return s[1];
  const o = text.match(/"version"\s*:\s*\{([^}]*)\}/);
  if (o) {
    const n = (k) => {
      const m = o[1].match(new RegExp(`"${k}"\\s*:\\s*"?([0-9]+)"?`));
      return m ? m[1] : '';
    };
    return [n('major'), n('minor'), n('patch')].filter(Boolean).join('.');
  }
  return '';
}

/** 扫 mods 目录，找出 Nexerelin / LunaLib 及版本。 */
export function scanMods(modsDir) {
  const out = { nexerelin: null, lunalib: null };
  if (!modsDir || !fs.existsSync(modsDir)) return out;
  for (const name of fs.readdirSync(modsDir)) {
    const info = path.join(modsDir, name, 'mod_info.json');
    if (!fs.existsSync(info)) continue;
    let text = '';
    try { text = fs.readFileSync(info, 'utf8'); } catch { continue; }
    const id = (text.match(/"id"\s*:\s*"([^"]+)"/) || [])[1] || '';
    const ver = modVersionFromText(text);
    const title = (text.match(/"name"\s*:\s*"([^"]+)"/) || [])[1] || name;
    const low = (id + ' ' + name).toLowerCase();
    if (low.includes('nexerelin')) out.nexerelin = { dir: name, id, version: ver, name: title };
    if (low.includes('lunalib')) out.lunalib = { dir: name, id, version: ver, name: title };
  }
  return out;
}

/** 找 starsector.log（本体在 starsector-core\ 下）。 */
export function findLog(gameRoot) {
  if (!gameRoot) return null;
  const candidates = [
    path.join(gameRoot, 'starsector-core', 'starsector.log'),
    path.join(gameRoot, 'starsector.log'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const st = fs.statSync(p);
      return { path: p, size: st.size, mtime: st.mtime.toISOString() };
    }
  }
  return null;
}

/** 缓存目录可写性：写一个临时文件再删。 */
function writable(dir) {
  if (!dir) return { ok: false, detail: '无缓存目录' };
  try {
    ensureDir(dir);
    const f = path.join(dir, '.doctor-write-test');
    fs.writeFileSync(f, 'ok', 'utf8');
    fs.rmSync(f, { force: true });
    return { ok: true, detail: '可写' };
  } catch (e) {
    return { ok: false, detail: e.code || e.message };
  }
}

/** 从 java -XshowSettings 找同版本 JDK 的 home（javapath 是转发器，父目录不是 JDK）。 */
export function discoverJdkHome(javaExe) {
  if (!javaExe) return null;
  const r = capture(javaExe, ['-XshowSettings:properties', '-version']);
  const m = `${r.stdout}\n${r.stderr}`.match(/java\.home\s*=\s*([^\r\n]+)/);
  const home = m && m[1].trim();
  const has = (d) => !!d && fs.existsSync(path.join(d, 'bin', 'javac.exe'));
  if (has(home)) return home;
  if (home && has(path.dirname(home))) return path.dirname(home);
  return null;
}

/** 汇总环境报告；缺项只记 W，不抛错。 */
export function envReport({ skillRoot, data, jdk }) {
  const jdkHome = jdk || (data && (data.jdkHome || data.jdk)) || null;
  const gameRoot = (data && data.gameRoot) || null;
  const coreDir = gameRoot ? path.join(gameRoot, 'starsector-core') : null;
  const modsDir = gameRoot ? path.join(gameRoot, 'mods') : null;
  const cacheDir = cacheDirOf(skillRoot, data || {});
  const cache = writable(cacheDir);
  const probeBase = cache.ok ? path.join(cacheDir, 'probe') : path.join(os.tmpdir(), 'ssmod-probe');
  const warnings = [];

  const tools = {};
  const javaOnPath = resolveTool('java', { jdkHome });
  const discovered = jdkHome ? null : discoverJdkHome(javaOnPath);
  const effectiveJdk = jdkHome || discovered;
  const binDir = effectiveJdk ? path.join(effectiveJdk, 'bin') : null;
  for (const name of ['java', 'javac', 'javap', 'jar']) {
    const exe = resolveTool(name, { jdkHome: effectiveJdk, preferDir: binDir });
    tools[name] = toolVersion(exe, name);
  }
  const janino = coreDir && fs.existsSync(coreDir)
    ? fs.readdirSync(coreDir).filter((f) => /^janino.*\.jar$|^commons-compiler.*\.jar$/i.test(f))
    : [];
  const jc = majorOf(tools.javac.version);
  const mixed = ['java', 'javap', 'jar'].some((k) => tools[k].version && majorOf(tools[k].version) !== jc);
  if (jc && mixed) warnings.push('java/javap/jar 与 javac 主版本不一致，工具链来自不同 JDK');
  const probe = javacProbe({ javac: tools.javac.path, coreDir, probeBase });
  const mods = scanMods(modsDir);
  const log = findLog(gameRoot);

  if (!gameRoot) warnings.push('未绑定 gameRoot，本体 API / 日志 / janino 都无法探测');
  if (!tools.javac.path) warnings.push('未找到 javac；mod-test/探针不可用（janino 编译仍可用）');
  if (tools.javac.version && majorOf(tools.javac.version) < 17) warnings.push(`javac 是 ${tools.javac.version}，探针需要 JDK17+`);
  if (!probe.ok) warnings.push('javac 编译探针失败：' + probe.detail);
  if (coreDir && janino.length < 2) warnings.push('本体目录缺 janino.jar / commons-compiler.jar');
  if (!log) warnings.push('找不到 starsector.log（还没启动过游戏？）');
  if (!cache.ok) warnings.push('缓存目录不可写：' + cache.detail);
  if (!mods.nexerelin) warnings.push('未检测到 Nexerelin（只用原版 API 时可忽略）');

  return {
    node: { version: process.version, ok: true },
    jdkHome: effectiveJdk,
    jdkSource: jdkHome ? 'explicit' : discovered ? 'auto' : null,
    tools,
    probe,
    janino,
    mods,
    log,
    cache: { dir: cacheDir, ...cache },
    warnings,
  };
}

/** 把环境报告渲染成给人看的行。 */
export function renderEnv(env) {
  const lines = [];
  const ver = (t) => (t.path ? `${t.version || '?'}  ${t.path}` : '未找到');
  lines.push(`环境：node ${env.node.version}`);
  lines.push(`  java   ${ver(env.tools.java)}`);
  lines.push(`  javac  ${ver(env.tools.javac)}${env.jdkHome ? `（${env.jdkSource === 'auto' ? '自动发现' : 'jdkHome'}：${env.jdkHome}）` : ''}`);
  lines.push(`  javap  ${ver(env.tools.javap)}`);
  lines.push(`  jar    ${ver(env.tools.jar)}`);
  lines.push(`  探针   ${env.probe.ok ? 'ok' : '失败'}：${env.probe.detail}`);
  lines.push(`  janino ${env.janino.length ? env.janino.join('、') : '未找到'}`);
  const m = env.mods || {};
  lines.push(`  依赖   Nexerelin ${m.nexerelin ? m.nexerelin.version : '未找到'}；LunaLib ${m.lunalib ? m.lunalib.version : '未找到'}`);
  lines.push(`  日志   ${env.log ? `${env.log.path}  ${(env.log.size / 1048576).toFixed(1)} MB  ${env.log.mtime}` : '未找到'}`);
  lines.push(`  缓存   ${env.cache.dir || '（无）'}  ${env.cache.ok ? '可写' : '不可写：' + env.cache.detail}`);
  return lines;
}
