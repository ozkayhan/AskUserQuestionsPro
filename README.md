# claude-askui

> A beautiful, fully local web UI for Claude Code's `AskUserQuestion` tool — answer the model's questions in a full-screen, keyboard-driven interface instead of the built-in terminal picker.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3c873a.svg)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

## What it does

When Claude Code wants to ask you a multiple-choice clarifying question, it calls its built-in `AskUserQuestion` tool — which normally opens a compact picker inside your terminal.

`claude-askui` installs a `PreToolUse` hook that intercepts that call and instead opens a full-screen interactive UI in your browser: clean question cards, a sidebar with progress, single- and multi-select options, a growing text area for free-form "Other" answers, and a review screen where you can edit anything before submitting. Your answer flows straight back to Claude Code, which continues exactly as if you had used the native picker.

Everything runs on `127.0.0.1` — there is no remote service, no telemetry, and no npm runtime dependencies (Node core only). React, ReactDOM, and Babel are served from local vendored files, so the UI works fully offline.

If anything goes wrong — the bridge is down, the request times out, the data is malformed, or you close the tab — the hook silently steps aside (`process.exit(0)`) and Claude Code falls back to its native picker. It never blocks the model.

```
              YOUR MACHINE — everything on 127.0.0.1, no outbound traffic
  ┌────────────────────────────────────────────────────────────────────────┐
  │                                                                          │
  │  Claude Code ──"need to ask"──► AskUserQuestion tool                      │
  │      │                                                                   │
  │      │  PreToolUse hook intercepts (hooks/askuser-bridge.mjs)            │
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

This downloads the project, copies the hook and `web/` assets to `~/.local/share/claude-askui`, and adds an idempotent `AskUserQuestion` `PreToolUse` hook to `~/.claude/settings.json`. Then start a new `claude` session — that's it.

### With npm

```bash
npm install -g claude-askui
claude-askui install
```

### From a local clone (no npm)

```bash
./install.sh
```

`./install.sh` and `claude-askui install` write the same idempotent hook entry, so they are interchangeable.

### CLI commands

| Command | What it does |
|---------|--------------|
| `claude-askui install` | Adds the hook to `~/.claude/settings.json` |
| `claude-askui uninstall` | Removes the hook |
| `claude-askui serve` | Runs the bridge in the foreground for debugging (port 4517) |
| `claude-askui doctor` | Checks hook installation, hook file, and bridge health |

The same `serve` step is available via `npm run serve`, and `npm run install-hook` runs `claude-askui install`.

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
            { "type": "command", "command": "node \"/path/to/askuser-bridge.mjs\"", "timeout": 360 }
          ]
        }
      ]
    }
  }
  ```

  The install logic is idempotent: it won't add a duplicate, and it refuses to clobber an existing third-party `AskUserQuestion` hook.

## Troubleshooting

- **The native picker shows up instead of the browser UI.** This is the safe fallback — it means the bridge was down, timed out, or returned an error. Check the bridge with `curl http://127.0.0.1:4517/health` (expects `{"ok":true}`), or run `claude-askui doctor` for a full status check.
- **The UI doesn't open at all.** Start the bridge manually with `claude-askui serve` (or `node server/server.js`) and open `http://127.0.0.1:4517` in your browser.
- **Spaces in the install path** (for example `Application Support`). The hook command is written with the path wrapped in double quotes, so paths with spaces work. If you hand-edited `settings.json`, make sure the `node "<path>"` command keeps those quotes.
- **Two questions at once.** The bridge holds exactly one question set at a time; a second concurrent set is rejected (409) and falls back to the native picker. There must be only one `PreToolUse` hook for `AskUserQuestion` (Claude Code issue #15897) — `claude-askui doctor` flags conflicts.
- **Offline / air-gapped.** No internet is required at runtime: React, ReactDOM, and Babel are served from local vendored files under `web/vendor/`. (Web fonts are loaded from Google Fonts for styling only; the UI works without them.)

## Tests

```bash
npm test   # node --test, zero dependencies
```

## License

MIT
</content>
</invoke>
