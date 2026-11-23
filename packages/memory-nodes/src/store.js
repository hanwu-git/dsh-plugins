/**
 * dsh-memory-nodes — durable store for the platform and project memory nodes.
 *
 * Layout (design v1.0 §4): everything lives under ~/.dsh/memory/ (honouring $DSH_HOME):
 *   memory/index.json                       workspace path -> workspaceId map
 *   memory/platform/{raw.jsonl,compiled.md,meta.json,history/}
 *   memory/projects/<workspaceId>/{raw.jsonl,compiled.md,meta.json,history/}
 *
 * raw.jsonl lines: { seq, ts, sessionId?, kind, text }  (append-only, rolling trim)
 * meta.json:       { updatedAt, updatedBy, model, compiledThrough, rawCount, lastError? }
 *
 * Pure Node module — no DSH imports — so the offline driver can exercise it directly.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_LIMITS = Object.freeze({
  compiledInjectBytes: 8192,   // design §4.4: per-node injection budget
  rawMaxBytes: 524288,         // 512 KB rolling trim threshold
  rawMaxLines: 2000,
  historyKeep: 3,
});

/** Resolve the memory root from $DSH_HOME (official override) or ~/.dsh. */
export function memoryRoot() {
  const home = process.env.DSH_HOME && process.env.DSH_HOME.trim()
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh');
  return path.join(home, 'memory');
}

export const PLATFORM = 'platform';
export const PROJECT = 'project';

/** FNV-1a 32-bit, hex. Stable across runs; not cryptographic. */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic workspace id: readable slug + 12-hex digest of the absolute path. */
export function workspaceIdFor(workspacePath) {
  const abs = path.resolve(workspacePath);
  const slug = path.basename(abs).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'ws';
  const short = (fnv1a(abs.toLowerCase()) + fnv1a(abs)).slice(0, 12);
  return `${slug}-${short}`;
}

/* ---------- index.json: workspace path -> id ---------- */

function indexPath() { return path.join(memoryRoot(), 'index.json'); }

export async function rememberWorkspace(workspacePath) {
  const abs = path.resolve(workspacePath);
  const key = process.platform === 'win32' ? abs.toLowerCase() : abs;
  const id = workspaceIdFor(abs);
  let index = { version: 1, workspaces: [] };
  try { index = JSON.parse(await fsp.readFile(indexPath(), 'utf8')); } catch { /* first run */ }
  const known = index.workspaces.find(w => w.pathKey === key);
  if (known) {
    if (known.id !== id) { known.id = id; await atomicWriteJson(indexPath(), index); }
    return id;
  }
  index.workspaces.push({ pathKey: key, path: abs, id, createdAt: new Date().toISOString() });
  await fsp.mkdir(path.dirname(indexPath()), { recursive: true });
  await atomicWriteJson(indexPath(), index);
  return id;
}

/** Reverse lookup: which workspace path owns this id (for UI display). */
export async function workspacePathFor(id) {
  try {
    const index = JSON.parse(await fsp.readFile(indexPath(), 'utf8'));
    return index.workspaces.find(w => w.id === id)?.path ?? null;
  } catch { return null; }
}

/** All known workspaces (id + path) for the settings page. */
export async function listWorkspaces() {
  try {
    const index = JSON.parse(await fsp.readFile(indexPath(), 'utf8'));
    return (index.workspaces ?? []).map(w => ({ id: w.id, path: w.path }));
  } catch { return []; }
}

/* ---------- node directories ---------- */

export function nodeDir(node, workspacePath) {
  const root = memoryRoot();
  if (node === PLATFORM) return path.join(root, 'platform');
  if (node === PROJECT) {
    if (!workspacePath) throw new Error('project memory node requires a workspace path');
    return path.join(root, 'projects', workspaceIdFor(workspacePath));
  }
  throw new Error(`unknown memory node: ${node}`);
}

async function ensureDir(dir) { await fsp.mkdir(dir, { recursive: true }); return dir; }

/* ---------- raw layer ---------- */

/** Append one raw record; returns the stored record with its assigned seq. Masks credentials at the single write choke point. */
export async function appendRaw(node, workspacePath, { kind, text, sessionId }) {
  if (!text || !String(text).trim()) throw new Error('memory_write: text must be non-empty');
  if (String(text).length > 2000) throw new Error('memory_write: text exceeds 2000 chars');
  const VALID = new Set(['observe', 'decision', 'preference', 'fact', 'pitfall']);
  if (!VALID.has(kind)) throw new Error(`memory_write: kind must be one of ${[...VALID].join('|')}`);
  const dir = await ensureDir(nodeDir(node, workspacePath));
  const rawPath = path.join(dir, 'raw.jsonl');
  const { lines, trimmed } = await readRawLines(rawPath);
  const seq = (lines.length > 0 ? lines[lines.length - 1].seq : 0) + 1;
  const record = { seq, ts: new Date().toISOString(), ...(sessionId ? { sessionId } : {}), kind, text: maskSecrets(String(text)) };
  await fsp.appendFile(rawPath, JSON.stringify(record) + '\n', 'utf8');
  if (trimmed) await trimRaw(node, workspacePath);
  return record;
}

async function readRawLines(rawPath) {
  let text = '';
  try { text = await fsp.readFile(rawPath, 'utf8'); } catch { return { lines: [], trimmed: false }; }
  const lines = [];
  let bad = 0;
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { lines.push(JSON.parse(s)); } catch { bad++; }
  }
  return { lines, trimmed: bad > 0 };
}

/** Rolling trim: drop oldest below the compiled watermark, honour byte/line caps (design §4.3). */
export async function trimRaw(node, workspacePath, limits = DEFAULT_LIMITS) {
  const dir = nodeDir(node, workspacePath);
  const rawPath = path.join(dir, 'raw.jsonl');
  const meta = await readMeta(node, workspacePath);
  const { lines } = await readRawLines(rawPath);
  const watermark = meta?.compiledThrough ?? 0;
  let keep = lines.filter(r => r.seq > watermark);
  let bytes = keep.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r), 'utf8') + 1, 0);
  while (keep.length > limits.rawMaxLines || bytes > limits.rawMaxBytes) {
    bytes -= Buffer.byteLength(JSON.stringify(keep[0]), 'utf8') + 1;
    keep = keep.slice(1);
  }
  const body = keep.map(r => JSON.stringify(r)).join('\n') + (keep.length ? '\n' : '');
  await atomicReplace(rawPath, body);
  return keep.length;
}

export async function readRawSince(node, workspacePath, sinceSeq) {
  const { lines } = await readRawLines(path.join(nodeDir(node, workspacePath), 'raw.jsonl'));
  return lines.filter(r => r.seq > (sinceSeq ?? 0));
}

/* ---------- compiled layer + meta ---------- */

const META_FILE = 'meta.json';

export async function readMeta(node, workspacePath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(nodeDir(node, workspacePath), META_FILE), 'utf8'));
  } catch { return null; }
}

async function atomicReplace(file, body) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, body, 'utf8');
  try { await fsp.unlink(file); } catch { /* not present yet */ }
  await fsp.rename(tmp, file);
}

async function atomicWriteJson(file, value) { await atomicReplace(file, JSON.stringify(value, null, 2) + '\n'); }

/**
 * Persist a freshly compiled memory text: rotate the previous compiled.md into
 * history/, write the new one atomically, and update meta. Single-flight locking
 * is the caller's (plugin service) responsibility.
 */
export async function writeCompiled(node, workspacePath, markdown, metaPatch, limits = DEFAULT_LIMITS) {
  const dir = await ensureDir(nodeDir(node, workspacePath));
  const compiledPath = path.join(dir, 'compiled.md');
  const historyDir = path.join(dir, 'history');
  // rotate current compiled into history
  let previous = null;
  try { previous = await fsp.readFile(compiledPath, 'utf8'); } catch { /* first compile */ }
  if (previous !== null && previous.trim()) {
    await fsp.mkdir(historyDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.writeFile(path.join(historyDir, `compiled-${stamp}.md`), previous, 'utf8');
    const hist = (await fsp.readdir(historyDir)).filter(f => f.endsWith('.md')).sort();
    while (hist.length > limits.historyKeep) await fsp.unlink(path.join(historyDir, hist.shift()));
  }
  await atomicReplace(compiledPath, markdown.endsWith('\n') ? markdown : markdown + '\n');
  const prior = (await readMeta(node, workspacePath)) ?? {};
  const meta = {
    updatedAt: new Date().toISOString(),
    updatedBy: 'manual',
    model: null,
    compiledThrough: prior.compiledThrough ?? 0,
    rawCount: prior.rawCount ?? 0,
    ...metaPatch,
  };
  delete meta.lastError;
  await atomicWriteJson(path.join(dir, META_FILE), meta);
  return meta;
}

/** Record a failed compile without touching the compiled layer (design §7). */
export async function recordCompileError(node, workspacePath, message) {
  const dir = nodeDir(node, workspacePath);
  const prior = (await readMeta(node, workspacePath)) ?? {};
  await atomicWriteJson(path.join(dir, META_FILE), { ...prior, lastError: String(message) });
}

/** Full node summary for the UI (design §8): preview, sizes, meta. */
export async function summarizeNode(node, workspacePath) {
  const dir = nodeDir(node, workspacePath);
  let compiled = null;
  try { compiled = await fsp.readFile(path.join(dir, 'compiled.md'), 'utf8'); } catch { /* none yet */ }
  const { lines, trimmed: badRawLines } = await readRawLines(path.join(dir, 'raw.jsonl'));
  const meta = await readMeta(node, workspacePath);
  return {
    node,
    workspacePath: node === PROJECT && workspacePath ? path.resolve(workspacePath) : null,
    compiledBytes: compiled === null ? 0 : Buffer.byteLength(compiled, 'utf8'),
    compiledPreview: compiled === null ? null : compiled.split('\n').slice(0, 40).join('\n'),
    rawCount: lines.length,
    uncompiledCount: lines.filter(r => r.seq > (meta?.compiledThrough ?? 0)).length,
    badRawLines,
    meta,
  };
}

/* ---------- secret hygiene (design §9.2) ---------- */

const SECRET_PATTERNS = [
  [/sk-[A-Za-z0-9_-]{16,}/g, '[REDACTED]'],
  [/ghp_[A-Za-z0-9]{20,}/g, '[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{20,}/g, '[REDACTED]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED]'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED]'],
  [/Bearer\s+[A-Za-z0-9._-]{16,}/gi, 'Bearer [REDACTED]'],
  [/(api[-_]?key|token|secret|password|口令|密码|密钥)["'\s:=]+[A-Za-z0-9._-]{12,}/gi, '$1=[REDACTED]'],
];

/** Mask credential-looking strings before they enter raw or compiled layers. */
export function maskSecrets(text) {
  let out = String(text);
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement);
  return out;
}

/* ---------- synchronous variants for the injection hot path ---------- */

function writeJsonSync(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  try { fs.unlinkSync(file); } catch { /* absent */ }
  fs.renameSync(tmp, file);
}

/** Sync workspace remember; the systemPrompt.context() text provider cannot await. */
export function rememberWorkspaceSync(workspacePath) {
  const abs = path.resolve(workspacePath);
  const key = process.platform === 'win32' ? abs.toLowerCase() : abs;
  const id = workspaceIdFor(abs);
  const file = indexPath();
  let index = { version: 1, workspaces: [] };
  try { index = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first run */ }
  const known = index.workspaces.find(w => w.pathKey === key);
  if (known) {
    if (known.id !== id) { known.id = id; writeJsonSync(file, index); }
    return id;
  }
  index.workspaces.push({ pathKey: key, path: abs, id, createdAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonSync(file, index);
  return id;
}

/** Sync compiled read for the injection hot path; null when absent. */
export function readCompiledSync(node, workspacePath) {
  try {
    return fs.readFileSync(path.join(nodeDir(node, workspacePath), 'compiled.md'), 'utf8');
  } catch { return null; }
}

/* ---------- atomic helpers shared with the entry module ---------- */
export { atomicReplace, atomicWriteJson };
