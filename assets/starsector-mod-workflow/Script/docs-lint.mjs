#!/usr/bin/env node
/**
 * docs-lint：检查文档里写的工具路径是否真实存在。
 *
 * 扫 SKILL.md / WORKFLOW.md / FACTS.md / INDEX.md / UPGRADE.md / REF\*.md，
 * 找出所有 `Script\...`、`GATE\...` 等引用（反斜杠或正斜杠均可），逐个 stat。
 * 历史迁移说明可用 <!-- docs-lint:ignore --> ... <!-- /docs-lint:ignore --> 包住。
 *
 * 用法：node Script\docs-lint.mjs [--root <技能目录>] [--json]
 * 退出码：0 全部存在；1 参数/IO；2 有缺失。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('docs-lint');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');
const PREFIXES = ['Script', 'GATE', 'LIB', 'KIT', 'REF', 'API', 'VERIFY', 'TPL', 'TASKS', 'HARVEST', 'DB'];
const REF_RE = new RegExp(`\\b(${PREFIXES.join('|')})[\\\\/]([A-Za-z0-9_./\\\\-]+\\.(?:mjs|java|md|json|ps1))`, 'g');

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = path.resolve(argv[++i] || '.');
    else if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '-h' || argv[i] === '--help') out.help = true;
    else throw new Error('未知参数：' + argv[i]);
  }
  return out;
}

function collectDocs(root) {
  const files = ['SKILL.md', 'WORKFLOW.md', 'FACTS.md', 'INDEX.md', 'UPGRADE.md']
    .map((n) => path.join(root, n))
    .filter((f) => fs.existsSync(f));
  const refDir = path.join(root, 'REF');
  if (fs.existsSync(refDir)) {
    for (const n of fs.readdirSync(refDir).sort()) {
      if (n.endsWith('.md')) files.push(path.join(refDir, n));
    }
  }
  return files;
}

function lintFile(root, file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const missing = [];
  let ignoring = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<!-- docs-lint:ignore')) ignoring = true;
    if (ignoring) {
      if (line.includes('<!-- /docs-lint:ignore')) ignoring = false;
      continue;
    }
    REF_RE.lastIndex = 0;
    let m;
    while ((m = REF_RE.exec(line))) {
      const rel = `${m[1]}/${m[2]}`.replace(/\\/g, '/').replace(/[.,;:]+$/, '');
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) {
        missing.push({ file: path.relative(root, file).replace(/\\/g, '/'), line: i + 1, ref: rel });
      }
    }
  }
  return missing;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error('用法：node Script\\docs-lint.mjs [--root <技能目录>] [--json]');
    process.exit(1);
  }
  if (opts.help) {
    console.log('用法：node Script\\docs-lint.mjs [--root <技能目录>] [--json]');
    return;
  }
  const docs = collectDocs(opts.root);
  const missing = docs.flatMap((f) => lintFile(opts.root, f));
  if (opts.json) {
    console.log(JSON.stringify({ root: opts.root, docs: docs.length, missing }, null, 2));
  } else {
    console.log(`docs-lint：扫描 ${docs.length} 个文档`);
    for (const m of missing) console.log(`  E ${m.file}:${m.line} 引用不存在：${m.ref}`);
    console.log(missing.length ? `结论：${missing.length} 处失效引用` : '结论：全部存在');
  }
  process.exit(missing.length ? 2 : 0);
}

main();
