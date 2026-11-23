# DSH 自建插件集中源码管理方案

| 项目 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 编制日期 | 2026-11-23（北京时间 UTC+8） |
| 仓库位置 | `D:\obj\dsh-mod-sel`（当前工作目录，就地建总仓库） |
| Git 策略 | 先本地集中，暂不推 GitHub |
| 本次范围 | 输出方案文档；迁移与删除均待用户确认后执行 |

---

## 一、背景与目标

### 1.1 现状

10 个自建插件源码散落在 `D:\obj` 下 5 个位置：

| 位置 | 插件 |
|---|---|
| `D:\obj\DHSws\` | unified-model-center、memory-nodes、prompt-polish |
| `D:\obj\DHSws\_migrate\` | loomy-connect、credit-hud、tool-picker、loomy-settings（已卸载） |
| `D:\obj\DHSws\`（其余目录） | md-default-editor、plugin-market、browser-use-playwright |
| `D:\obj\dsh-pet\` | border-collie-pet |
| `C:\Users\hhwxx\AppData\Local\credit-board\plugin` | credit-board（已卸载） |

其中只有 `dsh-loomy-connect`（origin: `gdrpzym/dsh-loomy-connect`）与 `dsh-border-collie-pet`（origin: `hanwu-git/dsh-pet`）是 git 仓库；其余 8 个无版本管理。

### 1.2 目标

1. **源码集中**：一处查看、一处提交、一处迁移。
2. **统一工程配置**：共享 pnpm workspace、统一脚本与 README 模板。
3. **可迁移**：换机器只需 clone 一个仓库 + 跑一个重建符号链接的脚本。
4. **可回滚**：迁移期保留旧目录，符号链接逐个切换、逐个验证。

## 二、本次纳入范围（用户已确认）

### 2.1 纳入仓库的 5 个插件

| 插件 | 源位置 | 版本 | git 历史 |
|---|---|---|---|
| `dsh-loomy-connect` | `D:\obj\DHSws\_migrate\dsh-loomy-connect` | 0.2.0 | 有（`gdrpzym/dsh-loomy-connect`），需保留 |
| `@local/unified-model-center` | `D:\obj\DHSws\dsh-unified-model-center` | 1.0.0 | 无；当前目录已有修复后副本可直接用 |
| `dsh-memory-nodes` | `D:\obj\DHSws\dsh-memory-nodes` | 1.0.0 | 无 |
| `@local/prompt-polish` | `D:\obj\DHSws\prompt-polish` | 0.3.0 | 无 |
| `@local/credit-hud` | `D:\obj\DHSws\_migrate\credit-hud` | 0.1.0 | 无 |

### 2.2 未纳入（本次不迁）

| 插件 | 原因 |
|---|---|
| `@local/tool-picker`、`md-default-editor`、`plugin-market`、`browser-use-playwright`、`border-collie-pet` | 本次未勾选，保持现状 |
| `dsh-loomy-settings`、`@local/credit-board` | 已卸载；用户确认源码删除列入待办，本次不动 |

### 2.3 删除待办（本次不执行）

| 插件 | 源码位置 | 前置条件 |
|---|---|---|
| `dsh-loomy-settings` | `D:\obj\DHSws\_migrate\dsh-loomy-settings` | 已卸载、无 profile 引用，可直接删 |
| `@local/credit-board` | `C:\Users\hhwxx\AppData\Local\credit-board\plugin` 及其父目录 | **有正在运行的 Windows 计划任务 `DSH-CreditBoard`**；须先停用/删除该任务（连同 `DSH-CheckinNow`、`DSH-DailyCheckin`、`DSH-CreditCollect` 视需要），再删目录。DSH 内 10:10 每日签到任务独立，不受影响 |

## 三、目标目录结构

```
D:\obj\dsh-mod-sel\                      ← 总仓库根（git init）
├── .git\
├── .gitignore                           ← 忽略 node_modules、lib 产物可选、临时文件
├── pnpm-workspace.yaml                  ← packages: - 'packages/*'
├── package.json                         ← 私有根包，统一脚本
├── README.md                            ← 仓库总览 + 插件索引
├── packages\
│   ├── loomy-connect\                   ← git subtree 保留历史
│   ├── unified-model-center\            ← 使用当前目录已有修复副本
│   ├── memory-nodes\
│   ├── prompt-polish\
│   └── credit-hud\
├── docs\
│   ├── 自建插件清单.md
│   ├── 统一模型中心-需求与设计方案-v1.0-20261123.md
│   ├── 模型选择宽改版资料汇总（README 两版 + 原型 HTML）
│   └── 本方案文档
└── scripts\
    └── link-plugins.ps1                 ← 一键重建 profile 符号链接（迁移/换机用）
```

> 现有 6 份文档与原型 HTML 收敛进 `docs\`；`dsh-unified-model-center\` 现有目录移入 `packages\unified-model-center\`。

## 四、迁移步骤（待执行）

### 步骤 1：建仓库骨架

- 在 `D:\obj\dsh-mod-sel` 执行 `git init`。
- 新建 `pnpm-workspace.yaml`、`package.json`（private: true）、`.gitignore`、`README.md`。
- 新建 `packages\`、`docs\`、`scripts\` 目录。

### 步骤 2：迁入 5 个插件

| 插件 | 迁移方式 | 说明 |
|---|---|---|
| loomy-connect | `git subtree add --prefix=packages/loomy-connect <旧仓库> main` | 保留提交历史；随后把当前工作区已修改文件（积分卡片合计改动）覆盖进去再提交 |
| unified-model-center | 移动当前目录 `dsh-unified-model-center\` → `packages\unified-model-center\` | 用已修复版本 |
| memory-nodes / prompt-polish / credit-hud | `Copy-Item -Recurse` 从源位置复制 | 原目录保留作备份 |

### 步骤 3：工程配置统一

- 根 `package.json` 脚本示例：
  - `check`: 遍历 packages 执行各自 `pnpm check`
  - `build`: 遍历 packages 执行 build
  - `link`: `pwsh ./scripts/link-plugins.ps1`
- 不改动各插件内部 `package.json` 的名称/版本/入口，确保 DSH 加载行为不变。

### 步骤 4：切换符号链接（逐个验证）

当前 profile 符号链接（摘自 `C:\Users\hhwxx\.dsh\profiles\desktop\node_modules`）：

| 链接 | 当前指向 | 切换后指向 |
|---|---|---|
| `@local\unified-model-center` | `D:\obj\DHSws\dsh-unified-model-center` | `D:\obj\dsh-mod-sel\packages\unified-model-center` |
| `dsh-loomy-connect` | `D:\obj\DHSws\_migrate\dsh-loomy-connect` | `...\packages\loomy-connect` |
| `dsh-memory-nodes` | `D:\obj\DHSws\dsh-memory-nodes` | `...\packages\memory-nodes` |
| `@local\prompt-polish` | `D:\obj\DHSws\prompt-polish` | `...\packages\prompt-polish` |
| `@local\credit-hud` | `D:\obj\DHSws\_migrate\credit-hud` | `...\packages\credit-hud` |

切换策略：一次切一个 → 刷新 DSH 页面 → 验证功能正常 → 再切下一个。出问题立即把链接切回旧路径。

### 步骤 5：验证清单

| 插件 | 验证点 |
|---|---|
| loomy-connect | 设置卡片积分合计显示；输入框积分胶囊；模型可用 |
| unified-model-center | 工具栏只显示一个模型选择器；弹窗 560×470；点击切换模型 |
| memory-nodes | 平台/项目记忆节点正常读写 |
| prompt-polish | 输入框下方润色按钮出现、点击可用 |
| credit-hud | 左下角「积分」入口与各平台余额正常 |

### 步骤 6：收尾

- 全部验证通过后，旧目录改名为 `*_backup` 保留一个观察期（建议 1 周），不立即删除。
- 根仓库做首次本地提交：`git add . && git commit -m "chore: 集中管理自建 DSH 插件源码"`。
- 暂不配置 remote（按用户决定）。

## 五、换机迁移脚本设计（`scripts\link-plugins.ps1`）

职责：

1. 接收参数：`-ProfileDir`（默认 `C:\Users\hhwxx\.dsh\profiles\desktop`）。
2. 对每个插件，删除旧符号链接（若存在），创建新符号链接指向 `$PSScriptRoot\..\packages\<name>`。
3. 打印每个链接的新旧指向，便于核对。
4. 支持 `-WhatIf` 预演（先打印不执行）。

> 换机流程：clone 仓库 → 安装 DSH → 运行脚本 → 刷新页面验证。

## 六、风险与回退

| 风险 | 应对 |
|---|---|
| 符号链接切换后插件不加载 | 逐个切换；失败立即切回旧路径；旧目录保留为 backup |
| loomy-connect subtree 历史合并冲突 | 先在临时目录演练 subtree；当前工作区改动另存补丁再叠加 |
| workspace 配置影响 DSH 加载 | 不改插件内部 package.json 名称/版本/入口；切换后逐项验证 |
| 误删源码 | 迁移期只复制/移动，不删除；观察期后才清理 |

## 七、待办（用户确认后再执行）

- [ ] 建仓库骨架（git init + workspace 配置）
- [ ] 迁入 5 个插件（loomy-connect 用 subtree 保留历史）
- [ ] 收敛文档到 `docs\`
- [ ] 逐个切换符号链接并验证
- [ ] 编写 `scripts\link-plugins.ps1`
- [ ] 首次本地提交（不推送）
- [ ] 观察期后处理旧目录
- [ ] 单独处理删除待办：dsh-loomy-settings 源码；credit-board（先停用 Windows 计划任务）

---

**结论**：以 `D:\obj\dsh-mod-sel` 为唯一本地总仓库，用 pnpm workspace 收纳 5 个已确认插件，保留 loomy-connect 的 git 历史，符号链接逐个切换验证；GitHub 推送与两处源码删除均列为后续待办，本次不动。
