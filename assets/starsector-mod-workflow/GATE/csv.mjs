/**
 * CSV 解析（RFC4180 子集）：引号内逗号、引号内换行、"" 转义；
 * 另做 BOM 剥离、CRLF 归一、`#` 注释行与空行跳过、未闭合引号报错（带起始行号）。
 * 所有读取 CSV 的地方共用这一份，避免 engine 与 lint 行为不一致。
 */

/** 返回 { rows, lines, errors }；rows 已剔除注释/空行，lines[i] 是 rows[i] 的起始行号。 */
export function parseCsvDetailed(text) {
  const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  const lines = [];
  const errors = [];
  let row = [];
  let field = '';
  let inQ = false;
  let quoteLine = 0;
  let line = 1;
  let rowLine = 1;

  const pushRow = () => {
    row.push(field);
    const first = (row[0] || '').trim();
    const blank = row.every((v) => v.trim() === '');
    if (!blank && !first.startsWith('#')) {
      rows.push(row);
      lines.push(rowLine);
    }
    row = [];
    field = '';
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
      quoteLine = line;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      pushRow();
      line++;
      rowLine = line;
    } else {
      field += c;
    }
  }
  if (inQ) errors.push({ line: quoteLine, msg: '引号未闭合：从这里开始到文件结尾都在引号内' });
  if (field.length || row.length) pushRow();
  return { rows, lines, errors };
}

/** 兼容旧调用：只要行数组。 */
export function parseCsv(text) {
  return parseCsvDetailed(text).rows;
}

/** 表：header 取第一条非注释行；rows 是对象数组，lines 与之一一对应。 */
export function csvTable(text) {
  const d = parseCsvDetailed(text);
  if (!d.rows.length) return null;
  const header = d.rows[0].map((h) => h.trim());
  const dataRows = d.rows.slice(1);
  const dataLines = d.lines.slice(1);
  return {
    header,
    raw: dataRows,
    rows: dataRows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))),
    lines: dataLines,
    lineOf: (i) => dataLines[i] ?? 1,
    errors: d.errors,
  };
}
