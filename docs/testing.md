# Testing

## Runner

Native `node:test`. No frameworks, no config.

```bash
npm test        # node --test (whole suite)
node --test test/bridge.test.js   # one file
```

CI runs `npm ci && npm test` on Node 18, 20, 22
(`.github/workflows/ci.yml`).

The maintained quality scope is defined by `package.json`: ESLint owns the
repository lint command, while Prettier checks the explicit maintained roots
listed by `format:check`. That scope includes application source and maintained
docs, and intentionally excludes vendor, generated, ignored, and historical
archive material. Do not use `prettier --write .` as a release check.

## Layout

There are 32 top-level `*.test.js` files:

`evals/askpro-skill-cases.json` contains positive and negative payload cases,
including the string-options failure that prompted the contract hardening.
`test/skill-evals.test.js` runs those cases against the shared validator and
asserts that the skill explicitly teaches the invariant and its recovery path.

| Test file                        | Covers                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `answer-map.test.js`             | Pure answer mapping and activation decisions.                                             |
| `app-state.test.js`              | Browser submit/retry/stale-round state transitions.                                       |
| `bridge-client.test.js`          | Server bootstrap, pending-round wait, browser/client behavior, and timeout typing.        |
| `bridge.test.js`                 | Single-flight submit/resolve/cancel/round identity.                                       |
| `changesets-config.test.js`      | Changesets configuration.                                                                 |
| `cli.test.js`                    | CLI help/settings/doctor plus Codex-only install/doctor/uninstall isolation.              |
| `docs-integrity.test.js`         | Canonical docs index, archive layout, and relative-link integrity.                        |
| `eslint-prettier-config.test.js` | Lint and formatting configuration invariants.                                             |
| `hook-output.test.js`            | Claude `PreToolUse` output filtering and shape.                                           |
| `host-platforms.test.js`         | Target parsing/selection, macOS bundled Codex discovery, host MCP argv, and skill paths.  |
| `install.test.js`                | Claude hook settings mutations and conflict handling.                                     |
| `live.test.js`                   | Browser SSE and answer-posting helpers.                                                   |
| `long-round.test.js`             | 15-question bridge idle-round and delayed-owner regression.                               |
| `mcp-long-round.test.js`         | Real MCP stdio process, delayed 15-question answer, and progress heartbeat lifecycle.     |
| `mcp-progress.test.js`           | Progress-token validation, monotonic values, and heartbeat cleanup.                       |
| `mcp-server.test.js`             | JSON-RPC lifecycle/version negotiation, cancellation, schema, instructions, and metadata. |
| `package-boundary.test.js`       | npm allowlist, Node engine, and package/lockfile version parity.                          |
| `question-contract.test.js`      | Shared question payload validation and result contract.                                   |
| `round-lifecycle.test.js`        | Redacted lifecycle event names, terminal reasons, and logger safety.                      |
| `server.test.js`                 | HTTP/SSE/static/settings behavior, validation fuzzing, and round-safe wire flow.          |
| `shell-lifecycle.test.js`        | Target-specific shell cleanup preserves the runtime used by the other host.               |
| `skill-evals.test.js`            | Skill guidance against valid and invalid question payload cases.                          |
| `settings-panel.test.js`         | Settings panel behavior.                                                                  |
| `settings-schema.test.js`        | Settings schema validation/coercion.                                                      |
| `settings.test.js`               | Disk read/write, atomicity, self-heal, and concurrency.                                   |
| `themes.test.js`                 | Theme registry and token application.                                                     |
| `ui-kit.test.js`                 | Shared UI primitives and type-specific Other-option behavior.                             |
| `views-a11y.test.js`             | Accessibility structure and annotations.                                                  |
| `views-a11y-recovery.test.js`    | Stable browser IDs, button semantics, and recovery annotations.                           |
| `draft-writer.test.js`           | Autosave settlement and revision acknowledgement ordering during normal navigation.       |
| `views.test.js`                  | Question and summary view rendering behavior.                                             |
| `workflows-ci.test.js`           | CI workflow guards.                                                                       |
| `workflows-release.test.js`      | Release workflow guards.                                                                  |

The multi-host additions are deliberately split: `host-platforms.test.js`
owns pure selection/discovery/command contracts, `cli.test.js` proves a Codex
target does not touch Claude state, `shell-lifecycle.test.js` protects shared
runtime ownership, and `mcp-server.test.js` proves the metadata that helps both
hosts discover and consume the tool.

## Release gate

Phase 13 evidence is fail-closed: unavailable optional tools are recorded as
environment gaps, never installed by the gate and never reported as passes.
Run the clean-checkout sequence below, then review the [cross-platform
evidence](evidence/phase-13-cross-platform.md), [host matrix](../test/host-compatibility-evidence.md),
and [candidate gates](host-research/README.md). The package retains zero
production dependencies and its existing `package.json` file allowlist.
The changeset and release workflow are checked alongside the package-boundary
tests; this sequence does not add dependencies or broaden the published scope.

Run the same local gates used by CI before shipping a release:

```bash
npm ci
npm test
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
find . -name '*.sh' -not -path './node_modules/*' -not -path './.codex/*' -not -path './.git/*' -print0 \
  | xargs -0 shellcheck --severity=warning
```

The `.codex/` directory is a gitignored Conductor/GSD workspace bundle and is
excluded from lint, formatting, and npm packaging. It must never be copied into
an installed runtime or used as a release artifact.

## Isolation helper (`test/helpers/isolation.js`)

**Contract T:** `withClean(t, fn)` snapshots the `AnswerMap` enabled-state
map and any relevant `process.env` keys, runs `fn`, and restores them in
`t.after` — even if `fn` throws. Prevents global-state leaks (`ENABLED`,
`XDG_CONFIG_HOME`, bridge singleton) from causing false-positive / ordering-
dependent test failures. Used by every stateful test that touches
`AnswerMap.setEnabled` or environment variables.

## Wire round-trip tests (`test/server.test.js`)

In addition to unit-level HTTP tests, `server.test.js` includes:

- **`validQuestions` fuzz / boundary tests** — empty string, >1000-char
  question, >500-char option label, invalid type enum, scale missing
  min/max, scale step ≤ 0, ranking < 2 options, binary ≠ 2 options, tree
  depth > 6, tree `children` non-array, tree nested label non-string / empty.
  Every case asserts HTTP 400 and a descriptive error string.
- **Contract R wire tests** — stale id → 409; `answers` not Array → 400;
  correct id resolves; concurrent `/ask` → 409 on the second.
- **Poll helpers** — `waitForPending()` and `waitForClear()` poll `/current`
  in a tight loop instead of sleeping, making the suite deterministic under CI
  load.
- **`requestTimeout = 0`** — asserted directly: `server.requestTimeout === 0`.

## Long-round timeout diagnosis

`test/long-round.test.js` keeps a 15-question `Bridge` round pending through an
idle interval, then resolves it and checks the exact answer map. It also proves
that a delayed close from an old request owner cannot cancel a newer round.
These are accelerated deterministic tests; they do not claim to reproduce a
Codex or Claude host wall-clock deadline by themselves.

For a real host reproduction, submit at least 15 questions through the Codex
MCP tool and repeat through the Claude hook. Leave the browser idle for 1, 5,
and 10 minutes while capturing stderr. Lifecycle lines use the
`[askuser:lifecycle]` prefix and contain only redacted correlation fields:
adapter, request id when available, round id, process id, elapsed time, event,
and terminal reason. The important sequence is:

`round_started → ask_received → round_registered → browser_opened →
answer_received → round_finished`

If the browser closes, look for `ask_response_closed`, `host_abort`,
`round_timeout`, `bridge_cancelled`, or `process_exit`. The first terminal event
identifies the boundary to investigate; do not infer that the one-hour app
timeout was reached merely because the host reported a timeout.

`test/mcp-long-round.test.js` exercises the actual MCP stdio entrypoint. It
passes `_meta.progressToken`, waits for multiple `notifications/progress`
messages, then posts the answer to the live localhost round. This verifies the
wire contract without opening a real browser (`ASKUSER_OPEN_BROWSER=0`). It is
not a substitute for a live Codex or Claude run: a host can ignore progress or
apply a separate wall-clock deadline.

## Notes

- The pure modules (`answer-map`, `bridge`, `install`, `hook-output`, `themes`)
  are the most thoroughly unit-tested because they have no I/O.
- `web/answer-map.js` and `web/themes.js` are written so they can be imported
  by Node tests as well as run in the browser.
- `server.test.js` isolates disk I/O by setting `XDG_CONFIG_HOME` to a tmp
  dir before requiring the server module (the settings dir is resolved at
  load time).

# Testing boundaries

Phase 12 acceptance separates deterministic local evidence from authenticated host evidence. Run `npm test`, `npm run lint`, and `npm run format:check` where available; run `bash -n install.sh uninstall.sh reinstall.sh` for shell changes.

The Tier 1 matrix is maintained in `test/tier1-acceptance-evidence.md` and checked by `node --test test/tier1-acceptance.test.js`. It covers idle, reconnect, restart-shaped recovery, cancellation, exact recovery selection, result replay, and delivery acknowledgement for Claude Code and Codex. Missing authentication or host binaries produce `Unavailable`, not a passing live row.

The dated [Phase 16 verification](../.planning/milestones/v1.1.1-phases/16-cross-phase-uat-full-verification/16-VERIFICATION.md)
records the current full-suite, focused-suite, lint, format, browser-smoke,
package, audit, Bash, and ShellCheck results. The [Phase 17 verification](../.planning/milestones/v1.1.1-phases/17-security-privacy-audit/17-VERIFICATION.md)
and [security summary](../.planning/milestones/v1.1.1-phases/17-security-privacy-audit/17-SECURITY-SUMMARY.md)
record the local security, privacy, redaction, archive, protected-file, and
fail-closed gates. These local results do not promote unavailable authenticated
host or native-OS evidence.

The shipped v1.2.0 browser-lifecycle evidence is archived in the [Phase 19
verification](../.planning/milestones/v1.2.0-phases/19-browser-lifecycle-recovery-corrections/19-VERIFICATION.md),
[UAT](../.planning/milestones/v1.2.0-phases/19-browser-lifecycle-recovery-corrections/19-UAT.md),
and [milestone audit](../.planning/milestones/v1.2.0-MILESTONE-AUDIT.md).
Five of twelve available localhost/browser checks passed; seven host, visual,
and assistive-technology lanes remain explicitly human-needed.
