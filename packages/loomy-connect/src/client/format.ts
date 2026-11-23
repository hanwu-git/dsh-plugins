/**
 * Formatting helpers shared by the plugin card and the composer control.
 *
 * Both surfaces render the same underlying facts — model names whose tail
 * carries the billing tag, rates Loomy prints as `x3.0`, a free-giveaway
 * promo label, points balances — so the rules live here once. The card and
 * the composer control import from this module instead of keeping private
 * copies that would drift.
 *
 * @module dsh-loomy-connect/client-format
 */

import type { LoomySettingsKey } from './locales.ts'

/** The translate shape both surfaces receive through their inject face. */
export type TranslateFn = (key: LoomySettingsKey, params?: Record<string, unknown>) => string

/** Locale-aware thousands grouping: 12345 → `12,345`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value)
}

/** Localized timestamp for an epoch-milliseconds value. */
export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
}

/**
 * The rate or promo Loomy appends to a model name — `…（x3.0）`, `…（限时免费）`.
 *
 * Mirrors the tags `catalog.ts` parses, anchored to the end so a name that
 * legitimately contains parentheses keeps them.
 */
const NAME_TAG = /[（(]\s*(?:x\s*[0-9]+(?:\.[0-9]+)?|[^（）()]*免费[^（）()]*)\s*[）)]\s*$/u

/** The model name without the rate tag, which the surfaces show in their own column. */
export function modelName(name: string): string {
  return name.replace(NAME_TAG, '').trim()
}

/** Loomy's own spelling, one decimal: 3 → `x3.0`, 3.3 → `x3.3`. */
export function formatRate(rate: number): string {
  return `x${Number.isInteger(rate) ? rate.toFixed(1) : rate}`
}

/**
 * Localize the promotional label Loomy prints, falling back to its own wording
 * for anything this plugin has no translation for yet.
 */
export function promoLabel(promo: string, t: TranslateFn): string {
  return /免费/u.test(promo) ? t('badgeLimitedFree') : promo
}

/** Loomy daily-gift points expire three days after the daily sign-in grants them. */
export const DAILY_POINTS_TTL_DAYS = 3

/** Derived expiry of the daily gift, for display in both points surfaces. */
export interface DailyPointsExpiry {
  /** Epoch milliseconds of the expiry instant. */
  expiresAt: number
  /** Whole days left, clamped to zero once the deadline passes. */
  daysLeft: number
  /** True when the deadline has passed. */
  expired: boolean
  /** Localized calendar date of the expiry, e.g. `11月25日`. */
  dateLabel: string
}

/**
 * Derive the daily gift's expiry from the points snapshot's `updatedAt`.
 *
 * Loomy refills the 5000 daily points on each sign-in and stamps that refresh
 * into `updatedAt`; it is the closest public proxy for "when they were
 * granted". The gift is valid for three days from that instant — the user's
 * stated rule ("每天送的5000积分3日内到期"). `now` is injected so tests can
 * pin the clock; callers leave it at the wall clock.
 */
export function dailyPointsExpiry(updatedAt: string | undefined, now: number = Date.now()): DailyPointsExpiry | undefined {
  if (updatedAt === undefined) return undefined
  const grantedMs = Date.parse(updatedAt)
  if (Number.isNaN(grantedMs)) return undefined
  const expiresAt = grantedMs + DAILY_POINTS_TTL_DAYS * 24 * 60 * 60 * 1000
  const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)))
  const dateLabel = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' }).format(new Date(expiresAt))
  return { expiresAt, daysLeft, expired: now >= expiresAt, dateLabel }
}

/** Localize the daily-gift expiry into one short line shared by card and pill. */
export function dailyExpiryText(expiry: DailyPointsExpiry | undefined, t: TranslateFn): string | undefined {
  if (expiry === undefined) return undefined
  if (expiry.expired) return t('dailyExpiryExpired', { date: expiry.dateLabel })
  if (expiry.daysLeft <= 0) return t('dailyExpiryToday', { date: expiry.dateLabel })
  return t('dailyExpiry', { date: expiry.dateLabel, days: expiry.daysLeft })
}
