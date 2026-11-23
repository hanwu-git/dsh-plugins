# DSH 自建插件清单 v1.1

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.1（小幅修订，基于 v1.0 +0.1） |
| 编制日期 | 2026-11-23（北京时间 UTC+8） |
| 适用范围 | desktop profile（`C:\Users\hhwxx\.dsh\profiles\desktop`） |
| 判定标准 | profile 中以 `link:` 本地路径接入、且非 `@deepseek-ai/*` 官方系列的插件 |
| 本次变更 | 卸载 `@local/credit-board`（应用户要求），源码保留；累计已卸载 2 个插件 |

> 本文件是 v1.0 的新版本副本，原件 `DSH自建插件清单-v1.0-20261123.md` 保留不改。

---

## 一、总览

当前 DSH 中**仍安装/启用**的自建插件共 **10 个**（累计卸载 2 个）：

- **已启用 10 个**
- **已安装但未启用：0 个**
- 已卸载但源码保留：2 个（`dsh-loomy-settings`、`@local/credit-board`，见第四节）

## 二、插件清单（当前有效）

| # | 插件名 | 版本 | 状态 | 源码 / 安装位置 | 功能简介 |
|---|---|---|---|---|---|
| 1 | `dsh-loomy-connect` | 0.2.0 | 启用 | `D:\obj\DHSws\_migrate\dsh-loomy-connect` | Loomy 桌面端模型接入 DSH；输入框积分胶囊 + 倍率弹层；设置卡片积分面板（含合计） |
| 2 | `@local/unified-model-center` | 1.0.0 | 启用 | `D:\obj\DHSws\dsh-unified-model-center` | 统一模型中心：横排标签宽弹窗，集中所有平台模型，替代各连接器原生选择器 |
| 3 | `dsh-memory-nodes` | 1.0.0 | 启用 | `D:\obj\DHSws\dsh-memory-nodes` | 平台级 / 项目级长期记忆节点 |
| 4 | `@local/prompt-polish` | 0.3.0 | 启用 | `D:\obj\DHSws\prompt-polish` | 输入框下方提示词润色按钮（单击润色、双击重构） |
| 5 | `@local/md-default-editor` | 0.2.0 | 启用 | `D:\obj\DHSws\md-default-editor` | `.md` / `.markdown` 用固定 Markdown 编辑器打开，替代内置预览 |
| 6 | `@local/plugin-market` | 1.0.0 | 启用 | `D:\obj\DHSws\plugin-market-bundle` | 启用 DSH 插件市场：Discover 页、`plugin_market` 工具、索引源 |
| 7 | `@local/credit-hud` | 0.1.0 | 启用 | `D:\obj\DHSws\_migrate\credit-hud` | 左下角积分 HUD，浮层列出各平台当前积分 |
| 8 | `dsh-tool-picker` | 0.1.2 | 启用 | `D:\obj\DHSws\_migrate\dsh-tool-picker` | 勾选会话保留哪些工具（不卸载、仅对模型隐藏） |
| 9 | `@local/browser-use-playwright` | 1.0.0 | 启用 | `D:\obj\DHSws\browser-use-playwright-bundle` | 将 Playwright MCP 设为默认浏览器提供方（无头 Chromium） |
| 10 | `dsh-border-collie-pet` | 0.4.0 | 启用 | `D:\obj\dsh-pet` | 桌面边牧宠物，DSH 任务完成 / 失败 / 待确认时提醒 |

> 备注：`@local/border-collie-pet` 与 `dsh-border-collie-pet` 两个名字都链接到 `D:\obj\dsh-pet`，实为同一个包，不重复计数。

## 三、本次经手改动（2026-11-23）

| 插件 | 改动 | 验证 |
|---|---|---|
| `@local/unified-model-center` | 修复「原生模型选择器未被遮盖」：改为 JS 精确定位 + MutationObserver 守护 + 失败回退；三处副本同步 | `node --check` 通过，SHA256 三处一致 |
| `dsh-loomy-connect` | 设置卡片积分区改为以「剩余积分（永久+每日合计）」为主显示，与输入框胶囊口径一致，分项保留为明细 | 双 tsconfig 类型检查通过、tsdown 构建成功、产物语法通过、安装副本哈希一致 |

## 四、卸载记录（累计 2 个）

| 插件 | 操作 | 源码保留位置 | 状态 |
|---|---|---|---|
| `dsh-loomy-settings` | `plugin_manager remove_bundle`，清理 node_modules 残留链接 | `D:\obj\DHSws\_migrate\dsh-loomy-settings` | 可随时装回 |
| `@local/credit-board` | `plugin_manager remove_bundle`，清理 node_modules 残留链接 | `C:\Users\hhwxx\AppData\Local\credit-board\plugin` | 可随时装回 |

两者均已从 profile 的 `dependencies` 与 `bundles` 中移除，`plugin_manager` bundle 列表实时确认（总数 42 → 41 → 40）。

## 五、融合建议（上一轮讨论，供参考）

用户曾考虑插件融合，初步建议：

- **强建议**：积分展示类合并（credit-hud + loomy 胶囊 + credit-board 的积分部分）为统一数据源；但 credit-board 现已卸载，若不再需要签到能力，可仅保留 credit-hud + loomy 胶囊共用数据源。
- **不建议合并**：unified-model-center、prompt-polish、md-default-editor、plugin-market、dsh-tool-picker、dsh-memory-nodes、border-collie-pet、browser-use-playwright——功能域、插槽、生命周期差异大，合并会显著增加复杂度而收益有限。

## 六、待办 / 提醒

1. 卸载后建议刷新 DSH 页面，确认设置页中不再出现这两个插件条目。
2. 本清单按「自建/本地 link 插件」口径整理；第三方 npm 插件（dsh-better-sidebar、dsh-context、dsh-connect-doubao/trae/workbuddy、@dmh2002/dsh-connect-qoder 等）未计入。
3. 如需回滚，按第四节源码路径重新安装即可。

---

**结论**：当前 DSH desktop profile 中自建插件共 10 个且全部启用；`dsh-loomy-settings` 与 `@local/credit-board` 已按要求卸载，源码均保留可回滚。
