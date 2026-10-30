// probe：一条命令体检：doctor --env + 本 mod 依赖 + 日志摘要 → PROBE.md。
// 用法：node Script\probe.mjs [--mod <目录>] [--jdk <JDK 目录>] [--out <PROBE.md>] [--json]
// 只读；不启动游戏；缺项记 W，不抛 E。
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('doctor');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readData, pathsOf } from './lib/work.mjs';
import { envReport, renderEnv, modVersionFromText } from './lib/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/** 容错读 JSON：去 // 注释、尾逗号。 */
function parseLoose(text) {
  const clean = text
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|#)/.test(l))
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(clean);
}

/** 按 id 找 mod 目录。 */
function findMod(modsDir, id) {
  if (!modsDir || !fs.existsSync(modsDir)) return null;
  for (const name of fs.readdirSync(modsDir)) {
    const info = path.join(modsDir, name, 'mod_info.json');
    if (!fs.existsSync(info)) continue;
    try {
      const text = fs.readFileSync(info, 'utf8');
      const got = (text.match(/"id"\s*:\s*"([^"]+)"/) || [])[1];
      if (got === id) {
        return { dir: path.join(modsDir, name), version: modVersionFromText(text), name };
      }
    } catch {
      // 单个 mod_info 读不了不影响整体
    }
  }
  return null;
}

/** 日志摘要：大小、错误数、最后几行。 */
function logSummary(log) {
  if (!log) return { ...log, errors: 0, tail: [] };
  const fd = fs.openSync(log.path, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const window = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(window);
    fs.readSync(fd, buf, 0, window, size - window);
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);
    const errors = lines.filter((l) => /\bERROR\b|Exception|Caused by/i.test(l)).length;
    return { ...log, size, errors, tail: lines.slice(-12) };
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  const json = process.argv.includes('--json');
  const data = readData(SKILL_ROOT) || {};
  const modDir = arg('--mod', data.mod);
  const jdk = arg('--jdk', data.jdkHome || data.jdk);
  const gameRoot = arg('--game', data.gameRoot);
  if (!modDir) {
    console.error('没有目标 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>，或用 --mod 指定。');
    process.exit(2);
  }
  const paths = pathsOf(data);
  const outFile = arg('--out', path.join(paths ? paths.reports : path.join(SKILL_ROOT, 'TASKS'), 'PROBE.md'));

  const env = envReport({ skillRoot: SKILL_ROOT, data: { ...data, gameRoot, mod: modDir }, jdk });
  const modsDir = gameRoot
    ? path.join(gameRoot, 'mods')
    : env.log
      ? path.join(path.dirname(path.dirname(env.log.path)), 'mods')
      : '';

  let info = null;
  const infoFile = path.join(modDir, 'mod_info.json');
  if (fs.existsSync(infoFile)) {
    try {
      info = parseLoose(fs.readFileSync(infoFile, 'utf8'));
    } catch (e) {
      env.warnings.push('mod_info.json 解析失败：' + e.message);
    }
  }
  const deps = [];
  for (const d of (info && info.dependencies) || []) {
    const got = findMod(modsDir, d.id);
    const ok = !!got;
    if (!ok) env.warnings.push(`依赖缺失：${d.id}${d.version ? '（要求 ' + d.version + '）' : ''}`);
    deps.push({ id: d.id, require: d.version || '', found: got ? got.version || '?' : '未找到', ok });
  }
  const log = logSummary(env.log);

  const report = {
    at: new Date().toISOString(),
    mod: { dir: modDir, id: info && info.id, name: info && info.name, version: info && info.version },
    deps,
    env,
    log,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const lines = [];
  lines.push(`# PROBE · ${report.at}`);
  lines.push('');
  lines.push('## 环境');
  lines.push('```text');
  for (const l of renderEnv(env)) lines.push(l);
  lines.push('```');
  lines.push('');
  lines.push('## 本 mod');
  lines.push(`- 目录：${modDir}`);
  lines.push(`- id：${(info && info.id) || '（缺 mod_info.json）'}；名称：${(info && info.name) || '?'}；版本：${(info && info.version) || '?'}`);
  if (deps.length) {
    lines.push('');
    lines.push('| 依赖 | 要求 | 实际 | 状态 |');
    lines.push('|---|---|---|---|');
    for (const d of deps) lines.push(`| ${d.id} | ${d.require || '-'} | ${d.found} | ${d.ok ? 'ok' : '缺失'} |`);
  } else {
    lines.push('- 依赖：无声明');
  }
  lines.push('');
  lines.push('## 日志');
  lines.push(log.path
    ? `- ${log.path}  ${(log.size / 1048576).toFixed(1)} MB  ${log.mtime}`
    : '- 未找到 starsector.log');
  if (log.path) {
    lines.push(`- 近 256 KB 错误行：${log.errors}`);
    lines.push('');
    lines.push('```text');
    for (const l of log.tail) lines.push(l);
    lines.push('```');
  }
  lines.push('');
  lines.push('## 结论');
  lines.push(env.warnings.length ? `- W ${env.warnings.length} 项：` : '- 环境无 W');
  for (const w of env.warnings) lines.push(`  - ${w}`);
  const depBad = deps.filter((d) => !d.ok).length;
  lines.push(depBad ? `- 依赖缺失 ${depBad} 个` : '- 依赖齐全');
  lines.push(`- 日志错误行 ${log.path ? log.errors : '?'}（只作提示，不等于本 mod 的问题）`);

  const target = path.resolve(SKILL_ROOT, outFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, lines.join('\n') + '\n', 'utf8');
  console.log(`PROBE 已生成：${target}`);
  console.log(`环境 W：${env.warnings.length}；依赖缺失：${depBad}；日志错误行：${log.path ? log.errors : '?'}`);
}

main();
