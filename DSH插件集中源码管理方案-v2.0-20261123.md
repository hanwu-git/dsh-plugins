# DSH 自建插件集中源码管理方案（含插件市场发布）

| 项目 | 内容 |
|---|---|
| 文档版本 | **v2.0**（重大路线升级：从"本地 monorepo + 符号链接"升级为"monorepo + GitHub + 市场索引"） |
| 编制日期 | 2026-11-23（北京时间 UTC+8） |
| 仓库位置 | `D:\obj\dsh-mod-sel`（当前工作目录） |
| Git 策略 | **已变更**：用户确认走市场方式 → 需推送公开 GitHub 仓库（推翻 v1.0 的"暂不推"） |
| 目标 | 本地集中源码 → 发布 GitHub → 其他 DSH 通过插件市场下载安装并更新 |
| 本次范围 | 输出方案 v2.0；迁移与发布待用户确认后执行 |

> 依据：`dsh-doc` skill 的 `plugin-development.md` / `host-plugin.md`、本机 `plugin-market-bundle/docs/DETAIL.md`、DSH 官方 Agent Note《插件市场索引格式》（`2026-10-02-plugin-market-index-format.zh.md`）、[插件索引官方指南](https://deepseek-harness.github.io/deepseek-harness/guide/plugin-market.md)。
> v1.0 原件 `DSH插件集中源码管理方案-v1.0-20261123.md` 保留不改。

---

## 一、路线变更说明

| 维度 | v1.0（本地符号链接） | v2.0（市场方式，本次确认） |
|---|---|---|
| 其他 DSH 使用 | clone + 跑链接脚本 | 添加索引 URL → 网页点安装 |
| 更新 | 手动 git pull | Git commit 安装的可在发现页一键更新 |
| 展示 | 无 | 有图标/标题/描述/详情页 |
| 前置 | git init + 链接脚本 | 还需公开仓库、index.json、发布流程 |
| 风险 | 低 | 索引无签名；图标请求暴露 IP；须声明 engines.dsh |

**结论**：两者不冲突。正确顺序是 **本地 monorepo（源码基地）→ GitHub 发布 → 索引文件 → 其他 DSH 安装**。

## 二、目标结构

```
D:\obj\dsh-mod-sel\                       ← 唯一源码仓库（git）
├── .git\
├── pnpm-workspace.yaml                   ← packages: - 'packages/*'
├── package.json                          ← 私有根包
├── README.md                             ← 仓库总览
├── index.json                            ← ★ 插件市场索引（发布到 GitHub Pages/raw）
├── packages\
│   ├── loomy-connect\                    ← git subtree 保留历史
│   ├── unified-model-center\
│   ├── memory-nodes\
│   ├── prompt-polish\
│   └── credit-hud\
├── icons\                                ← 索引引用的图标（相对 URL）
├── docs\
│   ├── 自建插件清单.md
│   ├── 统一模型中心-需求与设计方案.md
│   ├── 模型选择宽改版资料汇总（README 两版 + 原型 HTML）
│   └── 本方案文档
└── scripts\
    ├── link-plugins.ps1                  ← 本地开发用：重建 profile 符号链接
    ├── build-index.mjs                   ← ★ 生成/校验 index.json
    └── publish.ps1                       ← ★ 打 tag、推 GitHub、刷新索引
```

## 三、市场机制要点（已核实）

### 3.1 发现与安装流程（DSH 0.2.2-rc.3）

1. 打开 **插件页 → 发现（Discover）** 标签。
2. 点 **添加索引源**，填入 `index.json` 的 `https:` URL（不得含用户名/密码/`#` 片段）。
3. 卡片显示推荐版本；点 **安装** 弹确认框（版本来源、索引 URL、兼容性），确认后走 `install_bundle`。
4. **更新**：仅"从 Git commit 安装"的副本支持在发现页更新到更新的 Git 版本 → 因此**必须用 git source 发布**。

### 3.2 index.json 格式（format 1，官方规范摘要）

根字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `format` | 是 | 整数 `1` |
| `title` | 是 | `LocalizedText`，如 `{"zh":"老韩的 DSH 插件","en":"Hanwu's DSH Plugins"}` |
| `description` | 否 | `LocalizedText` |
| `plugins` | 是 | 插件数组，初始展示顺序即数组顺序 |

插件字段：`name`（包名，唯一）、`title`/`description`（LocalizedText）、`icon`（相对 URL 或 data URI ≤32KiB）、`author`、`homepage`、`repository`、`dist-tags`、`versions`。

版本字段：

| 字段 | 说明 |
|---|---|
| `version` | 精确版本字符串 |
| `publishTimestamp` | Unix 秒 |
| `source` | `{type:"git", url:"https://github.com/<owner>/<repo>", commit:"40位小写SHA", path:"packages/<name>"}` 或 `{type:"npm", registry?}` |
| `engines.dsh` | 必填有效 SemVer 范围，如 `">=0.2.2 <0.3.0"`，*`*` 表示任意版本* |

> 校验器：`@deepseek-ai/dsh-plugin-market-index` 可对索引做本地校验；发布前跑一遍可避免"整个索引被拒"。
> 参考索引：[awesome-dsh-plugin.com/index.json](https://awesome-dsh-plugin.com/index.json)。

### 3.3 对现有 5 个插件的适配要求

| 插件 | 当前 package.json | 市场发布前需补 |
|---|---|---|
| loomy-connect | 有 name/version，有 `dsh.bundle`，无 engines.dsh | 加 `engines.dsh`；`locale/*.json` 补 `meta.title/description`；确认 `icon` 导出 |
| unified-model-center | 有 name/version/`dsh.bundle` | 同上 |
| memory-nodes | 待检查 | 同上 |
| prompt-polish | 待检查 | 同上 |
| credit-hud | 待检查 | 同上 |

> `host-plugin.md` 要求：导出 `./locale/*.json` 与 `./icon`，`files` 含 patch/locales/docs/icon；图标 ≤256KiB、SVG/PNG/JPEG/WebP、包内路径、非符号链接。缺显示元数据会退化为包名+默认图标。

## 四、执行步骤（待确认后实施）

### 阶段一：本地源码集中（低风险，先做）

1. `D:\obj\dsh-mod-sel` 执行 `git init`，建 workspace 骨架（根目录 + `packages\` + `docs\` + `scripts\` + `icons\`）。
2. 迁入 5 个插件：
   - `loomy-connect`：`git subtree add --prefix=packages/loomy-connect <旧仓库> main` 保留历史；再把当前工作区已改的积分卡片合计改动覆盖进去。
   - `unified-model-center`、`memory-nodes`、`prompt-polish`、`credit-hud`：复制/移动到 `packages\`。
3. 收敛现有 7 份文档与原型到 `docs\`。
4. 为每个插件补 `engines.dsh`、`meta.title/description`（zh/en）、校验 `icons`。
5. 用 `@deepseek-ai/dsh-plugin-market-index` 校验插件 manifest；首次本地提交。

### 阶段二：发布到 GitHub（需网络/账号）

1. 在 GitHub 建公开仓库（建议 `hanwu-git/dsh-plugins`），本地 `git remote add origin`。
2. 写 `scripts\build-index.mjs`：
   - 读各 `packages/*/package.json` 与 `git rev-parse HEAD` 得到 commit SHA；
   - 生成 `index.json`，`source` 用 git 类型（url + commit + path），`engines.dsh` 从 manifest 复制；
   - 调用校验器验证。
3. 发布 `index.json` 与 `icons\` 到 GitHub Pages（或同仓库 `gh-pages` 分支），得到公开 https URL。
   -备选：直接用 `raw.githubusercontent.com/<owner>/<repo>/main/index.json`（同样可用，但主机缓存/限流需留意）。
4. 推送代码与 tag。

### 阶段三：跨 DSH 安装验证

1. 在**另一台 DSH**（或新建 profile）插件页 → 发现 → 添加索引 URL。
2. 逐插件安装，核对：确认框来源（Git URL + commit + path）、标题/图标/描述正确、安装后功能正常。
3. 改一处代码 → 新 commit → 重生成索引 → 在发现页验证"更新"按钮可用。
4. 验证通过后，本机可继续保持现有符号链接，也可切换为市场安装版（二选一，用户定）。

### 阶段四：收尾

- 旧目录改名 `*_backup` 观察 1 周。
- 删除待办（本次不动）：`dsh-loomy-settings` 源码；`credit-board`（**先停用 Windows 计划任务 `DSH-CreditBoard` 等**，再删 `C:\Users\hhwxx\AppData\Local\credit-board`；DSH 内 10:10 签到任务独立不受影响）。

## 五、风险与控制

| 风险 | 控制 |
|---|---|
| 索引格式违规 → 整个索引被拒 | 发布前用官方校验器验证；字段严格按 format 1 |
| `engines.dsh` 不匹配当前 DSH | 统一写 `>=0.2.2 <0.3.0`（本机 0.2.2-rc.3），或 `*` 先跑通 |
| Git commit 安装才可更新 | 坚持用 `source.type=git`，不用 npm |
| 索引无签名、图标暴露 IP | 只用自己信任的 GitHub Pages URL；图标用相对路径或内联小图 |
| 本机既有插件与市场版冲突 | 阶段三用另一台/新 profile 验证；本机切换是可选动作 |
| loomy-connect subtree 历史冲突 | 临时目录演练；当前工作区改动另存补丁再叠加 |

## 六、待办清单

- [ ] 阶段一：git init + workspace 骨架 + 迁入 5 个插件 + 文档收敛
- [ ] 为每个插件补 `engines.dsh`、locale `meta.*`、校验图标
- [ ] GitHub 建公开仓库并推送
- [ ] 写 `build-index.mjs` 生成并校验 `index.json`
- [ ] 发布索引到 GitHub Pages，拿到 https URL
- [ ] 另一台 DSH 添加索引源，逐插件安装验证
- [ ] 验证 Git 版本"更新"流程
- [ ] （可选）本机切换为市场安装版
- [ ] 删除待办：dsh-loomy-settings 源码；credit-board（先停计划任务）

---

**结论**：采用"本地 monorepo → GitHub 公开仓库 → format 1 索引 → 其他 DSH 发现页安装"的市场化路线；阶段一先在本地安全整理源码，阶段二/三再发布与跨机验证。所有迁移与删除动作仍需你确认后执行。
