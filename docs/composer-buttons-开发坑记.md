# composer-buttons 开发坑记（2026-11-28 定稿）

> 本文沉淀 composer-buttons（输入框按钮组）从 0.1.0 到 0.2.0 开发验证过程中踩到的 DSH 平台坑，供后续自研插件参考。

## 1. configForms 命名空间 = patch 行 id（最关键）

Host 设置服务（`dsh-settings` 的 `SettingsForms.describe`）以 `ns: entry.options.id` 暴露每个活动行的配置——**即 cordis.patch.yml 里行的 `id` 字段**。`ctx.configForms.get('<ns>')` 必须传这个 id（本项目为 `composer-buttons-host`），传自造名字会拿到一个永远没有值的表单，且不报错。

## 2. Config 必须用宿主 schema 库声明（设置页出现的硬条件）

设置系统只收录 runtime `Config` 带 `toJSON` 的行（zod/schemastery 类 schema）。手写 Standard Schema 校验器（prompt-polish 旧模式）的行**永远不会出现在设置页**，其 configForms 命名空间也永不服务。正确写法（unified-model-center 同款）：

```js
import z from '@deepseek-ai/schemastery'
export const Config = z.object({ ... })
```

配套在 package.json 声明 `peerDependencies["@deepseek-ai/schemastery"]`。依赖解析由 Host 的 `routeLinked` 拦截机制处理（resolution entries 里内置包 scope=installation），**改 peerDependencies 后需完全重启 DSH 生效**（"overriding locally requires a process restart"）。

## 3. 插件设置入口的正确插槽

- `settings.plugin.item` 不是"内置插件页的插件卡片"——它属于模型设置区（loomy 的账号选择显示在"模型"页）。
- 插件自己的配置页有两个正确挂点：
  1. `plugins.row.config`（keyed：`<包名>#<行id>`，如 `@local/composer-buttons#composer-buttons-host`）→ 内置插件页点开插件详情后的配置页；
  2. `settings.section` + `settings.section.icon`（icon 的 cell key 必须等于 section 的 id）→ 设置左侧导航独立选项卡（宠物/模型中心同款）。
- 独立选项卡要用 `ctx.configForms.whileServed([NS], () => ...)` 包裹注册，等命名空间就绪再挂，否则竞态丢失。

## 4. useSyncExternalStore 的快照契约

表单快照每次 `normalizeButtons()` 都返回新对象 → React 判定快照不稳定 → 组件被反复卸载 → 设置卡整卡空白（无报错）。设置卡订阅一律用与按钮行相同的 `useState + useEffect + form.subscribe(read)` 模式。外层加 React 错误边界，把卡片异常显示成红字并上报诊断日志——空白无报错的坑只能靠这个抓。

## 5. 主题令牌不可盲信（白底白字问题）

- `--dsw-alias-button-primary-fill` 在部分上下文解析为 `--dsw-alias-brand-primary`，而后者在亮色语境 = `bluish-50`（#f9fafb 近白）；`--dsw-alias-static-white` 在宿主中**不存在**，回退 #fff → 白底白字。
- 关键视觉（确认弹窗主按钮、设置开关）用固定色值（#2563eb 底白字；开关蓝/灰），不依赖令牌。
- 排查手法：直接在 asar 里 grep 令牌定义链，确认每个变量的实际解析值，不要靠猜。

## 6. dock 列表槽的行布局限制

`conversation.input.dock` 是 list 槽，宿主在 column flex（composerStack）里给每个条目一个独立整行——两个插件各注册一个条目必然两行，任何宽度公式都拼不到一行。**要让多个按钮水平并排，只能由同一个插件渲染整行。**行宽度公式沿用 TodoPanel：`margin: 0 auto` + 宽度扣 `--dsh-composer-side-clearance`×2 与 `--dsh-composer-dock-inset`×4。

## 7. 重启助手的执行链与验证

- 助手由 DSH Host spawn，位于 DSH 进程树内：**不能 `taskkill /T`**（会自杀），必须逐 PID 杀（所有 DSH 进程共享 exe 路径，powershell.exe 助手可存活）。
- 助手 stderr 要捕获落日志并监听 exit 事件（`stdio: ['ignore','ignore','pipe']` + `child.on('exit')`），否则链路失败无从定位。
- DSH 每次完全重启都**随机换 GUI 端口**（实测 60229→64051→50063），浏览器页面停在旧地址会像"死了"。重启确认后延时 8 秒 `location.reload()` 跟进新实例，弹窗文案要写明这一点。
- 验证标志：`%TEMP%\composer-buttons-report.log` 出现 `restart-requested` + `helper-exit code=0`，且新 DSH 进程 StartTime 更新。

## 8. 插件 market 索引更新流程

`scripts/build-index.mjs` 的 `PLUGIN_DIRS` 需与 packages/ 实际目录同步；市场图标必须存在于 `icons/<name>.svg`（与包内 icon.svg 同源复制一份）。索引 `source.commit` 指向**包含插件源码的提交**（本版为 7f4e175），不一定是 HEAD——先提交源码、再生成索引、再提交索引，最后一起推送。
