# Frontend

Location: `web/`. A no-build React app — JSX is transpiled in the browser by
the vendored Babel.

## Setup & load order (`web/index.html`)

1. Vendor globals: `web/vendor/react.production.min.js`,
   `react-dom.production.min.js`, `babel.min.js`.
2. Plain scripts: `answer-map.js`, `themes.js`, `settings-schema.js`. Then app
   files loaded as `type="text/babel"` (compiled client-side), in dependency
   order: `ui-kit.js` → `live.js` → `views.js` → `settings-panel.js` →
   `app.js`.
3. Mounts into `<div id="root">`.

Fonts: Geist / Geist Mono preloaded; themes swap the Google Fonts link at
runtime via `Themes.swapFont()`.

## State model (`web/app.js`)

The root `App` component renders the question `Flow` (or `Waiting`) plus the
always-visible `SettingsButton` fab and, when open, the `SettingsModal`. The
`Flow` component owns all interaction state:

- **answers**: `{ [questionText]: { sel: number[], confirmed: boolean, customText: string } }`.
  Keyed by question *text* (stable across re-renders).
- **current**: index of the active question; index `n` is the Summary screen.
- **dir**: `"left" | "right"` — drives slide-animation direction.
- **popup**: `{ qid, optIdx, draft }` for the custom ("Other") text editor.
- **submitted**: guard against double submission.

Questions themselves come from the server via `useLiveQuestions()`, not local
state.

### Navigation & keyboard

Functions: `goTo(idx, direction)`, `advance(from)`, `goBack()`,
`activate(qIndex, optIdx)` (delegates to `AnswerMap.decideActivate`),
`confirmCurrent()`, `submit()`.

Keyboard (registered in a `useEffect`):

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / next question |
| `1`–`9` | Select option by number |
| `Enter` | Confirm current question, or submit from Summary |
| `B` | Back (from Summary) |
| `U` | Jump to first unanswered (only for large forms, N > 8) |

Arrow/number shortcuts are suppressed while focus is in an `<input>`/`<textarea>`.

## Server communication (`web/live.js`)

- `useLiveQuestions()` — opens `new EventSource('/events')`. `onmessage`
  parses `{ id, questions }`; `questions` is `null` while idle. Reconnects
  ~1s after `onerror`. Returns `{ id, questions }`.
- `postAnswers(answers)` — `POST /answer` with `{ answers }`; throws on
  non-OK (UI surfaces a toast).

## Components (`web/views.js`)

- `Sidebar` — switches layout by size: `SidebarFlatList` (N ≤ 8) vs
  `SidebarGrouped` + `SidebarSearch` (N > 8). Shows progress, answered/total,
  footer hints.
- `QItem` — one question row; states done/current/pending; click to jump.
- `SidebarGrouped` — accordion grouped by `q.header` ("General" if missing),
  per-group done/total badge.
- `SidebarSearch` — text filter + "show unanswered only" toggle (large forms).
- `Hints` — dynamic keyboard-shortcut footer.
- `QuestionCard` — main question; chip (`q.header`), title (`q.question`),
  "Select one/all", options from `fullOptions(q)`; radio (single) vs checkbox
  (multi).
- `CustomPopup` — modal textarea for the "Other" option; Save / Remove /
  Cancel; `Enter` save, `Shift+Enter` newline, `Esc` cancel.
- `Summary` — review all answers as tags; per-question Edit; Submit disabled
  until ≥1 answer.

## UI primitives (`web/ui-kit.js`)

- Icons `Check`, `Brand`; `Kbd` wrapper.
- `fullOptions(q)` appends a custom option
  `{ label: "Other", description: "Let me describe something else.", custom: true }`
  to `q.options` (constants `CUSTOM_LABEL`, `CUSTOM_DESC`).

## Answer logic (`web/answer-map.js`) — pure, no DOM

- `mapAnswers(questions, state)` → submission shape
  `{ [question]: label | [labels] }` (string for single, array for multi).
  Questions with zero selections are **omitted**. A custom selection maps to
  its `customText` (or `""` if empty).
- `decideActivate(q, a, optIdx)` → action object
  (`noop`/`select`/`toggle`/`popup`/`confirm`). Encodes the single-select
  (arm-then-confirm) vs multi-select (toggle) state machine, including the
  custom-option popup branch.
- `savePopupState(a, optIdx, text)` → applies popup result; empty text removes
  the custom selection, non-empty adds it and stores `customText`.

This module is unit-tested in isolation (`test/answer-map.test.js`).

## Settings panel (`web/settings-panel.js` + `web/settings-schema.js`)

A schema-driven settings UI. `web/settings-schema.js` (UMD global
`Settings_Schema`) is the single source of truth for all settings — every
control is generated from `entries()`. Current entries: `theme` (select),
`uiScale` (`sm`/`md`/`lg` zoom), `reduceMotion` (toggle).

- `SettingsButton` — fixed bottom-left gear fab, visible on every screen.
- `SettingsModal` — centered overlay; renders one `SettingRow` (segment for
  `select`, switch for `toggle`) per schema entry, grouped by `entry.group`.
  Editing a `live` setting applies it instantly as preview; **Cancel**/`Esc`
  reverts via `applyAll(baseline)`; **Save** POSTs the draft to `/settings`,
  updates `window.__ASKUSER_SETTINGS__`, and shows a reload notice if a
  `reload`-class setting changed.
- On boot, `applyAll(window.__ASKUSER_SETTINGS__)` applies the
  server-injected settings (theme is handled separately by `themes.js`).

## Themes (`web/themes.js` + `web/styles.css`)

Five themes in `LIST`:

| id | Feel |
|----|------|
| `amoled` | Default — pure black, blue accent (base tokens in `:root`). |
| `paper` | Warm off-white, serif (Newsreader + Inter), brown accent. |
| `phosphor` | Neon green on near-black, monospace, scanline texture. |
| `dusk` | Warm orange/brown gradient, large radius. |
| `aurora` | Purple/cyan glassmorphism, blur, Space Grotesk. |

Mechanics:

- `read()` resolves the active theme: server-injected disk setting
  (`window.__ASKUSER_SETTINGS__.theme`) > `?theme=` URL param > `localStorage` >
  `amoled`.
- `apply(id)` clears all `KNOWN_TOKENS` from `:root`, sets the theme's delta
  tokens, swaps the font link, persists to `localStorage`.
- `current()` returns the active id; `swapFont(font)` manages the
  `<link id="askuserquestionspro-theme-font">`.
- `KNOWN_TOKENS` (~30 CSS vars) are the contract between themes and
  `styles.css` (colors, radius, motion, fonts, shadows, effects). Themes
  override only deltas; `amoled` `:root` defaults fill the rest.

Styling specifics live in `web/styles.css` (CSS Grid app layout, 380ms
direction-aware slide animations gated on `prefers-reduced-motion`).
