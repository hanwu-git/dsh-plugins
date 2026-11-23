# 记忆节点（Memory nodes）

为 DeepSeek Harness 提供平台级与项目级两个长期记忆节点（设计文档 v1.0）。

## 功能

- **双节点**：平台级（跨项目通用）与项目级（每个工作区一份）各维护「原始记录层（raw）」与「编译层（compiled）」两层。
- **自动注入**：编译层通过系统提示词动态上下文注入每个会话；内容不变时不产生重复开销。
- **模型工具**：`memory_write`（沉淀原始记录，自动脱敏）与 `memory_read`（查看记忆全文）。
- **二次编译**：将新增原始记录交给模型重新提炼为固定五节结构（概览/关键事实/偏好与约定/进行中事项/历史坑），可从插件详情页手动触发，也可按「新增 ≥ 20 条或距今 ≥ 24 小时」自动触发（均可配置）。

## 存储

全部集中在本机 `~/.dsh/memory/`（尊重 `DSH_HOME` 环境变量）：

```
memory/
├─ index.json                # 工作区路径 → workspaceId 映射
├─ platform/                 # 平台级节点
│   ├─ raw.jsonl / compiled.md / meta.json / history/
└─ projects/<workspaceId>/   # 项目级节点（按工作区）
```

## 配置（cordis.patch.yml 的 memory-nodes 行）

| 字段 | 默认 | 说明 |
|---|---|---|
| `compileProvider` / `compileModel` | 空 = 跟随会话路由 | 二次编译使用的模型对；两者须成对设置。留空时自动捕获当次会话的路由（首次正常会话请求后生效） |
| `autoCompile` | `true` | 是否启用自动编译 |
| `autoCompileRawDelta` | `20` | 触发自动编译的新增原始记录条数 |
| `autoCompileIntervalHours` | `24` | 触发自动编译的最小时间间隔 |
| `compiledInjectBytes` | `8192` | 单节点注入字节预算 |
| `rawMaxBytes` / `rawMaxLines` | `524288` / `2000` | 原始层滚动裁剪阈值 |

## 设置页

在「设置 → 插件」详情页提供「记忆节点」分区（`settings.section`）：

- 平台级与项目级节点各一张卡片：编译层字节数、原始记录数、待编译条数、最近编译时间与所用模型、编译层预览（前 40 行）。
- 每张卡片带「立即编译」按钮，经 `connection.rpc` 调用 Host 端同一编译入口（与工具路径共享逻辑）；失败原因直接显示在卡片上（`meta.lastError`）。
- 项目级卡片按工作区逐份展示（来自 `index.json` 的已知工作区清单）。

## 限制

- 编译调用直接走 `ctx.llm.stream()`，单次尝试，不自动重试；失败保留旧编译层并在元信息记录错误。
- 不存储凭据：写入与编译均做凭据样式字符串脱敏；请勿在记忆中保存密钥。
- 历史编译层保留最近 3 份（存档，暂无回滚 UI）。
