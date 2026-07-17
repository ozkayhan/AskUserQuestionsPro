# Phase 9: Durable Round Store & Recovery API - Research

**Researched:** 2026-07-17  
**Domain:** Crash-safe local Node.js round persistence and explicit recovery APIs  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Persist one crash-safe record per round under the existing local configuration/runtime area, with restrictive permissions and atomic temp-write/rename semantics.
- Treat the server record as authoritative. Browser storage may mirror drafts but must never replace or contradict the server record after reconnect.
- Use explicit round IDs and request IDs for selection; never guess a “latest” round when more than one recoverable record exists.
- Make submitted answers and delivery acknowledgements immutable and idempotent. Retries must return the same result or a typed recovery error.
- Preserve legacy in-memory/HTTP request behavior by migrating an active pre-v1.1 round into the durable model at registration time.
- Quarantine corrupt records individually so one bad file cannot hide healthy recoverable rounds.

### the agent's Discretion

Not specified in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

Not specified in CONTEXT.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUR-01 | The server maintains the authoritative versioned round record on local disk. | Versioned snapshot schema, per-record directory layout, and store ownership are specified below. |
| DUR-02 | Meaningful answer edits are incrementally persisted with revisions. | Revision and compare-before-write rules make each accepted edit durable before its success response. |
| DUR-03 | Records survive restart, crash recovery, partial writes, and corruption. | Temp/sync/rename protocol, startup scan, and individual quarantine rules cover failure paths. |
| DUR-04 | Users can view and select an exact recoverable round. | Explicit list/get/recovery contracts forbid implicit latest-round selection. |
| DUR-05 | Final answers are immutable and retrieval/acknowledgement idempotent. | Finalization and acknowledgement become persisted, compare-and-set transitions returning stable results. |
| DUR-06 | Pre-v1.1 requests migrate safely. | Registration-time adapter maps the legacy in-memory payload into a durable v1 record without changing `/ask` success bodies. |
</phase_requirements>

## Summary

Phase 9 should introduce a small, synchronous, zero-dependency `RoundStore` below `server/bridge.js`, using one JSON snapshot per durable round and treating the persisted snapshot as the sole recoverable state. Existing settings already resolve their directory from `XDG_CONFIG_HOME` and use a lockfile plus temp-file rename helper; the new store should use the same location convention but a distinct `rounds/` subtree so retention and quarantine never touch settings. [VERIFIED: codebase grep]

The bridge currently holds only one `_pending` round, assigns a process-local numeric ID, stores completed answers in memory, and can select the most recent completed answer when `/resume` has no request ID. That is incompatible with restart recovery and the locked no-guessing decision. Persisted rounds therefore need a stable, opaque durable ID, an explicit request-ID lookup that rejects ambiguity, and an explicit round-ID recovery flow. [VERIFIED: codebase grep]

Node exposes explicit creation modes and `FileHandle.sync()`/`fs.fsyncSync()` to request flushing an open file descriptor. It also documents platform-dependent open-flag support; this supports a conservative temp-file → sync → close → rename design, while directory synchronization and power-loss guarantees remain an OS-validation concern rather than a claim this phase can make from a macOS workspace. [CITED: https://nodejs.org/api/fs.html]

**Primary recommendation:** Add a versioned, capability-bearing per-round snapshot store with strict `revision` transitions; write every accepted mutation before exposing success, scan/quarantine on startup, and replace implicit `/resume {}` with explicit durable round selection. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Versioned round snapshots, revisions, retention, quarantine | API / Backend | Database / Storage | The localhost Node bridge owns authoritative state and the filesystem is its persistence tier. [VERIFIED: codebase grep] |
| Restart restoration and legacy registration migration | API / Backend | Database / Storage | Only the server can reconstruct bridge state without trusting browser storage. [VERIFIED: codebase grep] |
| Exact recoverable-round listing and result/acknowledgement APIs | API / Backend | Browser / Client | The server enforces identity and idempotency; later browser work consumes the contract. [ASSUMED] |
| Draft display and user-selected recovery | Browser / Client | API / Backend | The browser presents metadata and explicitly requests the selected server record; Phase 11 owns presentation. [VERIFIED: 09-CONTEXT.md] |

## Project Constraints (from AGENTS.md)

- Keep Claude Code and Codex integrations compatible; maintain Node.js 18+ support and the zero-production-dependency distribution contract. [VERIFIED: AGENTS.md]
- Keep the unauthenticated bridge bound to `127.0.0.1`; do not expand the local single-user threat model. [VERIFIED: AGENTS.md]
- Validate at HTTP boundaries, use actionable typed errors, and preserve round-ID/capability guards against cross-round races. [VERIFIED: AGENTS.md]
- Use CommonJS conventions in this area, Node built-ins first, semicolons, single quotes, and two-space indentation. [VERIFIED: AGENTS.md]
- Add focused `test/*.test.js` coverage; run `npm test`, `npm run lint`, and `npm run format:check` before handoff. [VERIFIED: AGENTS.md]
- Release-visible behavior needs a changeset and maintained documentation; this research artifact itself is the only requested change in this task. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:fs`, `node:path`, `node:crypto` | `>=18` | Files, restrictive modes, rename, and opaque identifiers | The package declares Node.js `>=18`, has no production dependencies, and already uses Node built-ins for persistence and capabilities. [VERIFIED: package.json; codebase grep] |
| Existing `lib/atomic-write.cjs` pattern | current repository | Locking and temp-write/rename baseline | Settings already centralize this pattern; extend it deliberately rather than create a competing persistence convention. [VERIFIED: codebase grep] |
| Native `node:test` | Node runtime | Fault-injection, restart, permissions, and API regressions | This is the configured test runner with existing bridge/server isolation patterns. [VERIFIED: package.json; codebase grep] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` or existing `randomBytes()` | Node built-in | Stable opaque durable round IDs/capabilities | Generate IDs once at durable registration; never derive them from the process-local counter. `randomUUID()` uses cryptographic randomness. [CITED: https://nodejs.org/api/crypto.html] |
| `fs.open(..., mode)` and `FileHandle.sync()` | Node built-in | Restrictive new files and a requested data flush before rename | Use in the durable write primitive and close handles in `finally`. [CITED: https://nodejs.org/api/fs.html] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-round JSON snapshots | SQLite or a new database package | Stronger multi-record transactions, but violates the existing zero-production-dependency constraint without an approved distribution change. [VERIFIED: AGENTS.md; package.json] |
| Local explicit recovery API | Browser-local storage | Browser data cannot be authoritative under the locked decision and cannot recover a bridge restart independently. [VERIFIED: 09-CONTEXT.md] |

**Installation:** None. This phase must install no external package. [VERIFIED: package.json; 09-CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
Host /ask or legacy in-memory registration
                  |
                  v
        Server registration adapter
                  |
                  v
  RoundStore.create(v1 snapshot, revision 0)
                  |
                  +--> durable `rounds/<roundId>.json`
                  |         temp write -> file sync -> rename
                  |                         |
                  |                         +-- parse failure at load --> `quarantine/`
                  v
        Bridge state machine / lifecycle
            |             |             |
            | edit        | submit      | result / acknowledgement retry
            v             v             v
  RoundStore.compareAndWrite(next revision)
            |             |             |
            +----> explicit API response / typed recovery error

Server startup --> scan `rounds/` --> validate each snapshot --> hydrate recoverables
                                          \--> quarantine only invalid record; continue scan
```

### Recommended Project Structure

```text
lib/
├── atomic-write.cjs       # strengthened reusable temp/sync/rename primitive
├── round-store.cjs        # schema validation, load/list/write/quarantine/cleanup
├── round-record.cjs       # versioned persisted record + pure transition helpers
└── round-state.cjs        # existing lifecycle state machine
server/
├── bridge.js              # coordinates in-memory waiters with RoundStore commits
└── server.js              # validates explicit recovery/result/ack HTTP contracts
test/
├── round-store.test.js    # disk, crash/partial/corruption/retention tests
├── bridge.test.js         # revision and immutable transition tests
└── server.test.js         # explicit recovery API and restart behavior
```

### Pattern 1: Versioned snapshot with revisioned, monotonic transitions

**What:** Persist a complete JSON record containing `formatVersion`, `roundId`, `requestId`, `capability`, questions, draft answers, lifecycle snapshot, `revision`, timestamps, expiry metadata, final result, and acknowledgement state. Increment `revision` only for accepted material mutations; write the next snapshot before reporting success. [ASSUMED]

**When to use:** All state changes that must survive restart: registration, meaningful draft edit, detach/resume lifecycle update, final answer acceptance, delivery-uncertain mark, and delivery acknowledgement. [ASSUMED]

**Implementation rules:**

- Validate parsed records structurally and semantically before hydration; reject unsupported future `formatVersion` rather than coercing it. [ASSUMED]
- Preserve immutable fields (`roundId`, creation time, question set once registered, final answers once accepted) in the pure transition layer; a duplicate mutation either returns the identical persisted result or a typed conflict. [ASSUMED]
- Do not use `id = ++this._seq` as the durable identifier: `_seq` is process-local and restarts from zero in the current bridge. [VERIFIED: codebase grep]

### Pattern 2: Conservative durable replacement and individual quarantine

**What:** Create a private store directory; write a same-directory temp file with explicit restrictive mode, write JSON, sync and close it, then rename it to the record filename. Preserve the prior record if any pre-rename operation fails. On load, move only a malformed or schema-invalid record into a same-root `quarantine/` path with a unique suffix and record a redacted diagnostic. [ASSUMED]

**When to use:** Every snapshot write and every startup/list/recovery scan. [ASSUMED]

**Example:**

```javascript
// Source basis: Node fs open/mode/sync documentation.
// The exact helper signature remains a Phase 9 implementation choice.
const handle = fs.openSync(tempPath, 'wx', 0o600);
try {
  fs.writeFileSync(handle, serialized, 'utf8');
  fs.fsyncSync(handle);
} finally {
  fs.closeSync(handle);
}
fs.renameSync(tempPath, recordPath);
```

[CITED: https://nodejs.org/api/fs.html]

**Crash/partial-write rules:**

- Never parse or publish `*.tmp.*` files as records; clean them only after proving they are not the current named snapshot. [ASSUMED]
- A valid old target plus an interrupted temp file recovers from the old target; a malformed named record is quarantined and reported as `recovery_error` without preventing other records from listing. [ASSUMED]
- Treat `EACCES`, `EPERM`, `EROFS`, `ENOSPC`, lock contention, rename failure, sync failure, and parse/schema failure as actionable persistence/recovery errors; never silently fall back to browser-only state. [ASSUMED]
- Node documents that Windows supports only a subset of file-open flags and recursive creation of the root directory can throw `EPERM`; avoid POSIX-only flags and test the required Windows path in Phase 13. [CITED: https://nodejs.org/api/fs.html]

### Pattern 3: Explicit recovery and idempotent delivery contract

**What:** Separate discover, select, read, result, and acknowledgement operations. Every operation names a `roundId`; host-oriented retrieval may additionally name its `requestId`. Missing selectors and selectors that identify multiple recoverable records produce typed `400`/`409` responses rather than an arbitrary result. [ASSUMED]

**Recommended contract:**

| Operation | Request | Success | Required failure behavior |
|-----------|---------|---------|---------------------------|
| List recoverables | `GET /rounds` | Redacted metadata: `roundId`, state, revision, created/updated/expiry timestamps, question count, and recoverability | Never include answers, capabilities, or question text in the list. [ASSUMED] |
| Select/read one round | `GET /rounds/:roundId` | Exact record projection required by the later recovery UI | `404 round_not_found`, `409 recovery_error`, or `410 round_expired`; no latest fallback. [ASSUMED] |
| Recover by host request | `POST /resume` with both `requestId` and `roundId` when a durable round is selected | Existing `{ answers }` response shape for compatible host callers | Reject absent/ambiguous selection as `400 explicit_round_required` or `409 ambiguous_request_id`. [ASSUMED] |
| Retrieve final result | `POST /rounds/:roundId/result` with ownership material | The original immutable final answer projection | Repeated calls return byte-equivalent logical result; before finalization return typed `409 result_not_ready`. [ASSUMED] |
| Acknowledge delivery | `POST /rounds/:roundId/ack` with ownership material | `{ ok: true, acknowledgedAt, revision }` | First and repeated acknowledgement return the persisted acknowledgement, not a new transition. [ASSUMED] |

**Compatibility fence:** Keep `/ask`, `/answer`, `/cancel`, and the successful `/resume` answer envelope stable for old callers. Remove only the unsafe unqualified result selection: today `waitForAnswers()` iterates completed results to return a latest item when no request ID is supplied. [VERIFIED: codebase grep]

### Pattern 4: Registration-time legacy migration

**What:** Adapt the existing `submitQuestions(questions, requestId, lifecycle)` registration boundary so the bridge creates and persists a v1 record before it announces the round. Map the legacy in-memory numeric `id` to the durable ID for the process lifetime; persist the original request ID and a migration marker. [ASSUMED]

**When to use:** Every `/ask` path, including a caller that still uses the pre-v1.1 HTTP shape. No on-disk legacy format exists in the current code; the migration is from the active in-memory registration contract, not a bulk file conversion. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- **One global `current.json`:** A malformed global snapshot can hide every recoverable round and cannot support exact selection. [ASSUMED]
- **Read-modify-write without revision/identity checks:** Replayed browser or host requests can overwrite a newer answer or another round. [ASSUMED]
- **Delete on first successful acknowledgement:** This breaks DUR-05 because the same result/acknowledgement cannot be safely retried. [ASSUMED]
- **Directory scan chooses newest record:** It contradicts the locked explicit-selection rule and makes clock/order anomalies user-visible. [VERIFIED: 09-CONTEXT.md]
- **Logging serialized records or quarantine payloads:** Questions and answers are sensitive local content; lifecycle diagnostics must remain redacted. [VERIFIED: AGENTS.md; codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable storage engine | A new database layer/package | Versioned JSON snapshots plus the existing Node filesystem boundary | The project’s dependency and distribution contract favors a small local store for this single-user, single-flight bridge. [VERIFIED: AGENTS.md; package.json] |
| Random durable IDs | Time/counter IDs | Node cryptographic `randomUUID()` or existing `randomBytes()` | Opaque IDs avoid restart counter collisions and use Node’s cryptographic RNG. [CITED: https://nodejs.org/api/crypto.html] |
| Atomic writes | Direct `writeFileSync(recordPath, ...)` | Same-directory temp file, explicit mode, sync, close, rename, and cleanup | Direct truncating writes expose a malformed named record during interruption. [ASSUMED] |
| Cross-round authorization | “latest record” fallback | Explicit `roundId`, matching `requestId` where applicable, and existing capability checks for mutation | Existing bridge tests already protect ID/capability ownership; durable APIs must retain that invariant. [VERIFIED: codebase grep] |

**Key insight:** The useful persistence unit is a complete, versioned round snapshot, not an append-only answer log: it makes startup validation, per-record quarantine, deterministic recovery, and immutable-result replay straightforward within the dependency constraint. [ASSUMED]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No durable round store exists; settings are the only JSON persisted under `XDG_CONFIG_HOME/askuserquestionspro`. [VERIFIED: codebase grep] | Create the new `rounds/` and `quarantine/` layout; no historical durable-record migration is needed. [ASSUMED] |
| Live service config | No external service configuration was identified for rounds; the bridge is a local `node:http` server. [VERIFIED: AGENTS.md; codebase grep] | None. [VERIFIED: codebase grep] |
| OS-registered state | None found for round identifiers; current installers register host adapters, not active rounds. [VERIFIED: codebase grep] | None. [VERIFIED: codebase grep] |
| Secrets/env vars | `XDG_CONFIG_HOME` selects persistence location and `ASKUSER_DETACHED_ROUND_TTL_MS` controls the current detached TTL. [VERIFIED: codebase grep] | Preserve both compatibility inputs; document how TTL maps to durable expiry until Settings v2 owns retention. [ASSUMED] |
| Build artifacts | None found that cache round data; the package ships source and vendored browser assets. [VERIFIED: package.json; codebase grep] | None. [VERIFIED: codebase grep] |

## Common Pitfalls

### Pitfall 1: Temp rename is treated as a complete power-loss proof

**What goes wrong:** A plan claims that `rename` alone proves persistence after a machine crash, but the new file data or directory entry has not been durably flushed on every supported filesystem. [ASSUMED]

**Why it happens:** Atomic visibility and persistence across sudden power loss are distinct properties. Node documents file-descriptor sync, while cross-platform directory-flush behavior is not established by this macOS-only research. [CITED: https://nodejs.org/api/fs.html]

**How to avoid:** Sync the temp file before rename, make failure explicit, and add OS evidence to the Phase 13 cross-platform gate; do not overstate the guarantee in documentation. [ASSUMED]

**Warning signs:** Crash tests only kill the process after rename, never before it; tests assert a file exists but never reopen and validate it. [ASSUMED]

### Pitfall 2: Existing lock stale recovery is reused without ownership hardening

**What goes wrong:** Two writers can race while taking over an old `.lock`, or an over-broad cleanup removes another record’s lock/temp file. [VERIFIED: codebase grep]

**How to avoid:** Scope lock and temp names to one exact round file, preserve the current fail-fast behavior, and test concurrent writes to the same record and independent writes to different records. [ASSUMED]

### Pitfall 3: Completed delivery is deleted or rewritten

**What goes wrong:** A retry after an uncertain/closed host response cannot get the final answer, or a duplicate answer changes the final payload. [ASSUMED]

**How to avoid:** Persist final answers exactly once, retain the result through expiry, and persist the acknowledgement as an idempotent terminal fact. [ASSUMED]

### Pitfall 4: Recovery API leaks local content through discovery or logs

**What goes wrong:** Listing endpoints or error diagnostics expose question/answer text, capabilities, paths, or serialized corrupt data. [ASSUMED]

**How to avoid:** List only redacted metadata; require explicit selection for content; log opaque round IDs/error categories only. [ASSUMED]

## Code Examples

### Safe per-record load and quarantine boundary

```javascript
function loadRecord(file) {
  try {
    return validateRoundRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    quarantineRecord(file, error); // move one file; do not abort the directory scan
    return { ok: false, code: 'recovery_error' };
  }
}
```

**Source:** Repository validation and persistence conventions; the exact record validator is a Phase 9 addition. [VERIFIED: codebase grep; ASSUMED]

### Idempotent acknowledgement decision

```javascript
function acknowledge(record, now) {
  if (record.delivery.acknowledgedAt) return { ok: true, record, changed: false };
  if (!record.finalResult) return { ok: false, code: 'result_not_ready' };
  return {
    ok: true,
    changed: true,
    record: nextRevision(record, { delivery: { acknowledgedAt: now } }),
  };
}
```

**Source:** Derived implementation pattern for DUR-05. [ASSUMED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One in-memory pending round plus in-memory completed result map | Versioned per-round persisted snapshots | Phase 9 | Restart recovery and exact selection become possible. [ASSUMED] |
| `/resume` without a selector can return the latest completed result | Every recovery/result lookup names an exact durable round or a uniquely matching request ID | Phase 9 | Removes arbitrary cross-round selection. [ASSUMED] |

**Deprecated/outdated:**

- Unqualified `waitForAnswers()` recovery: it currently chooses the last completed map item when no request ID is supplied; retain only a typed explicit-selection error. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One JSON snapshot per round is sufficient without a database for this single-user phase. | Summary / Standard Stack | Could require a different storage boundary. |
| A2 | A fixed compatibility expiry derived from the existing detached TTL is acceptable until Settings v2 introduces user retention controls. | Retention / Runtime State Inventory | Product may require a different retention duration or delivered-result policy. |
| A3 | `GET /rounds`, exact round read, explicit result, and acknowledgement endpoints are the right public recovery API shape. | Architecture Patterns | Later adapter/browser phases may need a different route or capability transport. |
| A4 | File sync before rename plus fault tests is the correct cross-platform baseline; directory durability requires later OS evidence. | Crash/partial-write | A platform-specific primitive may be needed for a stronger guarantee. |
| A5 | Registration-time migration means adapting the live `/ask` in-memory contract, because no prior durable round file format exists. | Legacy migration | A hidden pre-v1.1 persistence artifact could be discovered later. |

## Open Questions

1. **What is the default retention policy for delivered, cancelled, and recovery-error records before Settings v2?**
   - What we know: The current detached TTL defaults to one hour through `ASKUSER_DETACHED_ROUND_TTL_MS`; completed results are currently removed on delivery confirmation. [VERIFIED: codebase grep]
   - What's unclear: Whether all terminal records should share that TTL, and whether quarantined copies have a distinct bounded retention period. [ASSUMED]
   - Recommendation: Use the existing detached TTL as an internal compatibility default for recoverable and delivered result replay, make expiry visible in the record, and defer user configuration to Phase 10. [ASSUMED]

2. **How should a restarted server reconnect a still-open host HTTP request?**
   - What we know: An HTTP socket cannot survive a process restart; existing `/resume` is the host recovery path. [VERIFIED: codebase grep]
   - What's unclear: Which Phase 12 adapter supplies both durable `roundId` and `requestId` after restart. [ASSUMED]
   - Recommendation: Persist both identifiers now and make `/resume` reject an absent selector; Phase 12 can add adapter-specific resume framing without revising storage. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Store, bridge, and tests | ✓ | v22.23.1 | Project baseline is Node.js >=18. [VERIFIED: local runtime; package.json] |
| npm | Test/lint/format scripts | ✓ | 10.9.8 | — [VERIFIED: local runtime] |
| macOS filesystem | Local permission and crash-path validation | ✓ | Darwin | Document as macOS-only evidence; Phase 13 must obtain Linux/Windows evidence. [VERIFIED: local runtime; 09-CONTEXT.md] |

**Missing dependencies with no fallback:**

- Linux and Windows execution environments are unavailable in this workspace; do not claim their validation from this phase. [VERIFIED: 09-CONTEXT.md]

**Missing dependencies with fallback:**

- None. [VERIFIED: local runtime]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native `node:test` under Node.js >=18. [VERIFIED: package.json] |
| Config file | none — test discovery is Node default. [VERIFIED: package.json] |
| Quick run command | `node --test test/round-store.test.js test/bridge.test.js test/server.test.js` [ASSUMED] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Verification Matrix

| Requirement | Behavior | Test Type | Automated command | Evidence / expected assertion |
|-------------|----------|-----------|-------------------|-------------------------------|
| DUR-01 | Registering a round writes a v1 record under isolated `XDG_CONFIG_HOME` with a private mode. | unit + filesystem | `node --test test/round-store.test.js` | File parses, has version/identity/revision 0, and mode is checked on macOS. [ASSUMED] |
| DUR-02 | Meaningful draft edits increment revision and survive a fresh store/bridge instance. | unit + restart | `node --test test/round-store.test.js test/bridge.test.js` | Reopen reads exact questions/answers and newest revision; no-op/replay does not create a conflicting revision. [ASSUMED] |
| DUR-03 | Temp-write failure, malformed target, stale temp, and one corrupt sibling do not hide a valid sibling. | fault injection | `node --test test/round-store.test.js` | Prior valid snapshot remains readable; corrupt file is quarantined; typed recovery error is returned. [ASSUMED] |
| DUR-04 | List/select endpoints require an exact round when multiple recoverables exist. | server integration | `node --test test/server.test.js` | `/rounds` returns redacted metadata; missing/ambiguous `/resume` is typed and never returns newest. [ASSUMED] |
| DUR-05 | Final result and acknowledgement are immutable/idempotent through restart. | bridge + server integration | `node --test test/bridge.test.js test/server.test.js` | Duplicate result/ack returns the original persisted response and revision; a changed final answer is rejected. [ASSUMED] |
| DUR-06 | Existing `/ask` payload hydrates a durable record without changing its success envelope. | server compatibility | `node --test test/server.test.js test/mcp-long-round.test.js` | Legacy request ID maps to exact durable round and can resume after a fresh bridge instance. [ASSUMED] |
| Security | Wrong ID, request ID, or capability cannot read/mutate a different round; errors/logs omit content. | negative integration | `node --test test/server.test.js` | 400/404/409 typed errors and redaction assertions. [ASSUMED] |

### Sampling Rate

- **Per task commit:** `node --test test/round-store.test.js test/bridge.test.js test/server.test.js` [ASSUMED]
- **Per wave merge:** `npm test` [VERIFIED: package.json]
- **Phase gate:** `npm test && npm run lint && npm run format:check` plus a documented macOS crash/permission exercise. [VERIFIED: AGENTS.md; 09-CONTEXT.md]

### Wave 0 Gaps

- [ ] `test/round-store.test.js` — isolated store fixture, partial write, permission, quarantine, cleanup, and retention coverage. [ASSUMED]
- [ ] Deterministic injected filesystem seam in the new store/atomic writer — avoid testing actual process crashes as the sole automated method. [ASSUMED]
- [ ] Restart harness that constructs a fresh store/bridge instance using the same temp `XDG_CONFIG_HOME`. [ASSUMED]
- [ ] API redaction/idempotency cases in `test/server.test.js`. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | The established scope is one unauthenticated, loopback-only user; do not expose the service remotely. [VERIFIED: AGENTS.md] |
| V3 Session Management | yes | Bind capability/request/round identifiers to the exact persisted record; do not mint a new authority on retry. [ASSUMED] |
| V4 Access Control | yes | Require explicit record selection and retain current ID/capability ownership guards for mutations. [VERIFIED: AGENTS.md; codebase grep] |
| V5 Input Validation | yes | Validate JSON bodies, record schemas, IDs, revision transitions, and retention inputs at HTTP/store boundaries. [VERIFIED: AGENTS.md; ASSUMED] |
| V6 Cryptography | yes | Use Node crypto-generated opaque identifiers; do not hand-roll randomness. [CITED: https://nodejs.org/api/crypto.html] |

### Known Threat Patterns for local durable storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal or filename injection through IDs | Tampering | Generate durable IDs internally; derive paths only from validated opaque IDs; never concatenate request text into paths. [ASSUMED] |
| Cross-round replay/overwrite | Tampering | Persist immutable identity and revision; verify explicit ID/request/capability before transition. [ASSUMED] |
| Corrupt or malicious local record blocks recovery | Denial of service | Per-file validation and quarantine; continue scanning healthy records. [VERIFIED: 09-CONTEXT.md] |
| Question/answer leakage in discovery/logs | Information disclosure | Redacted list projections and lifecycle/error diagnostics only. [VERIFIED: AGENTS.md; 09-CONTEXT.md] |
| Permissions weakened by umask/defaults | Information disclosure | Request `0o700` store directories and `0o600` files; test actual modes on macOS and record platform limits. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Repository `server/bridge.js`, `server/server.js`, `lib/atomic-write.cjs`, `lib/settings.js`, `lib/round-state.cjs`, and tests — current lifecycle, persistence, HTTP, and test contracts. [VERIFIED: codebase grep]
- `AGENTS.md` and `package.json` — platform, dependency, quality, safety, and distribution constraints. [VERIFIED: AGENTS.md; package.json]

### Secondary (MEDIUM confidence)

- [Node.js File system API](https://nodejs.org/api/fs.html) — file modes, `sync`, `fsync`, open flags, and platform caveats. [CITED: https://nodejs.org/api/fs.html]
- [Node.js Crypto API](https://nodejs.org/api/crypto.html) — cryptographically generated UUIDs. [CITED: https://nodejs.org/api/crypto.html]

### Tertiary (LOW confidence)

- No web-only sources used. Design choices marked `[ASSUMED]` require confirmation during planning/discussion. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — it is constrained by the package manifest, AGENTS.md, and current code. [VERIFIED: package.json; AGENTS.md; codebase grep]
- Architecture: MEDIUM — current code contracts are verified; the durable record/API shape is a phase recommendation awaiting implementation decisions. [VERIFIED: codebase grep; ASSUMED]
- Pitfalls: MEDIUM — Node fs primitives are documented, but complete crash durability and cross-platform behavior require OS-specific execution evidence. [CITED: https://nodejs.org/api/fs.html]

**Research date:** 2026-07-17  
**Valid until:** 2026-08-16 for repository findings; re-check Node documentation and supported-OS evidence before cross-platform release claims. [ASSUMED]
