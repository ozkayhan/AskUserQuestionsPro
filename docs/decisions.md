# Architecture Decisions

This is the maintained decision record for behavior that affects reliability,
host compatibility, and operational support. It extracts durable decisions from
the historical audit/plan material; the source documents are preserved in
[`archive/`](archive/README.md) with their original wording.

## D-001 — Local, single-user, zero-runtime-dependency architecture

The product remains a local question UI: the bridge binds to `127.0.0.1`, keeps
one active in-memory round, and ships with no production npm dependencies. React,
ReactDOM, and Babel are vendored in `web/vendor/`. Durable round question and
answer snapshots are the narrowly-scoped exception documented in D-010; UI
settings remain separately persisted in the user config directory.

**Why:** this keeps installation simple and avoids turning a local interaction
tool into an unauthenticated remote service.

**Evidence:** `package.json`, `server/server.js`, `docs/architecture.md`.

## D-002 — A round id is the ownership boundary

The bridge is single-flight. Every pending round has a monotonic id, and answer,
cancel, and disconnect paths must carry or verify that id. A stale operation is
rejected or ignored and must never resolve a later round.

**Why:** the historical audit identified cross-round answer mix-up as the most
dangerous correctness class. Adding checks at every call site is less reliable
than making ownership part of the rendezvous contract.

**Evidence:** historical Contract R in `archive/hardening-plan-v2.md`; current
`server/bridge.js`, `server/server.js`, `web/live.js`, and `test/server.test.js`.

## D-003 — Settings writes report success or failure explicitly

`Settings.write()` returns `{ ok, value, error? }`. Callers must not report a
successful save or HTTP 200 when the atomic disk write failed.

**Why:** a swallowed filesystem error creates a false-success configuration and
is difficult to diagnose after the original process exits.

**Evidence:** historical Contract W in `archive/hardening-plan-v2.md`; current
`lib/settings.js`, `bin/cli.js`, and `server/server.js`.

## D-004 — Lifecycle diagnostics are redacted and typed

Lifecycle logs contain only correlation metadata: adapter, request/round id,
process id, elapsed time, event, and normalized terminal reason. They never log
question or answer contents. Terminal categories distinguish host cancellation,
host disconnect, browser disconnect, user cancellation, application timeout,
bridge error, and completion.

**Why:** timeout ownership cannot be fixed by guessing at a constant. The first
typed terminal event must identify which boundary ended the round without making
the user’s answers part of logs.

**Evidence:** `lib/round-lifecycle.cjs`, `docs/hosts.md`, and
`docs/timeout-runbook.md`.

## D-010 — Durable per-round recovery snapshots

Each recoverable round has one authoritative versioned JSON snapshot below the
local AskUserQuestionsPro configuration area. Snapshots and temporary files are
private (0600) and store directories are private (0700). The implemented
baseline is same-directory temp-file write, file sync, close, and rename; a
corrupt named record is quarantined individually without hiding valid siblings.

Browser draft delivery keeps a non-authoritative local mirror keyed by round,
capability, and expected revision until the matching server acknowledgement; it
replays a rejected or teardown-aborted request without bypassing revision or
capability checks. Atomic writers use a directory lease: recovery removes only
a confirmed-dead owner's private lease entry, then atomically retires the empty
directory. Malformed, legacy file, live, or uncertain locks fail closed.

The initial expiry for recoverable rounds and finalized-result replay is the
resolved detached-round TTL: a valid `ASKUSER_DETACHED_ROUND_TTL_MS`, otherwise
`DEFAULT_DETACHED_TTL_MS`. Settings v2 is the sole future user-facing retention
owner. Browser storage is only a mirror and cannot replace the Node record.

When a detached round is resumed, it enters `reconnecting`. The existing expiry
callback is deliberately non-terminal in that state: it must not reject the
resumed waiter or close the browser round. This preserves long-running work,
including multi-day question rounds, until the user answers or explicitly
cancels. This decision does not change the detached-round TTL or introduce a
new retention setting.

This is macOS filesystem evidence, not Linux/Windows validation or a universal
power-loss/directory-durability guarantee.

**Evidence:** `test/round-record.test.js`, `test/round-store.test.js`,
`test/bridge.test.js` (including the reconnecting-round expiry
characterization), `test/server.test.js`, and
`docs/evidence/phase-09-durable-recovery.md`.

## D-011 — GitHub Actions is the canonical npm publisher

Package publication uses the repository's Changesets workflow and npm trusted
publishing through GitHub OIDC. The release job must retain `id-token: write`,
the npm registry configuration, and the Changesets publish command. Local npm
publication is an explicit exception, not an agent default.

**Why:** the repository already has a working OTP-free publisher. Starting
with local `npm publish` couples a release to the operator's npm session and
can produce misleading failures: local provenance has no supported CI
provider, while the non-provenance retry can require an authenticator OTP.
On 2026-08-03 this path was attempted before the workflow/history audit and
caused avoidable failure and user friction. The corrective learning is to
inspect the release workflow first and select the repository-native publisher.

**Evidence:** `.github/workflows/release.yml`, `docs/release.md`,
`test/workflows-release.test.js`, and the successful Release workflow history.

## D-005 — Host capabilities are intentionally asymmetric

Claude Code can use a `PreToolUse` hook to replace the native
`AskUserQuestion` input result. Codex hooks cannot return the user’s answer as a
native `request_user_input` result, so Codex and ChatGPT Desktop use the MCP
tool plus the `askpro` skill. Both paths share the bridge client and browser.

**Why:** pretending the hosts have identical hook semantics produces a fallback
that cannot work on Codex.

**Evidence:** `hooks/askuserquestionspro-bridge.mjs`, `mcp-server/`,
`lib/host-platforms.cjs`, and `docs/hosts.md`.

## D-006 — MCP progress is liveness, not a timeout override

When a host supplies a valid MCP progress token, the server emits redacted,
rate-limited progress notifications while the round is open and stops them in
`finally`. This keeps the JSON-RPC call observable but does not claim to defeat
a host-specific hard deadline.

**Why:** progress is an optional protocol signal. Treating it as proof of host
liveness would hide the unresolved host boundary that Phase 7 must test.

**Evidence:** `lib/mcp-progress.cjs`, `mcp-server/askuserquestionspro-mcp.mjs`,
`test/mcp-long-round.test.js`, and `docs/backend.md`.

## D-007 — Historical audit findings are evidence, not a current work queue

The old 195-finding report and generated workflow plans are preserved for
provenance, but current behavior is defined by source, tests, and the maintained
docs in this folder. Historical findings tagged “verification — not a finding”
remain rationale for deliberately unchanged behavior; they are not reopened as
bugs without new evidence.

**Evidence:** `archive/audit-report-legacy.md`,
`archive/hardening-plan-dynamic.md`, and `docs/hardening.md`.

## D-008 — Host disconnect detaches resumable MCP rounds

## D-009 — Lifecycle capability and deadline ownership

Round identity plus an opaque capability guard localhost browser mutations. This is not remote authentication: binding remains `127.0.0.1`, Node 18+, and zero production dependencies remain constraints. Avoidable idle timeouts do not cancel rounds; application, host, and transport deadline owners remain distinct.

When a host-owned `/ask` connection carrying a `requestId` disappears without
an explicit cancellation, the bridge marks the round detached instead of
rejecting it. The browser remains authoritative for the answer; a later
`resume` call receives the answer during the one-hour bounded detached period.
Once resumed, the lifecycle is `reconnecting` and remains non-terminal until
the browser answers or an explicit cancellation occurs. Explicit MCP
cancellation still calls `/cancel` first and remains terminal. Legacy requests
without a `requestId` retain cancel-on-disconnect.

**Why:** the real Codex CLI 0.144.4 reproduction closes the MCP call at 300
seconds even when the registered `tool_timeout_sec` is 3600. A server-side
request timeout change cannot prevent that host boundary, but detaching the
round prevents the browser page and answer state from being destroyed. Never-
resumed recovery is bounded and observable rather than an unbounded orphan;
an explicitly resumed round is intentionally allowed to remain open for
multi-day user work.

**Evidence:** `server/bridge.js`, `server/server.js`,
`mcp-server/askuserquestionspro-mcp.mjs`, `test/mcp-long-round.test.js`, and
`docs/timeout-runbook.md`.

## D-012 — MCP stdio transport loss is terminal for the owning process

Each MCP stdio process owns one idempotent shutdown path. Stdin EOF/close,
stdout errors/close, terminal signals, and fatal process errors abort its
active requests, stop further protocol writes, and exit within a bounded
cleanup window. A process-level error handler must not merely log and keep a
dead stdio transport alive.

**Why:** A closed host pipe previously triggered uncaught asynchronous write
errors while the entrypoint's non-terminating error handlers kept Node alive.
The result was a PPID=1 orphan that repeatedly formatted and logged errors at
high CPU. This lifecycle is per process; concurrent valid MCP clients remain
independent and are never handled by a global singleton.

**Evidence:** `mcp-server/askuserquestionspro-mcp.mjs`,
`test/mcp-lifecycle.test.js`, and `test/mcp-long-round.test.js`.
