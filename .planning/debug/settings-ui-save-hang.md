---
status: resolved
trigger: "Settings UI is unusable: layout shifts/collapses and is hard to read; after clicking Save settings the UI stays on saving forever."
created: 2026-07-17T18:20:00+03:00
updated: 2026-07-17T18:48:00+03:00
goal: find_and_fix
---

# Debug Session: Settings UI and Save Hang

## Symptoms

- Expected: Settings modal stays readable and stable; Save settings completes with a success or actionable error.
- Actual: Layout visibly shifts/overflows and is difficult to read. Save remains in the saving state indefinitely.
- Error messages: None reported; the visible symptom is an infinite saving state.
- Timeline: First observed immediately after installing the current local build.
- Reproduction: Open the installed local bridge at `127.0.0.1:4517`, open Settings, change any value, click Save settings.

## Current Focus

- hypothesis: The installed server and browser client disagree on the settings response contract or the save request is blocked by a server/runtime issue; the modal layout likely lacks a stable responsive constraint for the full recovery surface.
- test: Reproduce with Playwright CLI against the installed bridge, inspect the POST `/settings` request/response and modal computed geometry.
- expecting: A concrete network/runtime failure and measurable overflow/layout cause.
- next_action: Run browser reproduction, inspect console/network/server logs, then patch the smallest shared cause and add regression coverage.

## Evidence

- timestamp: 2026-07-17T18:20:00+03:00
  observation: Installed package was copied from the current workspace and doctor passed for Claude/Codex, but the user reports the live UI is unusable and Save never resolves.

## Eliminated

None yet.

## Resolution

- root_cause: The save fetch was aborted by the cleanup of the keyboard/focus effect whenever `isSaving` changed to true, leaving the intentional AbortError path with `isSaving` permanently true. The modal was also constrained to 440px despite wide segmented controls and a large recovery surface, causing cramped/shifted layout.
- fix: Moved AbortController cleanup to a mount-lifetime effect, added a regression assertion that Save settings exits saving state and reports success, and widened the modal with responsive stacked rows/actions for narrow viewports.
- verification: `node test/browser-settings-cli-e2e.js` passed; focused `npm test -- --test-name-pattern='settings|server settings'` passed (52 passed, 1 skipped because Playwright Node package is unavailable). `npm run lint` could not run because `eslint` is not installed in the workspace.
