// 闸门自检：为每条规则造一个最小反例，断言恰好命中；另验基线降级与干净工程零 E。
// node Script\verify-selftest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scan, baselinePath, keyOf } from '../GATE/engine.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-gate-selftest-'));
let fail = 0, pass = 0;

function fixture(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    write(rel, text) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, 'utf8');
      return this;
    },
  };
}

function assertClean(name, findings) {
  const e = findings.filter((x) => x.level === 'E');
  if (!e.length) { pass++; console.log(`ok   ${name} → 零 E`); return; }
  fail++;
  console.log(`FAIL ${name} 出现 E：`);
  for (const x of e) console.log(`       ${x.level} ${x.rule} ${x.file}:${x.line} ${x.msg}`);
}

function assertRule(name, findings, want, allowed = []) {
  const hit = findings.some((f) => f.rule === want.rule && f.level === want.level);
  const unexpected = findings.filter((f) => f.rule !== want.rule && f.level === 'E' && !allowed.includes(f.rule));
  if (hit && !unexpected.length) {
    pass++;
    console.log(`ok   ${name} → ${want.rule} ${want.level}`);
  } else {
    fail++;
    console.log(`FAIL ${name} → 期望 ${want.rule} ${want.level}；实际：`);
    for (const f of findings) console.log(`       ${f.level} ${f.rule} ${f.file}:${f.line} ${f.msg}`);
  }
}

const java = (body) => `package data.scripts.test;\npublic class T {\n${body}\n}\n`;

// R1
{
  const f = fixture('r1');
  f.write('data/scripts/t/Big.java', `package data.scripts.t;\npublic class Big {\n${'  int a;\n'.repeat(1600)}}\n`);
  assertRule('R1 大文件', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R1', level: 'E' });
}
// R2
{
  const f = fixture('r2');
  f.write('data/scripts/t/T.java', java('  String s = "data/missing.png";'));
  assertRule('R2 缺资源', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R2', level: 'E' });
}
// R3
{
  const f = fixture('r3');
  f.write('data/campaign/abilities.csv', 'name,id,type,plugin\n测试,t1,TOGGLE,data.scripts.missing.X\n');
  assertRule('R3 接线', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R3', level: 'E' });
}
// R3 beamEffect
{
  const f = fixture('r3b');
  f.write('data/weapons/t.wpn', '{ "id":"t", "beamEffect":"data.scripts.missing.Beam" }');
  assertRule('R3 beamEffect 接线', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R3', level: 'E' });
}
// R3 CSV：注释行 + 空行 + BOM + CRLF
{
  const f = fixture('r3c');
  f.write('data/campaign/rules.csv',
    '\uFEFF# 注释行\r\n\r\nid,trigger,conditions,script,text,options,notes\r\nt1,xxx,,FireBest,,,note\r\n');
  assertClean('R3 CSV 注释/空行/BOM/CRLF', (await scan(f.dir, { rebaseline: true })).findings);
}
// R3 CSV：引号内逗号
{
  const f = fixture('r3d');
  f.write('data/campaign/rules.csv',
    'id,trigger,conditions,script,text,options,notes\nt1,xxx,,FireBest,"你好，舰长",,note\n');
  assertClean('R3 CSV 引号内逗号', (await scan(f.dir, { rebaseline: true })).findings);
}
// R3 CSV：引号内换行
{
  const f = fixture('r3e');
  f.write('data/campaign/rules.csv',
    'id,trigger,conditions,script,text,options,notes\nt1,xxx,,FireBest,"第一行\n第二行",,note\n');
  assertClean('R3 CSV 引号内换行', (await scan(f.dir, { rebaseline: true })).findings);
}
// R3 CSV：未闭合引号
{
  const f = fixture('r3f');
  f.write('data/campaign/rules.csv',
    'id,trigger,conditions,script,text,options,notes\nt1,xxx,,"FireBest,没闭合,,note\n');
  assertRule('R3 CSV 未闭合引号', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R3', level: 'E' });
}
// R3 规则命令：类存在但包未登记
{
  const f = fixture('r3g');
  f.write('data/config/settings.json', '{ "ruleCommandPackages": [] }\n');
  f.write('data/scripts/apstart/ap_Custom.java', 'package data.scripts.apstart;\npublic class ap_Custom { }\n');
  f.write('data/campaign/rules.csv', 'id,trigger,conditions,script,text,options,notes\nt1,xxx,,ap_Custom,,,note\n');
  assertRule('R3 规则命令包未登记', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R3', level: 'E' });
}
// R3 背景/开局引用
{
  const f = fixture('r3h');
  f.write('data/config/exerelin/character_backgrounds.csv', 'id,plugin\nbg1,data.scripts.missing.Bg\n');
  f.write('data/config/exerelin/customStarts.json',
    '{"starts":[{"id":"s1","className":"data.scripts.missing.Start","factionId":"no_such_faction"}]}\n');
  assertRule('R3 背景/开局引用', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R3', level: 'E' });
}
// R4
{
  const f = fixture('r4');
  f.write('data/scripts/t/T.java', java('  String p = "E:\\\\mods\\\\demo";'));
  assertRule('R4 绝对路径', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R4', level: 'E' });
}
// R5
{
  const f = fixture('r5');
  f.write('data/scripts/t/T.java', java('  boolean d = Mouse.isButtonDown(0);'));
  assertRule('R5 鼠标轮询', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R5', level: 'E' });
}
// R6
{
  const f = fixture('r6');
  f.write('data/scripts/a/Slider.java', 'package data.scripts.a;\nclass Slider {}\n');
  f.write('data/scripts/b/Slider.java', 'package data.scripts.b;\nclass Slider {}\n');
  assertRule('R6 重复实现', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R6', level: 'E' });
}
// R6b：不同类名但同一套滚轮实现
{
  const f = fixture('r6b');
  f.write('data/scripts/a/A.java', java('  int scroll = getDWheel();'));
  f.write('data/scripts/b/B.java', java('  int scroll = getDWheel();'));
  assertRule('R6 重复滚轮', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R6', level: 'E' });
}
// R6c：两套手写拖拽（不同类名）
{
  const f = fixture('r6c');
  const drag = java('  boolean wasDown;\n  boolean d = Mouse.isButtonDown(0);');
  f.write('data/scripts/a/A.java', drag);
  f.write('data/scripts/b/B.java', drag);
  assertRule('R6 重复拖拽', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R6', level: 'E' }, ['R5']);
}
// R7
{
  const f = fixture('r7');
  f.write('TASKS/t1/SPEC.md', '# 规格\n\napproved: sha256:0123456789ab 2026-01-01 自检\n\n## 数值要求\n\n| 名称 | 类型 | 值 |\n|---|---|---|\n| 赎回基数 | int | 20000 |\n');
  f.write('TASKS/t1/SpecConstants.java', 'package data.scripts.spec;\npublic final class SpecConstants {\n  public static final int REDEEM_BASE = 21000;\n}\n');
  assertRule('R7 数值要求', (await scan(f.dir, { rebaseline: true, tasks: path.join(f.dir, 'TASKS') })).findings, { rule: 'R7', level: 'E' });
}
// R8
{
  const f = fixture('r8');
  f.write('HANDOFF.md', '# 交接\n\n见 [缺失](missing.md)。\n');
  assertRule('R8 死链', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'R8', level: 'E' });
}
// S1
{
  const f = fixture('s1');
  f.write('data/scripts/t/T.java', java('  public void processInput(java.util.List<Object> events) { }'));
  assertRule('S1 事件消费', (await scan(f.dir, { rebaseline: true })).findings, { rule: 'S1', level: 'W' });
}
// 干净工程
{
  const f = fixture('clean');
  f.write('mod_info.json', '{"id":"clean","name":"干净","version":"1.0"}');
  f.write('data/scripts/t/T.java', java('  int a = 1;'));
  const findings = (await scan(f.dir, { rebaseline: true })).findings;
  if (!findings.some((x) => x.level === 'E')) { pass++; console.log('ok   干净工程 → 零 E'); }
  else { fail++; console.log('FAIL 干净工程出现 E：'); for (const x of findings) console.log(`       ${x.level} ${x.rule} ${x.file}: ${x.msg}`); }
}
// 基线降级
{
  const f = fixture('baseline');
  f.write('data/scripts/t/Big.java', `package data.scripts.t;\npublic class Big {\n${'  int a;\n'.repeat(1600)}}\n`);
  const first = await scan(f.dir, { rebaseline: true });
  const bp = baselinePath(f.dir);
  fs.mkdirSync(path.dirname(bp), { recursive: true });
  const keys = {};
  for (const x of first.findings) keys[keyOf(x.rule, x)] = 1;
  fs.writeFileSync(bp, JSON.stringify({ mod: f.dir, keys }, null, 2));
  const second = await scan(f.dir, { rebaseline: false });
  const e = second.findings.filter((x) => x.level === 'E').length;
  const w = second.findings.filter((x) => x.level === 'W').length;
  fs.rmSync(bp, { force: true });
  if (e === 0 && w >= 1) { pass++; console.log('ok   基线 → 存量降级为 W'); }
  else { fail++; console.log(`FAIL 基线：E=${e} W=${w}`); }
}

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n闸门自检：通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
