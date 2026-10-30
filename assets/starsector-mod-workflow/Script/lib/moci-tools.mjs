import fs from 'node:fs';
import path from 'node:path';
import { csvTable } from '../../GATE/csv.mjs';
import { listRecipes, readRecipe, render, pascal } from './recipes.mjs';
import { readData } from './work.mjs';
import { skillRoot, loadProject, walk, stripComments, sourceIndex, sourceRoots, inside, dependencyClasses, dependencyJars, runTool, requireSuccess, deploymentTargets, deployJar, resourcePlan, syncResources } from './moci-project.mjs';

function parse(args) {
  const values = new Map(), flags = new Set(), positional = [];
  const switches = new Set(['json', 'info', 'env', 'no-deploy', 'dry-run', 'dry', 'write', 'code', 'public', 'list', 'game-approved']);
  const valued = new Set(['file', 'log', 'top', 'id', 'name', 'pkg', 'class', 'desc', 'icon']);
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { positional.push(args[i]); continue; }
    const name = args[i].slice(2);
    if (switches.has(name)) flags.add(name);
    else if (valued.has(name)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('缺少参数值：' + args[i]);
      if (!values.has(name)) values.set(name, []);
      values.get(name).push(args[++i]);
    } else throw new Error('Moci 模式不支持参数：' + args[i]);
  }
  return { flags, values, positional, value: name => values.get(name)?.at(-1) };
}

function validateTarget(p, supplied) {
  if (supplied && ![p.projectRoot, p.mod].some(root => path.resolve(supplied) === root)) throw new Error('此配置仅绑定 Moci 主工程；目标参数不匹配');
}

export function doctor(p) {
  const errors = [], notes = [];
  if (Number(process.versions.node.split('.')[0]) < 18) errors.push('需要 Node.js 18+');
  if (!p.jdkHome || !fs.existsSync(path.join(p.jdkHome, 'bin', 'javac.exe'))) errors.push('JDK 配置不可用');
  if (!p.maven || !fs.existsSync(p.maven)) errors.push('Maven 配置不可用');
  if (!fs.existsSync(p.sourceRoot)) errors.push('源码目录不存在');
  for (const jar of dependencyJars(p)) if (!fs.existsSync(jar)) errors.push('缺少 Maven systemPath 依赖：' + jar);
  if (!errors.length) {
    const result = runTool(p.maven, ['-version'], p, 30000);
    if (result.error || result.status !== 0) errors.push('Maven 无法使用绑定 JDK 启动：' + (result.error?.message || result.stderr));
    else notes.push((result.stdout || '').trim());
  }
  if (p.gameRoot && p.gameMod) {
    try { deploymentTargets(p); } catch (error) { errors.push(error.message); }
  } else notes.push('未绑定游戏；可离线编译，build 同步不可用');
  return { profile: 'moci-maven', config: p.configFile, projectRoot: p.projectRoot, sourceRoot: p.sourceRoot, sourceRoots: sourceRoots(p), mod: p.mod, gameRoot: p.gameRoot, gameMod: p.gameMod, jdkHome: p.jdkHome, maven: p.maven, buildArtifact: p.buildArtifact, workRoot: p.workRoot, javaFiles: walk(p.sourceRoot, ['.java']).length, defaultAfterJava: { mavenSource: 'build → MociShipPack 工作区 JAR；游戏同步先询问', runtimeSource: '先修改 MociShipPack 中的源码；游戏同步先询问；单独验证运行时编译/加载' }, gameSyncRequiresApproval: true, notes, errors, ok: errors.length === 0 };
}

export function verify(p, selected = []) {
  const sources = sourceIndex(p), classes = dependencyClasses(p);
  const roots = sourceRoots(p);
  const findings = [];
  const runtimeResolvedReferences = [];
  const checkedFiles = [];
  const exists = fqcn => sources.has(fqcn) || classes.has(fqcn) || classes.has(fqcn.replace(/\.([^.]+)$/, '$$$1'));
  const include = file => !selected.length || selected.some(s => path.resolve(p.projectRoot, s) === file);
  const add = (file, line, message) => findings.push({ file, line, message });
  const ref = (file, line, fqcn) => {
    if (fqcn && !exists(fqcn)) add(file, line, '在 Maven 源码、mod 目录的运行时源码、游戏原版运行时源码和 Maven 依赖中未找到该类：' + fqcn);
    const source = sources.get(fqcn);
    const origin = source && roots.find(item => inside(item.root, source));
    if (origin && origin.kind !== 'maven-source') runtimeResolvedReferences.push({ file, line, fqcn, source, kind: origin.kind });
  };
  for (const file of walk(p.mod, ['.wpn', '.system', '.json']).filter(include)) {
    if (path.extname(file) === '.json' && path.basename(file) !== 'mod_info.json') continue;
    checkedFiles.push(file);
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    for (const match of text.matchAll(/"?(everyFrameEffect|beamEffect|statsScript|modPlugin)"?\s*:\s*"([\w.$]+)"/g)) ref(file, text.slice(0, match.index).split('\n').length, match[2]);
  }
  for (const rel of ['data/hullmods/hull_mods.csv', 'data/campaign/abilities.csv', 'data/config/abilities.csv', 'data/campaign/rules.csv']) {
    const file = path.join(p.mod, rel);
    if (!fs.existsSync(file) || !include(file)) continue;
    checkedFiles.push(file);
    const table = csvTable(fs.readFileSync(file, 'utf8'));
    if (!table) continue;
    for (const error of table.errors) add(file, error.line, error.msg);
    const seen = new Map();
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i], line = table.lineOf(i);
      if (row.id) {
        if (seen.has(row.id)) add(file, line, `重复 id：${row.id}（首次在 ${seen.get(row.id)} 行）`);
        else seen.set(row.id, line);
      }
      if (rel.endsWith('hull_mods.csv')) ref(file, line, row.script);
      if (rel.endsWith('abilities.csv')) ref(file, line, row.plugin);
    }
  }
  const unhandledFiles = selected.map(file => path.resolve(p.projectRoot, file)).filter(file => !checkedFiles.includes(file));
  return { findings, checkedFiles, unhandledFiles, runtimeResolvedReferences, sourceRoots: roots, sourceClasses: sources.size, dependencyClasses: classes.size, scope: selected.length ? selected : '全部受支持的接线文件', limitations: '仅检查上述目录中的声明类来源、上述 CSV 引号与重复 id；找到源码不代表 Janino 已编译通过，也不推断类加载优先级。unhandledFiles 不在此工具覆盖范围。未执行编译、行为测试或游戏验收，也不把 rules.csv 的 options 当作命令解析。' };
}

export function scaffold(p, recipeId, options) {
  const recipe = readRecipe(recipeId);
  const id = options.value('id');
  if (!id || !/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) throw new Error('需要 --id，且只能包含字母、数字、下划线');
  const defaults = { hullmod: 'data.hullmods', shipsystem: 'data.shipsystems.scripts', 'weapon-effect': 'data.scripts.weapons', 'beam-effect': 'data.scripts.weapons', 'blast-fx': 'data.scripts.weapons', 'dialog-rule': 'com.fs.starfarer.api.impl.campaign.rulecmd', intel: 'data.campaign.intel', 'industry-colony': 'data.campaign', 'monthly-store': 'data.scripts.impl' };
  const pkg = options.value('pkg') || defaults[recipe.id] || recipe.pkg;
  const cls = options.value('class') || 'Moci_' + pascal(id.replace(/^moci_/i, '')) + (recipe.classSuffix || '');
  if (!/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/.test(pkg) || !/^[A-Za-z_]\w*$/.test(cls)) throw new Error('非法 Java 包名或类名');
  const vars = { PACKAGE: pkg, CLASS: cls, PKG_PATH: pkg.replaceAll('.', '/'), FQCN: pkg + '.' + cls, ID: id, NAME: options.value('name') || id, DESC: options.value('desc') || options.value('name') || id, ICON: options.value('icon') || recipe.iconDefault || 'graphics/icons/' + id + '.png', MOD_ROOT: p.mod, SUFFIX: recipe.classSuffix || '' };
  const files = (recipe.produces || []).map(item => {
    const relative = render(item.path, vars), java = relative.endsWith('.java');
    const root = java ? p.sourceRoot : p.mod;
    const target = path.resolve(root, relative);
    const rel = path.relative(root, target);
    if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep)) throw new Error('模板目标越界');
    let ancestor = path.dirname(target);
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const realRoot = fs.realpathSync(root), realAncestor = fs.realpathSync(ancestor);
    const physical = path.relative(realRoot, realAncestor);
    if (path.isAbsolute(physical) || physical === '..' || physical.startsWith('..' + path.sep)) throw new Error('模板目录链接越界');
    const template = path.resolve(recipe.dir, item.template || recipe.skeleton || 'SKELETON.java');
    const templateRel = path.relative(recipe.dir, template);
    if (templateRel.startsWith('..') || path.isAbsolute(templateRel)) throw new Error('模板源路径越界');
    const content = render(fs.readFileSync(template, 'utf8'), vars);
    if (/\{\{[A-Z_]+\}\}/.test(content)) throw new Error('模板存在未替换参数：' + target);
    if (fs.existsSync(target)) throw new Error('目标已存在，未覆盖：' + target);
    return { target, content };
  });
  // Validate the entire plan before creating any file; existing CSV/JSON stay untouched.
  if (options.flags.has('write')) for (const file of files) {
    fs.mkdirSync(path.dirname(file.target), { recursive: true });
    fs.writeFileSync(file.target, file.content, { encoding: 'utf8', flag: 'wx' });
  }
  return { recipe: recipe.id, written: options.flags.has('write'), files, wiring: (recipe.wiring || []).map(item => render(JSON.stringify(item), vars)), note: '接线按 Moci 现有数据格式人工合并；生成骨架后仍需实现并验证。' };
}

export function scanLog(p, file, top = 20) {
  const candidates = file ? [path.resolve(file)] : [path.join(p.gameRoot, 'starsector-core', 'starsector.log'), path.join(p.gameRoot, 'starsector.log')];
  const log = candidates.find(candidate => fs.existsSync(candidate));
  if (!log) throw new Error('找不到游戏日志，可用 --log 指定');
  const sources = sourceIndex(p), frames = [], seen = new Set();
  for (const line of fs.readFileSync(log, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*at\s+([\w.$]+)\.([\w$<>]+)\(([\w$]+)\.java:(\d+)\)/);
    if (!match) continue;
    const owner = match[1].split('$')[0], source = sources.get(owner);
    const key = source + ':' + match[4] + ':' + match[2];
    if (source && !seen.has(key)) { seen.add(key); frames.push({ file: source, line: Number(match[4]), method: match[2] }); }
  }
  return { log, totalMappedFrames: frames.length, frames: frames.slice(-top).reverse(), note: '映射已记录的栈帧，不据此自动断定根因。' };
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

export async function runMoci(command, args = []) {
  if (['help', '--help', '-h'].includes(command)) {
    console.log('Moci 工作台：doctor | compile | build [--no-deploy|--dry-run] [--game-approved] | verify [--file 工作区相对路径] | sync --file 工作区相对路径 [--file ...] [--dry-run|--game-approved] | api-src | api-grep | find-class | javap | logscan [--log 文件] | templates | new <配方> --id id [--write] | preview\n默认更新工作区；sync 默认只展示清单。只有用户明确确认本次游戏同步后，才可使用 --game-approved。');
    return 0;
  }
  const supported = new Set(['doctor', 'compile', 'build', 'wrapup', 'verify', 'sync', 'api-src', 'api-grep', 'find-class', 'javap', 'logscan', 'templates', 'new', 'preview']);
  if (!supported.has(command)) throw new Error('Moci 模式未适配命令：' + command + '。运行 moci.mjs help 查看入口；原版 SPEC/审批/维护流程不自动执行。');
  const p = loadProject();
  if (['api-src', 'api-grep', 'preview'].includes(command)) {
    const result = runTool(process.execPath, [path.join(skillRoot, 'Script', command + '.mjs'), ...args], p);
    printResult(result);
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  const o = parse(args);
  if (command === 'doctor') {
    const report = doctor(p);
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }
  if (command === 'compile' || command === 'build' || command === 'wrapup') {
    validateTarget(p, o.positional[0]);
    const build = command !== 'compile';
    const includeGame = o.flags.has('game-approved');
    if (includeGame && (!build || o.flags.has('no-deploy'))) throw new Error('--game-approved 仅适用于发布 JAR 的 build/wrapup，不能与 --no-deploy 同用');
    const shouldDeploy = build && !o.flags.has('no-deploy') && (includeGame || p.autoUpdateWorkspaceJar !== false);
    const goals = build ? ['-B', '-q', '-DskipTests', 'clean', 'package'] : ['-B', '-q', '-DskipTests', 'compile'];
    if (o.flags.has('dry-run')) {
      console.log(JSON.stringify({ maven: p.maven, cwd: p.projectRoot, jdk: p.jdkHome, goals, sync: shouldDeploy ? deploymentTargets(p, { includeGame }) : [], gameSyncRequiresApproval: true, gameSyncApproved: includeGame, gameTarget: p.gameMod }, null, 2));
      return 0;
    }
    const result = runTool(p.maven, goals, p);
    printResult(result);
    requireSuccess(result, 'Maven ' + (build ? '打包' : '编译'));
    if (shouldDeploy) console.log(JSON.stringify({ ...deployJar(p, undefined, { includeGame, gameApproved: includeGame }), gameSynced: includeGame, gameSyncRequiresApproval: true }, null, 2));
    else console.log(build ? 'Maven 打包通过；保留在 target，未更新发布包或游戏。' : 'Maven 编译通过；交付时使用 build 更新工作区 JAR，游戏同步另行确认。');
    return 0;
  }
  if (command === 'verify') {
    validateTarget(p, o.positional[0]);
    const report = verify(p, o.values.get('file') || []);
    console.log(JSON.stringify(report, null, 2));
    return report.findings.length ? 1 : report.unhandledFiles.length ? 2 : 0;
  }
  if (command === 'sync') {
    const files = o.values.get('file') || [];
    const approved = o.flags.has('game-approved');
    const planOnly = o.flags.has('dry-run') || !approved;
    console.log(JSON.stringify(planOnly ? { files: resourcePlan(p, files), dryRun: true, approvalRequired: !approved, notice: approved ? '仅预览，未写入游戏' : '尚未同步游戏；先向用户展示本次清单并询问，确认后才可使用 --game-approved' } : syncResources(p, files, undefined, { gameApproved: true }), null, 2));
    return 0;
  }
  if (command === 'logscan') {
    console.log(JSON.stringify(scanLog(p, o.value('log') || o.positional[0], Number(o.value('top')) || 20), null, 2));
    return 0;
  }
  if (command === 'templates') {
    console.log(JSON.stringify(listRecipes().map(recipe => ({ id: recipe.id, title: recipe.title, produces: recipe.produces })), null, 2));
    return 0;
  }
  if (command === 'new') {
    const report = scaffold(p, o.positional[0], o);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  if (command === 'find-class' || command === 'javap') {
    const query = o.positional[0];
    if (!query) throw new Error('需要类名');
    const sources = sourceIndex(p), classes = dependencyClasses(p);
    const hits = [...new Set([...sources.keys(), ...classes.keys()])].filter(fqcn => fqcn.toLowerCase().includes(query.toLowerCase()));
    if (command === 'find-class') {
      console.log(JSON.stringify(hits.map(fqcn => ({ fqcn, source: sources.get(fqcn), jar: classes.get(fqcn) })), null, 2));
      return hits.length ? 0 : 2;
    }
    const exact = hits.filter(fqcn => fqcn === query || fqcn.split('.').at(-1) === query);
    if (exact.length !== 1) throw new Error('类名不唯一或不存在，请先 find-class 并使用全限定名');
    if (sources.has(exact[0]) && !inside(p.sourceRoot, sources.get(exact[0])) && !classes.has(exact[0])) throw new Error('这是游戏运行时加载的源码，不在 Maven 编译范围；请直接查看 ' + sources.get(exact[0]) + '。javap 仅适用于已有字节码。');
    const cp = [path.join(p.projectRoot, 'target', 'classes'), ...dependencyJars(p)].join(path.delimiter);
    const result = runTool(path.join(p.jdkHome, 'bin', 'javap.exe'), ['-classpath', cp, o.flags.has('public') ? '-public' : '-p', ...(o.flags.has('code') ? ['-c'] : []), exact[0]], p);
    printResult(result);
    requireSuccess(result, 'javap（本工程类需要先 compile）');
    return 0;
  }
  throw new Error('Moci 模式未适配命令：' + command + '。运行 moci.mjs help 查看入口；原版 SPEC/审批/维护流程不自动执行。');
}

// Existing core entrypoints forward to the Moci profile instead of silently using data/scripts.
export async function dispatchMoci(command) {
  if (readData(skillRoot)?.profile !== 'moci-maven') return;
  try { process.exit(await runMoci(command, process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exit(1); }
}
