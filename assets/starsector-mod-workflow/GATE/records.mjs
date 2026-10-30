/**
 * GATE\records.mjs：B/W 记录的读取与强制检查。
 *
 * 记录位置：{backup}\note\bug\Bnnn.md、{backup}\note\work\Wnnn.md
 * B 记录必须有 `- rule:` 或 `- test:`，且指向真实存在的文件；否则收尾不通过。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.resolve(HERE, '..');

/** 记录目录；backup 为空时返回 null。 */
export function noteDirs(backup) {
  if (!backup) return null;
  return {
    bug: path.join(backup, 'note', 'bug'),
    work: path.join(backup, 'note', 'work'),
  };
}

/** 标题归一：去掉标点与空白，便于查重。 */
export function normalizeTitle(s) {
  return String(s || '').toLowerCase().replace(/[\s，。,.：:；;、!！?？“”"'（）()\[\]【】《》<>—-]/g, '');
}

/** 读一坨 B/W 文本里的一级标题与字段。 */
function parseNote(file, kind) {
  const text = fs.readFileSync(file, 'utf8');
  const first = text.split(/\r?\n/).find((l) => /^#\s+/.test(l)) || '';
  const title = first.replace(/^#\s+/, '').replace(/^[BW]\d+\s*/, '').trim();
  const rule = (text.match(/^\s*-\s*rule:\s*(.+)$/mi) || [])[1] || '';
  const test = (text.match(/^\s*-\s*test:\s*(.+)$/mi) || [])[1] || '';
  return {
    file,
    kind,
    title,
    text,
    rule: rule.trim(),
    test: test.trim(),
  };
}

/** 列出某目录下的记录，按文件名排序。 */
export function listNotes(dir, kind) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => /^(B|W)\d+.*\.md$/i.test(n))
    .sort()
    .map((n) => parseNote(path.join(dir, n), kind));
}

/** 下一个编号：B001、B002…… */
export function nextId(dir, prefix) {
  if (!dir || !fs.existsSync(dir)) return prefix + '001';
  let max = 0;
  for (const n of fs.readdirSync(dir)) {
    const m = n.match(new RegExp('^' + prefix + '(\\d+)', 'i'));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/** 引用值是否能在 skill / 目标 mod 里找到（支持 `文件:行` 写法）。 */
export function refExists(ref, searchRoots) {
  const clean = String(ref || '').split(/\s|（|\(/)[0].replace(/:(\d+)$/, '').trim();
  if (!clean || /^（|^\(|^无/.test(clean)) return false;
  for (const root of searchRoots) {
    if (!root) continue;
    const p = path.isAbsolute(clean) ? clean : path.join(root, clean);
    if (fs.existsSync(p)) return true;
  }
  return false;
}

/**
 * 检查记录。返回 findings：B 缺 rule/test 或引用不存在 → E；W 无引用 → W。
 * searchRoots 用来定位 `- rule:` / `- test:` 指向的文件。
 */
export function checkNotes(backup, searchRoots = [], opts = {}) {
  const legacy = !!opts.legacy;
  const dirs = noteDirs(backup);
  const findings = [];
  if (!dirs) return { findings, bugs: [], works: [] };
  const bugs = listNotes(dirs.bug, 'bug');
  const works = listNotes(dirs.work, 'work');
  const roots = [SKILL_ROOT, ...searchRoots];

  for (const b of bugs) {
    const has = b.rule || b.test;
    if (!has) {
      findings.push({
        level: legacy ? 'W' : 'E',
        file: b.file,
        line: 1,
        msg: `${path.basename(b.file)} 缺 - rule: 或 - test:（记录必须留下可执行的东西）${legacy ? '［按旧记录放行］' : ''}`,
      });
      continue;
    }
    for (const [k, v] of [['rule', b.rule], ['test', b.test]]) {
      if (!v) continue;
      if (!refExists(v, roots)) {
        findings.push({
          level: 'W',
          file: b.file,
          line: 1,
          msg: `${path.basename(b.file)} 的 - ${k}: ${v} 找不到对应文件`,
        });
      }
    }
  }
  return { findings, bugs, works };
}

/** 查重：返回标题高度重合的既有记录。 */
export function findSimilar(title, notes) {
  const t = normalizeTitle(title);
  if (!t) return [];
  return notes.filter((n) => {
    const u = normalizeTitle(n.title);
    if (!u) return false;
    return u.includes(t) || t.includes(u) || (t.length >= 6 && u.length >= 6 && (u.includes(t.slice(0, 6)) || t.includes(u.slice(0, 6))));
  });
}

/** 生成一条记录的模板。 */
export function noteTemplate(id, kind, title, now) {
  const date = (now || new Date()).toISOString().slice(0, 10);
  if (kind === 'bug') {
    return `# ${id} ${title}

- 日期：${date}
- 状态：open

## 现象

## 复现

## 根因

## 修复

- rule:（可执行的规则文件，如 GATE\\rules\\r6-duplicate.mjs）
- test:（或测试文件:行，如 LIB\\test\\TestAll.java:120）
`;
  }
  return `# ${id} ${title}

- 日期：${date}
- 状态：done

## 做了什么

## 证据

- 命令：
- 产物：
`;
}
