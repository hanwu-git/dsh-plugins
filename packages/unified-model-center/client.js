/**
 * @local/unified-model-center — browser half.
 *
 * One model picker for every connected provider: horizontal provider tabs,
 * hover to switch, per-provider "frequent" section, and a real model switch
 * through the host's modelDirectories service (the only call that actually
 * changes the session model). Lives entirely in this bundle, so upgrading any
 * connector plugin cannot break it.
 */
window.__ModuleLoader__.load({
  id: '@local/unified-model-center',
  factory(require) {
    const React = require('react')
    const reactDom = require('react-dom')
    const h = React.createElement
    const { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore, useCallback } = React

    const STYLE_ID = 'umc-styles'
    const FREQ_KEY = 'umc:freq:v1'
    const HIDDEN_CLASS = 'umc-active'
    const LOCALE_NS = 'settings.unifiedModelCenter'
    const UPDATE_CHECK_PATH = '/plugins/unified-model-center/check-updates'
    const UPDATE_IGNORE_KEY = 'umc:update-ignore:v1'

    const LOCALE = {
      zh: {
        nav: '模型中心',
        title: '统一模型中心 · 模型显示',
        intro: '勾选要在模型中心显示的模型，用 ↑↓ 调整顺序（常用区按使用频率自动排在最前）。此处设置只影响「模型中心」弹窗，不改变 DSH 原生选择器或其它连接器的配置。',
        search: '搜索模型…', showAll: '全部显示', hideAll: '全部隐藏', refreshAll: '重新获取全部模型',
        saved: '已保存', saving: '保存中…', saveFailed: '保存失败：',
        hiddenCount: '已隐藏 {count} 个模型', loading: '正在读取连接器模型…',
        noResults: '没有匹配的模型', noModels: '连接器里没有可用模型（请先在对应客户端登录）', moveUp: '上移', moveDown: '下移',
        effort: '思考', image: '生图', refresh: '重新获取模型', refreshing: '获取中…', refreshed: '已重新获取', refreshFailed: '获取失败：',
        updateTitle: '插件有更新', updateFound: '发现 {count} 个自研插件有新版本：', updateGo: '前往插件页更新', updateCancel: '稍后再说',
        updateIgnore: '忽略此版本', updateNone: '已是最新', updateCheckFail: '更新检测暂不可用',
      },
      en: {
        nav: 'Model Center',
        title: 'Unified Model Center · Visibility',
        intro: 'Check the models to show in the model center and use ↑↓ to reorder (frequent ones are auto-pinned on top). This only affects the Model Center popup, not the native picker or other connectors.',
        search: 'Search models…', showAll: 'Show all', hideAll: 'Hide all', refreshAll: 'Re-fetch all models',
        saved: 'Saved', saving: 'Saving…', saveFailed: 'Save failed: ',
        hiddenCount: '{count} models hidden', loading: 'Loading connector models…',
        noResults: 'No matching models', noModels: 'No models available (sign in to the clients first)', moveUp: 'Move up', moveDown: 'Move down',
        effort: 'thinking', image: 'image', refresh: 'Re-fetch models', refreshing: 'Fetching…', refreshed: 'Re-fetched', refreshFailed: 'Fetch failed: ',
        updateTitle: 'Plugin updates', updateFound: '{count} self-built plugins have new versions:', updateGo: 'Open Plugins to update', updateCancel: 'Later',
        updateIgnore: 'Ignore this version', updateNone: 'Up to date', updateCheckFail: 'Update check unavailable',
      },
    }
    function tr(t, key, vars) {
      let s = t(key)
      if (vars) for (const k of Object.keys(vars)) s = String(s).split('{' + k + '}').join(vars[k])
      return s
    }

    /* ---------------- provider definitions / endpoints ---------------- */
    const PROVIDERS = [
      {
        id: 'loomy', label: 'Loomy', providerId: 'loomy',
        path: '/plugins/dsh-loomy-connect/status',
        refreshPath: '/plugins/dsh-loomy-connect/status?refresh=1', refreshMethod: 'GET',
        parse: j => (j.models || []).map(m => ({
          id: m.id, name: m.name,
          rate: m.rate == null ? null : ('x' + m.rate),
          ctx: m.contextWindow || null,
          image: !!m.image,
          effort: null,
          badge: null,
        })),
      },
      {
        id: 'trae', label: 'Trae', providerId: 'trae',
        // Trae's usage route exposes only the 4 registered models; the POST
        // refresh route returns the full discovered catalog (35 models).
        path: '/plugins/dsh-connect-trae/models/refresh', method: 'POST',
        refreshPath: '/plugins/dsh-connect-trae/models/refresh', refreshMethod: 'POST',
        parse: j => (j.models || []).map(m => {
          const eff = (m.reasoning && m.reasoning.supported) || []
          return {
            id: m.id, name: m.name,
            rate: m.creditMultiplier == null ? null : ('x' + Number(m.creditMultiplier).toFixed(2)),
            ctx: m.maxContextWindow || m.contextWindow || null,
            image: /image|生图|seedream|vision/i.test(m.id + m.name),
            effort: eff.length ? eff : null, badge: null,
          }
        }),
      },
      {
        id: 'workbuddy', label: 'WorkBuddy', providerId: 'workbuddy',
        path: '/plugins/dsh-connect-workbuddy/usage',
        refreshPath: '/plugins/dsh-connect-workbuddy/models/refresh', refreshMethod: 'POST',
        parse: j => (j.models || []).map(m => {
          const efforts = (m.reasoning && m.reasoning.supportedEfforts) || []
          return {
            id: m.id, name: m.name,
            rate: m.creditMultiplier == null ? null : ('x' + Number(m.creditMultiplier).toFixed(2)),
            ctx: m.contextWindow || null, image: !!m.supportsImages,
            effort: efforts.length ? efforts : null, badge: null,
            free: m.creditMultiplier === 0,
          }
        }),
      },
      {
        id: 'qoder', label: 'Qoder', providerId: 'qoder',
        path: '/plugins/dsh-connect-qoder/usage',
        refreshPath: '/plugins/dsh-connect-qoder/models/refresh', refreshMethod: 'POST',
        parse: j => (j.models || []).map(m => ({
          id: m.key || m.id, name: m.name,
          rate: m.creditMultiplier == null ? null : ('x' + Number(m.creditMultiplier).toFixed(2)),
          ctx: m.contextWindow || null, image: !!m.supportsImages,
          effort: m.supportsThinking ? (m.thinkingEfforts || []) : null,
          badge: null,
        })),
      },
      {
        id: 'doubao', label: '豆包', providerId: 'doubao',
        path: '/plugins/dsh-connect-doubao/catalog',
        refreshPath: '/plugins/dsh-connect-doubao/catalog', refreshMethod: 'GET',
        parse: j => (j.models || []).map(m => {
          const rate = m.rate && m.rate.text ? m.rate.text : null
          const promo = !!(rate && (/免费|优惠|新上线/.test(rate)))
          const levels = (m.reasoningLevels || []).map(l => l.id)
          return {
            id: m.id, name: m.name, rate,
            ctx: null, image: /生图|seedream|image/i.test(m.id + m.name),
            effort: levels.length ? levels : null,
            badge: m.badge || null, promo,
          }
        }),
      },
    ]

    /* ---------------- data store (module level, one fetch per window) ---------------- */
    let snapshot = { loading: true, providers: [], error: null }
    const listeners = new Set()
    let inflight = null
    let fetchedAt = 0
    const TTL = 60000

    function notify() { for (const l of listeners) l() }
    function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }
    function getSnapshot() { return snapshot }

    async function loadOne(p, useRefresh) {
      const url = useRefresh && p.refreshPath ? p.refreshPath : p.path
      const method = (useRefresh && p.refreshMethod ? p.refreshMethod : p.method) || 'GET'
      try {
        const opts = {
          method,
          headers: { accept: 'application/json', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
          credentials: 'same-origin', cache: 'no-store',
        }
        if (method === 'POST') opts.body = '{}'
        const res = await fetch(url, opts)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const json = await res.json()
        // A bare {models:[]} without a signed-in marker must not be read as
        // logged in. Trae's refresh and Doubao's catalog report models/ok.
        const signedIn = json.status === 'signed-in' || json.signedIn === true
          || (json.ok === true && Array.isArray(json.models))
          || (Array.isArray(json.models) && json.status === undefined && json.signedIn === undefined && json.ok === undefined)
        return { ...p, models: signedIn ? p.parse(json) : [], signedIn: !!signedIn, error: signedIn ? null : '未登录' }
      } catch (e) {
        return { ...p, models: [], signedIn: false, error: String(e && e.message || e) }
      }
    }

    async function fetchAll() {
      const results = await Promise.all(PROVIDERS.map(p => loadOne(p, false)))
      const order = id => PROVIDERS.findIndex(x => x.id === id)
      results.sort((a, b) => order(a.id) - order(b.id))
      snapshot = { loading: false, providers: results, error: null }
      fetchedAt = Date.now()
      notify()
    }

    /** Re-discover models for one connector, then merge just that provider. */
    async function refreshProvider(id) {
      const p = PROVIDERS.find(x => x.id === id)
      if (!p) return
      const fresh = await loadOne(p, true)
      const order = id => PROVIDERS.findIndex(x => x.id === id)
      const providers = (snapshot.providers || []).map(x => x.id === id ? { ...fresh } : x)
      if (!providers.some(x => x.id === id)) { providers.push(fresh); providers.sort((a, b) => order(a.id) - order(b.id)) }
      snapshot = { ...snapshot, providers }
      fetchedAt = Date.now()
      notify()
      return fresh
    }

    function ensureData(force) {
      if (inflight) return inflight
      if (!force && Date.now() - fetchedAt < TTL && !snapshot.loading) return Promise.resolve()
      inflight = fetchAll().finally(() => { inflight = null })
      return inflight
    }

    /* ---------------- own settings: hidden / modelOrder / providerOrder ---------------- */
    const SETTINGS_NS = 'unified-model-center'
    const keyOf = (provider, id) => provider + '::' + String(id)
    const asArray = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : [])

    // Module-level preferences store. Initialized from configForms by apply(),
    // and updated live when the settings page mutates them.
    let prefs = { hidden: [], modelOrder: [], providerOrder: [] }
    const prefsListeners = new Set()
    function setPrefs(value) {
      prefs = {
        hidden: asArray(value && value.hidden),
        modelOrder: asArray(value && value.modelOrder),
        providerOrder: asArray(value && value.providerOrder),
      }
      for (const l of prefsListeners) l()
    }
    function subscribePrefs(l) { prefsListeners.add(l); return () => prefsListeners.delete(l) }
    function getPrefs() { return prefs }

    function byOrder(list, keyOfItem, order) {
      const rank = new Map(asArray(order).map((k, i) => [k, i]))
      return list.map((item, index) => ({ item, index })).sort((a, b) => {
        const ra = rank.get(keyOfItem(a.item)), rb = rank.get(keyOfItem(b.item))
        if (ra !== undefined && rb !== undefined) return ra - rb
        if (ra !== undefined) return -1
        if (rb !== undefined) return 1
        return a.index - b.index
      }).map(e => e.item)
    }

    /** Apply this plugin's own hidden/order preferences to raw HTTP models. */
    function applyPrefs(providers, p) {
      const hidden = new Set(asArray(p.hidden))
      const ordered = byOrder(providers, x => x.id, p.providerOrder)
      return ordered.map(provider => ({
        ...provider,
        models: byOrder(provider.models, m => keyOf(provider.id, m.id), p.modelOrder)
          .filter(m => !hidden.has(keyOf(provider.id, m.id))),
      }))
    }

    /* ---------------- frequency (per provider, persisted) ---------------- */
    let freq = {}
    try { freq = JSON.parse(localStorage.getItem(FREQ_KEY) || '{}') || {} } catch (e) { freq = {} }
    function saveFreq() { try { localStorage.setItem(FREQ_KEY, JSON.stringify(freq)) } catch (e) {} }
    function bumpFreq(providerId, modelId) {
      const k = providerId + '::' + modelId
      freq[k] = (freq[k] || 0) + 1
      saveFreq()
    }
    function getFreq(providerId, modelId) { return freq[providerId + '::' + modelId] || 0 }

    /* ---------------- styles ---------------- */
    const CSS = `
      .umc-trigger{display:inline-flex;align-items:center;gap:6px;
        background:var(--dsw-alias-button-tool-bar-fill,rgba(128,128,128,.14));
        border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));border-radius:999px;padding:4px 11px 4px 9px;
        cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary,#e8e8ea);transition:.15s;white-space:nowrap;max-width:230px}
      .umc-trigger:hover{background:var(--dsw-alias-button-tool-bar-hover,rgba(128,128,128,.24))}
      .umc-trigger .umc-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#35c46a);flex:0 0 auto}
      .umc-trigger .umc-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .umc-trigger .umc-caret{color:var(--dsw-alias-label-tertiary,#9a9aa2);font-size:9px;flex:0 0 auto}
      .umc-pop{position:fixed;width:min(560px,calc(100vw - 24px));height:min(470px,calc(100vh - 24px));display:flex;flex-direction:column;
        background:var(--dsw-alias-bg-layer-2,#202024);border:1px solid var(--dsw-alias-border-l2,#3d3d45);
        border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);overflow:hidden;z-index:100000;color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-search{padding:10px 12px 8px;flex:0 0 auto}
      .umc-search-box{display:flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-l1,rgba(0,0,0,.2));
        border:1px solid var(--dsw-alias-border-l2,#3a3a42);border-radius:9px;padding:7px 11px}
      .umc-search-box input{flex:1;background:none;border:none;outline:none;color:var(--dsw-alias-label-primary,#e8e8ea);font-size:12.5px;font-family:inherit}
      .umc-search-box input::placeholder{color:var(--dsw-alias-label-tertiary,#6e6e78)}
      .umc-tabs{display:flex;gap:4px;padding:0 12px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#2e2e35);overflow-x:auto;flex:0 0 auto}
      .umc-tab{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:8px;font-size:12px;
        color:var(--dsw-alias-label-secondary,#9a9aa2);cursor:pointer;white-space:nowrap;border:1px solid transparent;transition:.13s}
      .umc-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-tab.on{background:var(--dsw-alias-interactive-bg-active,rgba(128,128,128,.28));color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-border-l3,#4a4a55)}
      .umc-tab .umc-tdot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#35c46a)}
      .umc-tab .umc-cnt{font-size:10px;color:var(--dsw-alias-label-tertiary,#6e6e78);background:rgba(128,128,128,.18);border-radius:999px;padding:0 5px}
      .umc-tab .umc-refresh{
        display:inline-flex;align-items:center;justify-content:center;
        width:17px;height:17px;margin-left:1px;padding:0;
        border:0.5px solid var(--dsw-alias-border-l3,#4a4a55);border-radius:5px;
        background:transparent;color:var(--dsw-alias-label-secondary,#9a9aa2);
        font:inherit;font-size:11px;line-height:1;cursor:pointer;flex:none}
      .umc-tab .umc-refresh:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-tab .umc-refresh:disabled{opacity:.45;cursor:default}
      .umc-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 8px 8px}
      .umc-list::-webkit-scrollbar{width:8px}
      .umc-list::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2,#3a3a42);border-radius:4px}
      .umc-group{font-size:10px;color:var(--dsw-alias-label-tertiary,#6e6e78);letter-spacing:.06em;padding:8px 6px 4px;display:flex;align-items:center;gap:6px}
      .umc-group .umc-star{color:var(--dsw-alias-state-warn-primary,#f0b400)}
      .umc-row{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;cursor:pointer;transition:.12s;position:relative}
      .umc-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
      .umc-row.cur{background:var(--dsw-alias-interactive-bg-hover-accent,rgba(79,140,255,.22))}
      .umc-row.cur::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:2.5px;border-radius:2px;background:var(--dsw-alias-brand-primary,#4f8cff)}
      .umc-name{flex:0 1 auto;font-size:12.5px;color:var(--dsw-alias-label-primary,#e8e8ea);max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:80px}
      .umc-row.cur .umc-name{color:var(--dsw-alias-label-primary,#fff);font-weight:600}
      .umc-right{margin-left:auto;display:flex;align-items:center;gap:5px;flex:0 0 auto}
      .umc-pill{font-size:10px;border-radius:999px;padding:1.5px 7px;white-space:nowrap;line-height:1.5;border:1px solid transparent}
      .umc-pill.rate{background:rgba(128,128,128,.18);color:var(--dsw-alias-label-secondary,#c9c9d2);border-color:rgba(128,128,128,.25)}
      .umc-pill.rate.lo{background:rgba(53,196,106,.14);color:var(--dsw-alias-state-success-primary,#6ee79b);border-color:rgba(53,196,106,.3)}
      .umc-pill.ctx{background:rgba(79,140,255,.14);color:var(--dsw-alias-brand-text,#8ea6d8);border-color:rgba(79,140,255,.25)}
      .umc-pill.free{background:rgba(240,180,0,.14);color:var(--dsw-alias-state-warn-primary,#f0b400);border-color:rgba(240,180,0,.3)}
      .umc-pill.think{background:rgba(160,120,220,.14);color:#bd9ce8;border-color:rgba(160,120,220,.3)}
      .umc-pill.src{background:rgba(128,128,128,.12);color:var(--dsw-alias-label-tertiary,#a0a0b4)}
      .umc-freq{height:3px;border-radius:2px;background:rgba(128,128,128,.3);width:40px;overflow:hidden}
      .umc-freq i{display:block;height:100%;background:var(--dsw-alias-brand-primary,#4f8cff)}
      .umc-check{color:var(--dsw-alias-brand-primary,#4f8cff);font-size:13px}
      .umc-foot{border-top:1px solid var(--dsw-alias-border-l1,#2e2e35);padding:8px 14px;display:flex;align-items:center;
        justify-content:space-between;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6e6e78);flex:0 0 auto;gap:8px}
      .umc-foot .umc-msg{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .umc-foot .umc-msg.err{color:var(--dsw-alias-state-error-primary,#ff8080)}
      .umc-foot .umc-msg.ok{color:var(--dsw-alias-state-success-primary,#6ee79b)}
      .umc-empty{padding:18px;text-align:center;color:var(--dsw-alias-label-tertiary,#6e6e78);font-size:12px}
      /* ---- update notice ---- */
      .umc-upd-mask{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100001;display:flex;align-items:center;justify-content:center}
      .umc-upd{width:min(620px,calc(100vw - 32px));max-height:min(80vh,700px);display:flex;flex-direction:column;
        background:var(--dsw-alias-bg-layer-2,#202024);border:1px solid var(--dsw-alias-border-l2,#3d3d45);border-radius:14px;
        box-shadow:0 18px 60px rgba(0,0,0,.6);color:var(--dsw-alias-label-primary,#e8e8ea);overflow:hidden}
      .umc-upd-hd{padding:14px 18px;border-bottom:.5px solid var(--dsw-alias-border-l2,#3d3d45);font-size:15px;font-weight:600}
      .umc-upd-body{padding:10px 18px;overflow:auto;flex:1}
      .umc-upd-lead{font-size:12px;color:var(--dsw-alias-label-secondary,#9a9aa2);margin-bottom:8px}
      .umc-upd-item{border:.5px solid var(--dsw-alias-border-l2,#3d3d45);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.06))}
      .umc-upd-name{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
      .umc-upd-name small{font-weight:400;color:var(--dsw-alias-label-tertiary,#6e6e78)}
      .umc-upd-log{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary,#9a9aa2);white-space:pre-wrap;margin-top:6px;max-height:160px;overflow:auto}
      .umc-upd-ft{padding:10px 18px;border-top:.5px solid var(--dsw-alias-border-l2,#3d3d45);display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .umc-upd-btn{appearance:none;font:inherit;font-size:12px;line-height:1.5;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3,#4a4a55);
        border-radius:8px;padding:5px 12px;background:transparent;color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-upd-btn:hover{background:var(--dsw-alias-bg-layer-3,rgba(128,128,128,.16))}
      .umc-upd-btn.primary{background:var(--dsw-alias-brand-primary,#4f8cff);border-color:transparent;color:#fff}
      /* Hide the native picker anchor when our component explicitly marks it.
         The class is applied by JS only after the anchor is located, so a
         failed detection never hides the user's only picker. */
      [data-slot="conversation.input.model"].umc-native-hidden{display:none!important}
      /* Belt-and-braces CSS fallback: also hide while our trigger is in the DOM. */
      body:has([data-umc-trigger]) [data-slot="conversation.input.model"]{display:none!important}
      /* ---- settings page ---- */
      .umc-set-intro{font-size:12px;color:var(--dsw-alias-label-secondary,#9a9aa2);line-height:1.7;margin-bottom:6px}
      .umc-set-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      .umc-set-btn{border:0.5px solid var(--dsw-alias-border-l3,#4a4a55);border-radius:var(--dsw-radius-sm,6px);
        padding:5px 11px;background:transparent;color:var(--dsw-alias-label-primary,#e8e8ea);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
      .umc-set-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
      .umc-set-search{flex:1 1 200px;max-width:320px;height:30px;box-sizing:border-box;
        border:0.5px solid var(--dsw-alias-border-l4,#55555f);border-radius:var(--dsw-radius-md,8px);
        padding:0 10px;outline:none;background:var(--dsw-alias-bg-l1,rgba(0,0,0,.2));color:var(--dsw-alias-label-primary,#e8e8ea);font:inherit;font-size:12px}
      .umc-set-msg{font-size:11px;color:var(--dsw-alias-label-tertiary,#6e6e78)}
      .umc-set-msg.err{color:var(--dsw-alias-state-error-primary,#ff8080)}
      .umc-set-group{border:0.5px solid var(--dsw-alias-settings-card-stroke,#3a3a42);border-radius:var(--dsw-radius-lg,10px);
        background:var(--dsw-alias-settings-card-fill,rgba(128,128,128,.06));overflow:hidden;margin-bottom:8px}
      .umc-set-gh{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l2,#3a3a42);
        background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.12))}
      .umc-set-gname{font-weight:600;font-size:12px;flex:1 1 auto;color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-set-move{border:0.5px solid var(--dsw-alias-border-l3,#4a4a55);border-radius:var(--dsw-radius-sm,6px);
        width:24px;height:24px;padding:0;background:transparent;color:var(--dsw-alias-label-secondary,#9a9aa2);
        font:inherit;font-size:12px;line-height:1;cursor:pointer;flex:none}
      .umc-set-move:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
      .umc-set-model{display:flex;align-items:center;gap:9px;padding:6px 12px;font-size:12px}
      .umc-set-model[data-hidden='true']{opacity:.55}
      .umc-set-model .umc-mname{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-family:var(--ds-font-family-code,monospace);color:var(--dsw-alias-label-primary,#e8e8ea)}
      .umc-set-model .umc-mmeta{font-size:10px;color:var(--dsw-alias-label-tertiary,#6e6e78);white-space:nowrap}
    `
    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return
      const el = document.createElement('style')
      el.id = STYLE_ID
      el.textContent = CSS
      document.head.appendChild(el)
    }

    /* ---------------- native picker suppression ----------------
     * The host renders the toolbar as:
     *   [data-slot="conversation.input.right"]  <- our trigger lives here
     *   [data-slot="conversation.input.model"]  <- the native picker
     * Both sit inside one common parent (the "standardControls" div). The
     * native anchor carries `display:contents`, so a CSS-only rule that used
     * `body:has([data-umc-trigger]) [data-slot="conversation.input.model"]`
     * proved unreliable in practice. We therefore hide the native anchor
     * directly: walk up from our own trigger to the shared parent, find the
     * sibling `conversation.input.model` anchor, and mark it hidden. A
     * MutationObserver re-applies after any React re-render. If anything
     * fails, we simply leave both pickers visible — never leave none.
     */
    const NATIVE_HIDDEN_CLASS = 'umc-native-hidden'
    let nativeObserver = null
    function findNativeAnchor(triggerEl) {
      if (!triggerEl || typeof document === 'undefined') return null
      // Walk up until a parent contains BOTH our trigger and a model anchor.
      let node = triggerEl.parentElement
      for (let depth = 0; node && depth < 8; depth++) {
        const model = node.querySelector('[data-slot="conversation.input.model"]')
        const right = node.querySelector('[data-slot="conversation.input.right"]')
        if (model && right && (node.contains(triggerEl))) return model
        node = node.parentElement
      }
      return null
    }
    function hideNativePicker(triggerEl) {
      if (!triggerEl || typeof document === 'undefined') return
      const anchor = findNativeAnchor(triggerEl)
      if (!anchor) {
        // Do not guess: if we cannot find it, keep both pickers visible.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[unified-model-center] native model anchor not found; leaving native picker visible')
        }
        return
      }
      anchor.classList.add(NATIVE_HIDDEN_CLASS)
      if (!nativeObserver) {
        // Coalesce the burst of mutations produced by streaming chat output
        // into one check per animation frame.
        let scheduled = false
        const reapply = () => {
          scheduled = false
          const t = document.querySelector('[data-umc-trigger]')
          if (!t) { stopNativeSuppression(); return }
          const el = findNativeAnchor(t)
          if (el && !el.classList.contains(NATIVE_HIDDEN_CLASS)) {
            el.classList.add(NATIVE_HIDDEN_CLASS)
          }
        }
        try {
          nativeObserver = new MutationObserver(() => {
            if (scheduled) return
            scheduled = true
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reapply)
            else window.setTimeout(reapply, 0)
          })
          nativeObserver.observe(document.body, { childList: true, subtree: true })
        } catch (e) { /* MutationObserver unavailable: one-shot hide still applies */ }
      }
    }
    function stopNativeSuppression() {
      if (nativeObserver) {
        try { nativeObserver.disconnect() } catch (e) {}
        nativeObserver = null
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.' + NATIVE_HIDDEN_CLASS).forEach(el => el.classList.remove(NATIVE_HIDDEN_CLASS))
      }
    }

    /* ---- update notice helpers ---- */
    function readIgnored() {
      try { return JSON.parse(localStorage.getItem(UPDATE_IGNORE_KEY) || '{}') || {} } catch { return {} }
    }
    function isIgnored(name, version) {
      const ignored = readIgnored()
      return typeof ignored[name] === 'string' && ignored[name] === version
    }
    function ignoreVersion(name, version) {
      try {
        const ignored = readIgnored()
        ignored[name] = version
        localStorage.setItem(UPDATE_IGNORE_KEY, JSON.stringify(ignored))
      } catch { /* private mode: ignoring is best-effort */ }
    }

    function fmtCtx(n) {
      if (!n) return null
      if (n >= 1000000) return '1M'
      if (n >= 1000) return Math.round(n / 1000) + 'K'
      return String(n)
    }
    function lowRate(r) {
      if (!r) return false
      const m = String(r).match(/([\d.]+)\s*x/i)
      return !!m && parseFloat(m[1]) <= 0.1
    }

    function placePop(anchor) {
      if (!anchor || typeof window === 'undefined') return { left: 20, top: 120 }
      const r = anchor.getBoundingClientRect()
      const W = 560, H = 470
      const left = Math.max(12, Math.min(r.left, window.innerWidth - W - 12))
      let top = r.top - H - 10
      if (top < 12) top = r.bottom + 10
      return { left, top: Math.max(12, Math.min(top, window.innerHeight - H - 12)) }
    }

    /* ---------------- one model row ---------------- */
    function Row({ provider, model, current, freqMax, showFreq, showSource, onPick }) {
      const pills = []
      if (model.rate) pills.push(h('span', { key: 'r', className: 'umc-pill rate' + (lowRate(model.rate) ? ' lo' : '') }, model.rate))
      if (model.free) pills.push(h('span', { key: 'f', className: 'umc-pill free' }, '免费'))
      if (model.promo) pills.push(h('span', { key: 'p', className: 'umc-pill free' }, '优惠'))
      const ctx = fmtCtx(model.ctx)
      if (ctx) pills.push(h('span', { key: 'c', className: 'umc-pill ctx' }, ctx))
      if (model.effort && model.effort.length) pills.push(h('span', { key: 'e', className: 'umc-pill think' }, '思考 ' + model.effort.length + '档'))
      if (model.image) pills.push(h('span', { key: 'i', className: 'umc-pill think' }, '生图'))
      if (showSource) pills.push(h('span', { key: 's', className: 'umc-pill src' }, provider.label))
      const f = getFreq(provider.id, model.id)
      const bar = showFreq && f
        ? h('div', { className: 'umc-freq', title: '本连接使用 ' + f + ' 次' },
            h('i', { style: { width: Math.max(8, Math.min(100, f / (freqMax || f || 1) * 100)) + '%' } }))
        : null
      return h('div', {
        className: 'umc-row' + (current ? ' cur' : ''),
        onClick: () => onPick(provider, model),
      },
        h('span', { className: 'umc-name', title: model.name }, model.name),
        h('span', { className: 'umc-right' },
          pills, bar, current ? h('span', { className: 'umc-check' }, '✓') : null))
    }

    /* ---------------- settings page: which models show / order ---------------- */
    function buildEditorGroups(providers, p) {
      const hidden = new Set(asArray(p.hidden))
      const ordered = byOrder(providers, x => x.id, p.providerOrder)
      return ordered.map(provider => ({
        id: provider.id,
        name: provider.label,
        models: byOrder(provider.models, m => keyOf(provider.id, m.id), p.modelOrder)
          .map(m => ({
            id: m.id, name: m.name, visible: !hidden.has(keyOf(provider.id, m.id)),
            rate: m.rate, ctx: m.ctx, effort: m.effort, image: m.image,
          })),
      }))
    }

    function serializeGroups(groups, previousHidden) {
      const known = new Set()
      const hidden = [], modelOrder = []
      const providerOrder = groups.map(g => g.id)
      for (const g of groups) for (const m of g.models) {
        const k = keyOf(g.id, m.id)
        known.add(k)
        modelOrder.push(k)
        if (!m.visible) hidden.push(k)
      }
      for (const k of asArray(previousHidden)) if (!known.has(k)) hidden.push(k)
      return { hidden, modelOrder, providerOrder }
    }

    function cloneGroups(groups) {
      return groups.map(g => ({ ...g, models: g.models.map(m => ({ ...m })) }))
    }

    function ModelCenterSettingsPage(props) {
      const { t, readPrefs, writePrefs, subscribePrefs } = props
      const store = useSyncExternalStore(subscribe, getSnapshot)
      const [groups, setGroups] = useState(undefined)
      const [query, setQuery] = useState('')
      const [msg, setMsg] = useState(null)
      const [busySave, setBusySave] = useState(false)
      const prefsRef = React.useRef({ hidden: [], modelOrder: [], providerOrder: [] })

      useEffect(() => { ensureStyles() }, [])

      const rebuild = useCallback(() => {
        const p = readPrefs()
        prefsRef.current = p
        setGroups(buildEditorGroups(store.providers, p))
      }, [readPrefs])

      useEffect(() => {
        void ensureData(false)
        const unsubPrefs = subscribePrefs(rebuild)
        return () => { unsubPrefs() }
      }, [rebuild])

      // Rebuild the editor whenever the underlying model data changes.
      useEffect(() => { rebuild() }, [store.providers, rebuild])

      const persist = useCallback(async (next) => {
        const prefs = serializeGroups(next, prefsRef.current.hidden)
        setBusySave(true)
        try {
          const ok = await writePrefs(prefs)
          if (ok === false) throw new Error('rejected')
          prefsRef.current = prefs
          setGroups(cloneGroups(next))
          setMsg({ kind: 'ok', text: t('saved') })
        } catch (e) {
          // Roll back to the saved state on failure.
          setGroups(buildEditorGroups(store.providers, prefsRef.current))
          setMsg({ kind: 'err', text: t('saveFailed') + ' ' + (e && e.message || e) })
        } finally {
          setBusySave(false)
        }
      }, [writePrefs, t, store.providers])

      const toggle = (gi, mi) => {
        const next = cloneGroups(groups)
        next[gi].models[mi].visible = !next[gi].models[mi].visible
        persist(next)
      }
      const setAll = (visible) => {
        const next = cloneGroups(groups)
        for (const g of next) for (const m of g.models) m.visible = visible
        persist(next)
      }
      const move = (gi, dir) => {
        const next = cloneGroups(groups)
        const target = gi + dir
        if (target < 0 || target >= next.length) return
        const tmp = next[gi]; next[gi] = next[target]; next[target] = tmp
        persist(next)
      }
      const moveModel = (gi, mi, dir) => {
        const next = cloneGroups(groups)
        const arr = next[gi].models, target = mi + dir
        if (target < 0 || target >= arr.length) return
        const tmp = arr[mi]; arr[mi] = arr[target]; arr[target] = tmp
        persist(next)
      }

      if (store.loading || groups === undefined) {
        return h('p', { className: 'umc-set-intro' }, t('loading'))
      }
      const q = query.trim().toLowerCase()
      const matches = m => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      const visibleCount = groups.reduce((n, g) => n + g.models.filter(matches).length, 0)
      const hiddenCount = groups.reduce((n, g) => n + g.models.filter(m => !m.visible).length, 0)

      return h('div', null,
        h('p', { className: 'umc-set-intro' }, t('intro')),
        h('div', { className: 'umc-set-bar' },
          h('input', {
            className: 'umc-set-search', value: query, placeholder: t('search'),
            onChange: e => setQuery(e.target.value),
          }),
          h('button', { type: 'button', className: 'umc-set-btn', onClick: () => setAll(true) }, t('showAll')),
          h('button', { type: 'button', className: 'umc-set-btn', onClick: () => setAll(false) }, t('hideAll')),
          h('button', { type: 'button', className: 'umc-set-btn', onClick: () => { void ensureData(true).then(() => setMsg({ kind: 'ok', text: t('refreshed') })) } }, t('refreshAll')),
        ),
        msg ? h('p', { className: 'umc-set-msg' + (msg.kind === 'err' ? ' err' : '') }, msg.text) : null,
        h('p', { className: 'umc-set-msg' },
          t('hiddenCount', { count: String(hiddenCount) }) + (busySave ? ' · ' + t('saving') : '')),
        visibleCount === 0
          ? h('p', { className: 'umc-set-intro' },
              groups.reduce((n, g) => n + g.models.length, 0) === 0 ? t('noModels') : t('noResults'))
          : groups.map((g, gi) => {
              const shown = g.models.filter(matches)
              if (shown.length === 0) return null
              return h('div', { key: g.id, className: 'umc-set-group' },
                h('div', { className: 'umc-set-gh' },
                  h('span', { className: 'umc-set-gname' }, g.name + ' (' + g.models.length + ')'),
                  h('button', { type: 'button', className: 'umc-set-move', title: t('moveUp'), disabled: !!q, onClick: () => move(gi, -1) }, '↑'),
                  h('button', { type: 'button', className: 'umc-set-move', title: t('moveDown'), disabled: !!q, onClick: () => move(gi, 1) }, '↓'),
                ),
                g.models.map((m, mi) => {
                  if (!matches(m)) return null
                  return h('div', { key: m.id, className: 'umc-set-model', 'data-hidden': m.visible ? undefined : 'true' },
                    h('input', { type: 'checkbox', checked: m.visible, onChange: () => toggle(gi, mi) }),
                    h('span', { className: 'umc-mname', title: m.id }, m.name),
                    h('span', { className: 'umc-mmeta' },
                      [m.rate, m.ctx ? fmtCtx(m.ctx) : null, m.effort ? t('effort') : null, m.image ? t('image') : null]
                        .filter(Boolean).join(' · ')),
                    h('button', { type: 'button', className: 'umc-set-move', title: t('moveUp'), disabled: !!q, onClick: () => moveModel(gi, mi, -1) }, '↑'),
                    h('button', { type: 'button', className: 'umc-set-move', title: t('moveDown'), disabled: !!q, onClick: () => moveModel(gi, mi, 1) }, '↓'),
                  )
                })
              )
            })
      )
    }

    /* ---------------- update notice ----------------
     * The Host polls 5 self-built bundles 30 s after startup. We only render a
     * notice for versions the user has not chosen to ignore. "Update" navigates
     * to the Plugins page (least invasive: no auto-install behind the user's
     * back); "Ignore" remembers the version so it will not be shown again until
     * a newer one appears.
     */
    function openPluginsPage() {
      try {
        // Preferred: the shell exposes a sidebar tab for the Plugins page.
        const nav = document.querySelector('[data-nav-id="plugins"], [data-sidebar-item="plugins"], [data-tab="plugins"]')
        if (nav && typeof nav.click === 'function') { nav.click(); return }
      } catch { /* fall through to a plain message */ }
      // No stable public navigation API across DSH builds: surface the command
      // so the user can act without us guessing internal DOM.
      window.prompt('打开插件页更新：设置 → 插件；或在终端运行：', 'dsh plugin add hanwu-git/dsh-plugins')
    }

    function UpdateNotice({ t, updates, onClose }) {
      const go = (name) => {
        ignoreVersion(name, '__go__')
        onClose()
        openPluginsPage()
      }
      return h('div', { className: 'umc-upd-mask', onMouseDown: e => { if (e.target && e.target.className === 'umc-upd-mask') onClose() } },
        h('div', { className: 'umc-upd', role: 'dialog', 'aria-label': t('updateTitle') },
          h('div', { className: 'umc-upd-hd' }, t('updateTitle')),
          h('div', { className: 'umc-upd-body' },
            h('div', { className: 'umc-upd-lead' }, tr(t, 'updateFound', { count: updates.length })),
            updates.map(u => h('div', { key: u.name, className: 'umc-upd-item' },
              h('div', { className: 'umc-upd-name' }, u.title || u.name,
                h('small', null, u.installed + ' → ' + u.latest)),
              u.changelog ? h('div', { className: 'umc-upd-log' }, u.changelog) : null,
            ))
          ),
          h('div', { className: 'umc-upd-ft' },
            h('button', { type: 'button', className: 'umc-upd-btn', onClick: () => {
              for (const u of updates) ignoreVersion(u.name, u.latest)
              onClose()
            } }, t('updateIgnore')),
            h('button', { type: 'button', className: 'umc-upd-btn', onClick: onClose }, t('updateCancel')),
            h('button', { type: 'button', className: 'umc-upd-btn primary', onClick: () => go(updates[0] && updates[0].name) }, t('updateGo')),
          )
        )
      )
    }

    /* ---------------- main control ---------------- */
    function UnifiedModelControl(props) {
      // sessionId arrives as the FIRST positional argument of the slot's inject
      // face for session-scoped slots (host runInject passes binding.key).
      const { sessionId, modelDirectories } = props
      // The refresh button uses copy too; fall back to built-in zh if the
      // injected translate is missing so the control can never crash away.
      const t = props.t || ((key) => (LOCALE.zh[key] ?? key))
      const store = useSyncExternalStore(subscribe, getSnapshot)
      const prefs = useSyncExternalStore(subscribePrefs, getPrefs)
      const [open, setOpen] = useState(false)
      const [activeTab, setActiveTab] = useState('workbuddy')
      const [query, setQuery] = useState('')
      const [pos, setPos] = useState({ left: 20, top: 120 })
      const [current, setCurrent] = useState(null)
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const [refreshing, setRefreshing] = useState(null)
      const [updateNotice, setUpdateNotice] = useState(null)
      const rootRef = useRef(null)
      const panelRef = useRef(null)

      useEffect(() => { ensureStyles() }, [])

      // 30 s after startup, check the five self-built bundles for updates.
      // A session-start timer means one check per DSH launch, not per refresh.
      useEffect(() => {
        let alive = true
        const timer = window.setTimeout(async () => {
          try {
            const res = await fetch(UPDATE_CHECK_PATH, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
            if (!res.ok) return
            const data = await res.json()
            const fresh = (data.updates || []).filter(u => !isIgnored(u.name, u.latest))
            if (alive && fresh.length) setUpdateNotice(fresh)
          } catch { /* update check is best-effort, never blocks the picker */ }
        }, 30_000)
        return () => { alive = false; window.clearTimeout(timer) }
      }, [])

      // Suppress the native picker only after our trigger is in the DOM.
      // If detection fails, both pickers stay visible (no picker-less state).
      useEffect(() => {
        ensureStyles()
        const el = rootRef.current
        if (!el) return stopNativeSuppression
        // Defer one frame so the host has committed the sibling model anchor.
        const raf = (typeof requestAnimationFrame === 'function')
          ? requestAnimationFrame(() => hideNativePicker(el))
          : window.setTimeout(() => hideNativePicker(el), 0)
        return () => {
          if (typeof cancelAnimationFrame === 'function' && raf) cancelAnimationFrame(raf)
          else window.clearTimeout(raf)
          stopNativeSuppression()
        }
      }, [])

      // Keep hidden state after any re-render that swaps the anchor node.
      useEffect(() => { void ensureData(false) }, [])

      // The host's per-session directory is the single source of truth for the
      // active model. Subscribe to its store instead of polling the DOM (which
      // cannot tell providers apart reliably and crosses sessions).
      useEffect(() => {
        if (!modelDirectories || !sessionId) return undefined
        let dir
        try { dir = modelDirectories.directoryFor(sessionId) } catch (e) { return undefined }
        const sync = () => {
          const st = dir.store.getSnapshot()
          if (st && st.current && st.current.provider && st.current.model) {
            setCurrent({ provider: st.current.provider, model: st.current.model })
          }
        }
        sync()
        const unsub = dir.store.subscribe(sync)
        return () => { try { unsub() } catch (e) {} }
      }, [modelDirectories, sessionId])

      // Clear a transient notice after a few seconds.
      useEffect(() => {
        if (!notice) return undefined
        const timer = window.setTimeout(() => setNotice(null), 3200)
        return () => window.clearTimeout(timer)
      }, [notice])

      useLayoutEffect(() => {
        if (!open) return
        const place = () => setPos(placePop(rootRef.current))
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
      }, [open])

      useEffect(() => {
        if (!open) return
        const onDown = e => {
          const el = e.target
          if (rootRef.current && rootRef.current.contains(el)) return
          if (panelRef.current && panelRef.current.contains(el)) return
          setOpen(false)
        }
        const onKey = e => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onDown, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      // Models hidden in this plugin's own settings are excluded here, while
      // keeping the rich HTTP metadata (rate / context / effort) intact.
      const visibleProviders = applyPrefs(store.providers, prefs)
      const activeProvider = visibleProviders.find(p => p.id === activeTab) || visibleProviders[0]

      const setMsg = (kind, text) => setNotice({ kind, text })

      const doRefresh = useCallback(async (id) => {
        if (refreshing) return
        setRefreshing(id)
        setNotice(null)
        try {
          const fresh = await refreshProvider(id)
          const n = fresh && fresh.models ? fresh.models.length : 0
          setMsg(n > 0 ? 'ok' : 'err', n > 0 ? t('refreshed') + ' · ' + n + ' 个' : t('refreshFailed') + '无模型')
        } catch (e) {
          setMsg('err', t('refreshFailed') + ' ' + (e && e.message || e))
        } finally {
          setRefreshing(null)
        }
      }, [refreshing, t])

      const doPick = useCallback(async (provider, model) => {
        if (busy || !modelDirectories || !sessionId) {
          setMsg('err', '模型切换服务暂不可用（请在会话中使用）')
          return
        }
        setBusy(true)
        setNotice(null)
        try {
          const dir = modelDirectories.directoryFor(sessionId)
          await dir.load()
          const state = dir.store.getSnapshot()
          // Resolve the model by id across every catalog group first. Never
          // trust the hard-coded providerId — a connector may register a region
          // variant (e.g. workbuddy-global) or rename its provider.
          let selection = null
          const groups = state.groups || []
          const tryGroup = (groupId) => {
            const group = groups.find(g => g.id === groupId)
            if (!group) return false
            const found = (group.models || []).find(m => m.id === model.id)
            if (!found) return false
            const effort = found.reasoning && found.reasoning.defaultEffort
            selection = { provider: group.id, model: found.id }
            if (effort) selection.reasoningEffort = effort
            return true
          }
          if (!tryGroup(provider.providerId)) {
            for (const g of groups) { if (tryGroup(g.id)) break }
          }
          if (!selection) {
            setMsg('err', '该模型不在当前可用目录中：' + model.name)
            setBusy(false)
            return
          }
          const result = await dir.select(selection)
          if (result && result.ok === false) {
            setMsg('err', '切换失败：' + ((result.error && result.error.message) || '请重试'))
          } else {
            bumpFreq(provider.id, model.id)
            setCurrent({ provider: selection.provider, model: selection.model })
            // A successful pick closes the popup; the trigger label is the
            // immediate confirmation. Failures keep it open with an error.
            setOpen(false)
            setQuery('')
            setNotice(null)
          }
        } catch (e) {
          setMsg('err', '切换失败：' + (e && e.message || e))
        } finally {
          setBusy(false)
        }
      }, [busy, modelDirectories, sessionId])

      // A model id is only unique WITHIN one provider: several connectors ship
      // the same slug (e.g. `deepseek-v4.1-flash` exists on both Trae and
      // WorkBuddy). Comparing the id alone therefore marked a foreign provider's
      // row as "current" and painted the wrong row with a check + highlight.
      // Match the provider too. The host reports its real provider id, which may
      // be a region variant (`workbuddy-global`), so accept either the catalog
      // id or the providerId prefix.
      const providerOf = p => String(p.providerId || p.id)
      const matchesProvider = (p, provider) => {
        if (provider == null) return false
        const id = String(provider)
        const base = providerOf(p)
        return id === base || id === p.id || id.startsWith(base + '-') || base.startsWith(id + '-')
      }
      const isCurrent = (p, m) => current != null && current.model === m.id && matchesProvider(p, current.provider)

      // Exact provider+model match against the live catalog; never use the
      // '/'-suffix shortcut, which mislabels same-named models on other providers.
      let triggerLabel = '模型中心 · 选择模型'
      if (current) {
        for (const p of visibleProviders) {
          if (!matchesProvider(p, current.provider)) continue
          const m = p.models.find(x => x.id === current.model)
          if (m) { triggerLabel = '模型中心 · ' + p.label + ' ' + m.name; break }
        }
        if (triggerLabel === '模型中心 · 选择模型') {
          triggerLabel = '模型中心 · ' + (current.model || '选择模型')
        }
      }

      let body
      if (store.loading) {
        body = h('div', { className: 'umc-empty' }, '正在读取连接器的模型…')
      } else if (query.trim()) {
        const q = query.trim().toLowerCase()
        const hits = []
        for (const p of visibleProviders) for (const m of p.models) {
          if (m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) hits.push([p, m])
        }
        body = h('div', null,
          h('div', { className: 'umc-group' }, '搜索结果 · ' + hits.length + ' 项（跨全部连接）'),
          hits.length ? hits.map(([p, m], i) => h(Row, {
            key: p.id + ':' + m.id + ':' + i, provider: p, model: m,
            current: isCurrent(p, m), showSource: true, onPick: doPick,
          })) : h('div', { className: 'umc-empty' }, '没有匹配的模型'))
      } else if (activeProvider) {
        const favs = []
        for (const m of activeProvider.models) {
          const f = getFreq(activeProvider.id, m.id)
          if (f > 0) favs.push([m, f])
        }
        favs.sort((a, b) => b[1] - a[1])
        const freqMax = favs.length ? favs[0][1] : 1
        body = h('div', null,
          favs.length ? h('div', null,
            h('div', { className: 'umc-group' },
              h('span', { className: 'umc-star' }, '★'), ' ' + activeProvider.label + ' 常用 · 按使用频率'),
            favs.slice(0, 3).map(([m]) => h(Row, {
              key: 'f:' + m.id, provider: activeProvider, model: m,
              current: isCurrent(activeProvider, m), showFreq: true, freqMax, onPick: doPick,
            }))
          ) : null,
          h('div', { className: 'umc-group' }, activeProvider.label + ' · 全部 ' + activeProvider.models.length + ' 个模型'),
          activeProvider.models.length ? activeProvider.models.map(m => h(Row, {
            key: m.id, provider: activeProvider, model: m,
            current: isCurrent(activeProvider, m), onPick: doPick,
          })) : h('div', { className: 'umc-empty' },
            activeProvider.signedIn ? '该连接暂无模型' : ('未登录：' + (activeProvider.error || '请先在客户端登录')))
        )
      } else {
        body = h('div', { className: 'umc-empty' }, '没有可用的连接器')
      }

      const popover = open && typeof document !== 'undefined' && document.body
        ? reactDom.createPortal(
            h('div', {
              ref: panelRef, className: 'umc-pop', role: 'dialog', 'aria-label': '统一模型中心',
              style: { left: pos.left + 'px', top: pos.top + 'px' },
              onMouseDown: e => { if (e.target && e.target.closest && e.target.closest('button')) e.preventDefault() },
            },
              h('div', { className: 'umc-search' },
                h('div', { className: 'umc-search-box' },
                  h('span', null, '⌕'),
                  h('input', {
                    value: query, placeholder: '搜索模型…（跨所有连接器）',
                    onChange: e => setQuery(e.target.value),
                  }))),
              h('div', { className: 'umc-tabs' },
                visibleProviders.map(p => h('div', {
                  key: p.id,
                  className: 'umc-tab' + (activeTab === p.id ? ' on' : ''),
                  onMouseEnter: () => { setActiveTab(p.id); setQuery('') },
                  onClick: () => { setActiveTab(p.id); setQuery('') },
                },
                  h('span', { className: 'umc-tdot' }), p.label,
                  h('span', { className: 'umc-cnt' }, String(p.models.length)),
                  h('button', {
                    type: 'button', className: 'umc-refresh',
                    title: t('refresh'), disabled: refreshing === p.id,
                    onMouseDown: e => e.stopPropagation(),
                    onClick: e => { e.stopPropagation(); void doRefresh(p.id) },
                  }, refreshing === p.id ? '…' : '↻')))),
              h('div', { className: 'umc-list' }, body),
              h('div', { className: 'umc-foot' },
                h('span', { className: 'umc-msg' + (notice ? ' ' + notice.kind : '') },
                  notice ? notice.text : '悬停标签切换连接 · 点击模型即切换'),
                h('span', null, busy ? '切换中…' : (activeProvider ? activeProvider.label + ' ' + activeProvider.models.length + ' 个' : '')))
            ),
            document.body)
        : null

      return h('div', { ref: rootRef, 'data-umc-trigger': '', style: { display: 'inline-flex' } },
        h('button', {
          type: 'button', className: 'umc-trigger', 'aria-expanded': open, 'aria-haspopup': 'dialog',
          title: '统一模型中心 · 切换所有已连接平台的模型',
          onMouseDown: e => e.preventDefault(),
          // Opening the popup lands on the provider that actually serves the
          // session's model, instead of a fixed default tab.
          onClick: () => setOpen(o => {
            if (!o) {
              const owner = current && visibleProviders.find(p => matchesProvider(p, current.provider))
              if (owner) setActiveTab(owner.id)
            }
            return !o
          }),
        },
          h('span', { className: 'umc-dot' }),
          h('span', { className: 'umc-label' }, triggerLabel),
          h('span', { className: 'umc-caret' }, '▾')),
        popover,
        updateNotice && typeof document !== 'undefined' && document.body
          ? reactDom.createPortal(
              h(UpdateNotice, { t, updates: updateNotice, onClose: () => setUpdateNotice(null) }),
              document.body)
          : null
      )
    }

    return {
      inject: ['slots', 'modelDirectories', 'locale', 'configForms'],
      apply(ctx) {
        let modelDirectories
        try { modelDirectories = ctx.get('modelDirectories') } catch (e) { modelDirectories = undefined }

        let t = (key) => (LOCALE.zh[key] ?? key)
        try {
          ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE), 'unified-model-center: locale')
          t = ctx.locale.bind(LOCALE_NS)
        } catch (e) {
          console.error('[unified-model-center] locale unavailable, using built-in zh:', e)
        }

        // Own preferences from our config form; subscribe so the popup and the
        // settings page both follow live edits.
        try {
          const form = ctx.configForms.get(SETTINGS_NS)
          const read = () => {
            const v = (form.getSnapshot().value) || {}
            setPrefs({ hidden: v.hidden, modelOrder: v.modelOrder, providerOrder: v.providerOrder })
          }
          read()
          ctx.effect(() => form.subscribe(read), 'unified-model-center: prefs subscribe')
        } catch (e) {
          console.error('[unified-model-center] configForms unavailable:', e)
        }

        try {
          ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
            name: 'conversation.input.right',
            id: 'unified-model-center',
            order: 95,
            // session-scoped slot: the host passes binding.key (sessionId) as
            // the FIRST positional argument to inject. Capture it here.
            inject: (sessionId) => ({ sessionId, modelDirectories, t }),
          }, UnifiedModelControl))
        } catch (e) {
          console.error('[unified-model-center] slot registration failed:', e)
        }

        // Settings page under the gear menu (bottom-left), with a nav icon.
        try {
          const form = ctx.configForms.get(SETTINGS_NS)
          const readPrefs = () => {
            const v = (form.getSnapshot().value) || {}
            return { hidden: asArray(v.hidden), modelOrder: asArray(v.modelOrder), providerOrder: asArray(v.providerOrder) }
          }
          const writePrefs = (p) => form.mutate([
            { op: 'set', path: ['hidden'], value: p.hidden },
            { op: 'set', path: ['modelOrder'], value: p.modelOrder },
            { op: 'set', path: ['providerOrder'], value: p.providerOrder },
          ])
          const subscribe = (listener) => form.subscribe(listener)
          const injected = () => ({ t, readPrefs, writePrefs, subscribePrefs: subscribe })
          ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => {
            console.info('[unified-model-center] settings namespace served, registering page')
            return ctx.slots.inject('settings.section', () => {
              const d1 = ctx.slots.register({
                name: 'settings.section', id: 'unified-model-center',
                order: 36, label: () => tr(t, 'nav'), locale: LOCALE_NS, inject: injected,
              }, ModelCenterSettingsPage)
              const d2 = ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
                name: 'settings.section.icon', id: 'unified-model-center', locale: LOCALE_NS,
              }, ({ size }) => h('svg', {
                width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
                stroke: 'currentColor', 'stroke-width': 1.8, 'aria-hidden': 'true',
              },
                h('rect', { x: 3, y: 4, width: 18, height: 5, rx: 2 }),
                h('rect', { x: 3, y: 10, width: 18, height: 5, rx: 2 }),
                h('rect', { x: 3, y: 16, width: 12, height: 4, rx: 2 }),
              )))
              return () => { try { d1() } catch (e) {} try { d2() } catch (e) {} }
              })
          }), 'unified-model-center: settings section')
        } catch (e) {
          console.error('[unified-model-center] settings section failed:', e)
        }
      },
    }
  },
})
