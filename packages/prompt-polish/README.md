# @local/prompt-polish

Adds one button under the composer that rewrites the prompt currently in it.

| Gesture | What it does |
|---|---|
| **Click** | Light polish: grammar, ambiguity, structure. Your intent and approximate length survive. |
| **Double-click** | Rewrite: the rough text becomes a structured prompt making the goal, context, requirements, and expected output explicit. |

The result replaces the draft in place, and **Undo** stays available for a few
seconds, so a rewrite you dislike costs one click rather than a lost draft. The
replaced text is held in the button's own state and never written anywhere else.

## Which model runs

The model you have **selected in the session** — the same choice the model menu
shows, including its reasoning effort. The browser reads that selection with the
keyed `useProjection('modelSelection')` hook and sends it with the request, so the
polish cannot drift onto a different route than the one on screen. With no
recorded selection (a fresh session before its first prompt) the Host falls back
to the deployment's configured default model.

**Every click is one model request** against your provider account. The output is
capped (`maxOutputTokens`, 1500 by default) and the whole call is bounded
(`timeoutMs`, 45 s by default); both are config, not code.

## What it deliberately does not do

- **It does not send the message.** The composer keeps its draft for you to review
  and edit; polishing never triggers a turn.
- **It does not answer your prompt.** The system instruction forbids it in both
  modes, and the model returns only the rewritten text.
- **It does not persist anything.** No session event is appended, no draft is
  stored on the Host, and the completion exists only in the HTTP response. Turning
  the plugin off removes the button and leaves nothing behind.
- **It does not touch attachments or reference chips.** Only the text draft is
  replaced. `setDraft` drops inline reference chips by design — that is the Host
  API's own contract, and this plugin does not try to work around it.

## Limits worth knowing

- A prompt over `MAX_PROMPT_CHARS` (12000 characters) is refused rather than
  truncated: a silently shortened prompt would come back polished but missing the
  part you cared about.
- If you type while the model is thinking, the replacement still lands. The
  rewrite is applied through `setDraft`, which takes the whole draft; there is no
  merge. Undo brings your text back.
- The single/double click split uses a 250 ms window, so a single click acts after
  that pause rather than instantly.

## How it works

Two halves, and only the Host one can reach a model.

1. **Browser** registers one entry in `conversation.input.dock`, the zone the
   Conversation shell renders above the composer in **both** the blank new-task
   page (`hero`) and an active task. It reads the draft with `useInput`, writes
   the result with `inputActions.setDraft`, and reads the selected model from the
   keyed `useProjection('modelSelection')` projection. (The narrower
   `conversation.composer.dock` and `conversation.input.left` seats do not render
   on the new-task page, which is why the button used to be missing there.)
2. **Host** registers one exact route, `POST /prompt-polish/rewrite`, admitted by
   the composition's `connection` fence first — the Host/Origin check plus browser
   authentication, the same trust surface every shipped route uses. On top of it
   the route validates at the wire: a POST, `application/json`, a 64 KiB ceiling, a
   non-empty prompt within the limit, and a known mode. The call follows the shape
   the shipped session-title plugin uses: `ctx.llm.prepareCall(...)`, then assemble
   the stream.
