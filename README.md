# 老韩的 DSH 插件集

自建 DeepSeek Harness 插件的集中源码仓库。采用 **本地 monorepo → GitHub 公开仓库 → 插件市场索引** 的发布方式，让其他 DSH 可以在插件页「发现」中直接安装与更新。

## 仓库结构

```
.
├── packages/          # 插件源码（每个目录一个 bundle）
│   ├── loomy-connect/
│   ├── unified-model-center/
│   ├── memory-nodes/
│   ├── composer-buttons/
│   └── credit-hud/
├── docs/              # 设计文档、资料汇总、原型、开发坑记
├── icons/             # 市场索引引用的图标
├── scripts/           # 生成索引、重建本地符号链接
├── index.json         # 插件市场索引（由 build-index.mjs 生成）
└── pnpm-workspace.yaml
```

## 推荐安装（建议全装）

5 个插件互相独立、可按需选装，但**组合使用体验最佳**——推荐全部安装：

| 插件 | 当前版本 | 作用 | 为什么装 |
|---|---|---|---|
| `@local/unified-model-center` | 1.1.1 | 统一模型中心：横排标签宽弹窗，集中所有平台模型，点击即切 | 模型切换统一入口；**同时承担全套插件的更新提醒**（见下文） |
| `@local/composer-buttons` | 0.2.0 | 输入框下一行按钮组：润色提示词 / 刷新页面 / 完全重启 DSH，每个按钮可开关、可自定义悬停说明 | 替代零散按钮插件，一行收纳常用操作 |
| `dsh-memory-nodes` | 1.1.0 | 平台级 + 项目级长期记忆节点，自动注入每个会话，下拉选项目查看记忆 | 让 AI 跨会话记住你的偏好与项目背景 |
| `dsh-loomy-connect` | 0.3.0 | Loomy 桌面端模型接入 DSH；积分胶囊、倍率弹层、多账号选择 | 用 Loomy 模型时必装 |
| `@local/credit-hud` | 0.1.0 | 左下角积分 HUD，汇总各平台余额 | 随时掌握积分消耗 |

### 安装步骤

1. DSH 插件页 → 在「实验性插件」下打开 **自定义插件索引**（Custom plugin indexes）。
2. 「发现」标签 → **添加索引源**，输入：
   ```
   https://raw.githubusercontent.com/hanwu-git/dsh-plugins/main/index.json
   ```
3. 逐卡浏览，点开想装的插件卡片 → 选择版本 → 确认安装（每个插件独立安装、独立确认）。

### 自动更新提醒

插件集的版本更新**无需手动盯梢**：

- **统一模型中心（UMC）内置更新检查器**：DSH 启动 30 秒后自动拉取本仓库线上索引，比对全部 5 个插件的已装版本与最新版本。
- 发现有新版本时自动弹窗，列出插件名、版本变化和更新日志；点击「前往更新」直达插件页，逐个确认升级。
- 不想被某个版本的提醒打扰，点「忽略此版本」即可，下次出新版仍会提醒。

> 说明：DSH 平台要求插件安装/更新必须人工逐个确认（安全设计），没有静默自动更新 API；UMC 的更新提醒是平台边界内"自动化程度最高"的形态——**检测自动、弹窗自动、更新一键直达**。

## 本地开发

- 依赖：Node >= 22、pnpm、git。
- 插件源码在 `packages/`；每个插件保留自己的 `package.json` / `cordis.patch.yml` / `locale` / `icon`。
- 本地开发时需要把 profile 的符号链接指向 `packages/<name>`，见 `scripts/link-plugins.ps1`。
- 注意：部分插件的生效目录是 profile 符号链接指向的**仓库外目录**（如 memory-nodes → `D:\obj\DHSws\dsh-memory-nodes`），monorepo 改动后需同步到生效目录才生效。

## 发布到插件市场

1. 在 `packages/*/package.json` 确认 `engines.dsh` 与显示元数据（`locale/{zh,en}.json` 的 `meta.title/description`）。
2. 运行 `node scripts/build-index.mjs` 生成 `index.json`（`source.type=git`，支持发现页一键更新）。
3. 修 bug 升 patch 版本、加功能升 minor 版本；`scripts/build-index.mjs` 的 `PLUGIN_DIRS` 与 `packages/` 实际目录保持同步。
4. 推送代码与索引；其他 DSH 的 UMC 会在 30 秒内自动检测到新版本并提醒用户更新。

## 文档

- `docs/DSH插件集中源码管理方案-v2.0-20261123.md`：完整方案（含市场机制、索引格式、执行步骤）。
- `docs/DSH自建插件清单-v1.1-20261123.md`：自建插件盘点。
- `docs/统一模型中心-需求与设计方案-v1.0-20261123.md`：统一模型中心设计。
- `docs/composer-buttons-开发坑记.md`：configForms / 设置插槽 / 主题令牌 / 重启助手等平台坑。
- `docs/README-模型选择宽改版-v1.1-20261123.md`：模型宽改版资料汇总。

## 许可

各插件遵循其原仓库许可；本仓库聚合与文档部分为 MIT。
