#!/usr/bin/env node
/**
 * gen-index：生成 INDEX.md（技能路由表），--api 时同时重建 API 类型索引。
 * 用法：node Script\gen-index.mjs [--api] [--check] [--root <游戏根>]
 * 退出码：0 成功/一致；1 参数或生成失败；2 --check 发现内容不一致。
 * 说明：INDEX.md 与 API\ 都是生成物，不手改。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('gen-index');
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT, loadApi, readSource, packageOf } from './lib/sources.mjs';
import { readData, pathsOf } from './lib/work.mjs';

const ROOT = SKILL_ROOT;
const WORK = pathsOf(readData(ROOT));
let unclassified = [];

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function firstHeading(md) {
  const m = /^#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : '';
}

function firstParagraph(md) {
  const lines = md.split(/\r?\n/);
  let started = false;
  const buf = [];
  for (const line of lines) {
    const s = line.trim();
    if (!started) {
      if (!s || s.startsWith('#') || s.startsWith('>') || s.startsWith('|')) continue;
      started = true;
    }
    if (!s) {
      if (buf.length) break;
      continue;
    }
    if (s.startsWith('#') || s.startsWith('|')) break;
    buf.push(s);
    if (buf.join(' ').length > 110) break;
  }
  const text = buf.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? text.slice(0, 117) + '…' : text;
}

function typeDeclOf(java) {
  const m = /^\s*(?:public\s+)?(?:abstract\s+|final\s+)*(class|interface|enum|@interface)\s+([A-Za-z_$][\w$]*)/m.exec(java);
  return m ? `${m[1]} ${m[2]}` : '（未识别）';
}

function collectRef() {
  return walk(path.join(ROOT, 'REF'), (p) => p.endsWith('.md')).map((p) => {
    const md = fs.readFileSync(p, 'utf8');
    return { file: rel(p), title: firstHeading(md) || path.basename(p, '.md'), summary: firstParagraph(md) };
  });
}

function collectKit() {
  const base = path.join(ROOT, 'KIT');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()).sort().map((d) => {
    const f = path.join(base, d, 'recipe.json');
    let r = {};
    if (fs.existsSync(f)) {
      try {
        r = JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        r = { _error: 'recipe.json 解析失败' };
      }
    }
    return {
      dir: d,
      id: r.id || d,
      summary: r.summary || r.title || '',
      produces: Array.isArray(r.produces)
        ? r.produces
            .map((x) => (typeof x === 'string' ? x : (x && (x.path || x.template)) || ''))
            .filter(Boolean)
            .join('、')
        : '',
      uses: r.uses || 0,
    };
  });
}

function collectLib() {
  return walk(path.join(ROOT, 'LIB'), (p) => p.endsWith('.java')).map((p) => ({
    file: rel(p),
    decl: typeDeclOf(fs.readFileSync(p, 'utf8')),
  }));
}

function collectScripts() {
  return walk(path.join(ROOT, 'Script'), (p) => p.endsWith('.mjs') && !p.includes(`${path.sep}lib${path.sep}`)).map((p) => {
    const text = fs.readFileSync(p, 'utf8');
    const m = /^ \* ([A-Za-z0-9_-]+)[：]\s*([^\n]+)$/m.exec(text) || /^\/\/ ([A-Za-z0-9_-]+)[：]\s*([^\n]+)$/m.exec(text) || /^ \* ([^\n]+)$/m.exec(text);
    return { name: path.basename(p, '.mjs'), file: rel(p), desc: m ? (m[2] || m[1]).trim() : '' };
  });
}

function readCommands() {
  const f = path.join(ROOT, 'Script', 'commands.json');
  const empty = { user: [], maintenance: [], internal: [] };
  if (!fs.existsSync(f)) return empty;
  try {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { user: raw.user || [], maintenance: raw.maintenance || [], internal: raw.internal || [] };
  } catch (e) {
    return empty;
  }
}

function collectTpl() {
  const base = path.join(ROOT, 'TPL');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).sort().map((n) => n);
}

function collectTasks() {
  const base = WORK ? WORK.tasks : path.join(ROOT, 'TASKS');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()).sort().map((d) => {
    const spec = path.join(base, d, 'SPEC.md');
    let status = '（无 SPEC）';
    if (fs.existsSync(spec)) {
      const md = fs.readFileSync(spec, 'utf8');
      status = /^approved:/m.test(md) ? '已批准' : '未批准';
    }
    return { dir: d, status };
  });
}

function buildIndex() {
  const rows = [];
  const p = (...x) => rows.push(x.join(''));

  p('# INDEX');
  p('');
  p('<!-- 由 node Script\\gen-index.mjs 生成，请勿手改。 -->');
  p('');
  p('## 入口');
  p('');
  p('- `SKILL.md` — 纪律与入口（先读这个）');
  p('- `WORKFLOW.md` — 从需求到交接的流程与判据');
  p('- `FACTS.md` — 本机复核过的事实基线');
  p('- `META.json` — 版本、结构、替换标记');
  p('');
  p('## 查 API（只用本地）');
  p('');
  p('- 查一个类：`node Script\\api-src.mjs <类名>`');
  p('- 搜内容：`node Script\\api-grep.mjs <正则>`');
  p('- 类型总表：`API/API_INDEX.md`（`node Script\\gen-index.mjs --api` 重建）');
  p('');

  const refs = collectRef();
  p('## REF：本机参考笔记');
  p('');
  if (!refs.length) p('（暂无。T02 之后逐步补充。）');
  else {
    p('| 文件 | 主题 | 摘要 |');
    p('|---|---|---|');
    for (const r of refs) p(`| [${r.file}](${r.file}) | ${r.title} | ${r.summary} |`);
  }
  p('');

  const kits = collectKit();
  p('## KIT：配方');
  p('');
  if (!kits.length) p('（暂无。T05 起逐步构建；`recipe: NONE` 的单元进缺口清单。）');
  else {
    p('| 配方 | 产出 | 摘要 | 已用 |');
    p('|---|---|---|---|');
    for (const k of kits) p(`| [${k.id}](KIT/${k.dir}/) | ${k.produces} | ${k.summary} | ${k.uses} |`);
  }
  p('');

  const libs = collectLib();
  p('## LIB：积木');
  p('');
  if (!libs.length) p('（暂无。T04 起构建，每个积木带测试。）');
  else {
    p('| 文件 | 类型 |');
    p('|---|---|');
    for (const l of libs) p(`| [${l.file}](${l.file}) | ${l.decl} |`);
  }
  p('');

  const tpl = collectTpl();
  p('## TPL：模板');
  p('');
  if (!tpl.length) p('（暂无。）');
  else for (const t of tpl) p(`- \`TPL/${t}\``);
  p('');

  const scripts = collectScripts();
  const byName = new Map(scripts.map((s) => [s.name, s]));
  const commands = readCommands();
  const registered = new Set([...commands.user, ...commands.maintenance, ...commands.internal]);
  unclassified = scripts.filter((s) => !registered.has(s.name)).map((s) => s.name);
  const section = (title, names, note) => {
    const rows = names.map((n) => byName.get(n)).filter(Boolean);
    p(`### ${title}`);
    p('');
    if (note) p(note);
    if (!rows.length) p('（暂无）');
    else {
      p('| 命令 | 说明 |');
      p('|---|---|');
      for (const s of rows) p(`| \`node ${s.file}\` | ${s.desc} |`);
    }
    p('');
  };
  p('## 命令（由 `Script/commands.json` 分类生成）');
  p('');
  section('日常', commands.user);
  section('维护（破坏性 / 低频）', commands.maintenance, '这些命令会改动技能目录或覆盖文件，先看 `--dry-run`。');
  p('### 内部');
  p('');
  p('由其它命令调用，不直接使用：`*-test`、`*-selftest`、`gen-*`、`recipe-*`、`preview`。');
  p('');

  p('## TASKS：任务');
  p('');
  p('任务放在 `<mods>\\.work\\<mod目录名>\\tasks\\`（按绑定；`node Script\\req.mjs` 新建）。');
  p('');
  p('## DISTILL：案例');
  p('');
  p('案例放在 `<mods>\\.work\\<mod目录名>\\distill\\`（`node Script\\distill.mjs <任务 id>`）。');
  p('');

  return rows.join('\n');
}

function collectDistill() {
  const base = WORK ? WORK.distill : path.join(ROOT, 'DISTILL');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()).sort().map((d) => {
    const jf = path.join(base, d, 'CASE.json');
    let title = '（无 CASE.json）';
    let recipe = '—';
    let block = '—';
    try {
      const c = JSON.parse(fs.readFileSync(jf, 'utf8'));
      title = c.source?.title || c.id || d;
      recipe = c.assets?.recipe?.id || '—';
      block = c.assets?.block?.id || '—';
    } catch { /* 保持默认 */ }
    const md = path.join(base, d, 'CASE.md');
    const todo = fs.existsSync(md) ? (fs.readFileSync(md, 'utf8').match(/（待填）/g) || []).length : 0;
    return { dir: d, title, recipe, block, todo };
  });
}

function parseTypeHead(tail) {
  return tail
    .replace(/\{.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildApiIndex() {
  const api = loadApi(process.env.SS_GAME_ROOT || undefined);
  const byPkg = new Map();
  let typeCount = 0;
  const noType = [];
  for (const entry of api.entries) {
    const pkg = packageOf(entry.name);
    if (!byPkg.has(pkg)) byPkg.set(pkg, []);
    const text = readSource(entry);
    const lines = text.split(/\r?\n/);
    let found = false;
    for (const line of lines) {
      const decl = line.trim().replace(/^(?:@[\w.]+(?:\([^)]*\))?\s+)*/, '');
      const m = /^(?:public\s+)?(?:abstract\s+|final\s+)*(class|interface|enum|@interface)\s+([A-Za-z_$][\w$]*)(.*)$/.exec(decl);
      if (!m) continue;
      if (!/^(public|abstract|final|class|interface|enum|@interface)/.test(decl)) continue;
      byPkg.get(pkg).push({ kind: m[1], name: m[2], head: parseTypeHead(m[3]) });
      typeCount++;
      found = true;
      break;
    }
    if (!found) noType.push(entry.name);
  }

  const outDir = path.join(ROOT, 'API');
  const pkgDir = path.join(outDir, 'pkgs');
  fs.mkdirSync(pkgDir, { recursive: true });
  for (const f of fs.readdirSync(pkgDir)) if (f.endsWith('.md')) fs.unlinkSync(path.join(pkgDir, f));

  const pkgs = [...byPkg.keys()].sort();
  for (const pkg of pkgs) {
    const types = byPkg.get(pkg).sort((a, b) => a.name.localeCompare(b.name));
    const md = [
      `# ${pkg}`,
      '',
      '<!-- 由 node Script\\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->',
      '',
      `共 ${types.length} 个类型。来源：starfarer.api.zip`,
      '',
      '| 类型 | 种类 | 继承/实现 |',
      '|---|---|---|',
      ...types.map((t) => `| ${t.name} | ${t.kind} | ${t.head || '—'} |`),
      '',
    ].join('\n');
    fs.writeFileSync(path.join(pkgDir, pkg + '.md'), md, 'utf8');
  }

  const index = [
    '# API 类型索引',
    '',
    '<!-- 由 node Script\\gen-index.mjs --api 生成，请勿手改。 -->',
    '',
    `来源：\`starfarer.api.zip\`（${api.entries.length} 个 .java，${pkgs.length} 个包，${typeCount} 个类型）。`,
    '只到“类型 + 继承/实现”；成员签名以 `node Script\\api-src.mjs <类名>` 的源码为准。',
    '',
    '| 包 | 类型数 | 文件 |',
    '|---|---|---|',
    ...pkgs.map((pkg) => `| ${pkg} | ${byPkg.get(pkg).length} | [pkgs/${pkg}.md](pkgs/${pkg}.md) |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'API_INDEX.md'), index, 'utf8');
  return { packages: pkgs.length, types: typeCount, files: api.entries.length, noType };
}

function main() {
  const argv = process.argv.slice(2);
  const wantApi = argv.includes('--api');
  const check = argv.includes('--check');
  const content = buildIndex();
  const target = path.join(ROOT, 'INDEX.md');
  if (check) {
    const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (old !== content) {
      console.error('INDEX.md 与生成结果不一致：请运行 node Script\\gen-index.mjs');
      process.exit(2);
    }
    console.log('INDEX.md 与生成结果一致');
    return;
  }
  fs.writeFileSync(target, content, 'utf8');
  console.log(`INDEX.md 已生成（${content.split(/\r?\n/).length} 行）`);
  if (unclassified.length) console.error(`  ! 未在 commands.json 登记（按内部处理）：${unclassified.join('、')}`);
  if (wantApi) {
    const r = buildApiIndex();
    console.log(`API 索引已生成：${r.packages} 个包，${r.types} 个类型，${r.files} 个 .java`);
    if (r.noType.length) console.log(`未识别类型声明 ${r.noType.length} 个：${r.noType.join('、')}`);
  }
}

main();
