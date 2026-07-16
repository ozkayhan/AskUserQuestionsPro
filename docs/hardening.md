# Hardening — systemic security & reliability fixes

> CHANGELOG-style summary of the 191-finding remediation sprint (historical
> plan: [archive/hardening-plan-v2.md](archive/hardening-plan-v2.md)).
> Describes **what was changed**, **why**, and **which regression guard closes each class**.
> Commit range: up to `18b634f`.

---

## 5 systemic themes

### A — Silent error swallow

**Problem:** `catch {}` blocks throughout the codebase silently dropped
exceptions, producing fake-success states (settings appeared saved when the
disk write failed; spawn errors were invisible; hook crashes produced no
diagnostic).

**Fix:** Created `lib/log.cjs` (`log(scope, x)`) as the single structured
stderr logger (Contract L). Every former silent catch now calls `log` before
taking the safe action (exit, fallback, return error). Covers:

- `ensureServer` spawn error
- `openBrowser` OS-command error
- settings disk write failure
- hook `uncaughtException` / `unhandledRejection`
- server fatal (non-EADDRINUSE `'error'` event)

**CI guard:** `no-empty { allowEmptyCatch: false }` in ESLint config for all
Node files — empty catch blocks are now a lint error.

---

### B — Boundary validation lost

**Problem:** Input was validated inconsistently — in some paths zero times, in
others duplicated across layers, with no single authoritative source.

**Fix:** `validQuestions()` in `server/server.js` became the **single
validation authority** for the HTTP boundary that both the hook and MCP server
cross. Additions:

- `validLabel(label)` — shared label guard (string, 1–500 chars).
- `checkTreeNodes(opts)` — **recursive** tree node label validation; the
  previous version only checked top-level nodes, leaving deep labels
  unvalidated.
- `validAnswers` check on `POST /answer`: `!answers || typeof answers !== 'object' || Array.isArray(answers)` → 400 (plain object required).
- Question text length bounds: 1–1000 chars.
- Explicit error messages for every rejection case (type, length, constraint).

**CI guard:** fuzz / boundary tests in `test/server.test.js` cover all type
combinations, empty/over-length fields, invalid enum values, tree depth > 6,
tree non-array `children`, and nested non-string labels.

---

### C — Stale React state

**Problem:** Closures over `ref.current` inside event handlers caused "stale
ref" bugs where the handler read an outdated value at dispatch time. Six
distinct instances identified.

**Fix:** Stale-prone decisions were moved into **pure `AnswerMap` helpers**
(params in, value out, no `ref.current` in the decision path). `web/app.js`
delegates to these helpers rather than inlining the logic. With no ref in the
decision path, the bug class cannot exist.

**CI guard:** ESLint `eslint-plugin-react-hooks` on `web/**` (parsed by
`@babel/eslint-parser` + `@babel/preset-react`):

- `react-hooks/rules-of-hooks` — error
- `react-hooks/exhaustive-deps` — warn

These rules statically verify that hook dependencies are complete, catching
stale-closure patterns before they reach production.

---

### D — Test isolation / global-state leak

**Problem:** Stateful globals (`AnswerMap.ENABLED`, `process.env`,
bridge singleton) leaked between tests, causing ordering-dependent failures
and false positives.

**Fix:** Created `test/helpers/isolation.js` with `withClean(t, fn)` (Contract T).
`withClean` snapshots the global surface before the test, runs `fn`, and
restores in `t.after` even on throw. Used by every stateful test that touches
`setEnabled` or environment variables.

`server.test.js` isolates disk I/O by setting `XDG_CONFIG_HOME` to a
`mkdtemp` directory before requiring the server module (settings dir is
resolved at load time).

**CI guard:** `beforeEach`/`afterEach` pattern enforced via `withClean` in
all stateful tests; any new stateful test that skips it will fail on the next
CI run when it corrupts a later test.

---

### E — Operational blindness

**Problem:** Failures produced no structured output: silent `catch {}`,
missing `log` calls, and no way to distinguish which component failed from
the stderr stream.

**Fix:** Solved in the same stroke as Theme A via `lib/log.cjs`. Every log
line carries a scope prefix (`[askuser:hook]`, `[askuser:bridge]`,
`[askuser:settings]`, `[askuser:server]`, `[askuser:browser]`), making it
trivial to filter and identify the failing component.

**CI guard:** Same as Theme A (`no-empty` lint rule).

---

## The consolidation layer

New shared primitives created once, tested once, reused across the codebase:

| Artifact                                                                         | Purpose                                                                                                                           | Reused by                                          | Closes                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `lib/log.cjs` — `log(scope, x)`                                                  | Structured stderr logger (Contract L)                                                                                             | hook, bridge-client, settings, server              | Theme A + E                                 |
| `lib/atomic-write.cjs` — `writeFileAtomic(file, data)`                           | `.tmp.<pid>` + `rename` + `O_EXCL` lock                                                                                           | `lib/settings.js`, `bin/install.js`                | Critical #1 (data loss on concurrent write) |
| `server/server.js` — deepened `validQuestions` + `validLabel` + `checkTreeNodes` | Single validation authority                                                                                                       | `/ask`, `/answer` (hook + MCP funnel here)         | Theme B input class                         |
| `test/helpers/isolation.js` — `withClean(t, fn)`                                 | Test isolation (Contract T)                                                                                                       | all stateful tests                                 | Theme D                                     |
| Contract R — round `id` ownership                                                | `provideAnswers(id, answers)` + `cancel(reason, expectedId)` + `/answer` body `{id, answers: {...}}` + `postAnswers(id, answers)` | bridge, server, live.js, app.js                    | Cross-round answer mix-up (the #1 theme)    |
| Contract W — settings write result                                               | `write(patch) → { ok, value, error? }`                                                                                            | `lib/settings.js` → `POST /settings`, `bin/cli.js` | Fake-success on disk failure                |

These consolidations **reduce** total scattered logic while adding tests and
guards. Net code complexity goes down; safety goes up.

---

## CI guards summary

| Guard                                                                        | Catches                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `no-empty { allowEmptyCatch: false }` (ESLint, all Node files)               | New silent swallow (Theme A)                            |
| `react-hooks/rules-of-hooks` + `exhaustive-deps` (ESLint, `web/**`)          | New stale-ref / missing dep (Theme C)                   |
| `shellcheck install.sh reinstall.sh` (CI lint job)                           | Shell-quoting / portability regressions (Theme B shell) |
| SHA-pinned `actions/checkout` + `actions/setup-node`                         | Workflow supply-chain substitution                      |
| Validator fuzz tests (server.test.js)                                        | Validation regression (Theme B)                         |
| Wire round-trip tests (correct id resolves, stale → 409, object check → 400) | Contract R regression                                   |
| `withClean` in every stateful test                                           | Global-state leak (Theme D)                             |

---

## Key source changes at a glance

| File                                   | What changed                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/log.cjs`                          | **Created** — Contract L structured logger                                                                                                                                                                                                                         |
| `lib/atomic-write.cjs`                 | **Created** — `writeFileAtomic` with lockfile                                                                                                                                                                                                                      |
| `lib/settings.js`                      | `write()` returns `{ ok, value, error? }` (Contract W); uses `writeFileAtomic`                                                                                                                                                                                     |
| `lib/bridge-client.mjs`                | `ensureServer` single-flight; `isUp` checks `app` identity; `TimeoutError` class; `waitForPending`; `openBrowser` logs error                                                                                                                                       |
| `server/bridge.js`                     | `provideAnswers(id, answers)` and `cancel(reason, expectedId)` — Contract R id ownership                                                                                                                                                                           |
| `server/server.js`                     | Deep `validQuestions` + `validLabel` + `checkTreeNodes`; `/answer` parses `{id,answers}`, validates Array, calls `provideAnswers(id, ...)`; `/ask` captures `myId`; settings memory cache; ETag; `requestTimeout=0`; `app` in `/health`; Contract W on `/settings` |
| `hooks/askuserquestionspro-bridge.mjs` | `readStdin` 30 s watchdog; `writeAndExit` EPIPE flush; `uncaughtException`/`unhandledRejection` → `log` + exit 0; `waitForPending()` before `openBrowser`                                                                                                          |
| `web/live.js`                          | `postAnswers(id, answers)` (Contract R); exponential backoff + jitter SSE reconnect; 10 s timeout; `err.server` flag; `setRound` equality guard                                                                                                                    |
| `web/app.js`                           | Passes `round.id` to `postAnswers`; delegates stale-prone decisions to pure AnswerMap helpers                                                                                                                                                                      |
| `web/views.js`                         | ARIA annotations across all question types; `CustomPopup` focus-trap + `role=dialog`                                                                                                                                                                               |
| `eslint.config.js`                     | `no-empty {allowEmptyCatch:false}` on Node files; `@babel/eslint-parser` + `eslint-plugin-react-hooks` on `web/**`                                                                                                                                                 |
| `install.sh`                           | Shell hardening: `WORKDIR`, single-quoted trap, `jq -e` validate-before-mv, intent-based dedupe                                                                                                                                                                    |
| `.github/workflows/ci.yml`             | `shellcheck` step; SHA-pinned action refs                                                                                                                                                                                                                          |
| `test/helpers/isolation.js`            | **Created** — `withClean` (Contract T)                                                                                                                                                                                                                             |
| `test/server.test.js`                  | Fuzz/boundary tests; Contract R wire tests; poll helpers; `requestTimeout` assertion                                                                                                                                                                               |
