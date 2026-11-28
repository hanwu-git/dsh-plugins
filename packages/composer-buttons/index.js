/**
 * @local/composer-buttons — Host half.
 *
 * Two routes behind the connection trust fence:
 * - POST /composer-buttons/rewrite — the prompt-polish model call, migrated
 *   from prompt-polish unchanged (same request/response wire).
 * - POST /composer-buttons/restart — spawns the detached PowerShell helper
 *   that relaunches the desktop app, migrated from dsh-quick-actions.
 *
 * The Config schema declares the per-button switches the settings card edits;
 * the browser half reads them through configForms and hides disabled buttons.
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFile, mkdir } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'

export const REWRITE_PATH = '/composer-buttons/rewrite'
export const RESTART_PATH = '/composer-buttons/restart'
export const REPORT_PATH = '/composer-buttons/report'

export const inject = ['webServer', 'connection', 'llm']

/** Defaults, also used when the row omits them. */
const DEFAULT_EXE_PATH = 'D:\\Program Files\\DHS\\DeepSeek Harness.exe'
const DEFAULT_DELAY_MS = 3000
const DEFAULT_TIMEOUT_MS = 45000
const DEFAULT_MAX_OUTPUT_TOKENS = 1500
const MAX_BODY_BYTES = 64 * 1024
const MAX_PROMPT_CHARS = 12000

/**
 * The config schema Cordis validates the row against. Declared with the
 * harness schema library (`@deepseek-ai/schemastery`, resolved from the
 * profile's node_modules like unified-model-center does): the Host settings
 * provider only surfaces a row whose runtime Config carries `toJSON`, so a
 * hand-rolled Standard Schema validator (the prompt-polish pattern) never
 * appears in Settings and its configForms namespace is never served.
 */
export const Config = z.object({
  /** Polish model-call timeout in milliseconds. */
  timeoutMs: z.number().default(DEFAULT_TIMEOUT_MS).volatile(),
  /** Polish output token cap. */
  maxOutputTokens: z.number().default(DEFAULT_MAX_OUTPUT_TOKENS).volatile(),
  /** Executable the restart helper relaunches. */
  exePath: z.string().default(DEFAULT_EXE_PATH),
  /** Milliseconds between the kill and the relaunch. */
  delayMs: z.number().default(DEFAULT_DELAY_MS),
  /** Per-button switch and tooltip note. */
  buttons: z.object({
    polish: z.object({
      visible: z.boolean().default(true).volatile(),
      note: z.string().default('').volatile(),
    }),
    refresh: z.object({
      visible: z.boolean().default(true).volatile(),
      note: z.string().default('').volatile(),
    }),
    restart: z.object({
      visible: z.boolean().default(true).volatile(),
      note: z.string().default('').volatile(),
    }),
  }),
})

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

/** Read one bounded JSON body; null when over the cap. */
async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/* ------------------------------------------------------------------ *
 * Polish: model call, migrated from prompt-polish.
 * ------------------------------------------------------------------ */

const REPORT_LOG = join(tmpdir(), 'composer-buttons-report.log')
const REPORTS = []

function logLine(stage, extra = {}) {
  const record = { at: new Date().toISOString(), stage, ...extra }
  REPORTS.push(record)
  if (REPORTS.length > 200) REPORTS.shift()
  try {
    appendFileSync(REPORT_LOG, JSON.stringify(record) + '\n')
  } catch {
    // Diagnostics must never fail the feature.
  }
}

/** Normalize the model route the browser reported. */
function parseRoute(route) {
  if (typeof route !== 'object' || route === null) return undefined
  const { provider, model, reasoningEffort } = route
  if (typeof provider !== 'string' || provider === '' || typeof model !== 'string' || model === '') return undefined
  return {
    provider,
    model,
    ...(typeof reasoningEffort === 'string' && reasoningEffort !== '' ? { reasoningEffort } : {}),
  }
}

/** Parse one polish body; null when malformed. */
function parsePolishBody(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const prompt = parsed.prompt
  const mode = parsed.mode
  if (typeof prompt !== 'string' || prompt.trim() === '') return null
  if (mode !== 'light' && mode !== 'rewrite') return null
  return { prompt, mode, route: parseRoute(parsed.route) }
}

const PROMPTS = {
  light: [
    'You polish a prompt that a user is about to send to an AI assistant.',
    'Fix grammar, remove ambiguity, tighten the wording, and keep the original intent and approximate length.',
    'Do NOT answer the prompt. Do NOT add requirements the user did not write.',
    'Return only the polished prompt as plain text.',
  ].join('\n'),
  rewrite: [
    'You rewrite a rough prompt into a structured prompt for an AI assistant.',
    'Produce sections: goal, context, requirements, expected output. Keep every requirement the user wrote; you may clarify wording.',
    "Do NOT answer the prompt. Write in the user's language.",
    'Return only the rewritten prompt as plain text.',
  ].join('\n'),
}

/** Collect one LLM text stream. */
function makeCollector(onDelta) {
  const parts = []
  let terminal
  return {
    add(delta) {
      if (typeof delta === 'string' && delta !== '') {
        parts.push(delta)
        onDelta(delta)
      }
    },
    end(reason) {
      terminal = reason
    },
    text() {
      return parts.join('')
    },
    finish() {
      return terminal
    },
  }
}

function unwrap(text) {
  let t = String(text).trim()
  // Tolerate one fenced code block: the model sometimes wraps the result.
  const fence = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/)
  if (fence) t = fence[1].trim()
  // Tolerate one level of surrounding quotes.
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))) {
    t = t.slice(1, -1).trim()
  }
  return t
}

/* ------------------------------------------------------------------ *
 * Restart: detached helper, migrated from dsh-quick-actions.
 * ------------------------------------------------------------------ */

async function writeHelper(exePath, delayMs) {
  const token = createHash('sha256').update(exePath + String(Date.now()) + String(Math.random())).digest('hex').slice(0, 12)
  const dir = join(tmpdir(), 'composer-buttons-' + token)
  await mkdir(dir, { recursive: true })
  const script = [
    '# Generated by @local/composer-buttons - restarts the DSH desktop app.',
    '$ErrorActionPreference = "Stop"',
    "Add-Content -Path (Join-Path $env:TEMP 'composer-buttons-last-run.txt') -Value ((Get-Date -Format o) + ' ' + '" + exePath + "')",
    '# Let the caller finish sending the HTTP response before the processes die.',
    'Start-Sleep -Milliseconds 800',
    '# Kill every DSH process BY PID, not with /T: this helper was spawned by the',
    '# DSH host, so it sits INSIDE the DSH process tree and a tree kill would',
    '# terminate the helper before it could relaunch the app. Every DSH process',
    '# shares the configured exe path, so per-PID matching reaches all of them',
    '# while the helper - a powershell.exe - survives to do the relaunch.',
    "$procs = Get-Process | Where-Object { $_.Path -eq '" + exePath + "' }",
    'foreach ($p in $procs) {',
    '  try { taskkill /PID $($p.Id) /F | Out-Null } catch {}',
    '}',
    'Start-Sleep -Milliseconds ' + String(Math.max(1000, delayMs)),
    "Start-Process -FilePath '" + exePath + "'",
    '',
  ].join('\n')
  const file = join(dir, 'restart.ps1')
  await writeFile(file, script, 'utf8')
  return file
}

function launchHelper(scriptFile) {
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptFile], {
    detached: true,
    // Capture the helper's stderr instead of ignoring it: with stdio 'ignore'
    // a failing helper (parse error, access denied) dies silently and the
    // restart looks like "the app just died" — exactly the 2026-11-27 report.
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  })
  let stderrTail = ''
  child.stderr?.on('data', (chunk) => {
    stderrTail = (stderrTail + String(chunk)).slice(-1500)
  })
  child.on('error', (error) => {
    logLine('helper-spawn-error', { message: String(error?.message ?? error).slice(0, 300) })
  })
  child.on('exit', (code) => {
    logLine('helper-exit', { code, stderr: stderrTail.slice(0, 600) })
  })
  child.unref()
  return child.pid
}

/**
 * Register both routes behind the connection trust fence.
 * @param {object} ctx - the Cordis context carrying `webServer`, `connection`, `llm`.
 * @param {object} config - the validated row config.
 */
export function apply(ctx, config) {
  logLine('apply-ran')
  const rejected = (req, res) => {
    const rejection = ctx.connection?.requestRejection?.(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: REWRITE_PATH,
    handler: (req, res) => (async () => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
      if (essence !== 'application/json') {
        sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
        return
      }
      const text = await readBoundedBody(req)
      if (text === null) {
        sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
        return
      }
      const parsed = parsePolishBody(text)
      if (parsed === null) {
        sendJson(res, 400, { code: 'bad-request', message: 'body must carry a non-empty prompt and a known mode' })
        return
      }
      if (parsed.prompt.length > MAX_PROMPT_CHARS) {
        sendJson(res, 413, {
          code: 'prompt-too-long',
          message: `prompt is ${parsed.prompt.length} characters, over the ${MAX_PROMPT_CHARS} limit`,
        })
        return
      }

      const llm = ctx.llm
      if (typeof llm?.prepareCall !== 'function') {
        sendJson(res, 502, { code: 'no-llm', message: 'the Host LLM service is unavailable' })
        return
      }
      let call
      try {
        call = llm.prepareCall({ provider: parsed.route?.provider, model: parsed.route?.model, reasoningEffort: parsed.route?.reasoningEffort })
      } catch (error) {
        sendJson(res, 502, {
          code: 'no-adapter',
          message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
        })
        return
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('timeout')), config.timeoutMs)
      const collector = makeCollector(() => {})
      try {
        const stream = await call({ messages: [{ role: 'user', content: parsed.prompt }], systemPrompt: PROMPTS[parsed.mode] }, { signal: controller.signal })
        for await (const event of stream) {
          if (event.type === 'text-delta') collector.add(event.delta)
          else if (event.type === 'error') collector.end(event)
        }
        const polished = unwrap(collector.text())
        if (polished === '') {
          logLine('empty-result', { mode: parsed.mode })
          sendJson(res, 502, { code: 'empty-result', message: 'the model returned no usable text' })
          return
        }
        if (polished === parsed.prompt) {
          sendJson(res, 200, { prompt: polished, mode: parsed.mode, unchanged: true })
          return
        }
        logLine('ok', { mode: parsed.mode, chars: polished.length })
        sendJson(res, 200, { prompt: polished, mode: parsed.mode })
      } catch (error) {
        const aborted = controller.signal.aborted
        logLine('model-failed', {
          mode: parsed.mode,
          aborted,
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
        })
        sendJson(res, aborted ? 504 : 502, {
          code: aborted ? 'timeout' : 'model-failed',
          message: aborted ? `the model call exceeded ${config.timeoutMs} ms` : String(error?.message ?? error).slice(0, 400),
        })
      } finally {
        clearTimeout(timer)
      }
    })().catch((error) => {
      logLine('handler-threw', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
      })
      try {
        if (res.headersSent) res.destroy()
        else sendJson(res, 500, { code: 'internal-error', message: String(error?.message ?? error).slice(0, 400) })
      } catch { /* socket gone */ }
    }),
  }), 'composer-buttons: POST rewrite')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: RESTART_PATH,
    handler: (req, res) => (async () => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      try {
        const exePath = String(config.exePath || '')
        const delayMs = Number(config.delayMs) || 3000
        if (!exePath) {
          sendJson(res, 500, { ok: false, error: 'exePath is not configured' })
          return
        }
        const script = await writeHelper(exePath, delayMs)
        const pid = launchHelper(script)
        logLine('restart-requested', { pid })
        sendJson(res, 200, { ok: true, pid })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String(error && error.message || error) })
      }
    })().catch((error) => {
      try {
        if (res.headersSent) res.destroy()
        else sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
      } catch { /* socket gone */ }
    }),
  }), 'composer-buttons: POST restart')

  // Diagnostics mirror (same shape as prompt-polish's report route).
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: REPORT_PATH,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const body = await readBoundedBody(req)
      try {
        logLine('client', { body: (body ?? '').slice(0, 300) })
      } catch { /* diagnostics only */ }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    },
  }), 'composer-buttons: POST report')
}
