/**
 * @local/composer-buttons — browser half.
 *
 * ONE row in the composer dock holding every enabled button side by side:
 * polish (single/double click), refresh, restart. The row reuses the
 * prompt-polish width formula so its left edge lands on the composer card's
 * edge; because it is the ONLY plugin rendering into this row position, the
 * buttons sit horizontally on one line.
 *
 * The settings surfaces (Plugins-page row config + own settings nav page)
 * show each button with:
 * - a visibility switch (writes `buttons.<id>.visible` through configForms)
 * - the button's description, plus an editable note appended to its tooltip.
 *
 * Migrated capability, unchanged behavior:
 * - polish: prompt-polish's rewrite call (single = light, double = restructure,
 *   Undo affordance, keyed modelSelection projection read).
 * - refresh: `location.reload()` — the shipped release prompt's own call.
 * - restart: confirmed POST to the Host's detached-helper route.
 */
window.__ModuleLoader__.load({
  id: '@local/composer-buttons',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React
    const h = React.createElement

    const NS = 'composerButtons'
    // configForms namespaces are keyed by the PATCH ROW's `id` field (verified
    // in the Host settings provider: `ns: entry.options.id`), so this must
    // equal the id in cordis.patch.yml — NOT an invented name.
    const SETTINGS_NS = 'composer-buttons-host'
    const REWRITE_PATH = '/composer-buttons/rewrite'
    const RESTART_PATH = '/composer-buttons/restart'
    const REPORT_PATH = '/composer-buttons/report'

    const MAX_PROMPT_CHARS = 12000
    const UNDO_MS = 8000
    const DOUBLE_CLICK_MS = 250

    const dictionaries = {
      zh: {
        light: '润色提示词',
        busyLight: '润色中…',
        busyRewrite: '重写中…',
        undo: '撤销',
        hintLight: '单击：轻修语病与歧义；双击：重写为结构化提示词',
        refresh: '刷新', refreshHint: '刷新 DSH 页面（相当于浏览器 F5，会话历史不丢）',
        restart: '重启', restartHint: '完全重启 DSH 应用（进行中的回复会中断，会话历史不丢）',
        confirmTitle: '完全重启 DSH？',
        confirmBody: '将关闭 DSH 并在几秒后自动重新启动，本页面会在重启完成后自动刷新到新实例。进行中的回复会中断；会话历史保存在磁盘上，不会丢失。',
        confirmGo: '重启', confirmCancel: '取消',
        restarting: '重启中…', restartDone: '已发起重启，DSH 将在几秒后自动重新打开',
        errorEmpty: '输入框是空的，没有可润色的内容',
        errorTooLong: '提示词太长，先精简一些再润色',
        errorNoChange: '模型没有给出改动',
        errorFailed: '润色失败，输入框内容未改动',
        errorTimeout: '模型超时，输入框内容未改动',
        restartError: '重启请求失败',
        cancelNote: '已取消',
        nav: '输入框按钮',
        cardTitle: '输入框按钮组',
        cardIntro: '控制输入框下方按钮的显示与说明。关闭的按钮不渲染；说明会追加到按钮悬停提示里。',
        btnPolish: '润色提示词',
        btnPolishDesc: '单击轻修语病与歧义；双击重写为结构化提示词。润色使用当前会话选中的模型。',
        btnRefreshDesc: '立即重载 DSH 页面，效果等同浏览器 F5；会话历史不丢。',
        btnRestartDesc: '完全重启 DSH 桌面应用：关闭进程树并自动重新拉起。进行中的回复会中断，会话历史不丢。',
        noteLabel: '自定义说明（追加到悬停提示，可留空）',
        notePlaceholder: '例如：下班前记得重启',
        saved: '已保存', saveFailed: '保存失败：',
      },
      en: {
        light: 'Polish prompt',
        busyLight: 'Polishing…',
        busyRewrite: 'Rewriting…',
        undo: 'Undo',
        hintLight: 'Click to fix wording and ambiguity; double-click to rewrite as a structured prompt',
        refresh: 'Refresh', refreshHint: 'Reload the DSH page (like browser F5; history survives)',
        restart: 'Restart', restartHint: 'Fully restart the DSH app (running replies abort; history survives)',
        confirmTitle: 'Fully restart DSH?',
        confirmBody: 'DSH will close and reopen in a few seconds; this page refreshes itself onto the new instance. Running replies abort; conversation history is stored on disk and survives.',
        confirmGo: 'Restart', confirmCancel: 'Cancel',
        restarting: 'Restarting…', restartDone: 'Restart requested; DSH reopens in a few seconds',
        errorEmpty: 'The composer is empty; nothing to polish',
        errorTooLong: 'The prompt is too long; shorten it first',
        errorNoChange: 'The model returned no change',
        errorFailed: 'Polish failed; the draft is unchanged',
        errorTimeout: 'The model timed out; the draft is unchanged',
        restartError: 'Restart request failed',
        cancelNote: 'Cancelled',
        nav: 'Composer buttons',
        cardTitle: 'Composer button group',
        cardIntro: 'Control which composer buttons show and what they say. Hidden buttons are not rendered; notes extend the button tooltip.',
        btnPolish: 'Prompt polish',
        btnPolishDesc: "Click to fix wording and ambiguity; double-click to rewrite as a structured prompt. Uses the session's selected model.",
        btnRefreshDesc: 'Reload the DSH page immediately, like browser F5; history survives.',
        btnRestartDesc: 'Fully restart the DSH desktop app: kill the process tree and relaunch. Running replies abort; history survives.',
        noteLabel: 'Custom note (appended to the tooltip; may be empty)',
        notePlaceholder: 'e.g. restart before leaving work',
        saved: 'Saved', saveFailed: 'Save failed: ',
      },
    }

    /** Inline styles; every colour is a host theme token so both themes work. */
    const S = {
      // ONE row for ALL buttons: `conversation.input.dock` hands entries a
      // FULL-WIDTH seat, so the row recenter with auto margins and the width
      // subtracts the card's side clearance plus the dock inset (the shipped
      // TodoPanel formula, also used by prompt-polish). Rendering polish and
      // the utility buttons in THIS single row is what keeps them horizontal.
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
      primary: {
        // FIXED colours, deliberately not theme tokens: verified in the asar,
        // `--dsw-alias-button-primary-fill` resolves to near-white
        // (bluish-50) in this dialog's context and no `static-white` token
        // exists, so the confirm button rendered white-on-white (2026-11-28).
        // The fixed pair stays readable in both themes and matches the DSH
        // dialog accent.
        color: '#ffffff',
        background: '#2563eb',
        border: '1px solid #1d4ed8',
      },
      note: { fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-secondary)' },
      status: {
        fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-secondary)',
        flexBasis: '100%', minWidth: 0, overflowWrap: 'anywhere',
      },
      error: {
        fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-state-error-primary)',
        flexBasis: '100%', minWidth: 0, overflowWrap: 'anywhere',
      },
    }

    /** Hover, focus, and disabled states inline styles cannot express. */
    const STYLE_CSS = [
      '.composer-buttons-button { cursor: pointer; transition: background-color .1s ease, border-color .1s ease; }',
      '.composer-buttons-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }',
      '.composer-buttons-button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }',
      '.composer-buttons-button:disabled { cursor: default; opacity: .45; }',
      '.composer-buttons-button.composer-buttons-primary:hover:not(:disabled) { background: #1d4ed8; }',
      '.composer-buttons-button.composer-buttons-primary:disabled { opacity: .7; }',
    ].join('\n')

    /** Settings card styles (theme tokens only). */
    const CARD_CSS = [
      '.cb-card { display:flex; flex-direction:column; gap:10px; max-width:560px; }',
      '.cb-card-row { display:flex; align-items:flex-start; gap:10px; padding:10px 12px;',
      '  border:.5px solid var(--dsw-alias-border-l2); border-radius:10px;',
      '  background:var(--dsw-alias-bg-layer-3, rgba(128,128,128,.06)); }',
      '.cb-card-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }',
      '.cb-card-name { font-size:13px; font-weight:600; color:var(--dsw-alias-label-primary); }',
      '.cb-card-desc { font-size:11.5px; line-height:1.6; color:var(--dsw-alias-label-secondary); }',
      '.cb-card-note { width:100%; margin-top:4px; padding:5px 8px; font:inherit; font-size:11.5px;',
      '  border:.5px solid var(--dsw-alias-border-l3, #4a4a55); border-radius:8px;',
      '  background:transparent; color:var(--dsw-alias-label-primary); box-sizing:border-box; }',
      '.cb-card-note:focus { outline:2px solid var(--dsw-focus-ring-color); outline-offset:1px; }',
      // Switch visuals are inline styles now (theme-independent); these legacy
      // class rules remain only for focus visibility.
      '.cb-switch input:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:2px; }',
    ].join('\n')

    /** The per-button config the Host row carries; visible by default. */
    function defaultButtons() {
      return {
        polish: { visible: true, note: '' },
        refresh: { visible: true, note: '' },
        restart: { visible: true, note: '' },
      }
    }

    function normalizeButtons(raw) {
      const base = defaultButtons()
      if (typeof raw !== 'object' || raw === null) return base
      for (const id of Object.keys(base)) {
        const one = raw[id]
        if (typeof one !== 'object' || one === null) continue
        if (typeof one.visible === 'boolean') base[id].visible = one.visible
        if (typeof one.note === 'string') base[id].note = one.note.slice(0, 200)
      }
      return base
    }

    function report(payload) {
      try {
        void fetch(REPORT_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch { /* diagnostics must never break the feature */ }
    }

    async function requestPolish(prompt, mode, route, signal) {
      let response
      try {
        response = await fetch(REWRITE_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt, mode, ...(route === undefined ? {} : { route }) }),
          signal,
        })
      } catch (error) {
        if (signal.aborted) return { ok: false }
        report({ stage: 'polish-fetch-threw', mode, message: String(error?.message ?? error).slice(0, 200) })
        return { ok: false, errorKey: 'errorFailed' }
      }
      const status = response.status
      let raw = ''
      try { raw = await response.text() } catch { /* empty body */ }
      let failure
      try { failure = raw === '' ? undefined : JSON.parse(raw) } catch { /* non-JSON */ }
      if (response.ok) {
        const ok = typeof failure?.prompt === 'string' && failure.prompt !== ''
        report({ stage: 'polish-answer', mode, status, ok })
        return ok ? { ok: true, prompt: failure.prompt } : { ok: false, errorKey: 'errorNoChange' }
      }
      report({ stage: 'polish-http-error', mode, status, body: raw.slice(0, 300) })
      if (failure?.code === 'timeout') return { ok: false, errorKey: 'errorTimeout' }
      if (failure?.code === 'prompt-too-long') return { ok: false, errorKey: 'errorTooLong' }
      const reason = typeof failure?.message === 'string' ? failure.message.trim() : ''
      if (reason !== '') return { ok: false, errorKey: 'errorFailed', detail: reason }
      return { ok: false, errorKey: 'errorFailed', detail: raw === '' ? `HTTP ${status}` : `HTTP ${status}: ${raw.slice(0, 160)}` }
    }

    async function requestRestart() {
      try {
        const response = await fetch(RESTART_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!response.ok) {
          let detail = ''
          try { detail = String((await response.json())?.error ?? '') } catch { /* no body */ }
          return { ok: false, error: 'HTTP ' + response.status + (detail ? ' · ' + detail : '') }
        }
        return { ok: true }
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error) }
      }
    }

    /** The session's selected model, read through the keyed projection hook. */
    function routeOf(projection) {
      const value = projection?.modelSelection ?? projection
      const selection = value?.next ?? value?.lastUsed
      if (selection === null || typeof selection !== 'object') return undefined
      const { provider, model, reasoningEffort } = selection
      if (typeof provider !== 'string' || typeof model !== 'string') return undefined
      return { provider, model, ...(typeof reasoningEffort === 'string' ? { reasoningEffort } : {}) }
    }

    /** Insert style tags once per document. */
    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (!document.getElementById('composer-buttons-styles')) {
        const style = document.createElement('style')
        style.id = 'composer-buttons-styles'
        style.textContent = STYLE_CSS + '\n' + CARD_CSS
        document.head.appendChild(style)
      }
    }

    /* ---------------- settings card ---------------- */

    /** One switch row: name, description, switch, editable note. */
    function ButtonRow({ t, id, label, desc, value, onChange }) {
      return h('div', { className: 'cb-card-row' },
        h('div', { className: 'cb-card-main' },
          h('div', { className: 'cb-card-name' }, label),
          h('div', { className: 'cb-card-desc' }, desc),
          h('input', {
            className: 'cb-card-note',
            type: 'text',
            value: value.note,
            placeholder: t('notePlaceholder'),
            'aria-label': t('noteLabel'),
            onChange: (e) => onChange({ ...value, note: e.target.value.slice(0, 200) }),
          }),
        ),
        h('label', {
          className: 'cb-switch',
          style: { position: 'relative', width: 34, height: 20, flex: 'none', marginTop: 2, display: 'inline-block' },
        },
          h('input', {
            type: 'checkbox',
            checked: value.visible,
            onChange: (e) => onChange({ ...value, visible: e.target.checked }),
            'aria-label': label,
            style: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 1, width: '100%', height: '100%', margin: 0 },
          }),
          // Theme-independent switch colours: theme tokens resolved to near-
          // white in this deployment's dark theme, leaving a white thumb on a
          // white track (the "白色的按钮" report). Fixed blue/grey instead.
          h('span', {
            style: {
              position: 'absolute', inset: 0, borderRadius: 10,
              background: value.visible ? '#4f8cff' : 'rgba(127,127,127,.45)',
              transition: 'background .15s ease', pointerEvents: 'none',
            },
          }),
          h('span', {
            style: {
              position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 8,
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.45)',
              transform: value.visible ? 'translateX(14px)' : 'translateX(0)',
              transition: 'transform .15s ease', pointerEvents: 'none',
            },
          }),
        ),
      )
    }

    /**
     * Error boundary around the settings card: a card crash must not blank
     * the whole settings page, and its message must reach the diagnostics.
     */
    class CardBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: undefined }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error) {
        report({ stage: 'settings-card-crashed', message: String(error?.message ?? error).slice(0, 300) })
      }
      render() {
        if (this.state.error !== undefined) {
          return h('div', { className: 'cb-card-desc', style: { color: 'var(--dsw-alias-state-error-primary)' } },
            '输入框按钮设置加载失败：' + String(this.state.error?.message ?? this.state.error))
        }
        return this.props.children
      }
    }

    function SettingsCard({ t, form }) {
      // Same subscription pattern as the WORKING ComposerButtons row
      // (useState + useEffect), not useSyncExternalStore: its snapshot
      // contract kept tearing this card down (blank tab, 2026-11-28).
      const [state, setState] = useState(defaultButtons)
      useEffect(() => {
        if (form === undefined) return undefined
        const read = () => setState(normalizeButtons(form.getSnapshot().value?.buttons))
        read()
        return form.subscribe(read)
      }, [form])
      const [saved, setSaved] = useState(false)

      const write = useCallback(async (buttons) => {
        if (form === undefined) return
        setState(buttons)
        try {
          await form.mutate([{ op: 'set', path: ['buttons'], value: buttons }])
          setSaved(true)
          window.setTimeout(() => setSaved(false), 1600)
        } catch (error) {
          report({ stage: 'settings-write-failed', message: String(error?.message ?? error).slice(0, 200) })
        }
      }, [form])

      const row = (id, label, desc) => h(ButtonRow, {
        t, id, label, desc,
        value: state[id],
        onChange: (value) => void write({ ...state, [id]: value }),
      })

      return h('div', { className: 'cb-card' },
        h('div', { className: 'cb-card-desc' }, t('cardIntro')),
        row('polish', t('btnPolish'), t('btnPolishDesc')),
        row('refresh', t('refresh'), t('btnRefreshDesc')),
        row('restart', t('restart'), t('btnRestartDesc')),
        saved ? h('div', { className: 'cb-card-desc' }, t('saved')) : null,
      )
    }

    /**
     * The Plugins-page row config entry: `view: 'summary'` renders the
     * one-liner (used when the row has no description of its own), `view:
     * 'page'` renders the switches. The owner dispatches both through the
     * key '@local/composer-buttons#composer-buttons-host'.
     */
    function RowConfigPage({ view = 'page', t, form }) {
      if (view === 'summary') return h('span', null, t('cardIntro'))
      return h(SettingsCard, { t, form })
    }

    /* ---------------- composer row ---------------- */

    function ComposerButtons(props) {
      const { useInput, inputActions, useProjection, t: slotT, form } = props
      const t = slotT || ((key) => (dictionaries.zh[key] ?? key))

      // Button switches from the plugin's own config form, delivered through
      // the slot's inject props (a component defined at factory scope has no
      // access to the apply-time `ctx`). Soft: without it, defaults render.
      const [buttons, setButtons] = useState(defaultButtons)
      useEffect(() => {
        if (form === undefined) return undefined
        const read = () => setButtons(normalizeButtons(form.getSnapshot().value?.buttons))
        read()
        return form.subscribe(read)
      }, [form])

      const draft = useInput ? useInput(state => state.draft) : undefined
      const phase = useInput ? useInput(state => state.phase) : undefined
      const projection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined

      const [busy, setBusy] = useState(undefined)
      const [undoable, setUndoable] = useState(undefined)
      const [errorText, setErrorText] = useState(undefined)
      const [restartOpen, setRestartOpen] = useState(false)
      const [restartBusy, setRestartBusy] = useState(false)
      const [restartStatus, setRestartStatus] = useState(undefined)

      const pendingClick = useRef(undefined)
      const inFlight = useRef(undefined)
      const undoExpiry = useRef(undefined)

      useEffect(() => () => {
        if (pendingClick.current !== undefined) clearTimeout(pendingClick.current)
        if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
        inFlight.current?.abort()
      }, [])

      useEffect(() => { ensureStyles() }, [])

      const polish = useCallback(async (mode) => {
        const current = draft
        if (typeof current !== 'string' || current.trim() === '') {
          setErrorText(t('errorEmpty'))
          return
        }
        if (current.length > MAX_PROMPT_CHARS) {
          setErrorText(t('errorTooLong'))
          return
        }
        setErrorText(undefined)
        setBusy(mode)
        setUndoable(undefined)
        const controller = new AbortController()
        inFlight.current = controller
        try {
          const result = await requestPolish(current, mode, routeOf(projection), controller.signal)
          if (controller.signal.aborted) return
          if (!result.ok) {
            setErrorText(result.detail ? `${t(result.errorKey)}：${result.detail}` : t(result.errorKey))
            return
          }
          if (result.prompt === current) {
            setErrorText(t('errorNoChange'))
            return
          }
          inputActions.setDraft(result.prompt)
          setUndoable(current)
          if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
          undoExpiry.current = window.setTimeout(() => { setUndoable(undefined) }, UNDO_MS)
        } finally {
          if (inFlight.current === controller) inFlight.current = undefined
          if (!controller.signal.aborted) setBusy(undefined)
        }
      }, [draft, inputActions, projection, t])

      const undo = useCallback(() => {
        if (undoable === undefined) return
        inputActions.setDraft(undoable)
        setUndoable(undefined)
        setErrorText(undefined)
        if (undoExpiry.current !== undefined) clearTimeout(undoExpiry.current)
      }, [undoable, inputActions])

      const onPolishClick = useCallback(() => {
        if (pendingClick.current !== undefined) clearTimeout(pendingClick.current)
        pendingClick.current = window.setTimeout(() => {
          pendingClick.current = undefined
          void polish('light')
        }, DOUBLE_CLICK_MS)
      }, [polish])

      const onPolishDoubleClick = useCallback(() => {
        if (pendingClick.current !== undefined) {
          clearTimeout(pendingClick.current)
          pendingClick.current = undefined
        }
        void polish('rewrite')
      }, [polish])

      const doRefresh = useCallback(() => { window.location.reload() }, [])

      const doRestart = useCallback(async () => {
        setRestartBusy(true)
        // Close the dialog IMMEDIATELY and lock the trigger button: a second
        // click used to fire a second kill and abort the freshly launching
        // instance (observed twice on 2026-11-27).
        setRestartOpen(false)
        const result = await requestRestart()
        if (result.ok) {
          setRestartStatus(t('restartDone'))
          // The app returns on a NEW random port; the current tab would keep
          // polling a dead origin, so hand the browser to the new session by
          // reloading shortly after the relaunch window (delayMs + margin).
          window.setTimeout(() => { window.location.reload() }, 8000)
        } else {
          setRestartBusy(false)
          setErrorText(`${t('restartError')}：${result.error ?? ''}`)
        }
      }, [t])

      const frozen = phase !== undefined && phase !== 'plain'
      const polishDisabled = busy !== undefined || frozen

      const polishNote = buttons.polish?.note || ''
      const refreshNote = buttons.refresh?.note || ''
      const restartNote = buttons.restart?.note || ''
      const polishTip = t('hintLight') + (polishNote ? '\n' + polishNote : '')
      const refreshTip = t('refreshHint') + (refreshNote ? '\n' + refreshNote : '')
      const restartTip = t('restartHint') + (restartNote ? '\n' + restartNote : '')

      const anyVisible = buttons.polish?.visible || buttons.refresh?.visible || buttons.restart?.visible

      return h(React.Fragment, null,
        anyVisible ? h('div', { style: S.row, 'data-composer-buttons': '' },
          buttons.polish?.visible ? h('button', {
            type: 'button',
            className: 'composer-buttons-button',
            style: S.button,
            onClick: onPolishClick,
            onDoubleClick: onPolishDoubleClick,
            disabled: polishDisabled,
            'aria-busy': busy !== undefined,
            title: polishTip,
          }, busy === 'rewrite' ? t('busyRewrite') : busy === 'light' ? t('busyLight') : t('light')) : null,
          undoable !== undefined ? h('button', {
            type: 'button',
            className: 'composer-buttons-button',
            style: S.undo,
            onClick: undo,
          }, t('undo')) : null,
          buttons.refresh?.visible ? h('button', {
            type: 'button',
            className: 'composer-buttons-button',
            style: S.button,
            onClick: doRefresh,
            title: refreshTip,
          }, '⟳ ' + t('refresh')) : null,
          buttons.restart?.visible ? h('button', {
            type: 'button',
            className: 'composer-buttons-button',
            style: S.button,
            disabled: restartBusy,
            onClick: () => { setRestartStatus(undefined); setErrorText(undefined); setRestartOpen(true) },
            title: restartTip,
          }, '⏻ ' + t('restart')) : null,
          errorText !== undefined ? h('span', { style: S.error, role: 'alert' }, errorText) : null,
          restartStatus !== undefined ? h('span', { style: S.status }, restartStatus) : null,
          restartOpen ? h('div', {
            role: 'dialog', 'aria-modal': 'true', 'aria-label': t('confirmTitle'),
            style: {
              position: 'fixed', inset: 0, zIndex: 100002,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,.5)',
            },
            onMouseDown: (e) => { if (e.target === e.currentTarget && !restartBusy) { setRestartOpen(false); setRestartStatus(t('cancelNote')) } },
          },
            h('div', {
              style: {
                width: 'min(420px, calc(100vw - 32px))',
                background: 'var(--dsw-alias-bg-layer-2, #202024)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 18px 60px rgba(0,0,0,.5)',
                color: 'var(--dsw-alias-label-primary)',
              },
            },
              h('div', { style: { fontSize: 15, fontWeight: 600, marginBottom: 8 } }, t('confirmTitle')),
              h('div', { style: { fontSize: 12.5, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)', marginBottom: 16 } }, t('confirmBody')),
              h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                h('button', {
                  type: 'button', className: 'composer-buttons-button', style: S.button,
                  disabled: restartBusy, onClick: () => { setRestartOpen(false); setRestartStatus(t('cancelNote')) },
                }, t('confirmCancel')),
                h('button', {
                  type: 'button', className: 'composer-buttons-button composer-buttons-primary', style: { ...S.button, ...S.primary },
                  disabled: restartBusy, onClick: () => { void doRestart() },
                  'aria-busy': restartBusy,
                }, restartBusy ? t('restarting') : t('confirmGo')),
              ),
            ),
          ) : null,
        ) : null)
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), '@local/composer-buttons: dictionaries')

        // The single dock row: polish, refresh, restart side by side.
        const form = (() => {
          try { return ctx.configForms.get(SETTINGS_NS) } catch { return undefined }
        })()
        const withForm = (inject) => () => ({ t: ctx.locale.bind(NS), form, ...inject?.() })

        ctx.effect(() => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'composer-buttons',
          order: 10,
          locale: NS,
          inject: withForm(),
        }, ComposerButtons)), '@local/composer-buttons: composer entry')

        // Two settings surfaces for the per-button switches:
        //
        // 1. plugins.row.config (keyed `<package>#<rowId>`) — the Plugins page
        //    row detail renders this; the key must match the patch row id
        //    exactly ('composer-buttons-host').
        // 2. settings.section + settings.section.icon — a left-nav row of its
        //    own (same pattern as loomy-connect / unified-model-center).
        //
        // Both share `form` (the Host row's config form) so a switch flipped in
        // either surface updates the composer row immediately.

        // 1. Plugins page row config.
        ctx.effect(() => ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: '@local/composer-buttons#composer-buttons-host',
          locale: NS,
          inject: withForm(),
        }, (props) => h(CardBoundary, null, h(RowConfigPage, props)))), '@local/composer-buttons: row config page')

        // 2. Own settings page with a nav icon. Wrapped in whileServed so the
        //    registration waits until the Host actually serves our namespace
        //    (the unified-model-center pattern; a bare inject would race the
        //    namespace's first accepted document).
        ctx.effect(() => {
          try {
            return ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject('settings.section', () => {
              const disposers = []
              disposers.push(ctx.slots.register({
                name: 'settings.section',
                id: 'composer-buttons',
                order: 37,
                label: () => ctx.locale.bind(NS)('nav'),
                locale: NS,
                inject: withForm(),
              }, (props) => h(CardBoundary, null, h(SettingsCard, props))))
              try {
                const iconDisposer = ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
                  name: 'settings.section.icon',
                  key: 'composer-buttons',
                  locale: NS,
                }, ({ size }) => h('svg', {
                  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
                  stroke: 'currentColor', 'stroke-width': 1.8, 'aria-hidden': 'true',
                },
                  h('rect', { x: 3, y: 4, width: 18, height: 5, rx: 2 }),
                  h('circle', { cx: 8, cy: 6.5, r: 1, fill: 'currentColor', stroke: 'none' }),
                  h('rect', { x: 3, y: 15, width: 18, height: 5, rx: 2 }),
                  h('circle', { cx: 8, cy: 17.5, r: 1, fill: 'currentColor', stroke: 'none' }),
                )))
                if (typeof iconDisposer === 'function') disposers.push(iconDisposer)
              } catch { /* icon is cosmetic */ }
              return () => {
                for (const dispose of disposers) {
                  try { dispose() } catch { /* already disposed */ }
                }
              }
            }))
          } catch (error) {
            report({ stage: 'whileServed-unavailable', message: String(error?.message ?? error).slice(0, 200) })
            return undefined
          }
        }, '@local/composer-buttons: settings section')
      },
    }
  },
})
