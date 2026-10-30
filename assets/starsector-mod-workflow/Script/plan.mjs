#!/usr/bin/env node
/**
 * plan：由已批准的 SPEC 生成/校验 BUILD.md（单元 → 文件 → 配方 → 验收 → 验证层）。
 * 用法：node Script\plan.mjs [--task <id>] [--check] [--force] [--root <目录>]
 * 退出码：0 成功/通过；1 参数或 IO 错误；2 闸门不通过（未批准、覆盖缺失、配方不存在）。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('plan');
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT, resolveTask, readSpec, checkSpec, section } from './lib/task.mjs';

function usage() {
  console.log('用法：node Script\\plan.mjs [--task <id>] [--check] [--force] [--root <目录>]');
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildTemplate({ task, specHash, title, now }) {
  return `# BUILD: ${title}
- task: ${task}
- spec: sha256:${specHash}
- created: ${now}

## 单元

| 单元 | 文件 | 配方 | A | 验证层 |
|---|---|---|---|---|
| U1 | data\\scripts\\...\\X.java | recipe: NONE | A1 | L1,L3 |

## 说明

- 一行一个单元；文件用相对 mod 根的路径。
- 配方写 \`recipe: <id>\`；没有对应配方写 \`recipe: NONE\`（进缺口清单）。
- A 列写本单元覆盖的验收编号，逗号分隔；全部 A 必须被覆盖。
- 验证层写 L0–L5，逗号分隔；M/L 车道至少一个单元含 L3。
`;
}

function parseUnits(text) {
  const block = section(text, '单元');
  if (!block) return [];
  const rows = [];
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    if (cells.every((c) => c === '' || /^:?-+:?$/.test(c))) continue;
    if (cells[0] === '单元') continue;
    rows.push({ unit: cells[0], file: cells[1], recipe: cells[2], a: cells[3], layers: cells[4] });
  }
  return rows;
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { task: null, root: null, check: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--task') opts.task = argv[++i];
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '--check') opts.check = true;
    else if (a === '--force') opts.force = true;
    else if (a === '-h' || a === '--help') {
      usage();
      return;
    } else {
      console.error('未知参数：' + a);
      usage();
      process.exit(1);
    }
  }

  let task;
  let spec;
  try {
    task = resolveTask(opts.task, opts.root);
    spec = readSpec(task.dir);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const gate = checkSpec(spec, { strict: true, requireApproved: true });
  if (!gate.ok) {
    console.log(`SPEC：${spec.file}`);
    for (const p of gate.problems) console.log('  ERR ' + p);
    console.log('拒绝生成施工图：SPEC 未批准或仍有占位。');
    process.exit(2);
  }

  const buildFile = path.join(task.dir, 'BUILD.md');
  if (!fs.existsSync(buildFile) || opts.force) {
    fs.writeFileSync(buildFile, buildTemplate({ task: task.id, specHash: spec.currentHash, title: spec.meta.title, now: nowIso() }), 'utf8');
    console.log(`BUILD 模板已建：${buildFile}`);
    console.log('把 U1 改成真实单元（文件/配方/A/验证层）后：node Script\\plan.mjs --check');
    return;
  }

  const text = fs.readFileSync(buildFile, 'utf8');
  const problems = [];
  const warnings = [];
  const specHashLine = /^-\s*spec:\s*sha256:([0-9a-f]{12})$/m.exec(text);
  if (!specHashLine) {
    problems.push('BUILD 缺少 `- spec: sha256:<12位>`');
  } else if (specHashLine[1] !== spec.currentHash) {
    problems.push(`BUILD 依据的 SPEC 已过期（BUILD ${specHashLine[1]} / 当前 ${spec.currentHash}）：重跑 node Script\\plan.mjs --force`);
  }

  const units = parseUnits(text);
  if (!units.length) problems.push('没有单元行');
  const specIds = spec.acceptance.map((a) => a.id);
  const covered = new Set();
  const kitDir = path.join(SKILL_ROOT, 'KIT');
  const kitExists = fs.existsSync(kitDir);
  const missingRecipes = new Set();
  const seenFiles = new Set();
  const validLayers = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);

  for (const u of units) {
    const label = u.unit || '（单元名空）';
    if (/^占位/.test(u.unit)) problems.push(`${label} 仍是占位单元`);
    if (!u.file) problems.push(`${label} 没有文件`);
    else {
      if (u.file.includes('...')) problems.push(`${label} 的文件仍是占位：${u.file}`);
      const segs = u.file.split(/[\\/]/);
      if (/^[A-Za-z]:/.test(u.file) || segs.includes('..')) problems.push(`${label} 的文件必须是 mod 内相对路径：${u.file}`);
      if (!/\.(java|json|csv|ship|variant|wpn|system|png)$/i.test(u.file)) warnings.push(`${label} 的文件扩展名不常见：${u.file}`);
      if (seenFiles.has(u.file)) warnings.push(`${label} 与前面的单元共用文件：${u.file}`);
      seenFiles.add(u.file);
    }

    const rm = /^recipe:\s*(\S+)$/.exec(u.recipe || '');
    if (!rm) problems.push(`${label} 的配方写法不对：${u.recipe || '空'}（应为 recipe: <id> 或 recipe: NONE）`);
    else if (rm[1] !== 'NONE') {
      if (kitExists && !fs.existsSync(path.join(kitDir, rm[1], 'recipe.json'))) missingRecipes.add(rm[1]);
    }

    const ids = (u.a || '').split(/[,，\s]+/).filter(Boolean);
    if (!ids.length) problems.push(`${label} 没有覆盖任何验收`);
    for (const id of ids) {
      if (!specIds.includes(id)) problems.push(`${label} 引用了不存在的验收：${id}`);
      else covered.add(id);
    }

    const layers = (u.layers || '').split(/[,，\s]+/).filter(Boolean);
    if (!layers.length) problems.push(`${label} 没有验证层`);
    for (const l of layers) if (!validLayers.has(l)) problems.push(`${label} 的验证层不合法：${l}`);
  }

  for (const id of specIds) if (!covered.has(id)) problems.push(`验收 ${id} 没有被任何单元覆盖`);
  if (missingRecipes.size) problems.push(`配方不存在：${[...missingRecipes].join('、')}（先建配方，或写 recipe: NONE）`);
  if (!kitExists) warnings.push('KIT 尚未建立，配方暂不可校验');
  if ((spec.meta.lane === 'M' || spec.meta.lane === 'L') && !units.some((u) => /(^|[,\s])L3($|[,\s])/.test(u.layers || ''))) {
    warnings.push('M/L 车道没有任何单元声明 L3 行为测试');
  }

  console.log(`BUILD：${buildFile}`);
  console.log(`单元 ${units.length} 个；验收覆盖 ${covered.size}/${specIds.length}`);
  for (const w of warnings) console.log('  ! ' + w);
  for (const p of problems) console.log('  ERR ' + p);
  console.log(problems.length ? '结论：不通过' : '结论：通过');
  process.exit(problems.length ? 2 : 0);
}

main();
