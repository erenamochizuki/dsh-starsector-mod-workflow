#!/usr/bin/env node
// Exercise deployment and source/data routing only in a fresh temporary project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeZip } from './lib/zipwrite.mjs';
import { loadProject, deployJar, syncResources, sha256, gameState, readModInfo, sourceIndex, declaredJavaTypes } from './lib/moci-project.mjs';
import { verify, scaffold, scanLog } from './lib/moci-tools.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moci-skill-test-'));
const project = path.join(root, '工程 with spaces');
const mod = path.join(project, 'MociShipPack');
const game = path.join(root, '游戏 with spaces');
const gameMod = path.join(game, 'mods', 'Moci的随意之作');
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const info = { id: 'moci_shippack', modPlugin: 'data.scripts.Main' };
write(path.join(project, 'pom.xml'), '<project><build><sourceDirectory>src</sourceDirectory></build></project>');
write(path.join(mod, 'mod_info.json'), JSON.stringify(info));
write(path.join(gameMod, 'mod_info.json'), JSON.stringify(info));
write(path.join(project, 'src', 'data', 'scripts', 'Main.java'), 'package data.scripts; public class Main {}');
write(path.join(project, 'src', 'data', 'hullmods', 'Existing.java'), 'package data.hullmods; public class Existing {}');
write(path.join(mod, 'jars', 'MociShipPack.jar'), 'old workspace');
write(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'old game');
fs.mkdirSync(path.join(project, 'target'), { recursive: true });
const artifact = path.join(project, 'target', 'moci.jar');
writeZip(artifact, [{ name: 'data/scripts/Main.class', data: Buffer.from('fixture class') }]);
const configFile = path.join(root, 'config.json');
write(configFile, JSON.stringify({ profile: 'moci-maven', projectRoot: project, sourceRoot: path.join(project, 'src'), mod, gameRoot: game, gameMod, jdkHome: process.env.JAVA_HOME || project, maven: path.join(root, 'maven.cmd'), buildArtifact: artifact }));
const p = loadProject(configFile), stopped = () => [];
const approvedGameJar = { includeGame: true, gameApproved: true };
const approvedGameResources = { gameApproved: true };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const setOldJars = () => { write(p.workspaceJar, 'old workspace'); write(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'old game'); };

test('top-level mod ID does not match a dependency ID', () => {
  write(path.join(gameMod, 'mod_info.json'), '{"id":"expansion","dependencies":[{"id":"moci_shippack"}],}');
  assert.equal(readModInfo(gameMod).id, 'expansion');
  assert.throws(() => deployJar(p, stopped, approvedGameJar), /ID/);
  write(path.join(gameMod, 'mod_info.json'), JSON.stringify(info));
});
test('successful JAR deployment updates both targets and retains backups', () => {
  const result = deployJar(p, stopped, approvedGameJar);
  assert.equal(result.files.length, 2);
  for (const file of result.files) { assert.equal(sha256(file.target), sha256(artifact)); assert.ok(fs.existsSync(file.backup)); }
  assert.ok(fs.existsSync(result.receipt));
});
test('running game prevents all overwrites', () => {
  setOldJars();
  assert.throws(() => deployJar(p, () => [{ ProcessId: 123 }], approvedGameJar), /运行/);
  assert.equal(fs.readFileSync(p.workspaceJar, 'utf8'), 'old workspace');
  assert.equal(fs.readFileSync(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'utf8'), 'old game');
});
test('interrupted second commit rolls back the first JAR', () => {
  setOldJars(); let calls = 0;
  assert.throws(() => deployJar(p, () => ++calls === 4 ? [{ ProcessId: 123 }] : [], approvedGameJar), /回滚/);
  assert.equal(fs.readFileSync(p.workspaceJar, 'utf8'), 'old workspace');
  assert.equal(fs.readFileSync(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'utf8'), 'old game');
});
test('default JAR publication updates only the workspace and needs no game binding or process query', () => {
  setOldJars();
  const offline = { ...p, gameRoot: null, gameMod: null };
  const result = deployJar(offline, () => { throw new Error('Must not query the game for a workspace-only update'); });
  assert.equal(result.files.length, 1);
  assert.equal(sha256(p.workspaceJar), sha256(artifact));
  assert.equal(fs.readFileSync(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'utf8'), 'old game');
});
test('game JAR publication without approval stops before writing either copy', () => {
  setOldJars();
  assert.throws(() => deployJar(p, stopped, { includeGame: true }), /确认/);
  assert.equal(fs.readFileSync(p.workspaceJar, 'utf8'), 'old workspace');
  assert.equal(fs.readFileSync(path.join(gameMod, 'jars', 'MociShipPack.jar'), 'utf8'), 'old game');
});
test('resource sync without approval does not change the game', () => {
  write(path.join(mod, 'data', 'pending.csv'), 'pending resource');
  write(path.join(gameMod, 'data', 'pending.csv'), 'old resource');
  assert.throws(() => syncResources(p, ['MociShipPack/data/pending.csv'], stopped), /确认/);
  assert.equal(fs.readFileSync(path.join(gameMod, 'data', 'pending.csv'), 'utf8'), 'old resource');
});
test('resource sync CLI without approval only produces a reviewable plan', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'moci.mjs');
  const result = spawnSync(process.execPath, [script, 'sync', '--file', 'MociShipPack/data/pending.csv'], { env: { ...process.env, SSMOD_CONFIG: configFile }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.files.length, 1);
  assert.equal(fs.readFileSync(path.join(gameMod, 'data', 'pending.csv'), 'utf8'), 'old resource');
});
test('build and legacy wrapup default to the workspace and show the game as a separate approval', () => {
  for (const name of ['moci.mjs', 'wrapup.mjs']) {
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), name);
    const args = name === 'moci.mjs' ? ['build', '--dry-run'] : ['--dry-run'];
    const result = spawnSync(process.execPath, [script, ...args], { env: { ...process.env, SSMOD_CONFIG: configFile }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.deepEqual(plan.sync, [p.workspaceJar]);
    assert.equal(plan.gameSyncRequiresApproval, true);
    assert.equal(plan.gameSyncApproved, false);
  }
});
test('resource sync touches only its explicit list and supports new subdirectories', () => {
  write(path.join(mod, 'data', 'config', 'changed.csv'), 'new resource');
  write(path.join(gameMod, 'data', 'keep.csv'), 'keep unchanged');
  syncResources(p, ['MociShipPack/data/config/changed.csv'], stopped, approvedGameResources);
  assert.equal(fs.readFileSync(path.join(gameMod, 'data', 'config', 'changed.csv'), 'utf8'), 'new resource');
  assert.equal(fs.readFileSync(path.join(gameMod, 'data', 'keep.csv'), 'utf8'), 'keep unchanged');
  assert.throws(() => syncResources(p, ['src/data/scripts/Main.java'], stopped, approvedGameResources), /资源源文件/);
});
test('resource sync publishes multiple files in the same directory without staging collisions', () => {
  const musicDir = path.join(gameMod, 'sounds', 'moci', 'music');
  write(path.join(mod, 'sounds', 'moci', 'music', 'theme.ogg'), 'new theme');
  write(path.join(mod, 'sounds', 'moci', 'music', 'combat.ogg'), 'new combat');
  write(path.join(musicDir, 'theme.ogg'), 'old theme');
  write(path.join(musicDir, 'keep.ogg'), 'keep music');
  const result = syncResources(p, ['MociShipPack/sounds/moci/music/theme.ogg', 'MociShipPack/sounds/moci/music/combat.ogg'], stopped, approvedGameResources);
  assert.equal(result.files.length, 2);
  assert.equal(fs.readFileSync(path.join(musicDir, 'theme.ogg'), 'utf8'), 'new theme');
  assert.equal(fs.readFileSync(path.join(musicDir, 'combat.ogg'), 'utf8'), 'new combat');
  assert.equal(fs.readFileSync(path.join(musicDir, 'keep.ogg'), 'utf8'), 'keep music');
  assert.equal(fs.readFileSync(result.files[0].backup, 'utf8'), 'old theme');
  assert.equal(result.files[1].backup, null);
  assert.equal(fs.readdirSync(musicDir).some(file => file.startsWith('.moci-deploy-')), false);
});
test('multi-output templates use Java and JSON templates in the correct roots', () => {
  const options = { flags: new Set(['write']), value: key => ({ id: 'moci_test', name: '测试' })[key] };
  const report = scaffold(p, 'shipsystem', options);
  const java = report.files.find(file => file.target.endsWith('.java'));
  const system = report.files.find(file => file.target.endsWith('.system'));
  assert.ok(java.target.startsWith(p.sourceRoot + path.sep));
  assert.match(fs.readFileSync(java.target, 'utf8'), /测试/);
  assert.equal(JSON.parse(fs.readFileSync(system.target, 'utf8')).statsScript, 'data.shipsystems.scripts.Moci_Test');
  const before = sha256(java.target);
  assert.throws(() => scaffold(p, 'shipsystem', options), /已存在/);
  assert.equal(sha256(java.target), before);
});
test('wiring checks handle source packages and unquoted Starsector enum values', () => {
  const valid = path.join(mod, 'data', 'weapons', 'valid.wpn');
  const invalid = path.join(mod, 'data', 'weapons', 'invalid.wpn');
  write(valid, '{"type": SMOOTH, "everyFrameEffect": "data.hullmods.Existing"}');
  write(invalid, '{"type": SMOOTH, "everyFrameEffect": "data.hullmods.Missing"}');
  assert.equal(verify(p, [path.relative(project, valid)]).findings.length, 0);
  assert.equal(verify(p, [path.relative(project, invalid)]).findings.length, 1);
});
test('runtime hullmod sources resolve by their declared class, including filename case differences', () => {
  const source = path.join(mod, 'data', 'hullmods', 'RuntimeEasytobreak.java');
  write(source, 'package data.hullmods; public class RuntimeEasyToBreak {}');
  write(path.join(mod, 'data', 'hullmods', 'hull_mods.csv'), 'id,script\nruntime,data.hullmods.RuntimeEasyToBreak\n');
  const result = verify(p, ['MociShipPack/data/hullmods/hull_mods.csv']);
  assert.equal(result.findings.length, 0);
  assert.equal(result.runtimeResolvedReferences[0].source, source);
  assert.equal(result.runtimeResolvedReferences[0].kind, 'mod-runtime-source');
  assert.equal(sourceIndex(p).has('data.hullmods.RuntimeEasytobreak'), false);
});
test('mod and vanilla runtime system sources resolve without masking truly missing classes', () => {
  write(path.join(mod, 'data', 'shipsystems', 'scripts', 'RuntimeDrive.java'), 'package data.shipsystems.scripts; public class RuntimeDrive {}');
  write(path.join(game, 'starsector-core', 'data', 'shipsystems', 'scripts', 'VanillaFeed.java'), 'package data.shipsystems.scripts; public class VanillaFeed {}');
  const selected = [];
  for (const name of ['RuntimeDrive', 'VanillaFeed', 'StillMissing']) {
    const relative = 'MociShipPack/data/shipsystems/' + name + '.system';
    write(path.join(project, relative), JSON.stringify({ statsScript: 'data.shipsystems.scripts.' + name }));
    selected.push(relative);
  }
  const result = verify(p, selected);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].message, /StillMissing/);
  assert.deepEqual(new Set(result.runtimeResolvedReferences.map(item => item.kind)), new Set(['mod-runtime-source', 'game-runtime-source']));
});
test('Java indexing ignores comments, strings, class literals and nested declarations', () => {
  const text = 'package data.hullmods; /* class CommentFake {} */ public class Outer { String s = "class StringFake {}"; Class c = Object.class; class Inner {} } // class LineFake {}\n interface Helper {}';
  assert.deepEqual(declaredJavaTypes(text), ['data.hullmods.Outer', 'data.hullmods.Helper']);
});
test('runtime Java sync preserves other game files and backs up the previous source', () => {
  const relative = 'MociShipPack/data/hullmods/RuntimeEasytobreak.java';
  const target = path.join(gameMod, 'data', 'hullmods', 'RuntimeEasytobreak.java');
  write(target, 'old runtime source');
  const result = syncResources(p, [relative], stopped, approvedGameResources);
  assert.equal(result.files.length, 1);
  assert.equal(fs.readFileSync(target, 'utf8'), fs.readFileSync(path.join(project, relative), 'utf8'));
  assert.equal(fs.readFileSync(result.files[0].backup, 'utf8'), 'old runtime source');
  assert.equal(fs.readFileSync(path.join(gameMod, 'data', 'keep.csv'), 'utf8'), 'keep unchanged');
});
test('CSV dialog options are not interpreted as Java commands', () => {
  write(path.join(mod, 'data', 'campaign', 'rules.csv'), 'id,trigger,conditions,script,text,options,notes\nrow,PopulateOptions,,,,10:moci_test:测试,\n');
  assert.equal(verify(p, ['MociShipPack/data/campaign/rules.csv']).findings.length, 0);
});
test('unsupported selected files are explicitly reported as unchecked', () => {
  write(path.join(mod, 'data', 'hulls', 'ship_data.csv'), 'id,name\nexample,Example\n');
  const result = verify(p, ['MociShipPack/data/hulls/ship_data.csv']);
  assert.equal(result.checkedFiles.length, 0);
  assert.equal(result.unhandledFiles.length, 1);
});
test('log mapping finds inner-class frames in the real src tree', () => {
  const log = path.join(game, 'starsector-core', 'starsector.log');
  write(log, '\tat data.hullmods.Existing$1.advance(Existing.java:42)\n');
  const report = scanLog(p);
  assert.equal(report.frames[0].file, path.join(project, 'src', 'data', 'hullmods', 'Existing.java'));
  assert.equal(report.frames[0].line, 42);
});
test('log mapping also finds runtime hullmod sources by declared class', () => {
  write(path.join(game, 'starsector-core', 'starsector.log'), '\tat data.hullmods.RuntimeEasyToBreak$1.advance(RuntimeEasytobreak.java:17)\n');
  const report = scanLog(p);
  assert.equal(report.frames[0].file, path.join(mod, 'data', 'hullmods', 'RuntimeEasytobreak.java'));
  assert.equal(report.frames[0].line, 17);
});
test('legacy compile command redirects to Maven plan without publishing', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compile.mjs');
  const result = spawnSync(process.execPath, [script, '--dry-run'], { env: { ...process.env, SSMOD_CONFIG: configFile }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.cwd, project);
  assert.ok(plan.goals.includes('compile'));
  assert.deepEqual(plan.sync, []);
});
test('real Windows game process query returns a process list', () => {
  if (process.platform === 'win32') assert.ok(Array.isArray(gameState(p)));
});
test('obsolete approval entrypoints stop without creating task files', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'spec.mjs');
  const result = spawnSync(process.execPath, [script, '--approve'], { env: { ...process.env, SSMOD_CONFIG: configFile }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(path.join(project, '.work', 'MociShipPack', 'tasks')), false);
});
console.log(JSON.stringify({ passed, isolatedWorkspace: root, note: 'All publication targets were temporary fixtures; no real mod files were deployed.' }, null, 2));
