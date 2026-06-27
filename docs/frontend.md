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

- **answers**: `{ [questionText]: { sel: number[], confirmed: boolean, customText: string, value: number|null, order: number[]|null, path: number[]|null } }`.
  Keyed by question _text_ (stable across re-renders). Init value: `{ sel:[], confirmed:false, customText:"", value:null, order:null, path:null }`.
  - `sel` — selected option indices (single/multi/binary).
  - `value` — numeric value for scale questions.
  - `order` — ordered option-index array for ranking questions.
  - `path` — selected path (index array, root→leaf) for tree questions.
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

| Key       | Action                                                 |
| --------- | ------------------------------------------------------ |
| `←` / `→` | Previous / next question                               |
| `1`–`9`   | Select option by number                                |
| `Enter`   | Confirm current question, or submit from Summary       |
| `B`       | Back (from Summary)                                    |
| `U`       | Jump to first unanswered (only for large forms, N > 8) |

Arrow/number shortcuts are suppressed while focus is in an `<input>`/`<textarea>`.

## Server communication (`web/live.js`)

- `useLiveQuestions()` — opens `new EventSource('/events')`. `onmessage`
  parses `{ id, questions }`; `questions` is `null` while idle. Reconnects
  ~1s after `onerror`. Returns `{ id, questions }`.
- `postAnswers(answers)` — `POST /answer` with `{ answers }`; throws on
  non-OK (UI surfaces a toast).

## Question types

`q.type` selects the interaction mode. Supported values:

| `q.type`    | Behaviour                                                           | Required fields                                                                                 | Answer value                  |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| `"single"`  | Select one option (arm then confirm)                                | `options`                                                                                       | `string`                      |
| `"multi"`   | Checkbox multi-select                                               | `options`                                                                                       | `string[]`                    |
| `"binary"`  | Two large side-by-side buttons; single click confirms               | `options` optional (defaults to `[{label:"Evet"},{label:"Hayır"}]`); exactly 2 opts; no "Other" | `string`                      |
| `"scale"`   | Native `<input type="range">` with value balloon and labels         | `min`, `max`, `step` (default 1), `leftLabel`, `rightLabel`                                     | `number`                      |
| `"ranking"` | Ordered list; ↑/↓ buttons + keyboard drag                           | `options` (≥ 2); no "Other"                                                                     | `string[]` (ordered high→low) |
| `"tree"`    | Hierarchical drill-down; breadcrumb shows path; leaf = final answer | `options` with optional recursive `children`; no "Other"; depth ≤ 6                             | `string[]` (root→leaf labels) |

Type is resolved via `AnswerMap.qType(q)`: if the explicit `q.type` is a rich
type (`binary`/`scale`/`ranking`/`tree`) but the setting for that type is
disabled, it degrades to `"multi"` or `"single"` based on `q.multiSelect`.

### Keyboard shortcuts by type

| Type         | Shortcuts                                                                   |
| ------------ | --------------------------------------------------------------------------- |
| single/multi | `1`–`9` select, `Enter` confirm                                             |
| binary       | `1`/`2` select (auto-confirms)                                              |
| scale        | `←`/`→` adjust, `Enter` confirm                                             |
| ranking      | `↑`/`↓` move cursor, `Enter`/`Space` grab/drop, `Enter` (ungrabbed) confirm |
| tree         | `1`–`9` pick child, `Backspace`/`←` go up, `Enter` confirm leaf             |

## Components (`web/views.js`)

- `Sidebar` — switches layout by size: `SidebarFlatList` (N ≤ 8) vs
  `SidebarGrouped` + `SidebarSearch` (N > 8). Shows progress, answered/total,
  footer hints.
- `QItem` — one question row; states done/current/pending; click to jump.
- `SidebarGrouped` — accordion grouped by `q.header` ("General" if missing),
  per-group done/total badge.
- `SidebarSearch` — text filter + "show unanswered only" toggle (large forms).
- `Hints` — dynamic keyboard-shortcut footer; hint text adapts to `AnswerMap.qType(q)`.
- `QuestionCard` — dispatcher: delegates to `BinaryCard`, `ScaleCard`,
  `RankingCard`, or `TreeCard` based on `AnswerMap.qType(q)`; falls back to
  the original select-style card for single/multi.
- `CustomPopup` — modal textarea for the "Other" option; Save / Remove /
  Cancel; `Enter` save, `Shift+Enter` newline, `Esc` cancel.
- `Summary` — review all answers as tags; per-question Edit; Submit disabled
  until ≥1 answer. Answer text uses `AnswerMap.summaryText(q, a)`.

## UI primitives (`web/ui-kit.js`)

- Icons `Check`, `Brand`; `Kbd` wrapper.
- `fullOptions(q)` appends a custom option
  `{ label: "Other", description: "Let me describe something else.", custom: true }`
  to `q.options` **only** when `AnswerMap.qType(q)` is `"single"` or `"multi"`.
  For binary, the default `[{label:"Evet"},{label:"Hayır"}]` is injected here
  when `q.options` is absent. For ranking/tree the options are returned as-is
  (no "Other").

## Answer logic (`web/answer-map.js`) — pure, no DOM

- `qType(q)` → resolved type string. Checks enabled state set via
  `setEnabled({binary,scale,ranking,tree})`; degrades rich types to
  `"single"`/`"multi"` when disabled. Called everywhere type is needed.
- `setEnabled(map)` — called once on app boot from `window.__ASKUSER_SETTINGS__`.
- `mapAnswers(questions, state)` → submission shape keyed by question text:
  - single/binary → `string`; multi → `string[]`; scale → `number`;
    ranking → `string[]` (ordered); tree → `string[]` (root→leaf labels).
  - Questions with no answer are **omitted**. Custom selections map to `customText`.
- `isAnswered(q, a)` → bool. single/multi/binary: `sel.length>0`; scale:
  `value!=null`; ranking: `order!=null && order.length>0`; tree: path is
  non-empty and ends at a leaf node.
- `summaryText(q, a)` → display string for sidebar and summary (e.g.
  `"7 / 10"` for scale, `"Auth → Cache"` for ranking, `"AI → LLM → fine-tune"` for tree).
- `decideActivate(q, a, optIdx)` → action object
  (`noop`/`select`/`toggle`/`popup`/`confirm`). Encodes the single-select
  (arm-then-confirm) vs multi-select (toggle) state machine. For binary returns
  `{type:'select', sel:[optIdx]}` (app confirms+advances immediately).
- `savePopupState(a, optIdx, text)` → applies popup result; empty text removes
  the custom selection, non-empty adds it and stores `customText`.
- Pure helpers: `moveRank(order, idx, dir)`, `initOrder(q)`, `clampScale(q, v)`,
  `treeNodeAt(q, path)`, `treeChildrenAt(q, path)`, `isLeaf(node)`.

This module is unit-tested in isolation (`test/answer-map.test.js`).

## Settings panel (`web/settings-panel.js` + `web/settings-schema.js`)

A schema-driven settings UI. `web/settings-schema.js` (UMD global
`Settings_Schema`) is the single source of truth for all settings — every
control is generated from `entries()`. Current entries:

| Key            | Group          | Type                    | Default  | Effect                         |
| -------------- | -------------- | ----------------------- | -------- | ------------------------------ |
| `theme`        | Appearance     | select                  | `amoled` | Applies theme tokens live      |
| `uiScale`      | Appearance     | select (`sm`/`md`/`lg`) | `md`     | `html zoom`                    |
| `reduceMotion` | Appearance     | toggle                  | `false`  | `data-reduce-motion` attr      |
| `qtypeBinary`  | Question types | toggle                  | `true`   | Enable binary questions        |
| `qtypeScale`   | Question types | toggle                  | `true`   | Enable scale questions         |
| `qtypeRanking` | Question types | toggle                  | `true`   | Enable ranking questions       |
| `qtypeTree`    | Question types | toggle                  | `true`   | Enable decision-tree questions |

The four `qtype*` toggles apply on reload; `app.js` reads them at boot via
`AnswerMap.setEnabled({binary, scale, ranking, tree})`. Disabling a rich type
degrades it to `single` or `multi` transparently.

- `SettingsButton` — fixed bottom-left gear fab, visible on every screen.
- `SettingsModal` — centered overlay; renders one `SettingRow` (segment for
  `select`, switch for `toggle`) per schema entry, grouped by `entry.group`.
  Editing a `live` setting applies it instantly as preview; **Cancel**/`Esc`
  reverts via `applyAll(baseline)` only if nothing has been saved yet (so a
  successful mid-session save is not undone on cancel); **Save** POSTs the
  draft to `/settings`, updates `window.__ASKUSER_SETTINGS__`, advances the
  `baseline` to the saved values, and shows a reload notice if a
  `reload`-class setting changed.
- On boot, `applyAll(window.__ASKUSER_SETTINGS__)` applies the
  server-injected settings (theme is handled separately by `themes.js`).

## Themes (`web/themes.js` + `web/styles.css`)

Five themes in `LIST`:

| id         | Feel                                                        |
| ---------- | ----------------------------------------------------------- |
| `amoled`   | Default — pure black, blue accent (base tokens in `:root`). |
| `paper`    | Warm off-white, serif (Newsreader + Inter), brown accent.   |
| `phosphor` | Neon green on near-black, monospace, scanline texture.      |
| `dusk`     | Warm orange/brown gradient, large radius.                   |
| `aurora`   | Purple/cyan glassmorphism, blur, Space Grotesk.             |

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
