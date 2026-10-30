// new：按配方把骨架落到目标 mod（拷文件 + 写接线行），不启动游戏、不猜路径。
// 用法：node Script\new.mjs <配方id> <mod目录> --id <snake_id> --name "<中文名>" [--pkg 包名] [--desc 描述] [--icon 图标路径] [--dry] [--force]
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('new');
import fs from 'node:fs';
import path from 'node:path';
import { readRecipe, namesFor, renderSkeleton, render, varsFor } from './lib/recipes.mjs';

const argv = process.argv.slice(2);
const flags = new Map();
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (['dry', 'force', 'list'].includes(k)) flags.set(k, true);
    else flags.set(k, argv[++i]);
  } else {
    positional.push(a);
  }
}
const [recipeId, modRootArg] = positional;
if (!recipeId || !modRootArg) {
  console.error('用法：node Script\\new.mjs <配方id> <mod目录> --id <snake_id> --name "<中文名>" [--pkg 包名] [--dry] [--force]');
  process.exit(1);
}
if (flags.has('list')) {
  // 交给 gen-index 展示，这里只提示。
  console.error('用 node Script\\gen-index.mjs 查看配方表。');
  process.exit(1);
}

let recipe;
try {
  recipe = readRecipe(recipeId);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const id = String(flags.get('id') || recipe.sampleId || recipe.id).trim();
if (!/^[a-z][a-z0-9_]*$/.test(id)) {
  console.error(`--id 只能用小写字母/数字/下划线，且以字母开头：${id}`);
  process.exit(1);
}
const name = String(flags.get('name') || id);
const modRoot = path.resolve(modRootArg);
if (!fs.existsSync(modRoot)) {
  console.error(`目标 mod 目录不存在：${modRoot}`);
  process.exit(1);
}

const info = namesFor(recipe, id, flags.get('pkg'));
const vars = {
  ...varsFor(recipe, info),
  NAME: name,
  DESC: String(flags.get('desc') || name),
  ICON: String(flags.get('icon') || recipe.iconDefault || `graphics/icons/${id}.png`),
  MOD_ROOT: modRoot,
};

const dry = flags.has('dry');
const force = flags.has('force');
const actions = [];
const conflicts = [];

/** 把一格 CSV 值转义；含逗号/引号/换行时加引号。 */
function csvCell(v) {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// 1) 产物文件
for (const p of recipe.produces || []) {
  const rel = render(p.path, vars);
  const target = path.join(modRoot, rel);
  const content = renderSkeleton(recipe, info);
  if (fs.existsSync(target) && !force) {
    conflicts.push(rel);
    continue;
  }
  actions.push({ kind: 'file', target: rel });
  if (!dry) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

// 2) 接线
const wiringNotes = [];
for (const w of recipe.wiring || []) {
  if (w.type === 'note') {
    wiringNotes.push(render(w.text, vars));
    continue;
  }
  if (w.type === 'csv') {
    const rel = render(w.file, vars);
    const target = path.join(modRoot, rel);
    const header = render(w.header || '', vars);
    const row = (w.row || []).map((c) => csvCell(render(c, vars)));
    if (header) {
      const cols = header.split(',').length;
      if (row.length !== cols) {
        console.error(`配方 ${recipe.id} 的接线列数不对：表头 ${cols} 列，行 ${row.length} 列（改 recipe.json）`);
        process.exit(1);
      }
    }
    let existing = '';
    if (fs.existsSync(target)) existing = fs.readFileSync(target, 'utf8');
    const idCell = csvCell(render('{{ID}}', vars));
    const already = existing.split(/\r?\n/).some((line) => line.split(',')[0] === idCell || line.split(',')[1] === idCell);
    if (already) {
      actions.push({ kind: 'csv-skip', target: rel, note: '已存在' });
      continue;
    }
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    if (!existing && header) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!dry) fs.writeFileSync(target, header + '\n', 'utf8');
    }
    if (!dry) fs.appendFileSync(target, prefix + row.join(',') + '\n', 'utf8');
    actions.push({ kind: 'csv-add', target: rel });
    continue;
  }
  if (w.type === 'json') {
    // 只在目标 JSON 里补一个键（浅层）；已存在则不覆盖。
    const rel = render(w.file, vars);
    const target = path.join(modRoot, rel);
    const key = render(w.key, vars);
    const value = Array.isArray(w.value) ? w.value.map((v) => render(v, vars)) : render(w.value, vars);
    let text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '{\n}\n';
    if (new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`).test(text)) {
      actions.push({ kind: 'json-skip', target: rel, note: key });
      continue;
    }
    const body = Array.isArray(value) ? '[' + value.map((v) => JSON.stringify(v)).join(', ') + ']' : JSON.stringify(value);
    const insertAt = text.lastIndexOf('}');
    text = text.slice(0, insertAt).trimEnd() + (text.trim().length > 1 ? ',' : '') + `\n  "${key}": ${body}\n}` + text.slice(insertAt + 1);
    if (!dry) fs.writeFileSync(target, text, 'utf8');
    actions.push({ kind: 'json-set', target: rel, note: key });
    continue;
  }
  console.warn(`未知接线类型：${w.type}（跳过）`);
}

// 3) 汇总
console.log(`配方 ${recipe.id}（${recipe.title}）→ ${modRoot}`);
for (const a of actions) console.log(`  ${a.kind.padEnd(9)} ${a.target}${a.note ? `  ${a.note}` : ''}`);
if (wiringNotes.length) {
  console.log('  手工接线：');
  for (const n of wiringNotes) console.log(`    - ${n}`);
}
if (conflicts.length) {
  console.error(`以下文件已存在，未覆盖（要覆盖加 --force）：`);
  for (const c of conflicts) console.error(`  ${c}`);
  process.exit(2);
}

let fillCount = 0;
for (const p of recipe.produces || []) {
  if (!p.path.endsWith('.java')) continue;
  const target = path.join(modRoot, render(p.path, vars));
  if (fs.existsSync(target)) fillCount += (fs.readFileSync(target, 'utf8').match(/\/\/ FILL:/g) || []).length;
}
console.log(`  还剩 ${fillCount} 处 // FILL: 要填`);
console.log('下一步：node Script\\verify.mjs（T06 起可用）；收尾 node Script\\wrapup.mjs');
