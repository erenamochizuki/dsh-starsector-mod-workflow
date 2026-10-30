// harvest：把能编译的旧代码回收成配方草稿（只机械替换，不判断业务正确性）。
// 用法：node Script\harvest.mjs --file <X.java> --id <recipe_id> --pkg <包名> [--class 类名] [--title 标题] [--out 目录] [--force]
// 产物默认落在 <mods>\.work\<mod>\harvest\<id>\；人工补 GUIDE 数据并跑 recipe-test 通过后再移进 KIT\。
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('harvest');
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT, pascal } from './lib/recipes.mjs';
import { readData, pathsOf, ensureDir } from './lib/work.mjs';

const argv = process.argv.slice(2);
const opt = new Map();
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt.set(argv[i].slice(2), argv[i + 1]);
}
const file = opt.get('file');
const id = opt.get('id');
if (!file || !id) {
  console.error('用法：node Script\\harvest.mjs --file <X.java> --id <recipe_id> --pkg <包名> [--class 类名] [--title 标题] [--out 目录] [--force]');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`文件不存在：${file}`);
  process.exit(2);
}

const code = fs.readFileSync(file, 'utf8');
const classFromFile = path.basename(file, '.java');
const className = opt.get('class') || classFromFile;
const pkg = opt.get('pkg') || (code.match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1];
if (!pkg) {
  console.error('推不出包名：用 --pkg 指定');
  process.exit(2);
}

const title = opt.get('title') || id;
const paths = pathsOf(readData(SKILL_ROOT));
const outRoot = opt.get('out') || (paths ? paths.harvest : null);
if (!outRoot) {
  console.error('未绑定 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>，或用 --out 指定目录');
  process.exit(2);
}
ensureDir(outRoot);
const outDir = path.join(outRoot, id);
if (fs.existsSync(outDir) && !opt.has('force')) {
  console.error(`草稿已存在：${outDir}（要覆盖加 --force）`);
  process.exit(2);
}

// 1) 骨架：包名与类名换成模板 token；其余原样保留（包括原来的注释与逻辑）。
let skeleton = code
  .replace(/^\s*package\s+[\w.]+\s*;/m, 'package {{PACKAGE}};')
  .replace(new RegExp(`\\b${className}\\b`, 'g'), '{{CLASS}}');
skeleton = `// 回收自：${path.basename(file)}（原包 ${pkg}）。移入 KIT 前补 // FILL: 与 GUIDE 数据。\n` + skeleton;

// 2) 产物路径：从 data/ 之后还原成相对路径；推不出就按包名拼。
let producePath = '{{PKG_PATH}}/{{CLASS}}.java';
const m = file.replace(/\\/g, '/').match(/\/data\/(.+)$/);
if (m) producePath = 'data/' + m[1].replace(new RegExp(`${className}\\.java$`), '{{CLASS}}.java');

const recipe = {
  id,
  title,
  kind: 'harvested',
  lane: 'M',
  keywords: [id.replace(/_/g, ' '), className],
  pkg,
  classSuffix: '',
  sampleId: id,
  produces: [{ path: producePath, template: 'SKELETON.java' }],
  wiring: [{ type: 'note', text: '回收草稿：把原工程的接线补进来（数据文件/注册点），并在 _guide-data.json 里补 use/steps/pitfalls。' }],
  checks: ['compile'],
  draft: true,
  notes: `从 ${path.basename(file)} 回收；类名 ${className}；人工确认无写死 id/路径后再移入 KIT。`,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'SKELETON.java'), skeleton, 'utf8');
fs.writeFileSync(path.join(outDir, 'recipe.json'), JSON.stringify(recipe, null, 2) + '\n', 'utf8');

console.log(`已生成草稿：${outDir}`);
console.log(`  SKELETON.java（${skeleton.split(/\r?\n/).length} 行）  recipe.json`);
console.log('下一步：');
console.log(`  1. 打开草稿，把写死的 id/路径/数值改成 // FILL: 与 {{ID}}；`);
console.log(`  2. 在 KIT\\_guide-data.json 里补 ${id} 的 use/steps/pitfalls；`);
console.log(`  3. 跑 node Script\\recipe-test.mjs ${id} --keep，通过后把目录移进 KIT\\。`);
