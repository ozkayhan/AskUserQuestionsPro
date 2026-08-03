# askuserquestionspro

> A local, full-screen structured-question UI for Claude Code, Codex CLI, and
> the Codex surface in the ChatGPT desktop app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3c873a.svg)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)

## What it does

`askuserquestionspro` replaces cramped terminal prompts with a keyboard-driven
browser UI: grouped question cards, six question types, sidebar navigation,
free-form "Other" answers where applicable, and a final review screen.

The question/answer core is host-neutral. Both host adapters use the same MCP
server, bridge client, local HTTP server, Server-Sent Events stream, and web UI:

```text
Claude Code native AskUserQuestion ── PreToolUse hook ─┐
                                                       ├─ bridge client → localhost server ⇄ browser UI
Claude Code / Codex / ChatGPT Desktop ── MCP + skill ──┘
```

The host adapters are intentionally different:

- **Claude Code:** a `PreToolUse` hook can intercept the native
  `AskUserQuestion` call. The MCP tool is also available for unlimited or richer
  question sets.
- **Codex CLI and ChatGPT desktop app:** Codex `PreToolUse` hooks can observe,
  block, or rewrite `request_user_input` arguments, but cannot return the
  user's answers as that tool's result. Integration therefore installs the
  `mcp__askuserquestionspro__ask` tool plus an `askpro` skill that guides the
  agent to prefer it when structured choices or review improve the interaction.
  This is not native `request_user_input` result replacement.

Everything sensitive stays on `127.0.0.1`; there is no remote application
service or telemetry. Runtime code has no npm dependencies. React, ReactDOM,
and Babel are vendored locally. Theme fonts may be requested from Google Fonts,
so an offline UI uses local fallback fonts while the question flow still works.

## Installation

Prerequisites: Node.js 18+. The shell installer also needs `git`, or
`curl` + `unzip`.

### Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
```

### npm

```bash
npm install -g askuserquestionspro
askuserquestionspro install
```

### Local clone

```bash
./install.sh
```

All install paths accept the same target selector:

```bash
askuserquestionspro install --target auto
./install.sh --target all
```

| Target   | Behavior                                                                             |
| -------- | ------------------------------------------------------------------------------------ |
| `auto`   | Detect installed hosts; if none is detected, prepare Claude files for compatibility. |
| `all`    | Configure both Claude Code and Codex.                                                |
| `claude` | Configure only Claude's hook, MCP registration, and skill.                           |
| `codex`  | Configure only Codex MCP registration and skill; do not touch Claude.                |

Host discovery checks `claude`/`codex` on `PATH` and supports
`ASKUI_CLAUDE_BIN` / `ASKUI_CODEX_BIN` overrides. On macOS, Codex discovery
also checks the bundled executables inside `/Applications/ChatGPT.app` and
`/Applications/Codex.app` (plus the corresponding `~/Applications` locations
in the shell installer/uninstaller).

Installation deploys the guidance skill to the host-native discovery paths:

- Claude Code: `~/.claude/skills/askpro`
- Codex and ChatGPT Desktop: `~/.agents/skills/askpro`

The Codex CLI and Codex in ChatGPT Desktop share the MCP configuration written
by `codex mcp add`; restart the desktop app or open a new task after install.

## CLI

| Command                                        | What it does                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `askuserquestionspro init [--target ...]`      | Alias for `install`.                                                                                  |
| `askuserquestionspro install [--target ...]`   | Install selected host adapters, MCP registration, and skills.                                         |
| `askuserquestionspro uninstall [--target ...]` | Remove selected host registrations and skills.                                                        |
| `askuserquestionspro doctor [--target ...]`    | Check each selected host's hook (Claude), skill, and MCP registration, plus package and bridge state. |
| `askuserquestionspro serve`                    | Run the local bridge in the foreground.                                                               |
| `askuserquestionspro mcp`                      | Run the stdio MCP server in the foreground.                                                           |
| `askuserquestionspro settings ...`             | List settings, or use `get <key>` / `set <key> <value>`.                                              |

The standalone helpers also support host selection:

```bash
./reinstall.sh --target codex
./uninstall.sh --target all
```

`uninstall.sh` continues cleanup across failures, removes the selected hosts'
MCP registrations and skill directories, and verifies remaining files,
settings, registrations, and bridge processes. A host-specific uninstall keeps
the shared runtime and UI settings when the other host is still installed.
`--keep-skill` preserves both skill directories that are in scope.

## MCP tool

The installed tools are `mcp__askuserquestionspro__ask`,
`mcp__askuserquestionspro__resume`, and
`mcp__askuserquestionspro__list_recoverable_rounds`. `ask` accepts one or many
questions; there is no schema-level `maxItems` limit. Six types are supported:

| Type      | Result value                                    |
| --------- | ----------------------------------------------- |
| `binary`  | selected label (`string`)                       |
| `single`  | selected label or free-form Other (`string`)    |
| `multi`   | selected labels (`string[]`)                    |
| `scale`   | numeric value (`number`)                        |
| `ranking` | labels in chosen order (`string[]`)             |
| `tree`    | root-to-leaf path (`string[]`, maximum depth 6) |

Example:

```json
{
  "questions": [
    {
      "question": "Which release channel should we use?",
      "header": "Release",
      "type": "single",
      "options": [
        { "label": "Stable", "description": "Slower, lower risk" },
        { "label": "Preview", "description": "Earlier access" }
      ]
    }
  ]
}
```

Successful calls return both JSON text content and MCP `structuredContent`:

```json
{ "answers": { "Which release channel should we use?": "Stable" } }
```

The MCP server validates the complete question payload before starting the
bridge. Options must be objects with a string `label` (for example,
`[{ "label": "Stable" }]`); string arrays such as `["Stable"]` are rejected
immediately with an actionable `Invalid question input` message. HTTP bridge
validation errors preserve their status and body instead of being hidden behind
a pending-round timeout.

The tool declaration includes an `outputSchema` requiring the `answers`
object and MCP annotations (`readOnlyHint: true`, `destructiveHint: false`,
`openWorldHint: false`, `idempotentHint: false`). The MCP `initialize`
response also provides server instructions that recommend the rich UI and name
the host-native fallback. These metadata improve discovery and typed result
handling; the installed skill remains the explicit usage guidance for hosts.

The bridge registers a pending round before opening the browser. This prevents
the browser from racing ahead and briefly rendering an empty state. The tool's
own answer wait is bounded to one hour. If a host connection disappears without
explicit cancellation, call `mcp__askuserquestionspro__resume` before starting a
duplicate round; the browser round remains recoverable for that bounded window.
If `ask` reports `round_in_progress`, use
`mcp__askuserquestionspro__list_recoverable_rounds` to obtain only redacted
round metadata. Resume an exact detached or reconnecting `roundId`; a drafting
round is still owned by the original ask call.
If resume is unavailable, the model is told to use the native fallback available
in that host: `request_user_input` in Codex or `AskUserQuestion` in Claude Code.

## Claude hook behavior

Claude installation adds one idempotent `AskUserQuestion` `PreToolUse` entry to
`~/.claude/settings.json`. It refuses to overwrite a conflicting third-party
hook. On success, answers are returned as an allowed `updatedInput`; on hook
failure or an all-skipped response, the hook exits successfully without a
decision so Claude can show its native picker.

`ASKUI_FORCE_MCP=1 claude` makes the Claude hook deny the native call with
guidance to use `mcp__askuserquestionspro__ask`. This is Claude-specific and
opt-in; it does not add Codex interception.

## Browser experience

The bridge starts on demand and serves `http://127.0.0.1:4517`. Keep the tab
open to receive later rounds over Server-Sent Events.

- Themes: AMOLED, Paper, Phosphor, Dusk, and Aurora.
- Large sets (more than eight questions): grouped accordion navigation,
  search, unanswered-only filter, next-unanswered jump, and skip-to-review.
- Keyboard: `1`–`9` selects, `Enter` confirms/submits, `Shift+Enter` inserts a
  newline, arrows navigate, `B` returns from review, and `U` jumps to the next
  unanswered question in large sets.

Only one question set can be pending at a time. A concurrent second set is
rejected with HTTP 409 so answers cannot cross rounds.

## Configuration

- `ASKUSER_PORT`: bridge port, default `4517`.
- `ASKUI_FORCE_MCP`: Claude-only opt-in redirect to the MCP tool.
- `ASKUI_CLAUDE_BIN` / `ASKUI_CODEX_BIN`: explicit host executable paths.
- `ASKUSER_TARGET`: default target for shell install/uninstall helpers.
- `XDG_CONFIG_HOME`: base for persisted UI settings; default
  `~/.config/askuserquestionspro/settings.json`.

## Troubleshooting

Compatibility is evidence-gated: see the [host matrix](test/host-compatibility-evidence.md),
[capability cards](docs/host-capability-cards/), and [native OS limitations](docs/evidence/phase-13-native-os-runs.md).
`Researching`, `Unsupported`, and `Unavailable` rows are not support promises.

- Run `askuserquestionspro doctor --target all` to see host-specific hook,
  skill, and MCP registration status. Use a narrower target when only one host
  is intended.
- If Codex cannot see the tool, run `askuserquestionspro install --target codex`,
  then start a new Codex task or restart ChatGPT Desktop.
- If Claude shows its native picker, inspect stderr entries prefixed
  `[askuser:<scope>]` and run `askuserquestionspro doctor --target claude`.
- If the UI does not open, run `askuserquestionspro serve` and visit
  `http://127.0.0.1:4517`.
- The hook has a 30-second stdin-read watchdog and each hook/MCP answer wait is
  bounded to one hour. These are application limits; Codex installation also
  requests a 3600-second MCP tool timeout, but a host can still impose another
  deadline. Use the resumable round recovery when a host disconnects.

## Tests

```bash
npm test
```

The current suite contains 21 `*.test.js` files. In addition to bridge,
server, browser, settings, install, workflow, and accessibility coverage, it
now tests target parsing and host selection, macOS bundled Codex discovery,
host-specific MCP CLI arguments, native skill destinations, Codex-only
install/doctor/uninstall isolation, and MCP instructions, `outputSchema`, and
annotations.

Before contributing, run `npm run lint`, `npm run format:check`, and
`npm test`. Releases use Changesets: add a changeset, merge it, then merge the
generated Version Packages PR to publish.

The maintained [v1.1.1 release handoff](docs/evidence/v1.1.1-release-handoff.md)
indexes current Phase 14–17 evidence and separates local PASS results from
PARTIAL or UNAVAILABLE browser-runtime, native-OS, and authenticated
Claude/Codex handoffs. Phase 19 owns the final clean-checkout release decision,
including complete install, upgrade, and uninstall proof.

## License

MIT
