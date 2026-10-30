// 配方读取与模板渲染。配方放在 KIT\<id>\，一份 recipe.json + 一份 SKELETON.java。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..', '..');
export const KIT = path.join(SKILL_ROOT, 'KIT');

/** 列出全部配方（只认含 recipe.json 的目录）。 */
export function listRecipes() {
  if (!fs.existsSync(KIT)) return [];
  return fs
    .readdirSync(KIT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(KIT, id, 'recipe.json')))
    .sort()
    .map((id) => readRecipe(id));
}

/** 读一个配方；不存在时抛错（调用方转成 exit 1）。 */
export function readRecipe(id) {
  const dir = path.join(KIT, id);
  const file = path.join(dir, 'recipe.json');
  if (!fs.existsSync(file)) throw new Error(`配方不存在：${id}（${file}）`);
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  meta.dir = dir;
  meta.id = meta.id || id;
  return meta;
}

/** snake_case / kebab-case → PascalCase。 */
export function pascal(s) {
  return String(s)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** 把 {{TOKEN}} 替换成 vars 里的值；未提供的 token 原样保留，便于发现漏填。 */
export function render(text, vars) {
  return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

/** 由 id 与配方推断类名、包名、全限定名。 */
export function namesFor(recipe, id, pkgOverride) {
  const pkg = pkgOverride || recipe.pkg;
  if (!pkg) throw new Error(`配方 ${recipe.id} 没写默认包名（recipe.json 的 pkg）`);
  const cls = pascal(id) + (recipe.classSuffix || '');
  return { id, cls, pkg, fqcn: `${pkg}.${cls}`, pkgPath: pkg.replace(/\./g, '/') };
}

/** 渲染整份骨架。 */
export function renderSkeleton(recipe, info) {
  const tplPath = path.join(recipe.dir, recipe.skeleton || 'SKELETON.java');
  if (!fs.existsSync(tplPath)) throw new Error(`配方 ${recipe.id} 缺少骨架：${tplPath}`);
  return render(fs.readFileSync(tplPath, 'utf8'), varsFor(recipe, info));
}

/** 骨架替换用的变量表。 */
export function varsFor(recipe, info) {
  return {
    PACKAGE: info.pkg,
    CLASS: info.cls,
    ID: info.id,
    NAME: info.name || info.id,
    PKG_PATH: info.pkgPath,
    FQCN: info.fqcn,
    SUFFIX: recipe.classSuffix || '',
  };
}
