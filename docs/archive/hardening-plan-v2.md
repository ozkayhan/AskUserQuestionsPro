# Plan V2 — Systemic hardening workflow for askuserquestionspro (195-finding remediation)

> **V2 doctrine: systems, not patches.** Every fix that is one of _many_ of its kind is replaced by a single shared, tested chokepoint + a CI guard that fails if the class returns. The YAGNI rail stays on: a "system" qualifies **only** if it is reused ≥2×, is unit-tested, and structurally closes a bug class. No speculative abstraction, no new runtime deps (zero-dep invariant preserved), no framework. The laziest _correct_ seam wins.

---

## 1. Context

`.context/attachments/54n4RS/audit-report.md` = audit of **askuserquestionspro** (full-screen web-UI bridge replacing Claude Code's `AskUserQuestion`). **195 verified findings** (3 Critical / 53 High / 91 Medium / 48 Low), **4 of which are "dogrulama — bulgu degil"** (no change). So **191 actionable**, but heavy duplication (zombie 5×, `setEnabled` leak 6×, ranking-OOB & cross-round race each several×) → **≈90 distinct fixes**. Findings cluster by owning file and by 5 systemic themes:

- **A — silent error swallow** (`catch {}` drops the error; fake success)
- **B — boundary validation lost** (Claude→Hook→HTTP→Bridge→UI; validated 3× or 0×)
- **C — stale React state** (ref/state/closure desync)
- **D — test isolation / global-state leak** (`ENABLED`, `process.env`, bridge singleton; no `beforeEach`/`afterEach`)
- **E — operational blindness** (failures with no structured log)

Goal: fix all 191 at production grade **and** make each _class_ structurally hard to reintroduce, then update docs. Runs as **one dynamic Workflow**, token-efficient, cost-aware model selection (`modeloz`: strong models for the hard/coordinated consolidation work, cheap models for mechanical/parallel work).

---

## 2. How each theme goes from patch → system

| Theme                                                       | V1 (patch)           | **V2 (system)**                                                                                                                                                                                                                                       | CI guard (can't return)                                                                                                                |
| ----------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **B — OOB crashes** (ranking/tree/single/multi label reads) | guard each read site | **`optionLabel(q,i)` single guarded accessor** in answer-map; every consumer (`mapAnswers`,`summaryText`,`isAnswered`) routes through it → OOB structurally impossible                                                                                | property/fuzz test: random+OOB indices never throw                                                                                     |
| **B — input validation lost at boundary**                   | add checks ad-hoc    | **single validation authority**: deepen `validQuestions` (recursive tree-label check) + add `validAnswers`; **everything funnels through the one HTTP `/ask`+`/answer` boundary** the hook & MCP already cross — validate once there, not in 3 places | fuzz test: validators never throw, always reject garbage with clear code                                                               |
| **A — silent error swallow**                                | add a log per site   | **`lib/log.cjs` `log(scope,err)`** structured logger reused at every former swallow site (Theme E solved with same stroke)                                                                                                                            | ESLint `no-empty {allowEmptyCatch:false}` on all Node files                                                                            |
| **C — stale React state**                                   | fix each ref/closure | **shrink the untested shell**: push every stale-prone _decision_ into pure answer-map helpers (params in, no `ref.current` in decisions) → the bug can't exist because there's no ref to be stale                                                     | **`@babel/eslint-parser` + `eslint-plugin-react-hooks` on `web/**`** → `exhaustive-deps`/`rules-of-hooks` catch the class machine-side |
| **D — test isolation leak**                                 | try/finally per test | **`test/helpers/isolation.js`** snapshot/restore of the global surface (`ENABLED`/env/bridge), reused by every stateful test                                                                                                                          | `beforeEach`/`afterEach` standard; MCP child via `try/finally`                                                                         |
| **data integrity** (atomic write, 2 sites)                  | inline tmp→rename ×2 | **`lib/atomic-write.cjs` `writeFileAtomic`** — the tricky rename+cleanup implemented & tested **once**, used by settings.js + install.js                                                                                                              | unit test on the util incl. mid-write failure                                                                                          |
| **cross-round mix-up** (the #1 theme)                       | —                    | **id-owning rendezvous** (Contract R) makes resolving the wrong turn _impossible_, not unlikely                                                                                                                                                       | server-side 409 tests + real wire integration test                                                                                     |
| **supply chain**                                            | note it              | **pinned-SHA download + `shasum -c`** (shell) + **SHA-pinned Actions**                                                                                                                                                                                | `shellcheck` in CI; workflow tests assert pins                                                                                         |

This is **consolidation, not addition**: the shared primitives _delete_ scattered duplicate logic (DRY/SOLID) while adding tests + guards. Net code complexity goes **down**, safety goes up.

---

## 3. The consolidation layer (new shared primitives — created once, tested once, reused)

| Artifact                                                                                        | Owner bundle             | Reused by                                  | Closes                        |
| ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------ | ----------------------------- |
| `web/answer-map.js` → `optionLabel(q,i)` (internal)                                             | F1                       | mapAnswers, summaryText, isAnswered        | Critical #2/#3 + all OOB      |
| `server/server.js` → deepened `validQuestions` + new `validAnswers` (single boundary authority) | B1                       | `/ask`, `/answer` (hook & MCP funnel here) | Theme B input class           |
| `lib/atomic-write.cjs` → `writeFileAtomic(file,data)`                                           | B3                       | `lib/settings.js`, `bin/install.js`        | Critical #1 + data-loss class |
| `lib/log.cjs` → `log(scope, errOrMsg)` (**Contract L**, pinned)                                 | B2 creates; B1/B3 import | all Node swallow sites                     | Theme A+E                     |
| `test/helpers/isolation.js` → `withClean(t, fn)` (**Contract T**, pinned)                       | F1 creates; B1/B2 import | every stateful test                        | Theme D                       |
| `.context/finding-ledger.json` (every finding → `{id,severity,file,line,title,type}`)           | Phase-0 ledger agent     | reviewers + critic                         | auditable completeness        |

Only **one** bundle ever _writes_ each file → parallel-safe. Cross-bundle deps (log.cjs, isolation.js) are **import-only against a pinned signature**, so importers don't need the file to exist until the post-fan-out test gate (the barrier guarantees it does).

---

## 4. Pinned cross-bundle contracts (verified against current source)

### Contract R — round identity (kills cross-round answer mix-up)

Current: `provideAnswers(answers)`, `cancel(reason)`, `/answer` body `{answers}`, `postAnswers(answers)`, `peek()→{id,questions}`.
**New:**

- `server/bridge.js`: `provideAnswers(id, answers)` → `if (!this._pending || this._pending.id !== id) return false;` then resolve, return `true`. `cancel(reason, expectedId)` → `if (!this._pending) return false; if (expectedId != null && this._pending.id !== expectedId) return false;` then reject.
- `server/server.js`: `POST /answer` parses `{id, answers}`; **boundary-validate** `Array.isArray(answers)` → `400`; then `if (!bridge.provideAnswers(id, answers)) → 409`. `/ask` captures its submit `id`; disconnect → `bridge.cancel('client disconnected', id)`.
- `web/live.js`: `postAnswers(id, answers)` body `{id, answers}`.
- `web/app.js`: passes `round.id` (from `useLiveQuestions`).
- `lib/bridge-client.mjs` / MCP **NOT** part of R (they drive `/ask`, not `/answer`) — kept decoupled.

### Contract W — settings write signals failure (kills fake "saved")

Current: `write(patch)` always returns `next`, even when the disk write throws (swallowed).
**New:** `write(patch) → { ok, value, error? }` (success `{ok:true,value:next}`; failure logs via `log()`, unlinks orphan `.tmp`, `{ok:false,value:next,error}`).

- Consumers: `bin/cli.js` settings-set → `if (!r.ok) { stderr + exit 1 }`; `POST /settings` → `if (!r.ok) 500` else `200 {ok:true, settings:r.value}`.

### Contract L — logger

`lib/log.cjs`: `log(scope, x)` → writes `"[askuser:<scope>] <message-or-stack>\n"` to stderr, never throws. Single import everywhere a former `catch {}` lived.

### Contract T — test isolation

`test/helpers/isolation.js`: `withClean(t, fn)` snapshots `AnswerMap` ENABLED + relevant `process.env`, runs `fn`, restores in `t.after` even on throw.

### Do-not-touch

Any finding tagged `dogrulama — bulgu degil` (4×: bridge sync-read atomicity, `live.js` closed-guard, the state-safe `JSON.parse` catch, …) gets **no code change**, at most a clarifying comment.

---

## 5. Bundles (disjoint file ownership; each builds/uses the primitives above)

| #       | Bundle                          | Owns (source + tests)                                                                                                                                                                                                   | Model                        | V2 systemic role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1**  | HTTP/Bridge core                | `server/server.js`, `server/bridge.js`, `test/server.test.js`, `test/bridge.test.js`                                                                                                                                    | **Opus**                     | **Single validation authority** (deep `validQuestions`+`validAnswers`); Contract R server side as id-owning rendezvous; `readBody` O(n²)→`Buffer.concat` + deterministic 8MB reject + hang guards; broadcast dead-write; static cache/ETag; settings in-mem cache; EADDRINUSE→exit(1)+`log`; consumes W (→500) & L. **New tests:** wire round-trip (correct id→resolve, stale→409, garbage→400), validator fuzz, concurrent-/ask 409, traversal 403, poll-not-sleep. Uses `withClean`.                  |
| **B2**  | Node edge (client/hook/MCP)     | `lib/bridge-client.mjs`, `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js`, `mcp-server/askuserquestionspro-mcp.mjs`, `test/bridge-client.test.js`, `test/mcp-server.test.js`, `test/hook-output.test.js`  | **Opus**                     | **Creates `lib/log.cjs`**; `askBridge` TimeoutError + `.answers` null-guard + JSON-parse catch; `ensureServer` single-flight + surfaced spawn error; `openBrowser` dead-catch; MCP `catch{}`→`catch(e)` + `id===undefined` notification fix + `sendResponse` try/catch; hook `readStdin` watchdog + EPIPE callback + uncaught arg; **MCP child `try/finally`** (the 5× zombie); extend e2e wire test; `XDG_CONFIG_HOME` isolation; filter/force-MCP tests; `withClean`.                                 |
| **B3**  | Settings/CLI/install            | `lib/settings.js`, `bin/cli.js`, `bin/install.js`, `lib/atomic-write.cjs` (new), `test/settings.test.js`, `test/install.test.js`                                                                                        | Sonnet                       | **Creates `writeFileAtomic`** (tested incl. mid-write failure) used by both settings & install.js (Critical #1); Contract W producer + `.tmp` cleanup; CLI try/catch around read/writeSettings; spawn `'error'` listener + signal-aware exit code; `cmdDoctor` fetch timeout; `main().catch`; toggle hint yes/no; `addHook` conflict-vs-already; `isOurEntry` boundary; write() error-path test.                                                                                                        |
| **B4**  | Shell installers                | `install.sh`, `reinstall.sh`                                                                                                                                                                                            | Sonnet (security-careful)    | Intent-based hook dedupe; jq corrupt → no fake success + validate-before-`mv`; **supply-chain: pinned-SHA download + `shasum -c`** replaces `curl\|bash`; quote `$pids`/`$remaining` (`readarray`); `cp -R` error msg; empty-content guard; `rm -rf` failure msg; `TMPDIR`→`WORKDIR` + single-quote trap; PORT validation; drop vestigial `hooks:{}`; verify via `jq -e` not grep.                                                                                                                      |
| **B5**  | CI / enforcement / supply-chain | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `eslint.config.js`, `test/workflows-ci.test.js`, `test/workflows-release.test.js`, `test/eslint-prettier-config.test.js`, `test/changesets-config.test.js` | Sonnet (+web fetch for SHAs) | **The enforcement wall**: `no-empty {allowEmptyCatch:false}`; **`@babel/eslint-parser`+`eslint-plugin-react-hooks` on `web/**`** (`exhaustive-deps`,`rules-of-hooks`); `shellcheck`step in CI lint job; SHA-pin`actions/checkout@v4`&`actions/setup-node@v4`; update workflow/config tests to assert all of it.                                                                                                                                                                                         |
| **F1**  | Answer-map logic                | `web/answer-map.js`, `test/helpers/isolation.js` (new), `test/answer-map.test.js`                                                                                                                                       | **Opus**                     | **Creates `optionLabel` + `withClean`**; Critical #2/#3 via the accessor; tree truncated-path via `treeNodeAt/isLeaf` single source; `decideActivate` multi stale-customText popup; `isAnswered(ranking)` bounds; **absorbs F2's stale-prone decisions as pure helpers**; fuzz/property tests; `setEnabled` leak → `withClean`.                                                                                                                                                                         |
| **F2**  | App + live (state machine)      | `web/app.js`, `web/live.js`                                                                                                                                                                                             | **Opus**                     | Contract R client side; **delegates every stale-prone decision to F1 pure helpers** (no `ref.current` in decisions) → satisfies `exhaustive-deps`; number-key type guard; binary bounds; double-submit `inflight` ref; `CustomPopup` stale-`q` guard + auto-dismiss; Enter-retry; `postAnswers` error-type split (net vs server); SSE backoff+jitter+timeout; equality-guarded `setRound`; toast dismiss; `aria-keyshortcuts`; return-focus `triggerRef`.                                               |
| **F3**  | Views (a11y + view-state)       | `web/views.js`                                                                                                                                                                                                          | Sonnet                       | TreeCard `confirmed:false` reset; `fullOptions` cardinality on type-degrade; RankingCard stale-cursor ref; CustomPopup `role=dialog`/`aria-modal`/focus-trap; ~14 ARIA gaps (accordion `aria-expanded`, range label/valuetext, ranking `role=listbox`, tree `role=tree`, binary/single/multi `aria-pressed`, sidebar-search label, `aria-current`, progressbar role, show-unanswered switch, `h1`→`h2`+sr-only `h1`); `aria-hidden` once inside the `Check` SVG. Verified by **axe** (§7), not eyeball. |
| **F4a** | Themes                          | `web/themes.js`, `test/themes.test.js`                                                                                                                                                                                  | Sonnet                       | amoled/aurora swatch↔token color fixes; `swapFont` `document.head` null-guard; tests: read() cascade, swapFont idempotency/null-font, `USED_KEYS⊇KNOWN_TOKENS` drift, surface-blur cleanup, token-syntax validation.                                                                                                                                                                                                                                                                                    |
| **F4b** | Settings UI                     | `web/settings-panel.js`, `web/settings-schema.js`, `web/ui-kit.js`                                                                                                                                                      | Sonnet                       | `SettingsModal` `isSaving` + Save-disable + `AbortController` on unmount; cancel-revert of in-flight live preview; double-save reentrancy; `SettingRow aria-label`; `applyAll` empty-catch→`console.warn` (browser).                                                                                                                                                                                                                                                                                    |

`modeloz` split: **Opus** only for the 4 consolidation/coordination bundles (B1, B2, F1, F2) + the repair agent. **Sonnet** for the 6 mechanical bundles, the ledger, all reviewers, the critic, the smoke, and docs. No bundle reads the 102 KB report — each greps its own files' `**Dosya:**` blocks (token saver).

---

## 6. Verification architecture — three _independent_ enumeration sources

1. **Phase 0 — ledger** (Sonnet, the only full-report read): emit `.context/finding-ledger.json`, every 195 findings as a row. Cheap; becomes the audit backbone.
2. **Fixers** enumerate by **grepping the report** for their files.
3. **Per-bundle reviewers** enumerate from the **ledger** (different source than fixers) → verify each ledger row for their files is truly fixed in `git diff -- <files>`, production-grade, no regression.
4. **Integration gate** (objective, machine): `npm run format && npm run lint && npm test` + `shellcheck`. Includes validator-fuzz, wire round-trip, and `react-hooks` lint — Themes B & C are machine-verified, not reviewed.
5. **Self-heal loop ≤3**: gate red → Opus repair agent (fixes contract/integration breaks + residual `exhaustive-deps` warnings) → re-gate.
6. **Completeness critic** (Sonnet): walks the **ledger top-to-bottom** (independent of file-grep), marks every row `fixed / verification-no-change / orphan`. **Zero blank rows allowed**; orphans → targeted repair.
7. **Chrome MCP smoke + in-page axe-core** (CDN-injected, zero npm dep): serve → open UI → **drive every question type + keyboard shortcuts** → submit (proves Contract R across the wire) → assert **0 console errors + 0 axe violations**.
8. **Docs** after green.

Three enumeration sources (grep / ledger / ledger-walk) + machine gates → a miss in one layer is caught by another; the nets no longer share a blind spot.

---

## 7. Frontend testability (closes the "frontend thin" gap)

- **Logic** that was stale-prone moves into pure answer-map helpers → unit-tested by F1 (the untested React shell shrinks).
- **Wire/contract** proven by a deterministic node:test (B1): `/ask`→`/answer` correct-id resolve + stale-id 409 + garbage 400.
- **Rendering/a11y** proven by axe-core in the Chrome smoke (no jsdom React harness — that would be over-engineering for a zero-build project; YAGNI rail held).

---

## 8. Regression systems summary ("bir daha asla")

ESLint `no-empty` (A) · `eslint-plugin-react-hooks` on web/ (C) · single validation authority + fuzz (B) · `optionLabel` accessor (B) · `withClean` + `beforeEach`/`afterEach` (D) · `log()` everywhere (A/E) · `writeFileAtomic` (data) · `shellcheck` + pinned-SHA fetch (shell/supply-chain) · SHA-pinned Actions · the **ledger** makes "did we get all 195?" an auditable checklist.

---

## 9. Docs (surgical sync + hardening note)

One Sonnet agent, code-area→doc map:

- `docs/api.md` — `/answer {id,answers}`+400/409, `/settings` 500
- `docs/backend.md` — `write→{ok}`, `validAnswers`, `atomic-write`, `log`, id-ownership, shell hardening
- `docs/frontend.md` — a11y, `postAnswers(id)`, SSE backoff, pure-helper delegation
- `docs/testing.md` — fuzz/wire/isolation helper
- `docs/tech-stack.md` — shellcheck, SHA-pins, react-hooks lint, devDeps
- `README.md` — CLI error messages/troubleshooting
- **`docs/hardening.md` (new)** — the 5 themes, the consolidation layer, the guards (CHANGELOG-style summary)
- `docs/README.md` — bump synced-commit hash
- optional `.changeset/*.md`

---

## 10. End-to-end verification (acceptance)

1. `npm test` green (incl. fuzz, wire round-trip, isolation). 2. `npm run lint` (no-empty + react-hooks) + `format:check` clean. 3. `shellcheck install.sh reinstall.sh` clean. 4. Chrome smoke: every type + shortcuts, 0 console errors, **0 axe violations**. 5. Ledger: 0 orphan rows. 6. Spot-repro 3 Criticals (ranking OOB no-throw; read-only config→`{ok:false}`; stale-id→409).

---

## 11. Files

- **Created:** `lib/atomic-write.cjs`, `lib/log.cjs`, `test/helpers/isolation.js`, `docs/hardening.md`, `.context/finding-ledger.json`, maybe `.changeset/*.md`. (All zero-runtime-dep; axe & `@babel/eslint-parser`/`eslint-plugin-react-hooks` are devDep/CDN only.)
- **Modified:** all bundle paths + `docs/*` + `README.md`.

---

## 12. Honest notes

- The **one ambitious change** is enabling `react-hooks` lint on `web/**` (previously ESLint-ignored). It may surface extra `exhaustive-deps` warnings beyond the report's list — by design, those _are_ latent Theme-C bugs. Residuals are absorbed by the self-heal loop; if the volume is large the workflow returns for a human call rather than mass-suppressing.
- V2 does slightly more agent work than V1, but the consolidation primitives _reduce_ per-file patching, so the marginal cost is high-leverage, not waste.
- Runs as one `Workflow` on approval (explicit multi-agent opt-in). No commit/push — delivery is a separate `shipoz` step.

---

# Appendix A — Bundle ↔ finding coverage matrix

Every file that carries a finding maps to exactly one owner; the ledger (Phase 0) guarantees no row is unowned.

| Source file (from report `Dosya:`)       | Owner                    | Source file                               | Owner |
| ---------------------------------------- | ------------------------ | ----------------------------------------- | ----- |
| `bin/install.js`                         | B3                       | `web/answer-map.js`                       | F1    |
| `bin/cli.js`                             | B3                       | `web/app.js`                              | F2    |
| `lib/settings.js`                        | B3                       | `web/live.js`                             | F2    |
| `lib/bridge-client.mjs`                  | B2                       | `web/views.js`                            | F3    |
| `server/server.js`                       | B1                       | `web/themes.js`                           | F4a   |
| `server/bridge.js`                       | B1                       | `web/settings-panel.js`                   | F4b   |
| `mcp-server/askuserquestionspro-mcp.mjs` | B2                       | `web/settings-schema.js`                  | F4b   |
| `hooks/askuserquestionspro-bridge.mjs`   | B2                       | `web/ui-kit.js`                           | F4b   |
| `hooks/hook-output.js`                   | B2                       | `install.sh` / `reinstall.sh`             | B4    |
| `test/*`                                 | with their source module | `.github/workflows/*`, `eslint.config.js` | B5    |

Severity coverage: all 3 Critical (install.js atomic → B3; answer-map OOB ×2 → F1), all 53 High, all 91 Medium, all 44 actionable Low routed; 4 verification rows explicitly marked no-change in the ledger.

---

# Appendix B — Executable Workflow script skeleton (run on approval)

```js
export const meta = {
  name: 'askuserquestionspro-hardening',
  description: 'Remediate all 195 audit findings with systemic fixes + regression guards',
  phases: [
    { title: 'Ledger', detail: 'parse report → finding-ledger.json' },
    { title: 'Fix & Review', detail: 'per-bundle fix then adversarial review (pipeline)' },
    { title: 'Integrate & self-heal', detail: 'format+lint+test, repair loop ≤3' },
    { title: 'Completeness', detail: 'ledger walk, no orphan rows' },
    { title: 'Smoke', detail: 'Chrome MCP + axe-core' },
    { title: 'Docs', detail: 'surgical sync + hardening note' },
  ],
};

const REPORT = '.context/attachments/54n4RS/audit-report.md';

// Pinned contracts injected verbatim into every relevant prompt (see §4).
const CONTRACTS = `
Contract R (round id): provideAnswers(id,answers)→false on id mismatch; cancel(reason,expectedId);
  /answer parses {id,answers}, Array.isArray→400, provideAnswers→409; /ask captures id, disconnect cancels by id;
  live.postAnswers(id,answers) body {id,answers}; app passes round.id. bridge-client/MCP NOT involved.
Contract W (settings): write(patch)→{ok,value,error?}; cli→stderr+exit1; POST /settings→500 on !ok.
Contract L (logger): lib/log.cjs log(scope,x)→stderr "[askuser:<scope>] ...", never throws.
Contract T (test): test/helpers/isolation.js withClean(t,fn) snapshots ENABLED+env, restores in t.after.
Do-not-touch: findings tagged "dogrulama — bulgu degil" → no code change.
`;

const BUNDLES = [
  {
    id: 'B1',
    model: undefined,
    files: ['server/server.js', 'server/bridge.js', 'test/server.test.js', 'test/bridge.test.js'],
    role: 'Single validation authority (deep validQuestions + validAnswers); Contract R server side; readBody Buffer.concat + deterministic 8MB reject; static cache/ETag; consumes W,L; tests: wire round-trip, fuzz, 409, 403, poll-not-sleep; use withClean.',
  },
  {
    id: 'B2',
    model: undefined,
    files: [
      'lib/bridge-client.mjs',
      'hooks/askuserquestionspro-bridge.mjs',
      'hooks/hook-output.js',
      'mcp-server/askuserquestionspro-mcp.mjs',
      'test/bridge-client.test.js',
      'test/mcp-server.test.js',
      'test/hook-output.test.js',
    ],
    role: 'CREATE lib/log.cjs; TimeoutError + null-answers guard; ensureServer single-flight + surfaced spawn err; MCP catch(e)+notification fix; hook watchdog+EPIPE; MCP child try/finally; extend e2e wire test; withClean.',
  },
  {
    id: 'B3',
    model: 'sonnet',
    files: [
      'lib/settings.js',
      'bin/cli.js',
      'bin/install.js',
      'lib/atomic-write.cjs',
      'test/settings.test.js',
      'test/install.test.js',
    ],
    role: 'CREATE lib/atomic-write.cjs (tested incl. failure) used by settings+install (Critical #1); Contract W producer; CLI try/catch + spawn error listener + signal exit + doctor timeout + main().catch; addHook conflict; isOurEntry boundary.',
  },
  {
    id: 'B4',
    model: 'sonnet',
    files: ['install.sh', 'reinstall.sh'],
    role: 'Intent-based dedupe; jq validate-before-mv; pinned-SHA fetch + shasum -c (no curl|bash); quote pids (readarray); WORKDIR+quoted trap; PORT validation; jq -e verify.',
  },
  {
    id: 'B5',
    model: 'sonnet',
    files: [
      '.github/workflows/ci.yml',
      '.github/workflows/release.yml',
      'eslint.config.js',
      'test/workflows-ci.test.js',
      'test/workflows-release.test.js',
      'test/eslint-prettier-config.test.js',
      'test/changesets-config.test.js',
    ],
    role: 'no-empty{allowEmptyCatch:false}; @babel/eslint-parser+eslint-plugin-react-hooks on web/**; shellcheck CI step; SHA-pin checkout+setup-node; assert all in tests. Use web fetch to resolve action SHAs for v4 tags.',
  },
  {
    id: 'F1',
    model: undefined,
    files: ['web/answer-map.js', 'test/helpers/isolation.js', 'test/answer-map.test.js'],
    role: 'CREATE optionLabel(q,i) + withClean; Critical #2/#3 via accessor; tree single-source; multi stale-customText; isAnswered bounds; absorb F2 stale-prone decisions as pure helpers; fuzz/property tests; setEnabled leak→withClean.',
  },
  {
    id: 'F2',
    model: undefined,
    files: ['web/app.js', 'web/live.js'],
    role: 'Contract R client side; delegate stale-prone decisions to F1 helpers (no ref.current in decisions) to satisfy exhaustive-deps; number-key guard; binary bounds; inflight ref; popup stale-q; Enter-retry; postAnswers net/server split; SSE backoff+jitter+timeout; setRound eq-guard; toast/focus.',
  },
  {
    id: 'F3',
    model: 'sonnet',
    files: ['web/views.js'],
    role: 'TreeCard confirmed reset; fullOptions cardinality; RankingCard cursor; CustomPopup role=dialog+focus-trap; ~14 ARIA gaps; aria-hidden inside Check. Verified by axe.',
  },
  {
    id: 'F4a',
    model: 'sonnet',
    files: ['web/themes.js', 'test/themes.test.js'],
    role: 'swatch↔token color fixes; document.head null-guard; read/swapFont/USED_KEYS/blur/token-syntax tests.',
  },
  {
    id: 'F4b',
    model: 'sonnet',
    files: ['web/settings-panel.js', 'web/settings-schema.js', 'web/ui-kit.js'],
    role: 'isSaving+AbortController+Save-disable; cancel-revert; double-save guard; SettingRow aria-label; applyAll catch→console.warn.',
  },
];

// ---- Phase 0: ledger (the only full-report read) ----
phase('Ledger');
const LEDGER_SCHEMA = {
  /* {findings:[{id,severity,file,line,title,type:'bug'|'verification'}]} */
};
const ledger = await agent(
  `Read ${REPORT} fully. Emit EVERY finding as a row. type='verification' iff its text contains "dogrulama — bulgu degil". Group nothing; just the flat list.`,
  { label: 'ledger', phase: 'Ledger', model: 'sonnet', schema: LEDGER_SCHEMA }
);

// ---- Phase 1: fix → review (pipeline, no barrier) ----
phase('Fix & Review');
const FIX_SCHEMA = {
  /* {changed:[paths], findingsAddressed:[ids], notes} */
};
const REVIEW_SCHEMA = {
  /* {perFinding:[{id,verdict:'fixed'|'partial'|'broken',note}], regressions:[]} */
};

const reviewed = await pipeline(
  BUNDLES,
  (b) =>
    agent(
      `${CONTRACTS}\nYou OWN exactly: ${b.files.join(', ')}. Touch no other file.\n` +
        `grep "${'**Dosya:**'}" ${REPORT} and read ONLY the finding blocks whose Dosya is one of your files. ` +
        `Fix EVERY one at production grade (KISS/YAGNI/SOLID, reuse the consolidation primitives, no new runtime deps). ` +
        `Bundle role: ${b.role}\nAdd the regression tests the report calls for to YOUR test files. ` +
        `Mark deliberate simplifications with // ponytail:. Leave "dogrulama — bulgu degil" findings unchanged.`,
      { label: `fix:${b.id}`, phase: 'Fix & Review', model: b.model, schema: FIX_SCHEMA }
    ),
  (fix, b) =>
    agent(
      `Adversarial review of bundle ${b.id}. Pull this bundle's rows from the ledger (independent of the fixer): ` +
        `${'$'}{JSON of ledger rows where file ∈ b.files}. Read \`git diff -- ${b.files.join(' ')}\`. ` +
        `For EACH ledger row: is it truly fixed, production-grade, no regression? Verdict fixed/partial/broken. List any new issues.`,
      { label: `review:${b.id}`, phase: 'Fix & Review', model: 'sonnet', schema: REVIEW_SCHEMA }
    )
);

// ---- Phase 2: integrate + self-heal (≤3) ----
phase('Integrate & self-heal');
const GATE_SCHEMA = {
  /* {green:boolean, failures:[{kind:'test'|'lint'|'format'|'shellcheck',detail}]} */
};
let green = false,
  attempt = 0,
  gate;
while (!green && attempt < 3) {
  gate = await agent(
    `Run: npm run format ; npm run lint ; npm test ; shellcheck install.sh reinstall.sh. Return green + structured failures.`,
    {
      label: `gate:${attempt}`,
      phase: 'Integrate & self-heal',
      model: 'sonnet',
      schema: GATE_SCHEMA,
    }
  );
  if (gate.green) {
    green = true;
    break;
  }
  await agent(
    `${CONTRACTS}\nThe gate is red. Failures: ${'$'}{JSON gate.failures}. Fix the integration/contract breaks and any ` +
      `residual react-hooks exhaustive-deps warnings. Minimal, production-grade. Do not mass-suppress lint.`,
    { label: `repair:${attempt}`, phase: 'Integrate & self-heal' /* Opus */ }
  );
  attempt++;
}

// ---- Phase 3: completeness (independent ledger walk) ----
phase('Completeness');
const ORPHAN_SCHEMA = {
  /* {rows:[{id,status:'fixed'|'verification'|'orphan',evidence}]} */
};
const critic = await agent(
  `Walk EVERY ledger row top-to-bottom. Against the final \`git diff\`, classify each: fixed / verification-no-change / orphan. ` +
    `Zero orphan rows allowed; list any orphan with the exact missing change.`,
  { label: 'critic', phase: 'Completeness', model: 'sonnet', schema: ORPHAN_SCHEMA }
);
const orphans = critic.rows.filter((r) => r.status === 'orphan');
if (orphans.length)
  await agent(`Fix these orphan findings: ${'$'}{JSON orphans}`, {
    label: 'repair:orphans',
    phase: 'Completeness' /* Opus */,
  });

// ---- Phase 4: smoke + axe ----
phase('Smoke');
const SMOKE_SCHEMA = {
  /* {consoleErrors:[], axeViolations:[], typesExercised:[], contractRok:boolean} */
};
const smoke = await agent(
  `Use claude-in-chrome. Start \`node bin/cli.js serve\`. Open http://127.0.0.1:4517. Drive ONE round covering ` +
    `single/multi/binary/scale/ranking/tree + keyboard shortcuts (1-9,Enter,u,b,arrows). Submit and confirm it resolves ` +
    `(proves Contract R wire). Inject axe-core from CDN, run axe.run(). Return console errors + axe violations.`,
  { label: 'smoke', phase: 'Smoke', model: 'sonnet', schema: SMOKE_SCHEMA }
);

// ---- Phase 5: docs ----
phase('Docs');
const docs = await agent(
  `Surgically update docs per the code-area→doc map for everything changed in the final diff: api.md, backend.md, ` +
    `frontend.md, testing.md, tech-stack.md, README.md. CREATE docs/hardening.md (5 themes + consolidation layer + guards). ` +
    `Bump docs/README.md synced hash. Touch only affected sections.`,
  { label: 'docs', phase: 'Docs', model: 'sonnet' }
);

return { ledger, reviewed, gate, green, critic, smoke, docs };
```

> Notes on the skeleton: `model:undefined` = inherit the session model (Opus) for the 4 hard bundles; `'sonnet'` elsewhere (`modeloz`). `pipeline()` runs fix→review per bundle with no barrier (review starts as each bundle lands); the barrier is the gate. The self-heal loop and orphan-repair use the inherited Opus model. Schemas are sketched as comments — fill concrete JSON Schema at run time.
