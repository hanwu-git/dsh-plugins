/** Browser half: Loomy account status inside Plugin configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LoomyPluginCard } from './LoomyPluginCard.tsx'
import type { LoomyPluginCardInjected } from './LoomyPluginCard.tsx'
import { LoomyComposerControl } from './LoomyComposerControl.tsx'
import type { LoomyComposerControlInjected } from './LoomyComposerControl.tsx'
import { en, zh } from './locales.ts'
import type { LoomySettingsKey } from './locales.ts'
import { LOOMY_STATUS_PATH } from '../status-paths.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Loomy plugin card copy. */
    'settings.loomy': LoomySettingsKey
  }
}

/** Stable browser-plugin name. */
export const name = 'dsh-loomy-connect-client'

/**
 * Client services required by the Plugin configuration contribution. The
 * `slots` registry lives in `@deepseek-ai/dsh-client-ui-renderer`, `locale` in
 * `@deepseek-ai/dsh-client-locale`, and the `settings.plugin.item` slot is
 * declared by `@deepseek-ai/dsh-client-ui-settings-plugins`. All three are
 * named in the package's `dsh.client.inject` list, so cordis has activated
 * them before this plugin's fiber starts.
 */
// `configForms` is deliberately NOT a hard inject dependency: if the host does
// not expose that service, a hard dependency would abort this plugin's fiber
// before apply() runs and the whole settings card would disappear. We fetch it
// optionally via ctx.get() below and fall back gracefully.
export const inject = ['slots', 'locale']

/**
 * Register card copy and the Loomy card under Plugin configuration.
 *
 * The body is wrapped so a DSH slot-API breaking change degrades to a
 * `console.error` instead of throwing into the DSH loader and raising the red
 * "Failed to load plugins" banner. The host provider keeps working regardless:
 * the `loomy` model channel is unaffected by a card that cannot mount.
 */
export function apply(ctx: ClientContext): void {
  try {
    const namespace = 'settings.loomy'
    ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-loomy-connect: settings copy')
    const t = ctx.locale.bind(namespace) as LoomyPluginCardInjected['t']

    // The selected chat account is persisted by the Host, not by this bundle:
    // the account picker POSTs to the plugin's own status route, which writes the
    // value through the profile's config editor. Reading the current choice comes
    // back in the status document (`activeUserId`), so no Client service is
    // required and the feature survives a host without `configForms`.
    let activeAccount: () => string | undefined = () => undefined
    let setActiveAccount: (userId: string) => void = (userId: string) => {
      void fetch(LOOMY_STATUS_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId }),
      }).catch(() => undefined)
    }

    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'loomy',
      priority: 30,
      inject: (): LoomyPluginCardInjected => ({ t, activeAccount, setActiveAccount }),
    }, LoomyPluginCard))

    // Standalone Settings page (the left nav row), matching the connector
    // plugins' layout. `settings.section` drives the nav row; the shell renders
    // `settings.section.icon` with `{ only: row.id }`, so the glyph's cell is
    // only meaningful while the page's id exists — hence one injection that
    // registers both. `surface: 'settings'` tells the component the shell owns
    // the panel chrome, so it drops its own fold header.
    try {
      ctx.slots.inject('settings.section', () => {
        const disposers: (() => void)[] = []
        disposers.push(ctx.slots.register({
          name: 'settings.section',
          id: 'loomy',
          order: 36,
          label: () => t('navPanel'),
          locale: namespace,
          inject: (): LoomyPluginCardInjected => ({ t, activeAccount, setActiveAccount, surface: 'settings' }),
        }, LoomyPluginCard))
        try {
          const iconDisposer = ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
            name: 'settings.section.icon',
            key: 'loomy',
            locale: namespace,
          }, ({ size, active }: { size?: number; active?: boolean }) => {
            const edge = typeof size === 'number' ? size : 16
            return (
              <svg
                width={edge} height={edge} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
                aria-hidden="true"
                style={{ display: 'block', opacity: active === false ? 0.75 : 1 }}
              >
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="9.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="14.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
                <path d="M9 15c1.6 1.1 4.4 1.1 6 0" />
              </svg>
            )
          }))
          if (typeof iconDisposer === 'function') disposers.push(iconDisposer)
        } catch (error: unknown) {
          console.error('[dsh-loomy-connect] settings nav icon failed to register (page unaffected):', error)
        }
        return () => {
          for (const dispose of disposers) {
            try { dispose() } catch { /* already disposed */ }
          }
        }
      })
    } catch (error: unknown) {
      console.error('[dsh-loomy-connect] settings section failed to register (host provider unaffected):', error)
    }

    // Composer status pill — the Loomy counterpart of the Doubao rate control.
    // `conversation.input.right` is a list slot, so this cell coexists with the
    // Doubao plugin's; each renders only while its own provider is the active
    // model, so the two never appear together. `sessionId` / `useProjection`
    // are the host's session standard props (not an inject face) — the
    // component reads them off its props. Own try/catch: a slot API change
    // must degrade to a console.error, not take down the card above.
    try {
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right',
        id: 'loomy-status',
        order: 90,
        inject: (): LoomyComposerControlInjected => ({ t }),
      }, LoomyComposerControl))
    } catch (error: unknown) {
      console.error('[dsh-loomy-connect] conversation.input.right failed to register (host provider unaffected):', error)
    }
  } catch (error: unknown) {
    // Degrade silently on the page: the host provider still serves models.
    console.error('[dsh-loomy-connect] client card failed to load (host provider unaffected):', error)
  }
}
