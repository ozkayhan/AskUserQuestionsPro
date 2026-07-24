# Phase 19 Nyquist Validation Manifest

This manifest is the single verification contract for Phase 19. Commands run against an isolated clean candidate checkout at one recorded SHA. The current workspace is dirty and is preserved read-only; it is never cleaned, reset, staged, or treated as release proof.

## Status rules

- `PASS`: the exact command ran and returned exit 0 with the expected result.
- `BLOCKED`: a required local gate failed, the candidate was not clean, the registry/tool was unavailable for a required local command, or the `1.1.0`/v1.1.1 metadata mismatch remains unresolved.
- `UNAVAILABLE`: an external owner/environment lane is absent. It is retained as a handoff and never promoted to local PASS or compatibility evidence.

## Wave 0 — candidate and source preservation

| ID | Exact command/action | Expected result |
|---|---|---|
| V19-01 | `git rev-parse HEAD`; `git status --short`; capture protected-path hashes before running | Candidate SHA recorded; dirty status preserved; no reset/clean/checkout/stash/stage operation occurs. |
| V19-02 | Create a temporary clone/worktree outside the repository at the recorded SHA; `git status --short` there | Isolated checkout is clean; source candidate is the recorded SHA; no user files or ignored artifacts are copied. |
| V19-03 | Compare protected/user-owned paths before and after the phase | Byte-identical and unstaged; `.playwright-cli` and unrelated Phase 16/18 artifacts remain untouched. |

## Wave 1 — combined local release gates

Run in order from the isolated candidate:

```text
node --version
npm --version
npm ci
npm test -- --test-concurrency=1 test/*.test.js
node test/browser-settings-cli-e2e.js
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
bash -n install.sh uninstall.sh reinstall.sh
shellcheck --severity=warning install.sh uninstall.sh reinstall.sh
node --test test/package-boundary.test.js test/release-gates.test.js test/workflows-ci.test.js test/workflows-release.test.js test/host-install-gates.test.js test/shell-lifecycle.test.js
node --test test/docs-integrity.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js
bash .planning/phases/17-security-privacy-audit/17-run-audit.sh
node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs
git diff --check
```

The repository also contains an executable browser CLI evidence file named
`test/browser-settings-cli-e2e.js`. It is run as its own gate so it cannot race
the unit/integration files discovered by `node --test`; the complete test
surface is still covered.

Expected: every command is labeled with timestamp, exit status, and bounded output; every required command returns 0. Audit registry/tool failure is `BLOCKED`, never PASS. Pack output proves the allowlist and zero production dependencies. Workflow tests prove the CI/release contracts.

## Wave 1 — bounded macOS installer lane (REL-02)

Run locally on macOS only, with a newly created disposable fixture:

```text
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash install.sh --target codex
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash install.sh --target claude
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash install.sh --target all
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash reinstall.sh --target codex
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash uninstall.sh --target codex
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash uninstall.sh --target claude
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash uninstall.sh --target all
node --test test/shell-lifecycle.test.js test/install.test.js test/host-install-gates.test.js
```

Expected: install, repeat install/reinstall, target-specific uninstall, full uninstall, configuration scope, keep-skill, missing-host, invalid-source, and opener failure scenarios have explicit filesystem/config assertions. Failures are nonzero/actionable and preserve prior fixture state. No real HOME/XDG path or live install directory changes. This is the complete manual macOS scope; it does not establish authenticated host, Linux, Windows, or publication evidence.

## Wave 2 — decision and external handoffs

| ID | Exact command/action | Expected result |
|---|---|---|
| V19-04 | `node --test test/host-evidence-matrix.test.js test/host-install-gates.test.js` | Evidence schema passes while authenticated Claude/Codex and native OS rows remain `UNAVAILABLE`. |
| V19-05 | Inspect `package.json`, `package-lock.json`, `.changeset`, roadmap, and maintained handoff | `1.1.0` versus v1.1.1 is explicitly recorded as a release blocker; no version/changeset/tag/publish mutation. |
| V19-06 | Validate 19-RELEASE-DECISION.md contains status, SHA, owners, environment, reason, date, next command, and all external rows | Decision is `BLOCKED` until explicit release-owner version decision and required evidence exist; unavailable lanes cannot promote READY. |

## Required evidence record

`19-RELEASE-GATES.md`, `19-INSTALLER-MATRIX.md`, and `19-RELEASE-DECISION.md` must link this manifest and retain exact command, result, timestamp, candidate SHA, scope, and blocker status. Missing, reordered, unlabeled, or silently skipped gates fail validation.
