/**
 * @local/credit-hud — browser half.
 *
 * A sidebar-footer entry (bottom-left, next to the other footer actions) that
 * opens a floating window listing the current credit balance of every
 * connected platform.
 *
 * Every number comes from the owning plugin's own read-only route:
 *   /plugins/dsh-connect-trae/usage?region=cn
 *   /plugins/dsh-connect-workbuddy/usage?region=cn
 *   /plugins/dsh-connect-qoder/usage?region=cn|global
 *   /plugins/dsh-loomy-connect/status
 * Platforms without such a route (豆包工作) render a static "not connected"
 * row so the layout stays stable once one is added.
 *
 * An opt-in "expiring ≤3d" column (checkbox in the panel header, OFF by
 * default) reads the credit that lapses within three days out of the SAME
 * responses the panel already fetches — no extra requests, and nothing is
 * invented: every figure is what the owning plugin already reports.
 *   trae      credits.expiry.within3d.total (+ .earliestExpiresAtMs)
 *   workbuddy credits.expiringSoon (+ credits.nearestExpiryMs)
 *   qoder     pool.rows[].expiringSoon summed (+ nearestExpiryMs min)
 *   loomy     nothing reported → 0
 *   doubao    windows.incentive[] remaining where its expiry (resetsAt /
 *             resetsInMs) falls within 3 days; no usable time → 0
 * A plugin that does not report expiry data renders as 0 (with a tooltip
 * saying so), and a real zero is indistinguishable by design.
 *
 * Nothing is cached on disk and no route is written: the panel only reads.
 */
window.__ModuleLoader__.load({
  id: '@local/credit-hud',
  factory(require) {
    const React = require('react')
    const { useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const NS = 'creditHud'
    const POLL_MS = 60000
    const THREE_DAYS_MS = 3 * 864e5

    // ---------------------------------------------------------------- i18n
    const zh = {
      entry: '积分',
      title: '各平台积分余额',
      subtitle: '点刷新可立即更新；打开期间每 60 秒自动刷新',
      refresh: '刷新',
      refreshing: '刷新中…',
      updated: '更新于 {time}',
      close: '关闭',
      signedOut: '未登录',
      notConnected: '未接入余额接口',
      disabled: '未启用',
      httpError: 'HTTP {code}',
      today: '今日 {got}/{total}',
      daily: '每日 {value}',
      permanent: '永久积分',
      srcTrae: 'Trae 国内',
      srcWorkbuddy: 'WorkBuddy',
      srcQoder: 'Qoder 国内',
      srcQoderGlobal: 'Qoder 国际',
      srcLoomy: 'Loomy',
      srcDoubao: '豆包工作',
      colPlatform: '平台',
      colExpiry: '3天内到期',
      colBalance: '余额',
      noExpiryData: '该平台未报告到期数据，按 0 计',
      expiryHint: '统计 3 天内到期的积分余额；悬停数字可看最近到期时间',
      nearestExpiry: '最近到期 {time}',
    }
    const en = {
      entry: 'Credits',
      title: 'Credit balances',
      subtitle: 'Refresh any time; auto-refresh every 60s while open',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      updated: 'Updated {time}',
      close: 'Close',
      signedOut: 'Not signed in',
      notConnected: 'No balance route',
      disabled: 'Not enabled',
      httpError: 'HTTP {code}',
      today: 'Today {got}/{total}',
      daily: 'Daily {value}',
      permanent: 'Permanent',
      srcTrae: 'Trae (CN)',
      srcWorkbuddy: 'WorkBuddy',
      srcQoder: 'Qoder (CN)',
      srcQoderGlobal: 'Qoder (Global)',
      srcLoomy: 'Loomy',
      srcDoubao: 'Doubao Work',
      colPlatform: 'Platform',
      colExpiry: 'Expiring ≤3d',
      colBalance: 'Balance',
      noExpiryData: 'No expiry data reported; counted as 0',
      expiryHint: 'Credit lapsing within 3 days; hover a number for the nearest expiry time',
      nearestExpiry: 'Nearest expiry {time}',
    }

    // ------------------------------------------------------- shared open state
    let open = false
    const listeners = new Set()
    const setOpen = (value) => {
      open = value
      for (const fn of listeners) fn()
    }
    function useOpen() {
      const [, force] = useState(0)
      useEffect(() => {
        const fn = () => force((n) => n + 1)
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      }, [])
      return open
    }

    // ------------------------------------------------------------- adapters
    const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
    const fmt = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

    /** Smallest positive timestamp in a list, or undefined when there is none. */
    const minPositive = (values) => {
      let best
      for (const v of values ?? []) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0 && (best === undefined || v < best)) best = v
      }
      return best
    }

    /** Qoder answers the same shape for both regions.
     *
     * The expiring figure is the sum over the pool's member rows: the serving
     * account's own `credits` projection carries no expiry (its batches live in
     * the pool snapshot), so an account that is not a pool member yields no
     * figure at all — it renders as 0 per the panel's display rule.
     */
    const qoderOf = (json) => {
      if (json?.status !== 'signed-in') return { value: null, detailKey: 'signedOut', state: 'warn' }
      const rows = Array.isArray(json?.pool?.rows) ? json.pool.rows : undefined
      let sum = 0
      let seen = false
      if (rows !== undefined) {
        for (const row of rows) {
          const v = asNumber(row?.expiringSoon)
          if (v === null) continue
          seen = true
          sum += Math.max(0, v)
        }
      }
      return {
        value: asNumber(json?.credits?.total),
        detail: '',
        state: 'ok',
        expiring: rows !== undefined && seen ? sum : undefined,
        expiryAtMs: minPositive(rows?.map((row) => row?.nearestExpiryMs)) ?? null,
      }
    }

    /**
     * One row per platform.
     * `adapt(json, t)` returns { value, detail, detailKey, state } plus the
     * opt-in expiry column fields:
     *   expiring    — credit lapsing within 3 days; `undefined` means the
     *                 plugin did not report it (renders as 0 with a tooltip)
     *   expiryAtMs  — earliest expiry behind that figure, when known
     * state: ok | warn | off
     */
    const SOURCES = [
      {
        id: 'trae',
        labelKey: 'srcTrae',
        url: '/plugins/dsh-connect-trae/usage?region=cn',
        unit: '',
        adapt: (json) => {
          if (json?.status !== 'signed-in') return { value: null, detailKey: 'signedOut', state: 'warn' }
          const credits = json?.credits
          const within3d = credits?.expiry?.within3d
          return {
            value: asNumber(credits?.available ?? credits?.total),
            detail: json?.accountName ?? '',
            state: 'ok',
            expiring: within3d === undefined ? undefined : Math.max(0, asNumber(within3d.total) ?? 0),
            expiryAtMs: asNumber(within3d?.earliestExpiresAtMs) ?? null,
          }
        },
      },
      {
        id: 'workbuddy',
        labelKey: 'srcWorkbuddy',
        url: '/plugins/dsh-connect-workbuddy/usage?region=cn',
        unit: '',
        adapt: (json) => {
          if (json?.status !== 'signed-in') return { value: null, detailKey: 'signedOut', state: 'warn' }
          const checkin = json?.checkin
          return {
            value: asNumber(json?.credits?.total),
            detail: checkin === undefined || checkin === null
              ? ''
              : { key: 'today', params: { got: String(checkin.todayCredit ?? 0), total: String(checkin.dailyCredit ?? 0) } },
            state: 'ok',
            expiring: asNumber(json?.credits?.expiringSoon) ?? undefined,
            expiryAtMs: asNumber(json?.credits?.nearestExpiryMs) ?? null,
          }
        },
      },
      { id: 'qoder', labelKey: 'srcQoder', url: '/plugins/dsh-connect-qoder/usage?region=cn', unit: '', adapt: qoderOf },
      { id: 'qoderGlobal', labelKey: 'srcQoderGlobal', url: '/plugins/dsh-connect-qoder/usage?region=global', unit: '', adapt: qoderOf },
      {
        id: 'loomy',
        labelKey: 'srcLoomy',
        url: '/plugins/dsh-loomy-connect/status',
        unit: '',
        adapt: (json) => {
          if (json?.status !== 'signed-in') return { value: null, detailKey: 'signedOut', state: 'warn' }
          const points = json?.points
          return {
            value: points === undefined || points === null ? null : asNumber(points.permanent),
            detail: points === undefined || points === null
              ? ''
              : { key: 'daily', params: { value: String(points.daily ?? 0) } },
            state: 'ok',
          }
        },
      },
      {
        id: 'doubao',
        labelKey: 'srcDoubao',
        url: '/plugins/dsh-connect-doubao/quota?region=cn',
        unit: '',
        adapt: (json) => {
          if (json?.ok !== true) {
            return { value: null, detail: String(json?.error ?? ''), detailKey: json?.error ? undefined : 'disabled', state: 'warn' }
          }
          const windows = json?.windows?.incentive
          const first = Array.isArray(windows) ? windows[0] : undefined
          if (first === undefined || first === null) return { value: null, detailKey: 'notConnected', state: 'off' }
          const total = asNumber(first.totalAmount) ?? 0
          const used = asNumber(first.usedAmount) ?? 0
          const nowMs = Date.now()
          let sum = 0
          let nearest
          let timed = 0
          for (const w of windows) {
            const fixed = asNumber(w?.resetsAt)
            const rel = asNumber(w?.resetsInMs)
            const at = fixed !== null && fixed > 0 ? fixed : rel !== null && rel > 0 ? nowMs + rel : null
            if (at === null) continue
            timed += 1
            if (at <= nowMs || at - nowMs > THREE_DAYS_MS) continue
            sum += Math.max(0, (asNumber(w?.totalAmount) ?? 0) - (asNumber(w?.usedAmount) ?? 0))
            if (nearest === undefined || at < nearest) nearest = at
          }
          return {
            value: Math.max(0, total - used),
            detail: `${first.label ?? ''} ${used}/${total}`.trim(),
            state: 'ok',
            expiring: timed === 0 ? undefined : sum,
            expiryAtMs: nearest ?? null,
          }
        },
      },
    ]

    /** Fetch one source and normalize it into a render-ready row. */
    async function loadOne(source, t) {
      try {
        const res = await fetch(source.url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
        if (!res.ok) {
          return {
            id: source.id,
            label: t(source.labelKey),
            value: null,
            detail: res.status === 404 ? t('disabled') : t('httpError', { code: String(res.status) }),
            state: res.status === 404 ? 'off' : 'warn',
            expiring: null,
          }
        }
        const json = await res.json()
        const adapted = source.adapt(json)
        const detail = typeof adapted.detail === 'string'
          ? adapted.detail
          : adapted.detail === undefined
            ? ''
            : t(adapted.detail.key, adapted.detail.params)
        return {
          id: source.id,
          label: t(source.labelKey),
          value: adapted.value,
          detail: adapted.detailKey === undefined ? detail : t(adapted.detailKey),
          state: adapted.state ?? 'ok',
          expiring: adapted.expiring === undefined ? null : adapted.expiring,
          expiryAtMs: asNumber(adapted.expiryAtMs) ?? null,
        }
      } catch (error) {
        return {
          id: source.id,
          label: t(source.labelKey),
          value: null,
          detail: error instanceof Error ? error.message : String(error),
          state: 'warn',
          expiring: null,
        }
      }
    }

    // ------------------------------------------------------------- styling
    const S = {
      entry: {
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '6px 8px', borderRadius: 8, background: 'transparent',
        border: '1px solid transparent', color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'left',
      },
      backdrop: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.28)' },
      panel: {
        position: 'fixed', left: 16, bottom: 72, width: 392, zIndex: 1101, pointerEvents: 'auto',
        background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 14,
        boxShadow: '0 18px 48px rgba(0,0,0,.32)', padding: 14, fontSize: 13,
      },
      head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
      title: { fontSize: 14, fontWeight: 600 },
      close: {
        border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4,
      },
      sub: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, marginBottom: 10 },
      toolbar: { display: 'flex', alignItems: 'center', marginBottom: 8 },
      toggle: {
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', userSelect: 'none',
      },
      colHead: {
        display: 'flex', alignItems: 'center', gap: 10, padding: '2px 10px 6px',
        color: 'var(--dsw-alias-label-secondary)', fontSize: 11,
      },
      colHeadPlatform: { flex: '1 1 auto', minWidth: 0 },
      colHeadExpiry: { flex: '0 0 auto', width: 64, textAlign: 'right', cursor: 'default' },
      colHeadBalance: { flex: '0 0 auto', minWidth: 76, textAlign: 'right' },
      row: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '9px 10px', borderRadius: 10, marginBottom: 6,
        border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)',
      },
      left: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
      name: { fontWeight: 600, fontSize: 13 },
      detail: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      right: { display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' },
      expiryCell: {
        flex: '0 0 auto', width: 64, textAlign: 'right', fontSize: 13,
        fontWeight: 600, fontVariantNumeric: 'tabular-nums', cursor: 'default',
      },
      expiryOff: { fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' },
      expiryHot: { color: 'var(--dsw-alias-state-warn-primary)' },
      valueCell: {
        display: 'flex', alignItems: 'baseline', gap: 6, flex: '0 0 auto',
        minWidth: 76, justifyContent: 'flex-end',
      },
      value: { fontSize: 18, fontWeight: 700, letterSpacing: '.2px', fontVariantNumeric: 'tabular-nums' },
      valueOff: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' },
      dot: (state) => ({
        width: 7, height: 7, borderRadius: 99, flex: '0 0 auto',
        background: state === 'ok'
          ? 'var(--dsw-alias-state-success-primary)'
          : state === 'warn' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-idle-primary)',
      }),
      foot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
      updated: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11 },
      action: {
        padding: '5px 12px', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: 12,
        border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
      },
    }

    // ----------------------------------------------------------- components
    function FooterButton() {
      const isOpen = useOpen()
      const t = useT()
      return h('button', {
        style: { ...S.entry, background: isOpen ? 'var(--dsw-alias-bg-layer-2)' : 'transparent' },
        title: t('title'),
        type: 'button',
        onClick: () => setOpen(!isOpen),
      },
        h('span', { 'aria-hidden': 'true' }, '💰'),
        h('span', null, t('entry')),
      )
    }

    function Panel() {
      const isOpen = useOpen()
      const t = useT()
      const [rows, setRows] = useState([])
      const [busy, setBusy] = useState(false)
      const [at, setAt] = useState(0)
      const [showExpiry, setShowExpiry] = useState(true)
      const seq = useRef(0)

      const load = useMemo(() => async () => {
        const mine = ++seq.current
        setBusy(true)
        try {
          const next = await Promise.all(SOURCES.map((source) => loadOne(source, t)))
          if (seq.current !== mine) return
          setRows(next)
          setAt(Date.now())
        } finally {
          if (seq.current === mine) setBusy(false)
        }
      }, [t])

      useEffect(() => {
        if (!isOpen) return undefined
        void load()
        const timer = window.setInterval(() => { void load() }, POLL_MS)
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => { window.clearInterval(timer); window.removeEventListener('keydown', onKey) }
      }, [isOpen, load])

      if (!isOpen) return null

      /** One expiry cell; a plugin that reports nothing is shown as 0. */
      const expiryCell = (row) => {
        if (row.expiring === null) return h('span', { style: { ...S.expiryCell, ...S.expiryOff }, title: t('noExpiryData') }, '0')
        const title = row.expiryAtMs === null ? t('expiryHint') : t('nearestExpiry', { time: new Date(row.expiryAtMs).toLocaleString() })
        return h('span', {
          style: { ...S.expiryCell, ...(row.expiring > 0 ? S.expiryHot : {}) },
          title,
        }, fmt(row.expiring))
      }

      return h(React.Fragment, null,
        h('div', { style: S.backdrop, onClick: () => setOpen(false) }),
        h('div', { style: S.panel, role: 'dialog', 'aria-label': t('title') },
          h('div', { style: S.head },
            h('span', { style: S.title }, t('title')),
            h('button', { style: S.close, type: 'button', title: t('close'), onClick: () => setOpen(false) }, '×'),
          ),
          h('div', { style: S.sub }, t('subtitle')),
          h('div', { style: S.toolbar },
            h('label', { style: S.toggle },
              h('input', {
                type: 'checkbox',
                checked: showExpiry,
                onChange: (event) => setShowExpiry(event.target.checked),
              }),
              h('span', { title: t('expiryHint') }, t('colExpiry')),
            ),
          ),
          rows.length === 0
            ? h('div', { style: S.detail }, t('refreshing'))
            : h(React.Fragment, null,
                showExpiry ? h('div', { style: S.colHead },
                  h('span', { style: S.colHeadPlatform }, t('colPlatform')),
                  h('span', { style: S.colHeadExpiry, title: t('expiryHint') }, t('colExpiry')),
                  h('span', { style: S.colHeadBalance }, t('colBalance')),
                ) : null,
                rows.map((row) => h('div', { style: S.row, key: row.id },
                  h('div', { style: S.left },
                    h('span', { style: S.name }, row.label),
                    row.detail === '' ? null : h('span', { style: S.detail, title: row.detail }, row.detail),
                  ),
                  h('div', { style: S.right },
                    showExpiry ? expiryCell(row) : null,
                    h('div', { style: S.valueCell },
                      h('span', { style: S.dot(row.state), title: row.state }),
                      row.value === null
                        ? h('span', { style: S.valueOff }, '—')
                        : h('span', { style: S.value }, fmt(row.value)),
                    ),
                  ),
                )),
              ),
          h('div', { style: S.foot },
            h('span', { style: S.updated }, at === 0 ? '' : t('updated', { time: new Date(at).toLocaleTimeString() })),
            h('button', { style: S.action, type: 'button', disabled: busy, onClick: () => { void load() } },
              busy ? t('refreshing') : t('refresh')),
          ),
        ),
      )
    }

    /** The translator bound to this plugin's dictionary, injected by apply(). */
    let translate = (key) => key
    function useT() {
      return translate
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), '@local/credit-hud: dictionaries')
        translate = ctx.locale.bind(NS)

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'credit-hud', order: 4,
        }, FooterButton))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'credit-hud-panel', order: 101,
        }, Panel))
      },
    }
  },
})
