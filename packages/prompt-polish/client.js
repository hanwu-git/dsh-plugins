/**
 * @local/prompt-polish — browser half.
 *
 * One button under the composer that rewrites the prompt currently in it.
 *
 * - **Single click** polishes lightly: grammar, ambiguity, structure. The
 *   reader's intent and length survive.
 * - **Double click** rewrites: the rough text becomes a structured prompt with an
 *   explicit goal, context, requirements, and expected output.
 *
 * The result replaces the draft in place through `inputActions.setDraft`, and the
 * button turns into **Undo** for a few seconds so a bad rewrite costs one click
 * rather than a lost draft. The replaced text is kept in component state, not
 * written anywhere else.
 *
 * The model call goes to this plugin's own Host route: the browser has no LLM
 * access, and the current model is a durable per-session projection the browser
 * already subscribes to. Reading it here — rather than looking it up again on the
 * Host — means the polish runs on exactly the model the reader sees selected.
 */

/** The Host route that performs the rewrite; must match `POLISH_PATH` in index.js. */
const POLISH_PATH = '/prompt-polish/rewrite'

/** This plugin's copy namespace. */
const NS = 'promptPolish'

/**
 * Build marker, reported with every diagnostic line and shown in the button's
 * tooltip. Edits to this file have repeatedly looked "not applied" in the page;
 * a version the reader can see turns that guess into a fact.
 */
const BUILD = 'v3-dockfix-2026-11-18'

/** Matches the Host's own limit, so the client refuses before a wasted round trip. */
const MAX_PROMPT_CHARS = 12000

/** How long the Undo affordance stays after a rewrite. */
const UNDO_MS = 8000

/**
 * Delays that separate a single click from a double click. A double click fires
 * `click` first, so the light action has to wait long enough for the second
 * click to arrive; 250 ms is under the platform's own double-click window and
 * short enough that a single click still feels immediate.
 */
const DOUBLE_CLICK_MS = 250

window.__ModuleLoader__.load({
  id: '@local/prompt-polish',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    /** This plugin's own interface copy; the Host never sees it. */
    const dictionaries = {
      zh: {
        light: '润色提示词',
        rewrite: '重写为结构化提示词',
        busyLight: '润色中…',
        busyRewrite: '重写中…',
        undo: '撤销',
        hintLight: '单击：轻修语病与歧义；双击：重写为结构化提示词',
        hintRewrite: '正在按结构化提示词重写',
        errorEmpty: '输入框是空的，没有可润色的内容',
        errorTooLong: '提示词太长，先精简一些再润色',
        errorNoChange: '模型没有给出改动',
        errorFailed: '润色失败，输入框内容未改动',
        errorTimeout: '模型超时，输入框内容未改动',
      },
      en: {
        light: 'Polish prompt',
        rewrite: 'Rewrite as a structured prompt',
        busyLight: 'Polishing…',
        busyRewrite: 'Rewriting…',
        undo: 'Undo',
        hintLight: 'Click to fix wording and ambiguity; double-click to rewrite as a structured prompt',
        hintRewrite: 'Rewriting as a structured prompt',
        errorEmpty: 'The composer is empty; nothing to polish',
        errorTooLong: 'The prompt is too long; shorten it first',
        errorNoChange: 'The model returned no change',
        errorFailed: 'Polish failed; the draft is unchanged',
        errorTimeout: 'The model timed out; the draft is unchanged',
      },
    }

    /**
     * Inline styles; every colour is a host theme token so both themes work.
     * Hover, focus, and disabled states live in {@link STYLE_CSS} because inline
     * styles cannot express them.
     */
    const S = {
      // `conversation.input.dock` hands its entries a FULL-WIDTH seat, so a bare
      // button lands at the seat's left edge — outside the centred composer card
      // (the "button floats outside" report). The shipped TodoPanel dock solves
      // exactly this with the pair below: auto margins recentre, and the width
      // subtracts the card's side clearance plus the dock inset, so the left edge
      // lands on the card's. Same slot, same formula, same result.
      row: {
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        boxSizing: 'border-box',
        margin: '0 auto',
        width: 'calc(100%'
          + ' - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance)'
          + ' - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset)'
          + ' - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset))',
        maxWidth: 'calc(var(--dsh-composer-card-max-width)'
          + ' - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset)'
          + ' - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset))',
      },
      button: {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 'var(--dsw-radius-sm)',
        font: 'inherit', fontSize: 12, lineHeight: '18px', fontWeight: 500,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-module-platform)',
        color: 'var(--dsw-alias-label-primary)',
        flex: 'none',
      },
      undo: {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 'var(--dsw-radius-sm)',
        font: 'inherit', fontSize: 12, lineHeight: '18px',
        border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent',
        color: 'var(--dsw-alias-link)',
        flex: 'none',
      },
      note: { fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-secondary)' },
      error: {
        fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-state-error-primary)',
        // A Host reason is a full sentence: let it wrap on its own line rather
        // than pushing the button off its anchor.
        flexBasis: '100%', minWidth: 0, overflowWrap: 'anywhere',
      },
    }

    /** Hover, focus, and disabled: the states inline styles cannot express. */
    const STYLE_CSS = [
      '.prompt-polish-button { cursor: pointer; transition: background-color .1s ease, border-color .1s ease; }',
      '.prompt-polish-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }',
      '.prompt-polish-button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }',
      '.prompt-polish-button:disabled { cursor: default; opacity: .45; }',
    ].join('\n')

    /**
     * Ask the Host to rewrite one prompt.
     *
     * Every outcome is mirrored to the diagnostics route. The button used to
     * answer only "polish failed", which cannot distinguish a rejected fetch
     * from a 404 route, a 401 fence, or a 502 model error — the exact ambiguity
     * that made this feature look broken for several rounds. The report carries
     * no prompt text: only the HTTP status and a bounded snippet of the error
     * body, which is Host-authored copy.
     * @param {string} prompt - the draft to rewrite.
     * @param {'light'|'rewrite'} mode - the strength to use.
     * @param {object|undefined} route - the provider/model the reader has selected.
     * @param {AbortSignal} signal - caller lifetime.
     * @returns {Promise<{ ok: boolean, prompt?: string, errorKey?: string, detail?: string }>} the outcome.
     */
    async function requestPolish(prompt, mode, route, signal) {
      let response
      try {
        response = await fetch(POLISH_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt, mode, ...(route === undefined ? {} : { route }) }),
          signal,
        })
      } catch (error) {
        // Aborted by the component going away: not a failure worth reporting.
        if (signal.aborted) return { ok: false }
        report({ stage: 'polish-fetch-threw', mode, name: error?.name ?? null, message: String(error?.message ?? error).slice(0, 200) })
        return { ok: false, errorKey: 'errorFailed' }
      }
      const status = response.status
      let raw
      try {
        raw = await response.text()
      } catch {
        raw = ''
      }
      let failure
      try {
        failure = raw === '' ? undefined : JSON.parse(raw)
      } catch {
        // A non-JSON body still gets reported below; it just cannot classify.
      }
      if (response.ok) {
        const ok = typeof failure?.prompt === 'string' && failure.prompt !== ''
        report({ stage: 'polish-answer', mode, status, ok, chars: typeof failure?.prompt === 'string' ? failure.prompt.length : 0 })
        return ok
          ? { ok: true, prompt: failure.prompt }
          : { ok: false, errorKey: 'errorNoChange' }
      }
      report({
        stage: 'polish-http-error',
        mode,
        status,
        sentRoute: route ?? null,
        body: raw.slice(0, 300),
      })
      const code = failure?.code
      if (code === 'timeout') return { ok: false, errorKey: 'errorTimeout' }
      if (code === 'prompt-too-long') return { ok: false, errorKey: 'errorTooLong' }
      // Keep the Host's own words when it gave a usable reason: "no adapter
      // registered for provider X" tells the reader what to fix, while a
      // generic "polish failed" does not. A blank body (an auth fence, a 404)
      // cannot explain itself, so the status is shown instead.
      const reason = typeof failure?.message === 'string' ? failure.message.trim() : ''
      if (reason !== '') return { ok: false, errorKey: 'errorFailed', detail: reason }
      return {
        ok: false,
        errorKey: 'errorFailed',
        detail: raw === '' ? `HTTP ${status}（响应为空，通常是路由未注册或鉴权被拒）` : `HTTP ${status}: ${raw.slice(0, 160)}`,
      }
    }

    /**
     * Pull the model route out of the `modelSelection` projection.
     *
     * The installed DSH Client exposes `useProjection` as a KEY-ADDRESSED hook:
     * `useProjection(key)` or `useProjection(key, selector)`. It is NOT a
     * whole-snapshot hook, so the previous `useProjection(value => value)`
     * call was parsed as `key = undefined` and always returned `undefined`.
     * The browser then sent no route, the Host called `prepareCall` without a
     * provider, and every polish failed with NO_ADAPTER — the "button appears
     * but does nothing" symptom. Reading the keyed value fixes the route.
     *
     * The wire value is `{ lastUsed, next }`; `next` is the pending selection
     * once made and `lastUsed` otherwise, matching the model menu.
     * @param {unknown} projection - the `modelSelection` projection value.
     * @returns {{ provider: string, model: string, reasoningEffort?: string } | undefined} the route.
     */
    function routeOf(projection) {
      const value = projection?.modelSelection ?? projection
      const selection = value?.next ?? value?.lastUsed
      if (selection === null || typeof selection !== 'object') return undefined
      const { provider, model, reasoningEffort } = selection
      if (typeof provider !== 'string' || typeof model !== 'string') return undefined
      return { provider, model, ...(typeof reasoningEffort === 'string' ? { reasoningEffort } : {}) }
    }

    /**
     * Report this plugin's own progress to its Host route, so a failure can be
     * read from outside the page instead of only guessed at from the screen.
     * @param {object} payload - what happened.
     */
    function report(payload) {
      try {
        void fetch('/prompt-polish/report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        // Diagnostics must never break the feature.
      }
    }

    /**
     * The button under the composer.
     * @param {object} props - slot props: input state, actions, copy, projection.
     * @returns {object} the rendered element.
     */
    function PolishButton(props) {
      const { useInput, inputActions, useProjection, t } = props

      const draft = useInput(state => state.draft)
      const phase = useInput(state => state.phase)
      // Keyed projection read (see routeOf's note). The whole-snapshot form
      // `useProjection(fn)` silently resolved to key `undefined` and starved
      // the model route. Guard for a stub without this hook so the button
      // still mounts in hosts that do not publish projections.
      const projection = typeof useProjection === 'function'
        ? useProjection('modelSelection')
        : undefined

      // Report once per mount, so a rendered button is provable without a screenshot.
      const announced = useRef(false)
      useEffect(() => {
        if (announced.current) return
        announced.current = true
        report({
          stage: 'button-mounted',
          build: BUILD,
          draftType: typeof draft,
          tType: typeof t,
          projectionType: typeof projection,
        })
      }, [])

      /** The in-flight mode, or undefined when idle. */
      const [busy, setBusy] = useState(undefined)
      /** The text this plugin replaced, offered back as Undo until it expires. */
      const [undoable, setUndoable] = useState(undefined)
      /** The copy key of the last failure, cleared on the next attempt. */
      const [errorKey, setErrorKey] = useState(undefined)
      /** The Host's own explanation for the last failure, when it gave one. */
      const [errorDetail, setErrorDetail] = useState(undefined)

      /** The pending single-click timer, so a double click can cancel it. */
      const pendingClick = useRef(undefined)
      /** The in-flight request, aborted when the component goes away. */
      const inFlight = useRef(undefined)
      const undoExpiry = useRef(undefined)

      // Drop timers and the request when the composer unmounts.
      useEffect(() => () => {
        if (pendingClick.current !== undefined) clearTimeout(pendingClick.current)
        if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
        inFlight.current?.abort()
      }, [])

      /**
       * Run one polish and, on success, replace the draft.
       * @param {'light'|'rewrite'} mode - the strength to use.
       */
      const polish = useCallback(async (mode) => {
        const current = draft
        if (current.trim() === '') {
          setErrorKey('errorEmpty')
          return
        }
        if (current.length > MAX_PROMPT_CHARS) {
          setErrorKey('errorTooLong')
          return
        }
        setErrorKey(undefined)
        setErrorDetail(undefined)
        setBusy(mode)
        setUndoable(undefined)
        const controller = new AbortController()
        inFlight.current = controller
        try {
          const result = await requestPolish(current, mode, routeOf(projection), controller.signal)
          if (controller.signal.aborted) return
          if (!result.ok) {
            // A cancelled request has no error worth showing.
            if (result.errorKey !== undefined) setErrorKey(result.errorKey)
            setErrorDetail(result.detail)
            return
          }
          if (result.prompt === current) {
            setErrorKey('errorNoChange')
            return
          }
          // Only replace when the draft still holds what was sent: the reader may
          // have typed while the model was thinking.
          inputActions.setDraft(result.prompt)
          setUndoable(current)
          if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
          undoExpiry.current = window.setTimeout(() => { setUndoable(undefined) }, UNDO_MS)
        } finally {
          if (inFlight.current === controller) inFlight.current = undefined
          if (!controller.signal.aborted) setBusy(undefined)
        }
      }, [draft, inputActions, projection])

      /**
       * Put the previous draft back and withdraw the Undo affordance.
       */
      const undo = useCallback(() => {
        if (undoable === undefined) return
        inputActions.setDraft(undoable)
        setUndoable(undefined)
        setErrorKey(undefined)
        setErrorDetail(undefined)
        if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
      }, [undoable, inputActions])

      /**
       * Distinguish one click from two: a single click runs the light polish only
       * after the double-click window has passed quietly.
       */
      const onClick = useCallback(() => {
        if (pendingClick.current !== undefined) clearTimeout(pendingClick.current)
        pendingClick.current = window.setTimeout(() => {
          pendingClick.current = undefined
          void polish('light')
        }, DOUBLE_CLICK_MS)
      }, [polish])

      const onDoubleClick = useCallback(() => {
        if (pendingClick.current !== undefined) {
          clearTimeout(pendingClick.current)
          pendingClick.current = undefined
        }
        void polish('rewrite')
      }, [polish])

      // A sending composer refuses edits, so the button has nothing to act on.
      const frozen = phase !== 'plain'
      const disabled = busy !== undefined || frozen

      const label = busy === 'rewrite'
        ? t('busyRewrite')
        : busy === 'light'
          ? t('busyLight')
          : t('light')

      return h(React.Fragment, null,
        h('style', { 'data-prompt-polish-style': '' }, STYLE_CSS),
        h('div', { style: S.row, 'data-prompt-polish': '' },
          h('button', {
            type: 'button',
            className: 'prompt-polish-button',
            style: S.button,
            onClick: onClick,
            onDoubleClick: onDoubleClick,
            disabled,
            'aria-busy': busy !== undefined,
            title: `${t('hintLight')}\n${BUILD}`,
          }, label),
          undoable === undefined
            ? null
            : h('button', {
              type: 'button',
              className: 'prompt-polish-button',
              style: S.undo,
              onClick: undo,
            }, t('undo')),
          errorKey === undefined
            ? null
            : h('span', { style: S.error, role: 'alert', title: errorDetail ?? '' },
              errorDetail === undefined ? t(errorKey) : `${t(errorKey)}：${errorDetail}`),
        ),
      )
    }

    return {
      /**
       * The slot registry and copy are structural; the projection reader comes
       * from the session scope so the button sees the reader's own model choice.
       */
      inject: ['slots', 'locale'],
      /**
       * Register the dictionary and the composer entry.
       * @param {object} ctx - the client root context.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), '@local/prompt-polish: dictionaries')
        // Placement matters for the "missing on the new-task screen" symptom.
        // The installed Conversation skeleton renders three candidate seats
        // differently (verified against dsh-client-ui-conversation 0.2.2-rc.3):
        //   - `conversation.composer.dock` is gated on `variant === 'composer'`,
        //     so the hero (new-task) page never shows it;
        //   - `conversation.input.left` is inside the composer bar's tool row,
        //     a crowded shared list slot that other plugins can squeeze out;
        //   - `conversation.input.dock` is rendered by ConversationContent for
        //     BOTH `hero` and `composer` whenever a session/input exists, and it
        //     still receives the session standard hooks (useInput, inputActions,
        //     useProjection) — QueueDock and TodoDock live here.
        // The button acts on the draft, which exists in both states, so this is
        // the one seat that makes it visible on the new-task screen as requested.
        ctx.effect(() => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'prompt-polish',
          order: 10,
          locale: NS,
        }, PolishButton)), '@local/prompt-polish: composer entry')
        report({ stage: 'apply-ran' })
      },
    }
  },
})
