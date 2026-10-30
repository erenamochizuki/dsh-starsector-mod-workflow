/**
 * redact：打包前把本机路径换成占位符，避免把某一台机器的目录结构带进发行包。
 *
 * 本机根从四处收集：.work 配置（gameRoot / mod / jdk）、家目录、技能根、`Script\local-roots.json`。
 * 文档类文件（.md/.json/.txt）先按已知根替换，再按通用盘符路径兜底；
 * 代码类文件（.mjs/.java/.ps1/.sh/.bat）只允许出现占位符，命中本机根即判打包失败。
 *
 * 用法：import { collectRoots, scrubDoc, findLocalRoots } from './lib/redact.mjs'
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readData } from './work.mjs';

const DOC_EXT = new Set(['.md', '.json', '.txt', '.csv', '.jsonl']);
const CODE_EXT = new Set(['.mjs', '.js', '.java', '.ps1', '.sh', '.bat', '.cmd']);

export function isDocFile(file) {
  return DOC_EXT.has(path.extname(file).toLowerCase());
}

export function isCodeFile(file) {
  return CODE_EXT.has(path.extname(file).toLowerCase());
}

/** 一个真实路径在文本里的所有写法：原文、正斜杠、转义双反斜杠。 */
function variants(from) {
  const list = new Set([from, from.replace(/\\/g, '/')]);
  const escaped = from.replace(/\\/g, '\\\\');
  list.add(escaped);
  list.add(escaped.replace(/\\\\/g, '\\'));
  return [...list].filter((v) => v.length >= 4);
}

/**
 * 收集本机根，长的排前面，避免父目录先命中把子目录替成 `占位符 + 余下路径`。
 * @param {string} skillRoot 技能根
 * @param {string} [startDir] 配置发现起点，默认进程当前目录
 */
export function collectRoots(skillRoot, startDir) {
  const roots = [];
  const add = (from, to) => {
    if (!from || from.length < 4) return;
    roots.push({ from: path.resolve(from), to });
  };

  let data = null;
  try {
    data = readData(skillRoot, startDir);
  } catch {
    data = null;
  }
  if (data && data.mod) add(data.mod, '<mod 目录>');
  if (data && data.gameRoot) add(data.gameRoot, '<游戏根>');
  if (data && data.jdk) add(data.jdk, '<JDK 目录>');

  add(os.homedir(), '<用户目录>');
  add(skillRoot, '<技能源目录>');

  const extra = path.join(skillRoot, 'Script', 'local-roots.json');
  if (fs.existsSync(extra)) {
    let list;
    try {
      list = JSON.parse(fs.readFileSync(extra, 'utf8'));
    } catch (e) {
      throw new Error(`Script\\local-roots.json 不是合法 JSON：${e.message}`);
    }
    if (!Array.isArray(list)) throw new Error('Script\\local-roots.json 必须是数组');
    for (const item of list) {
      if (!item || typeof item.from !== 'string' || typeof item.to !== 'string') {
        throw new Error('Script\\local-roots.json 的每一项都要有 from 与 to 字符串');
      }
      add(item.from, item.to);
    }
  }

  return roots.sort((a, b) => b.from.length - a.from.length);
}

const GENERIC_ABS = /(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\s"'`<>|:*?\r\n]+\\)+[^\\\s"'`<>|:*?\r\n]*/g;
const GENERIC_ABS_ESCAPED = /(?<![A-Za-z0-9])[A-Za-z]:\\\\(?:[^\\\s"'`<>|:*?\r\n]+\\\\)+[^\\\s"'`<>|:*?\r\n]*/g;
const GENERIC_SHORT = /(?<![A-Za-z0-9])[A-Za-z]:\\[^\\\s"'`<>|:*?\r\n]+/g;
const PLACEHOLDER = '<本机路径>';

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 文档：替换本机根，再用通用盘符路径兜底。返回 { text, hits }。 */
export function scrubDoc(text, roots) {
  let out = text;
  let hits = 0;
  for (const r of roots) {
    for (const v of variants(r.from)) {
      const re = new RegExp(escapeRe(v), 'gi');
      const n = (out.match(re) || []).length;
      if (!n) continue;
      hits += n;
      out = out.replace(re, r.to);
    }
  }
  for (const re of [GENERIC_ABS_ESCAPED, GENERIC_ABS, GENERIC_SHORT]) {
    const n = (out.match(re) || []).length;
    if (!n) continue;
    hits += n;
    out = out.replace(re, PLACEHOLDER);
  }
  return { text: out, hits };
}

/** 代码：返回命中的本机根（按行号）。 */
export function findLocalRoots(text, roots) {
  const lines = text.split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const r of roots) {
      if (variants(r.from).some((v) => lower.includes(v.toLowerCase()))) {
        found.push({ line: i + 1, to: r.to, text: lines[i].trim() });
        break;
      }
    }
  }
  return found;
}

/** 列表本身也要脱敏：只留占位符名，不留原始路径。 */
export function describeRoots(roots) {
  return roots.map((r) => r.to);
}

export { DOC_EXT, CODE_EXT };
