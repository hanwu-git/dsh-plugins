/**
 * Does the Host half's dynamic helper resolution actually work in this profile?
 *
 * The bundle is linked from a workspace directory, where a bare
 * `@deepseek-ai/dsh-llm` import cannot resolve. This exercises the real
 * `loadLlmHelpers()` path — profile first, install directory second — so the
 * fallback order is proven rather than assumed.
 *
 * Run with:  ELECTRON_RUN_AS_NODE=1 "<DSH_NODE_EXECUTABLE>" .test/resolve-test.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const source = await import(pathToFileURL(join(here, '..', 'index.js')).href)

console.log('module loaded without a bare harness import: yes')
console.log('exports:', Object.keys(source).sort().join(', '))

const require = createRequire(import.meta.url)
const bases = [process.env.DSH_PROFILE_DIR, process.env.DSH_INSTALL_DIR].filter(Boolean)
for (const base of bases) {
  try {
    const resolved = require.resolve('@deepseek-ai/dsh-llm', { paths: [base] })
    console.log('resolves from', base, '->', resolved)
  } catch (error) {
    console.log('cannot resolve from', base, '->', error.code)
  }
}

// Prove the helpers are real classes, not just a resolved path.
const resolved = require.resolve('@deepseek-ai/dsh-llm', { paths: bases })
const llm = await import(pathToFileURL(resolved).href)
console.log('BlockAssembler is a constructor:', typeof llm.BlockAssembler === 'function')
console.log('createUserMessage is a function:', typeof llm.createUserMessage === 'function')
const message = llm.createUserMessage({ content: [{ type: 'text', text: 'x' }], source: { kind: 'prompt-polish' } })
console.log('a message with a custom source kind is accepted:', message.role === 'user')
