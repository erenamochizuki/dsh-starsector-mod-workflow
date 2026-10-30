#!/usr/bin/env node
/**
 * req：把用户原话原样归档成 TASKS/<id>/REQ.md。
 * 用法：node Script\req.mjs "<原话>" [--attach <文件>]... [--file <文件>] [--id <id>] [--root <目录>]
 * 退出码：0 成功；1 参数或写入错误。
 */
import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('req');
import fs from 'node:fs';
import path from 'node:path';
import { tasksRoot } from './lib/task.mjs';

function usage() {
  console.log('用法：node Script\\req.mjs "<原话>" [--attach <文件>]... [--file <文件>] [--id <id>] [--root <目录>]');
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function stamp() {
  return nowIso().replace(/[-:T]/g, '').slice(0, 15);
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { text: '', file: null, attaches: [], id: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') opts.file = argv[++i];
    else if (a === '--attach') opts.attaches.push(argv[++i]);
    else if (a === '--id') opts.id = argv[++i];
    else if (a === '--root') opts.root = argv[++i];
    else if (a === '-h' || a === '--help') {
      usage();
      return;
    } else if (a.startsWith('--')) {
      console.error('未知参数：' + a);
      usage();
      process.exit(1);
    } else if (!opts.text) opts.text = a;
    else opts.text += '\n' + a;
  }

  if (opts.file) {
    if (!fs.existsSync(opts.file)) {
      console.error('文件不存在：' + opts.file);
      process.exit(1);
    }
    opts.text = fs.readFileSync(opts.file, 'utf8').trim();
  }
  if (!opts.text.trim()) {
    console.error('原话为空：请把用户的话原样传入（不要先总结）。');
    usage();
    process.exit(1);
  }

  const id = (opts.id || 'T-' + stamp()).replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
  const dir = path.join(tasksRoot(opts.root), id);
  if (fs.existsSync(dir)) {
    console.error(`任务已存在：${id}（换 --id，或直接继续用 node Script\\spec.mjs --task ${id}）`);
    process.exit(1);
  }
  fs.mkdirSync(dir, { recursive: true });

  const attachments = [];
  for (const a of opts.attaches) {
    const ok = fs.existsSync(a);
    attachments.push(`- ${a}${ok ? '' : '（未找到，需补）'}`);
    if (!ok) console.error('附件不存在：' + a);
  }

  const md = [
    `# REQ: ${id}`,
    '',
    `- created: ${nowIso()}`,
    `- source: ${opts.file ? '文件 ' + path.resolve(opts.file) : '对话'}`,
    '',
    '## 原话',
    '',
    opts.text.trim(),
    '',
    '## 附件',
    '',
    ...(attachments.length ? attachments : ['- 无']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'REQ.md'), md, 'utf8');

  console.log(`REQ 已归档：${path.join(dir, 'REQ.md')}`);
  console.log(`任务：${id}`);
  console.log(`下一步：node Script\\spec.mjs --task ${id} --lane <S|M|L>`);
}

main();
