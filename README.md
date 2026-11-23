# 老韩的 DSH 插件集

自建 DeepSeek Harness 插件的集中源码仓库。采用 **本地 monorepo → GitHub 公开仓库 → 插件市场索引** 的发布方式，让其他 DSH 可以在插件页「发现」中直接安装与更新。

## 仓库结构

```
.
├── packages/          # 插件源码（每个目录一个 bundle）
│   ├── loomy-connect/
│   ├── unified-model-center/
│   ├── memory-nodes/
│   ├── prompt-polish/
│   └── credit-hud/
├── docs/              # 设计文档、资料汇总、原型
├── icons/             # 市场索引引用的图标
├── scripts/           # 生成索引、重建本地符号链接
├── index.json         # 插件市场索引（由 build-index.mjs 生成）
└── pnpm-workspace.yaml
```

## 插件一览

| 插件 | 版本 | 说明 |
|---|---|---|
| `dsh-loomy-connect` | 0.2.0 | Loomy 桌面端模型接入 DSH；积分胶囊、倍率弹层、设置卡片积分面板 |
| `@local/unified-model-center` | 1.0.0 | 统一模型中心：横排标签宽弹窗，集中所有平台模型 |
| `dsh-memory-nodes` | 1.0.0 | 平台级 / 项目级长期记忆节点 |
| `@local/prompt-polish` | 0.3.0 | 输入框下方提示词润色按钮 |
| `@local/credit-hud` | 0.1.0 | 左下角积分 HUD，汇总各平台余额 |

## 本地开发

- 依赖：Node >= 22、pnpm、git。
- 插件源码在 `packages/`；每个插件保留自己的 `package.json` / `cordis.patch.yml` / `locale` / `icon`。
- 本地开发时需要把 profile 的符号链接指向 `packages/<name>`，见 `scripts/link-plugins.ps1`。

## 发布到插件市场

1. 在 `packages/*/package.json` 确认 `engines.dsh` 与显示元数据（`locale/{zh,en}.json` 的 `meta.title/description`）。
2. 运行 `node scripts/build-index.mjs` 生成 `index.json`（`source.type=git`，支持发现页一键更新）。
3. 推送代码与 tag，把 `index.json` / `icons/` 发布到 GitHub Pages。
4. 其他 DSH：插件页 → 发现 → 添加索引 URL → 安装。

## 文档

- `docs/DSH插件集中源码管理方案-v2.0-20261123.md`：完整方案（含市场机制、索引格式、执行步骤）。
- `docs/DSH自建插件清单-v1.1-20261123.md`：自建插件盘点。
- `docs/统一模型中心-需求与设计方案-v1.0-20261123.md`：统一模型中心设计。
- `docs/README-模型选择宽改版-v1.1-20261123.md`：模型宽改版资料汇总。

## 许可

各插件遵循其原仓库许可；本仓库聚合与文档部分为 MIT。
