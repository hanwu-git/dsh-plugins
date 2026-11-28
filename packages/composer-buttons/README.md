# @local/composer-buttons

ONE row under the composer holding every enabled button side by side, replacing
the separate prompt-polish row and the second quick-actions row that stacked
below it (the dock slot renders each entry on its own line, so separate plugins
can never share a line — merging is the only way).

| **Button** | **Action** | **Confirmation** |
|---|---|---|
| 润色提示词 | Single click: light polish. Double click: rewrite as a structured prompt. Uses the session's selected model. | None; Undo for 8 s after a change. |
| ⟳ 刷新 | `location.reload()` — instant page reload. | None. |
| ⏻ 重启 | Fully restarts the DSH desktop app. | Yes — in-flight turns abort. |

## Settings

The plugin settings card (Settings → Plugins → 输入框按钮组) lists every button
with:

- a **switch** that shows or hides the button (hidden buttons are not rendered
  at all, so a hidden restart cannot be triggered accidentally);
- the button's fixed **description** (what it does and what it costs);
- an editable **note** field whose text is appended to the button's tooltip —
  use it for personal reminders like "restart before leaving work".

## Why merged

`conversation.input.dock` is a `list` slot rendered inside a column flex
container (`composerStack`): each entry gets a full-width seat on its own line.
Two plugins therefore stack two rows no matter what widths they claim. One
plugin owning the whole row is the only way to keep the buttons horizontal.

## Restart mechanics

The browser cannot relaunch the app: DSH exposes no restart API to plugins
(verified against 0.2.2-rc.5). The Host route spawns a **detached PowerShell
helper** that outlives DSH:

1. ~800 ms after the HTTP ack, kill every process whose image path equals
   `exePath` **per PID** (not `/T`: the helper itself lives inside the DSH
   process tree, and a tree kill would terminate the helper before the
   relaunch).
2. Wait `delayMs` (default 3000) for locks to release.
3. `Start-Process` the exe again.

## Configuration (cordis.patch.yml)

| **Field** | **Default** | **Meaning** |
|---|---|---|
| `timeoutMs` | `45000` | Polish model call timeout (1000–600000). |
| `maxOutputTokens` | `1500` | Polish output cap (64–32000). |
| `exePath` | `D:\Program Files\DHS\DeepSeek Harness.exe` | The executable the restart helper relaunches. |
| `delayMs` | `3000` | Milliseconds between the kill and the relaunch (1000–30000). |
| `buttons.*.visible` | `true` | Per-button switch (settings card writes here). |
| `buttons.*.note` | `''` | Per-button tooltip note (settings card writes here). |

## Security

Both routes sit behind the connection trust fence (`connection.requestRejection`),
the same pattern prompt-polish shipped with.

## Dev notes (pitfalls)

- **configForms namespaces are patch row ids.** The Host settings provider
  serves each active row's config under `ns: entry.options.id` — the `id`
  field of the row in `cordis.patch.yml`. `ctx.configForms.get('<ns>')` must
  pass that exact id (`composer-buttons-host` here), not an invented name;
  a wrong key silently returns a form that never has a value.
- **Settings surfaces.** `settings.plugin.item` is NOT a generic "plugin card"
  slot on the Built-in plugins page — it belongs to the Models settings area.
  Per-button switches live in (1) `plugins.row.config` keyed
  `<package>#<rowId>` (Plugins page row detail) and (2) a self-owned
  `settings.section` nav page, the unified-model-center pattern, wrapped in
  `configForms.whileServed([...])` so registration waits for the namespace.
