# 模型选择宽改版（统一模型中心）— 资料汇总 v1.1

> 本文件是 `README-模型选择宽改版.md` 的新版本副本（小幅修订 +0.1），原件保留不改。
> v1.1 变更：新增第六节，记录「原生模型选择器未被遮盖」问题的修复，并补充正式设计文档与更新后的文件清单。
> 修订日期：2026-11-23（北京时间 UTC+8）。

---

## 一、它是什么

「模型选择宽改版」在源码/原型里对应的正式名称是 **统一模型中心 / Unified Model Center**（插件 id：`@local/unified-model-center`）。

目标：把 Loomy / Trae / WorkBuddy / Qoder / 豆包等所有已连接平台的模型，集中到**一个独立的宽弹窗选择器**（固定 560×470）里，替代各连接器自己往输入框插的状态胶囊和模型入口。

核心设计：

- **完全独立**：只读各连接器公开的状态接口（`/plugins/*/usage`、`/status`、`/catalog`），不修改、不嵌入任何连接器插件。连接器升级不会改变本插件界面。
- **横排连接标签**：顶部标签悬停即切换下方模型列表。
- **每连接独立「常用」区**：按使用频率自动排序，最多 3 个，不跨连接混排。
- **信息密度**：模型行展示倍率、上下文长度、免费/限免、思考档位、生图标记；跨连接搜索。
- **真正切换模型**：点击模型调用宿主 `modelDirectories.select()`（DSH 官方会话模型选择 API），与原生选择器等价，下一次请求立即生效。
- **尺寸固定**：弹窗 560×470，模型多少都不跳动。

## 二、目录内容清单（v1.1 更新）

| 文件 | 类型 | 说明 |
|---|---|---|
| `dsh-unified-model-center/client.js` | 插件源码（浏览器端，约 51 KB） | 选择器 UI、常量、设置页、插槽注册；**v1.1 已修复原生选择器隐藏逻辑** |
| `dsh-unified-model-center/index.js` | 插件源码（宿主端） | 声明 Config schema（hidden / modelOrder / providerOrder） |
| `dsh-unified-model-center/package.json` | 插件元数据 | 名称 `@local/unified-model-center`，版本 1.0.0 |
| `dsh-unified-model-center/cordis.patch.yml` | 插件配置补丁 | 注册插件 id 与默认配置 |
| `dsh-unified-model-center/icon.svg` | 图标 | 插件图标 |
| `dsh-unified-model-center/locale/zh.json`、`en.json` | 多语言 | 插件中英文名称与描述 |
| `dsh-unified-model-center/docs/DETAIL.md` | 说明文档 | 功能、问题背景、使用方式 |
| `模型中心原型-统一模型选择器-v1.0-20261122.html` | 交互原型（含说明侧栏，552 行） | 可直接在浏览器打开的 UI 原型 |
| **`统一模型中心-需求与设计方案-v1.0-20261123.md`** | **正式设计文档（v1.1 新增）** | 需求、根因、方案、验证、风险的正式记录 |

## 三、原型 HTML 侧栏要点（原始设计说明）

1. **交互设计**：横排连接标签（悬停切换）→ 自动频率排序（常用区置顶）→ 左下角胶囊改为统一触发器 → 四类徽标（倍率/上下文/免费/思考等级）。
2. **为什么不被冲掉**：新插件只读连接器公开的 status 路由（`/plugins/*/usage`），不往连接器里插代码；连接器升级只改自己的路由，UI 不受影响。
3. **试用方式**：鼠标移到顶部标签切换列表；点「刷新」模拟使用次数变化触发常用区重排；搜索框跨连接器过滤。
4. 原型数据取自本机 5 个连接器实时接口。

## 四、使用 / 后续接手

- **看效果**：直接用浏览器打开 `模型中心原型-统一模型选择器-v1.0-20261122.html`。
- **装插件**：把 `dsh-unified-model-center\` 作为 bundle 插件安装/启用；设置 → 插件中启用后，输入框工具行出现「统一模型中心」胶囊（替代原模型选择器）。
- **改配置**：设置页可勾选显示哪些模型、用 ↑↓ 调整顺序；只影响「模型中心」弹窗，不改变 DSH 原生选择器或其它连接器配置。

## 五、来源与时间

- 来源项目空间：`dhsws`
- 源目录：`D:\obj\DHSws\dsh-unified-model-center\`
- 原型：`D:\obj\DHSws\模型中心原型-统一模型选择器-v1.0-20261122.html`
- 拉取时间：2026-11-23（北京时间 UTC+8）

## 六、v1.1 新增：原生模型选择器遮盖问题修复

### 6.1 问题

插件启用后，工具栏同时出现「模型中心」胶囊与原生模型选择器两个入口，未达到"只留一个选择器"的设计目标。

### 6.2 根因

原插件依赖纯 CSS 规则隐藏原生选择器：

```css
body:has([data-umc-trigger]) [data-slot="conversation.input.model"]{display:none!important}
```

调查确认：宿主 `SlotOutlet` 确实会输出 `data-slot="conversation.input.model"` 属性（此点先前曾误判为"无标识属性"，已纠正），但该锚点带 `display:contents`；纯 CSS 间接命中在目标环境中未能稳定生效。

### 6.3 修法（方案 A：JS 精确定位 + 守护 + 回退）

在 `client.js` 中：

1. 新增 `[data-slot="conversation.input.model"].umc-native-hidden{display:none!important}` 隐藏类规则，保留原 `:has()` 作双保险；
2. 新增 `findNativeAnchor()`：从自身 trigger 向上定位同时包含 `input.right` 与 `input.model` 的父容器，返回 model 锚点；
3. 新增 `hideNativePicker()`：给锚点加隐藏类；安装 `MutationObserver`（rAF 防抖）应对 React 重渲染；
4. 新增 `stopNativeSuppression()`：卸载时断开 observer 并移除隐藏类，原生选择器自动恢复；
5. 定位失败时 `console.warn` 并保持两个选择器都显示——**绝不出现"无选择器可用"状态**。

### 6.4 验证状态

| 项目 | 方法 | 结果 |
|---|---|---|
| JS 语法 | `node --check client.js` | 通过（exit 0） |
| 修改回读 | 逐段读取 3 处改动 | 与预期一致 |
| 三处文件同步 | SHA256 比对 | `dsh-mod-sel` / `DHSws` / profile 安装目录三处一致 |
| 界面实测 | DSH Web（`http://127.0.0.1:62050`，需会话令牌） | **待验收**（直连返回 401） |

完整分析见 `统一模型中心-需求与设计方案-v1.0-20261123.md`。
