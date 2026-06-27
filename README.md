# askuserquestionspro

> A beautiful, fully local web UI for Claude Code's `AskUserQuestion` tool — answer the model's questions in a full-screen, keyboard-driven interface instead of the built-in terminal picker.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3c873a.svg)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

## What it does

When Claude Code wants to ask you a multiple-choice clarifying question, it calls its built-in `AskUserQuestion` tool — which normally opens a compact picker inside your terminal.

`askuserquestionspro` installs a `PreToolUse` hook that intercepts that call and instead opens a full-screen interactive UI in your browser: clean question cards, a sidebar with progress, single- and multi-select options, a growing text area for free-form "Other" answers, and a review screen where you can edit anything before submitting. Your answer flows straight back to Claude Code, which continues exactly as if you had used the native picker.

Everything runs on `127.0.0.1` — there is no remote service, no telemetry, and no npm runtime dependencies (Node core only). React, ReactDOM, and Babel are served from local vendored files, so the UI works fully offline.

If anything goes wrong — the bridge is down, the request times out, the data is malformed, or you close the tab — the hook silently steps aside (`process.exit(0)`) and Claude Code falls back to its native picker. It never blocks the model.

```
              YOUR MACHINE — everything on 127.0.0.1, no outbound traffic
  ┌────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  Claude Code ──"need to ask"──► AskUserQuestion tool                      │
  │      │                                                                   │
  │      │  PreToolUse hook intercepts (hooks/askuserquestionspro-bridge.mjs)            │
  │      ▼                                                                   │
  │  local bridge (server/server.js, :4517) ──SSE push──► Browser UI         │
  │      ▲                                          │                         │
  │      └──────────────── answers ◄────────────────┘  (you select)          │
  │      │                                                                   │
  │      ▼                                                                   │
  │  Claude Code receives the answer and continues the task                  │
  │                                                                          │
  └────────────────────────────────────────────────────────────────────────┘
```

## Installation

**Prerequisites:** Node.js 18+. A POSIX shell (and optionally `jq`) for the `install.sh` path.

### Quick install (one line)

```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
```

This downloads the project, copies the hook and `web/` assets to `~/.local/share/askuserquestionspro`, and adds an idempotent `AskUserQuestion` `PreToolUse` hook to `~/.claude/settings.json`. Then start a new `claude` session — that's it.

### With npm

```bash
npm install -g askuserquestionspro
askuserquestionspro install
```

### From a local clone (no npm)

```bash
./install.sh
```

`./install.sh` and `askuserquestionspro install` write the same idempotent hook entry, so they are interchangeable.

### CLI commands

| Command | What it does |
|---------|--------------|
| `askuserquestionspro install` | Adds the hook to `~/.claude/settings.json` and registers the MCP server |
| `askuserquestionspro uninstall` | Removes the hook |
| `askuserquestionspro serve` | Runs the bridge in the foreground for debugging (port 4517) |
| `askuserquestionspro mcp` | Starts the MCP server manually (for debugging or manual registration) |
| `askuserquestionspro doctor` | Checks hook installation, hook file, bridge health, and MCP registration |

The same `serve` step is available via `npm run serve`, and `npm run install-hook` runs `askuserquestionspro install`.

## Asking many questions at once

Claude Code's built-in `AskUserQuestion` tool is hard-capped at 1–4 questions per call by the model's own contract. `askuserquestionspro` lifts that limit entirely with a companion MCP tool.

### How it works

When Claude needs to ask a large set of questions (more than 4), it calls `mcp__askuserquestionspro__ask` instead of `AskUserQuestion`. The MCP tool accepts a `questions` array with no upper limit and routes everything through the same bridge, server, and web UI you already use.

```
   Small set (≤ 4 questions)          Large set (> 4 questions)
   ─────────────────────────          ─────────────────────────
   AskUserQuestion (native)     →     mcp__askuserquestionspro__ask (MCP tool)
   PreToolUse hook intercepts   →     MCP server handles directly
         │                                      │
         └──────────── same bridge + web UI ────┘
                        (127.0.0.1:4517)
```

Answers come back to the model as a normal tool-result. The routing guidance lives in the MCP tool's own description, so no extra configuration is needed on your side.

### Installation and registration

`install.sh` (and `askuserquestionspro install`) register the MCP server automatically:

- If the `claude` CLI is present: `claude mcp add --scope user askuserquestionspro -- node <path/to/askuserquestionspro-mcp.mjs>`
- Otherwise it prints the command for manual registration.

A repo-root `.mcp.json` provides project-scoped registration for development use:

```json
{ "mcpServers": { "askuserquestionspro": { "command": "node", "args": ["mcp-server/askuserquestionspro-mcp.mjs"],
                              "timeout": 3600000 } } }
```

The `askuserquestionspro doctor` command reports whether the MCP server is registered.

### Session timeout (`MCP_TOOL_TIMEOUT`)

The MCP tool blocks until you finish answering. Claude Code's default per-tool timeout is effectively unlimited (~28 hours), so long answering sessions work out of the box. The `.mcp.json` registration sets `timeout: 3600000` (1 hour) as an additional project-level safeguard.

### Fallback if the MCP tool fails

If the bridge is down, a question set is already pending (409), or any other error occurs, the MCP tool returns an `isError` result that tells the model to fall back to the native `AskUserQuestion` tool. The bridge-is-locked invariant holds: askuserquestionspro never blocks the model.

### `ASKUI_FORCE_MCP` — optional redirect

By default, small sets flow through the native `AskUserQuestion` hook. If you want the hook to actively redirect the model toward `mcp__askuserquestionspro__ask` instead:

```bash
ASKUI_FORCE_MCP=1 claude
```

When set, the `PreToolUse` hook returns a `permissionDecision: "deny"` with a message steering the model to use `mcp__askuserquestionspro__ask`. Unset (the default), the hook behaves exactly as before. This is fully opt-in.

### Large-set UI (more than 8 questions)

When a question set has more than 8 questions, the UI activates additional navigation features automatically. At 8 or fewer questions, the UI is visually unchanged.

| Feature | Description |
|---------|-------------|
| **Accordion sections** | The sidebar groups questions by their `header` field into collapsible sections, each showing an answered/total count. |
| **Search + filter** | A text filter box searches question text; a "show only unanswered" toggle narrows the list. |
| **Jump to next unanswered** | Press `u` (or the sidebar button) to jump instantly to the next question without an answer. |
| **Skip remaining & review** | A bulk button goes straight to the Review screen without stepping through every remaining question. |

No new dependencies, no build step, no new CSS design tokens.

---

## Usage

Once the hook is installed, just use Claude Code normally:

1. You work in Claude Code. At some point Claude asks a clarifying question.
2. The browser UI **opens automatically** at `http://127.0.0.1:4517` (the bridge starts on demand if it isn't already running).
3. Pick an option with the number keys. For single-select, press the same key again (or `Enter`) to confirm; for multi-select, toggle options then press `Enter`. Choose **Other** to open a growing text area and write a free-form answer of any length.
4. When every question is answered, the **Review** screen appears. Edit anything, then press `Enter` to submit.
5. Your answer returns to Claude Code, which resumes the task right where it left off.

Keep the browser tab open across a session — it waits for the next question and updates live over Server-Sent Events.

## Themes

The UI ships with **5 distinct themes** — not just recolors, but full design-token swaps covering color, fonts, shadows, corner radius, texture, motion, and glass/blur effects. Switch between them from the **Theme** picker at the bottom of the sidebar; your choice is saved to `localStorage` and restored on the next launch. You can also force a starting theme with a `?theme=<id>` URL parameter (handy for sharing or testing — it doesn't remove the picker).

| Theme | Character |
|-------|-----------|
| **AMOLED** | Pure black, blue accent, Geist — the default |
| **Paper** | Warm off-white, Newsreader serif headings, terracotta accent, sharp corners, flat |
| **Phosphor** | CRT green, full monospace (Geist Mono), square corners, scanline texture + glow |
| **Dusk** | Warm charcoal, amber accent, rounded corners, soft shadows |
| **Aurora** | Indigo glassmorphism, violet/cyan, blur + translucent surfaces, large radius |

Themes are stored in `web/themes.js` as pure data: AMOLED is the base, and every other theme carries only its **delta** (token overrides) — roughly 15–30 lines each. Adding a new theme means appending one object to the registry.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`9` | Select the option at that index |
| same key again | Confirm a single-select choice |
| `Enter` | Confirm a multi-select; submit on the Review screen |
| `Enter` on **Other** | Open the text area to type a free-form answer |
| `Enter` in text area | Save the answer |
| `Shift`+`Enter` in text area | Insert a new line |
| `Esc` in text area | Cancel |
| `←` / `→` | Navigate between questions |
| `B` | (Review screen) Go back to unanswered questions |
| `U` | (Large sets, N > 8) Jump to the next unanswered question |

## Configuration

- **Port:** The bridge listens on `4517` by default. Override it by setting the `ASKUSER_PORT` environment variable — it's read by both the server and the hook, so set it consistently.
- **Hook entry:** Installation adds a single `PreToolUse` entry to `~/.claude/settings.json`:

  ```json
  {
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "AskUserQuestion",
          "hooks": [
            { "type": "command", "command": "node \"/path/to/askuserquestionspro-bridge.mjs\"", "timeout": 360 }
          ]
        }
      ]
    }
  }
  ```

  The install logic is idempotent: it won't add a duplicate, and it refuses to clobber an existing third-party `AskUserQuestion` hook.

## Troubleshooting

- **The native picker shows up instead of the browser UI.** This is the safe fallback — it means the bridge was down, timed out, or returned an error. Check the bridge with `curl http://127.0.0.1:4517/health` (expects `{"ok":true}`), or run `askuserquestionspro doctor` for a full status check.
- **The UI doesn't open at all.** Start the bridge manually with `askuserquestionspro serve` (or `node server/server.js`) and open `http://127.0.0.1:4517` in your browser.
- **Spaces in the install path** (for example `Application Support`). The hook command is written with the path wrapped in double quotes, so paths with spaces work. If you hand-edited `settings.json`, make sure the `node "<path>"` command keeps those quotes.
- **Two questions at once.** The bridge holds exactly one question set at a time. A second concurrent set — whether from the hook or from `mcp__askuserquestionspro__ask` — is rejected (409) and falls back to the native picker. There must be only one `PreToolUse` hook for `AskUserQuestion` (Claude Code issue #15897) — `askuserquestionspro doctor` flags conflicts.
- **`mcp__askuserquestionspro__ask` is not available.** Run `askuserquestionspro doctor` to check MCP registration. If the server is not registered, run `askuserquestionspro install` again or manually execute `claude mcp add --scope user askuserquestionspro -- node ~/.local/share/askuserquestionspro/mcp-server/askuserquestionspro-mcp.mjs`.
- **The MCP tool times out before you finish answering.** The default MCP tool timeout in Claude Code is effectively unlimited. If you've set `MCP_TOOL_TIMEOUT` explicitly, make sure it's at least as long as your longest expected answering session (e.g., `MCP_TOOL_TIMEOUT=3600000` for 1 hour).
- **Offline / air-gapped.** No internet is required at runtime: React, ReactDOM, and Babel are served from local vendored files under `web/vendor/`. (Web fonts are loaded from Google Fonts for styling only; the UI works without them.)

## Tests

```bash
npm test   # node --test, zero dependencies
```

## Release flow (maintainers)

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and publishing.

1. **Add a changeset to your PR:**
   ```bash
   npx changeset   # select bump type (patch / minor / major), describe the change
   ```
   Commit the generated `.changeset/*.md` file alongside your PR.

2. **Merge the PR to `main`.** The `release.yml` workflow runs and the Changesets bot opens (or updates) a **"Version Packages"** PR that bumps `package.json`, updates `CHANGELOG.md`, and removes consumed changesets.

3. **Merge the Version Packages PR.** The workflow publishes to npm with provenance, creates a git tag, and generates a GitHub Release — all automatically.

A PR merged without a changeset causes no release; it simply waits for the next Version Packages merge. Safe and idempotent.

### Contributing

- Run `npm run lint` and `npm run format:check` before opening a PR (CI enforces both).
- Run `npm test` — tests use Node's built-in test runner, no extra dependencies.

## License

MIT
</content>
</invoke>
