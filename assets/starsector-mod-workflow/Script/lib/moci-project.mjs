import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listEntries } from './zip.mjs';

export const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const defaultConfig = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'starsector-projects', 'moci.json');
export const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function inside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

// Strip comments without corrupting strings; Starsector also accepts trailing commas.
export function stripComments(text) {
  let out = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (quoted) {
      out += c;
      if (c === '\\') out += text[++i] || '';
      else if (c === '"') quoted = false;
    } else if (c === '"') { quoted = true; out += c; }
    else if (c === '#' || (c === '/' && next === '/')) {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') out += '\n';
        i++;
      }
      i++;
    } else out += c;
  }
  return out;
}

export function readModInfo(root) {
  const clean = stripComments(fs.readFileSync(path.join(root, 'mod_info.json'), 'utf8').replace(/^\uFEFF/, ''));
  // Only remove trailing commas outside strings.
  const normalized = clean.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, token => token[0] === '"' ? token : '');
  return JSON.parse(normalized);
}

export function walk(root, extensions) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(file, extensions));
    else if (!extensions || extensions.includes(path.extname(file).toLowerCase())) out.push(file);
  }
  return out.sort();
}

export function loadProject(configFile = process.env.SSMOD_CONFIG || defaultConfig) {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (config.profile !== 'moci-maven') throw new Error('配置 profile 必须是 moci-maven');
  const base = path.dirname(path.resolve(configFile));
  const resolve = value => value ? path.resolve(base, value) : null;
  const p = { ...config, configFile: path.resolve(configFile) };
  for (const key of ['projectRoot', 'sourceRoot', 'mod', 'gameRoot', 'gameMod', 'jdkHome', 'maven', 'buildArtifact', 'workRoot']) p[key] = resolve(config[key]);
  if (!p.projectRoot || !fs.existsSync(path.join(p.projectRoot, 'pom.xml'))) throw new Error('projectRoot 必须指向含 pom.xml 的 Moci 源码工程');
  p.sourceRoot ||= path.join(p.projectRoot, 'src');
  p.mod ||= path.join(p.projectRoot, 'MociShipPack');
  p.workRoot ||= path.join(p.projectRoot, '.work', 'MociShipPack');
  if (!inside(p.projectRoot, p.sourceRoot) || !inside(p.projectRoot, p.mod)) throw new Error('源码与发布包必须位于 projectRoot 内');
  p.info = readModInfo(p.mod);
  if (p.info.id !== 'moci_shippack') throw new Error('工作区目标不是主 mod moci_shippack');
  if (!p.buildArtifact || !inside(path.join(p.projectRoot, 'target'), p.buildArtifact)) throw new Error('buildArtifact 必须位于工程 target 目录');
  p.workspaceJar = path.join(p.mod, 'jars', 'MociShipPack.jar');
  return p;
}

export function toolEnv(p) {
  return { ...process.env, JAVA_HOME: p.jdkHome, PATH: path.join(p.jdkHome, 'bin') + path.delimiter + process.env.PATH, SSMOD_CONFIG: p.configFile };
}

// Pass paths and arguments as data to PowerShell; never compose a command from them.
export function runTool(executable, args, p, timeout = 120000) {
  const options = { cwd: p.projectRoot, env: toolEnv(p), encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 24 * 1024 * 1024 };
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)) {
    options.env.SSMOD_TOOL_PATH = executable;
    options.env.SSMOD_TOOL_ARGS = JSON.stringify(args);
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$toolArgumentsForMoci = @(ConvertFrom-Json -InputObject $env:SSMOD_TOOL_ARGS); & $env:SSMOD_TOOL_PATH @toolArgumentsForMoci; exit $LASTEXITCODE'], options);
  }
  return spawnSync(executable, args, options);
}

export function requireSuccess(result, label) {
  if (result.error || result.status !== 0) throw new Error(`${label}失败（${result.error?.message || result.status}）\n${result.stderr || ''}\n${result.stdout || ''}`);
}

// Moci uses both Maven-built classes and game-loaded sources outside the Maven tree.
export function sourceRoots(p) {
  const roots = [{ root: p.sourceRoot, kind: 'maven-source' }];
  for (const relative of ['data', 'com']) roots.push({ root: path.join(p.mod, relative), kind: 'mod-runtime-source' });
  if (p.gameRoot) roots.push({ root: path.join(p.gameRoot, 'starsector-core', 'data'), kind: 'game-runtime-source' });
  return roots.filter(item => fs.existsSync(item.root));
}

// Read declared top-level type names: a source filename's casing need not equal its class name.
export function declaredJavaTypes(text) {
  const masked = text.replace(/"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    token => token.replace(/[^\r\n]/g, ' '));
  const pkg = masked.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
  if (!pkg) return [];
  const tokens = masked.match(/[A-Za-z_$][\w$]*|[{}.]/g) || [];
  const types = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '{') depth++;
    else if (tokens[i] === '}') depth--;
    else if (depth === 0 && tokens[i - 1] !== '.' && ['class', 'interface', 'enum', 'record'].includes(tokens[i]) && /^[A-Za-z_$][\w$]*$/.test(tokens[i + 1] || '')) types.push(pkg + '.' + tokens[i + 1]);
  }
  return types;
}

export function sourceIndex(p) {
  const index = new Map();
  for (const { root } of sourceRoots(p)) {
    for (const file of walk(root, ['.java'])) {
      for (const fqcn of declaredJavaTypes(fs.readFileSync(file, 'utf8'))) {
        if (!index.has(fqcn)) index.set(fqcn, file);
      }
    }
  }
  return index;
}

export function dependencyJars(p) {
  const pom = fs.readFileSync(path.join(p.projectRoot, 'pom.xml'), 'utf8');
  const paths = [...pom.matchAll(/<systemPath>\s*([^<]+)\s*<\/systemPath>/g)].map(m => m[1].trim().replaceAll('${project.basedir}', p.projectRoot));
  return [...new Set(paths.map(file => path.resolve(p.projectRoot, file)))];
}

export function dependencyClasses(p) {
  const index = new Map();
  for (const jar of dependencyJars(p)) {
    if (!fs.existsSync(jar)) continue;
    for (const entry of listEntries(fs.readFileSync(jar))) {
      if (!entry.name.endsWith('.class') || entry.name.startsWith('META-INF/')) continue;
      const fqcn = entry.name.slice(0, -6).replaceAll('/', '.');
      if (!index.has(fqcn)) index.set(fqcn, jar);
    }
  }
  return index;
}

// A failed process query blocks deployment; an unknown state must not count as stopped.
export function gameState(p) {
  if (process.platform !== 'win32') throw new Error('游戏进程检查仅支持 Windows');
  const script = "$ErrorActionPreference = 'Stop'; @(Get-CimInstance Win32_Process -Filter \"Name = 'java.exe' OR Name = 'javaw.exe' OR Name = 'starsector.exe'\" | Where-Object { $_.Name -eq 'starsector.exe' -or ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($env:SSMOD_GAME_ROOT, [System.StringComparison]::OrdinalIgnoreCase)) -or $_.CommandLine -match 'starfarer|starsector-core' } | Select-Object ProcessId,Name) | ConvertTo-Json -Compress";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, SSMOD_GAME_ROOT: p.gameRoot }, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  requireSuccess(result, '游戏运行状态检查');
  const parsed = result.stdout.trim() ? JSON.parse(result.stdout.replace(/^\uFEFF/, '')) : [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function deploymentTargets(p, { includeGame = true } = {}) {
  const workspaceMod = fs.realpathSync(p.mod);
  if (!inside(fs.realpathSync(p.projectRoot), workspaceMod)) throw new Error('工作区 mod 目录链接越界');
  if (readModInfo(workspaceMod).id !== 'moci_shippack') throw new Error('工作区 mod ID 不匹配，拒绝覆盖');
  const targets = [p.workspaceJar];
  let actualMod;
  if (includeGame) {
    if (!p.gameRoot || !p.gameMod) throw new Error('未绑定 gameRoot/gameMod，不能同步 JAR');
    const gameMods = fs.realpathSync(path.join(p.gameRoot, 'mods'));
    actualMod = fs.realpathSync(p.gameMod);
    if (!inside(gameMods, actualMod) || actualMod === gameMods) throw new Error('游戏目标必须位于绑定游戏的 mods 目录内');
    if (readModInfo(actualMod).id !== 'moci_shippack') throw new Error('游戏目标 mod ID 不匹配，拒绝覆盖');
    targets.push(path.join(actualMod, 'jars', 'MociShipPack.jar'));
  }
  for (const target of targets) {
    const jarDir = fs.realpathSync(path.dirname(target));
    const root = target === p.workspaceJar ? workspaceMod : actualMod;
    if (!inside(root, jarDir)) throw new Error('JAR 目录链接指向了 mod 外部');
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('目标 JAR 是符号链接，拒绝覆盖');
  }
  return targets;
}

// Default to the workspace; game publication requires explicit per-operation approval.
export function deployJar(p, state = gameState, { includeGame = false, gameApproved = false } = {}) {
  if (includeGame && !gameApproved) throw new Error('同步到游戏目录前需要用户确认；尚未写入任何目标');
  const targets = deploymentTargets(p, { includeGame });
  const publicationState = includeGame ? state : () => [];
  if (publicationState(p).length) throw new Error('游戏正在运行，已保留构建产物；退出游戏后再确认同步');
  const entries = listEntries(fs.readFileSync(p.buildArtifact));
  const pluginClass = p.info.modPlugin.replaceAll('.', '/') + '.class';
  if (!entries.some(e => e.name === pluginClass)) throw new Error('构建 JAR 缺少主插件类，拒绝发布');
  return publishFiles(p, targets.map(target => ({ source: p.buildArtifact, target })), publicationState);
}

// Sync only explicitly listed mod assets; never mirror, delete, or include unrelated dirty files.
export function resourcePlan(p, files) {
  deploymentTargets(p);
  if (!files.length) throw new Error('sync 需要至少一个 --file（工程相对路径，例如 MociShipPack/data/...）');
  const realMod = fs.realpathSync(p.mod), realGameMod = fs.realpathSync(p.gameMod);
  const allowed = new Set(['data', 'graphics', 'sounds']);
  const pairs = [];
  for (const file of files) {
    const source = path.resolve(p.projectRoot, file);
    if (!inside(p.mod, source) || !fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error('资源源文件必须是工作区主 mod 中的现有文件：' + file);
    const relative = path.relative(p.mod, source);
    const top = relative.split(path.sep)[0];
    if (!allowed.has(top) && !['mod_info.json', 'mod_info.json.version'].includes(relative)) throw new Error('不支持的资源目录：' + relative);
    if (/\.(class|jar)$/i.test(relative)) throw new Error('sync 不发布字节码/JAR；Maven 源码请使用 build');
    if (!inside(realMod, fs.realpathSync(source))) throw new Error('资源源文件链接越界：' + file);
    const target = path.resolve(p.gameMod, relative);
    let ancestor = path.dirname(target);
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    if (!inside(realGameMod, fs.realpathSync(ancestor))) throw new Error('游戏资源目录链接越界：' + relative);
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('游戏资源是符号链接：' + relative);
    if (!pairs.some(item => item.target === target)) pairs.push({ source, target });
  }
  return pairs;
}

export function syncResources(p, files, state = gameState, { gameApproved = false } = {}) {
  if (!gameApproved) throw new Error('同步到游戏目录前需要用户确认；可先查看 sync 清单');
  const pairs = resourcePlan(p, files);
  return publishFiles(p, pairs, state);
}

// Every file uses the same backup, staging, conflict-detection, and rollback path.
function publishFiles(p, pairs, state) {
  if (state(p).length) throw new Error('游戏正在运行，尚未同步文件；退出游戏后重试');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
  const backupDir = path.join(p.workRoot, 'backups', 'deploy-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  const staged = [];
  try {
    for (let i = 0; i < pairs.length; i++) {
      const { source, target } = pairs[i], existed = fs.existsSync(target);
      const digest = sha256(source);
      const backup = path.join(backupDir, `${i}-${path.basename(target)}`);
      const priorHash = existed ? sha256(target) : null;
      if (existed) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
      const temp = path.join(path.dirname(target), `.moci-deploy-${stamp}-${i}.tmp`);
      const item = { source, target, backup, priorHash, digest, existed, temp, committed: false };
      staged.push(item);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, temp, fs.constants.COPYFILE_EXCL);
      if (sha256(temp) !== digest) throw new Error('暂存 JAR 哈希不一致');
    }
    for (const item of staged) {
      // Windows scanners can briefly hold a freshly written file. Retry the
      // atomic replacement, checking state and conflicts again on every attempt.
      for (let attempt = 0; ; attempt++) {
        if (state(p).length) throw new Error('同步期间游戏启动，取消发布');
        const current = fs.existsSync(item.target) ? sha256(item.target) : null;
        if (current !== item.priorHash) throw new Error('目标文件被其他程序修改，取消发布');
        try { fs.renameSync(item.temp, item.target); break; }
        catch (error) {
          if (process.platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
      }
      item.committed = true;
      if (sha256(item.target) !== item.digest) throw new Error('发布后文件哈希不一致');
    }
    const receipt = { at: new Date().toISOString(), files: staged.map(i => ({ source: i.source, target: i.target, sha256: i.digest, backup: i.existed ? i.backup : null, priorHash: i.priorHash })) };
    fs.writeFileSync(path.join(backupDir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    return { ...receipt, receipt: path.join(backupDir, 'receipt.json') };
  } catch (error) {
    const rollbackErrors = [];
    for (const item of staged.filter(i => i.committed).reverse()) {
      try {
        if (item.existed) fs.copyFileSync(item.backup, item.target);
        else fs.unlinkSync(item.target);
      } catch (rollback) { rollbackErrors.push(`${item.target}: ${rollback.message}`); }
    }
    throw new Error(error.message + (rollbackErrors.length ? '\n回滚失败，备份在 ' + backupDir + '\n' + rollbackErrors.join('\n') : '\n已回滚本次覆盖；备份在 ' + backupDir));
  } finally {
    for (const item of staged) if (fs.existsSync(item.temp)) fs.unlinkSync(item.temp);
  }
}
