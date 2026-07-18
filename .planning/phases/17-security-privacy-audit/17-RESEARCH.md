# Phase 17: Security & Privacy Audit - Research

**Researched:** 2026-07-18
**Domain:** Localhost bridge security, privacy-preserving evidence, settings/package/installer boundaries, and evidence-gated host capabilities
**Confidence:** HIGH

## Summary

The repository already implements the principal security boundary as a local single-user service: `server/server.js` listens on `127.0.0.1`, the HTTP API validates question/settings shapes, and the bridge requires the current round id plus an opaque per-round capability for browser mutations and recovery result access. [VERIFIED: codebase grep] `Bridge._owns`, durable request-id/round-id selection, revision checks, and stale-state rejection are the main ownership chokepoints. [VERIFIED: codebase grep]

Privacy is enforced by design rather than by post-processing alone: lifecycle records are correlation-only, doctor output is an allowlisted projection, recoverable-round metadata exposes counts/timestamps but not question or answer content, and the evidence tests reject synthetic payloads, secrets, tokens, and local absolute paths. [VERIFIED: codebase grep] Settings import is preview/apply/CAS based and rejects future versions; the package has an explicit runtime allowlist and no production dependencies. [VERIFIED: codebase grep]

**Primary recommendation:** Plan the phase as a verification/audit wave first: preserve the existing chokepoints, run focused security/privacy/package/installer suites, add only narrowly scoped regression tests for uncovered negative paths, and keep unavailable authenticated-host/native-OS evidence explicitly unavailable.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Loopback binding, capability ownership, lifecycle redaction, settings redaction, and evidence-corpus privacy checks pass in the final checkout. | `server/server.js`, `server/bridge.js`, `lib/round-lifecycle.cjs`, `lib/settings.js`, `lib/round-store.cjs`, `test/server.test.js`, `test/bridge.test.js`, `test/round-lifecycle.test.js`, `test/settings.test.js`, `test/host-evidence-matrix.test.js`, and `test/adapter-contract.test.js` cover the required boundaries. |
| SEC-02 | Settings import, installer scope, package boundary, and host capability promotion remain fail-closed under malformed, unsupported, or unavailable evidence. | `web/settings-schema.js`, `bin/cli.js`, `lib/host-platforms.cjs`, `install.sh`, `uninstall.sh`, `package.json`, and the settings/install/package/host evidence test suites provide the implementation and gap map. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Loopback binding and HTTP boundary | API / Backend | — | `server/server.js` owns the listener, body limits, route validation, and static path boundary. [VERIFIED: codebase grep] |
| Round capability ownership and stale guards | API / Backend | Database / Storage | `server/bridge.js` owns in-memory single-flight state; `RoundStore` and record revisions preserve ownership across restart. [VERIFIED: codebase grep] |
| Lifecycle redaction | API / Backend | Host adapters | `createLifecycle` emits allowlisted correlation metadata and adapters consume it for diagnostics. [VERIFIED: codebase grep] |
| Settings validation/import/redaction | Database / Storage | API / Backend, Browser / Client | `web/settings-schema.js` validates envelopes; `lib/settings.js` persists atomically; server/CLI expose preview, apply, export, and doctor projections. [VERIFIED: codebase grep] |
| Installer/config scope | Host adapters | Database / Storage | `bin/cli.js` and shell installers mutate host-specific config/skill locations and must preserve unrelated entries. [VERIFIED: codebase grep] |
| Package/evidence promotion boundary | CDN / Static / Release | Host adapters | `package.json` controls published files; evidence ledger/tests decide whether a host can be Supported or Experimental. [VERIFIED: codebase grep] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| Node.js built-ins (`node:http`, `node:fs`, `node:crypto`, `node:test`) | `>=18` engine; local runtime reported by project as Node 22 | Local bridge, atomic persistence, opaque capabilities, tests | Existing product contract is zero production dependencies and Node 18+ compatibility. [VERIFIED: codebase grep] |
| Vendored React/ReactDOM/Babel | Vendored assets | Browser UI without a production install/build step | Existing published boundary and zero-build distribution contract. [VERIFIED: codebase grep] |

### Supporting

| Tool | Version | Purpose | When to Use |
|---|---|---|---|
| npm | lockfile v3; package scripts | Focused/full test, package dry-run, audit entry points | Use for reproducible package and dependency-boundary checks. [VERIFIED: codebase grep] |
| ShellCheck | CI/release gate | Installer shell validation | Run for `install.sh`, `uninstall.sh`, and `reinstall.sh`; native Windows remains unavailable. [VERIFIED: codebase grep] |

**Installation:** No new production package is recommended. The phase must preserve the empty `dependencies` boundary. [VERIFIED: codebase grep]

## Package Legitimacy Audit

No external package installation is recommended or required by this audit phase. Existing development packages are outside the phase’s install scope; `test/package-boundary.test.js` verifies the package root has no production dependencies and that lockfile devDependencies match `package.json`. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```text
Claude PreToolUse hook / Codex MCP stdio
                 |
                 v
       lib/bridge-client.mjs
                 |
                 v  HTTP only to http://127.0.0.1:<port>
       server/server.js routes
          |              |
          v              v
  server/bridge.js   Settings + schema
  id + capability    preview/CAS/allowlist
          |
          v
  RoundStore (0700 dirs, 0600 files)
          |
          v
  Browser SSE/fetch UI -- answer/draft/cancel only with current id+capability
```

All factual edges above are verified from the repository architecture and route/import code. [VERIFIED: codebase grep]

### Pattern 1: Capability plus expected identity

**What:** Every browser mutation carries the current numeric round id and opaque capability; durable result/recovery endpoints additionally validate the round id/request id relationship and capability. [VERIFIED: codebase grep]

**When to use:** Any operation that can mutate, resolve, cancel, resume, or acknowledge a round.

```js
if (!this._owns(this._pending, expectedId, capability)) return false;
// _owns requires the active pending record and matches id/capability when supplied.
```

Source: `server/bridge.js` and `test/bridge.test.js`. [VERIFIED: codebase grep]

### Pattern 2: Preview, validate, compare-and-swap, then apply

**What:** Settings import is inspected into a candidate envelope, tied to a baseline revision, and applied only when the preview token, exact payload, and revision still match. Future/invalid versions are not applicable. [VERIFIED: codebase grep]

**When to use:** Import, reset, browser settings writes, and any multi-step configuration operation.

Source: `server/server.js`, `lib/settings.js`, `web/settings-schema.js`, and `test/settings.test.js`. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- **Trusting loopback alone as capability authorization:** local reachability is not ownership; keep capability and stale-id checks. [VERIFIED: codebase grep]
- **Returning raw lifecycle/settings/evidence objects:** this leaks payloads, paths, commands, or arbitrary imported keys; use allowlisted projections. [VERIFIED: codebase grep]
- **Promoting from documentation-only or unavailable host evidence:** the ledger explicitly requires installed/authenticated evidence for Supported/Experimental rows. [VERIFIED: codebase grep]
- **Broad installer cleanup:** uninstall must remove only the product’s exact hook/MCP/skill/config entries and preserve unrelated host configuration. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Atomic settings writes | Direct overwrite or ad hoc temp cleanup | Existing `writeFileAtomic` and settings CAS path | Existing tests cover lock/lease, stale recovery, and original preservation. [VERIFIED: codebase grep] |
| Round ownership | New per-route authorization checks | `Bridge._owns`, `_selectDurable`, record revision checks | Central chokepoints prevent route drift and cross-round races. [VERIFIED: codebase grep] |
| Privacy filtering | Regex-only redaction at each caller | `createLifecycle`, `doctorProjection`, `RoundStore` metadata, evidence redaction helper | Allowlist projections are structurally safer and are already tested. [VERIFIED: codebase grep] |
| Host promotion | Manual status edits without evidence | `test/host-evidence-matrix.test.js` ledger gate | Prevents unsupported/unavailable rows from becoming Supported by omission. [VERIFIED: codebase grep] |

## Common Pitfalls

### Pitfall 1: Route-level stale races

**What goes wrong:** A delayed close, answer, or cancel from an old request can affect a newer active round. **Why it happens:** the host stream and browser operations are asynchronous. **How to avoid:** pass expected id and capability through every operation and retain the 409 ownership-conflict behavior. **Warning signs:** a stale `/answer` or `/cancel` resolves/terminates the current round. [VERIFIED: codebase grep]

### Pitfall 2: Privacy leaks through diagnostics or evidence

**What goes wrong:** question text, answer values, tokens, raw paths, or arbitrary imported fields appear in logs/artifacts. **How to avoid:** test allowlisted lifecycle/doctor/evidence projections and scan all published evidence roots. **Warning signs:** `question`, `answer`, `secret`, `token`, synthetic fixtures, or `/Users`/`/home` paths in corpus output. [VERIFIED: codebase grep]

### Pitfall 3: Future settings silently downgrade

**What goes wrong:** a newer settings envelope is treated as current or overwritten with defaults. **How to avoid:** `inspectEnvelope` returns `unsupported-future`, runtime mutation returns `UNSAFE_SOURCE`, and preview/apply reports non-applicability. [VERIFIED: codebase grep]

### Pitfall 4: Installer scope drift

**What goes wrong:** install/uninstall touches the other host’s config, removes a foreign hook, or deletes a broad config directory. **How to avoid:** test isolated HOME/CODEX_HOME/XDG roots, exact-entry matching, conflict-before-already behavior, and repeat removal. [VERIFIED: codebase grep]

## Runtime State Inventory

This is an audit/migration-adjacent phase, so runtime state was checked explicitly.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | Settings at `${XDG_CONFIG_HOME:-~/.config}/askuserquestionspro/settings.json`; durable round records under the same product root in `rounds/`, invalid records in `quarantine/`. [VERIFIED: codebase grep] | Audit permissions, expiry cleanup, quarantine behavior, and redacted metadata; no data migration identified. |
| Live service config | Claude user settings/MCP registration and Codex MCP registration/config are mutated by installer/CLI; authenticated live host state is not available in this workspace. [VERIFIED: codebase grep] | Verify exact scoped mutation locally; keep live-host validation as unavailable external handoff. |
| OS-registered state | Host CLI registrations and installed skills are the relevant registrations; no separate launchd/systemd/task-scheduler state was found in the inspected source/tests. [VERIFIED: codebase grep] | Keep installer lifecycle tests scoped; do not claim native OS proof. |
| Secrets/env vars | `ASKUSER_PORT`, `ASKUSER_DETACHED_ROUND_TTL_MS`, `ASKUSER_TARGET`, `CODEX_HOME`, `XDG_CONFIG_HOME`, host binary overrides, and adapter/settings flags influence scope/runtime. [VERIFIED: codebase grep] | Test isolated env roots and ensure diagnostics/evidence do not print raw values or paths. |
| Build artifacts / installed packages | npm publication is controlled by `package.json.files`; local `node_modules` is development-only and excluded from package tests. [VERIFIED: codebase grep] | Run `npm pack --dry-run --json` and dependency-boundary checks. |

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Native `node:test` via Node 18+ package engine. [VERIFIED: codebase grep] |
| Config file | `package.json` scripts; no separate test config. [VERIFIED: codebase grep] |
| Quick run command | `npm test -- --test-name-pattern='(loopback|ownership|stale|redaction|future|import|package|promotion|scope|capability|settings)'` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SEC-01 | Loopback contract and redaction wording | contract/unit | `node --test test/adapter-contract.test.js` | ✅ |
| SEC-01 | Capability, stale id, revision, durable result/ack guards | integration | `node --test test/bridge.test.js test/server.test.js test/round-store.test.js` | ✅ |
| SEC-01 | Lifecycle/evidence/host-output redaction | unit/integration | `node --test test/round-lifecycle.test.js test/fake-host-conformance.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js` | ✅ |
| SEC-02 | Future/invalid settings import, CAS, redacted doctor/export | unit/integration | `node --test test/settings.test.js test/server.test.js` | ✅ |
| SEC-02 | Installer scope and exact host configuration preservation | integration | `node --test test/install.test.js test/cli-adapters.test.js test/shell-lifecycle.test.js` | ✅ |
| SEC-02 | Published file allowlist and zero production dependencies | package gate | `node --test test/package-boundary.test.js test/release-gates.test.js` | ✅ |
| SEC-02 | Unsupported/unavailable evidence cannot promote capability | contract/evidence | `node --test test/host-evidence-matrix.test.js test/host-install-gates.test.js` | ✅ |

### Observed run

The focused security/privacy pattern run completed with 90 passing tests, 0 failures, and 1 expected Playwright skip. [VERIFIED: command run 2026-07-18] This is local evidence only; it does not establish authenticated Claude/Codex or native Windows/Linux evidence. [VERIFIED: codebase grep]

### Wave 0 Gaps

- Add/strengthen an explicit server listener assertion if the phase needs runtime proof that `server.address().address` is exactly `127.0.0.1`; the current contract test proves the source/documentation invariant, while route/integration tests exercise the local server. [VERIFIED: codebase grep]
- Add a direct negative test that settings export/doctor and lifecycle logging omit arbitrary nested unknown values, not only known secret field names, if the audit requires defense against future schema additions. [VERIFIED: codebase grep]
- Add direct package-content assertions for `install.sh`/`uninstall.sh` behavior under malicious or unexpected host config text if existing shell lifecycle tests do not cover those cases. [VERIFIED: codebase grep]
- Native Windows and authenticated Claude/Codex acceptance remain external handoff items; do not convert their absence into a local pass. [VERIFIED: codebase grep]

## Security Domain

`security_enforcement` is enabled and ASVS level is 1 in `.planning/config.json`. [VERIFIED: codebase grep]

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Limited | No remote authentication by design; local ownership uses opaque capabilities and exact selectors. [VERIFIED: codebase grep] |
| V3 Session Management | Yes | Round lifecycle, bounded retention, detach/resume, expiry, and delivery acknowledgement. [VERIFIED: codebase grep] |
| V4 Access Control | Yes | `_owns`, request/round ownership checks, CAS revisions, and fail-closed host promotion. [VERIFIED: codebase grep] |
| V5 Input Validation | Yes | Shared question validator, body size limit, JSON/type checks, settings schema, route id grammar. [VERIFIED: codebase grep] |
| V6 Cryptography | Limited | `randomBytes(32)` creates opaque capabilities and SHA-256 hashes settings bytes for revisions; no custom cryptographic protocol should be added. [VERIFIED: codebase grep] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Local process sends stale/wrong round mutation | Tampering | Require matching id, capability, request/round selector, and revision; return ownership conflict. [VERIFIED: codebase grep] |
| Malformed/future settings overwrite safe state | Tampering/Denial of service | Preview validation, unsupported-future rejection, unsafe-source refusal, atomic write and CAS. [VERIFIED: codebase grep] |
| Diagnostics/evidence expose user content or filesystem details | Information disclosure | Correlation-only lifecycle, allowlisted doctor/evidence projections, corpus scans. [VERIFIED: codebase grep] |
| Request reaches non-local listener | Information disclosure/Tampering | Bind server to `127.0.0.1`; preserve this as a release gate. [VERIFIED: codebase grep] |
| Installer removes unrelated host configuration | Tampering/Denial of service | Exact path/entry matching, conflict detection, target scoping, isolated lifecycle tests. [VERIFIED: codebase grep] |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Transient in-memory round ownership | Durable round records with opaque capability, revision, bounded recovery, and quarantine | v1.1 phases 8–11 | Restart/recovery can preserve work without exposing content through discovery metadata. [VERIFIED: codebase grep] |
| Raw diagnostics/evidence capture | Correlation-only lifecycle and redacted evidence corpus | v1.0/v1.1 hardening | Privacy checks can be automated without storing question/answer payloads. [VERIFIED: codebase grep] |
| Direct settings mutation | Versioned envelope, preview/apply, CAS, migration backup, and doctor projection | v1.1 Phase 10 | Malformed/future imports fail closed and concurrent updates do not silently overwrite. [VERIFIED: codebase grep] |

## Assumptions Log

All phase-specific factual claims above are grounded in codebase inspection or the recorded command run; no `[ASSUMED]` implementation claim is required. The remaining external-runtime limitations are stated as unavailable rather than assumed passed.

## Open Questions

1. **Does the published package preserve file permissions and installer behavior on native Windows?**
   - What we know: macOS/local tests cover package boundary and shell/isolated config paths; Windows evidence is explicitly unavailable. [VERIFIED: codebase grep]
   - What's unclear: native filesystem/host CLI semantics.
   - Recommendation: retain as external handoff; do not promote SEC-02 beyond locally testable scope.
2. **Is the current evidence redaction resilient to future nested schema fields?**
   - What we know: current lifecycle, doctor, fake-host, and corpus tests use allowlists/forbidden-pattern scans. [VERIFIED: codebase grep]
   - What's unclear: whether future fields could be introduced without a corresponding negative test.
   - Recommendation: add a direct unknown-nested-field regression if implementation changes are needed; otherwise record as a residual test gap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Tests/runtime | ✓ | Node 22 reported by project evidence; package requires `>=18` | CI Node 18/20 matrix for baseline coverage. [VERIFIED: codebase grep] |
| npm | Tests/package dry-run | ✓ | package scripts executed successfully | — |
| Playwright browser package/runtime | Optional browser evidence | Partial | One expected Playwright skip in focused run | Use existing browser CLI artifacts; native/AT lanes remain handoff. [VERIFIED: command run 2026-07-18] |
| Claude Code authenticated session | Live host evidence | ✗ | Unavailable | Fake-host/process-boundary tests; do not promote live support. [VERIFIED: codebase grep] |
| Codex authenticated session | Live host evidence | ✗ | Unavailable | Fake MCP process-boundary tests; do not promote live support. [VERIFIED: codebase grep] |
| Native Windows/Linux validation | Installer/OS evidence | ✗ in workspace | — | Existing explicit external evidence records. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- `server/server.js`, `server/bridge.js`, `lib/round-store.cjs`, `lib/round-lifecycle.cjs`, `lib/settings.js`, `web/settings-schema.js` — inspected route, ownership, persistence, redaction, and import behavior. [VERIFIED: codebase grep]
- `test/bridge.test.js`, `test/server.test.js`, `test/round-store.test.js`, `test/round-lifecycle.test.js`, `test/settings.test.js` — focused local security and privacy regression coverage. [VERIFIED: codebase grep]
- `test/adapter-contract.test.js`, `test/fake-host-conformance.test.js`, `test/host-evidence-matrix.test.js`, `test/host-install-gates.test.js`, `test/package-boundary.test.js`, `test/install.test.js`, `test/shell-lifecycle.test.js` — contract, evidence, packaging, and installer gates. [VERIFIED: codebase grep]
- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `.planning/config.json` — locked project constraints and phase scope. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- `docs/adapter-contract.md`, `docs/backend.md`, `docs/hosts.md`, `docs/timeout-runbook.md`, and `docs/evidence/*` — maintained rationale and evidence procedures cross-checked against implementation/tests. [CITED: repository-maintained documentation]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly confirmed by package metadata and stack/project docs. [VERIFIED: codebase grep]
- Architecture: HIGH — route, bridge, storage, settings, and adapter code inspected. [VERIFIED: codebase grep]
- Pitfalls: HIGH for covered paths; MEDIUM for future unknown-field and native OS gaps because those require additional or unavailable evidence. [VERIFIED: codebase grep]

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 for stable local architecture; recheck before release if package, host, or installer behavior changes.
