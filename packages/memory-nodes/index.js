/**
 * dsh-memory-nodes — platform and project level long-term memory nodes.
 *
 * Design: D:\obj\DHSws\DSH记忆节点设计方案-v1.0-20261118.md
 *
 * Zero-import plugin: no @deepseek-ai/* module imports (profile plugins cannot
 * reliably bare-import host packages; see the loomy investigation). All DSH
 * seams are consumed through ctx at runtime:
 *   ctx.systemPrompt.context()  — inject both compiled nodes (design §5)
 *   ctx.tools.register()        — memory_write / memory_read (design §6)
 *   ctx.on('session/event')     — route capture + turn/end auto-compile (§7)
 *   ctx.llm.stream()            — the re-compilation engine (§7)
 *
 * Message objects are hand-built to the runtime shape proven in
 * dsh-llm/src/message.ts (frozen plain object, randomUUID id).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLATFORM, PROJECT, DEFAULT_LIMITS,
  appendRaw, readRawSince, readMeta, writeCompiled, recordCompileError,
  summarizeNode, maskSecrets, rememberWorkspaceSync, readCompiledSync, nodeDir, listWorkspaces,
} from './src/store.js';
import { buildCompilePrompt, validateCompiled, sanitizeCompiled, buildInjectText } from './src/compile.js';

export const name = 'memory-nodes';

/** Services required before apply runs; missing ones keep the plugin inactive. */
export const inject = ['tools', 'llm', 'systemPrompt', 'workingDirectory'];

/** Inject order for the two memory contexts: after all official contexts (max 210). */
const PLATFORM_ORDER = 300;
const PROJECT_ORDER = 305;

const COMPILE_SYSTEM = '你是长期记忆编译器。只输出符合要求的 Markdown 正文，不含解释、前言或代码围栏。';

const KINDS = ['observe', 'decision', 'preference', 'fact', 'pitfall'];

/** Normalize raw row config without a schemastery schema (zero-import constraint). */
function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const num = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || (max !== undefined && n > max)) return fallback;
    return n;
  };
  const str = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');
  const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  return {
    compileProvider: str(c.compileProvider),
    compileModel: str(c.compileModel),
    autoCompile: bool(c.autoCompile, true),
    autoCompileRawDelta: num(c.autoCompileRawDelta, 20, 1),
    autoCompileIntervalHours: num(c.autoCompileIntervalHours, 24, 0.1),
    compiledInjectBytes: num(c.compiledInjectBytes, 8192, 1024, 65536),
    rawMaxBytes: num(c.rawMaxBytes, DEFAULT_LIMITS.rawMaxBytes, 4096),
    rawMaxLines: num(c.rawMaxLines, DEFAULT_LIMITS.rawMaxLines, 10),
    compileMaxOutputTokens: num(c.compileMaxOutputTokens, 4096, 256, 32768),
    compileTimeoutMs: num(c.compileTimeoutMs, 180000, 5000),
  };
}

/** Hand-built frozen user message matching dsh-llm/src/message.ts runtime shape. */
function userMessage(text) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'dsh-memory-nodes' },
  });
}

/** Collect one ctx.llm.stream() run into text + terminal finish (design §7). */
async function runLlmText(ctx, options) {
  let text = '';
  let finish = null;
  for await (const chunk of ctx.llm.stream(options)) {
    options.signal?.throwIfAborted();
    if (chunk.type === 'text-delta') text += chunk.text;
    else if (chunk.type === 'finish') finish = chunk.reason;
  }
  if (finish === null) throw new Error('记忆编译流在 finish 前结束');
  if (finish.kind === 'error' || finish.kind === 'aborted') {
    const err = new Error(finish.failure?.message ?? '记忆编译流终止');
    err.code = finish.failure?.code;
    throw err;
  }
  if (finish.kind === 'max-tokens') throw new Error('记忆编译输出达到 maxTokens 上限，请提高 compileMaxOutputTokens');
  return text;
}

/** Node label used in prompts and errors. */
function nodeLabel(node, workspacePath) {
  if (node === PLATFORM) return '平台级（跨项目）';
  return `项目级（${workspacePath ? path.basename(workspacePath) : 'unknown'}）`;
}

export function createMemoryService(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  const compiling = new Set();       // single-flight keys (design §7)
  const controllers = new Set();     // in-flight compiles aborted on dispose
  const injectCache = new Map();     // node dir -> { sig, text }
  let timer = null;
  let pendingCwd = null;
  let lastRoute = null;              // { provider, model } captured from request/header

  /* ---------- workspace resolution ---------- */

  const cwdOfAgent = (agent) => {
    const cwd = agent?.session?.header?.cwd;
    return typeof cwd === 'string' && cwd ? cwd : null;
  };

  /* ---------- compiled read with mtime cache for the injection hot path ---------- */

  function readCompiledCached(node, workspacePath) {
    const dir = nodeDir(node, workspacePath);
    const file = path.join(dir, 'compiled.md');
    let stat = null;
    try { stat = fs.statSync(file); } catch { return null; }
    const sig = `${stat.size}|${stat.mtimeMs}`;
    const hit = injectCache.get(dir);
    if (hit && hit.sig === sig) return hit.text;
    const text = readCompiledSync(node, workspacePath);
    if (injectCache.size > 16) injectCache.clear();
    injectCache.set(dir, { sig, text });
    return text;
  }

  /* ---------- compile engine (design §7) ---------- */

  async function compileNode(node, workspacePath, { by = 'manual', signal } = {}) {
    const key = node === PROJECT ? `project:${workspacePath}` : 'platform';
    if (compiling.has(key)) throw new Error('该记忆节点编译正在进行中');
    compiling.add(key);
    const controller = new AbortController();
    controllers.add(controller);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    try {
      const meta = await readMeta(node, workspacePath);
      const since = meta?.compiledThrough ?? 0;
      const records = await readRawSince(node, workspacePath, since);
      if (records.length === 0) return { ok: false, skipped: '没有新的原始记录' };
      const route = config.compileProvider && config.compileModel
        ? { provider: config.compileProvider, model: config.compileModel }
        : lastRoute;
      if (!route) {
        throw new Error('未确定编译模型：请先进行一次正常会话请求，或在配置中设置 compileProvider 与 compileModel');
      }
      const priorCompiled = readCompiledSync(node, workspacePath);
      const prompt = buildCompilePrompt({
        nodeLabel: nodeLabel(node, workspacePath),
        priorCompiled,
        records,
        budgetBytes: config.compiledInjectBytes,
      });
      const options = {
        provider: route.provider,
        model: route.model,
        messages: [userMessage(prompt)],
        system: COMPILE_SYSTEM,
        maxTokens: config.compileMaxOutputTokens,
        purpose: 'memory-compile',
        signal: controller.signal,
      };
      const text = await runLlmText(ctx, options);
      const markdown = sanitizeCompiled(text);
      const verdict = validateCompiled(markdown);
      if (!verdict.ok) throw new Error(`编译输出结构不合格：${verdict.reason}`);
      const newMeta = await writeCompiled(node, workspacePath, markdown, {
        updatedBy: by,
        model: `${route.provider}/${route.model}`,
        compiledThrough: records[records.length - 1].seq,
        rawCount: records[records.length - 1].seq,
      }, { ...DEFAULT_LIMITS, rawMaxBytes: config.rawMaxBytes, rawMaxLines: config.rawMaxLines });
      return { ok: true, meta: newMeta };
    } catch (error) {
      if (controller.signal.aborted) throw error;
      await recordCompileError(node, workspacePath, error?.message ?? String(error)).catch(() => {});
      throw error;
    } finally {
      controllers.delete(controller);
      compiling.delete(key);
    }
  }

  /* ---------- auto compile evaluation (design §7 trigger 2) ---------- */

  async function evaluateAuto() {
    const cwd = pendingCwd;
    const checks = [[PLATFORM, null]];
    if (cwd) checks.push([PROJECT, cwd]);
    for (const [node, ws] of checks) {
      try {
        const meta = await readMeta(node, ws);
        const since = meta?.compiledThrough ?? 0;
        const records = await readRawSince(node, ws, since);
        if (records.length === 0) continue;
        const idleMs = meta?.updatedAt ? Date.now() - Date.parse(meta.updatedAt) : Number.POSITIVE_INFINITY;
        const due = records.length >= config.autoCompileRawDelta
          || idleMs >= config.autoCompileIntervalHours * 3_600_000;
        if (due) await compileNode(node, ws, { by: 'auto' });
      } catch { /* failures are recorded in meta; auto path never throws */ }
    }
  }

  function scheduleAuto(delayMs = 5000) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void evaluateAuto();
    }, delayMs);
    timer.unref?.();
  }

  /* ---------- registration ---------- */

  /* ---------- settings page data plane (design §8, loomy-settings channel) ---------- */

  const RPC_PATH = '/api/dsh-memory-nodes/rpc';
  const RPC_ENDPOINT = 'dsh-memory-nodes/rpc';

  async function nodes() {
    const list = [{ node: 'platform', workspacePath: null, ...(await summarizeNode(PLATFORM, null)) }];
    for (const ws of await listWorkspaces()) {
      list.push({ node: 'project', workspaceId: ws.id, workspacePath: ws.path, ...(await summarizeNode(PROJECT, ws.path)) });
    }
    return list;
  }

  function registerRpcRoute() {
    ctx.inject(['connection'], (scope) => {
      scope.effect(() => scope.connection.fetch.register({
        path: RPC_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let message;
          try { message = await request.json(); } catch {
            return new Response('body is not JSON', { status: 400 });
          }
          const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request';
          const reply = result => Response.json({ type: 'server-response', rpcId, result });
          if (message?.type !== 'client-request' || message.method !== RPC_ENDPOINT) {
            return reply({ ok: false, error: { code: 'gateway/bad-request', message: `expected ${RPC_ENDPOINT}`, details: {} } });
          }
          const action = message.payload?.action;
          try {
            if (action === 'nodes') return reply({ ok: true, value: { nodes: await nodes() } });
            if (action === 'compile') {
              const { node, workspacePath } = message.payload ?? {};
              if (node !== PLATFORM && node !== PROJECT) {
                return reply({ ok: false, error: { code: 'memory-nodes/bad-node', message: `unknown node: ${node}`, details: {} } });
              }
              const result = await compileNode(node, node === PROJECT ? workspacePath : null, { by: 'manual' });
              return reply({ ok: true, value: result });
            }
            return reply({ ok: false, error: { code: 'memory-nodes/bad-action', message: `unknown action: ${action}`, details: {} } });
          } catch (error) {
            return reply({ ok: false, error: { code: 'memory-nodes/failed', message: String(error?.message ?? error), details: {} } });
          }
        },
      }), 'dsh-memory-nodes: rpc route');
    });
  }

  function register() {
    // Route capture + turn/end debounce (practices: wait on durable events).
    ctx.on('session/event', (session, event) => {
      if (event?.type === 'request/header') {
        const c = event.data?.header?.config;
        if (c?.provider && c?.model) lastRoute = { provider: c.provider, model: c.model };
        return;
      }
      if (event?.type !== 'turn/end' || !config.autoCompile) return;
      const cwd = typeof session?.header?.cwd === 'string' && session.header.cwd ? session.header.cwd : pendingCwd;
      if (cwd) pendingCwd = cwd;
      scheduleAuto();
    });

    // Injected contexts (design §5). Empty text contributes nothing (PromptContext contract).
    ctx.systemPrompt.context({
      name: 'memory:platform',
      order: PLATFORM_ORDER,
      interpolate: false,
      text: () => {
        const compiled = readCompiledCached(PLATFORM, null);
        return compiled ? buildInjectText(compiled, config.compiledInjectBytes) : '';
      },
    });
    ctx.systemPrompt.context({
      name: 'memory:project',
      order: PROJECT_ORDER,
      interpolate: false,
      text: (context) => {
        const cwd = cwdOfAgent(context?.agent);
        if (!cwd) return '';
        rememberWorkspaceSync(cwd);
        const compiled = readCompiledCached(PROJECT, cwd);
        return compiled ? buildInjectText(compiled, config.compiledInjectBytes) : '';
      },
    });

    // Model tools (design §6).
    ctx.tools.register({
      name: 'memory_write',
      description: '向长期记忆沉淀一条原始记录。写入后由后台编译器定期将原始记录二次编译为结构化记忆；不要写入凭据、密钥或一次性过程细节。',
      parameters: {
        node: {
          type: 'string', required: true, enum: ['platform', 'project'],
          description: 'platform=跨项目通用事实（用户偏好、通用约定）；project=仅与当前项目相关的事实。拿不准时选 project。',
        },
        kind: {
          type: 'string', required: true, enum: KINDS,
          description: 'observe=过程观察；decision=已做决定；preference=用户偏好；fact=稳定事实；pitfall=踩坑教训。',
        },
        text: {
          type: 'string', required: true,
          description: '一条自包含的记忆文本，不超过 2000 字符；写清主语与结论，凭据样式字符串会被自动脱敏。',
        },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            node: { type: 'string' },
            seq: { type: 'number' },
            uncompiled: { type: 'number' },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `已记录到${value.node === 'platform' ? '平台级' : '项目级'}记忆 #${value.seq}（待编译 ${value.uncompiled} 条）。`,
        }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const cwd = args.node === 'project' ? cwdOfAgent(exec?.agent) : null;
        if (args.node === 'project' && !cwd) throw new Error('项目级记忆需要当前会话具有工作目录');
        const record = await appendRaw(args.node, cwd, {
          kind: args.kind,
          text: maskSecrets(args.text),
          sessionId: exec?.agent?.session?.id,
        });
        const meta = await readMeta(args.node, cwd);
        const uncompiled = record.seq - (meta?.compiledThrough ?? 0);
        if (config.autoCompile) scheduleAuto();
        return { node: args.node, seq: record.seq, uncompiled };
      },
    });

    ctx.tools.register({
      name: 'memory_read',
      description: '读取长期记忆节点当前内容：编译层全文与最近的原始记录。用于回忆之前沉淀的事实或核对记忆现状。',
      parameters: {
        node: {
          type: 'string', required: true, enum: ['platform', 'project'],
          description: 'platform=平台级节点；project=当前项目的节点。',
        },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: false,
          properties: {
            node: { type: 'string' },
            compiled: { type: 'string' },
            recent: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (args, value) => [{
          type: 'text',
          text: `【${args.node === 'platform' ? '平台级' : '项目级'}记忆 · 编译层】\n${value.compiled || '（暂无编译内容）'}\n【最近原始记录 ${value.recent.length} 条】\n${value.recent.join('\n') || '（无）'}`,
        }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const cwd = args.node === 'project' ? cwdOfAgent(exec?.agent) : null;
        if (args.node === 'project' && !cwd) throw new Error('项目级记忆需要当前会话具有工作目录');
        const compiled = readCompiledSync(args.node, cwd) ?? '';
        const all = await readRawSince(args.node, cwd, 0);
        const recent = all.slice(-20).map(r => `${r.seq}. [${r.kind}] ${r.text}`);
        return { node: args.node, compiled: compiled.slice(0, 16384), recent };
      },
    });

    // Settings-page channel (loomy-settings-proven connection.rpc pattern).
    registerRpcRoute();
  }

  function dispose() {
    if (timer) { clearTimeout(timer); timer = null; }
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  return {
    register,
    dispose,
    compileNode,
    evaluateAuto,
    config,
    nodes,
    summarize: (node, workspacePath) => summarizeNode(node, workspacePath),
  };
}

export function apply(ctx, config) {
  const service = createMemoryService(ctx, config);
  service.register();
  return () => service.dispose();
}
