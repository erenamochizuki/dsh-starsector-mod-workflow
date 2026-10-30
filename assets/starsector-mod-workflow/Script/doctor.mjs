#!/usr/bin/env node
/**
 * doctor：识别技能版本与结构，报告能否使用 / 是否需要替换旧版。
 * 用法：node Script\doctor.mjs [--root <目录>] [--env] [--jdk <JDK 目录>] [--json]
 * 退出码：0 健康；1 参数或读取错误；2 旧版结构或必需项缺失。
 */
'use strict';

import { dispatchMoci } from './lib/moci-tools.mjs';
await dispatchMoci('doctor');
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readData, saveData, configFileOf, pathsOf, adoptLegacyDirs, ensureWorkDirs } from './lib/work.mjs';
import { writeStamp } from './lib/stamp.mjs';
import { envReport, renderEnv } from './lib/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEW_META = ['META.json', 'meta.json'];
const LEGACY = ['manifest.json', 'SS_INDEX.md', 'Skill', 'CASES'];

function parseArgs(argv) {
  const out = { root: path.resolve(HERE, '..'), json: false, env: false, info: false, jdk: null, game: null, mod: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' || argv[i] === '-r') out.root = path.resolve(argv[++i] || '.');
    else if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--env') out.env = true;
    else if (argv[i] === '--info') out.info = true;
    else if (argv[i] === '--jdk') { const v = argv[++i]; out.jdk = v ? path.resolve(v) : null; }
    else if (argv[i] === '--game') { const v = argv[++i]; out.game = v ? path.resolve(v) : null; }
    else if (argv[i] === '--mod') { const v = argv[++i]; out.mod = v ? path.resolve(v) : null; }
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else throw new Error('未知参数：' + argv[i]);
  }
  return out;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error('用法：node Script\\doctor.mjs [--root <目录>] [--info] [--env] [--json] [--game <游戏根> --mod <mod 目录>] [--jdk <JDK 目录>]');
    process.exit(1);
  }
  if (opts.help) {
    console.log('用法：node Script\\doctor.mjs [--root <目录>] [--info] [--env] [--json] [--game <游戏根> --mod <mod 目录>] [--jdk <JDK 目录>]');
    process.exit(0);
  }

  const root = opts.root;
  const at = (p) => path.join(root, p);
  const has = (p) => fs.existsSync(at(p));
  const report = { root, mode: 'unknown', version: null, schema: null, problems: [], warnings: [], notes: [] };

  let meta = null;
  let metaFile = null;
  for (const name of NEW_META) {
    if (!has(name)) continue;
    metaFile = name;
    try {
      meta = JSON.parse(fs.readFileSync(at(name), 'utf8'));
    } catch (e) {
      report.problems.push(`${name} 不是合法 JSON：${e.message}`);
    }
    break;
  }

  if (meta) {
    report.mode = 'v2';
    report.version = meta.version || null;
    report.schema = meta.schema || null;
    if (!report.version) report.problems.push(`${metaFile} 缺少 version`);
    if (report.schema !== 2) report.problems.push(`${metaFile} 的 schema 应为 2，实际为 ${report.schema}`);

    const required = (meta.structure && meta.structure.required) || [];
    for (const item of required) {
      if (!has(item)) report.problems.push(`必需项缺失：${item}`);
    }
    if (meta.entry && !has(meta.entry)) report.problems.push(`入口文件缺失：${meta.entry}`);

    const planned = (meta.structure && meta.structure.planned) || [];
    const missingPlanned = planned.filter((p) => !has(p));
    if (missingPlanned.length) report.notes.push(`未搭建（计划中）：${missingPlanned.join('、')}`);

    const leftovers = LEGACY.filter((p) => has(p));
    if (leftovers.length) report.warnings.push(`检测到旧版残留：${leftovers.join('、')}`);

    let data = readData(root);
    let cfg = configFileOf(root);

    // 显式绑定：--game <游戏根> --mod <mod 目录>
    if (opts.mod) {
      const mod = path.resolve(opts.mod);
      const game = opts.game || path.dirname(path.dirname(mod));
      data = { ...(data || {}), gameRoot: game, mod };
      cfg = saveData(data, root);
      report.notes.push(`已绑定：${cfg}`);
    }

    // 旧版 skill 根的 data.json → <mods>\.work\config.json，随后删除旧文件
    if (data && cfg && path.basename(cfg) === 'data.json') {
      const old = cfg;
      const f = saveData(data, root);
      fs.rmSync(old, { force: true });
      cfg = f;
      report.notes.push(`配置已迁移：${cfg}（旧 data.json 已删除）`);
    }

    if (data) {
      const paths = ensureWorkDirs(data);
      if (opts.jdk) {
        const jdk = path.resolve(opts.jdk);
        if (data.jdk !== jdk) {
          data = { ...data, jdk };
          cfg = saveData(data, root);
          report.notes.push(`已记录 JDK：${jdk}（${cfg}）`);
        }
      }
      const parts = ['gameRoot', 'mod'].filter((k) => data[k]).map((k) => `${k}=${data[k]}`);
      report.notes.push(parts.length ? `已绑定：${parts.join('；')}` : '配置存在但未填绑定');
      if (paths) {
        report.notes.push(`工作根：${paths.workRoot}`);
        report.notes.push(`本 mod：${paths.modWork}`);
        report.notes.push(`共享缓存：${paths.cache}`);
      }
      const moved = adoptLegacyDirs(root, data);
      if (moved.length) report.notes.push(`已迁入 .work：${moved.join('、')}`);
    } else {
      report.notes.push('未绑定：运行 node Script\\doctor.mjs --game <游戏根> --mod <mod 目录> 写 .work\\config.json');
      report.notes.push('未绑定时 spec --approve 会被拒绝，doctor 戳也不写入文件');
    }
  } else if (LEGACY.some((p) => has(p))) {
    report.mode = 'legacy';
    const mf = at('manifest.json');
    if (fs.existsSync(mf)) {
      try {
        const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
        report.version = m.version || null;
      } catch (e) {
        report.warnings.push(`manifest.json 读取失败：${e.message}`);
      }
    }
    report.warnings.push('这是 v0.4.x 旧结构（无 META.json）。替换：node Script\\replace.mjs --target <本目录> --backup <归档根>（先加 --dry-run 预演）。');
  } else {
    report.mode = 'empty';
    report.problems.push('既没有 META.json，也没有旧版标记；目录不对。');
  }

  const bad = report.problems.length > 0;
  const data = readData(root);
  if (!bad && meta) {
    if (data) {
      const st = writeStamp(root);
      if (st.ok) report.notes.push(`doctor 戳：${st.file}`);
      else report.warnings.push(`doctor 戳未写入：${st.reason}`);
    }
  }
  if (opts.env) {
    try {
      report.env = envReport({ skillRoot: root, data, jdk: opts.jdk });
      for (const w of report.env.warnings) report.warnings.push('环境：' + w);
    } catch (e) {
      report.warnings.push('环境探测失败：' + e.message);
    }
  }
  if (opts.info) {
    report.machine = {
      skillRoot: root,
      gameRoot: (data && data.gameRoot) || null,
      mod: (data && data.mod) || null,
      jdk: (data && data.jdk) || opts.jdk || null,
      config: data ? configFileOf(root) : null,
    };
  }
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.machine) {
      const m = report.machine;
      console.log('本机信息');
      console.log(`  技能根：${m.skillRoot}`);
      console.log(`  游戏根：${m.gameRoot || '未绑定'}`);
      console.log(`  mod 目录：${m.mod || '未绑定'}`);
      console.log(`  JDK：${m.jdk || '未指定（env 探测）'}`);
      console.log(`  配置文件：${m.config || '未创建，运行 --game <游戏根> --mod <mod 目录> 后写入'}`);
      if (!m.gameRoot || !m.mod) console.log('  下一步：向用户要游戏根与 mod 目录，再运行 --game/--mod 绑定。');
    }
    console.log(`目录：${report.root}`);
    console.log(`版本：${report.version || '未知'}    结构：${report.mode}${report.schema ? ' / schema ' + report.schema : ''}`);
    const pkgFile = path.join(root, 'PACKAGE.json');
    if (fs.existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        const h = crypto.createHash('sha256').update(fs.readFileSync(pkgFile)).digest('hex').slice(0, 12);
        console.log(`包：${pkg.files ?? '?'} 个文件    PACKAGE.json sha256:${h}`);
      } catch {
        console.log('包：PACKAGE.json 读取失败');
      }
    } else {
      console.log('包：—（源码目录，未打包）');
    }
    for (const n of report.notes) console.log('  · ' + n);
    for (const w of report.warnings) console.log('  ! ' + w);
    for (const p of report.problems) console.log('  ERR ' + p);
    if (report.env) {
      for (const line of renderEnv(report.env)) console.log(line);
      const w = report.env.warnings.length;
      console.log(`环境结论：${w ? w + ' 项待处理（W）' : 'ok'}`);
    }
    console.log(bad ? '结论：不可用' : report.mode === 'legacy' ? '结论：legacy（需替换后使用）' : '结论：ok');
  }
  process.exit(bad || report.mode === 'legacy' ? 2 : 0);
}

main();
