# 迁移来源说明

本插件源码迁入本 monorepo 前的来源：

| 项 | 值 |
|---|---|
| 原仓库 | `https://github.com/gdrpzym/dsh-loomy-connect.git` |
| 原仓库本地路径 | `D:\obj\DHSws\_migrate\dsh-loomy-connect` |
| 迁入时 HEAD | `436ea57d7dab6ca60eaa280018edc00dfb20fc7a`（Merge branch 'feat/model-table'，0.2.0） |
| 迁入方式 | 源码快照复制（原仓库为 shallow clone，无法完整 `git subtree add`；GitHub 网络不可达无法 unshallow） |
| 迁移时间 | 2026-11-23（北京时间 UTC+8） |

## 说明

- 原仓库是 shallow clone（历史对象不完整），且当前网络无法访问 GitHub，因此无法用 `git subtree add` 保留完整提交历史。
- 迁入的是**当前工作区最新源码快照**，包括尚未在原仓库提交的「设置卡片积分合计」改动（`src/client/LoomyPluginCard.tsx`、`card-css.ts`、`locales.ts`、`lib/client.js` 等）。
- 关键文件已在迁入时做 SHA256 校验，与源目录一致。
- 从本 monorepo 发布到市场时，将使用本仓库新的 Git commit 作为索引 `source.commit`，与原仓库历史脱钩；原仓库仍保留在 `D:\obj\DHSws\_migrate\dsh-loomy-connect` 供查阅。
