# Architecture Decisions

This is the maintained decision record for behavior that affects reliability,
host compatibility, and operational support. It extracts durable decisions from
the historical audit/plan material; the source documents are preserved in
[`archive/`](archive/README.md) with their original wording.

## D-001 — Local, single-user, zero-runtime-dependency architecture

The product remains a local question UI: the bridge binds to `127.0.0.1`, keeps
one in-memory round, and ships with no production npm dependencies. React,
ReactDOM, and Babel are vendored in `web/vendor/`. Question/answer payloads are
not persisted; only UI settings are written to the user config directory.

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

When a host-owned `/ask` connection carrying a `requestId` disappears without
an explicit cancellation, the bridge marks the round detached instead of
rejecting it. The browser remains authoritative for the answer; a later
`resume` call receives the answer while the bridge enforces a one-hour bounded
TTL. Explicit MCP cancellation still calls `/cancel` first and remains
terminal. Legacy requests without a `requestId` retain cancel-on-disconnect.

**Why:** the real Codex CLI 0.144.4 reproduction closes the MCP call at 300
seconds even when the registered `tool_timeout_sec` is 3600. A server-side
request timeout change cannot prevent that host boundary, but detaching the
round prevents the browser page and answer state from being destroyed. The
recovery is bounded and observable rather than an unbounded orphan.

**Evidence:** `server/bridge.js`, `server/server.js`,
`mcp-server/askuserquestionspro-mcp.mjs`, `test/mcp-long-round.test.js`, and
`docs/timeout-runbook.md`.
