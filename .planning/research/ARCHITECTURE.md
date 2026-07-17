# Durable Resumable-Round Architecture

**Project:** AskUserQuestionsPro v1.1 Sprint 2
**Researched:** 2026-07-17
**Confidence:** MEDIUM — the local-store and MCP conclusions are grounded in primary documentation and the checked-in code. Individual host lifecycle behavior remains a per-host acceptance-test concern.

## Recommendation

Evolve the in-memory `Bridge` into a **single-flight durable round coordinator** backed by a small, versioned local file store. Keep `127.0.0.1`, raw `node:http`, vendored browser assets, and zero production dependencies. Do not add SQLite or a remote service.

The unit of durability is one immutable-identity round file, not an indefinitely open `/ask` HTTP request. A host request can detach or expire; the round and its drafts continue until an explicit terminal state or retention expiry. The host gets an idempotent, capability-appropriate way to resume or retrieve the same final answers. This is necessary because MCP cancellation can race with a completed response and base MCP does not guarantee durable result retrieval for long-running operations. [MCP cancellation](https://modelcontextprotocol.io/specification/draft/basic/patterns/cancellation), [MCP task limitation](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/seps/1686-tasks.md)

The existing one-hour detached memory state is a useful transition model, but it cannot survive a bridge restart and currently marks completion when `/answer` resolves its in-memory promise. Sprint 2 should instead make persistence and delivery separate, observable state transitions.

## Target Architecture

```text
Claude hook / MCP hosts / future host adapters
        │  adapter contract: start, attach, detach, cancel, deliver
        ▼
lib/bridge-client.mjs ─────────► server/server.js (localhost HTTP/SSE only)
                                      │
                         DurableRoundCoordinator  [MODIFIED server/bridge.js]
                           │              │
              RoundStore [NEW]       lifecycle events [MODIFIED]
                 │
          ~/.config/askuserquestionspro/rounds/<round-key>.json
                 │
Browser Round API [NEW/modified routes] ─► web draft/recovery controller [MODIFIED]
```

### Ownership and component boundaries

| Component | New / modified | Responsibility | Must not own |
|---|---|---|---|
| `lib/round-store.cjs` | **New** | Validate, recover, atomically persist, list, expire, and delete durable round snapshots. | HTTP, host-specific behavior, React state. |
| `lib/round-schema.cjs` | **New** | Versioned on-disk record validator and forward migrations. Shared only by Node; browser receives a safe API DTO. | Settings validation or question rendering. |
| `server/bridge.js` → coordinator | **Modified** | Enforce single active editable round, legal transitions, stale-id rejection, attachment leases, and immutable final-answer retrieval. Hydrate active/recoverable records at startup. | File-write mechanics. |
| `server/server.js` | **Modified** | Route validation, SSE snapshots, browser session/claim endpoints, draft and submission acknowledgement responses. Remains bound to `127.0.0.1`. | Policy decisions hidden in route handlers. |
| `lib/bridge-client.mjs` | **Modified** | Create a stable `roundKey`/idempotency key before submitting, launch selected browser, and attach/resume without treating a caller abort as round cancellation. | Persisting answers directly. |
| `lib/adapter-contract.mjs` + registry | **New** | Declare capabilities, installation evidence, timeout policy, mapping to host output, and conformance fixtures. | Coupling generic coordinator to a host SDK. |
| Claude hook and MCP server | **Modified** | Implement the contract for their distinct cancellation/output rules. | Browser state or direct disk access. |
| `web/draft-store.js`, `web/live.js`, `web/app.js` | **New / modified** | Keep an immediate browser draft cache, reconcile against server revision, expose recovery/delivery state, and only request close when safe. | Declaring delivery complete. |
| `web/settings-schema.js`, `lib/settings.js` | **Modified** | One validated versioned settings document, migrations, import/export/reset and scoped defaults. | Round records. |

### Durable record and crash consistency

Use one JSON snapshot per `roundKey` in a private config subdirectory (directory and files created with restrictive owner permissions where the platform permits it). `roundKey` is a cryptographically random UUID created before `/ask`; do not use the current monotonic `id` as the durable identity because it resets on restart. Persist question payloads and answers only because recovery requires them; lifecycle logs remain redacted and should store only correlation IDs/state/reason.

Each write increments `revision` and serializes a record such as:

```json
{
  "formatVersion": 1,
  "roundKey": "uuid",
  "bridgeGeneration": "uuid",
  "revision": 12,
  "state": "answer_saved_delivery_pending",
  "questions": [],
  "draft": { "answers": {}, "updatedAt": 0 },
  "finalAnswers": {},
  "attachments": { "host": { "adapter": "mcp", "requestId": "uuid", "leaseUntil": 0 } },
  "delivery": { "attempt": 1, "status": "pending" },
  "createdAt": 0,
  "expiresAt": 0
}
```

Use a temp file in the same directory, write, `fdatasync`/`fsync`, close, then rename to the canonical filename; on startup validate canonical and recoverable temp candidates before serving any round. Node exposes `fdatasync` for flushing file data and `rename` for the replacement step. [Node file-system API](https://nodejs.org/api/fs.html#fsfdatasyncsyncfd), [Node rename](https://nodejs.org/api/fs.html#fsrenamesyncoldpath-newpath) Extend the current `lib/atomic-write.cjs` rather than copying its lock logic, but strengthen it for round records: it currently writes then renames without a durability sync. A stale lock must be reclaimed conservatively and ownership rechecked; a corrupt or ambiguous file is quarantined and surfaced as a recovery error, never silently treated as a new blank round.

This snapshot design is preferable to an append-only journal here: only one editable round is allowed, records are small, recovery wants current state, and compaction is otherwise extra failure surface. A journal is justified only if audit-history/replay becomes a product requirement. SQLite is not justified: it changes the distribution and native/platform test burden with no advantage over a single-writer, bounded local state machine.

## Lifecycle Contract

### States and transitions

```text
created → active ↔ browser_reconnecting
                    │ draft_saved (revision++)
                    ▼
              answer_saved_delivery_pending
                    │ adapter delivery acknowledgement
                    ▼
                 delivered → retained_result → expired

active/browser_reconnecting/answer_saved_delivery_pending → cancelled | expired | recovery_error
```

| State | Durable fact | Who may transition it | Rules |
|---|---|---|---|
| `created` | Identity and validated questions exist. | coordinator | Written before browser launch or host wait. |
| `active` | Browser may edit, host is attached or detached. | browser/coordinator | Draft PUT is compare-and-swap on `roundKey + revision`; stale revisions receive 409 plus current snapshot. |
| `browser_reconnecting` | Browser session disappeared, not the round. | coordinator | Informational; a new browser session may claim the same round. Never cancel merely on SSE close. |
| `answer_saved_delivery_pending` | Final answers are immutable and synced before response. | browser/coordinator | Submit is idempotent: same answer hash returns the existing acceptance; different answers conflict. |
| `delivered` | An adapter has successfully emitted the host-facing success result for this immutable answer revision. | adapter via coordinator | This is an acknowledgement of successful local handoff, not proof that a model consumed bytes. |
| `retained_result` | Result remains retrievable during retention. | coordinator | Any retry/resume returns identical answers and delivery receipt. |
| terminal cancellation / expiry | Reason and timestamps are recorded. | explicit user/host cancel or expiry worker | Late owner close, browser close, or stale request ID cannot transition a newer round. |

**Delivery rule:** `POST /answer` first durably commits `answer_saved_delivery_pending`, then returns `{accepted, roundKey, revision}`. The host adapter obtains the immutable result and calls an internal `markDelivered(roundKey, deliveryAttempt)` only after it has successfully constructed and written its host response (MCP JSON-RPC result or Claude hook output). If its transport dies before that point, leave the round pending and let the next `resume`/`result` call receive exactly the same result. No local integration can prove a host/model processed bytes after its transport closed; the product must say “saved, delivery can be resumed,” not falsely promise end-to-end consumption.

### Timeout, attachment, and stale-owner rules

1. **The coordinator owns round retention; adapters own their call deadline.** There is no avoidable server request timeout (`server.requestTimeout = 0` already removes Node’s default), and the server never ends a round because `/ask` or `/resume` closes.
2. **Only explicit user cancellation, an explicit host cancellation capability, a validated expiry policy, or unrecoverable record corruption is terminal.** A host deadline, process exit, HTTP disconnect, browser refresh, and SSE disconnect detach an attachment.
3. **Attachments are leases, not ownership of user work.** Every attach has adapter, host request ID, and an expiry/release record. On reconnect, the same idempotency key reattaches; a different caller can only resume through the adapter’s documented recovery command. A lease expiring removes the attachment, not the round.
4. **All mutations include `roundKey`, expected `revision`, and a server-generated browser session/claim token.** This extends the present `id` stale-round guard across restarts and prevents a delayed close/cancel from targeting another record.
5. **Retention is bounded and configured.** An expiry worker runs on startup and before relevant access. It removes finished records after the result-retention period and unfinished drafts after the draft-retention period; default values should be conservative and visible in settings. Never rely only on `setTimeout`, which is lost on restart.

For stdio MCP, `notifications/cancelled` is the normal per-request cancellation signal and it can race completion; for streamable HTTP, disconnect is cancellation of that request. That confirms the adapter must make cancellation an attachment-level decision before it becomes a round-level one. [MCP cancellation semantics](https://modelcontextprotocol.io/specification/draft/basic/patterns/cancellation)

## Browser Recovery and Safe Close

1. On every meaningful answer change, debounce a draft save to the server; use `pagehide`/`visibilitychange` as best-effort flush only. Keep an immediate `sessionStorage` copy keyed by `roundKey` so a brief offline/reload interval has a local recovery source, but the server snapshot is authoritative after reconciliation.
2. Browser startup reads `roundKey` from the local bridge URL, fetches a recovery DTO, restores draft/final state, then opens SSE. If local and server revisions diverge, show an accessible recovery choice only when both contain non-identical edits; otherwise use the newer revision. Do not identify a round from “latest pending.”
3. On submit, show **“Answers saved — delivering to {host}”** until server state is `delivered`; on detachment, show **“Saved — return to the agent and use Resume”** with the recovery token/status. The tab remains useful even after final submission because delivery can be retried.
4. Autoclose is opt-in in settings and only attempted after `delivered`, a short visible confirmation delay, and a browser-opened-window capability check. `window.close()` can be blocked for tabs not opened by script, so failure is non-error: render a “Safe to close this tab” action/state. Never close on `/answer` acceptance alone.
5. Preserve the current keyboard/a11y contracts: state changes use a labelled live region, recovery/close controls remain keyboard reachable, focus moves to the recovery status rather than being stolen during edits, and no color-only lifecycle indicator is introduced.

## Versioned Settings System

Keep `web/settings-schema.js` as the declarative field catalogue, but make `lib/settings.js` the authoritative document codec:

```text
read raw JSON → check document version → migrate sequentially → validate complete document
             → write upgraded form atomically (only after successful migration)
```

Use an envelope such as `{ "formatVersion": 2, "settings": { ... } }`; do not overload the current private `_v` field or silently strip unknown future data. Define a migration table `1 → 2 → …`, pure migration functions, and a compatibility policy: malformed, future-major, or unmigratable imports are rejected with an actionable backup path; they do not reset settings. Keep a one-generation backup before a migration write.

Split settings into validated namespaces rather than a flat growth-only list:

| Namespace | Examples | Application point |
|---|---|---|
| `appearance`, `accessibility`, `questions` | existing theme and input controls | browser, live/reload metadata |
| `browser` | opener selection, open policy, auto-close/delay | bridge client/browser |
| `recovery` | draft/result retention, recovery prompt behavior | coordinator/store |
| `lifecycle` | explicit host wait policy, delivery retry display | adapters/coordinator |
| `adapters` | enabled adapters and per-adapter non-secret configuration | adapter registry |

Settings APIs need `GET /settings`, validated patch with expected document revision, `POST /settings/import` (validate/migrate before write), `GET /settings/export` (versioned), and reset-by-namespace. Secrets, host credentials, and per-round answers are explicitly excluded. Settings changes that affect an existing round must be snapshotted into that round at creation, so changing retention or auto-close does not retroactively change a user’s in-progress contract.

## Capability-Based Adapter Contract

MCP presence alone is insufficient proof of safe integration. Cline, Cursor, OpenCode, and Claude Code document MCP/tool extension surfaces, but configuration, permissions, process lifetime, and cancellation behavior differ. [Cline MCP overview](https://docs.cline.bot/mcp/mcp-overview), [Cursor MCP tooling](https://docs.cursor.com/en/agent/tools), [OpenCode tools](https://opencode.ai/docs/tools/), [Claude Code MCP configuration](https://docs.anthropic.com/en/docs/claude-code/mcp)

Define a registry descriptor and a small runtime interface:

```js
const capabilities = {
  transport: 'stdio-mcp' | 'hook' | 'plugin',
  stableCorrelationId: true,
  canExposeResumeTool: true,
  cancellationSignal: 'notification' | 'process-exit' | 'none',
  canReturnStructuredResult: true,
  supportsInstallProbe: true,
  browserLaunchPolicy: 'adapter-opens' | 'bridge-opens'
};
```

An adapter implements `install`, `doctor`, `startRound`, `detach`, `resume`, `cancel`, and `formatDelivery`. The generic coordinator accepts only normalized `Start`, `Attach`, `Detach`, `Cancel`, and `DeliverAck` commands. It knows no host CLI paths, JSON-RPC framing, or hook JSON shape.

**Support tiers:**

| Tier | Requirement | Release claim |
|---|---|---|
| Supported | Official documented install surface, stable correlation/resume path, automated contract tests, current installation probe, and manual long-round/restart/delivery acceptance. | Supported host/version range. |
| Experimental | Official extension surface and basic end-to-end manual proof, but one lifecycle capability is not yet proven. | Experimental with named limitation. |
| Unsupported | No safe documented tool/hook/plugin surface, or cannot preserve correlation/delivery semantics. | Explain exact missing evidence/capability; do not infer from protocol branding. |

Claude’s native hook remains a dedicated adapter because it has host-specific input/output behavior. Codex remains the MCP adapter. For generic stdio MCP hosts, `ask`, `resume`, `status`, and `cancel` are the minimum compatibility surface; `status/result` must return durable receipt data and `resume` must be idempotent. The MCP base protocol’s lack of durable result retrieval is precisely why these are product tools, not assumed protocol features. [MCP long-running operation rationale](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/seps/1686-tasks.md)

### Repeatable host conformance workflow

1. Capture the official documentation URL, supported version/platform, install/configuration scope, transport, tool discovery behavior, cancellation semantics, and any stated timeout. Do not accept marketing claims or third-party protocol resemblance as evidence.
2. Fill a capability descriptor and a threat review: command path quoting, config write scope, local-process permission prompts, localhost-only networking, and whether a request ID survives resume.
3. Add deterministic adapter contract tests using a fake host transport: duplicate start, cancellation-before/after delivery, host disconnect, delayed stale close, process restart, draft recovery, duplicate final submission, and result retry.
4. Run an installer/doctor probe in a disposable host configuration and preserve sanitized evidence. Validate uninstall leaves unrelated configuration untouched.
5. Run manual acceptance against the real current host: 15-question idle round beyond observed deadline, browser refresh, browser/tab closure and recovery, host restart/timeout, bridge kill/restart, delivery confirmation, requested autoclose, keyboard-only recovery, and explicit cancel.
6. Publish a versioned compatibility entry containing evidence date, host version, limitations, and regression command. Re-run it on host major updates and package release candidates.

## Build Order and Integration Points

1. **Foundation: durable contracts and store.** Add `round-schema`, `round-store`, state-machine unit tests, recovery scan, atomic-sync upgrade, and lifecycle event vocabulary. Do not change browser UX yet. This unblocks every later recovery feature.
2. **Coordinator and HTTP migration.** Replace `Bridge._pending/_completed` as the source of truth with hydrated durable records; retain the current single-flight rule. Add revisioned round/draft/result endpoints and make `/ask`, `/resume`, `/answer`, `/cancel`, `/current`, and SSE speak the new DTOs. Preserve old request IDs as compatibility aliases during this phase.
3. **Browser recovery and delivery UX.** Add draft persistence/reconciliation, recovery screen, delivery-pending status, and post-delivery safe-close behavior with accessibility regression coverage.
4. **Settings v2.** Ship the envelope, migration/backup/import-export/reset APIs, settings UI namespaces, and round-creation snapshots. This must land before exposing lifecycle/browser controls to launch users.
5. **Adapter contract extraction.** Move current Claude hook and Codex MCP policy into descriptors/adapters without behavior change; add fake-host contract harness and manual acceptance checklist.
6. **Host expansion and public evidence.** Add only candidates that pass the workflow, one adapter at a time. Update compatibility matrix, troubleshooting, installer/doctor, release checks, and unsupported explanations.

This order preserves the most valuable invariant first: final answers and drafts survive the boundaries no adapter controls. It avoids a misleading breadth phase built on a transient bridge and makes browser/autoclose behavior depend on real delivery state rather than timing guesses.

## Scalability and risk boundaries

| Concern | 100 users / one machine | 10K package users | Architectural response |
|---|---|---|---|
| Concurrent rounds | One local user, one editable round. | Same per installation. | Keep single-flight; return a clear conflict/recovery action instead of inventing multi-user locking. |
| Disk growth | A few small records. | Varied abandoned installs. | Bounded expiry plus startup cleanup; no database daemon. |
| Crash recovery | Temp/canonical candidate recovery. | Many OS/filesystem variants. | Node 18+ matrix tests; quarantine malformed records and document recovery. |
| Host churn | Claude/Codex primary paths. | Fast-moving IDE/agent surfaces. | Capability registry and evidence-gated compatibility release process. |

## Sources and confidence

- **MEDIUM:** [Node.js file-system API](https://nodejs.org/api/fs.html) via Context7 official-doc retrieval. It supports the zero-dependency sync/rename building blocks; filesystem durability details still need macOS/Linux/Windows crash-test coverage.
- **MEDIUM:** [Model Context Protocol cancellation](https://modelcontextprotocol.io/specification/draft/basic/patterns/cancellation) and [long-running tasks rationale](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/seps/1686-tasks.md), via Context7 official specification retrieval.
- **MEDIUM:** Official host extension docs: [Anthropic Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp), [OpenAI developer-mode MCP boundaries](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt), [Cline MCP](https://docs.cline.bot/mcp/mcp-overview), [Cursor tools](https://docs.cursor.com/en/agent/tools), and [OpenCode tools](https://opencode.ai/docs/tools/). They establish integration surfaces, not delivery guarantees; each host needs the conformance run above.

## Open research flags

- **Phase 1:** Test the strengthened atomic-write protocol on all supported filesystems and decide whether directory `fsync` is viable/required per platform. The docs evidence is MEDIUM, not a crash-test substitute.
- **Phase 2:** Specify legacy `/resume` behavior when the old caller has no durable `roundKey`; never choose an arbitrary latest round for a new public contract.
- **Phase 5–6:** Research each candidate host separately against a current installed version. In particular, verify whether it preserves a stable correlation token and permits a follow-up `resume/result` call after a tool deadline.
- **Security review:** Reconfirm that recovery URLs/tokens are not exposed beyond loopback, logs, screenshots, browser history beyond local use, or other local-user boundaries. The project must retain its unauthenticated localhost-only threat model.
