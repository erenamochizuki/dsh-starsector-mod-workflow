/**
 * 任务与规格的读写、校验、哈希、常量生成。
 * req / spec / plan / verify / wrapup 共用，避免各脚本各写一套解析。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readData, pathsOf } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..', '..');

/** TASKS 根：默认 .work\<mod>\tasks；--root 用于演示/测试。 */
export function tasksRoot(rootOverride) {
  if (rootOverride) return path.join(path.resolve(rootOverride), 'TASKS');
  const paths = pathsOf(readData(SKILL_ROOT));
  if (paths) return paths.tasks;
  throw new Error('未绑定目标 mod：先运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录>');
}

/** 按修改时间倒序列出任务。 */
export function listTasks(rootOverride) {
  const dir = tasksRoot(rootOverride);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => fs.statSync(path.join(dir, n)).isDirectory())
    .map((n) => ({ id: n, dir: path.join(dir, n), mtime: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

/** 取任务：显式 id / id 前缀 / 最新。 */
export function resolveTask(id, rootOverride) {
  const list = listTasks(rootOverride);
  if (!list.length) throw new Error('还没有任务：先运行 node Script\\req.mjs "<原话>"');
  if (!id) return list[0];
  const hit = list.find((t) => t.id === id) || list.find((t) => t.id.startsWith(id));
  if (!hit) throw new Error(`找不到任务 ${id}；现有：${list.map((t) => t.id).join('、')}`);
  return hit;
}

/** 取 REQ 正文里 `## 原话` 的第一段非空行。 */
export function originalText(reqText) {
  const m = /##\s*原话\s*\n+([^\n]+)/.exec(reqText);
  return m ? m[1].trim() : '';
}

/** 去掉 approved 行后归一化，作为哈希输入。 */
export function bodyWithoutApproval(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^approved:/.test(l))
    .join('\n')
    .replace(/\s+$/, '');
}

/** 前 12 位 sha256。 */
export function hashOf(text) {
  return crypto.createHash('sha256').update(bodyWithoutApproval(text), 'utf8').digest('hex').slice(0, 12);
}

/** 取 markdown 的 `## <heading>` 区块。 */
export function section(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^##\\s+${escaped}\\s*$`, 'm').exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** 把 markdown 表格拆成行（去表头分隔行）。 */
function tableRows(block) {
  if (!block) return [];
  const rows = [];
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    if (cells.every((c) => c === '' || /^:?-+:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}

/** 数值要求行：常量名 / 类型 / 值 / 说明。 */
export function parseNumeric(text) {
  const rows = tableRows(section(text, '数值要求'));
  const out = [];
  for (const r of rows) {
    if (!r.length) continue;
    if (r[0] === '常量') continue; // 表头
    if (!r[0] || r[0].startsWith('<!--')) continue;
    out.push({ name: r[0], type: r[1] || '', value: r[2] || '', desc: r[3] || '' });
  }
  return out;
}

/** 验收行：A<n> / 描述 / 自动化。 */
export function parseAcceptance(text) {
  const rows = tableRows(section(text, '验收'));
  const out = [];
  for (const r of rows) {
    if (!r.length) continue;
    if (r[0] === 'A') continue;
    if (!/^A\d+$/.test(r[0])) continue;
    out.push({ id: r[0], desc: r[1] || '', auto: (r[2] || '').toLowerCase() });
  }
  return out;
}

/** 解析 SPEC：元信息、数值、验收、审批状态、当前哈希。 */
export function readSpec(taskDir) {
  const file = path.join(taskDir, 'SPEC.md');
  if (!fs.existsSync(file)) throw new Error('没有 SPEC.md：先运行 node Script\\spec.mjs --lane <S|M|L>');
  const text = fs.readFileSync(file, 'utf8');
  const get = (k) => {
    const m = new RegExp(`^-\\s*${k}:\\s*(.+)$`, 'm').exec(text);
    return m ? m[1].trim() : null;
  };
  const approvedMatch = /^approved:\s*sha256:([0-9a-f]{12})\s+(\S+)\s*(.*)$/m.exec(text);
  const current = hashOf(text);
  const approved = approvedMatch
    ? { hash: approvedMatch[1], at: approvedMatch[2], note: approvedMatch[3].trim(), valid: approvedMatch[1] === current }
    : null;
  return {
    file,
    text,
    meta: { title: get('title'), lane: get('lane'), route: get('route'), created: get('created') },
    numeric: parseNumeric(text),
    acceptance: parseAcceptance(text),
    approved,
    currentHash: current,
  };
}

const TYPE_RE = {
  float: /^-?\d+(\.\d+)?f?$/,
  int: /^-?\d+$/,
  boolean: /^(true|false)$/,
  String: /^".*"$/,
};

/** 校验 SPEC；strict=true 时占位内容也算 E（审批/施工图用）。 */
export function checkSpec(spec, { strict = false, requireApproved = false } = {}) {
  const problems = [];
  const warnings = [];
  const { meta, numeric, acceptance, text } = spec;

  if (!meta.title) problems.push('缺少 `- title:`');
  if (!meta.lane) problems.push('缺少 `- lane:`');
  else if (!['S', 'M', 'L'].includes(meta.lane)) problems.push(`lane 只能是 S/M/L，实际 ${meta.lane}`);
  if (!meta.route) problems.push('缺少 `- route:`');
  else if (!['native', 'layout', 'none'].includes(meta.route)) problems.push(`route 只能是 native/layout/none，实际 ${meta.route}`);
  if (meta.lane === 'L' && meta.route === 'none') problems.push('L 车道必须写界面路线（native 或 layout）');
  if (meta.lane === 'S' && meta.route !== 'none') problems.push('S 车道不写界面路线（route: none）');

  const names = new Set();
  for (const n of numeric) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(n.name)) problems.push(`常量名不合规：${n.name}（要求 UPPER_SNAKE）`);
    if (!TYPE_RE[n.type]) problems.push(`常量 ${n.name} 类型不支持：${n.type}（float/int/boolean/String）`);
    else if (!TYPE_RE[n.type].test(n.value)) problems.push(`常量 ${n.name} 的值与类型不符：${n.value}（${n.type}）`);
    if (names.has(n.name)) problems.push(`常量重复：${n.name}`);
    names.add(n.name);
    if (!n.desc) warnings.push(`常量 ${n.name} 没有说明`);
  }
  if (meta.lane === 'L' && !numeric.length) problems.push('L 车道必须至少 1 条数值要求');
  if (meta.lane === 'M' && !numeric.length) warnings.push('M 车道没有数值要求');

  const ids = acceptance.map((a) => a.id);
  const expected = acceptance.map((_, i) => 'A' + (i + 1));
  if (JSON.stringify(ids) !== JSON.stringify(expected)) problems.push(`验收编号必须从 A1 连续，实际：${ids.join('、') || '无'}`);
  if ((meta.lane === 'M' || meta.lane === 'L') && !acceptance.length) problems.push('M/L 车道必须至少 1 条验收');
  for (const a of acceptance) {
    if (!a.desc) problems.push(`${a.id} 没有描述`);
    if (!['yes', 'manual'].includes(a.auto)) problems.push(`${a.id} 的自动化列只能是 yes/manual，实际 ${a.auto || '空'}`);
  }
  const manual = acceptance.filter((a) => a.auto === 'manual').length;
  const manualCap = meta.lane === 'L' ? 2 : 1;
  if (manual > manualCap) warnings.push(`MANUAL 验收 ${manual} 条，超过上限 ${manualCap}`);

  if (strict) {
    for (const n of numeric) if (/^占位/.test(n.desc) || /^占位/.test(n.value)) problems.push(`常量 ${n.name} 仍是占位，改成真实数值或删除`);
    for (const a of acceptance) if (/^占位/.test(a.desc)) problems.push(`${a.id} 仍是占位，改成真实验收或删除`);
    if (/尚未填写|TODO/.test(text)) warnings.push('文档里还有 TODO/尚未填写');
  }

  // 已批准后被改动：无论是否要求批准，都是硬错误（防止“改完就忘”）。
  if (spec.approved && !spec.approved.valid) problems.push('SPEC 已改动，审批哈希失效：重新 --approve');
  if (requireApproved && !spec.approved) problems.push('SPEC 未批准：运行 node Script\\spec.mjs --approve');
  return { problems, warnings, ok: problems.length === 0 };
}

/** 由数值要求生成 SpecConstants.java。 */
export function emitConstants(spec, packageName = 'data.scripts.spec') {
  const lines = [
    `package ${packageName};`,
    '',
    '/** SPEC 数值要求生成的常量；改数值先改 SPEC 并重新审批。 */',
    'public final class SpecConstants {',
    '',
    '    private SpecConstants() {}',
    '',
  ];
  for (const n of spec.numeric) {
    if (n.desc) lines.push(`    /** ${n.desc.replace(/\*\//g, '* /')} */`);
    let value = n.value;
    if (n.type === 'float' && !/f$/.test(value)) value += 'f';
    lines.push(`    public static final ${n.type} ${n.name} = ${value};`);
    lines.push('');
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** 写 SPEC 模板。 */
export function specTemplate({ task, reqText, lane, route, title, now }) {
  const first = originalText(reqText);
  const t = title || (first ? first.slice(0, 60) : task);
  return `# SPEC: ${t}
- task: ${task}
- title: ${t}
- lane: ${lane}
- route: ${route}
- created: ${now}
- status: draft

## 目标

（一句话：做成什么样算完成）

## 不做什么

- （边界；防止顺手改别的）

## 行为

1. 

## 数值要求

| 常量 | 类型 | 值 | 说明 |
|---|---|---|---|
| C1 | float | 1f | 占位：改成真实数值或删除本行 |

## 验收

| A | 描述 | 自动化 |
|---|---|---|
| A1 | 占位：改成真实验收或删除本行 | yes |

## 待确认

- （最多 5 条；没有写“无”）

## 审批

未批准。运行 \`node Script\\spec.mjs --approve\`。
`;
}
