// Offline regression harness for dsh-loomy-connect image wiring (verified 2026-11-18, 11/11 PASS).
// Re-run after repacking lib/ against a new DSH release:
//   1) Stage deps (whole scopes, skip nested node_modules):
//      copy <DSH>/resources/app.asar/dsh/node_modules/@deepseek-ai/*  and  @earendil-works/*
//      into a scratch env's node_modules/ (e.g. D:\obj\DHSws\_verify_env\).
//      NOTE: ESM resolve failures are negatively cached per-process - stage ALL deps
//      BEFORE the first import attempt; a copy-then-retry loop inside one process never works.
//   2) Copy this package (package.json + lib/index.js) into <scratch>\patched\dsh-loomy-connect\.
//   3) Run with Electron node (ELECTRON_RUN_AS_NODE=1):
//      & "<DSH executable>" verify-offline.mjs   (from inside <scratch>)
//   4) Expect ALL-CHECKS-PASSED (A1-A9 positive path, B1-B2 negative control).
// Offline end-to-end verification for the patched dsh-loomy-connect image wiring.
// Run with Electron's node:  ELECTRON_RUN_AS_NODE=1 "<DSH_NODE_EXECUTABLE>" driver.mjs
// Scenario A (positive): real PiAiAdapter + patched createLoomyAdapter + mock attachment
//   store + local fake OpenAI-compatible SSE gateway -> a user image message must stream.
// Scenario B (negative): identical setup but ctx.get('attachments') === undefined must
//   reproduce the original "durable attachment service" guard (proves harness sensitivity).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASAR_NM = 'D:/Program Files/DHS/resources/app.asar/dsh/node_modules';
const DEST_NM = path.join(here, 'node_modules');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + detail : ''));
}

// ---------- ASAR package staging ----------
function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const it of fs.readdirSync(src, { withFileTypes: true })) {
    if (it.name === 'node_modules') continue; // nested copies are broken inside ASAR
    const s = path.join(src, it.name);
    const d = path.join(dst, it.name);
    if (it.isDirectory()) copyTree(s, d);
    else if (it.isFile()) fs.copyFileSync(s, d);
    else {
      try {
        const st = fs.statSync(s);
        if (st.isDirectory()) copyTree(s, d); else fs.copyFileSync(s, d);
      } catch { /* broken ASAR symlink: skip */ }
    }
  }
}
const copied = new Set();
function copyPkg(name) {
  if (!name || name.startsWith('node:') || copied.has(name)) return true;
  copied.add(name);
  const src = path.join(ASAR_NM, name);
  if (!fs.existsSync(src)) { console.log('COPY-MISS ' + name); return false; }
  copyTree(src, path.join(DEST_NM, name));
  console.log('COPY-OK ' + name);
  return true;
}
for (const p of [
  '@deepseek-ai/schemastery', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-llm-pi-ai', '@earendil-works/pi-ai',
  '@deepseek-ai/dsh-attachment', '@deepseek-ai/dsh-brand', '@deepseek-ai/dsh-error', '@deepseek-ai/dsh-util-values',
  'openai', 'partial-json', 'typebox', '@earendil-works/pi-telemetry', 'http-proxy-agent', 'https-proxy-agent',
  '@smithy/node-http-handler', '@anthropic-ai/sdk', '@google/genai',
]) copyPkg(p);

// ---------- plugin import with dependency-closure retry ----------
// All dependencies were staged beforehand (whole @deepseek-ai and @earendil-works
// scopes). ESM resolution failures are negatively cached per-process, so a copy-and-
// retry loop inside one process can never succeed 鈥?fail loudly with the full error.
const pluginUrl = pathToFileURL(path.join(here, 'patched/dsh-loomy-connect/lib/index.js'));
let plugin = null;
try { plugin = await import(pluginUrl.href); } catch (e) {
  console.error('PLUGIN-IMPORT-FAILED: ' + (e?.message ?? e));
  console.error(e?.stack ?? '');
  throw e;
}
if (!plugin) throw new Error('plugin import failed');
const { createLoomyAdapter, LOOMY_PROVIDER } = plugin;
console.log('PLUGIN-IMPORTED ' + pluginUrl.href);

// ---------- fixtures ----------
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0x3a]);
const ref = {
  attachmentId: 'sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  mediaType: 'image/png', bytes: PNG_BYTES.length, width: 4, height: 4, name: 'probe.png',
};
let storeCalls = { readImageRequest: 0, imageHostPath: 0 };
function freshCalls() { storeCalls = { readImageRequest: 0, imageHostPath: 0 }; }
const mockStore = {
  async readImageRequest(r, _target, _signal) {
    storeCalls.readImageRequest++;
    return {
      variantId: 'img-variant-verify', attachment: r, data: PNG_BYTES, mediaType: 'image/png',
      bytes: PNG_BYTES.length, width: r.width, height: r.height, depth: 'uchar', space: 'srgb', hasAlpha: false,
    };
  },
  imageHostPath(r) { storeCalls.imageHostPath++; return 'C:\\Users\\hhwxx\\.dsh\\attachments\\v1\\objects\\deadbeef.png'; },
};
function makeCtx(attachments) {
  return {
    get(name) {
      if (name === 'attachments') return attachments;
      if (name === 'fs') return { processPathFromHostPath: p => p.replace('C:\\Users\\hhwxx\\.dsh', 'C:\\mnt\\dsh-mapped') };
      return undefined;
    },
  };
}
const catalog = { current: () => [{ id: 'loomy-vision', name: 'Loomy Vision', supportsImages: true, reasoning: false, contextWindow: 128000, maxTokens: 16384 }] };

// ---------- fake OpenAI-compatible gateway ----------
let lastRequest = null; // { auth, body }
let gatewayHits = 0;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    gatewayHits++;
    lastRequest = { auth: req.headers.authorization ?? null, body: Buffer.concat(chunks).toString('utf8') };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const chunk = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');
    const base = { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1700000000, model: 'loomy-vision' };
    chunk({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'LOOMY-' }, finish_reason: null }] });
    chunk({ ...base, choices: [{ index: 0, delta: { content: 'OK' }, finish_reason: null }] });
    chunk({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 2, total_tokens: 14 } });
    res.write('data: [DONE]\n\n');
    res.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = 'http://127.0.0.1:' + server.address().port;
console.log('GATEWAY ' + baseUrl);

const shim = { baseUrl: () => baseUrl, token: () => 'test-token' };
const makeOptions = () => ({
  provider: LOOMY_PROVIDER,
  model: 'loomy-vision',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'describe the probe image' },
      { type: 'image', attachment: ref },
    ],
  }],
});

// ---------- Scenario A: patched wiring, full stream ----------
{
  freshCalls();
  const { adapter } = createLoomyAdapter(catalog, shim, makeCtx(mockStore));
  let text = ''; let finish = null; let error = null;
  try {
    for await (const c of adapter.stream(makeOptions())) {
      if (c.type === 'text-delta') text += c.text;
      else if (c.type === 'finish') finish = c;
    }
  } catch (e) { error = e; }
  record('A1 stream completes without durable-attachment error', error === null, error ? (error.code ?? '') + ' ' + error.message : undefined);
  record('A2 model text echoed through SSE', text === 'LOOMY-OK', JSON.stringify(text));
  record('A3 mock store readImageRequest invoked', storeCalls.readImageRequest > 0, 'calls=' + storeCalls.readImageRequest);
  record('A4 gateway reached (conversion finished)', gatewayHits > 0, 'hits=' + gatewayHits);
  record('A5 image bytes reached gateway as data URL', lastRequest !== null && lastRequest.body.includes('data:image/png;base64'));
  record('A6 mapped readonly path reached model prompt', lastRequest !== null && lastRequest.body.includes('dsh-mapped'));
  record('A7 imageHostPath consulted by resolveImageAccess', storeCalls.imageHostPath > 0, 'calls=' + storeCalls.imageHostPath);
  record('A8 finish reason stop', finish?.reason?.kind === 'stop', JSON.stringify(finish ?? null));
  record('A9 gateway auth = adapter resolveApiKey token', lastRequest?.auth === 'Bearer test-token', String(lastRequest?.auth));
}

// ---------- Scenario B: negative control, attachments undefined ----------
{
  freshCalls();
  const hitsBefore = gatewayHits;
  const negAdapter = createLoomyAdapter(catalog, shim, makeCtx(undefined)).adapter;
  let threw = null;
  try { for await (const _c of negAdapter.stream(makeOptions())) { /* drain */ } } catch (e) { threw = e; }
  record('B1 missing attachments reproduces original guard', threw !== null && /durable attachment service/.test(String(threw.message)), threw ? (threw.code ?? 'no-code') + ' ' + threw.message : 'no throw');
  record('B2 guard fires before any gateway traffic', gatewayHits === hitsBefore, 'hits=' + (gatewayHits - hitsBefore));
}

// ---------- summary ----------
const fails = results.filter(r => !r.ok);
console.log('--- SUMMARY ' + (results.length - fails.length) + '/' + results.length + ' passed');
if (fails.length > 0) {
  console.log('FAILED: ' + fails.map(f => f.name).join('; '));
  process.exitCode = 1;
} else {
  console.log('ALL-CHECKS-PASSED');
}
server.close();

