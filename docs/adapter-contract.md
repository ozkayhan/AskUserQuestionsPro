# Adapter Contract

This document is the host-neutral lifecycle contract for the local, loopback-only bridge. Claude Code and Codex are separate adapters: they share lifecycle state, but retain different framing, fallback, timeout, and cancellation semantics.

## Invariants

- The bridge listens on `127.0.0.1` only.
- `requestId`, `roundId`, and `capability` are opaque selectors; clients must not infer or substitute them.
- Diagnostics and evidence contain lifecycle metadata only, never question or answer content.
- Results are immutable and may be replayed; acknowledgement is idempotent and safe to retry.
- Host disconnect/detach is recoverable; explicit cancellation is terminal.

## Operations

| Operation | Owner / selector | Response and idempotency |
|---|---|---|
| start | Adapter submits questions with `requestId`; bridge creates one round | One active round; duplicate request is rejected or safely replayed |
| attach | Browser/adapter uses exact `roundId` + `capability` | Exact selector required; stale capability is rejected |
| detach | Host transport closes with exact `requestId`/round identity | Marks recoverable detached state; repeated detach is harmless |
| cancel | Adapter submits exact round identity and capability | Terminal cancellation; repeated cancel is a stable terminal response |
| resume | New adapter process selects exact `requestId`/round | Reattaches only the matching detached round; stale/cross-round selection rejected |
| status | Client requests exact round/status projection | Returns redacted lifecycle metadata; does not expose payloads |
| result | Client requests exact completed round | Immutable result; repeated reads are identical |
| delivery acknowledgement | Client acknowledges exact result/round | Idempotent; retries do not change the result or close an unrelated round |

## Adapter boundaries

Claude Code's `PreToolUse` hook returns native fallback semantics on malformed input, disabled configuration, bridge failure, timeout, or cancellation; a successful round is framed as a `PreToolUse` allow response. Codex's MCP adapter frames JSON-RPC, emits progress for long rounds, detaches on stdin EOF for explicit resume, and keeps cancellation terminal.

## Evidence gate

Local node:test, fake-host, and integration evidence is distinct from authenticated host evidence. A host is not promoted to live-accepted from MCP discoverability or hook shape alone. Authenticated, version-pinned Claude Code and Codex runs remain `Unavailable`/`Researching` until executed.

## New-host onboarding

Review official documentation, install the host locally, run automated conformance, perform manual long-round verification, and record dated release evidence. Use `node --test test/fake-host-conformance.test.js` for the local gate; authenticated host procedures are maintained in `docs/hosts.md`.
