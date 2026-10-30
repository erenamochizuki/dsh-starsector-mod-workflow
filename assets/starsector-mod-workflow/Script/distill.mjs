// distill：把一次做完的案例蒸馏成可复用资产：来源哈希、资产台账、复制步骤、变体、教训。
// 用法：
//   node Script\distill.mjs TASKS\<id>                     # 开一份案例单（DISTILL\<id>\CASE.md）
//   node Script\distill.mjs TASKS\<id> --recipe <id> --java <X.java>   # 顺带回收成配方草稿
//   node Script\distill.mjs TASKS\<id> --block <id> --java <X.java>    # 抽纯逻辑块草稿
//   node Script\distill.mjs TASKS\<id> --ref <name>        # 生成 REF 骨架
//   node Script\distill.mjs TASKS\<id> --link rule=GATE\rules\r6-duplicate.mjs
//   node Script\distill.mjs --check                        # 校验：源哈希是否漂移、台账路径是否还在
// 原则：记录“当时的选择”，不是唯一解；新案例允许偏离，把差异写进「变体」即可。
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('distill');
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readData, pathsOf, ensureDir } from './lib/work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.dirname(HERE);

const argv = process.argv.slice(2);
const opts = new Map();
const links = [];
let source = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { source = a; continue; }
  const k = a.slice(2);
  if (k === 'force' || k === 'check' || k === 'json') { opts.set(k, true); continue; }
  const v = argv[i + 1];
  if (k === 'link') {
    if (!v || !v.includes('=')) fail('--link 写法：--link 类型=路径');
    const [type, ...rest] = v.split('=');
    links.push({ type, path: rest.join('=') });
    i++;
    continue;
  }
  opts.set(k, v);
  i++;
}

const root = path.resolve(opts.get('root') || SKILL_ROOT);
const testRoot = Boolean(opts.get('root'));
const cfg = testRoot ? null : readData(root);
const paths = testRoot ? null : pathsOf(cfg);
const DISTILL = testRoot ? path.join(root, 'DISTILL') : paths ? paths.distill : path.join(root, 'DISTILL');
const modRootAbs = cfg && cfg.mod ? path.resolve(cfg.mod) : null;
const workRootAbs = paths ? paths.modWork : null;

/** 台账路径：mod: / work: 前缀，其余绝对路径。 */
function storePath(p) {
  const abs = path.resolve(p);
  const under = (base) => {
    if (!base) return null;
    const r = path.relative(base, abs);
    return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.split(path.sep).join('/') : null;
  };
  const m = under(modRootAbs);
  if (m) return 'mod:' + m;
  const w = under(workRootAbs);
  if (w) return 'work:' + w;
  return abs;
}

function resolveStored(p) {
  const s = String(p);
  if (s.startsWith('mod:')) return path.join(modRootAbs || '', s.slice(4));
  if (s.startsWith('work:')) return path.join(workRootAbs || '', s.slice(5));
  return path.isAbsolute(s) ? s : path.join(root, s);
}

if (opts.get('check')) { runCheck(); process.exit(0); }
if (!source) fail('用法：node Script\\distill.mjs <任务 id 或 TASKS\\<id>> [--recipe|--block|--ref|--link]');

const sourceArg = path.resolve(source);
const sourcePath = fs.existsSync(sourceArg)
  ? sourceArg
  : paths && !testRoot
    ? path.join(paths.tasks, source.replace(/^.*[\\/]TASKS[\\/]/, ''))
    : path.resolve(root, source);
const isTask = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() && /[\\/]TASKS[\\/]/.test(sourcePath + path.sep);
const id = sanitize(opts.get('id') || (isTask ? path.basename(sourcePath) : stemOf(sourcePath)));
ensureDir(DISTILL);
const outDir = path.join(DISTILL, id);

const files = collectFiles(sourcePath);
const facts = readTask(sourcePath);
const assets = { recipe: null, block: null, ref: null, links: [] };

// 配方：直接调 harvest 出草稿，不自动进 KIT
const recipeId = opts.get('recipe');
const java = opts.get('java');
if (recipeId) {
  if (!java) fail('--recipe 需要 --java <源文件.java>');
  const r = spawnSync(process.execPath, [path.join(HERE, 'harvest.mjs'), '--file', path.resolve(java), '--id', recipeId,
    '--pkg', javaPkg(java) || facts.pkg || 'data.scripts'], { stdio: 'inherit' });
  if (r.status !== 0) fail(`harvest 失败（exit ${r.status}）`);
  assets.recipe = { id: recipeId, draft: `harvest/${recipeId}` };
}

// 积木：只出草稿，必须人工并进 LIB 并跑 lib-test
const blockId = opts.get('block');
if (blockId) {
  if (!java) fail('--block 需要 --java <源文件.java>');
  const src = fs.readFileSync(path.resolve(java), 'utf8');
  if (/import\s+(com\.fs|org\.lwjgl)/.test(src)) console.log('! 这段代码引用了游戏/渲染类，不是纯逻辑，不能直接进 LIB。');
  const dir = path.join(outDir, 'assets', 'block');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${blockId}.java`), src, 'utf8');
  fs.writeFileSync(path.join(dir, `${pascal(blockId)}Test.java`), testSkeleton(pascal(blockId)), 'utf8');
  assets.block = { id: blockId, java: storePath(path.join(dir, `${blockId}.java`)) };
  console.log(`积木草稿：${rel(path.join(dir, blockId + '.java'))}`);
}

// 参考：只建骨架，证据要人填
const refName = opts.get('ref');
if (refName) {
  const refFile = path.join(root, 'REF', `${refName}.md`);
  if (fs.existsSync(refFile) && !opts.get('force')) {
    console.log(`REF 已存在：REF/${refName}.md（要覆盖加 --force）`);
  } else {
    fs.mkdirSync(path.dirname(refFile), { recursive: true });
    fs.writeFileSync(refFile, refSkeleton(refName, facts), 'utf8');
    console.log(`REF 骨架：REF/${refName}.md`);
  }
  assets.ref = { name: refName, file: `REF/${refName}.md` };
}

for (const l of links) assets.links.push(l);

const exists = fs.existsSync(outDir);
const wantsAsset = Boolean(recipeId || blockId || refName || links.length);
if (exists && !opts.get('force') && !wantsAsset) {
  console.log(`案例单已存在：${rel(outDir)}`);
  console.log('继续编辑它；追加资产用 --recipe/--block/--ref/--link，重建加 --force（会覆盖已填内容）。');
  process.exit(3);
}

const caseJson = {
  id,
  at: new Date().toISOString(),
  source: { path: rel(sourcePath), task: facts.task, title: facts.title, lane: facts.lane, aCount: facts.aCount, gaps: facts.gaps },
  files: files.map((f) => ({ rel: f.rel, size: f.size, sha256: f.sha256 })),
  assets,
};
if (exists && !opts.get('force')) {
  mergeCase(caseJson);
} else {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'CASE.json'), JSON.stringify(caseJson, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'CASE.md'), caseMd(caseJson), 'utf8');
  console.log(`\n案例单：${rel(path.join(outDir, 'CASE.md'))}`);
}
console.log('接着填：结果 / 资产台账 / 变体 / 教训 / 边界（（待填）就是没填）。');
console.log('校验：node Script\\distill.mjs --check');

// ── 工具 ────────────────────────────────────────────────
function fail(msg) { console.error(msg); process.exit(2); }
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function sanitize(s) { return String(s).replace(/[^\w\u4e00-\u9fa5.-]+/g, '-').replace(/^-+|-+$/g, '') || 'case'; }
function stemOf(p) { return path.basename(p).replace(/\.[^.]+$/, ''); }
function pascal(s) { return String(s).split(/[^A-Za-z0-9\u4e00-\u9fa5]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(''); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function javaPkg(file) {
  try { return (fs.readFileSync(path.resolve(file), 'utf8').match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1] || ''; } catch { return ''; }
}
function esc(s) { return String(s).replace(/\|/g, '\\|'); }

function mergeCase(nu) {
  const jf = path.join(outDir, 'CASE.json');
  const md = path.join(outDir, 'CASE.md');
  const c = JSON.parse(fs.readFileSync(jf, 'utf8'));
  c.assets = c.assets || { links: [] };
  if (nu.assets.recipe) c.assets.recipe = nu.assets.recipe;
  if (nu.assets.block) c.assets.block = nu.assets.block;
  if (nu.assets.ref) c.assets.ref = nu.assets.ref;
  c.assets.links = c.assets.links || [];
  for (const l of nu.assets.links) {
    if (!c.assets.links.some((x) => x.type === l.type && x.path === l.path)) c.assets.links.push(l);
  }
  fs.writeFileSync(jf, JSON.stringify(c, null, 2) + '\n', 'utf8');
  let t = fs.readFileSync(md, 'utf8');
  const row = (label, status, pos, note) => `| ${label} | ${status} | ${pos} | ${note} |`;
  if (nu.assets.recipe) t = t.replace(/^\| 配方 \|.*$/m, row('配方', '草稿', `\`${nu.assets.recipe.draft}\``, '整块功能能照抄时用'));
  if (nu.assets.block) t = t.replace(/^\| 积木 \|.*$/m, row('积木', '草稿', `\`${nu.assets.block.java}\``, '纯逻辑 + 单测，并进 `LIB`'));
  if (nu.assets.ref) t = t.replace(/^\| 参考 \|.*$/m, row('参考', '骨架', `\`${nu.assets.ref.file}\``, '做法、决策、坑，进 `REF`'));
  if (nu.assets.links.length) {
    const add = nu.assets.links.map((l) => `\`${l.type}=${l.path}\``).join('、');
    if (/^已登记：/m.test(t)) t = t.replace(/^已登记：.*$/m, (m) => `${m}${m.endsWith('、') ? '' : '、'}${add}`);
    else t = t.replace(/^\| 失败账 \|.*$/m, (m) => `${m}\n\n已登记：${add}`);
  }
  fs.writeFileSync(md, t, 'utf8');
  console.log(`已追加到 ${rel(md)}`);
}

function collectFiles(p) {
  const out = [];
  if (!fs.existsSync(p)) return out;
  const add = (f) => out.push({ rel: storePath(f), size: fs.statSync(f).size, sha256: sha256(f) });
  if (fs.statSync(p).isFile()) { if (/\.(java|md|json|csv|wpn|system|faction)$/i.test(p)) add(p); return out; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(p, e.name);
    if (e.isDirectory()) out.push(...collectFiles(f));
    else if (/\.(java|md|json|csv|wpn|system|faction)$/i.test(f)) add(f);
  }
  return out;
}

function readTask(dir) {
  const out = { task: '', title: '', lane: '', aCount: 0, gaps: 0, pkg: '' };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return out;
  out.task = rel(dir);
  const spec = path.join(dir, 'SPEC.md');
  if (fs.existsSync(spec)) {
    const md = fs.readFileSync(spec, 'utf8');
    out.title = ((md.match(/^#\s+(.+)$/m) || [])[1] || '').replace(/^SPEC[:：]\s*/, '');
    out.lane = (md.match(/^\s*-\s*lane:\s*([SML])/m) || [])[1] || '';
    out.aCount = (md.match(/^\|\s*A\d+\s*\|/gm) || []).length;
  }
  const build = path.join(dir, 'BUILD.md');
  if (fs.existsSync(build)) out.gaps = fs.readFileSync(build, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('|') && /recipe:\s*NONE/i.test(l)).length;
  const req = path.join(dir, 'REQ.md');
  if (fs.existsSync(req)) {
    const md = fs.readFileSync(req, 'utf8');
    out.pkg = (md.match(/package\s+([\w.]+)/) || [])[1] || '';
  }
  return out;
}

function caseMd(c) {
  const now = new Date(c.at).toISOString().slice(0, 10);
  const rows = c.files.map((f) => `| \`${esc(f.rel)}\` | ${f.size} | \`${f.sha256.slice(0, 12)}\` |`).join('\n') || '| — | — | — |';
  const src = c.source;
  const meta = [
    src.task ? `- 任务：\`${src.task}\`` : null,
    src.lane ? `- 车道：${src.lane}` : null,
    src.aCount ? `- 验收项：${src.aCount} 条` : null,
    src.gaps ? `- 无配方单元：${src.gaps} 个（缺口清单）` : null,
  ].filter(Boolean).join('\n');

  return `# 案例：${src.title || c.id}

> 蒸馏自 \`${c.source.path}\`（${now}）。记录的是**当时的选择**，不是唯一解；下次可以偏离，把差异写进「变体」即可。

## 来源

| 文件 | 字节 | sha256 |
|---|---|---|
${rows}

${meta || '- （无任务元数据）'}

## 结果

- 结果：（待填：成功 / 部分成功 / 失败）
- 证据：（待填）编译、闸门、单测、手动步骤的实际输出。
- 花时间最多的一步：（待填）

## 资产台账

| 类型 | 状态 | 位置 | 一句话 |
|---|---|---|---|
| 配方 | ${c.assets.recipe ? '草稿' : '待定'} | ${c.assets.recipe ? `\`${c.assets.recipe.draft}\`` : '—'} | 整块功能能照抄时用 |
| 积木 | ${c.assets.block ? '草稿' : '待定'} | ${c.assets.block ? `\`${c.assets.block.java}\`` : '—'} | 纯逻辑 + 单测，并进 \`LIB\` |
| 参考 | ${c.assets.ref ? '骨架' : '待定'} | ${c.assets.ref ? `\`${c.assets.ref.file}\`` : '—'} | 做法、决策、坑，进 \`REF\` |
| 闸门规则 | 待定 | — | 能自动抓的错，进 \`GATE\\rules\` |
| 工具/命令 | 待定 | — | 重复手工步骤，做成 \`Script\` |
| 模板 | 待定 | — | 文档/数据/接线样式 |
| 失败账 | 待定 | — | B 记录 + \`rule:\` / \`test:\` |
${c.assets.links.length ? `\n已登记：${c.assets.links.map((l) => `\`${l.type}=${l.path}\``).join('、')}` : ''}

## 复制步骤

1. \`node Script\\new.mjs <配方> <mod> --id <单元>\`（有配方时）
2. \`node Script\\compile.mjs <mod>\` → 0 E
3. \`node Script\\verify.mjs <mod>\` → 无新增 E
4. \`node Script\\mod-test.mjs <mod>\` / \`preview.mjs\`（按需）
5. 手动：按 \`HANDOFF.md\` 点一遍

## 变体（举一反三）

| 当……不同 | 改什么 | 不变的部分 |
|---|---|---|
| （待填）例：换武器 / 换势力 / 换界面路线 | … | … |
| （待填） | … | … |

## 教训

- 成功：（待填）哪一步最省时间？为什么？
- 失败：（待填）哪一步返工？根因是什么？进 B 记录了吗？
- 下次先做：（待填）一句话。

## 边界

- （待填）什么情况下**不适用**这套？前置条件是什么？

## 发散空间

- （待填）哪些只是实现选择、不是约束？下次可以怎么换？
`;
}

function refSkeleton(name, f) {
  return `# ${name}

> 蒸馏自 \`${f.task || f.title || '—'}\`（${new Date().toISOString().slice(0, 10)}）。只写**结论 + 证据**，不抄大段代码。

## 结论

- （待填）一句话结论。

## 证据

- \`文件:行\`：（待填）关键调用/字段/注释。
- 运行/日志：（待填）

## 用法

- 什么时候该来查这篇？
- 什么时候**不**适用？

## 坑

- （待填）
`;
}

function testSkeleton(cls) {
  return `// ${cls} 的草稿测试：并进 LIB\\test 后在 TestAll 里加一行，再跑 lib-test。
public final class ${cls}Test {
    public static void run() {
        // 断言：正常值、边界值、非法值各一条
    }
}
`;
}

function runCheck() {
  const linkExists = (l) => {
    if (l.type === 'recipe') return fs.existsSync(path.join(root, 'KIT', String(l.path).replace(/^KIT[\\/]/, ''), 'recipe.json'));
    if (l.type === 'ref') return fs.existsSync(path.join(root, String(l.path).endsWith('.md') ? l.path : `REF/${l.path}.md`));
    if (l.type === 'block') return fs.existsSync(path.join(root, 'LIB', 'sscore', `${l.path}.java`)) || fs.existsSync(resolveStored(l.path));
    return fs.existsSync(resolveStored(l.path));
  };
  const json = opts.get('json');
  const lines = [];
  let errors = 0;
  let warns = 0;
  const base = DISTILL;
  const dirs = fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  if (!dirs.length) { console.log('DISTILL：暂无案例。'); return; }
  for (const d of dirs) {
    const dir = path.join(base, d);
    const jf = path.join(dir, 'CASE.json');
    const md = path.join(dir, 'CASE.md');
    if (!fs.existsSync(jf)) { lines.push(`E ${d}: 缺 CASE.json`); errors++; continue; }
    let c;
    try { c = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch { lines.push(`E ${d}: CASE.json 解析失败`); errors++; continue; }
    const text = fs.existsSync(md) ? fs.readFileSync(md, 'utf8') : '';
    if (!text) { lines.push(`E ${d}: 缺 CASE.md`); errors++; continue; }
    const need = ['## 来源', '## 结果', '## 资产台账', '## 复制步骤', '## 变体（举一反三）', '## 教训', '## 边界', '## 发散空间'];
    const miss = need.filter((h) => !text.includes(h));
    if (miss.length) { lines.push(`E ${d}: 缺小节 ${miss.join(' / ')}`); errors++; }
    let stale = 0;
    for (const f of c.files || []) {
      const p = resolveStored(f.rel);
      if (!fs.existsSync(p)) { lines.push(`W ${d}: 源文件不在了 ${f.rel}`); stale++; continue; }
      if (sha256(p) !== f.sha256) { lines.push(`W ${d}: 源已变化（案例可能过时） ${f.rel}`); stale++; }
    }
    const todo = (text.match(/（待填）/g) || []).length;
    if (todo > 0) { lines.push(`W ${d}: ${todo} 处待填`); warns++; }
    const a = c.assets || {};
    if (a.recipe && !fs.existsSync(path.join(root, 'KIT', a.recipe.id, 'recipe.json'))) { lines.push(`W ${d}: 配方还没进 KIT（${a.recipe.id}）`); warns++; }
    if (a.ref && !fs.existsSync(path.join(root, a.ref.file))) { lines.push(`W ${d}: REF 不在 ${a.ref.file}`); warns++; }
    if (a.block && !fs.existsSync(resolveStored(a.block.java))) { lines.push(`W ${d}: 积木草稿不在 ${a.block.java}`); warns++; }
    for (const l of a.links || []) {
      if (!linkExists(l)) { lines.push(`W ${d}: 登记路径不在 ${l.type}=${l.path}`); warns++; }
    }
    if (!stale && !todo && !miss.length) lines.push(`ok ${d}`);
  }
  if (json) {
    console.log(JSON.stringify({ cases: dirs.length, errors, warnings: warns, lines }, null, 2));
  } else {
    for (const l of lines) console.log(l);
    console.log(`案例 ${dirs.length} 个：E=${errors} W=${warns}`);
  }
  if (errors) process.exit(1);
}
