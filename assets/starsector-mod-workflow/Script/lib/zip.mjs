/**
 * 最小 ZIP 读取器：只做“列出条目 + 取单个条目字节”，不写文件、不依赖第三方库。
 * 支持 stored(0) 与 deflate(8)，够读 starfarer.api.zip。
 */
import zlib from 'node:zlib';

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

/** 从文件尾往前找 EOCD，返回中央目录的条目数、偏移。 */
function findCentralDirectory(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) !== EOCD) continue;
    const count = buf.readUInt16LE(i + 10);
    const offset = buf.readUInt32LE(i + 16);
    if (offset > 0 && offset < buf.length) return { count, offset };
  }
  throw new Error('不是有效 ZIP：找不到 EOCD');
}

/** 解析中央目录，返回 [{ name, method, compressedSize, size, localOffset }]。 */
export function listEntries(buf) {
  const { count, offset } = findCentralDirectory(buf);
  const out = [];
  let p = offset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error(`中央目录第 ${i} 条签名不符`);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nameLen);
    const name = rawName.toString(flags & 0x800 ? 'utf8' : 'latin1');
    out.push({ name, method, compressedSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** 取一个条目的原始字节。 */
export function readEntry(buf, entry) {
  if (buf.readUInt32LE(entry.localOffset) !== LOC) throw new Error(`本地头签名不符：${entry.name}`);
  const nameLen = buf.readUInt16LE(entry.localOffset + 26);
  const extraLen = buf.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`不支持的压缩方式 ${entry.method}：${entry.name}`);
}

/** 取文本（Java 源码默认 UTF-8）。 */
export function readText(buf, entry) {
  return readEntry(buf, entry).toString('utf8');
}
