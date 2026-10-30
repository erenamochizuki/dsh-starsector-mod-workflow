// Structural Markdown slices. A fenced code block is always an indivisible unit.
export function markdownStructure(text) {
  const lines = text.split(/\r?\n/), headings = [], fences = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const mark = lines[i].match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (open) {
      if (mark && mark[1][0] === open.marker[0] && mark[1].length >= open.marker.length && !mark[2].trim()) {
        fences.push({ from: open.from, to: i + 1, closed: true });
        open = null;
      }
      continue;
    }
    if (mark && !(mark[1][0] === '`' && mark[2].includes('`'))) {
      open = { marker: mark[1], from: i + 1 };
      continue;
    }
    const heading = lines[i].match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) headings.push({ level: heading[1].length, title: heading[2], line: i + 1 });
  }
  if (open) fences.push({ from: open.from, to: lines.length, closed: false });
  return { lines, headings, fences };
}

export function chunkMarkdown(text, pageId, targetCharacters = 3200) {
  const { lines, headings, fences } = markdownStructure(text);
  const starts = [...new Set([1, ...headings.map(h => h.line)])];
  const chunks = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s], to = (starts[s + 1] || lines.length + 1) - 1;
    const stack = [];
    for (const heading of headings.filter(h => h.line <= from)) {
      while (stack.length && stack.at(-1).level >= heading.level) stack.pop();
      stack.push(heading);
    }
    const current = stack.at(-1);
    const parent = stack.length > 1 ? stack.at(-2) : current;
    const parentFrom = parent?.line || 1;
    const parentTo = parent ? (headings.find(h => h.line > parent.line && h.level <= parent.level)?.line || lines.length + 1) - 1 : lines.length;
    // Paragraphs, tables/lists and whole code fences stay together. Large units may exceed the soft target.
    const units = [];
    let cursor = from;
    while (cursor <= to) {
      const first = cursor;
      const code = fences.find(f => f.from === cursor);
      if (code) cursor = code.to + 1;
      else if (!lines[cursor - 1].trim()) {
        while (cursor <= to && !lines[cursor - 1].trim()) cursor++;
      } else {
        cursor++;
        while (cursor <= to && lines[cursor - 1].trim() && !fences.some(f => f.from === cursor)) cursor++;
      }
      units.push({ from: first, to: cursor - 1, characters: lines.slice(first - 1, cursor - 1).join('\n').length + 1 });
    }
    let pending = [], size = 0;
    const emit = () => {
      if (!pending.length) return;
      const startLine = pending[0].from, endLine = pending.at(-1).to;
      if (lines.slice(startLine - 1, endLine).some(line => line.trim())) {
        chunks.push({ id: pageId + '@L' + startLine, from: startLine, to: endLine,
          headingPath: stack.map(h => h.title), sectionFrom: from, sectionTo: to,
          parentFrom, parentTo, codeBlocks: fences.filter(f => f.from >= startLine && f.to <= endLine) });
      }
      pending = []; size = 0;
    };
    for (const unit of units) {
      if (pending.length && size + unit.characters > targetCharacters && size >= targetCharacters / 2) emit();
      pending.push(unit); size += unit.characters;
    }
    emit();
  }
  return chunks;
}

// Identifiers have boundaries: searching getShip does not match getShipAI.
// Punctuation remains literal, so rules.csv, $memory and qualified API names are supported.
export function exactMatcher(query) {
  const normalized = query.normalize('NFKC').toLowerCase();
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp((/^[a-z0-9_$]/.test(normalized) ? '(?<![a-z0-9_$])' : '') + escaped
    + (/[a-z0-9_$]$/.test(normalized) ? '(?![a-z0-9_$])' : ''), 'u');
}
