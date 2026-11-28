/**
 * Host half of the unified model center.
 *
 * The picker and its settings page live in client.js. This half declares the
 * Config schema (DSH only creates a settings namespace when a Host row exports
 * one) and serves the update-check route the browser half polls 30 s after
 * startup. Keeping the GitHub fetches on the Host avoids browser CORS and lets
 * us read the installed versions straight from the profile's node_modules.
 */
import z from '@deepseek-ai/schemastery'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const Config = z.object({
  /** Models hidden from the model center. Keys are `connector::modelId`. */
  hidden: z.array(z.string()).default([]).volatile(),
  /** Ordered `connector::modelId` keys; unlisted ones keep catalog order. */
  modelOrder: z.array(z.string()).default([]).volatile(),
  /** Ordered connector ids; unlisted ones keep registration order. */
  providerOrder: z.array(z.string()).default([]).volatile(),
})

/** The five self-built bundles this plugin watches for updates. */
export const WATCHED_PLUGINS = [
  { name: 'dsh-loomy-connect', dir: 'dsh-loomy-connect', dirAlt: null },
  { name: '@local/unified-model-center', dir: '@local/unified-model-center', dirAlt: null },
  { name: 'dsh-memory-nodes', dir: 'dsh-memory-nodes', dirAlt: null },
  { name: '@local/composer-buttons', dir: '@local/composer-buttons', dirAlt: 'composer-buttons' },
  { name: '@local/credit-hud', dir: '@local/credit-hud', dirAlt: null },
]

export const UPDATE_CHECK_PATH = '/plugins/unified-model-center/check-updates'
const INDEX_URL = 'https://raw.githubusercontent.com/hanwu-git/dsh-plugins/main/index.json'
const CHANGELOG_BASE = 'https://raw.githubusercontent.com/hanwu-git/dsh-plugins/main/packages/'

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function isLoopback(req) {
  const host = String(req.headers.host || '')
  const origin = req.headers.origin
  if (!/(^|\.)localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/i.test(host)) return false
  if (origin !== undefined && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin))) return false
  return true
}

function cmpSemver(a, b) {
  const pa = String(a || '').replace(/^v/, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b || '').replace(/^v/, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

async function installedVersion(profileDir, spec) {
  const candidates = [spec.dir, spec.dirAlt].filter(Boolean)
  for (const dir of candidates) {
    const file = join(profileDir, 'node_modules', dir, 'package.json')
    try {
      const text = await readFile(file, 'utf8').catch(() => undefined)
      if (text === undefined) continue
      const pkg = JSON.parse(text.replace(/^\uFEFF/, ''))
      if (pkg && pkg.name === spec.name && typeof pkg.version === 'string') return pkg.version
    } catch { /* try next candidate */ }
  }
  return undefined
}

async function fetchText(url, ms = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: '*/*' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.text()
}

async function checkUpdates(profileDir) {
  if (!profileDir) return { ok: false, error: 'profile directory unavailable' }
  let index
  try {
    index = JSON.parse(await fetchText(INDEX_URL))
  } catch (error) {
    return { ok: false, error: 'index fetch failed: ' + (error && error.message || error) }
  }
  const byName = new Map((index.plugins || []).map(p => [p.name, p]))
  const updates = []
  for (const spec of WATCHED_PLUGINS) {
    const installed = await installedVersion(profileDir, spec)
    const entry = byName.get(spec.name)
    const tags = entry && entry['dist-tags'] ? entry['dist-tags'] : undefined
    const latest = tags ? tags.latest : undefined
    if (!installed || !latest || cmpSemver(latest, installed) <= 0) continue
    const dir = (entry.repository && entry.repository.directory) || spec.dir
    let changelog = ''
    try {
      changelog = (await fetchText(CHANGELOG_BASE + dir + '/CHANGELOG.md')).slice(0, 8000)
    } catch { /* changelog is optional */ }
    updates.push({
      name: spec.name,
      title: (entry.title && (entry.title.zh || entry.title.en)) || spec.name,
      installed,
      latest,
      changelog,
    })
  }
  return { ok: true, checkedAt: Date.now(), updates }
}

function handler(ctx) {
  return (req, res) => {
    void (async () => {
      if (!isLoopback(req)) return json(res, 403, { error: 'request-not-trusted' })
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
      try {
        // DSH_PROFILE_DIR is injected into shell-call environments only, not
        // into the Host process itself; the profile context service carries
        // the same directory at runtime.
        const profile = ctx.get('profileContext')
        const profileDir = profile ? profile.dir : process.env.DSH_PROFILE_DIR
        json(res, 200, await checkUpdates(profileDir))
      } catch (error) {
        json(res, 500, { error: String(error && error.message || error) })
      }
    })()
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], webCtx => {
    ctx.effect(() => {
      const dispose = webCtx.webServer.register({
        kind: 'exact',
        path: UPDATE_CHECK_PATH,
        handler: handler(ctx),
      })
      return () => { dispose() }
    }, 'unified-model-center: update check route')
  })
}
