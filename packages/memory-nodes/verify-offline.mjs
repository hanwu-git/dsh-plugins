// dsh-memory-nodes offline regression driver (M2+M3, verified 2026-11-18, 55+ checks).
// Re-run after changes, from any directory, with Electron node:
//   $env:ELECTRON_RUN_AS_NODE='1'; & "<DSH executable>" verify-offline.mjs
// Uses an isolated temp DSH_HOME; never touches the real ~/.dsh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + detail : ''));
}
function eq(name, actual, expected) {
  check(name, Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected),
    'actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));
}

// ---------- isolated home ----------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-verify-'));
process.env.DSH_HOME = scratch;
console.log('DSH_HOME=' + scratch);

const PLUGIN = 'file:///D:/obj/DHSws/dsh-memory-nodes/index.js';
const plugin = await import(PLUGIN);
const store = await import('file:///D:/obj/DHSws/dsh-memory-nodes/src/store.js');
const compile = await import('file:///D:/obj/DHSws/dsh-memory-nodes/src/compile.js');
const { createMemoryService } = plugin;
const WORKSPACE = path.join(scratch, 'ws-demo'); // fake workspace path

// ---------- fake ctx ----------
function makeFakeCtx(llmImpl) {
  const captured = { listeners: [], contexts: [], tools: [], llmCalls: [], routes: [] };
  const ctx = {
    on(event, fn) { captured.listeners.push({ event, fn }); },
    inject(_deps, fn) {
      fn({
        effect: (fn2) => { fn2(); },
        connection: { fetch: { register: def => captured.routes.push(def) } },
      });
    },
    systemPrompt: { context: def => captured.contexts.push(def) },
    tools: { register: def => captured.tools.push(def) },
    llm: {
      async *stream(options) {
        captured.llmCalls.push(options);
        for (const piece of llmImpl(options)) yield piece;
      },
    },
  };
  return { ctx, captured };
}

const FIVE = (body = '内容条目一。') => ['概览', '关键事实', '偏好与约定', '进行中事项', '历史坑']
  .map(s => `## ${s}\n${body}`).join('\n');

const textChunks = (text) => [
  { type: 'block-start', index: 0 },
  { type: 'text-delta', text },
  { type: 'block-end', index: 0 },
  { type: 'finish', reason: { kind: 'stop' } },
];

// ---------- 1. store layer ----------
{
  const id1 = store.workspaceIdFor(WORKSPACE);
  const id2 = store.workspaceIdFor(WORKSPACE);
  eq('S1 workspace id deterministic', id1, id2);
  check('S1b id shape slug-12hex', /^[a-z0-9\u4e00-\u9fa5-]+-[0-9a-f]{12}$/.test(id1), id1);
  check('S1c different paths differ', store.workspaceIdFor(WORKSPACE + 'x') !== id1);
  check('S2 memoryRoot under scratch', store.memoryRoot().startsWith(scratch), store.memoryRoot());
  const rec = await store.appendRaw(store.PLATFORM, null, { kind: 'fact', text: 'API key is sk-abcdefghijklmnop123456 and daily deploy at 8pm' });
  check('S3 append assigns seq 1', rec.seq === 1);
  check('S3b secret masked on write', rec.text.includes('[REDACTED]') && !rec.text.includes('sk-abcdefghijklmnop'), rec.text);
  let threw = null;
  try { await store.appendRaw(store.PLATFORM, null, { kind: 'bogus', text: 'x' }); } catch (e) { threw = e; }
  check('S4 invalid kind rejected', threw !== null && /kind must be/.test(threw.message));
  threw = null;
  try { await store.appendRaw(store.PLATFORM, null, { kind: 'fact', text: 'x'.repeat(2001) }); } catch (e) { threw = e; }
  check('S5 oversized text rejected', threw !== null && /2000/.test(threw.message));
  const meta0 = await store.readMeta(store.PLATFORM, null);
  eq('S6 meta null before compile', meta0, null);
}

// ---------- 2. compile text builders ----------
{
  const prompt = compile.buildCompilePrompt({ nodeLabel: '平台级', priorCompiled: null, records: [{ seq: 1, ts: '2026-11-18T08:00:00.000Z', kind: 'fact', text: '含 sk-abcdefghijklmnop123456 应脱敏' }], budgetBytes: 8192 });
  check('C1 prompt lists five sections', ['概览', '关键事实', '偏好与约定', '进行中事项', '历史坑'].every(s => prompt.includes('## ' + s)));
  check('C2 prompt masks raw secrets', !prompt.includes('sk-abcdefghijklmnop'));
  const verdictOk = compile.validateCompiled(FIVE());
  check('C3 valid five-section md passes', verdictOk.ok === true, verdictOk.reason);
  const verdictBad = compile.validateCompiled('## 概览\n只有一节');
  check('C4 missing sections rejected', verdictBad.ok === false && /缺少小节/.test(verdictBad.reason));
  const sanitized = compile.sanitizeCompiled(FIVE('token: abcdefghijklmnop123456'));
  check('C5 sanitize masks credential pairs', sanitized.includes('[REDACTED]'));
  const big = '字'.repeat(9000);
  const injected = compile.buildInjectText('## 概览\n' + big, 8192);
  check('C6 inject budget respected', Buffer.byteLength(injected, 'utf8') <= 8192, Buffer.byteLength(injected, 'utf8'));
  check('C7 truncation marker present', injected.includes('…[已截断]'));
  const empty = compile.buildInjectText(null, 8192);
  check('C8 empty compiled → placeholder text', empty.includes('暂无编译内容'));
}

// ---------- 3. service: registration shape ----------
let service, captured, llmOutput = [];
{
  const fake = makeFakeCtx(() => textChunks(llmOutput.shift() ?? ''));
  service = createMemoryService(fake.ctx, { autoCompile: false });
  captured = fake.captured;
  service.register();
  eq('R1 two contexts registered', captured.contexts.length, 2);
  eq('R1b context names', captured.contexts.map(c => c.name), ['memory:platform', 'memory:project']);
  check('R1c context orders 300/305', captured.contexts.map(c => c.order).join(',') === '300,305');
  check('R1d interpolate false', captured.contexts.every(c => c.interpolate === false));
  eq('R2 two tools registered', captured.tools.length, 2);
  eq('R2b tool names', captured.tools.map(t => t.name), ['memory_write', 'memory_read']);
  eq('R3 one session/event listener', captured.listeners.filter(l => l.event === 'session/event').length, 1);
}

// ---------- 3b. settings RPC route (design §8 channel) ----------
{
  eq('R4 one rpc route registered', captured.routes.length, 1);
  const route = captured.routes[0];
  check('R4b route path/method', route.path === '/api/dsh-memory-nodes/rpc' && route.methods.includes('POST'), route.path);
  const call = async (payload) => {
    const request = new Request('http://local/api/dsh-memory-nodes/rpc', {
      method: 'POST',
      body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'dsh-memory-nodes/rpc', payload }),
    });
    const response = await route.fetch(request);
    return (await response.json()).result;
  };
  const nodesResult = await call({ action: 'nodes' });
  check('R5 nodes action ok', nodesResult.ok === true && Array.isArray(nodesResult.value.nodes) && nodesResult.value.nodes.length >= 1, JSON.stringify(nodesResult.value?.nodes?.length));
  check('R5b platform node present with summary shape', nodesResult.value.nodes.some(n => n.node === 'platform' && typeof n.rawCount === 'number'));
  const badResult = await call({ action: 'bogus' });
  check('R6 unknown action rejected', badResult.ok === false && /unknown action/.test(badResult.error.message));
  const compileResult = await call({ action: 'compile', node: 'platform' });
  check('R7 compile without route errors cleanly', compileResult.ok === false && /未确定编译模型/.test(compileResult.error.message), compileResult.error?.message);
}

// ---------- 4. injection providers before compile ----------
{
  const platformCtx = captured.contexts.find(c => c.name === 'memory:platform');
  const projectCtx = captured.contexts.find(c => c.name === 'memory:project');
  eq('I1 platform inject empty before compile', platformCtx.text(), '');
  eq('I2 project inject empty without agent', projectCtx.text({ agent: undefined }), '');
  const out = projectCtx.text({ agent: { session: { header: { cwd: WORKSPACE } } } });
  eq('I3 project inject empty before compile', out, '');
  const remembered = await store.workspacePathFor(store.workspaceIdFor(WORKSPACE));
  check('I4 workspace remembered via provider', remembered === path.resolve(WORKSPACE), remembered);
}

// ---------- 5. tools: write/read ----------
{
  const write = captured.tools.find(t => t.name === 'memory_write');
  const read = captured.tools.find(t => t.name === 'memory_read');
  const execAgent = { agent: { session: { id: 'sess-1', header: { cwd: WORKSPACE } } } };
  const w1 = await write.execute({ node: 'platform', kind: 'preference', text: '用户偏好正式中文汇报' }, {});
  check('T1 platform write returns seq', w1.seq >= 2, JSON.stringify(w1));
  let threw = null;
  try { await write.execute({ node: 'project', kind: 'fact', text: '无 cwd 应拒绝' }, {}); } catch (e) { threw = e; }
  check('T2 project write without cwd rejected', threw !== null && /工作目录/.test(threw.message));
  const w2 = await write.execute({ node: 'project', kind: 'fact', text: '示例项目事实' }, execAgent);
  check('T3 project write with agent cwd ok', w2.node === 'project' && w2.seq >= 1, JSON.stringify(w2));
  const r = await read.execute({ node: 'platform' }, {});
  check('T4 read returns compiled empty + recent', r.compiled === '' && r.recent.length >= 2, JSON.stringify(r.recent.length));
  const rendered = write.output.render({}, w1);
  check('T5 write render mentions platform', /平台级/.test(rendered[0].text));
}

// ---------- 6. compile: route missing → explicit error; route capture; success ----------
{
  let threw = null;
  try { await service.compileNode(store.PLATFORM, null, { by: 'manual' }); } catch (e) { threw = e; }
  check('L1 compile without route fails loudly', threw !== null && /未确定编译模型/.test(threw.message));
  const listener = captured.listeners.find(l => l.event === 'session/event');
  listener.fn({ id: 'sess-1' }, { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-chat' } } } });
  llmOutput.push(FIVE('编译后的平台事实。'));
  const res = await service.compileNode(store.PLATFORM, null, { by: 'manual' });
  check('L2 compile succeeds with captured route', res.ok === true, JSON.stringify(res.meta?.compiledThrough));
  const compiled = store.readCompiledSync(store.PLATFORM, null);
  check('L3 compiled.md on disk with sections', compiled !== null && compiled.includes('## 概览'));
  const meta = await store.readMeta(store.PLATFORM, null);
  check('L4 meta updatedBy/model/through', meta.updatedBy === 'manual' && meta.model === 'deepseek/deepseek-chat' && meta.compiledThrough >= 2, JSON.stringify(meta));
  check('L5 llm options carry purpose/system/maxTokens', captured.llmCalls[0].purpose === 'memory-compile' && typeof captured.llmCalls[0].system === 'string' && captured.llmCalls[0].maxTokens > 0);
  const platformCtx = captured.contexts.find(c => c.name === 'memory:platform');
  const injected = platformCtx.text();
  check('L6 inject text has wrapper + compiled', injected.includes('<memory-nodes>') && injected.includes('## 概览'));
  eq('L7 cached inject identical', platformCtx.text(), injected);
}

// ---------- 7. compile failures preserve prior layer ----------
{
  const before = store.readCompiledSync(store.PLATFORM, null);
  await store.appendRaw(store.PLATFORM, null, { kind: 'fact', text: '失败路径的增量记录' });
  llmOutput.push('## 概览\n结构不完整');
  let threw = null;
  try { await service.compileNode(store.PLATFORM, null, { by: 'manual' }); } catch (e) { threw = e; }
  check('N1 invalid structure fails', threw !== null && /结构不合格/.test(threw.message));
  check('N2 prior compiled preserved', store.readCompiledSync(store.PLATFORM, null) === before);
  const meta = await store.readMeta(store.PLATFORM, null);
  check('N3 lastError recorded', typeof meta.lastError === 'string' && /结构不合格/.test(meta.lastError), meta.lastError);
  const fakeErr = makeFakeCtx(() => [{ type: 'finish', reason: { kind: 'error', failure: { message: 'gateway down', code: 'X' } } }]);
  const svc2 = createMemoryService(fakeErr.ctx, { compileProvider: 'p', compileModel: 'm', autoCompile: false });
  svc2.register();
  let threw2 = null;
  try { await svc2.compileNode(store.PLATFORM, null, { by: 'manual' }); } catch (e) { threw2 = e; }
  check('N4 error finish surfaces', threw2 !== null && /gateway down/.test(threw2.message));
  check('N5 prior compiled still intact', store.readCompiledSync(store.PLATFORM, null) === before);
}

// ---------- 8. single-flight ----------
{
  await store.appendRaw(store.PLATFORM, null, { kind: 'fact', text: '并发路径的增量记录' });
  llmOutput.push(FIVE('并发一')); // the losing concurrent call never reaches the LLM
  const [a, b] = await Promise.allSettled([
    service.compileNode(store.PLATFORM, null, { by: 'manual' }),
    service.compileNode(store.PLATFORM, null, { by: 'manual' }),
  ]);
  const okOne = [a, b].filter(r => r.status === 'fulfilled' && r.value?.ok === true).length;
  const rejected = [a, b].filter(r => r.status === 'rejected' && /编译正在进行中/.test(String(r.reason?.message))).length;
  check('F1 exactly one concurrent compile wins', okOne === 1 && rejected === 1, `ok=${okOne} rejected=${rejected}`);
}

// ---------- 9. history rotation ----------
{
  for (let i = 0; i < 4; i++) {
    await store.appendRaw(store.PLATFORM, null, { kind: 'fact', text: '历史轮记录 ' + i });
    llmOutput.push(FIVE('历史轮' + ['一', '二', '三', '四'][i]));
    await service.compileNode(store.PLATFORM, null, { by: 'manual' });
  }
  const dir = path.join(store.memoryRoot(), 'platform', 'history');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  check('H1 history capped at 3', files.length === 3, files.join(','));
  const compiled = store.readCompiledSync(store.PLATFORM, null);
  check('H2 latest compiled is round four', compiled.includes('历史轮四'));
}

// ---------- 10. project node compile + inject switch ----------
{
  llmOutput.push(FIVE('项目级编译内容。'));
  const res = await service.compileNode(store.PROJECT, WORKSPACE, { by: 'manual' });
  check('P1 project compile ok', res.ok === true);
  const projectCtx = captured.contexts.find(c => c.name === 'memory:project');
  const injected = projectCtx.text({ agent: { session: { header: { cwd: WORKSPACE } } } });
  check('P2 project inject shows project content', injected.includes('项目级编译内容'));
  const other = projectCtx.text({ agent: { session: { header: { cwd: WORKSPACE + '-other' } } } });
  eq('P3 other workspace injects empty', other, '');
}

// ---------- 10b. RPC nodes lists the compiled project workspace ----------
{
  const route = captured.routes[0];
  const request = new Request('http://local/api/dsh-memory-nodes/rpc', {
    method: 'POST',
    body: JSON.stringify({ type: 'client-request', rpcId: 'r2', method: 'dsh-memory-nodes/rpc', payload: { action: 'nodes' } }),
  });
  const body = await (await route.fetch(request)).json();
  const projectEntry = body.result.value.nodes.find(n => n.node === 'project');
  check('X1 project workspace listed via rpc', projectEntry !== undefined && projectEntry.compiledBytes > 0, JSON.stringify(projectEntry?.workspacePath));
}

// ---------- 11. auto compile path (delta=1, debounced turn/end) ----------
{
  const fake = makeFakeCtx(() => textChunks(llmOutput.shift() ?? FIVE('自动编译轮。')));
  const svc = createMemoryService(fake.ctx, {
    autoCompile: true, autoCompileRawDelta: 1,
    compileProvider: 'deepseek', compileModel: 'deepseek-chat', // standalone service has no captured route
  });
  svc.register();
  const listener = fake.captured.listeners.find(l => l.event === 'session/event');
  const write = fake.captured.tools.find(t => t.name === 'memory_write');
  await write.execute({ node: 'platform', kind: 'fact', text: '触发自动编译的记录' }, {});
  listener.fn({ id: 's' }, { type: 'turn/end' });
  await new Promise(r => setTimeout(r, 6200));
  const meta = await store.readMeta(store.PLATFORM, null);
  check('A1 auto compile ran after turn/end', meta?.updatedBy === 'auto', JSON.stringify(meta));
  const projectMeta = await store.readMeta(store.PROJECT, WORKSPACE + '-auto');
  eq('A2 no spurious project compile without cwd', projectMeta, null);
  svc.dispose();
}

// ---------- 12. trim watermark ----------
{
  for (let i = 0; i < 5; i++) await store.appendRaw(store.PROJECT, WORKSPACE, { kind: 'fact', text: 'trim test ' + i });
  await store.writeCompiled(store.PROJECT, WORKSPACE, FIVE('trim'), { compiledThrough: 3, rawCount: 3 });
  const kept = await store.trimRaw(store.PROJECT, WORKSPACE, { rawMaxLines: 2, rawMaxBytes: 1_000_000, historyKeep: 3 });
  check('W1 trim keeps only newest lines', kept === 2, 'kept=' + kept);
  const lines = (await store.readRawSince(store.PROJECT, WORKSPACE, 0)).map(r => r.seq);
  check('W2 kept lines are newest', JSON.stringify(lines) === JSON.stringify([5, 6]), JSON.stringify(lines));
}

// ---------- summary ----------
service.dispose();
const fails = results.filter(r => !r.ok);
console.log('--- SUMMARY ' + (results.length - fails.length) + '/' + results.length + ' passed');
if (fails.length > 0) {
  console.log('FAILED: ' + fails.map(f => f.name).join('; '));
  process.exitCode = 1;
} else {
  console.log('ALL-CHECKS-PASSED');
}
fs.rmSync(scratch, { recursive: true, force: true });
