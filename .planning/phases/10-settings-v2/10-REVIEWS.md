---
phase: 10-settings-v2
cycle: 1
reviewed: 2026-07-17T00:00:00Z
depth: deep
source_grounding: grep-and-line-trace
files_reviewed: 25
files_reviewed_list:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
  - .planning/phases/10-settings-v2/10-CONTEXT.md
  - .planning/phases/10-settings-v2/10-UI-SPEC.md
  - .planning/phases/10-settings-v2/10-01-PLAN.md
  - .planning/phases/10-settings-v2/10-02-PLAN.md
  - .planning/phases/10-settings-v2/10-03-PLAN.md
  - web/settings-schema.js
  - web/settings-panel.js
  - web/app.js
  - web/live.js
  - web/draft-writer.js
  - web/index.html
  - web/styles.css
  - lib/settings.js
  - lib/atomic-write.cjs
  - lib/bridge-client.mjs
  - server/server.js
  - server/bridge.js
  - bin/cli.js
  - test/settings-schema.test.js
  - test/settings.test.js
  - test/settings-panel.test.js
  - test/server.test.js
findings:
  high: 4
  actionable_non_high: 5
  total: 9
status: issues_found
---

# Phase 10 Settings v2 — Cycle 1 Cross-AI Plan Review

## Summary

The three plans have a sensible dependency order and correctly identify the
existing UMD schema, XDG-isolated persistence, atomic writer, localhost HTTP
boundary, CLI, and vendored React/CSS surface. The UI-SPEC also gives useful
interaction and copy requirements. However, the plans are not yet
implementation-safe: the required v2 vocabulary and namespace model are not
defined, several required values have no runtime consumer in the planned file
set, and the existing global question keyboard handler will remain active
behind the new dialog unless an explicit arbitration seam is added. Migration
future-version handling is stated as an outcome but is not specified as a
status-preserving API used by every mutation path. The focused current test
baseline passes (141 tests), but the proposed source-only browser tests cannot
prove the claimed dialog, focus, async rollback, or shortcut behavior.

## Scope and source-grounding result

All file and symbol references in the plans were checked against the checkout.
The current settings implementation is materially smaller than the Phase 10
contract: `web/settings-schema.js:37-305` contains the existing appearance,
question-type, behavior, and interface entries; `lib/settings.js:11-16`
resolves one flat file and writes `_v: 1`; and the only settings HTTP mutation
is the legacy `POST /settings` branch at `server/server.js:563-587`.

The plans' future `10-01-SUMMARY.md` and `10-02-SUMMARY.md` context references
do not exist yet. That is expected for dependency outputs before execution and
is not counted as a finding, but each wave must produce the referenced summary
before the next wave starts.

## Strengths

- Wave ordering is coherent: schema/persistence precedes HTTP/CLI operations,
  which precedes the browser surface.
- The plans preserve the important project constraints: Node 18+, zero
  production dependencies, vendored React/Babel, XDG isolation, and the
  loopback-only server.
- The plans explicitly reject executable host commands, adapter command
  strings, secrets, question content, answer content, and loopback controls
  from the import/export contract.
- The proposed operations retain the current successful `POST /settings`
  caller while adding explicit transactional behavior, and they preserve the
  current host install/doctor/uninstall scope.
- The UI-SPEC is unusually concrete about copy, loading/error/rollback states,
  effect timing, target size, focus return, live regions, and reduced motion.
- Existing test seams are real: Node tests require the UMD schema directly,
  settings tests isolate `XDG_CONFIG_HOME`, server tests exercise the live
  localhost boundary, and the panel tests document the current source-level
  accessibility convention.

## Findings

### HIGH

#### H-01 — The v2 vocabulary and namespace contract are absent

**Evidence:** The Phase 10 success criterion requires browser launch,
retention, autosave, recovery, diagnostics, delivery, post-submit closure,
and adapter preferences (`.planning/ROADMAP.md:74-80`; the same vocabulary is
SET-03 in `.planning/REQUIREMENTS.md:28-35`). Plan 10-01 only says “complete
Phase 10 namespaces” and “bounded validators” (`10-01-PLAN.md:16-26,
74-82`); it does not enumerate the keys, namespace identifiers, types,
defaults, bounds, sensitivity, importability, or effect owners. The current
schema has only the existing entry list (`web/settings-schema.js:37-305`),
and its current test asserts the exact 17-key shape
(`test/settings.test.js:104-110`).

**Impact:** There is no source-grounded way to tell whether SET-03 is complete,
whether a “namespace” means an existing `group` or a new nested envelope, or
whether 10-02 reset/export and 10-03 rendering are operating on the same
contract. A schema can technically pass the plan's broad task wording while
omitting any of the required recovery controls.

**Required plan change:** Add a normative settings matrix to 10-01 (or a
committed contract artifact referenced by all three plans) that defines the v2
envelope/version marker, exact namespaces and keys, types/defaults/ranges,
unknown-key behavior, sensitive/import/export policy, and `live`/`reload`/
`runtime` effect ownership for every SET-03 term. Add an exact-key fixture
assertion and namespace membership/reset tests. Make 10-02 and 10-03 consume
those identifiers rather than relying on the word “namespace.”

#### H-02 — Core settings are persisted by the planned work but are not wired to their consumers

**Evidence:** Browser launch is implemented in `lib/bridge-client.mjs:96-112`
and currently controlled by `ASKUSER_OPEN_BROWSER`; retention is selected when
the server constructs `Bridge` from `ASKUSER_DETACHED_ROUND_TTL_MS` in
`server/server.js:13-27`, then captured into records and timers by
`server/bridge.js:42-61,162-168,270-283`; draft/autosave behavior is in
`web/app.js:78-97` and `web/draft-writer.js:32-117`; submit/delivery behavior
is in `web/app.js:319-348`; and adapter/host behavior is split across
`lib/bridge-client.mjs`, the hook, MCP server, and `lib/host-platforms.cjs`.
None of `lib/bridge-client.mjs`, `server/bridge.js`, `web/app.js`,
`web/live.js`, or `web/draft-writer.js` is in the Phase 10 `files_modified`
lists. Plan 10-02's action only extends the settings endpoint
(`10-02-PLAN.md:56-66`), while 10-03's action only refactors the settings
panel (`10-03-PLAN.md:56-66`).

**Impact:** The new values can become durable, exportable, and visible while
remaining inert. In particular, changing browser strategy cannot affect
`openBrowser`, changing retention cannot affect the `Bridge` constructor, and
autosave/delivery/closure preferences have no planned integration point. This
does not satisfy the roadmap's “configure the recovery and delivery
experience” outcome or the promise that supported clients retain the choices.

**Required plan change:** Either add explicit consumer tasks/files and
regression seams for each runtime-owned namespace (including precedence over
the existing environment variables), or explicitly defer each behavior to a
later phase and remove it from Phase 10's completion claims. At minimum, the
plans need a shared effective-settings loader used at bridge/client/browser
startup, tests proving the selected values reach each consumer, and a clear
rule for host adapter defaults versus user settings.

#### H-03 — The current global question keyboard handler will steal dialog keystrokes

**Evidence:** The existing `Flow` listener handles arrows, Enter, `B`, `1-9`,
and `U` at `web/app.js:351-410`; it suppresses itself only when the active
element is an `INPUT` or `TEXTAREA` (`web/app.js:355-359`). The settings controls
are buttons (`web/settings-panel.js:39-62`), and the current modal is rendered
alongside `Flow` with no dialog ownership state (`web/app.js:29-34`). The UI-SPEC
explicitly requires that no global shortcut steal dialog keystrokes
(`10-UI-SPEC.md:112-120`), while 10-03 does not include `web/app.js` in its
modified files or describe how the two event systems arbitrate
(`10-03-PLAN.md:7-13,59-64`).

**Impact:** While a user focuses a settings segment or button, Enter can submit
or confirm the question flow and arrow/number keys can navigate or select the
underlying round. A source assertion that a button has an accessible name
cannot catch this cross-component interaction. This is a direct SET-06
accessibility and data-safety failure.

**Required plan change:** Add an explicit modal-open gate to the `Flow` key
handler (or a formally tested capture/propagation boundary) and include
`web/app.js` plus a mounted/integration regression in 10-03. The test must open
the dialog over an active round and prove Enter, arrows, number keys, `B`, and
`U` do not mutate or submit the round, while dialog Escape/Enter semantics
still work and focus returns to the FAB.

#### H-04 — Future-version safety is not preserved across all mutation paths

**Evidence:** `lib/settings.js:29-35` currently catches missing, corrupt, and
all other read failures and returns defaults. `lib/settings.js:43-53` then
merges a patch over `read()` and writes `_v: 1`. The server's current settings
mutation calls that write path directly (`server/server.js:563-586`), and the
CLI doctor currently prints raw parsed disk state plus `Settings.read()`
(`bin/cli.js:510-526`). Existing fixtures only cover missing/corrupt files,
normal `_v:1` writes, and self-healing defaults
(`test/settings.test.js:275-334`); there is no future-version fixture.

Plan 10-01 promises a typed future-version result and an unchanged file
(`10-01-PLAN.md:88-96`), and 10-02 promises future-version 4xx responses and
rollback (`10-02-PLAN.md:58-66`), but neither plan specifies a status-bearing
load API that every write, import apply, reset, CLI command, and doctor call
must use. If the new implementation retains the current read/merge shape, a
valid import or namespace reset can turn a future file into a v2/default file,
which violates both SET-02 and the roadmap's “without replacing the user's
current configuration” rule.

**Required plan change:** Define a single `load/inspect` result carrying
missing, legacy, current, invalid, and unsupported-future states, and make all
mutations refuse to replace an unsupported-future or invalid current file
unless the user performs an explicitly documented recovery action. Specify
doctor's status projection separately from effective values. Add tests for
valid import, reset, CLI set, and doctor against a future file, asserting byte
preservation; also test backup-creation failure before any migration write.

### Actionable non-HIGH

#### M-01 — Version boundary, precedence, and legacy fixture semantics are underspecified

**Evidence:** The roadmap calls out deciding the v2 boundary, precedence, and
unknown-future policy against current fixtures (`.planning/ROADMAP.md:89-90`).
Plan 10-01 mentions “legacy v1/current unversioned fixtures,” “documented v2
envelope/version,” and a stable backup name (`10-01-PLAN.md:74-96`), but does
not say whether v2 uses `_v:2` or a new `version` field, what the existing flat
`_v:1` file means, how unversioned keys map, how environment variables and
settings values are ordered, or whether unknown keys are ignored, preserved,
or surfaced per namespace. The repository has inline tests rather than
versioned fixture files (`test/settings.test.js:281-334`).

**Required plan change:** Add concrete v1/unversioned/current/future JSON
fixtures, an explicit precedence table, the unknown-key policy, and migration
output/status examples before implementation. Include idempotence assertions
for both effective values and backup count.

#### M-02 — HTTP operation routes and preview/apply concurrency semantics are not a testable contract

**Evidence:** The only existing route is `POST /settings` with a flat patch
(`server/server.js:563-587`; `docs/api.md:13-24`). Plan 10-02 says “explicit
preview, apply, export, and namespace-reset operations” and “clear response
envelopes” (`10-02-PLAN.md:54-66`), but supplies no method/path matrix,
payload shape, preview identity, status codes per operation, or stale-preview
behavior. It also says apply may accept a “previously valid complete payload”
without defining whether the current snapshot is compared before commit
(`10-02-PLAN.md:59-64`).

**Required plan change:** Add the endpoint matrix and JSON examples to the
plan/API docs task, including a baseline revision/hash or equivalent
compare-and-swap rule so a preview cannot overwrite a newer CLI/tab change.
Test preview-no-write, changed-baseline rejection, repeated apply, reset
isolation, deterministic export bytes, and no-store/redaction headers.

#### M-03 — CLI `import-preview` is promised in one section and omitted from the executable task

**Evidence:** Plan 10-02's artifact must-have says the CLI exposes “settings
export/import-preview/reset” (`10-02-PLAN.md:22-28`), but Task 2 only specifies
export, reset, and doctor (`10-02-PLAN.md:69-80`). The current dispatcher passes
only three positional settings arguments (`bin/cli.js:531-545`), and usage
documents only list/get/set (`bin/cli.js:42-53`).

**Required plan change:** Decide whether CLI import-preview is in scope. If it
is, specify stdin/file input, output format, exit codes, payload size, and
whether apply is deliberately absent; add the usage/help change and isolated
spawn tests. If it is not, remove it from the artifact claim and document that
preview is HTTP/browser-only.

#### M-04 — The proposed automated tests cannot prove the claimed browser behavior

**Evidence:** The existing panel suite explicitly tests source text because
the JSX module has no Node runtime (`test/settings-panel.test.js:1-5,22-109`),
and the existing views accessibility suite uses the same source-text approach
(`test/views-a11y.test.js:1-23`). Plan 10-03's done criteria claim real dialog
semantics, focus containment, async rollback, import gating, and persisted
value handling (`10-03-PLAN.md:56-66`), while its automated verify command is
only those Node suites (`10-03-PLAN.md:65`) and its human check has no
repeatable browser URL, fixture, expected event/announcement record, or
evidence artifact (`10-03-PLAN.md:69-74`).

**Required plan change:** Add a browser-level verification path that fits the
zero-production-dependency constraint, or narrow the automated claims and
write a deterministic manual checklist. The checklist must cover an active
round, failed save/import, future-version import, focus trap/return, live
regions, narrow viewport, high contrast, reduced motion, and reload/migration;
record pass/fail evidence in the phase verification artifact.

#### M-05 — Backup creation failure and backup-file durability are not specified

**Evidence:** Plan 10-01 requires a one-time backup and says to “choose a
stable backup naming/retention rule” (`10-01-PLAN.md:86-96`) but does not state
whether migration stops when backup creation fails, how backup collisions are
handled, or how backup permissions are enforced. The shared writer supports
private mode and file `fsync` for its target (`lib/atomic-write.cjs:159-193`),
but that does not automatically cover a separately copied backup. Current
settings tests do not exercise any backup path (`test/settings.test.js:274-393`).

**Required plan change:** Specify a private, collision-safe backup protocol,
failure ordering, retention/cleanup policy, and whether backup plus migrated
file must both be durable before the old file is replaced. Add injected
copy/chmod/rename failure tests proving the original file remains intact and
repeated reads do not create additional backups.

## Plan-level verification checklist

Before execution is accepted, the revised plans should make these claims
directly verifiable:

- Exact SET-01..SET-06 traceability reaches a concrete key/namespace, consumer,
  endpoint/CLI operation, UI control, and regression test.
- Every mutation path uses the same version-aware status API and preserves a
  future or otherwise unsafe current file.
- Browser launch, retention, autosave, recovery, delivery, closure, and adapter
  settings have explicit effect owners and precedence rules.
- Modal keyboard behavior is tested with the question-flow key handler active,
  not only with isolated source snippets.
- Import preview/apply, reset, export, and doctor have stable wire/terminal
  contracts and concurrency semantics.
- Browser assertions distinguish structural source checks from behavior that is
  proven only by manual or browser-level verification.

## Verification performed

- Passed focused baseline: `node --test test/settings-schema.test.js
  test/settings.test.js test/settings-panel.test.js test/server.test.js
  test/cli.test.js` — 141 passed, 0 failed.
- Confirmed the current repository has no dedicated settings fixture directory;
  settings version cases are currently inline in `test/settings.test.js`.
- Confirmed the worktree's pre-existing `.planning/config.json` modification
  and untracked `.planning/MILESTONES.md` are unrelated and must not be
  included in the review commit.

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Codex cross-AI plan reviewer_
_Cycle: 1_
