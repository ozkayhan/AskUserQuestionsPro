---
status: awaiting_human_verify
trigger: "Another project using AskUserQuestionsPro could not display a requested ten-question AskPro round in the web panel. The initial round stayed pending; retries received round_in_progress and exact-ID resume changed it to reconnecting without making the panel visible."
created: 2026-08-10T11:10:08+03:00
updated: 2026-08-10T11:10:08+03:00
goal: find_and_fix
---

# Debug Session: Panel Not Visible for Pending Round

## Symptoms

- Expected: A ten-question MCP/AskPro request opens the local web panel and remains available until the user completes it.
- Actual: The user never sees the panel. The original one-question round was later shown as `drafting`; a second ask was rejected with `round_in_progress`; exact-ID resume changed the record to `reconnecting` but still did not surface a visible panel.
- Error messages: `askuserquestionspro failed: round_in_progress: another browser question round is already pending. Call list_recoverable_rounds to inspect redacted round metadata. Resume only a detached or reconnecting round with its exact roundId; a drafting round is still attached to its original ask call.`
- Timeline: Reported on 2026-08-10 in a separate project, after the recovery-discovery release was already present in this source workspace.
- Reproduction: Invoke AskPro/MCP `ask`; observe no browser panel; invoke another ask; list recovery metadata; resume the exact detached or reconnecting round.

## Current Focus

reasoning_checkpoint:
  hypothesis: "MCP resume leaves a recoverable round invisible because handleResume starts resumeBridge, which transitions the round to reconnecting, but never invokes the shared openBrowser handoff that initially displays the local UI."
  confirming_evidence:
    - "handleAsk imports and calls openBrowser after starting its ask waiter (mcp-server/askuserquestionspro-mcp.mjs:263, 302-331); handleResume imports no openBrowser and awaits resumeBridge directly (lines 404-432)."
    - "The focused regression test fails against the current handler with 'resume must use the shared browser-opening boundary.'"
    - "The bridge publishes reconnecting rounds and a fresh UI tab renders their SSE snapshot (server/bridge.js:333-349; web/live.js:86-142; web/app.js:145-162)."
  falsification_test: "If handleResume already invoked openBrowser before awaiting the resume result, the new regression would pass; it fails and prints the complete handler with no opener call."
  fix_rationale: "Starting the resume request and then calling the existing openBrowser function restores the missing host-to-browser handoff while retaining its configured manual/disabled strategy and leaving bridge lifecycle semantics unchanged."
  blind_spots: "The reporter's first ask could separately be suppressed by an explicit manual browser strategy or ASKUSER_OPEN_BROWSER=0; this fix specifically proves and repairs the deterministic resume-path omission."
  candidate_causes:
    - "code: handleResume omitted the existing openBrowser side effect after initiating resumeBridge."
    - "config: a deliberate browser.strategy=manual or ASKUSER_OPEN_BROWSER=0 suppresses all automatic opening, including the repaired path."
    - "environment: a platform opener may fail asynchronously, but that cannot explain why handleResume currently makes no opener attempt at all."
    - "data: an invalid/stale recovery selector may reject the waiter, but the reported exact selector reaches reconnecting and therefore is valid."
  and_gate: "no — the missing code-level handoff alone fully explains why a valid resumed round becomes reconnecting without a newly visible panel; browser configuration may explain a separate initial-opening report but is not required for this recovery failure."
hypothesis: Confirmed missing browser handoff in MCP resume; temporary reversion proved the test depends on precisely that handoff.
test: Automated checks are complete; a human must invoke exact-ID MCP resume in the affected host and confirm that the local browser panel appears with the retained questions.
expecting: Resume opens/focuses the configured local UI and the preserved round is visible and answerable without creating another ask round.
next_action: Await end-to-end human verification in the affected Codex/AskPro workflow.

## Evidence

- timestamp: 2026-08-10T11:20:00+03:00
  checked: Knowledge-base lookup and project debug records
  found: No `.planning/debug/knowledge-base.md` exists and no semantic-recall provider is configured.
  implication: No prior resolution is being assumed as a diagnosis.

- timestamp: 2026-08-10T11:21:00+03:00
  checked: `mcp-server/askuserquestionspro-mcp.mjs` `handleAsk` and `handleResume`
  found: `handleAsk` imports `openBrowser`, starts `askBridge`, waits for registration, then calls `openBrowser()` at lines 263 and 321-331. `handleResume` imports only `ensureServer` and `resumeBridge` and waits on `resumeBridge` at lines 404-432; it contains no browser-opening call.
  implication: A resumed round can transition without any process attempting to display the localhost UI.

- timestamp: 2026-08-10T11:22:00+03:00
  checked: `server/bridge.js` recovery transition and `web/live.js` UI subscription
  found: `Bridge.waitForAnswers` transitions a detached round to `reconnecting` at lines 333-349. A browser tab opens an EventSource to `/events` and accepts the active snapshot at `web/live.js` lines 86-142; `web/app.js` renders questions whenever that snapshot has questions at lines 145-162.
  implication: The bridge and UI already support rendering a resumed round; the absent handoff is before the browser boundary, not in reconnecting state rendering.

- timestamp: 2026-08-10T11:23:00+03:00
  checked: Existing focused test suites via `npm test -- --test-name-pattern='MCP resume|MCP stdin EOF|browser recovery|waitForPending|resumeBridge'`
  found: 533 tests passed, 1 skipped. The MCP resume tests force `ASKUSER_OPEN_BROWSER=0`, so they exercise lifecycle/answer delivery but cannot detect a missing browser-open call.
  implication: The existing test gate does not cover the reported visibility contract; this is the missing regression guard.

- timestamp: 2026-08-10T11:24:00+03:00
  checked: `git show 4cda456` recovery-discovery release change
  found: The release added discovery and recovery guidance but did not alter `handleResume` to invoke the existing browser opener.
  implication: The regression was introduced/left exposed by a code-path asymmetry, not a new browser API or port configuration.

- timestamp: 2026-08-10T11:25:00+03:00
  checked: Agent-authored regression `mcp-server: resume starts the configured local UI handoff`
  found: It fails red before any production change: `handleResume` has no `openBrowser` import or invocation.
  implication: The symptom has a deterministic minimal reproduction and the proposed fix is directly falsifiable.

- timestamp: 2026-08-10T11:26:00+03:00
  checked: Focused regression and adjacent MCP recovery suites after the fix
  found: The new test passed; `node --test test/mcp-long-round.test.js test/mcp-server.test.js` passed 10/10 tests, including detached and exact-ID resume.
  implication: The fix preserves recovery lifecycle and answer delivery while adding the missing UI handoff.

- timestamp: 2026-08-10T11:27:00+03:00
  checked: Revert-and-reconfirm, temporary handler-hunk reversion
  found: The focused regression returned red with `resume must use the shared browser-opening boundary` after removing only the `openBrowser` import/call.
  implication: The correction is causal rather than correlated; reapplication is required before further verification.

- timestamp: 2026-08-10T11:28:00+03:00
  checked: Post-reapplication verification
  found: The focused regression passed; `npm test` passed 534 tests with 0 failures (1 pre-existing skip); `npm run lint`, `npm run format:check`, and `git diff --check` all passed.
  implication: The minimal fix is compatible with existing repository behavior and style gates.

## Eliminated

None yet.

## Resolution

- root_cause: MCP resume starts the bridge recovery waiter but omits the browser-opening handoff, leaving the localhost UI undisplayed while the round is correctly marked `reconnecting`.
- oracle_type: specified — a resumed browser round must reopen the local UI so the user can continue it.
- fix: `handleResume` now imports `openBrowser`, starts `resumeBridge`, calls the existing configured browser opener, and then awaits the same resume promise.
- verification:
    target_test:
      result: pass
      test: test/mcp-server.test.js — mcp-server: resume starts the configured local UI handoff
    mutation_check:
      result: skipped
      reason_if_skipped: No Stryker dependency or configuration is present in package metadata or repository configuration.
      mutant_killed: not_applicable
    no_op_deletion:
      result: pass
      deletion_justified_by_rca: false
      evidence: The production diff adds the missing import, opener call, and explanatory comment; it does not remove or short-circuit behavior.
    adjacent_tests:
      result: pass
      suites_run:
        - node --test test/mcp-long-round.test.js test/mcp-server.test.js
        - npm test
        - npm run lint
        - npm run format:check
    revert_and_reconfirm:
      result: pass
      bug_returned_on_revert: true
      fixed_on_reapply: true
    guardrail_verdict: accepted
- files_changed:
  - mcp-server/askuserquestionspro-mcp.mjs
  - test/mcp-server.test.js
