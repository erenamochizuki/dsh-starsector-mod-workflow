#!/usr/bin/env node
/**
 * spec：建 SPEC 模板、校验、审批（sha256）、由数值要求生成 SpecConstants.java。
 * 用法：
 *   node Script\spec.mjs --lane <S|M|L> [--route <native|layout|none>] [--task <id>]
 *   node Script\spec.mjs --check [--task <id>]
 *   node Script\spec.mjs --approve [--note <原话摘录>]
 *   node Script\spec.mjs --constants [--out <SpecConstants.java>] [--package <包名>]
 * 退出码：0 通过；1 参数/IO 错误；2 校验不通过。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('spec');
import fs from 'node:fs';
import path from 'node:path';
import { resolveTask, readSpec, checkSpec, specTemplate, hashOf, originalText, emitConstants } from './lib/task.mjs';
import { SKILL_ROOT } from './lib/sources.mjs';
import { checkStamp } from './lib/stamp.mjs';
import { factsTemplate } from './lib/facts.mjs';

function usage() {
  console.log('用法：node Script\\spec.mjs --lane <S|M|L> [--route <native|layout|none>] [--task <id>]');
  console.log('      node Script\\spec.mjs --check|--approve|--constants [--task <id>]');
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function printCheck(result) {
  for (const w of result.warnings) console.log('  ! ' + w);
  for (const p of result.problems) console.log('  ERR ' + p);
  console.log(result.ok ? '结论：通过' : '结论：不通过');
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { task: null, root: null, lane: null, route: null, title: null, force: false, check: false, approve: false, constants: false, out: null, pkg: 'data.scripts.spec', note: null, allowStale: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--task') opts.task = argv[++i];
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '--lane') opts.lane = (argv[++i] || '').toUpperCase();
    else if (a === '--route') opts.route = (argv[++i] || '').toLowerCase();
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--approve') opts.approve = true;
    else if (a === '--constants') opts.constants = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--package') opts.pkg = argv[++i];
    else if (a === '--note') opts.note = argv[++i];
    else if (a === '--allow-stale') opts.allowStale = true;
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
  try {
    task = resolveTask(opts.task, opts.root);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (opts.check) {
    try {
      const spec = readSpec(task.dir);
      const result = checkSpec(spec);
      console.log(`SPEC：${spec.file}`);
      console.log(`车道：${spec.meta.lane || '?'} / 路线：${spec.meta.route || '?'}；数值 ${spec.numeric.length} 条；验收 ${spec.acceptance.length} 条`);
      if (spec.approved) console.log(`审批：sha256:${spec.approved.hash}（${spec.approved.valid ? '有效' : '已失效'}）`);
      printCheck(result);
      process.exit(result.ok ? 0 : 2);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  if (opts.approve) {
    let spec;
    try {
      spec = readSpec(task.dir);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const result = checkSpec(spec, { strict: true });
    if (!result.ok) {
      console.log(`SPEC：${spec.file}`);
      printCheck(result);
      console.log('审批拒绝：先修上面的 ERR。');
      process.exit(2);
    }
    const gate = checkStamp(SKILL_ROOT);
    if (!gate.ok && !opts.allowStale) {
      console.error('ERR 审批被拒：' + gate.reason);
      console.error('    先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录> 完成绑定；');
      console.error('    确认要跳过时加 --allow-stale（会记入审批行）。');
      process.exit(2);
    }
    if (!gate.ok) console.log(`  ! 警告：${gate.reason}（--allow-stale 放行）`);
    const reqFile = path.join(task.dir, 'REQ.md');
    const reqText = fs.existsSync(reqFile) ? fs.readFileSync(reqFile, 'utf8') : '';
    const note = (opts.note || originalText(reqText) || spec.meta.title || '').replace(/\s+/g, ' ').slice(0, 40);
    // 把“审批”章节整段换成一行 approved，哈希按去掉该行后的正文算。
    const body = spec.text.replace(/^approved:.*$/gm, '');
    const idx = body.indexOf('## 审批');
    const base = (idx >= 0 ? body.slice(0, idx) + '## 审批' : body + '\n\n## 审批').replace(/\s+$/, '') + '\n\n';
    const nextText = `${base}approved: sha256:${hashOf(base)} ${nowIso()} ${note}\n`;
    fs.writeFileSync(spec.file, nextText, 'utf8');
    const after = readSpec(task.dir);
    if (!after.approved || !after.approved.valid) {
      console.error('审批写入后哈希不匹配，请检查 SPEC 是否被并发改动。');
      process.exit(2);
    }
    console.log(`已批准：sha256:${after.approved.hash}（${note}）`);
    console.log(`下一步：node Script\\plan.mjs --task ${task.id}`);
    return;
  }

  if (opts.constants) {
    let spec;
    try {
      spec = readSpec(task.dir);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const result = checkSpec(spec, { strict: true, requireApproved: true });
    if (!result.ok) {
      printCheck(result);
      console.log('拒绝生成：SPEC 必须先批准且无占位。');
      process.exit(2);
    }
    const out = path.resolve(opts.out || path.join(task.dir, 'SpecConstants.java'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, emitConstants(spec, opts.pkg), 'utf8');
    console.log(`已生成：${out}（${spec.numeric.length} 个常量，package ${opts.pkg}）`);
    return;
  }

  if (!opts.lane) {
    console.error('缺少 --lane <S|M|L>。车道决定必做项与验证层。');
    usage();
    process.exit(1);
  }
  if (!['S', 'M', 'L'].includes(opts.lane)) {
    console.error('lane 只能是 S/M/L');
    process.exit(1);
  }
  const route = opts.route || 'none';
  if (opts.lane === 'L' && route === 'none') {
    console.error('L 车道必须写 --route native 或 --route layout');
    process.exit(1);
  }
  if (opts.lane !== 'L' && route !== 'none') {
    console.error(`${opts.lane} 车道不写界面路线（route 只能是 none）`);
    process.exit(1);
  }

  const specFile = path.join(task.dir, 'SPEC.md');
  if (fs.existsSync(specFile) && !opts.force) {
    console.error(`SPEC 已存在：${specFile}（要重建加 --force）`);
    process.exit(1);
  }
  const reqFile = path.join(task.dir, 'REQ.md');
  if (!fs.existsSync(reqFile)) {
    console.error('缺少 REQ.md：先运行 node Script\\req.mjs "<原话>"');
    process.exit(1);
  }
  const text = specTemplate({
    task: task.id,
    reqText: fs.readFileSync(reqFile, 'utf8'),
    lane: opts.lane,
    route,
    title: opts.title,
    now: nowIso(),
  });
  fs.writeFileSync(specFile, text, 'utf8');
  const factsFile = path.join(task.dir, 'FACTS.md');
  if (!fs.existsSync(factsFile)) {
    fs.writeFileSync(factsFile, factsTemplate({ task: task.id, title: opts.title, lane: opts.lane, now: nowIso() }), 'utf8');
    console.log(`FACTS 模板已建：${factsFile}`);
  }
  console.log(`SPEC 模板已建：${specFile}`);
  console.log('填完“数值要求 / 验收 / FACTS”后：node Script\\spec.mjs --check → --approve → node Script\\plan.mjs');
}

main();
