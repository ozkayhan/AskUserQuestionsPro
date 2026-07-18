---
phase: 10-settings-v2
plan: 04
type: execute
wave: 1
depends_on: [10-01, 10-02, 10-03]
files_modified:
  - lib/settings.js
  - server/server.js
  - server/bridge.js
  - lib/bridge-client.mjs
  - web/draft-writer.js
  - web/app.js
  - web/live.js
  - lib/round-lifecycle.cjs
  - hooks/askuserquestionspro-bridge.mjs
  - mcp-server/askuserquestionspro-mcp.mjs
  - bin/cli.js
  - web/settings-schema.js
  - web/settings-panel.js
  - web/styles.css
  - web/index.html
  - test/settings.test.js
  - test/server.test.js
  - test/cli.test.js
  - test/runtime-settings.test.js
  - test/bridge.test.js
  - test/bridge-client.test.js
  - test/draft-writer.test.js
  - test/round-lifecycle.test.js
  - test/mcp-server.test.js
  - test/settings-panel.test.js
  - test/views-a11y.test.js
  - test/browser-settings.test.js
  - test/frontend-settings-evidence.md
  - docs/backend.md
  - docs/frontend.md
autonomous: true
gap_closure: true
requirements: [SET-02, SET-03, SET-04, SET-05, SET-06]
must_haves:
  truths:
    - Legacy migration creates a private durable backup before replacement, reuses an existing backup idempotently, and preserves the source when backup or replacement fails; future and invalid formats remain untouched.
    - Every user-facing v2 setting is read by its named runtime consumer with user > environment > code-default precedence, and invalid/future settings cannot mutate runtime behavior.
    - Import preview is non-mutating, displays actionable validation/migration/ignored-data details, and apply revalidates payload and baseline before an atomic all-or-nothing commit with safe rollback.
    - Doctor exposes only a deterministic allowlisted redacted effective projection, while export and namespace reset remain deterministic and isolated.
    - The real browser flow proves keyboard isolation, focus trap and return, reload persistence, 320px/desktop layout, contrast/high-contrast, reduced-motion, validation, rollback, and missing-state copy through reproducible Playwright CLI evidence.
  artifacts:
    - Migration backup and failure-safety implementation with focused persistence tests.
    - Runtime settings loader/consumer wiring and precedence tests for browser, recovery, autosave, diagnostics, delivery, closure, and adapters.
    - Validated HTTP/CLI import preview/apply and dedicated redacted doctor tests.
    - Schema-driven settings panel with complete import/export/reset states, accessible live regions, focus ownership, descriptive copy, 44px controls, and committed browser evidence.
  key_links:
    - Settings.inspect/read effective revision is shared by server, CLI, browser injection, and host/runtime boundaries.
    - Backup creation precedes atomic migration replacement and any failure returns the original bytes unchanged.
    - Preview token, submitted payload, and baseline revision are validated together under the persistence lock before one atomic write.
    - Browser settings modal owns keyboard events while open and restores focus to its FAB after close; evidence commands fail when assertions or artifacts are absent.
---

<objective>
Close every verified Phase 10 settings gap in one final retry: make migrations durable and failure-safe, activate the complete v2 runtime matrix, finish safe import/doctor contracts, and deliver a fully tested accessible browser experience with reproducible Playwright CLI evidence.

Purpose: The existing schema and scaffolding do not yet make the Phase 10 goal true; this plan resolves the concrete failures identified by 10-VERIFICATION.md and 10-UI-REVIEW.md without omitting any required behavior.
Output: Production fixes, focused regression suites, deterministic browser evidence, and updated backend/frontend documentation proving SET-02 through SET-06.
</objective>

<execution_context>
@/Users/oka/.codex/gsd-core/workflows/execute-plan.md
@/Users/oka/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-settings-v2/10-CONTEXT.md
@.planning/phases/10-settings-v2/10-VERIFICATION.md
@.planning/phases/10-settings-v2/10-UI-REVIEW.md
@.planning/phases/10-settings-v2/10-01-SUMMARY.md
@.planning/phases/10-settings-v2/10-02-SUMMARY.md
@.planning/phases/10-settings-v2/10-03-SUMMARY.md
@lib/settings.js
@server/server.js
@bin/cli.js
@web/settings-panel.js
@test/frontend-settings-evidence.md
</context>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Make migration and every v2 runtime setting effective</name>
  <files>lib/settings.js, server/server.js, server/bridge.js, lib/bridge-client.mjs, web/draft-writer.js, web/app.js, web/live.js, lib/round-lifecycle.cjs, hooks/askuserquestionspro-bridge.mjs, mcp-server/askuserquestionspro-mcp.mjs, web/settings-schema.js, test/settings.test.js, test/runtime-settings.test.js, test/bridge.test.js, test/bridge-client.test.js, test/draft-writer.test.js, test/round-lifecycle.test.js, test/mcp-server.test.js</files>
  <behavior>
    - Legacy-to-v2 migration writes a mode-0600 private backup before replacing settings.json, uses a deterministic sibling backup name, does not overwrite an existing backup, and leaves original bytes and backup intact on copy, fsync, permission, or atomic replacement failure.
    - browser.strategy, recovery.retentionMs, autosave.enabled/debounceMs, diagnostics.enabled/includePaths, delivery.mode/retryMs, closure behavior, and adapters.claudeEnabled/codexEnabled are consumed at their declared boundaries; each test proves user settings override environment values and code defaults, while invalid/future status leaves the prior effective runtime unchanged.
    - Delivery acknowledgement gates closure and diagnostic output remains opaque/redacted; explicit adapter booleans do not change host-owned defaults when absent.
  </behavior>
  <action>Extend the existing settings persistence API with backup-before-replacement durability using the repository atomic-write/lock conventions; fsync the copied backup and directory where supported, use exclusive creation/collision reuse, and return a structured migration failure without replacing or deleting user bytes. Report migration.backup truthfully. Add failure-injection tests for every failure point, idempotent repeated inspection, permissions, and future/invalid preservation. Introduce one revision-aware effective-settings read at runtime boundaries. Replace environment-only/default reads with the validated namespaces: select browser opening and fallback in lib/bridge-client.mjs; pass recovery retention into Bridge/store cleanup; gate draft writer autosave; apply delivery retry and post-submit closure only after durable acknowledgement; gate redacted lifecycle diagnostics; and honor explicit Claude/Codex adapter enablement without importing executable commands or changing loopback binding. Preserve environment fallback only when a setting is absent and reject unsafe envelopes before mutation. Add focused tests for every matrix field, precedence, cache invalidation after external writes, closure ordering, diagnostics redaction, and adapter behavior.</action>
  <verify><automated>node --test test/settings.test.js test/runtime-settings.test.js test/bridge.test.js test/bridge-client.test.js test/draft-writer.test.js test/round-lifecycle.test.js test/mcp-server.test.js</automated></verify>
  <done>Migration backup and failure safety are demonstrable, all SET-03 fields have real tested consumers, precedence is deterministic, and no invalid/future settings or sensitive diagnostic data can alter runtime behavior.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Complete import validation/apply and redacted doctor evidence</name>
  <files>server/server.js, bin/cli.js, web/settings-schema.js, test/server.test.js, test/cli.test.js, docs/backend.md</files>
  <behavior>
    - Preview validates the supplied candidate and baseline without writing; its response contains actionable field/version/migration/ignored-data errors and no raw imported values.
    - Apply validates previewId, submitted payload, candidate equivalence, baseline revision, expiry/reuse/restart state, and current file revision under the write lock; invalid, future, stale, changed-baseline, or failed writes preserve current settings with no partial mutation.
    - Doctor emits status separately from a deterministic allowlisted effective projection with path redaction and no raw settings path or sensitive values; export bytes and namespace reset remain deterministic and isolated.
  </behavior>
  <action>Repair the HTTP preview/apply branch so payload.payload and payload.baselineRevision are required and revalidated against the stored preview, token consumption occurs only after all checks pass, and persistence failures retain the preview/current bytes for a safe retry or explicit failure result. Add dedicated server tests for preview no-write, field errors, future/invalid candidates, changed baseline, stale/repeated/expired/restarted previews, payload mismatch, rollback on write/backup failure, bounds, redaction, and CLI-write visibility. Add a shared dedicated doctor projection helper or exported Settings projection that allowlists non-sensitive effective namespaces, redacts/truncates path-like diagnostics, omits the absolute settings path, and behaves deterministically for missing, migrated, malformed, and future files. Route doctor through it and add isolated CLI tests for export, import-preview valid/invalid/future/stdin/I/O, reset isolation, exit codes, redacted doctor output, and byte preservation. Update backend docs with exact request/response/error/exit contracts and concurrency guarantees.</action>
  <verify><automated>node --test test/server.test.js test/cli.test.js</automated></verify>
  <done>SET-04 and SET-05 pass dedicated regression coverage: unsafe imports never mutate settings, safe imports apply atomically, and doctor cannot disclose raw paths or unallowlisted settings.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Finish settings UX states, accessibility, and reproducible browser evidence</name>
  <files>web/settings-panel.js, web/app.js, web/styles.css, web/index.html, test/settings-panel.test.js, test/views-a11y.test.js, test/browser-settings.test.js, test/frontend-settings-evidence.md, docs/frontend.md</files>
  <behavior>
    - The settings dialog has a visible close action, focus trap, first-invalid focus, async status/error live regions, Escape protection during save, keyboard shortcut isolation over an active round, and focus return to the FAB.
    - Every v2 control renders its description, current value, and Applies now/after reload effect; save success/failure, empty/missing settings, import preview valid/invalid/future, reset confirmation, export, rollback, and reload-required states use the specified actionable copy.
    - Playwright CLI runs against an isolated localhost server at 320px and desktop viewports, verifies persistence after reload, focus/keyboard behavior, contrast/high-contrast, reduced-motion, no horizontal overflow, and writes screenshots/assertion logs plus a PASS/FAIL evidence table; the test fails if the browser executable or expected artifacts are unavailable.
  </behavior>
  <action>Complete the schema-driven panel against the HTTP contracts: add all missing import/export/reset controls and validation/preview/apply/rollback/empty/future/error states, use exact user-preserving save/error language, visible current values/descriptions/effect badges, correct single-choice semantics, and role=status/alert live announcements. Implement modal focus containment and trigger return in app/panel state, modal-owned shortcut arbitration, async-safe Escape and first-invalid focus, and ensure close cannot discard an in-flight write. Apply the UI contract in styles/index: 44px minimum FAB and controls, responsive modal scrolling at 320px, declared spacing/typography roles, destructive error colors, high-contrast tokens, and reduced-motion behavior. Replace the manual-only evidence placeholder with a checked-in dependency-free Playwright CLI harness/script and fixture flow that starts an isolated server, opens the real page, drives an active round and settings modal, asserts keyboard/focus/reload/import states, emulates viewport/contrast/reduced-motion, captures artifacts, and records exact commands and observations. Keep Node 18+/zero production dependency compatibility and document the browser evidence protocol in docs/frontend.md.</action>
  <verify><automated>node --test test/settings-panel.test.js test/views-a11y.test.js test/browser-settings.test.js && node --test test/browser-settings-e2e.test.js</automated></verify>
  <done>SET-06 and every UI-review blocker are closed by runtime assertions and committed reproducible browser evidence covering interaction, persistence, visual accessibility, and all missing UX states.</done>
</task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Settings file → runtime | Untrusted/malformed or future-version disk data becomes executable configuration. |
| Import HTTP/CLI → persistence | User-provided JSON crosses into local durable state. |
| Browser UI → localhost API | Browser controls submit settings and receive effective projections. |
| Doctor/export → terminal/filesystem | Effective settings and diagnostics cross into operator-visible output. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-10-SC | Tampering | npm/pip/cargo installs | high | accept | No package installation is planned; retain the supply-chain gate as an explicit no-install disposition. |
| T-10-01 | Tampering | lib/settings.js migration | high | mitigate | Private exclusive backup, fsync, collision reuse, atomic replacement, and failure-preservation tests. |
| T-10-02 | Tampering/DoS | server.js import apply | high | mitigate | Bounds, schema validation, payload/baseline CAS, lock-held re-read, one atomic write, and rollback tests. |
| T-10-03 | Information disclosure | bin/cli.js doctor/export | high | mitigate | Dedicated allowlisted projection, path redaction/truncation, deterministic output, and CLI regression tests. |
| T-10-04 | Elevation of privilege | runtime settings consumers | critical | mitigate | Only schema-owned behavior settings are consumed; executable commands, host installation, and loopback binding remain outside the importable contract. |
| T-10-05 | Availability/data loss | browser save/closure | high | mitigate | Durable acknowledgement before closure, baseline-preserving rollback, modal busy-state guards, and browser assertions. |
</threat_model>

<source_audit>
| SOURCE | ID | Feature/Requirement | Plan | Status |
|---|---|---|---|---|
| GOAL | — | Durable, validated recovery and delivery controls across upgrades and clients | 10-04 | COVERED |
| REQ | SET-02 | Backed-up idempotent migration and future-version safety | Task 1 | COVERED |
| REQ | SET-03 | Effective browser/recovery/autosave/diagnostics/delivery/closure/adapter settings | Task 1 | COVERED |
| REQ | SET-04 | Preview, validation, partial-import prevention, rollback | Task 2 + Task 3 | COVERED |
| REQ | SET-05 | Export, namespace reset, redacted doctor | Task 2 | COVERED |
| REQ | SET-06 | Accessible keyboard behavior and persisted reload/upgrade values | Task 3 | COVERED |
| RESEARCH/VERIFICATION | — | Failure safety, precedence, CAS, redaction, cache invalidation, regression coverage | Tasks 1–2 | COVERED |
| CONTEXT | — | Node 18+, localhost-only, zero production dependencies, host compatibility, no deferred ideas | Tasks 1–3 | COVERED |
| UI REVIEW | — | Copy, visual roles, touch targets, focus/live regions, import/reset/rollback states, reproducible browser proof | Task 3 | COVERED |
</source_audit>

<verification>Run the focused commands in all tasks, then `npm test`, `npm run lint`, and `npm run format:check` with project dependencies installed. Execute the committed browser evidence command and inspect its screenshots/assertion log and evidence table. Re-run the Phase 10 verification probes and confirm all five roadmap success criteria plus SET-02 through SET-06 are verified.</verification>

<success_criteria>10-VERIFICATION.md can be regenerated with no actionable gaps, 10-UI-REVIEW.md blockers are resolved, all planned browser checks are automated and reproducible, and the final phase summary records passing persistence, runtime, HTTP, CLI, accessibility, and browser evidence.</success_criteria>

<output>Create `.planning/phases/10-settings-v2/10-04-SUMMARY.md` when done.</output>
