#!/usr/bin/env node
/**
 * 生成 DSH 插件市场索引（format 1）。
 *
 * 规则依据：DSH 官方 Agent Note
 *   .agents/notes/implemented/feature/2026-10-02-plugin-market-index-format.zh.md
 *
 * 每个发布版本用 source.type=git（指向本仓库 HEAD 的 40 位 commit SHA），
 * 这样其他 DSH 通过「发现」安装后，可以在发现页一键更新到新版本。
 *
 * 用法：
 *   node scripts/build-index.mjs            # 生成 index.json
 *   node scripts/build-index.mjs --check    # 只校验，不写文件
 *   node scripts/build-index.mjs --repo-url https://github.com/hanwu-git/dsh-plugins
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKGS = join(ROOT, 'packages')
const OUT = join(ROOT, 'index.json')
const CHECK_ONLY = process.argv.includes('--check')
const REPO_ARG = process.argv.indexOf('--repo-url')
const REPO_URL = REPO_ARG >= 0 ? process.argv[REPO_ARG + 1] : 'https://github.com/hanwu-git/dsh-plugins'
// 索引发布地址：raw.githubusercontent.com（DSH 可直接读取；图标相对 URL 会基于此解析）。
// 如改用 GitHub Pages，设置环境变量 INDEX_URL 覆盖即可。
const INDEX_URL = process.env.INDEX_URL || 'https://raw.githubusercontent.com/hanwu-git/dsh-plugins/main/index.json'

const MARKET_TITLE = { zh: '老韩的 DSH 插件', en: "Hanwu's DSH plugins" }
const MARKET_DESC = {
  zh: '老韩自研的 DeepSeek Harness 插件集，统一通过插件市场安装与更新。',
  en: 'Self-built DeepSeek Harness plugins by Hanwu, installed and updated via the plugin market.',
}

const PLUGIN_DIRS = [
  'loomy-connect',
  'unified-model-center',
  'memory-nodes',
  'composer-buttons',
  'credit-hud',
]

function gitHead() {
  const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`invalid HEAD sha: ${sha}`)
  return sha
}

function readJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  return JSON.parse(raw)
}

function publishTs() {
  // Git 来源：用提交者时间（秒）。取当前 HEAD 的提交时间。
  const s = execFileSync('git', ['-C', ROOT, 'show', '-s', '--format=%ct', 'HEAD'], { encoding: 'utf8' }).trim()
  const n = Number(s)
  if (!Number.isInteger(n) || n < 0 || n >= 1e11) throw new Error(`invalid publishTimestamp: ${s}`)
  return n
}

function localized(x) {
  // LocalizedText：字符串，或含 en 的对象（可附加小写语言键）。
  if (typeof x === 'string' && x.trim()) return x
  if (x && typeof x === 'object' && typeof x.en === 'string' && x.en.trim()) {
    const out = {}
    for (const [k, v] of Object.entries(x)) {
      if (/^[a-z]{2,8}(-[a-z0-9]{1,8})*$/.test(k) && typeof v === 'string' && v.trim()) out[k] = v
    }
    return out
  }
  return undefined
}

function build() {
  const commit = gitHead()
  const ts = publishTs()
  const plugins = []

  for (const dir of PLUGIN_DIRS) {
    const pkgPath = join(PKGS, dir, 'package.json')
    if (!existsSync(pkgPath)) throw new Error(`missing ${pkgPath}`)
    const pkg = readJson(pkgPath)

    // 必填：name / version / engines.dsh / dsh.bundle
    if (!pkg.name || !pkg.version) throw new Error(`${dir}: name/version missing`)
    if (!pkg.engines?.dsh || !String(pkg.engines.dsh).trim()) throw new Error(`${dir}: engines.dsh missing`)
    if (!pkg.dsh?.bundle?.patch) throw new Error(`${dir}: dsh.bundle.patch missing`)

    // 显示元数据：优先 locale/zh.json + en.json 的 meta.*
    const zh = existsSync(join(PKGS, dir, 'locale', 'zh.json')) ? readJson(join(PKGS, dir, 'locale', 'zh.json')) : {}
    const en = existsSync(join(PKGS, dir, 'locale', 'en.json')) ? readJson(join(PKGS, dir, 'locale', 'en.json')) : {}
    const zhMeta = zh.meta || {}
    const enMeta = en.meta || {}
    const title = localized({ en: enMeta.title || pkg.displayName || pkg.name, zh: zhMeta.title || pkg.name })
    const description = localized({ en: enMeta.description || pkg.description || '', zh: zhMeta.description || pkg.description || '' })

    const iconRel = `icons/${dir}.svg`
    if (!existsSync(join(ROOT, iconRel))) throw new Error(`${dir}: missing ${iconRel}`)

    plugins.push({
      name: pkg.name,
      title,
      description,
      icon: iconRel,
      author: 'hanwu-git',
      repository: { url: REPO_URL, directory: `packages/${dir}` },
      'dist-tags': { latest: pkg.version },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: ts,
          source: {
            type: 'git',
            url: REPO_URL,
            commit,
            path: `packages/${dir}`,
          },
          engines: { dsh: pkg.engines.dsh },
        },
      ],
    })
  }

  return { format: 1, title: MARKET_TITLE, description: MARKET_DESC, plugins }
}

function validate(idx) {
  const errs = []
  if (idx.format !== 1) errs.push('format must be 1')
  if (!localized(idx.title)) errs.push('title must be localized text')
  if (!Array.isArray(idx.plugins)) errs.push('plugins must be array')
  const names = new Set()
  for (const p of idx.plugins || []) {
    if (!p.name || names.has(p.name)) errs.push(`duplicate/invalid name: ${p.name}`)
    names.add(p.name)
    if (!Array.isArray(p.versions) || !p.versions.length) errs.push(`${p.name}: versions empty`)
    for (const v of p.versions || []) {
      if (!v.version) errs.push(`${p.name}: version missing`)
      if (!Number.isInteger(v.publishTimestamp)) errs.push(`${p.name}: publishTimestamp invalid`)
      if (!v.engines?.dsh || !String(v.engines.dsh).trim()) errs.push(`${p.name}: engines.dsh missing`)
      const s = v.source || {}
      if (s.type !== 'git') errs.push(`${p.name}: source.type must be git`)
      if (!/^https:\/\//.test(s.url || '')) errs.push(`${p.name}: source.url must be https`)
      if (!/^[0-9a-f]{40}$/.test(s.commit || '')) errs.push(`${p.name}: source.commit must be 40-hex`)
    }
  }
  return errs
}

const idx = build()
const errs = validate(idx)
if (errs.length) {
  console.error('index validation failed:')
  for (const e of errs) console.error(' -', e)
  process.exit(1)
}
if (CHECK_ONLY) {
  console.log(`index OK: ${idx.plugins.length} plugins, commit ${idx.plugins[0].versions[0].source.commit.slice(0, 8)}`)
  process.exit(0)
}
writeFileSync(OUT, JSON.stringify(idx, null, 2) + '\n', 'utf8')
console.log(`wrote ${OUT}: ${idx.plugins.length} plugins, commit ${idx.plugins[0].versions[0].source.commit.slice(0, 8)}`)

// 二次校验：用 DSH 官方校验器验证生成的索引（devDependency）。
// 官方校验通过才允许发布；失败则退出非零，避免发布无效索引。
try {
  const { parseMarketIndex } = await import('@deepseek-ai/dsh-plugin-market-index')
  parseMarketIndex(idx, INDEX_URL)
  console.log('official validator: OK')
} catch (err) {
  console.error('official validator FAILED:', err?.path || '', err?.message || err)
  process.exit(1)
}
