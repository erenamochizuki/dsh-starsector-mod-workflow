#!/usr/bin/env node
// Offline tutorial lookup; never executes downloaded scripts or writes to the game.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadProject, inside } from './lib/moci-project.mjs';
import { markdownStructure, chunkMarkdown, exactMatcher } from './lib/tutorial-chunks.mjs';

const aliasGroups = [
  ['船插', '舰船插件', 'hullmod', 'HullModEffect'],
  ['舰船系统', '战术系统', 'shipsystem', 'ShipSystemStatsScript'],
  ['分层渲染', 'layered', 'BaseCombatLayeredRenderingPlugin'],
  ['内存', 'memory', 'MemoryAPI'], ['规则', 'rules', 'rules.csv'],
  ['情报', 'intel', 'BaseIntelPlugin'], ['战机', '编队', 'fighter', 'wing_data'],
  ['模块', 'module', 'STATION_MODULE'], ['势力', 'faction'], ['音乐', 'music'],
  ['音效', 'sound', 'SoundPlayerAPI'], ['弹体', 'projectile', 'projectileSpecId'],
  ['监听器', 'listener'], ['着色器', 'shader', 'GLSL'],
  ['存档', '读档', 'save', 'onGameLoad'], ['可选依赖', 'optional', 'isModEnabled'],
  ['属性', '数值', 'MutableStat'], ['市场', 'market'], ['工业', '产业', 'industry'],
  ['酒吧', 'bar'], ['任务', 'mission'],
].map(group => group.map(normalize));
const stopWords = new Set(['为什么', '怎么', '如何', '什么', '一个', '我们', '可以', '进行', '使用', '制作', '的', '了', '是', '和', 'the', 'a', 'to', 'how']);
const slash = value => value.replaceAll('\\', '/');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function normalize(value) { return value.normalize('NFKC').toLowerCase(); }
function files(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) return [];
    return entry.isDirectory() ? files(file) : [file];
  }).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
function pageFiles(source) {
  return files(path.join(source, 'docs')).filter(file =>
    /^docs\/(?:README\.md|chapter\d+\/(?:README\.md|section\d+\/README\.md))$/.test(slash(path.relative(source, file))));
}
function gitInfo(source) {
  const run = args => {
    const result = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  return { commit: run(['rev-parse', 'HEAD']), origin: run(['remote', 'get-url', 'origin']),
    workingTreeDirty: run(['status', '--porcelain', '--untracked-files=normal'])?.length > 0 };
}
function metadata(file, text) {
  const chapter = Number(file.match(/chapter(\d+)/)?.[1] || 0);
  const section = Number(file.match(/section(\d+)/)?.[1] || 0);
  const id = !chapter ? 'ROOT' : section ? 'C' + chapter + '-S' + section : 'C' + chapter;
  const { headings } = markdownStructure(text);
  return { id, chapter, section, title: headings.find(h => h.level === 1)?.title || id, headings };
}
function sourceVersion(source) {
  const file = 'README.md', target = path.join(source, file);
  if (!fs.existsSync(target)) return { value: null, evidence: null };
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/Starsector\s+`?(\d+\.\d+[a-z]?(?:[- ]RC\d+)?)/i);
    if (match) return { value: match[1], evidence: { file, line: i + 1 } };
  }
  return { value: null, evidence: null };
}
function sourceUrl(info, file) {
  const github = info.origin?.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/);
  return github && info.commit ? 'https://github.com/' + github[1] + '/blob/' + info.commit + '/' + file : null;
}
function build(source, library) {
  if (!fs.existsSync(path.join(source, 'docs', 'README.md'))) throw new Error('教程 source 缺少 docs/README.md');
  const info = gitInfo(source);
  const fixtures = files(path.join(source, 'tutorial-fixtures', 'units')).map(f => slash(path.relative(source, f)));
  const documents = pageFiles(source).map(file => {
    const raw = fs.readFileSync(file);
    const text = raw.toString('utf8').replace(/^\uFEFF/, '');
    const relative = slash(path.relative(source, file));
    const meta = metadata(relative, text);
    return {
      ...meta, file: relative, sha256: hash(raw), text, chunks: chunkMarkdown(text, meta.id),
      references: [...new Set([...text.matchAll(/\[C(\d+)-S(\d+)\]/g)].map(m => 'C' + m[1] + '-S' + m[2]))],
      fixtures: fixtures.filter(f => f.startsWith('tutorial-fixtures/units/' + meta.id + '/')),
      url: sourceUrl(info, relative),
    };
  });
  if (!documents.some(d => d.section)) throw new Error('教程 source 中未找到分节页面');
  const sourceFiles = [...(fs.existsSync(path.join(source, 'README.md')) ? ['README.md'] : []), ...fixtures]
    .map(file => ({ file, sha256: hash(fs.readFileSync(path.join(source, file))) }));
  const index = { schema: 2, builtAt: new Date().toISOString(), source: slash(path.relative(library, source)),
    sourceType: 'tutorial', tutorialVersion: sourceVersion(source), ...info, sourceFiles, documents };
  fs.mkdirSync(library, { recursive: true });
  const target = path.join(library, 'index.json'), temporary = target + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(temporary, JSON.stringify(index, null, 2) + '\n');
    // Windows scanners can briefly lock the destination. Preserve the old index on failure.
    for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(temporary, target); break; }
      catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 7) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return { ...index, sourceRoot: source };
}
function load(library) {
  const target = path.join(library, 'index.json');
  if (!fs.existsSync(target)) throw new Error('缺少索引，请先运行 tutorial.mjs index');
  const index = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (index.schema !== 2 || !Array.isArray(index.documents)) throw new Error('不支持的索引格式，请运行 index 重建');
  return { ...index, sourceRoot: path.resolve(library, index.source) };
}
function status(index) {
  const known = new Map([...index.documents, ...index.sourceFiles].map(d => [d.file, d]));
  const current = [...pageFiles(index.sourceRoot), ...files(path.join(index.sourceRoot, 'tutorial-fixtures', 'units')),
    ...(fs.existsSync(path.join(index.sourceRoot, 'README.md')) ? [path.join(index.sourceRoot, 'README.md')] : [])];
  const added = [], modified = [], missing = [];
  for (const file of current) {
    const relative = slash(path.relative(index.sourceRoot, file));
    if (!known.has(relative)) added.push(relative);
    else if (hash(fs.readFileSync(file)) !== known.get(relative).sha256) modified.push(relative);
    known.delete(relative);
  }
  missing.push(...known.keys());
  const currentInfo = gitInfo(index.sourceRoot), currentCommit = currentInfo.commit;
  const commitChanged = currentCommit !== index.commit;
  const originChanged = currentInfo.origin !== index.origin;
  return { source: slash(index.sourceRoot), commit: index.commit, currentCommit,
    pages: index.documents.length, sections: index.documents.filter(d => d.section).length,
    chunks: index.documents.reduce((sum, d) => sum + d.chunks.length, 0), tutorialVersion: index.tutorialVersion.value,
    workingTreeDirty: currentInfo.workingTreeDirty,
    fresh: !added.length && !modified.length && !missing.length && !commitChanged && !originChanged,
    added, modified, missing, commitChanged, originChanged };
}
function queryGroups(query) {
  const q = normalize(query);
  const tokens = [...q.matchAll(/[a-z_$][a-z0-9_.$]*/g)].map(m => m[0]);
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  for (const word of segmenter.segment(q)) if (/^\p{Script=Han}{2,}$/u.test(word.segment)) tokens.push(word.segment);
  const groups = [];
  for (const token of [...new Set(tokens)].filter(t => !stopWords.has(t))) {
    const group = aliasGroups.find(g => g.includes(token)) || [token];
    if (!groups.some(g => g.join('|') === group.join('|'))) groups.push(group);
  }
  for (const group of aliasGroups) {
    if (group.some(term => /^\p{Script=Han}+$/u.test(term) && q.includes(term))
        && !groups.some(g => g.join('|') === group.join('|'))) groups.push(group);
  }
  return groups.slice(0, 16);
}
function provenance(index, doc) {
  const evidence = index.tutorialVersion.evidence;
  return { sourceType: index.sourceType, tutorialVersion: index.tutorialVersion.value,
    tutorialVersionEvidence: evidence ? { ...evidence, file: slash(path.join(index.sourceRoot, evidence.file)) } : null,
    commit: index.commit, origin: index.origin, builtAt: index.builtAt,
    snapshotWorkingTreeDirty: index.workingTreeDirty, commitUrlMatchesSnapshot: !!index.commit && !index.workingTreeDirty,
    sourceSha256: doc.sha256,
    localApiVerification: 'not-performed',
    fixtures: doc.fixtures.map(file => ({ file: slash(path.join(index.sourceRoot, file)),
      sha256: index.sourceFiles.find(f => f.file === file)?.sha256, url: sourceUrl(index, file) })) };
}
function context(index, doc, chunk) {
  const file = slash(path.join(index.sourceRoot, doc.file));
  return { page: { id: doc.id, file, from: 1, to: doc.text.split(/\r?\n/).length },
    section: { file, from: chunk.sectionFrom, to: chunk.sectionTo },
    parent: { file, from: chunk.parentFrom, to: chunk.parentTo },
    references: doc.references };
}
function search(index, query, options) {
  const groups = options.exact ? [[normalize(query)]] : queryGroups(query);
  const exact = exactMatcher(query);
  const literalTerms = normalize(query).match(/\p{Script=Han}+|[a-z_$][a-z0-9_.$]*/gu) || [];
  if (!groups.length) throw new Error('请输入中文主题或 API／文件／类名，不要只输入标点或停用词');
  const bodies = index.documents.map(d => normalize(d.text));
  const weights = groups.map(group => Math.log(1 + bodies.length /
    (1 + bodies.filter(body => group.some(term => body.includes(term))).length)));
  const weight = group => weights[groups.indexOf(group)];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const hits = [];
  for (const doc of index.documents) {
    if (options.chapter && doc.chapter !== options.chapter) continue;
    const lines = doc.text.split(/\r?\n/);
    for (const chunk of doc.chunks) {
      const chunkLines = lines.slice(chunk.from - 1, chunk.to);
      const body = normalize(chunkLines.join('\n')), title = normalize(doc.title);
      const headings = normalize(chunk.headingPath.join('\n'));
      const exactHit = exact.test(body);
      if (options.exact && !exactHit) continue;
      const matched = groups.filter(group => group.some(term => body.includes(term)));
      if (!matched.length || (options.all && matched.length !== groups.length)) continue;
      const frequencyBonus = matched.reduce((sum, group) => {
        const count = Math.max(...group.map(term => body.split(term).length - 1));
        return sum + Math.log2(1 + Math.min(10, count)) * 3 * weight(group);
      }, 0);
      const score = matched.reduce((sum, group) => sum + weight(group), 0) / totalWeight * 60 + matched.length * 2
        + groups.filter(g => g.some(t => title.includes(t))).reduce((sum, group) => sum + weight(group) * 40, 0)
        + groups.filter(g => g.some(t => headings.includes(t))).reduce((sum, group) => sum + weight(group) * 12, 0)
        + (exactHit ? 80 : 0) + frequencyBonus + (doc.section ? 15 : 0);
      let best = 0, bestValue = -1;
      chunkLines.forEach((line, i) => {
        const low = normalize(line);
        const value = matched.filter(g => g.some(t => low.includes(t))).reduce((sum, group) => sum + weight(group) * 10, 0)
          + literalTerms.filter(t => low.includes(t)).length * 3 + (exact.test(low) ? 80 : 0) + (/^#{1,6}\s/.test(line) ? 1 : 0);
        if (value > bestValue) { bestValue = value; best = i; }
      });
      const line = chunk.from + best, excerptFrom = Math.max(0, best - 1);
      hits.push({ id: doc.id, chunkId: chunk.id, title: doc.title, score: Number(score.toFixed(2)),
        exactMatch: exactHit, matched: matched.length, terms: groups.length,
        file: slash(path.join(index.sourceRoot, doc.file)), line, from: chunk.from, to: chunk.to,
        heading: chunk.headingPath.at(-1) || doc.title, headingPath: chunk.headingPath,
        excerpt: chunkLines.slice(excerptFrom, best + 3).map((s, n) => ({
          line: chunk.from + excerptFrom + n, text: s.length > 360 ? s.slice(0, 360) + '…' : s,
        })), excerptIsPreview: true, codeBlocks: chunk.codeBlocks,
        url: doc.url ? doc.url + '#L' + chunk.from + '-L' + chunk.to : null, references: doc.references,
        context: context(index, doc, chunk), provenance: provenance(index, doc),
        fixtures: doc.fixtures.map(f => slash(path.join(index.sourceRoot, f))) });
    }
  }
  hits.sort((a, b) => Number(b.exactMatch) - Number(a.exactMatch) || b.score - a.score
    || a.id.localeCompare(b.id, 'en', { numeric: true }) || a.from - b.from);
  // Avoid one long page monopolizing the first results; its other chunks remain searchable.
  const perPage = new Map();
  const selected = hits.filter(hit => {
    const count = (perPage.get(hit.id) || 0) + 1;
    perPage.set(hit.id, count);
    return count <= (options.chapter || options.exact ? options.limit : 2);
  }).slice(0, options.limit);
  return { query, mode: options.exact ? 'exact' : 'keyword-alias', expandedTerms: groups,
    total: new Set(hits.map(hit => hit.id)).size, totalChunks: hits.length, results: selected };
}
function parse(args) {
  const options = { limit: 5, from: 1, lines: 100 }, positional = [];
  const numbers = { '--limit': ['limit', 1, 30], '--chapter': ['chapter', 1, 20], '--from': ['from', 1, 100000], '--lines': ['lines', 1, 240] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--json', '--all', '--exact', '--context'].includes(arg)) options[arg.slice(2)] = true;
    else if (numbers[arg]) {
      const [name, min, max] = numbers[arg], value = args[++i];
      if (!/^\d+$/.test(value || '') || +value < min || +value > max) throw new Error(arg + ' 超出允许范围');
      options[name] = +value;
    } else if (['--library', '--source', '--config'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(arg + ' 缺少路径');
      options[arg.slice(2)] = path.resolve(value);
    } else if (arg.startsWith('--')) throw new Error('未知参数：' + arg);
    else positional.push(arg);
  }
  return { options, positional };
}
function main() {
  const command = process.argv[2] || 'help';
  if (['help', '--help'].includes(command)) {
    console.log('离线教程资料库：search <关键词> [--exact] [--chapter N] [--limit 5] [--all] [--json]\nread C8-S7 [--from 1] [--lines 100] [--json]\nread C8-S7@L25 [--context] [--json]（完整片段／父级上下文，不截断代码块）\nstatus [--json]\nindex（仅在教程更新后重建；不联网、不拉取仓库）\n默认使用 Moci 工程 tools/knowledge/starsector；可用 --config 或 --library 指定本地位置。');
    return;
  }
  if (!['index', 'status', 'search', 'read'].includes(command)) throw new Error('未知命令：' + command);
  const { options, positional } = parse(process.argv.slice(3));
  const project = !options.library || options.config ? loadProject(options.config) : null;
  const library = options.library || path.join(project.projectRoot, 'tools', 'knowledge', 'starsector');
  let index;
  if (command === 'index') {
    const source = options.source || (project ? path.join(project.projectRoot, 'tools', 'external', 'StarsectorNihilismGuidance') : null);
    if (!source) throw new Error('自定义 --library 建索引时还需 --source');
    if (inside(source, library)) throw new Error('资料库输出必须放在下载仓库之外');
    index = build(source, library);
  } else index = load(library);
  const state = status(index);
  if (command === 'index' || command === 'status') {
    console.log(JSON.stringify(state, null, 2));
    if (!state.fresh) process.exitCode = 2;
    return;
  }
  if (!state.fresh) throw new Error('教程内容或提交已变化，索引过期。先运行 status 查看差异，再运行 index 重建；不使用旧行号。');
  if (command === 'search') {
    const query = positional.join(' ').trim();
    if (!query || query.length > 256) throw new Error('查询需为 1—256 个字符');
    const result = search(index, query, options);
    result.localEnvironment = project ? { declaredGameVersion: project.info.gameVersion,
      evidence: slash(path.join(project.mod, 'mod_info.json')), exactGameBuildVerified: false } : null;
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('离线教程 · ' + index.commit + ' · 教程声明版本 ' + (index.tutorialVersion.value || '未知')
        + ' · ' + result.total + ' 篇／' + result.totalChunks + ' 片段命中；分数仅用于排序；未核对本地 API');
      if (project) console.log('工作区 mod 声明游戏版本：' + project.info.gameVersion + '（未验证游戏精确构建）');
      if (index.tutorialVersion.evidence) console.log('版本声明证据：' + slash(path.join(index.sourceRoot, index.tutorialVersion.evidence.file)) + ':' + index.tutorialVersion.evidence.line);
      if (index.workingTreeDirty) console.log('本地快照有未提交改动；固定提交网页未确认与本地逐字一致，以本地原文和哈希为准。');
      if (!result.total) console.log('未找到匹配。换用 API 名、较短关键词，或用 rg 搜索教程原文与 fixtures。');
      for (const hit of result.results) {
        console.log('\n' + hit.chunkId + ' ' + hit.title + '（匹配 ' + hit.matched + '/' + hit.terms
          + (hit.exactMatch ? '，字面精确命中' : '') + '）\n' + hit.file + ':' + hit.line
          + '\n层级：' + hit.headingPath.join(' > ') + '\n完整片段：' + hit.from + '—' + hit.to + ' 行；以下仅为预览');
        for (const line of hit.excerpt) console.log(line.line + ': ' + line.text);
        console.log('来源：教程；原文 SHA256：' + hit.provenance.sourceSha256);
        if (hit.fixtures.length) console.log('示例目录：' + path.dirname(hit.fixtures[0]));
        if (hit.url) console.log('原文：' + hit.url);
        console.log('读取完整片段：read ' + hit.chunkId + '；父级上下文：read ' + hit.chunkId + ' --context');
      }
    }
  } else {
    const requested = (positional[0] || '').toUpperCase();
    const [id, chunkLine] = requested.split('@');
    const doc = index.documents.find(d => d.id === id);
    if (!doc) throw new Error('未找到页面 ID；使用 ROOT、C8 或 C8-S7 形式');
    const chunk = chunkLine ? doc.chunks.find(c => c.id.toUpperCase() === requested) : null;
    if ((requested.includes('@') && !chunk) || (options.context && !chunk)) throw new Error('请使用搜索返回的有效片段 ID；--context 需指定片段');
    if (chunk && (process.argv.includes('--from') || process.argv.includes('--lines'))) throw new Error('完整片段读取不能同时指定 --from／--lines；分页请使用页面 ID');
    if (chunk) options.from = options.context ? chunk.parentFrom : chunk.from;
    const lines = doc.text.split(/\r?\n/);
    const end = chunk ? (options.context ? chunk.parentTo : chunk.to) : Math.min(lines.length, options.from + options.lines - 1);
    if (options.from > lines.length) throw new Error('起始行超过页面总行数 ' + lines.length);
    const output = { id, chunkId: chunk?.id, title: doc.title, file: slash(path.join(index.sourceRoot, doc.file)),
      url: doc.url ? doc.url + '#L' + options.from + '-L' + end : null,
      totalLines: lines.length, from: options.from, to: end, references: doc.references,
      completeChunk: !!chunk, expandedContext: !!options.context,
      headingPath: chunk?.headingPath, context: chunk ? context(index, doc, chunk) : null,
      provenance: provenance(index, doc),
      localEnvironment: project ? { declaredGameVersion: project.info.gameVersion,
        evidence: slash(path.join(project.mod, 'mod_info.json')), exactGameBuildVerified: false } : null,
      fixtures: doc.fixtures.map(f => slash(path.join(index.sourceRoot, f))),
      lines: lines.slice(options.from - 1, end).map((text, i) => ({ line: options.from + i, text })) };
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else {
      console.log((chunk?.id || id) + ' ' + doc.title + '\n' + output.file + '\n第 ' + output.from + '—' + end + ' 行／共 ' + lines.length + ' 行'
        + '\n来源：教程；声明版本 ' + (index.tutorialVersion.value || '未知') + '；提交 ' + index.commit
        + '；未核对本地 API\n原文 SHA256：' + doc.sha256);
      if (index.workingTreeDirty) console.log('本地快照有未提交改动；固定提交网页未确认与本地逐字一致。');
      if (output.url) console.log('固定提交原文：' + output.url);
      for (const line of output.lines) console.log(line.line + ': ' + line.text);
      if (doc.references.length) console.log('前置／相关章节：' + doc.references.join(', '));
      if (output.fixtures.length) console.log('配套文件：\n' + output.fixtures.join('\n'));
    }
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
