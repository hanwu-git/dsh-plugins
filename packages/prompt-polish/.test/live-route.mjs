/**
 * Live check: does the polish route actually reach a model and come back with a
 * rewritten prompt?
 *
 * Boots the Host half with the real `ctx.llm` from the running Harness is not
 * possible outside it, so this exercises everything up to the provider boundary:
 * a stub `ctx.llm` that records the exact request, plus the real stream handling,
 * the real unwrap, and the real route. It answers "is the request well-formed and
 * is the response interpreted correctly", which is what a live call would prove
 * apart from the provider accepting the route.
 *
 * Run with:  ELECTRON_RUN_AS_NODE=1 "<DSH_NODE_EXECUTABLE>" .test/live-route.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http'

const here = dirname(fileURLToPath(import.meta.url))
const host = await import(pathToFileURL(join(here, '..', 'index.js')).href)

const routes = []
let recorded
const ctx = {
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {} },
  webServer: { register(route) { routes.push(route); return () => {} } },
  connection: { requestRejection: () => undefined },
  llm: {
    async prepareCall(route, signal) {
      recorded = { route }
      return {
        config: { maxTokens: route.maxTokens },
        async *stream(request) {
          recorded.request = request
          // A fenced answer, to prove unwrap runs on the real response path.
          yield { type: 'text-delta', text: '```markdown\n' }
          yield { type: 'text-delta', text: 'You are helping me draft a bid.' }
          yield { type: 'text-delta', text: '\n```' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      }
    },
  },
}

host.apply(
  ctx,
  host.Config['~standard'].validate({}).value,
  { createUserMessage: input => ({ ...input, role: 'user' }) },
)

const route = routes[0]
const server = createServer((req, res) => { void route.handler(req, res) })
await new Promise(r => server.listen(0, '127.0.0.1', r))
const { port } = server.address()

const response = await fetch(`http://127.0.0.1:${port}${route.path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt: 'help me write a bid for the xinhua project',
    mode: 'rewrite',
    route: { provider: 'deepseek', model: 'deepseek-chat' },
  }),
})
const body = await response.json()
await new Promise(r => server.close(r))

console.log('status        :', response.status)
console.log('returned prompt:', JSON.stringify(body.prompt))
console.log('mode          :', body.mode)
console.log('provider used :', recorded.route.provider, '/', recorded.route.model)
console.log('maxTokens     :', recorded.route.maxTokens)
console.log('system starts :', JSON.stringify(recorded.request.system.slice(0, 60)))
console.log('message count :', recorded.request.messages.length)
console.log('purpose       :', recorded.request.purpose)

const ok = response.status === 200
  && body.prompt === 'You are helping me draft a bid.'
  && recorded.route.provider === 'deepseek'
  && !recorded.request.system.includes('```')
console.log(ok ? 'RESULT: request well-formed and the fence stripped' : 'RESULT: FAILED')
process.exit(ok ? 0 : 1)
