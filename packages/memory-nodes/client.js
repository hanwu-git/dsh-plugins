/**
 * dsh-memory-nodes — browser half: settings.section page for both memory nodes.
 *
 * Mirrors the dsh-loomy-settings proven pattern: React + theme tokens only, one
 * first-class Settings section, data through ctx.connection.rpc.call to the
 * Host's /api/dsh-memory-nodes/rpc route (design v1.0 §8).
 */
window.__ModuleLoader__.load({
  id: 'dsh-memory-nodes',
  factory(require) {
    const React = require('react')
    const { useEffect, useCallback, useState } = React
    const h = React.createElement

    const NS = 'settings.memoryNodes'
    const RPC_ENDPOINT = 'dsh-memory-nodes/rpc'

    const zh = {
      nav: '记忆节点',
      title: '长期记忆节点',
      intro: '平台级与项目级两个记忆节点的当前状态。编译层自动注入每个会话；原始记录由模型经 memory_write 沉淀，可在此手动触发二次编译。',
      loading: '正在读取…',
      refresh: '刷新',
      refreshing: '刷新中…',
      platformTitle: '平台级记忆节点',
      platformIntro: '跨项目通用事实：用户偏好、通用约定、稳定结论。',
      projectTitle: '项目级记忆节点',
      projectIntro: '按工作区隔离的项目记忆；下拉选择项目查看对应记忆内容。',
      projectLabel: '选择项目',
      projectEmpty: '暂无项目记忆 —— 在对应工作区让模型写入原始记录后出现。',
      workspaceLabel: '工作区：{path}',
      compiledBytes: '编译层字节',
      rawCount: '原始记录',
      uncompiled: '待编译',
      lastCompiled: '最近编译：{time}',
      compiledByManual: '手动',
      compiledByAuto: '自动',
      compiledModel: '模型：{model}',
      neverCompiled: '尚未编译 —— 写入原始记录后可触发首次编译。',
      previewTitle: '编译层预览（前 40 行）',
      previewEmpty: '暂无编译内容。',
      compile: '立即编译',
      compiling: '编译中…',
      compileDone: '编译完成。',
      compileSkipped: '没有新的原始记录，跳过编译。',
      compileFailed: '编译失败：{message}',
      loadFailed: '读取失败：{message}',
      unknownMeta: '未知',
    }
    const en = {
      nav: 'Memory nodes',
      title: 'Long-term memory nodes',
      intro: 'Current state of the platform and project memory nodes. Compiled layers are injected into every session; the model settles raw records through memory_write, and you can trigger a re-compilation here.',
      loading: 'Reading…',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      platformTitle: 'Platform memory node',
      platformIntro: 'Cross-project facts: user preferences, shared conventions, stable conclusions.',
      projectTitle: 'Project memory nodes',
      projectIntro: 'Per-workspace memory; pick a project from the dropdown to view its memory.',
      projectLabel: 'Select project',
      projectEmpty: 'No project memory yet — records appear after the model writes them in a workspace.',
      workspaceLabel: 'Workspace: {path}',
      compiledBytes: 'Compiled bytes',
      rawCount: 'Raw records',
      uncompiled: 'Uncompiled',
      lastCompiled: 'Last compiled: {time}',
      compiledByManual: 'manual',
      compiledByAuto: 'auto',
      compiledModel: 'Model: {model}',
      neverCompiled: 'Not compiled yet — records can be compiled after the first write.',
      previewTitle: 'Compiled preview (first 40 lines)',
      previewEmpty: 'Nothing compiled yet.',
      compile: 'Compile now',
      compiling: 'Compiling…',
      compileDone: 'Compilation finished.',
      compileSkipped: 'No new raw records; skipped.',
      compileFailed: 'Compilation failed: {message}',
      loadFailed: 'Read failed: {message}',
      unknownMeta: 'unknown',
    }

    const CSS = `
.dmn-root{display:flex;flex-direction:column;gap:16px;width:100%;max-width:820px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dmn-head{display:flex;flex-direction:column;gap:4px}
.dmn-title{font-size:15px;line-height:24px;font-weight:600}
.dmn-intro{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dmn-bar{display:flex;align-items:center;gap:10px}
.dmn-btn{border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);padding:5px 11px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dmn-btn:disabled{opacity:.45;cursor:default}
.dmn-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
@media (hover:hover){.dmn-btn:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}}
.dmn-error{border-radius:var(--dsw-radius-lg);padding:9px 12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.dmn-ok{color:var(--dsw-alias-state-success-primary);font-size:12px}
.dmn-card{border:0.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.dmn-cardHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.dmn-cardTitle{font-size:13px;font-weight:600;line-height:20px;margin:0}
.dmn-cardIntro{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:0}
.dmn-ws{color:var(--dsw-alias-label-secondary);font-size:11px;font-family:var(--ds-font-family-code,monospace);overflow-wrap:anywhere}
.dmn-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.dmn-stat{border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:8px 12px;display:flex;flex-direction:column;gap:2px;background:var(--dsw-alias-bg-layer-1)}
.dmn-statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.dmn-statValue{font-size:16px;line-height:24px;font-weight:600;font-variant-numeric:tabular-nums}
.dmn-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:0}
.dmn-selectRow{display:flex;align-items:center;gap:8px}
.dmn-selectLabel{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
.dmn-select{border:0.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;padding:5px 9px;max-width:100%;min-width:0;flex:1}
.dmn-select:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dmn-select option{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dmn-previewTitle{color:var(--dsw-alias-label-secondary);font-size:11px;margin:0}
.dmn-pre{margin:0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:17px;padding:10px 12px;max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
`

    const fmtTime = (iso) => {
      const ms = Date.parse(iso)
      return Number.isFinite(ms)
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
        : String(iso)
    }
    const fmtBytes = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`)

    function SectionIcon({ size }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 3.5, y: 3.5, width: 17, height: 7.5, rx: 2, fill: 'currentColor', opacity: 0.95 }),
        h('rect', { x: 3.5, y: 13, width: 17, height: 7.5, rx: 2, fill: 'currentColor', opacity: 0.55 }),
        h('circle', { cx: 7, cy: 7.25, r: 1.3, fill: 'var(--dsw-alias-bg-layer-1, #fff)' }),
        h('circle', { cx: 7, cy: 16.75, r: 1.3, fill: 'var(--dsw-alias-bg-layer-1, #fff)' }),
      )
    }

    function NodeCard({ t, entry, busy, onCompile }) {
      const isPlatform = entry.node === 'platform'
      const meta = entry.meta
      const byLabel = meta?.updatedBy === 'auto' ? t('compiledByAuto') : t('compiledByManual')
      return h('section', { className: 'dmn-card' },
        h('div', { className: 'dmn-cardHead' },
          h('div', null,
            h('p', { className: 'dmn-cardTitle' }, isPlatform ? t('platformTitle') : t('projectTitle')),
            h('p', { className: 'dmn-cardIntro' }, isPlatform ? t('platformIntro') : t('projectIntro')),
          ),
          h('button', {
            type: 'button', className: 'dmn-btn', disabled: busy,
            onClick: () => onCompile(entry),
          }, busy ? t('compiling') : t('compile')),
        ),
        !isPlatform && entry.workspacePath ? h('p', { className: 'dmn-ws' }, t('workspaceLabel', { path: entry.workspacePath })) : null,
        h('div', { className: 'dmn-kv' },
          h('div', { className: 'dmn-stat' },
            h('span', { className: 'dmn-statLabel' }, t('compiledBytes')),
            h('span', { className: 'dmn-statValue' }, fmtBytes(entry.compiledBytes ?? 0))),
          h('div', { className: 'dmn-stat' },
            h('span', { className: 'dmn-statLabel' }, t('rawCount')),
            h('span', { className: 'dmn-statValue' }, String(entry.rawCount ?? 0))),
          h('div', { className: 'dmn-stat' },
            h('span', { className: 'dmn-statLabel' }, t('uncompiled')),
            h('span', { className: 'dmn-statValue' }, String(entry.uncompiledCount ?? 0))),
        ),
        meta?.updatedAt
          ? h('p', { className: 'dmn-meta' },
              t('lastCompiled', { time: fmtTime(meta.updatedAt) })
              + ` · ${byLabel}`
              + (meta.model ? ` · ${t('compiledModel', { model: meta.model })}` : ''))
          : h('p', { className: 'dmn-meta' }, t('neverCompiled')),
        meta?.lastError ? h('div', { className: 'dmn-error', role: 'alert' }, t('compileFailed', { message: meta.lastError })) : null,
        h('p', { className: 'dmn-previewTitle' }, t('previewTitle')),
        entry.compiledPreview
          ? h('pre', { className: 'dmn-pre' }, entry.compiledPreview)
          : h('pre', { className: 'dmn-pre' }, t('previewEmpty')),
      )
    }

    function MemoryNodesPage({ t, api }) {
      const [nodes, setNodes] = useState(undefined)
      const [loadError, setLoadError] = useState(undefined)
      const [busyKey, setBusyKey] = useState(null)
      const [notice, setNotice] = useState(undefined)
      const [actionError, setActionError] = useState(undefined)
      // Selected project workspace path; '' = auto-pick the first project.
      const [selectedProject, setSelectedProject] = useState('')

      const load = useCallback(async () => {
        try {
          const value = await api.nodes()
          setNodes(value.nodes ?? [])
          setLoadError(undefined)
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      }, [api])

      useEffect(() => { void load() }, [load])

      const compileOne = useCallback(async (entry) => {
        const key = entry.node + (entry.workspacePath ?? '')
        setBusyKey(key)
        setNotice(undefined)
        setActionError(undefined)
        try {
          const result = await api.compile(entry.node, entry.workspacePath)
          setNotice(result?.ok ? t('compileDone') : t('compileSkipped'))
          await load()
        } catch (e) {
          setActionError(e instanceof Error ? e.message : String(e))
        } finally { setBusyKey(null) }
      }, [api, load, t])

      const platformNodes = (nodes ?? []).filter(entry => entry.node === 'platform')
      const projectNodes = (nodes ?? []).filter(entry => entry.node !== 'platform')
      // Auto-pick the first project while the current selection is absent
      // (initial load, or the selected workspace disappeared after a refresh).
      const effectiveProject = projectNodes.some(p => p.workspacePath === selectedProject) || projectNodes.length === 0
        ? selectedProject
        : (projectNodes[0]?.workspacePath ?? '')
      const activeProject = projectNodes.find(p => p.workspacePath === effectiveProject)

      return h('div', { className: 'dmn-root' },
        h('style', null, CSS),
        h('div', { className: 'dmn-head' },
          h('span', { className: 'dmn-title' }, t('title')),
          h('span', { className: 'dmn-intro' }, t('intro')),
        ),
        h('div', { className: 'dmn-bar' },
          h('button', { type: 'button', className: 'dmn-btn', disabled: busyKey !== null, onClick: () => { void load() } }, t('refresh')),
          notice ? h('span', { className: 'dmn-ok' }, notice) : null,
        ),
        loadError !== undefined ? h('div', { className: 'dmn-error', role: 'alert' }, t('loadFailed', { message: loadError })) : null,
        actionError !== undefined ? h('div', { className: 'dmn-error', role: 'alert' }, t('compileFailed', { message: actionError })) : null,
        nodes === undefined ? h('p', { className: 'dmn-intro' }, t('loading')) : null,
        platformNodes.map(entry => h(NodeCard, {
          key: entry.node + (entry.workspacePath ?? ''),
          t,
          entry,
          busy: busyKey === entry.node + (entry.workspacePath ?? ''),
          onCompile: compileOne,
        })),
        projectNodes.length > 0 ? h('section', { className: 'dmn-card' },
          h('div', { className: 'dmn-cardHead' },
            h('div', null,
              h('p', { className: 'dmn-cardTitle' }, t('projectTitle')),
              h('p', { className: 'dmn-cardIntro' }, t('projectIntro')),
            ),
          ),
          h('div', { className: 'dmn-selectRow' },
            h('label', { className: 'dmn-selectLabel', htmlFor: 'dmn-project-select' }, t('projectLabel')),
            h('select', {
              id: 'dmn-project-select',
              className: 'dmn-select',
              value: effectiveProject,
              onChange: (e) => setSelectedProject(e.target.value),
            }, projectNodes.map(p => h('option', {
              key: p.workspacePath ?? '',
              value: p.workspacePath ?? '',
            }, p.workspacePath ?? ''))),
          ),
          activeProject ? h(NodeCard, {
            t,
            entry: activeProject,
            busy: busyKey === activeProject.node + (activeProject.workspacePath ?? ''),
            onCompile: compileOne,
          }) : null,
        ) : (nodes !== undefined ? h('p', { className: 'dmn-intro' }, t('projectEmpty')) : null),
      )
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-memory-nodes: dictionaries')
        const t = ctx.locale.bind(NS)
        const api = {
          async nodes() {
            const result = await ctx.connection.rpc.call('/api', RPC_ENDPOINT, { action: 'nodes' })
            if (!result.ok) throw new Error(result.error?.message || result.error?.code || 'nodes failed')
            return result.value
          },
          async compile(node, workspacePath) {
            const payload = workspacePath ? { action: 'compile', node, workspacePath } : { action: 'compile', node }
            const result = await ctx.connection.rpc.call('/api', RPC_ENDPOINT, payload)
            if (!result.ok) throw new Error(result.error?.message || result.error?.code || 'compile failed')
            return result.value
          },
        }

        // One first-class settings.section page + its nav icon (loomy-settings pattern).
        ctx.effect(() => ctx.slots.inject('settings.section', () => {
          const disposers = []
          const id = 'memory-nodes'
          disposers.push(ctx.slots.register({
            name: 'settings.section',
            id,
            order: 36,
            label: () => t('nav'),
            locale: NS,
            inject: () => ({ t, api }),
          }, MemoryNodesPage))
          disposers.push(ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
            name: 'settings.section.icon',
            id,
            locale: NS,
          }, SectionIcon)))
          return () => { for (const d of disposers) { try { d() } catch { /* gone */ } } }
        }), 'dsh-memory-nodes: settings section')
      },
    }
  },
})
