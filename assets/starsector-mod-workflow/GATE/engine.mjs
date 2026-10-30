// 闸门引擎：扫一个 mod 目录，跑 GATE\rules 下的规则，合并 baseline 后给出 E/W。
// 规则文件默认导出 { id, level, title, check(ctx) }；check 返回 [{ file, line, msg }]。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const GATE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_ROOT = path.dirname(GATE_DIR);

const TEXT_EXT = new Set(['.java', '.csv', '.json', '.md', '.txt', '.faction', '.system', '.ship', '.variant', '.wpn', '.wpn']);
const SKIP_DIRS = new Set(['.git', 'graphics', 'sounds', 'images', 'cache', 'save']);
// 显式忽略工作/草稿目录，防止 workDir 被配成非点号目录后混进闸门
// VERIFY 是本 skill 的工具目录（含 acl-recovery 等外部工具产物），不属于 mod 交付内容。
const SKIP_NAMES = new Set(['.work', '.back', 'tasks', 'harvest', 'dist', 'node_modules', 'verify']);

export function walk(root, rel = '', out = []) {
  const dir = path.join(root, rel);
  for (const name of fs.readdirSync(dir)) {
    const r = rel ? `${rel}/${name}` : name;
    const abs = path.join(root, r);
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      // 跳过隐藏目录（.back/.git 等备份副本不应参与闸门）
      if (name.startsWith('.') || SKIP_DIRS.has(name.toLowerCase()) || SKIP_NAMES.has(name.toLowerCase())) continue;
      walk(root, r, out);
    } else if (TEXT_EXT.has(path.extname(name).toLowerCase()) || name === 'mod_info.json') {
      out.push(r.replace(/\\/g, '/'));
    }
  }
  return out;
}

// CSV 解析统一走 csv.mjs（引号、注释行、BOM、未闭合引号）。
import { csvTable } from './csv.mjs';
export { parseCsv, csvTable } from './csv.mjs';

export function classToRel(fqcn) {
  if (!fqcn || !/^[\w.]+$/.test(fqcn)) return null;
  return fqcn.split('.').join('/') + '.java';
}

export async function loadRuleModules() {
  const dir = path.join(GATE_DIR, 'rules');
  const mods = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    if (!m.default || !m.default.id || typeof m.default.check !== 'function') {
      throw new Error(`规则文件缺少默认导出 {id,level,title,check}：${f}`);
    }
    mods.push(m.default);
  }
  return mods;
}

export function makeContext(modDir, opts = {}) {
  const files = walk(modDir);
  const cache = new Map();
  const read = (rel) => {
    if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(modDir, rel), 'utf8'));
    return cache.get(rel);
  };
  const exists = (rel) => fs.existsSync(path.join(modDir, rel));
  const byExt = (ext) => files.filter((f) => f.toLowerCase().endsWith(ext));
  let modInfo = null;
  try { modInfo = JSON.parse(read('mod_info.json')); } catch { /* 没有或不是合法 JSON 时交给规则报 */ }
  const rowsOf = (rel) => {
    try { return csvTable(read(rel)); } catch { return null; }
  };
  /** 带解析错误与行号的 CSV 表（r3 用来报未闭合引号）。 */
  const csvOf = (rel) => {
    try { return csvTable(read(rel)); } catch { return null; }
  };
  return { modDir, skillRoot: SKILL_ROOT, files, read, exists, byExt, rowsOf, csvOf, modInfo, opts };
}

export function baselinePath(modDir) {
  const safe = path.basename(path.resolve(modDir)).replace(/[^\w\u4e00-\u9fa5.-]+/g, '_');
  return path.join(GATE_DIR, 'baseline', `${safe}.json`);
}

export function keyOf(rule, f) {
  return `${rule}|${f.file}|${f.line || 0}|${f.msg}`;
}

export function applyBaseline(findings, baseline) {
  const seen = baseline?.keys || {};
  return findings.map((f) => {
    const k = keyOf(f.rule, f);
    return seen[k] ? { ...f, level: 'W', debt: true } : f;
  });
}

export async function scan(modDir, opts = {}) {
  const ctx = makeContext(modDir, opts);
  const rules = await loadRuleModules();
  const findings = [];
  for (const rule of rules) {
    let out = [];
    try { out = rule.check(ctx) || []; } catch (e) {
      findings.push({ rule: rule.id, level: 'E', file: '(规则异常)', line: 0, msg: `${rule.id} 抛异常：${e.message}` });
      continue;
    }
    for (const f of out) {
      findings.push({
        rule: rule.id,
        level: f.level || rule.level || 'E',
        file: f.file,
        line: f.line || 0,
        msg: f.msg,
      });
    }
  }
  const bp = opts.baselinePath || baselinePath(modDir);
  let baseline = null;
  if (fs.existsSync(bp) && !opts.rebaseline) {
    try { baseline = JSON.parse(fs.readFileSync(bp, 'utf8')); } catch { baseline = null; }
  }
  const applied = baseline ? applyBaseline(findings, baseline) : findings;
  return { findings: applied, baseline, baselinePath: bp, rules };
}
