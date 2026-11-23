/**
 * Slot contract for the composer toolbar's right-side list slot.
 *
 * The slot is declared at runtime by the conversation UI's composer bar entry
 * (`kind: 'list'`, `scope: 'session'`; standard props include `sessionId` and
 * `useProjection`). Its own type package is not among this plugin's type
 * dependencies, so the entry is merged here from the plugin side — the same
 * "type home on the consumer" pattern
 * `@deepseek-ai/dsh-client-ui-settings-plugins` documents for
 * `settings.plugin.item`. Compile-time only: the runtime declaration comes
 * from the host, and `ctx.slots.inject` waits for it before attaching.
 */

import '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Compact controls before the composer submit action (host: ui-conversation). */
    'conversation.input.right': {
      kind: 'list'
      scope: 'session'
    }
    /**
     * Left-nav page in the Settings panel (host: ui-settings-shell). Keyed by an
     * id the registrant owns; the shell supplies the panel chrome.
     */
    'settings.section': {
      kind: 'list'
      scope: 'global'
    }
    /** The nav glyph for one `settings.section` row, rendered per row id. */
    'settings.section.icon': {
      kind: 'keyed'
      scope: 'global'
    }
  }
}

/**
 * If a future DSH release ships this plugin's type home for
 * `conversation.input.right` (e.g. via a `dsh-client-ui-conversation` type
 * package added to devDependencies), DELETE this file: a same-shape entry
 * merges harmlessly, but a diverging shape becomes a compile error here.
 */

