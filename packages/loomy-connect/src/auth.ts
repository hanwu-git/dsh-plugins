/** Read Loomy's desktop sign-in state without ever modifying it. */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { extractLevelDbRecords, readLevelDbTexts } from './leveldb.ts'
import { defaultLoomyLocalStorageDir } from './points.ts'

export const LOOMY_AUTH_FILE_ENV = 'LOOMY_AUTH_FILE'
export const LOOMY_CONFIG_FILE_ENV = 'LOOMY_CONFIG_FILE'

/**
 * The `localStorage` key Loomy's renderer keeps the sign-in session under.
 *
 * Only the Windows build relies on it: there Loomy keeps the session in the
 * renderer's own storage and never writes the `auth-session.json` sidecar the
 * macOS build leaves in its Electron data dir.
 */
export const LOOMY_AUTH_SESSION_KEY = 'loomy-auth-session'

export interface LoomyCredential {
  session: string
  userId: string
  /** Already-masked phone number Loomy stores alongside the session, for display only. */
  maskedPhone?: string
}

/** Loomy's OpenCode-style config home: `~/.config` on macOS. */
function configHome(): string { return join(homedir(), '.config') }

/**
 * Candidate locations of Loomy's desktop sign-in session, most-likely platform
 * first. Loomy is an Electron app, so its data dir follows the platform
 * convention: macOS `~/Library/Application Support/loomy`, Windows
 * `%APPDATA%/loomy`. Searching every candidate keeps the plugin working
 * whichever of the two it was installed on.
 */
export function defaultLoomyAuthCandidates(): string[] {
  const appData = process.env.APPDATA
  const candidates = [join(homedir(), 'Library', 'Application Support', 'loomy', 'auth-session.json')]
  if (appData !== undefined) candidates.push(join(appData, 'loomy', 'auth-session.json'))
  return candidates
}

/** The first existing auth file, or the primary platform default when none yet. */
export function defaultLoomyAuthPath(): string {
  for (const candidate of defaultLoomyAuthCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return defaultLoomyAuthCandidates()[0]
}

/**
 * Candidate locations of Loomy's generated OpenCode model config, most-likely
 * platform first. macOS uses `~/.config/loomy-opencode`; on Windows the same
 * layout lands under `%APPDATA%/loomy-opencode`.
 */
export function defaultLoomyConfigCandidates(): string[] {
  const appData = process.env.APPDATA
  const candidates = [join(configHome(), 'loomy-opencode', 'opencode.json')]
  if (appData !== undefined) candidates.push(join(appData, 'loomy-opencode', 'opencode.json'))
  return candidates
}

/** The first existing config file, or the primary platform default when none yet. */
export function defaultLoomyConfigPath(): string {
  for (const candidate of defaultLoomyConfigCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return defaultLoomyConfigCandidates()[0]
}

/**
 * Mask an 11-digit mainland-China phone for display: `132****2249`.
 *
 * The macOS build stores `phone` already masked; the Windows build keeps the
 * raw number there and the masked form in a separate field. Masking here —
 * rather than trusting either field — keeps one full number off the card.
 */
function maskPhone(value: string): string {
  if (value.includes('*')) return value
  if (/^\d{11}$/.test(value)) return `${value.slice(0, 3)}****${value.slice(7)}`
  if (value.length <= 4) return value
  return `${value.slice(0, Math.ceil(value.length / 3))}****${value.slice(-Math.ceil(value.length / 4))}`
}

export function parseLoomyAuth(text: string): LoomyCredential | undefined {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const record = value as Record<string, unknown>
    const session = typeof record.session === 'string' ? record.session.trim() : ''
    const userId = typeof record.userid === 'string' ? record.userid.trim() : ''
    if (session === '' || userId === '') return undefined
    const string = (field: unknown): string => typeof field === 'string' ? field.trim() : ''
    // Prefer an explicitly masked field; fall back to whatever `phone` holds.
    const phone = string(record.maskedPhone) || string(record.phone)
    return {
      session,
      userId,
      ...phone === '' ? {} : { maskedPhone: maskPhone(phone) },
    }
  } catch { return undefined }
}

/** When Loomy last signed the session in, or -Infinity when it does not say. */
function loggedInAtOf(raw: string): number {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return -Infinity
    const at = (value as Record<string, unknown>).loggedInAt
    if (typeof at !== 'string') return -Infinity
    const parsed = Date.parse(at)
    return Number.isNaN(parsed) ? -Infinity : parsed
  } catch { return -Infinity }
}

/**
 * Every session cached in one LevelDB log, oldest first.
 *
 * The log is append-only, so several records can share the key; `loggedInAt`
 * decides which is current rather than file order.
 */
export function extractLoomyAuthSessions(text: string): LoomyCredential[] {
  const found: { credential: LoomyCredential; time: number }[] = []
  for (const raw of extractLevelDbRecords(text, LOOMY_AUTH_SESSION_KEY)) {
    const credential = parseLoomyAuth(raw)
    if (credential !== undefined) found.push({ credential, time: loggedInAtOf(raw) })
  }
  found.sort((a, b) => a.time - b.time)
  return found.map(entry => entry.credential)
}

/**
 * Every distinct account Loomy has signed in on this machine, deduplicated by
 * `userId` and ordered by the newest login first. The renderer's LevelDB log is
 * append-only, so the same account can appear several times; only its latest
 * session matters. This is the list the settings card uses to let the user pick
 * which account a chat request should run as.
 */
export async function readAllLoomyCredentials(dir?: string): Promise<LoomyCredential[]> {
  const path = dir ?? process.env.LOOMY_LOCAL_STORAGE_DIR ?? defaultLoomyLocalStorageDir()
  try {
    const byUser = new Map<string, LoomyCredential>()
    for (const text of await readLevelDbTexts(path)) {
      // extractLoomyAuthSessions returns oldest-first, so a later record for
      // the same userId naturally overwrites the earlier one.
      for (const credential of extractLoomyAuthSessions(text)) byUser.set(credential.userId, credential)
    }
    return [...byUser.values()].reverse()
  } catch { return [] }
}

/** The newest session in Loomy's localStorage, or undefined when there is none. */
export async function readLoomySessionFromStorage(dir?: string): Promise<LoomyCredential | undefined> {
  return (await readAllLoomyCredentials(dir))[0]
}

/**
 * Resolve the credential a chat request should use.
 *
 * `activeUserId` is the account chosen in the settings card. When it is set and
 * that account is still cached, use it; otherwise fall back to the newest
 * signed-in account so a stale preference can never leave the plugin without a
 * credential. Points stay on Loomy's own current view (the card reads the
 * renderer's cache) — this function only decides which session sends requests.
 */
export async function readLoomyCredentialFor(activeUserId: string | undefined, authFile?: string): Promise<LoomyCredential> {
  if (activeUserId !== undefined && activeUserId.trim() !== '') {
    const accounts = await readAllLoomyCredentials()
    const picked = accounts.find(account => account.userId === activeUserId.trim())
    if (picked !== undefined) return picked
  }
  return readLoomyCredential(authFile)
}

export async function readLoomyCredential(authFile?: string): Promise<LoomyCredential> {
  const override = authFile ?? process.env[LOOMY_AUTH_FILE_ENV]
  const path = override ?? defaultLoomyAuthPath()
  const text = await readFile(path, 'utf8').catch(() => undefined)
  if (text !== undefined) {
    const credential = parseLoomyAuth(text)
    if (credential !== undefined) return credential
    // A present-but-unusable file is a misconfiguration worth reporting as such.
    if (override !== undefined) throw new Error(`Loomy sign-in file is not usable: ${path}`)
  }
  // Windows never writes the sidecar file; fall back to the renderer's own copy.
  const stored = await readLoomySessionFromStorage()
  if (stored !== undefined) return stored
  throw new Error('Loomy is not signed in. Sign in through the Loomy desktop app first.')
}
