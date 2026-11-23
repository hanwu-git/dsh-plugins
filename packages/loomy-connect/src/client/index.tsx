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
export const inject = ['slots', 'locale', 'configForms']

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

    // The selected chat account lives in this plugin's config section. Expose a
    // narrow read/write face to the card so picking an account sends every later
    // chat request as that account. The host half reads the same section through
    // its settings source, so the change takes effect without a restart.
    let activeAccount: () => string | undefined = () => undefined
    let setActiveAccount: (userId: string) => void = () => undefined
    try {
      // configForms is a recent Client service and is not yet in the published
      // Context typings; access it through a narrow structural cast.
      type ConfigForm = {
        getSnapshot(): { value?: unknown }
        subscribe(listener: () => void): () => void
        mutate(ops: { op: string; path: string[]; value: unknown }[]): void
      }
      const configForms = (ctx as unknown as { configForms?: { get(ns: string): ConfigForm } }).configForms
      if (configForms === undefined) throw new Error('configForms service not present')
      const form = configForms.get('loomy')
      const read = () => {
        const value = (form.getSnapshot().value || {}) as { activeUserId?: string }
        activeAccount = () => value.activeUserId
      }
      read()
      ctx.effect(() => form.subscribe(read), 'dsh-loomy-connect: active account subscribe')
      setActiveAccount = (userId: string) => {
        form.mutate([{ op: 'set', path: ['activeUserId'], value: userId }])
      }
    } catch (error: unknown) {
      console.error('[dsh-loomy-connect] configForms unavailable; account picker is read-only:', error)
    }

    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'loomy',
      priority: 30,
      inject: (): LoomyPluginCardInjected => ({ t, activeAccount, setActiveAccount }),
    }, LoomyPluginCard))

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
