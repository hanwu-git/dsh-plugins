/**
 * Stylesheet for the composer status pill and its popover.
 *
 * Visual parity target is the Doubao plugin's rate control (`dbq-rate-*`):
 * same 28px pill, same fixed-position popover anchored above-right of the
 * trigger, same row/active/current-chip anatomy. Every color comes from the
 * host's `--dsw-alias-*` tokens with a literal fallback, so the surface
 * follows the active theme the same way the Doubao control does.
 *
 * The `dlc_` prefix is the plugin's existing namespace (see `card-css.ts`);
 * the dedicated tag id keeps this sheet independent of the card's, so either
 * surface can change without disturbing the other.
 */

/** Stable tag id; mirrors how the official bundles tag their own stylesheets. */
const STYLE_TAG_ID = 'dsh-loomy-connect/LoomyComposer.module.css'

/** Class names used by `LoomyComposerControl`. */
export const CSS = {
  control: 'dlc_composerControl',
  trigger: 'dlc_composerTrigger',
  triggerOpen: 'dlc_composerTriggerOpen',
  triggerText: 'dlc_composerTriggerText',
  triggerCaret: 'dlc_composerTriggerCaret',
  popover: 'dlc_composerPopover',
  head: 'dlc_composerHead',
  title: 'dlc_composerTitle',
  refresh: 'dlc_composerRefresh',
  pointsRow: 'dlc_composerPointsRow',
  pointsTile: 'dlc_composerPointsTile',
  pointsLabel: 'dlc_composerPointsLabel',
  pointsValue: 'dlc_composerPointsValue',
  pointsMeta: 'dlc_composerPointsMeta',
  list: 'dlc_composerList',
  row: 'dlc_composerRow',
  rowActive: 'dlc_composerRowActive',
  model: 'dlc_composerModel',
  name: 'dlc_composerName',
  currentTag: 'dlc_composerCurrentTag',
  billing: 'dlc_composerBilling',
  rateChip: 'dlc_composerRateChip',
  rateChipPromo: 'dlc_composerRateChipPromo',
  missing: 'dlc_composerMissing',
  note: 'dlc_composerNote',
  placeholder: 'dlc_composerPlaceholder',
} as const

const STYLESHEET = `
/* ---- trigger pill (counterpart of the Doubao rate trigger) ---- */
.dlc_composerControl{position:relative;display:inline-flex;align-items:center;flex:none}
.dlc_composerTrigger{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.25));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);font:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;outline:none;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}
@media (hover:hover){.dlc_composerTrigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,#e6e8eb)}}
.dlc_composerTriggerOpen{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,#e6e8eb)}
.dlc_composerTriggerText{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dlc_composerTriggerCaret{font-size:10px;opacity:.75}

/* ---- popover (portal to document.body, opens above-right of the pill) ----
   Deliberately wider/taller than the Doubao popover's 340x380: this one also
   carries the two-tile points split above the model table, which needs the
   extra width to keep both tile values on one line. */
.dlc_composerPopover{position:fixed;z-index:9999;width:min(360px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 96px));display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-3,#1e2127);color:var(--dsw-alias-label-primary,#e6e8eb);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.3));box-shadow:0 8px 28px rgba(0,0,0,.28);font-size:12px}
.dlc_composerHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dlc_composerTitle{font-weight:600;font-size:13px}
.dlc_composerRefresh{padding:2px 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.3));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);font:inherit;font-size:11px;cursor:pointer}
.dlc_composerRefresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,#e6e8eb)}
.dlc_composerRefresh:disabled{opacity:.6;cursor:default}

/* ---- points split (永久积分 / 每日赠送积分) ---- */
.dlc_composerPointsRow{display:flex;gap:8px}
.dlc_composerPointsTile{flex:1 1 0;min-width:0;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.25));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06))}
.dlc_composerPointsLabel{display:block;color:var(--dsw-alias-label-secondary,#9aa0a6);font-size:11px;line-height:1.4}
.dlc_composerPointsValue{display:block;margin-top:2px;font-size:16px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}
.dlc_composerPointsMeta{color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:11px;line-height:1.4}

/* ---- model rate rows ---- */
.dlc_composerList{display:flex;flex-direction:column;gap:4px;overflow-y:auto;max-height:250px}
.dlc_composerRow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:var(--dsw-radius-sm,6px)}
.dlc_composerRowActive{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.dlc_composerModel{display:inline-flex;align-items:center;gap:6px;min-width:0}
.dlc_composerName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlc_composerCurrentTag{flex:none;font-size:10px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4a9eff) 14%,transparent);color:var(--dsw-alias-state-business-primary,#4a9eff)}
.dlc_composerBilling{display:inline-flex;align-items:center;gap:6px;flex:none}
/* Rate chips mirror the Doubao control's color semantics: the multiplier is a
   caution-toned figure, the giveaway is a dashed accent. */
.dlc_composerRateChip{display:inline-flex;align-items:center;border-radius:999px;padding:0 6px;font-size:11px;line-height:16px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-state-warn-primary,#e0a838);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e0a838) 12%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e0a838) 32%,transparent)}
.dlc_composerRateChipPromo{color:var(--dsw-alias-state-error-primary,#ff7b72);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff7b72) 10%,transparent);border-style:dashed;border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff7b72) 45%,transparent)}
.dlc_composerMissing{color:var(--dsw-alias-label-tertiary,#9aa0a6)}

/* ---- footer note and placeholders ---- */
.dlc_composerNote{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-tertiary,#9aa0a6);border-top:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.2));padding-top:6px}
.dlc_composerPlaceholder{color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:12px;line-height:1.5}
`

/**
 * Install the composer stylesheet once per document.
 *
 * Idempotent like `card-css.ts`: the `data-plugin-css` probe keeps the tag
 * unique, so calling this from the control's mount effect is safe no matter
 * how many Loomy pills mount across sessions.
 */
export function ensureLoomyComposerStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-loomy-connect'
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = STYLESHEET
  document.head.appendChild(tag)
}
