---
phase: 10-settings-v2
verified: 2026-07-17T14:30:00Z
status: gaps_found
score: 1/11 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Users can configure browser launch, bounded retention, autosave, recovery, diagnostics, delivery, post-submit closure, and adapter preferences from one validated settings contract."
    status: failed
    reason: "The schema and metadata exist, but most runtime-owned fields are not read by their named consumers; runtime behavior still uses environment variables/defaults."
    artifacts:
      - path: "web/settings-schema.js"
        issue: "Defines the matrix and owners, but does not make those values effective at runtime."
      - path: "server/server.js"
        issue: "Bridge retention is initialized from ASKUSER_DETACHED_ROUND_TTL_MS, not settings.recovery.retentionMs."
      - path: "lib/bridge-client.mjs"
        issue: "Browser opening is controlled by ASKUSER_OPEN_BROWSER; browser.strategy is not consumed."
      - path: "web/draft-writer.js"
        issue: "No autosave.enabled or autosave.debounceMs settings consumer is wired."
      - path: "lib/round-lifecycle.cjs"
        issue: "No diagnostics settings consumer is wired."
      - path: "hooks/askuserquestionspro-bridge.mjs"
        issue: "No adapters.claudeEnabled or delivery/closure settings consumer is wired."
      - path: "mcp-server/askuserquestionspro-mcp.mjs"
        issue: "No adapters.codexEnabled or delivery/closure settings consumer is wired."
    missing:
      - "Load effective settings at the relevant runtime boundaries and prove precedence over environment fallbacks."
  - truth: "Existing settings migrate once with a backup, while an unsupported future format is rejected without replacing the user's current configuration."
    status: failed
    reason: "Future/invalid mutation refusal is present, but legacy migration has no backup implementation."
    artifacts:
      - path: "lib/settings.js"
        issue: "inspect() returns migration.backup: false for legacy input; writeEnvelope() writes the replacement without copying, fsyncing, or collision-checking a backup."
      - path: "test/settings.test.js"
        issue: "Focused tests pass but do not prove the required one-time backup protocol."
    missing:
      - "Implement durable private backup-before-replacement, idempotent reuse, collision handling, and failure-preservation tests."
  - truth: "A user can preview a settings import, understand validation errors, and leave all current settings unchanged when the import cannot be applied safely."
    status: failed
    reason: "Preview exists, but apply uses the stored candidate and preview revision without validating the apply payload/baseline contract; invalid preview detail is only a boolean/status envelope and browser apply behavior is not automated."
    artifacts:
      - path: "server/server.js"
        issue: "The apply branch ignores payload.payload and payload.baselineRevision, consumes the token, and applies preview.candidate after only a revision check."
      - path: "test/frontend-settings-evidence.md"
        issue: "Active-round shortcut isolation and reload persistence are explicitly MANUAL CHECK rows."
    missing:
      - "Add focused stale/changed-baseline/invalid-apply tests and browser-level or repeatable manual evidence for rollback and validation presentation."
  - truth: "Users can export settings, reset an individual settings namespace, and inspect effective non-sensitive settings in doctor output."
    status: failed
    reason: "Export and reset routes/CLI commands exist, but doctor output still emits the settings path and Settings.read() projection directly, contrary to the required non-sensitive redacted doctor contract."
    artifacts:
      - path: "bin/cli.js"
        issue: "doctor lines 539-542 print the absolute settings path and JSON.stringify(Settings.read()); malformed files also fall back to that same raw read projection."
      - path: "test/cli.test.js"
        issue: "No settings-v2 export/reset/doctor redaction coverage is present; tests cover legacy settings list/get/set and host checks."
    missing:
      - "Route doctor through a dedicated allowlisted/redacted effective projection and add CLI regression coverage."
  - truth: "Settings controls remain keyboard-accessible and retain their persisted values after reload and upgrade."
    status: partial
    reason: "Source-level accessibility assertions and persistence seams pass, but active-round shortcut arbitration, focus behavior, viewport/contrast/reduced-motion, and reload/migration behavior remain human-only."
    artifacts:
      - path: "test/frontend-settings-evidence.md"
        issue: "The committed evidence protocol marks active-round shortcuts, reload persistence, and narrow viewport/contrast/reduced-motion as MANUAL CHECK."
    missing:
      - "Complete the documented browser/manual checks and attach observations, or add a runnable browser-level harness."
  - truth: "SET-02 is satisfied by idempotent backed-up migration and safe future-version rejection."
    status: failed
    reason: "Future-version rejection is tested, but the required backup-on-migration behavior is absent."
    artifacts:
      - path: "lib/settings.js"
        issue: "No backup creation path exists; migration status explicitly reports backup false."
    missing:
      - "Backup implementation and backup failure/idempotence tests."
  - truth: "SET-03 settings reach real browser, recovery, delivery, lifecycle, and adapter consumers."
    status: failed
    reason: "The matrix has owner labels, but owner labels are not runtime wiring. The named consumers continue using environment variables or defaults."
    artifacts:
      - path: "server/server.js"
        issue: "Retention uses ASKUSER_DETACHED_ROUND_TTL_MS at construction."
      - path: "lib/bridge-client.mjs"
        issue: "Browser launch uses ASKUSER_OPEN_BROWSER."
      - path: "web/draft-writer.js"
        issue: "No settings read for autosave."
    missing:
      - "Consumer wiring and precedence regression tests for every SET-03 field."
  - truth: "SET-04 import preview provides validation errors, prevents partial apply, and safely rolls back."
    status: partial
    reason: "HTTP preview/apply scaffolding and future gating are present, but the implementation lacks complete apply-payload validation and browser behavior proof."
    artifacts:
      - path: "server/server.js"
        issue: "Apply consumes only the stored preview candidate and does not revalidate the supplied apply payload."
      - path: "test/server.test.js"
        issue: "The observed suite output contains legacy POST /settings coverage; no dedicated settings preview/apply test names were found in the source."
    missing:
      - "Dedicated HTTP tests for preview no-write, changed baseline, reuse/expiry/restart, invalid/future apply, and rollback."
  - truth: "SET-05 export, namespace reset, and doctor expose deterministic non-sensitive effective settings."
    status: failed
    reason: "Export/reset are implemented, but doctor is not redacted and the CLI tests do not cover the v2 operations."
    artifacts:
      - path: "bin/cli.js"
        issue: "Doctor prints raw path and Settings.read() JSON."
      - path: "test/cli.test.js"
        issue: "No import-preview/export/reset/redacted-doctor regression tests."
    missing:
      - "Redacted doctor projection and command-level tests."
  - truth: "SET-06 keyboard behavior and persisted values are proven across reloads/upgrades."
    status: partial
    reason: "Static accessibility tests pass, while the required browser interaction and visual checks are explicitly manual."
    artifacts:
      - path: "test/frontend-settings-evidence.md"
        issue: "Manual rows remain unresolved."
    missing:
      - "Human browser verification and recorded results."
behavior_unverified_items:
  - truth: "Settings controls remain keyboard-accessible and retain their persisted values after reload and upgrade."
    test: "Open Settings over an active round and use Tab/Shift+Tab, Escape, Enter, arrows, number keys, B, and U; save and reload settings; inspect 320px, high-contrast, and reduced-motion states."
    expected: "Focus remains within the dialog, shortcuts do not mutate the round, focus returns to the FAB, persisted values survive reload/migration, and the UI remains usable without clipping or contrast/motion regressions."
    why_human: "Current tests are source assertions and an evidence-file presence check; no browser runtime test exercises these transitions."
human_verification:
  - test: "Run the manual rows in test/frontend-settings-evidence.md against the served localhost UI."
    expected: "Active-round shortcuts are isolated, saved values survive reload, and narrow/contrast/reduced-motion layouts remain accessible."
    why_human: "The repository has no installed browser automation dependency and the committed evidence protocol marks these cases manual."
---

# Phase 10: Settings v2 Verification Report

**Phase Goal:** Users can safely configure the recovery and delivery experience, and keep those choices intact across upgrades and supported clients.
**Verified:** 2026-07-17T14:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Users can configure all browser, recovery, autosave, diagnostics, delivery, closure, and adapter preferences from one validated contract. | ✗ FAILED | `web/settings-schema.js:392-450` defines the envelope/matrix, but `server/server.js:15-20` still constructs retention from `ASKUSER_DETACHED_ROUND_TTL_MS`, and `lib/bridge-client.mjs:99-106` still uses `ASKUSER_OPEN_BROWSER`; no consumer wiring was found for the other runtime-owned fields. |
| 2 | Legacy settings migrate once with a durable backup and future versions are preserved. | ✗ FAILED | `lib/settings.js:35` reports `migration.backup: false`; `writeEnvelope()` at lines 52-58 has no backup-before-replace path. Future refusal is present at `lib/settings.js:73-74` and passes tests, but cannot satisfy the complete truth. |
| 3 | Import preview explains validation and safely prevents unsafe/partial application. | ✗ FAILED | `server/server.js:610-634` has preview tokens and CAS, but apply ignores the submitted payload/baseline and only applies the stored candidate; browser rollback/validation presentation remains manual. |
| 4 | Export, namespace reset, and non-sensitive doctor inspection work. | ✗ FAILED | Export/reset routes exist at `server/server.js:604-627` and CLI branches at `bin/cli.js:341-362`, but doctor prints raw path/effective JSON at `bin/cli.js:536-552`, and command-level v2 tests are absent. |
| 5 | Settings controls are keyboard-accessible and persist through reload/upgrade. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Source/a11y tests pass, but `test/frontend-settings-evidence.md` marks active-round shortcuts, reload, and responsive/contrast/motion checks `MANUAL CHECK`. |

**Score:** 1/11 truths verified (1 present, behavior-unverified; future rejection is verified only as a supporting sub-behavior of the failed SET-02 truth)

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| SET-01 | 10-01 | ✓ SATISFIED | `web/settings-schema.js:392-526`; focused schema tests pass. |
| SET-02 | 10-01 | ✗ BLOCKED | Future/invalid refusal passes, but migration backup is absent (`lib/settings.js:35,52-58`). |
| SET-03 | 10-01, 10-03 | ✗ BLOCKED | Matrix exists, but runtime consumers do not read the new values. |
| SET-04 | 10-02 | ✗ BLOCKED | Preview/apply routes exist, but dedicated regression coverage and complete apply validation are not present. |
| SET-05 | 10-02 | ✗ BLOCKED | Export/reset exist; doctor emits raw path/effective JSON and CLI coverage is missing. |
| SET-06 | 10-03 | ? NEEDS HUMAN | Source assertions pass; browser interaction and visual checks remain manual. |

## Automated Verification

| Check | Result |
|---|---|
| `node --test test/settings-schema.test.js test/settings.test.js` | PASS — 65 tests, 0 failures |
| `node --test test/server.test.js test/cli.test.js` | PASS — included in focused run; no dedicated v2 CLI test names found in `test/cli.test.js` |
| `node --test test/settings-panel.test.js test/views-a11y.test.js test/browser-settings.test.js test/runtime-settings.test.js` | PASS |
| `npm test` | PASS — 449 tests, 0 failures |
| `npm run lint` | NOT RUN SUCCESSFULLY — `eslint: command not found`; dependencies were not installed |
| `npm run format:check` | NOT RUN SUCCESSFULLY — `prettier: command not found`; dependencies were not installed |
| Phase-declared/conventional probes | None found |

## Required Artifacts and Wiring

| Artifact | Status | Details |
|---|---|---|
| `web/settings-schema.js` | ✓ VERIFIED | Substantive v2 envelope, matrix, validation, legacy mapping, and future-version inspection. |
| `lib/settings.js` | ✗ STUB/PARTIAL | Status/CAS exists, but required backup migration is absent. |
| `server/server.js` | ✗ PARTIAL | HTTP operations and injection exist; retention and other runtime settings are not wired, and apply contract is incomplete. |
| `bin/cli.js` | ✗ PARTIAL | Export/import-preview/reset branches exist; doctor is not redacted and tests do not cover v2 operations. |
| `web/settings-panel.js` / `web/app.js` | ⚠️ HUMAN NEEDED | Source-level dialog and boot normalization exist; runtime keyboard/focus/persistence behavior is unproven. |

## Anti-Patterns Found

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in the inspected implementation files. The substantive failures above are missing wiring/behavior, not debt-marker matches.

## Gaps Summary

Phase 10 has a real v2 schema and passing native tests, but the roadmap goal is not achieved. The migration backup contract is not implemented, most new settings are metadata without effective runtime consumers, doctor output violates the non-sensitive projection requirement, and browser behavior remains human-only. These are blockers for the phase and should be resolved before Phase 11 proceeds.

---

_Verified: 2026-07-17T14:30:00Z_  
_Verifier: the agent (gsd-verifier)_
