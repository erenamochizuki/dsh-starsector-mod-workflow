// 配方自检：调用 new.mjs 在临时目录里真实生成一次，编译 Java，检查接线。不启动游戏。
// 用法：node Script\recipe-test.mjs [配方id...] [--root 游戏根] [--keep]
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('recipe-test');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { listRecipes, readRecipe, namesFor, render, varsFor, SKILL_ROOT } from './lib/recipes.mjs';
import { resolveGameRoot } from './lib/sources.mjs';

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const explicitRoot = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
const keep = argv.includes('--keep');
const ids = argv.filter((a, i) => !a.startsWith('--') && (rootIdx < 0 || i !== rootIdx + 1));
const recipes = ids.length ? ids.map((id) => readRecipe(id)) : listRecipes();

let core;
try {
  core = path.join(resolveGameRoot(explicitRoot).gameRoot, 'starsector-core');
} catch (e) {
  console.error(`找不到游戏目录：${e.message}`);
  process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-recipe-test-'));
const problems = [];

for (const recipe of recipes) {
  const mod = path.join(work, recipe.id);
  fs.mkdirSync(path.join(mod, 'data'), { recursive: true });
  const id = recipe.sampleId || recipe.id;
  const info = namesFor(recipe, id);
  const vars = {
    ...varsFor(recipe, info),
    NAME: `测试${recipe.title}`,
    DESC: `测试${recipe.title}`,
    ICON: recipe.iconDefault || `graphics/icons/${id}.png`,
  };

  // 1) 走真实生成器
  const gen = spawnSync(process.execPath, [path.join(SKILL_ROOT, 'Script', 'new.mjs'), recipe.id, mod, '--id', id, '--name', `测试${recipe.title}`, '--desc', `测试${recipe.title}`, '--icon', vars.ICON], { stdio: 'inherit' });
  if (gen.status !== 0) {
    problems.push(`${recipe.id}: new.mjs 失败（exit ${gen.status}）`);
    continue;
  }

  // 2) 编译 Java 产物
  const javaFiles = (recipe.produces || [])
    .map((p) => path.join(mod, render(p.path, vars)))
    .filter((f) => f.endsWith('.java') && fs.existsSync(f));
  if (!javaFiles.length) problems.push(`${recipe.id}: 没有生成 Java 文件`);
  if (javaFiles.length) {
    const cp = path.join(core, '*');
    const r = spawnSync('javac', ['-encoding', 'UTF-8', '-nowarn', '-cp', cp, '-sourcepath', path.join(SKILL_ROOT, 'LIB', 'sscore'), '-d', path.join(mod, 'out'), ...javaFiles], { stdio: 'inherit' });
    if (r.status !== 0) problems.push(`${recipe.id}: 编译失败`);
  }

  // 3) 接线检查：CSV 每行列数与表头一致，且包含本次 id
  for (const w of recipe.wiring || []) {
    if (w.type !== 'csv') continue;
    const target = path.join(mod, render(w.file, vars));
    if (!fs.existsSync(target)) {
      problems.push(`${recipe.id}: 接线文件未生成 ${render(w.file, vars)}`);
      continue;
    }
    const lines = fs.readFileSync(target, 'utf8').trim().split(/\r?\n/);
    const cols = lines[0].split(',').length;
    for (const line of lines.slice(1)) {
      if (line.split(',').length !== cols) problems.push(`${recipe.id}: CSV 行列数不一致`);
    }
    if (!lines.some((l) => l.split(',')[0] === id || l.split(',')[1] === id)) {
      problems.push(`${recipe.id}: CSV 里没有 id=${id}`);
    }
  }

  // 4) 五件套齐全
  for (const f of ['recipe.json', 'SKELETON.java', 'GUIDE.md', 'PATCH.md']) {
    if (!fs.existsSync(path.join(recipe.dir, f))) problems.push(`${recipe.id}: 缺 ${f}`);
  }

  const ok = !problems.some((p) => p.startsWith(recipe.id + ':'));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${recipe.id}`);
}

if (keep) console.log(`保留临时目录：${work}`);
else fs.rmSync(work, { recursive: true, force: true });

if (problems.length) {
  console.error('问题：');
  for (const p of problems) console.error('  ' + p);
  process.exit(2);
}
console.log(`配方自检：${recipes.length} 个全部通过`);
