/**
 * facts：任务事实表：模板、解析、稳定引用校验。
 * 只认稳定引用：mod:文件:行 / api:全限定类 / jar:文件!条目；
 * .work/cache 下的临时路径不参与校验（clean 删了也不影响收尾）。
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { listEntries } from './zip.mjs';
import { loadApi } from './sources.mjs';

export function factsTemplate({ task, title, lane, now }) {
  return `# FACTS ${title || task}
任务：${task}　车道：${lane}　建立：${now}

按根因不确定度写，不设条数门槛。证据只写稳定引用，不要写 \`.work\`/\`cache\` 临时路径。

| # | 事实 | 证据（mod:文件:行 / api:类 / jar:文件!条目） | 验证方式 |
|---|---|---|---|
| F1 |  |  |  |

## 不确定点
- 

## 验证方式
- 
`;
}

const REF = /\b(?:mod|api|jar):[^\s`|)]+/g;

/** 证据单元格 → 引用列表（去掉行号后缀）。 */
export function refsOf(cell) {
  return (String(cell).match(REF) || []).map((raw) => ({ raw, ...splitRef(raw) }));
}

function splitRef(raw) {
  const i = raw.indexOf(':');
  const kind = raw.slice(0, i);
  const body = raw.slice(i + 1);
  if (kind === 'mod') {
    const m = body.match(/^(.*?)(?::\d+(?:-\d+)?)?$/);
    return { kind, target: m ? m[1] : body };
  }
  if (kind === 'jar') {
    const j = body.lastIndexOf('!');
    return { kind, jar: j >= 0 ? body.slice(0, j) : body, entry: j >= 0 ? body.slice(j + 1) : '' };
  }
  return { kind, target: body };
}

function resolveJar(name, modDir, gameRoot) {
  const cands = [
    path.resolve(modDir, name),
    path.join(modDir, 'jars', name),
    path.join(modDir, name.endsWith('.jar') ? name : name + '.jar'),
    gameRoot ? path.join(gameRoot, 'starsector-core', name) : '',
  ].filter(Boolean);
  return cands.find((p) => fs.existsSync(p)) || null;
}

/**
 * 校验 FACTS.md；返回 { findings:[{level,msg}], rows, refs }。
 * lane 为 S 时不强制存在；M/L 缺文件报 E（--legacy 降 W）。
 */
export function checkFacts({ text, modDir, gameRoot, lane, legacy = false }) {
  const findings = [];
  const rows = [];
  const refs = [];
  const need = lane === 'M' || lane === 'L';

  if (!text) {
    if (need && !legacy) findings.push({ level: 'E', msg: '车道 M/L 需要 FACTS.md（事实/证据/不确定点/验证方式）' });
    else if (need) findings.push({ level: 'W', msg: '旧任务没有 FACTS.md（--legacy 放行）' });
    return { findings, rows, refs };
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\|\s*(F\d+)\s*\|(.*)\|$/);
    if (!m) continue;
    const cells = m[2].split('|').map((s) => s.trim());
    const row = { id: m[1], line: i + 1, fact: cells[0] || '', evidence: cells[1] || '', how: cells[2] || '' };
    rows.push(row);
    const got = refsOf(row.evidence);
    if (!got.length && row.evidence.trim() && !row.evidence.includes('（')) {
      findings.push({ level: 'W', msg: `${m[1]} 的证据不是稳定引用：${row.evidence}` });
    }
    for (const r of got) {
      refs.push(r);
      if (r.kind === 'mod') {
        if (/^\.?[\\/]?\.work[\\/]/i.test(r.target)) continue; // 临时路径不校验
        if (!fs.existsSync(path.join(modDir, r.target))) {
          findings.push({ level: 'E', msg: `${m[1]} 的证据文件不存在：mod:${r.target}` });
        }
      } else if (r.kind === 'jar') {
        const jar = resolveJar(r.jar, modDir, gameRoot);
        if (!jar) {
          findings.push({ level: 'E', msg: `${m[1]} 的证据 jar 不存在：jar:${r.jar}` });
          continue;
        }
        if (!r.entry) {
          findings.push({ level: 'W', msg: `${m[1]} 的 jar 证据没写条目：${r.raw}` });
          continue;
        }
        try {
          const ok = listEntries(fs.readFileSync(jar)).some((e) => e.name === r.entry || e.name === r.entry + '.class');
          if (!ok) findings.push({ level: 'E', msg: `${m[1]} 的 jar 里没有条目：${r.entry}` });
        } catch {
          findings.push({ level: 'W', msg: `${m[1]} 的 jar 读不了：${r.jar}` });
        }
      } else if (r.kind === 'api') {
        try {
          const api = loadApi(gameRoot || undefined);
          const want = r.target.replace(/\./g, '/') + '.java';
          if (!api.entries.some((e) => e.name === want)) {
            findings.push({ level: 'E', msg: `${m[1]} 的 api 类不存在：${r.target}` });
          }
        } catch {
          findings.push({ level: 'W', msg: `${m[1]} 的 api 证据未校验（缺游戏目录）` });
        }
      }
    }
  }

  if (!rows.length) {
    findings.push({ level: 'W', msg: 'FACTS.md 里没有 F 开头的证据行（格式见模板）' });
  }
  return { findings, rows, refs };
}
