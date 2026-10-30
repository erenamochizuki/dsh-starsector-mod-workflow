// R3 三向接线：CSV/JSON 里声明的类必须存在；声明的 id 必须在代码/数据里被引用。
import { classToRel } from '../engine.mjs';

function looseJson(text) {
  try { return JSON.parse(text); } catch { /* 继续 */ }
  try { return JSON.parse(text.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

export default {
  id: 'R3',
  level: 'E',
  title: '接线缺失',
  check(ctx) {
    const out = [];
    const has = (fqcn) => {
      if (!fqcn) return true;
      // 本体类不查 mod 源码（离线无 jar 索引）；mod 类必须落地成文件。
      if (/^com\.fs\.starfarer\./.test(fqcn)) return true;
      const rel = classToRel(fqcn);
      return rel && ctx.exists(rel);
    };
    const miss = (file, what, fqcn) =>
      out.push({ file, line: 1, msg: `${what} 指向不存在的类：${fqcn}` });

    // 能力
    for (const rel of ['data/campaign/abilities.csv', 'data/config/abilities.csv']) {
      if (!ctx.exists(rel)) continue;
      if (rel === 'data/config/abilities.csv') {
        out.push({ file: rel, line: 1, msg: 'abilities.csv 应放在 data/campaign/，游戏不从 data/config/ 读它', level: 'W' });
      }
      const t = ctx.rowsOf(rel);
      if (!t) continue;
      for (const row of t.rows) {
        if (row.plugin && !has(row.plugin)) miss(rel, `能力 ${row.id}`, row.plugin);
      }
    }

    // 船插
    if (ctx.exists('data/hullmods/hull_mods.csv')) {
      const t = ctx.rowsOf('data/hullmods/hull_mods.csv');
      const used = new Set();
      for (const row of t?.rows || []) {
        if (!row.script) continue;
        used.add(row.script);
        if (!has(row.script)) miss('data/hullmods/hull_mods.csv', `船插 ${row.id}`, row.script);
      }
      for (const rel of ctx.byExt('.java')) {
        if (!rel.startsWith('data/scripts/hullmods/')) continue;
        const fqcn = rel.replace(/^data\/scripts\//, 'data.scripts.').replace(/\.java$/, '').split('/').join('.');
        if (!used.has(fqcn)) out.push({ file: rel, line: 1, msg: '船插类没有在 hull_mods.csv 里登记', level: 'W' });
      }
    }

    // 舰船系统
    for (const rel of ctx.byExt('.system')) {
      const j = looseJson(ctx.read(rel));
      if (j?.statsScript && !has(j.statsScript)) miss(rel, 'statsScript', j.statsScript);
    }

    // 武器每帧效果 / 光束效果
    for (const rel of ctx.byExt('.wpn')) {
      const j = looseJson(ctx.read(rel));
      if (j?.everyFrameEffect && !has(j.everyFrameEffect)) miss(rel, 'everyFrameEffect', j.everyFrameEffect);
      if (j?.beamEffect && !has(j.beamEffect)) miss(rel, 'beamEffect', j.beamEffect);
    }

    // mod 插件
    if (ctx.modInfo?.modPlugin && !has(ctx.modInfo.modPlugin)) miss('mod_info.json', 'modPlugin', ctx.modInfo.modPlugin);

    // rules.csv：结构（列数/id 唯一/未闭合引号）+ 自定义规则命令必须在 ruleCommandPackages 里
    const settings = ctx.exists('data/config/settings.json')
      ? looseJson(ctx.read('data/config/settings.json'))
      : null;
    const pkgs = settings?.ruleCommandPackages || [];
    const BUILTIN = new Set([
      'FireBest', 'FireAll', 'SetMemory', 'AddMemory', 'RemoveMemory', 'SetEntityMemory',
      'AddEntityMemory', 'RemoveEntityMemory', 'SetMarketMemory', 'AddMarketMemory',
      'SetPersonMemory', 'AddPersonMemory', 'ShowDialog', 'EndConversation', 'OpenCommLink',
      'SetReputation', 'AddReputation', 'AddXP', 'SetSkillLevel', 'AddCredits', 'AddCargo',
      'RemoveCargo', 'AddShipToFleet', 'RemoveShipFromFleet', 'SpawnFleet', 'CreateFleet',
      'StartCombat', 'EndCombat', 'AddIntel', 'RemoveIntel', 'PlaySound', 'SetMusic',
      'PauseMusic', 'ResumeMusic', 'ShowImage', 'HideImage', 'SetMarketVisible',
      'SetMarketHidden', 'SetEntityVisible', 'SetEntityHidden', 'TravelTo', 'SetFactionHostile',
      'SetFactionFriendly', 'SetFactionNeutral', 'SetDoNotAffectReputation',
    ]);
    const commandOf = (cell) =>
      String(cell || '')
        .split(/[|;,]/)
        .map((x) => x.trim().split(/\s+/)[0])
        // $/@ 开头是内存/全局键，不是规则命令
        .filter((x) => x && !x.startsWith('$') && !x.startsWith('@'));

    if (ctx.exists('data/campaign/rules.csv')) {
      const rel = 'data/campaign/rules.csv';
      const t = ctx.csvOf(rel);
      for (const e of t?.errors || []) out.push({ file: rel, line: e.line, msg: `CSV 解析：${e.msg}` });
      if (t) {
        if (t.raw.some((r) => r.length > t.header.length)) {
          const bad = t.raw.findIndex((r) => r.length > t.header.length);
          out.push({ file: rel, line: t.lineOf(bad), msg: `列数多于表头（${t.raw[bad].length} > ${t.header.length}）：字段里有未转义的逗号或漏了引号` });
        }
        const seen = new Map();
        for (let i = 0; i < t.rows.length; i++) {
          const row = t.rows[i];
          const id = (row[t.header[0]] || '').trim();
          if (!id) continue;
          if (seen.has(id)) out.push({ file: rel, line: t.lineOf(i), msg: `规则 id 重复：${id}（首次在 ${seen.get(id)}）` });
          else seen.set(id, t.lineOf(i));
          for (const col of ['script', 'options']) {
            if (!(col in row)) continue;
            for (const cmd of commandOf(row[col])) {
              if (BUILTIN.has(cmd)) continue;
              const hit = ctx.files.find((f) => f.startsWith('data/scripts/') && f.endsWith(`/${cmd}.java`));
              if (!hit) {
                out.push({ file: rel, line: t.lineOf(i), msg: `未知规则命令 ${cmd}：mod 源码里没有同名类（本体命令请加入内置名单）`, level: 'W' });
                continue;
              }
              const fqcn = hit.replace(/^data\/scripts\//, 'data.scripts.').replace(/\.java$/, '').split('/').join('.');
              const pkg = fqcn.split('.').slice(0, -1).join('.');
              if (!pkgs.some((p) => pkg === p || pkg.startsWith(p + '.'))) {
                out.push({
                  file: rel,
                  line: t.lineOf(i),
                  msg: `规则命令 ${cmd} 的包 ${pkg} 未登记：在 data/config/settings.json 的 ruleCommandPackages 里加上它`,
                });
              }
            }
          }
        }
      }
    }

    // 背景插件类必须存在
    if (ctx.exists('data/config/exerelin/character_backgrounds.csv')) {
      const rel = 'data/config/exerelin/character_backgrounds.csv';
      const t = ctx.rowsOf(rel);
      for (const row of t?.rows || []) {
        if (row.plugin && !has(row.plugin)) miss(rel, `背景 ${row.id}`, row.plugin);
      }
    }

    // 开局：className 可达 + factionId 存在（该文件没有 backgroundId）
    const CORE_FACTIONS = new Set(['player', 'neutral', 'pirates', 'hegemony', 'tritachyon', 'independent',
      'luddic_church', 'luddic_path', 'persean', 'sindrian_diktat', 'knights_of_ludd', 'remnants', 'mercenary']);
    for (const rel of ctx.files.filter((f) => f.endsWith('customStarts.json'))) {
      const j = looseJson(ctx.read(rel));
      if (!j) continue;
      for (const s of j.starts || []) {
        if (s.className && !has(s.className)) miss(rel, `开局 ${s.id || '?'} 的 className`, s.className);
        const fid = s.factionId;
        if (fid && !CORE_FACTIONS.has(fid) && !ctx.exists(`data/world/factions/${fid}.faction`)) {
          out.push({ file: rel, line: 1, msg: `开局 ${s.id || '?'} 的 factionId 不存在：${fid}` });
        }
      }
    }

    // ruleCommandPackages 里登记的包必须有目录
    for (const pkg of pkgs) {
      const dir = 'data/scripts/' + pkg.replace(/^data\.scripts\.?/, '').split('.').join('/');
      if (!ctx.files.some((f) => f.startsWith(dir + '/'))) {
        out.push({ file: 'data/config/settings.json', line: 1, msg: `ruleCommandPackages 里的包没有对应目录：${pkg}`, level: 'W' });
      }
    }
    return out;
  },
};
