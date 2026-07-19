# Overview

## What it is

`askuserquestionspro` is a Node.js package and CLI that provides a local,
themeable, full-screen UI for structured questions from Claude Code, Codex CLI,
and the Codex surface in ChatGPT Desktop. The bridge, schemas, answer mapping,
and browser experience are host-neutral; small adapters connect that core to
each host.

It solves two problems:

1. **Better UX.** Host-native pickers are compact. This renders questions in a
   keyboard-driven browser UI (AMOLED default + 4 alternate themes).
2. **Richer, larger rounds.** The MCP tool accepts one to unlimited questions
   and supports binary, single, multi, scale, ranking, and tree inputs.

## Host adapters

There are two entry paths into the same UI:

- **Claude hook path** — for native `AskUserQuestion` calls (≤4 questions). A
  `PreToolUse` hook registered in `~/.claude/settings.json` intercepts the
  call, opens the UI, and returns the user's answers as `updatedInput`. On any
  failure it exits cleanly and lets Claude Code fall back to the native picker.
- **Shared MCP path** — Claude Code, Codex CLI, and ChatGPT Desktop can call
  `mcp__askuserquestionspro__ask`, which opens the same UI and returns answers
  as JSON text plus structured MCP content.

Codex `PreToolUse` hooks can observe, block, or rewrite `request_user_input`
arguments, but cannot return the user's answers as that tool's result. Its
adapter therefore installs the MCP registration and the `askpro` skill under
`~/.agents/skills/askpro`; the skill tells the agent when to prefer askpro and
when to fall back to native `request_user_input`. Claude's skill is installed
under `~/.claude/skills/askpro`.

Both paths funnel through a tiny local HTTP **bridge server** (port `4517` by
default) that holds at most one pending question set in memory and pushes it to
the browser over Server-Sent Events. The browser POSTs answers back; the
server resolves the waiting promise; the hook/MCP returns.

```
Claude Code native AskUserQuestion → hook ─┐
Claude Code / Codex / ChatGPT Desktop → MCP ├→ bridge-client → bridge ⇄ browser UI
```

## Who it's for

Claude Code and Codex users who want a larger question interface, a review
step, richer input types, and larger batches. Install is
`npx askuserquestionspro init` or `install.sh`; use
`--target auto|all|claude|codex` to choose hosts.

## Key properties

- **Zero runtime dependencies** — Node core only (no npm `dependencies`).
- **Host-native fallback** — hook failures return to Claude
  `AskUserQuestion`; MCP errors tell the agent to use Codex
  `request_user_input` or Claude `AskUserQuestion` as appropriate.
- **Single-flight** — exactly one question set is in play at a time.
- **In-memory only** — no database; answers live in RAM until delivered.

## Browser recovery and delivery

Compatibility is evidence-gated. Candidate products in the [compatibility matrix](../test/host-compatibility-evidence.md)
remain `Researching` until installed, authenticated, version-pinned lifecycle
evidence exists. `Unsupported` and `Unavailable` are explicit non-support
states, not promises based on MCP discovery.

Refresh, reconnect, and origin changes use the durable bridge record as the
authority. The browser chooser includes only rounds with a live recovery path;
successfully delivered records are not offered again. When more than one
recoverable round exists, the browser presents a redacted exact-round chooser
rather than silently selecting the latest. Cached drafts are best-effort mirrors
keyed by opaque round/capability and revision; conflicts are explicit and never
silently merged.

The browser status vocabulary is text-backed: saved, delivery-pending,
delivered, delivery-uncertain, cancelled, and recovery-error. Delivery remains
visible until durable acknowledgement succeeds. After acknowledgement, the
current tab retires before it can render a later round and the default lifecycle
setting attempts to close it. A denied `window.close()` leaves the result open
with safe-to-close guidance. If the configured browser or profile cannot be
opened, the UI gives a copyable `127.0.0.1` URL and manual next step.

Recovery metadata and support-safe diagnostics contain opaque identifiers and
lifecycle data only. Question and answer content is not rendered in recovery
lists or error diagnostics. Keyboard focus belongs to the active recovery,
delivery, or settings dialog, and global question shortcuts are suspended
while that surface owns focus.
