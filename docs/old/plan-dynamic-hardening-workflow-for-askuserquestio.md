# Plan — Dynamic hardening workflow for askuserquestionspro (195-finding audit remediation)

## Context

`.context/attachments/54n4RS/audit-report.md` is a code audit of **askuserquestionspro** (the full-screen web-UI bridge that replaces Claude Code's `AskUserQuestion`). It lists **195 verified findings**: 3 Critical, 53 High, 91 Medium, 48 Low — of which **4 "Low" are verifications (not bugs)**. So **191 actionable fixes**.

The user wants **all 191 fixed at production grade** (KISS/YAGNI/SOLID, no MVP shortcuts), plus **regression systems so the same classes can't recur**, then **docs updated**. This must run as a **single dynamic Workflow** that is **token-efficient** and uses **cost-aware model selection** (strong models for hard/coordinated work, cheap models for mechanical/parallel work — the `modeloz` principle).

The report itself notes heavy duplication (the zombie-process finding is restated 5×, `setEnabled` leak 6×, ranking-OOB and cross-round race several times each). Distinct fixes ≈ 90–100. Findings cluster cleanly **by owning file** and by **5 systemic themes**:

- **A — Silent error swallowing** (`catch {}` that drops the error; fake success).
- **B — Contract/invariant validation lost at layer boundaries** (Claude→Hook→HTTP→Bridge→UI).
- **C — Stale reference/state** (ref/state/closure desync in React).
- **D — Test isolation / global-state leakage** (`ENABLED`, `process.env`, bridge singleton; no `beforeEach`/`afterEach`).
- **E — Operational blindness** (failures with no structured log).

## Strategy: file-ownership bundles + two pinned cross-bundle contracts

The Workflow runs agents in **parallel on a shared working tree**, so the partition rule is: **every parallel agent owns a disjoint set of files** (source + its test file). No two agents ever touch the same path → zero clobbering, zero merge conflicts. Each agent fixes **every** finding for its files holistically (shared helpers where the report says so), adds the missing regression tests, and leaves correct code alone.

Two fixes are inherently cross-file. We do **not** split them across agents; instead we **pin the contract in the plan** and hand each side to its file-owner. Signatures verified against current source:

### Contract R — round identity (kills the #1 theme: cross-round answer mix-up)

Current: `provideAnswers(answers)`, `cancel(reason)`, `/answer` body `{answers}`, `postAnswers(answers)`, `peek()→{id,questions}`.
**New (pinned):**

- `server/bridge.js`: `provideAnswers(id, answers)` → `if (!this._pending || this._pending.id !== id) return false;` then resolve, return `true`. `cancel(reason, expectedId)` → `if (!this._pending) return false; if (expectedId != null && this._pending.id !== expectedId) return false;` then reject.
- `server/server.js`: `POST /answer` parses `{id, answers}`; **boundary-validate** `Array.isArray(answers)` → `400`; then `if (!bridge.provideAnswers(id, answers)) → 409 {error:'stale or no pending round'}`. `/ask` captures its submit `id` and the disconnect handler calls `bridge.cancel('client disconnected', id)`.
- `web/live.js`: `postAnswers(id, answers)` POSTs `{id, answers}`.
- `web/app.js`: passes `round.id` (from `useLiveQuestions`) into `postAnswers`.
- `lib/bridge-client.mjs` / MCP are **NOT** part of R (they drive `/ask`, not `/answer`) — keep them decoupled.

### Contract W — settings write signals failure (kills fake "saved")

Current: `write(patch)` always returns `next`, even when the disk write throws (swallowed).
**New (pinned):** `write(patch) → { ok: boolean, value, error? }`. Success `{ok:true,value:next}`; failure logs stderr, unlinks the orphan `.tmp`, returns `{ok:false,value:next,error}`.

- Consumers: `bin/cli.js` settings-set → `if (!r.ok) { stderr + exit 1 }`; `server/server.js POST /settings` → `if (!r.ok) 500` else `200 {ok:true, settings:r.value}`.

### Do-not-touch list

Any finding whose text contains **"dogrulama — bulgu degil"** (4 of them: bridge sync read atomicity, `live.js` closed-guard, the state-safe `JSON.parse` catch, …) requires **no code change** — at most a one-line clarifying comment. Agents are told this explicitly so correct code isn't churned.

## Bundles (all file sets disjoint)

| #       | Bundle                         | Owns (source + tests)                                                                                                                                                                                                   | Model                        | Scope highlights                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1**  | HTTP/Bridge core               | `server/server.js`, `server/bridge.js`, `test/server.test.js`, `test/bridge.test.js`                                                                                                                                    | **Opus**                     | Contract R server side; `readBody` 8MB sync-reject + hang guards; `Buffer.concat` (O(n²)→O(n)); broadcast dead-write; `submitQuestions` sync-throw/early-409; static-asset cache+ETag; settings in-mem cache; EADDRINUSE→exit(1)+log; new tests: concurrent-/ask 409, /answer-no-pending 409, >8MB→400, traversal 403, poll-not-sleep. Consumes Contract W (→500).                                                                                                                                                                       |
| **B2**  | Node edge (client/hook/MCP)    | `lib/bridge-client.mjs`, `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js`, `mcp-server/askuserquestionspro-mcp.mjs`, `test/bridge-client.test.js`, `test/mcp-server.test.js`, `test/hook-output.test.js`  | **Opus**                     | `askBridge` TimeoutError + `.answers` null-guard + JSON-parse catch; `ensureServer` surface spawn error + single-flight; `openBrowser` dead-catch; MCP `catch{}`→`catch(e)` + `id===undefined` notification fix + `sendResponse` try/catch; hook `readStdin` watchdog + EPIPE callback + uncaught arg; **MCP test `try/finally` child kill** (the 5× zombie); `XDG_CONFIG_HOME` isolation; filter/force-MCP tests.                                                                                                                       |
| **B3**  | Settings/CLI/install.js        | `lib/settings.js`, `bin/cli.js`, `bin/install.js`, `test/settings.test.js`, `test/install.test.js`                                                                                                                      | Sonnet                       | Contract W producer + `.tmp` cleanup; **install.js atomic write (Critical #1)** tmp→rename; CLI try/catch around read/writeSettings; spawn `'error'` listener + signal-aware exit code; `cmdDoctor` fetch timeout; `main().catch`; toggle hint yes/no; `addHook` conflict-vs-already; `isOurEntry` boundary; write() error-path test.                                                                                                                                                                                                    |
| **B4**  | Shell installers               | `install.sh`, `reinstall.sh`                                                                                                                                                                                            | Sonnet (security-careful)    | Intent-based hook dedupe; jq corrupt → no fake success + validate before `mv`; **supply-chain: replace `curl\|bash` with pinned-SHA download + `shasum -c`**; quote `$pids`/`$remaining` (`readarray`); `cp -R` error msg; empty-content guard; `rm -rf` failure msg; `TMPDIR`→`WORKDIR` + single-quote trap; PORT validation; drop vestigial `hooks:{}`; verify via `jq -e` not grep.                                                                                                                                                   |
| **B5**  | CI / guardrails / supply-chain | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `eslint.config.js`, `test/workflows-ci.test.js`, `test/workflows-release.test.js`, `test/eslint-prettier-config.test.js`, `test/changesets-config.test.js` | Sonnet (+web fetch for SHAs) | **SHA-pin `actions/checkout@v4` & `actions/setup-node@v4`**; **ESLint `no-empty {allowEmptyCatch:false}`**; **`shellcheck` step** in CI lint job for `*.sh`; update workflow tests to assert the new pins/steps.                                                                                                                                                                                                                                                                                                                         |
| **F1**  | Answer-map logic               | `web/answer-map.js`, `test/answer-map.test.js`                                                                                                                                                                          | **Opus**                     | **Critical #2/#3**: ranking OOB in `mapAnswers` + `summaryText` → shared guarded label-mapper (`o ? o.label : null` + filter); tree truncated-path via `treeNodeAt/isLeaf` single source; `decideActivate` multi stale-customText popup; `isAnswered(ranking)` bounds; **`setEnabled` leak → `describe`+`beforeEach`/`afterEach`** (establishes the isolation pattern); OOB/edge tests.                                                                                                                                                  |
| **F2**  | App + live (state machine)     | `web/app.js`, `web/live.js`                                                                                                                                                                                             | **Opus**                     | Contract R client side; number-key type guard; binary bounds; double-submit `inflight` ref; `CustomPopup` stale-`q` guard + auto-dismiss; `savePopup/removeCustom` stale guard; Enter-retry path; `submit()` stale `ref.current.answers` (pass as arg); `goBack`/`jumpToNextUnanswered` stale; `key` collision → stable id/index; `postAnswers` error-type split (net vs server); SSE backoff+jitter, fetch timeout, `onerror` clearTimeout, equality-guarded `setRound`; toast dismiss; `aria-keyshortcuts`; return-focus `triggerRef`. |
| **F3**  | Views (a11y + view-state)      | `web/views.js`                                                                                                                                                                                                          | Sonnet                       | TreeCard `confirmed:false` reset; `fullOptions` cardinality on type-degrade; RankingCard stale-cursor ref; CustomPopup `role=dialog`/`aria-modal`/focus-trap; ~14 ARIA gaps (accordion `aria-expanded`, range label/valuetext, ranking `role=listbox`, tree `role=tree`, binary/single/multi `aria-pressed`, sidebar-search label, `aria-current`, progressbar role, show-unanswered switch, `h1`→`h2`+sr-only `h1`).                                                                                                                    |
| **F4a** | Themes                         | `web/themes.js`, `test/themes.test.js`                                                                                                                                                                                  | Sonnet                       | amoled/aurora swatch↔token color fixes; `swapFont` `document.head` null-guard; tests: read() cascade, swapFont idempotency/null-font, `USED_KEYS⊇KNOWN_TOKENS` drift, surface-blur cleanup, token-syntax validation.                                                                                                                                                                                                                                                                                                                     |
| **F4b** | Settings-panel/schema/ui-kit   | `web/settings-panel.js`, `web/settings-schema.js`, `web/ui-kit.js`                                                                                                                                                      | Sonnet                       | `SettingsModal` `isSaving` flag + Save-disable + `AbortController` on unmount; cancel-revert of in-flight live preview; double-save reentrancy; `SettingRow aria-label`; `applyAll` empty-catch→`console.warn` (browser); add `aria-hidden` inside the `Check` SVG once (DRY, covers all call sites).                                                                                                                                                                                                                                    |

Model split follows `modeloz`: **Opus** only for the 4 hard/coordinated/correctness bundles (B1, B2, F1, F2) + the repair agent; **Sonnet** for the 6 mechanical/parallel bundles, all reviewers, the critic, the smoke test, and docs. No bundle reads the 102 KB report — each greps it for its own files' `**Dosya:**` blocks (the big token saver).

## Workflow shape (self-healing)

```
phase 'Fix & Review'  — pipeline over the 10 bundles (no barrier):
    stage1 fix:    agent(fixPrompt(b))   model=b.model   schema=FIX_REPORT
    stage2 review: agent(reviewPrompt(b))  model=sonnet   schema=REVIEW
                   (adversarial: re-reads `git diff -- <b.files>`, verifies EACH
                    finding for b.files is really fixed, production-grade, no regression)
--- barrier ---
phase 'Integrate & self-heal'  — loop ≤3:
    gate = agent('npm run format && npm run lint && npm test; return pass/fail+details')
    if gate.green: break
    agent(repairPrompt(gate.failures))   model=opus     // fixes integration/contract breaks
phase 'Completeness'  — agent(criticPrompt) schema=ORPHANS  (every non-verification
    finding addressed?); if orphans → one targeted repair.
phase 'Smoke'  — agent(chromeSmokePrompt)  // claude-in-chrome: serve, open UI, run a
    full question round end-to-end (proves Contract R wire), assert 0 console errors +
    key ARIA present (dialog/progressbar/aria-pressed).
phase 'Docs'  — agent(docsSyncPrompt) model=sonnet
return { reviewed, gate, critic, smoke, docs }
```

If the loop is still red after 3 rounds, the workflow returns and **I repair in the main loop** (Opus) with you watching.

## Regression systems ("won't happen again")

Woven into the bundles, each minimal:

1. **ESLint `no-empty {allowEmptyCatch:false}`** (B5) — silent catches fail CI forever (Theme A). `web/**` is ESLint-ignored, so its two browser cases get explicit `console.warn` instead (F1-ish/F4b).
2. **`shellcheck` in CI** (B5) — unquoted vars / word-split caught on every PR (Theme A/B in shell).
3. **Test isolation pattern** — `describe`+`beforeEach`/`afterEach` resets `ENABLED`/env/bridge (F1 sets the template; B1/B2 follow). MCP child cleanup via `try/finally` (Theme D).
4. **SHA-pinned Actions** (B5) — supply-chain.
5. **Error-path tests everywhere the report flags a gap** — the regressions become detectable (Theme B/D).
6. **Structured stderr logging** at every former swallow site (Theme E).

ponytail guard: atomic write stays **inline tmp→rename** in both `settings.js` and `install.js` (3 lines each) rather than a new shared module — extract only if a common lib already exists. Deliberate simplifications get `// ponytail:` comments.

## Docs (surgical sync + hardening note)

After green, one Sonnet agent updates **only** affected files via the code-area→doc map:

- `docs/api.md` — `/answer` now `{id,answers}` + 400/409; `POST /settings` 500-on-failure.
- `docs/backend.md` — `write()→{ok,value}`; bridge id-ownership; install.js atomic write; shell hardening.
- `docs/frontend.md` — a11y additions, `postAnswers(id,answers)`, SSE backoff.
- `docs/testing.md` — new error-path tests + isolation pattern.
- `docs/tech-stack.md` — shellcheck, SHA-pins, `no-empty` rule.
- `README.md` — troubleshooting/CLI error messages if surfaced.
- **`docs/hardening.md` (new)** — concise note: the 5 themes, what each fix class did, the guardrails added (the requested CHANGELOG-style summary).
- `docs/README.md` — bump synced-commit hash.

## Verification (end-to-end)

1. `npm test` (13 files + new error-path tests) — all green.
2. `npm run lint` (with `no-empty`) + `npm run format:check` — clean.
3. `shellcheck install.sh reinstall.sh` — clean.
4. **Chrome MCP smoke**: `node bin/cli.js serve` → open `http://127.0.0.1:4517` → drive one round of mixed question types → submit → assert resolved, **0 console errors**, ARIA present. This is the only check that exercises Contract R across the browser↔server wire (unit tests can't).
5. Spot-repro 2–3 Criticals from the report (e.g. `mapAnswers([{type:'ranking',options:[{label:'A'}]}],{ 'R?':{order:[0,5]} })` no longer throws; read-only config → `write()` returns `{ok:false}`).

## Files created/modified

- **Modified:** all paths in the bundle table (≈28 source/test files) + `docs/*` + `README.md`.
- **Created:** `docs/hardening.md`; possibly a `.changeset/*.md` entry; no new runtime modules (zero-dep invariant preserved).

## Execution note

This runs as one `Workflow` tool call on approval (explicit multi-agent opt-in). It does **not** commit or push — delivery is a separate `shipoz` step you trigger afterward.
