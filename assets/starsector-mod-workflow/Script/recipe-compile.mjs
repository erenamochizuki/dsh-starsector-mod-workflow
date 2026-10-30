// 骨架离线编译检查：只证明"这份骨架能对着本体 API 编过"，不启动游戏。
// 用法：node Script\recipe-compile.mjs <配方id> | --all [--root 游戏根] [--keep]
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('recipe-compile');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { listRecipes, readRecipe, namesFor, renderSkeleton, SKILL_ROOT } from './lib/recipes.mjs';
import { resolveGameRoot } from './lib/sources.mjs';

const argv = process.argv.slice(2);
const keep = argv.includes('--keep');
const all = argv.includes('--all');
const rootIdx = argv.indexOf('--root');
const explicitRoot = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
const ids = argv.filter((a, i) => !a.startsWith('--') && (rootIdx < 0 || i !== rootIdx + 1));
const targets = all ? listRecipes() : ids.map((id) => readRecipe(id));

if (!targets.length) {
  console.error('用法：node Script\\recipe-compile.mjs <配方id> | --all [--root 游戏根] [--keep]');
  process.exit(1);
}

let gameRoot;
try {
  gameRoot = resolveGameRoot(explicitRoot).gameRoot;
} catch (e) {
  console.error(`找不到游戏目录：${e.message}`);
  process.exit(1);
}
const core = path.join(gameRoot, 'starsector-core');
if (!fs.existsSync(core)) {
  console.error(`缺少本体目录：${core}`);
  process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-modbuild-'));
let failed = 0;

for (const recipe of targets) {
  const info = namesFor(recipe, recipe.sampleId || recipe.id);
  const src = renderSkeleton(recipe, info);
  const pkgDir = path.join(work, recipe.id, 'src', info.pkgPath);
  fs.mkdirSync(pkgDir, { recursive: true });
  const javaFile = path.join(pkgDir, `${info.cls}.java`);
  fs.writeFileSync(javaFile, src, 'utf8');

  const cp = path.join(core, '*');
  const r = spawnSync(
    'javac',
    ['-encoding', 'UTF-8', '-nowarn', '-cp', cp, '-sourcepath', path.join(SKILL_ROOT, 'LIB', 'sscore'), '-d', path.join(work, recipe.id, 'out'), javaFile],
    { stdio: 'inherit' }
  );
  if (r.status === 0) {
    console.log(`ok   ${recipe.id}  ${info.fqcn}`);
  } else {
    failed++;
    console.log(`FAIL ${recipe.id}  ${info.fqcn}`);
  }
}

if (keep) console.log(`保留临时目录：${work}`);
else fs.rmSync(work, { recursive: true, force: true });
console.log(`编译检查：通过 ${targets.length - failed} / 失败 ${failed}`);
process.exit(failed ? 2 : 0);
