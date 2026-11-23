/**
 * Composer status pill for Loomy models — the Loomy counterpart of the Doubao
 * plugin's rate control.
 *
 * Registered into `conversation.input.right` (a list slot, so the Doubao
 * control's cell and this one coexist; each renders only while its own
 * provider is the active model, so the two never appear together). The pill
 * shows the Loomy identifier plus the remaining-points total and opens a
 * portal popover with the points split and every model's billing rate.
 *
 * Data comes from the plugin's own read-only status route
 * (`/plugins/dsh-loomy-connect/status`) through a module-level store shared
 * by pill and popover; nothing is written back.
 *
 * @module dsh-loomy-connect/loomy-composer-control
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import * as reactDom from 'react-dom'
import { LOOMY_PROVIDER, LOOMY_STATUS_PATH } from '../status-paths.ts'
import type { LoomyWebModel, LoomyWebStatus } from '../status-paths.ts'
import { CSS, ensureLoomyComposerStyles } from './composer-css.ts'
import type { TranslateFn } from './format.ts'
import { dailyExpiryText, dailyPointsExpiry, formatNumber, formatRate, formatTime, modelName, promoLabel } from './format.ts'

/** Session projection view of one recorded model selection (host `useProjection`). */
export interface LoomySelectionView {
  provider: string
  model: string
  reasoningEffort?: string
}

/** The slice of the host's projection hook this control consumes. */
export type LoomyUseProjection =
  (key: 'modelSelection') => { next?: LoomySelectionView | null; lastUsed?: LoomySelectionView | null } | undefined

/** Inject face delivered by the registration in `client/index.tsx`. */
export interface LoomyComposerControlInjected {
  t: TranslateFn
}

/** Props the composer slot delivers: inject face plus the session standard kit. */
export interface LoomyComposerControlProps extends LoomyComposerControlInjected {
  /** Host standard prop (session scope). Absent on hosts without the projection kit. */
  useProjection?: LoomyUseProjection | undefined
  /** Host standard prop (session scope); kept for the contract, unused today. */
  sessionId?: unknown
}

/**
 * Doubao-parity id defense. The Doubao control deliberately normalizes before
 * matching (`/doubao/i` on the provider, a stripped prefix on the model) —
 * evidence that host-side selections can arrive with a `provider/` prefix or
 * stray whitespace. Mirror that here instead of trusting bare equality:
 * `selection.provider` may be `loomy` or `loomy/<model>`, and the model id the
 * same way, while the catalog ids are bare.
 */
const LOOMY_PROVIDER_TAG = new RegExp(`^${LOOMY_PROVIDER}(?:/|$)`, 'i')
const LOOMY_MODEL_PREFIX = new RegExp(`^${LOOMY_PROVIDER}/`, 'i')

/** True for `loomy` and `loomy/…` shaped provider ids. */
function isLoomyProviderId(providerId: string | undefined): boolean {
  return providerId !== undefined && LOOMY_PROVIDER_TAG.test(providerId.trim())
}

/** The model id without a possible `loomy/` prefix. */
function normalizeLoomyModelId(modelId: string): string {
  return modelId.trim().replace(LOOMY_MODEL_PREFIX, '')
}

const POLL_INTERVAL_MS = 60_000
/** Shortest time the refresh button stays visibly busy (card parity). */
const MIN_BUSY_MS = 600
/** DOM fallback probe cadence while the projection has no answer yet. */
const PROBE_INTERVAL_MS = 1_000
/** Ancestors that mark a `data-provider-id` span as a menu row, not the trigger. */
const MENU_CONTAINER_SELECTOR = '[role="menu"], [role="listbox"], [role="tooltip"]'

// --------------------------------------------------------------- status store
// Module-level snapshot shared by every mounted pill (one per conversation) so
// the fetch cadence stays one-per-window regardless of how many sessions show
// the pill. Nothing is persisted: a page reload starts from `undefined` and the
// first mount refetches.

let statusSnapshot: LoomyWebStatus | undefined
let statusInflight: Promise<void> | undefined
let statusFetchedAt = 0
/**
 * True after the most recent completed read failed. Only visible when no
 * snapshot exists at all (first load never succeeded): with an old snapshot
 * the surfaces keep showing the last known numbers plus their updated-at.
 */
let statusFetchFailed = false
const statusListeners = new Set<() => void>()

function notifyStatusListeners(): void {
  for (const listener of statusListeners) listener()
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

async function fetchStatus(force: boolean): Promise<void> {
  try {
    const response = await fetch(force ? `${LOOMY_STATUS_PATH}?refresh=1` : LOOMY_STATUS_PATH, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    })
    const value = (await response.json().catch(() => undefined)) as LoomyWebStatus | undefined
    if (response.ok && value !== undefined) {
      statusSnapshot = value
      statusFetchedAt = Date.now()
      statusFetchFailed = false
    } else {
      statusFetchFailed = true
    }
    // Failure also notifies: with no snapshot the popover must leave the
    // "Refreshing…" state instead of spinning forever.
    notifyStatusListeners()
  } catch {
    statusFetchFailed = true
    notifyStatusListeners()
  }
}

/**
 * One status read, coalesced: an in-flight request serves every caller, a
 * fresh-enough snapshot short-circuits, and `force` (the popover button)
 * bypasses the age check and makes the host re-pull Loomy's own caches. A
 * forced read REPLACES any in-flight background read — the polite fetch still
 * completes and updates the snapshot, but the forced one owns the slot, so a
 * refresh click can never be swallowed by a concurrent poll.
 */
function ensureStatus(maxAgeMs: number, force = false): Promise<void> {
  if (force) {
    const promise = fetchStatus(true).finally(() => {
      if (statusInflight === promise) statusInflight = undefined
    })
    statusInflight = promise
    return promise
  }
  if (statusInflight !== undefined) return statusInflight
  if (Date.now() - statusFetchedAt < maxAgeMs) return Promise.resolve()
  const promise = fetchStatus(false).finally(() => {
    if (statusInflight === promise) statusInflight = undefined
  })
  statusInflight = promise
  return statusInflight
}

/** React binding: snapshot, plus — while the pill is visible — a mount read and a 60s poll. */
function useLoomyStatus(active: boolean): LoomyWebStatus | undefined {
  const snapshot = useSyncExternalStore(subscribeStatus, () => statusSnapshot)
  useEffect(() => {
    // The slot component stays mounted even while the pill renders nothing
    // (another provider is active), so the fetch cadence is gated on
    // visibility: no Loomy traffic for windows not looking at Loomy.
    if (!active) return undefined
    void ensureStatus(0)
    const timer = window.setInterval(() => {
      void ensureStatus(POLL_INTERVAL_MS)
    }, POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [active])
  return snapshot
}

// ---------------------------------------------------------- active selection

/**
 * Read the trigger model off the DOM.
 *
 * The host stamps `data-provider-id` / `data-model-id` on the label wrapper
 * span of the picker trigger AND of every menu row, so menu containers are
 * excluded first; among the rest, the span inside a `button[aria-expanded]`
 * (the dropdown trigger) wins, and plain document order is the last resort.
 * Reads only — nothing here touches the host's DOM.
 */
function probeTriggerSelection(): LoomySelectionView | null {
  if (typeof document === 'undefined') return null
  let first: LoomySelectionView | null = null
  let fromTrigger: LoomySelectionView | null = null
  for (const span of document.querySelectorAll<HTMLElement>('span[data-provider-id]')) {
    if (span.closest(MENU_CONTAINER_SELECTOR) !== null) continue
    const provider = span.getAttribute('data-provider-id') ?? ''
    const model = span.getAttribute('data-model-id') ?? ''
    if (provider === '' || model === '') continue
    const found = { provider, model }
    if (first === null) first = found
    if (fromTrigger === null && span.closest('button[aria-expanded]') !== null) {
      fromTrigger = found
      break
    }
  }
  return fromTrigger ?? first
}

/**
 * The effective active model: the session projection first (`next` = the
 * pending pick or, after a request, the last-used selection), then a DOM probe
 * of the trigger for the gap the projection cannot cover — a fresh session
 * still sitting on the default model, where no selection event and no request
 * header exist yet.
 */
function useActiveSelection(useProjection: LoomyUseProjection | undefined): LoomySelectionView | null {
  const projected = useProjection?.('modelSelection')
  const projectedSelection = projected?.next ?? projected?.lastUsed ?? null
  const [observed, setObserved] = useState<LoomySelectionView | null>(null)
  useEffect(() => {
    if (projectedSelection !== null) return undefined
    const probe = () => {
      const found = probeTriggerSelection()
      setObserved(previous =>
        previous !== null && found !== null
          && previous.provider === found.provider && previous.model === found.model
          ? previous
          : found)
    }
    probe()
    const timer = window.setInterval(probe, PROBE_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [projectedSelection])
  return projectedSelection ?? observed
}

// ------------------------------------------------------------------ rendering

/** Popover anchor above-right of the trigger; same geometry as the Doubao control. */
function computePopoverCoords(anchor: HTMLElement | null): { bottom: number; right: number } {
  if (anchor === null || typeof window === 'undefined') return { bottom: 64, right: 16 }
  const rect = anchor.getBoundingClientRect()
  return {
    bottom: Math.max(12, Math.round(window.innerHeight - rect.top + 8)),
    right: Math.max(12, Math.round(window.innerWidth - rect.right)),
  }
}

/** One model-rate row of the popover; the active model is highlighted and tagged. */
function ModelRow({ model, active, t }: { model: LoomyWebModel; active: boolean; t: TranslateFn }): ReactElement {
  return (
    <div className={active ? `${CSS.row} ${CSS.rowActive}` : CSS.row} data-active={active === true || undefined}>
      <span className={CSS.model}>
        <span className={CSS.name} title={modelName(model.name)}>{modelName(model.name)}</span>
        {active ? <span className={CSS.currentTag}>{t('currentBadge')}</span> : null}
      </span>
      <span className={CSS.billing}>
        {model.rate === undefined && model.promo === undefined
          ? <span className={CSS.missing}>{t('rateUnavailable')}</span>
          : (
              <>
                {model.rate === undefined ? null : <span className={CSS.rateChip}>{formatRate(model.rate)}</span>}
                {model.promo === undefined ? null : <span className={CSS.rateChipPromo}>{promoLabel(model.promo, t)}</span>}
              </>
            )}
      </span>
    </div>
  )
}

/** Points split shown under the popover header (card tile semantics, compact). */
function PointsSplit({ status, t }: { status: Extract<LoomyWebStatus, { status: 'signed-in' }>; t: TranslateFn }): ReactElement {
  const rawUpdatedAt = status.points?.updatedAt
  const updatedMs = rawUpdatedAt === undefined ? undefined : Date.parse(rawUpdatedAt)
  return (
    <>
      <div className={CSS.pointsRow}>
        <div className={CSS.pointsTile}>
          <span className={CSS.pointsLabel}>{t('permanentPoints')}</span>
          <span className={CSS.pointsValue}>{status.points === undefined ? '--' : formatNumber(status.points.permanent)}</span>
        </div>
        <div className={CSS.pointsTile}>
          <span className={CSS.pointsLabel}>{t('dailyPoints')}</span>
          <span className={CSS.pointsValue}>{status.points === undefined ? '--' : formatNumber(status.points.daily)}</span>
        </div>
      </div>
      {status.points === undefined ? <div className={CSS.pointsMeta}>{t('pointsUnavailable')}</div> : null}
      {updatedMs === undefined || Number.isNaN(updatedMs) || status.points === undefined
        ? null
        : <div className={CSS.pointsMeta}>{t('updatedAt', { time: formatTime(updatedMs) })}</div>}
      {status.pointsError === undefined
        ? null
        : <div className={CSS.pointsMeta}>{t('pointsError', { message: status.pointsError })}</div>}
      {status.points === undefined ? null : <div className={CSS.pointsMeta}>{t('pointsSourceHint')}</div>}
      {(() => {
        const expiry = dailyExpiryText(dailyPointsExpiry(rawUpdatedAt), t)
        return expiry === undefined ? null : <div className={CSS.pointsMeta}>{expiry}</div>
      })()}
    </>
  )
}

/** Render the Loomy composer pill, or nothing while another provider is active. */
export function LoomyComposerControl(props: LoomyComposerControlProps): ReactElement | null {
  const { t, useProjection } = props
  const selection = useActiveSelection(useProjection)
  const pillVisible = isLoomyProviderId(selection?.provider)
  const status = useLoomyStatus(pillVisible)
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [coords, setCoords] = useState({ bottom: 64, right: 16 })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    ensureLoomyComposerStyles()
  }, [])

  // Spec: the popover answers with a fresh status read on open — the store
  // coalesces with any in-flight poll, so an open just after one costs nothing.
  useEffect(() => {
    if (!open) return undefined
    void ensureStatus(0)
    return undefined
  }, [open])
  // When the pill leaves (another provider picked), drop the open flag so the
  // popover never reappears without a click after switching back.
  useEffect(() => {
    if (!pillVisible) setOpen(false)
  }, [pillVisible])

  useLayoutEffect(() => {
    if (!open) return undefined
    const reposition = () => {
      setCoords(computePopoverCoords(rootRef.current))
    }
    reposition()
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target === null) return
      if (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Hook order is fixed above; from here on the component may only decide to
  // render nothing — never to skip a hook.
  if (!pillVisible || selection === null) return null

  const points = status?.status === 'signed-in' ? status.points : undefined
  const total = points === undefined ? null : points.permanent + points.daily
  const pillText = t('pillLabel', { total: total === null ? '--' : formatNumber(total) })
  const models = status?.status === 'signed-in' ? status.models ?? [] : []
  // Doubao-parity match: catalog ids are bare, the selection may carry a
  // `loomy/` prefix — either form marks the active row.
  const rawModelId = selection.model
  const normalizedModelId = normalizeLoomyModelId(rawModelId)
  const isCurrentRow = (model: LoomyWebModel): boolean => model.id === rawModelId || model.id === normalizedModelId

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true)
    const started = Date.now()
    try {
      await ensureStatus(0, true)
    } finally {
      // A reply fast enough to skip the animation reads as a dead button (card parity).
      const elapsed = Date.now() - started
      if (elapsed < MIN_BUSY_MS) await new Promise(resolve => {
        window.setTimeout(resolve, MIN_BUSY_MS - elapsed)
      })
      setRefreshing(false)
    }
  }

  const popover = (
    <div
      ref={panelRef}
      className={CSS.popover}
      role="dialog"
      aria-label={t('popoverTitle')}
      style={{ bottom: `${coords.bottom}px`, right: `${coords.right}px` }}
      onMouseDown={event => {
        // Doubao parity: pressing a button inside the popover must not steal
        // focus (which would clear the composer's selection).
        if (event.target instanceof Element && event.target.closest('button') !== null) event.preventDefault()
      }}
    >
      <div className={CSS.head}>
        <span className={CSS.title}>{t('popoverTitle')}</span>
        <button
          type="button"
          className={CSS.refresh}
          disabled={refreshing}
          onClick={() => {
            void manualRefresh()
          }}
        >
          {refreshing ? t('refreshing') : t('refresh')}
        </button>
      </div>
      {status === undefined
        ? <div className={CSS.placeholder}>{statusFetchFailed ? t('statusUnavailable') : t('refreshing')}</div>
        : status.status === 'signed-out'
          ? <div className={CSS.placeholder}>{t('signedOutHint')}</div>
          : status.status === 'error'
            ? <div className={CSS.placeholder}>{status.message}</div>
            : (
                <>
                  <PointsSplit status={status} t={t} />
                  {models.length === 0
                    ? <div className={CSS.placeholder}>{t('popoverEmpty')}</div>
                    : (
                        <div className={CSS.list}>
                          {/* Card-table ordering: chat models first, image generators last. */}
                          {models.filter(model => model.image !== true).map(model => (
                            <ModelRow
                              key={model.id}
                              model={model}
                              active={isCurrentRow(model)}
                              t={t}
                            />
                          ))}
                          {models.filter(model => model.image === true).map(model => (
                            <ModelRow
                              key={model.id}
                              model={model}
                              active={isCurrentRow(model)}
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                </>
              )}
      <div className={CSS.note}>{t('rateNote')}</div>
    </div>
  )

  return (
    <div ref={rootRef} className={CSS.control}>
      <button
        type="button"
        className={open ? `${CSS.trigger} ${CSS.triggerOpen}` : CSS.trigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('controlAria')}
        title={t('controlAria')}
        onMouseDown={event => {
          event.preventDefault()
        }}
        onClick={() => {
          setOpen(was => !was)
        }}
      >
        <span className={CSS.triggerText}>{pillText}</span>
        <span className={CSS.triggerCaret} aria-hidden="true">▾</span>
      </button>
      {open && typeof document !== 'undefined' && document.body !== null
        ? reactDom.createPortal(popover, document.body)
        : null}
    </div>
  )
}
