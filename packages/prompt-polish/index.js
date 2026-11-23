/**
 * @local/prompt-polish — Host half.
 *
 * One authorized route that asks a model to rewrite the prompt currently sitting
 * in the composer. The browser half owns the button, the draft, and the *choice*
 * of model; this half owns the model call, because the browser has no LLM access.
 *
 * Why the browser sends the route instead of the Host looking it up: the current
 * model is a durable per-session projection (`modelSelection`), and the browser
 * already subscribes to it for the model menu. Reading it there means the polish
 * uses exactly the model the reader sees selected, with no second lookup that
 * could disagree. A deployment default is the fallback when no route is sent.
 *
 * The call follows the shape the shipped session-title plugin uses —
 * `ctx.llm.prepareCall(...)` then assemble the stream — rather than inventing a
 * second way to talk to a provider.
 *
 * Security has one home, the same one every shipped route uses: the composition's
 * `connection` service admits the request first (`requestRejection`), whose
 * Host/Origin fence and browser authentication gate the caller. On top of that
 * fence the route validates at the wire: a POST, `application/json`, a 64 KiB
 * ceiling, a non-empty prompt within the plugin's limit, and a known mode.
 *
 * Nothing is persisted: no session event is appended, no draft is touched on the
 * Host side, and the completion exists only in the response.
 */

import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Cordis function-plugin name. */
export const name = 'prompt-polish-host'

/**
 * Build marker, written with every activation. A restart that did not actually
 * re-run this module keeps the previous route alive while the edited file sits
 * on disk; the marker makes that visible instead of inferred.
 */
export const BUILD = 'v3-dockfix-2026-11-18'

/** `webServer` carries the route; `connection` is the trust fence; `llm` runs the call. */
export const inject = ['webServer', 'connection', 'llm']

/**
 * Build the one-shot user input for a polish request.
 *
 * This deliberately does NOT borrow `createUserMessage` from `@deepseek-ai/dsh-llm`.
 * Resolving that package needed `DSH_PROFILE_DIR`/`DSH_INSTALL_DIR` at request
 * time, and when the Host process does not export them the lookup threw — before
 * any try/catch — which the web server answers with a bare `400` and no body.
 * That is exactly the opaque failure this feature kept showing. `GenerateOptions`
 * accepts an identity-free `RequestUserInput` for one-shot callers, so a plain
 * object is both sufficient and dependency-free.
 * @param {string} text - the draft to rewrite.
 * @returns {{ role: 'user', content: { type: 'text', text: string }[] }} the input.
 */
export function userInput(text) {
  return { role: 'user', content: [{ type: 'text', text }] }
}

/** Where the browser half posts a polish request. Must match `POLISH_PATH` in client.js. */
export const POLISH_PATH = '/prompt-polish/rewrite'

/** Where the browser half reports its own progress. Diagnostics only. */
export const REPORT_PATH = '/prompt-polish/report'

/**
 * Progress reports, newest last, and mirrored to this file.
 *
 * The route is behind the connection's auth fence, so a person cannot read it
 * from a terminal while the GUI holds the cookie. Writing the same lines to a
 * file keeps the diagnosis available without weakening that fence.
 */
const REPORTS = []

/** Where the mirror lives; resolved lazily so a read-only profile cannot crash load. */
const REPORT_LOG = join(tmpdir(), 'prompt-polish-report.log')

/**
 * Append one diagnostic line to the same mirror the browser reports use.
 *
 * The rewrite route answers the page with a JSON error, but the page shows only
 * a short notice; the exact LlmError code and message are what make a failure
 * diagnosable without a debugger attached, so they are recorded here too. Best
 * effort: a diagnostics write must never fail the request.
 * @param {string} stage - which step the line describes.
 * @param {object} [facts] - extra JSON-safe facts.
 */
function logLine(stage, facts) {
  try {
    appendFileSync(REPORT_LOG, `${new Date().toISOString()} ${JSON.stringify({ stage, ...facts })}\n`)
  } catch {
    // Diagnostics only.
  }
}

/** Request bodies are a prompt, a mode, and a route; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

/**
 * Upper bound on the prompt sent to the model. A long draft is refused rather
 * than truncated: a silently shortened prompt would come back polished but
 * missing the part the reader cared about.
 */
const MAX_PROMPT_CHARS = 12000

/** Defaults for the two bounds, also used when the row omits them. */
const DEFAULT_TIMEOUT_MS = 45000
const DEFAULT_MAX_OUTPUT_TOKENS = 1500

/**
 * Validate and default one row config.
 * @param {unknown} value - the row's `config` as written in the patch.
 * @returns {{ timeoutMs: number, maxOutputTokens: number }} the resolved config.
 * @throws {Error} when a bound is out of range.
 */
function resolveConfig(value) {
  const config = typeof value === 'object' && value !== null ? value : {}
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxOutput = config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 600000) {
    throw new Error('prompt-polish: config.timeoutMs must be an integer between 1000 and 600000')
  }
  if (!Number.isInteger(maxOutput) || maxOutput < 64 || maxOutput > 32000) {
    throw new Error('prompt-polish: config.maxOutputTokens must be an integer between 64 and 32000')
  }
  return { timeoutMs: timeout, maxOutputTokens: maxOutput }
}

/**
 * The config schema Cordis validates the row against, shaped as a Standard Schema
 * (`~standard`.validate) by hand rather than through the harness's schema library:
 * a bundle installed from a workspace directory only resolves Node built-ins, so
 * importing that library would make this Host half fail to load.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'prompt-polish',
    /**
     * @param {unknown} value - the row's config.
     * @returns {{ value: object } | { issues: { message: string }[] }} the resolved config or its problems.
     */
    validate(value) {
      try {
        return { value: resolveConfig(value) }
      } catch (error) {
        return { issues: [{ message: error instanceof Error ? error.message : 'invalid config' }] }
      }
    },
  },
}

/**
 * The system prompt for each mode. These are instructions to the model, not copy
 * for the reader: the reader never sees them.
 */
const SYSTEM = {
  light: [
    'You polish a prompt that a user is about to send to an AI assistant.',
    'Keep the user\'s language, intent, and approximate length. Fix grammar, ambiguity, and structure.',
    'Make an implicit requirement explicit only when the original already hints at it.',
    'Do not add requirements, examples, or facts the user did not imply.',
    'Do not answer the prompt. Do not explain your changes.',
    'Return only the rewritten prompt, with no preamble, quotes, or code fence.',
  ].join('\n'),
  rewrite: [
    'You rewrite a rough prompt into a clear, well-structured prompt for an AI assistant.',
    'Preserve the user\'s actual goal, language, and every concrete detail they gave.',
    'Organize it so the goal, the context, the requirements, and the expected output are unambiguous.',
    'Where the original is vague about something essential, state the assumption inline rather than inventing a fact.',
    'Do not answer the prompt. Do not explain your changes.',
    'Return only the rewritten prompt, with no preamble, quotes, or code fence.',
  ].join('\n'),
}

/** The two polishing strengths the button offers. */
export const MODES = ['light', 'rewrite']

/** JSON response (no-store: a completion is never cacheable). */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Collect a bounded request body as UTF-8 text.
 * @param {object} req - the incoming request.
 * @returns {Promise<string | null>} the body, or null past the ceiling.
 */
async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

/**
 * Validate one polish body at the wire.
 * @param {string} text - the request body.
 * @returns {{ prompt: string, mode: string, route?: { provider: string, model: string, reasoningEffort?: string } } | null}
 *   the request, or null when it is not the expected shape.
 */
function parseBody(text) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const { prompt, mode, route } = body
  if (typeof prompt !== 'string' || prompt.trim() === '') return null
  if (typeof mode !== 'string' || !MODES.includes(mode)) return null
  if (route === undefined || route === null) return { prompt, mode }
  if (typeof route !== 'object') return null
  const { provider, model, reasoningEffort } = route
  if (typeof provider !== 'string' || provider === '') return null
  if (typeof model !== 'string' || model === '') return null
  if (reasoningEffort !== undefined && typeof reasoningEffort !== 'string') return null
  return {
    prompt,
    mode,
    route: { provider, model, ...(reasoningEffort === undefined ? {} : { reasoningEffort }) },
  }
}

/**
 * Strip the wrappers a model sometimes adds despite the instruction.
 *
 * The system prompt says "no quotes, no fence", but models regress. Rather than
 * shipping a silently mis-quoted prompt back into the composer, this removes
 * exactly the two unambiguous wrappers: one surrounding fenced block, and one
 * pair of matching outer quotes.
 * @param {string} text - the raw completion.
 * @returns {string} the bare prompt.
 */
export function unwrap(text) {
  let out = text.trim()
  // Models fence in more than one shape: with a language tag or none, and with
  // the body on its own lines OR immediately after the opening marker (a
  // one-line fence). The previous pattern demanded a newline after the opener
  // and before the closer, so ```` ```text``` ```` came back with the markers
  // still in the draft. Two things keep the new pattern honest: the language
  // tag may not run into the body (a tag is followed by a newline, a space, or
  // the closer), and the body is matched non-greedily.
  const fence = /^```(?:[a-zA-Z0-9+#-]+[ \t]*\r?\n|[ \t]*\r?\n)?([\s\S]*?)\r?\n?```$/.exec(out)
  if (fence !== null) out = fence[1].trim()
  const quoted = /^(["'“「])([\s\S]*)(["'”」])$/.exec(out)
  if (quoted !== null) {
    const closing = { '"': '"', "'": "'", '“': '”', '「': '」' }
    // Only unwrap a plausible pair, so an apostrophe inside the text survives.
    if (closing[quoted[1]] === quoted[3]) out = quoted[2].trim()
  }
  return out
}

/**
 * Accumulate one stream into the visible text and the terminal reason.
 *
 * Only `text-delta` contributes text: reasoning deltas and tool-call deltas are
 * deliberately dropped, so a reasoning model's thinking can never leak into the
 * reader's prompt.
 * @returns {{ push: Function, text: Function, finish: Function }} the collector.
 */
export function createCollector() {
  const parts = []
  let terminal
  return {
    /**
     * @param {object} chunk - one stream chunk.
     */
    push(chunk) {
      if (typeof chunk !== 'object' || chunk === null) return
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') parts.push(chunk.text)
      else if (chunk.type === 'finish') terminal = chunk.reason
    },
    /** @returns {string} the concatenated visible text. */
    text() { return parts.join('') },
    /** @returns {object | undefined} the terminal reason, when the stream reported one. */
    finish() { return terminal },
  }
}

/**
 * Register the polish route behind the connection trust fence.
 * @param {object} ctx - the Cordis context carrying `webServer`, `connection`, `llm`.
 * @param {object} config - the validated row config.
 * @param {object} [_unused] - retained for callers that used to inject the LLM
 *   assembly helpers; the route no longer resolves anything from the harness.
 */
export function apply(ctx, config, _unused) {
  // Announced on activation so a reload is provable from the log alone: a
  // restart that never re-ran `apply` leaves the OLD route registered, which is
  // exactly how a fixed file keeps behaving like the broken one.
  logLine('apply-ran', { build: BUILD })
  const rejected = (req, res) => {
    const rejection = Reflect.get(ctx, 'connection')?.requestRejection?.(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: POLISH_PATH,
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
      let text
      try {
        text = await readBoundedBody(req)
      } catch {
        sendJson(res, 400, { code: 'bad-request', message: 'request body unreadable' })
        return
      }
      if (text === null) {
        sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
        return
      }
      const parsed = parseBody(text)
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

      const messages = [userInput(parsed.prompt)]

      const controller = new AbortController()
      const timer = setTimeout(() => { controller.abort() }, config.timeoutMs)
      try {
        // A route from the browser is the reader's own selection. Without one —
        // a fresh session that has never recorded a model choice — there is no
        // implicit provider default: `prepareCall` resolves through
        // `registration(provider)` and throws NO_ADAPTER on an undefined
        // provider. Fall back to the deployment's configured default selection,
        // the same one the model catalog uses before a Session selects.
        let route = parsed.route
        if (route === undefined) {
          // `agentDefaultModel` is optional: read it defensively so a profile
          // without that service still polls this route normally (it then
          // reports a clear model-failed instead of refusing to load).
          let defaults
          try {
            defaults = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined
          } catch {
            defaults = undefined
          }
          const selection = typeof defaults?.currentSelection === 'function'
            ? defaults.currentSelection()
            : undefined
          if (selection !== undefined && typeof selection.provider === 'string'
            && typeof selection.model === 'string') {
            route = {
              provider: selection.provider,
              model: selection.model,
              ...(typeof selection.reasoningEffort === 'string'
                ? { reasoningEffort: selection.reasoningEffort }
                : {}),
            }
          }
        }
        // The reasoning effort a stored selection carries is only valid for the
        // model that recorded it, and adapters differ: a route that declares no
        // `efforts` (the Loomy/WorkBuddy adapters report `reasoning: true` with an
        // empty effort list) throws UNSUPPORTED_REASONING_EFFORT when one is
        // passed. So the effort is NOT forwarded blindly. It is offered through
        // prepareCall's `configure` callback, which runs against the resolved
        // model metadata; there it is kept only when that model actually lists
        // it. This is the same shape the shipped session-title provider uses.
        const wantedEffort = route?.reasoningEffort
        const call = await ctx.llm.prepareCall({
          ...(route === undefined ? {} : { provider: route.provider, model: route.model }),
          maxTokens: config.maxOutputTokens,
        }, controller.signal, (controls, model) => {
          if (wantedEffort === undefined) return controls
          const supports = model?.reasoning?.efforts?.some(effort => effort.id === wantedEffort) === true
          return supports ? { ...controls, reasoningEffort: wantedEffort } : controls
        })
        logLine('prepare-ok', {
          requestedRoute: route ?? null,
          resolvedProvider: call.config?.provider ?? null,
          resolvedModel: call.config?.model ?? null,
          resolvedEffort: call.config?.reasoningEffort ?? null,
          maxTokens: call.config?.maxTokens ?? null,
        })
        const options = {
          ...call.config,
          messages,
          system: SYSTEM[parsed.mode],
          purpose: 'prompt-polish',
          signal: controller.signal,
        }
        // Accumulate the stream here rather than through the harness assembler:
        // this route only needs the visible text and the terminal reason, and the
        // narrower contract cannot break when the assembler changes.
        const collector = createCollector()
        for await (const chunk of call.stream(options)) {
          collector.push(chunk)
        }
        controller.signal.throwIfAborted()
        const finish = collector.finish()
        if (finish !== undefined && (finish.kind === 'error' || finish.kind === 'aborted')) {
          const failure = finish.failure ?? {}
          logLine('model-failed', {
            kind: finish.kind,
            code: failure.code ?? null,
            status: failure.status ?? null,
            message: typeof failure.message === 'string' ? failure.message.slice(0, 500) : null,
          })
          sendJson(res, 502, {
            code: 'model-failed',
            message: failure.message ?? 'the model call failed',
            ...(typeof failure.code === 'string' ? { reason: failure.code } : {}),
          })
          return
        }
        const polished = unwrap(collector.text())
        if (polished === '') {
          logLine('empty-completion', { finishKind: finish?.kind ?? null })
          sendJson(res, 502, { code: 'empty-completion', message: 'the model returned no text' })
          return
        }
        logLine('ok', { mode: parsed.mode, chars: polished.length })
        sendJson(res, 200, { prompt: polished, mode: parsed.mode })
      } catch (error) {
        if (controller.signal.aborted) {
          sendJson(res, 504, { code: 'timeout', message: 'the model did not answer in time' })
          return
        }
        // Surface the real reason. Swallowing it behind one generic string made
        // "does nothing" indistinguishable from "no adapter", "bad route",
        // "provider rejected the key", and so on. `detail` stays machine-useful
        // (the LlmError code) while `message` is what the reader can act on.
        const failure = error instanceof Error ? error : undefined
        const code = typeof failure?.code === 'string' ? failure.code : undefined
        logLine('threw', {
          code: code ?? null,
          name: failure?.name ?? null,
          message: failure?.message?.slice(0, 500) ?? null,
        })
        sendJson(res, 502, {
          code: 'model-failed',
          message: failure?.message ?? 'the model call failed',
          ...(code === undefined ? {} : { reason: code }),
        })
      } finally {
        clearTimeout(timer)
      }
    })().catch((error) => {
      // Last-resort net. An exception that escapes the handler makes the web
      // server answer a bare `400` with no body, which the page can only render
      // as "polish failed" — the exact blind spot this feature kept hitting.
      // Everything is already answered inside the handler, so reaching here is
      // a bug; report it in JSON and in the diagnostics mirror instead of
      // letting it vanish.
      logLine('handler-threw', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      })
      try {
        if (res.headersSent) res.destroy()
        else sendJson(res, 500, {
          code: 'internal-error',
          message: error instanceof Error ? error.message : String(error),
        })
      } catch {
        // The socket is already gone; nothing left to answer.
      }
    }),
  }), `prompt-polish: POST ${POLISH_PATH}`)

  // Diagnostics: the browser half reports its own progress here, so a button that
  // fails to appear can be diagnosed from outside the page. It carries no prompt
  // text and no user data — only stage names and type names.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: REPORT_PATH,
    handler: async (req, res) => {
      const rejection = ctx.connection.requestRejection(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 16 * 1024) {
          res.statusCode = 413
          res.end()
          return
        }
        chunks.push(chunk)
      }
      REPORTS.push({
        at: new Date().toISOString(),
        body: Buffer.concat(chunks).toString('utf8').slice(0, 2000),
      })
      // Mirror to disk, best effort: a diagnostics write must never fail the
      // report itself, and the route still answers 200 either way.
      try {
        appendFileSync(REPORT_LOG, REPORTS[REPORTS.length - 1].at + ' ' + REPORTS[REPORTS.length - 1].body + '\n')
      } catch {
        // The in-memory copy above is still the answer.
      }
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end('{"ok":true}')
    },
  }), `prompt-polish: POST ${REPORT_PATH}`)
}
