# DSH 自建插件清单

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 编制日期 | 2026-11-23（北京时间 UTC+8） |
| 适用范围 | desktop profile（`C:\Users\hhwxx\.dsh\profiles\desktop`） |
| 判定标准 | profile 中以 `link:` 本地路径接入、且非 `@deepseek-ai/*` 官方系列的插件 |
| 本次变更 | 卸载 `dsh-loomy-settings`（应用户要求），源码保留 |

---

## 一、总览

当前自建插件共 **12 个**（卸载 `dsh-loomy-settings` 后，从 13 个降为 12 个）。其中：

- **已启用 11 个**
- **已安装但未启用 1 个**：`@local/credit-board`
- 另有 1 个已卸载但源码保留：`dsh-loomy-settings`（见第四节）

## 二、插件清单

| # | 插件名 | 版本 | 状态 | 源码 / 安装位置 | 功能简介 |
|---|---|---|---|---|---|
| 1 | `dsh-loomy-connect` | 0.2.0 | 启用 | `D:\obj\DHSws\_migrate\dsh-loomy-connect` | Loomy 桌面端模型接入 DSH；输入框积分胶囊 + 倍率弹层；设置卡片积分面板（含合计） |
| 2 | `dsh-loomy-settings` | 0.2.0 | **已卸载**（源码保留） | `D:\obj\DHSws\_migrate\dsh-loomy-settings` | Loomy 独立设置页 + 全供应商模型勾选/排序管理器 |
| 3 | `@local/unified-model-center` | 1.0.0 | 启用 | `D:\obj\DHSws\dsh-unified-model-center` | 统一模型中心：横排标签宽弹窗，集中所有平台模型，替代各连接器原生选择器 |
| 4 | `dsh-memory-nodes` | 1.0.0 | 启用 | `D:\obj\DHSws\dsh-memory-nodes` | 平台级 / 项目级长期记忆节点 |
| 5 | `@local/prompt-polish` | 0.3.0 | 启用 | `D:\obj\DHSws\prompt-polish` | 输入框下方提示词润色按钮（单击润色、双击重构） |
| 6 | `@local/md-default-editor` | 0.2.0 | 启用 | `D:\obj\DHSws\md-default-editor` | `.md` / `.markdown` 用固定 Markdown 编辑器打开，替代内置预览 |
| 7 | `@local/plugin-market` | 1.0.0 | 启用 | `D:\obj\DHSws\plugin-market-bundle` | 启用 DSH 插件市场：Discover 页、`plugin_market` 工具、索引源 |
| 8 | `@local/credit-hud` | 0.1.0 | 启用 | `D:\obj\DHSws\_migrate\credit-hud` | 左下角积分 HUD，浮层列出各平台当前积分 |
| 9 | `@local/credit-board` | 1.2.0 | **未启用** | `C:\Users\hhwxx\AppData\Local\credit-board\plugin` | WorkBuddy / 豆包 / CodeArts / AStudio / AutoClaw 每日签到与积分面板 |
| 10 | `dsh-tool-picker` | 0.1.2 | 启用 | `D:\obj\DHSws\_migrate\dsh-tool-picker` | 勾选会话保留哪些工具（不卸载、仅对模型隐藏） |
| 11 | `@local/browser-use-playwright` | 1.0.0 | 启用 | `D:\obj\DHSws\browser-use-playwright-bundle` | 将 Playwright MCP 设为默认浏览器提供方（无头 Chromium） |
| 12 | `dsh-border-collie-pet` | 0.4.0 | 启用 | `D:\obj\dsh-pet` | 桌面边牧宠物，DSH 任务完成 / 失败 / 待确认时提醒 |

> 备注：`@local/border-collie-pet` 与 `dsh-border-collie-pet` 两个名字都链接到 `D:\obj\dsh-pet`，实为同一个包，不重复计数。

## 三、本次经手改动（2026-11-23）

| 插件 | 改动 | 验证 |
|---|---|---|
| `@local/unified-model-center` | 修复「原生模型选择器未被遮盖」：改为 JS 精确定位 + MutationObserver 守护 + 失败回退；三处副本同步 | `node --check` 通过，SHA256 三处一致 |
| `dsh-loomy-connect` | 设置卡片积分区改为以「剩余积分（永久+每日合计）」为主显示，与输入框胶囊口径一致，分项保留为明细 | 双 tsconfig 类型检查通过、tsdown 构建成功、产物语法通过、安装副本哈希一致 |

## 四、卸载记录：dsh-loomy-settings

- **操作**：通过 `plugin_manager remove_bundle` 卸载，profile 的 `dependencies` 与 `bundles` 中均已移除。
- **残留清理**：删除 `node_modules\dsh-loomy-settings` 符号链接。
- **源码保留**：`D:\obj\DHSws\_migrate\dsh-loomy-settings` 完整保留，随时可重新装回。
- **注意事项**：该插件此前承担「全供应商模型勾选/排序管理」功能。卸载后如需同类能力，可考虑 `@local/unified-model-center` 设置页里的模型显示/排序（仅影响统一模型中心弹窗）。

## 五、待办 / 提醒

1. `@local/credit-board` 已安装但未启用；若日常签到需要，请在 设置 → 插件 中启用。
2. 卸载 `dsh-loomy-settings` 后建议刷新 DSH 页面，确认设置页中不再出现其条目。
3. 本清单按「自建/本地 link 插件」口径整理；第三方 npm 插件（dsh-better-sidebar、dsh-context、dsh-connect-doubao/trae/workbuddy、@dmh2002/dsh-connect-qoder 等）未计入。

---

**结论**：当前 DSH desktop profile 中自建插件共 12 个，11 个启用、1 个安装未启用；`dsh-loomy-settings` 已按要求卸载，源码保留可回滚。
