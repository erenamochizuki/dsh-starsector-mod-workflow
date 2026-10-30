// 从 KIT\_guide-data.json 生成每个配方的 GUIDE.md 与 PATCH.md。
// 单一来源是 _guide-data.json；生成物不要手改（recipe-test 会检查是否存在）。
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('gen-guides');
import fs from 'node:fs';
import path from 'node:path';
import { KIT, listRecipes } from './lib/recipes.mjs';

const dataPath = path.join(KIT, '_guide-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
let written = 0;

for (const recipe of listRecipes()) {
  const g = data[recipe.id];
  if (!g) {
    console.warn(`缺指南数据：${recipe.id}（在 KIT\\_guide-data.json 里补一条）`);
    continue;
  }
  const guide = [
    `# ${recipe.title}（${recipe.id}）`,
    '',
    g.use,
    '',
    '## 步骤',
    ...g.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## 坑',
    ...g.pitfalls.map((s) => `- ${s}`),
    '',
    '## 相关',
    '- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）',
    '- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准',
    '- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`',
    '',
  ].join('\n');

  const patch = [
    `# ${recipe.title} 允许的偏离`,
    '',
    '## 可以',
    ...data.common.patch_allow.map((s) => `- ${s}`),
    '',
    '## 不可以',
    ...data.common.patch_deny.map((s) => `- ${s}`),
    '',
    '偏离超过两条时，先改 `_guide-data.json` 与骨架，再重新生成，而不是在产物里临时打补丁。',
    '',
  ].join('\n');

  const dir = path.join(KIT, recipe.id);
  fs.writeFileSync(path.join(dir, 'GUIDE.md'), guide, 'utf8');
  fs.writeFileSync(path.join(dir, 'PATCH.md'), patch, 'utf8');
  written += 2;
}

console.log(`已生成 ${written} 个文件（GUIDE.md / PATCH.md）`);
