# Phase 09 Durable Recovery Evidence

Date: 2026-07-17

This record covers the executing macOS host only. It exercises the implemented
temp-write, file-sync, close, rename baseline; it does not establish a
cross-platform or universal power-loss/directory-durability guarantee.

## Environment

- macOS: 26.4.1
- Node.js: v22.23.1 (project support baseline remains Node 18+)
- Isolated fixture: `askuser-phase09-evidence.fAaOrr`
- Opaque generated round identifier: `round_UwO9Tt_zMXGcJ4VjVtDR5xqY`

## Commands and observations

```sh
XDG_CONFIG_HOME="$EVIDENCE_XDG" node --test \
  test/round-record.test.js test/round-store.test.js \
  test/bridge.test.js test/server.test.js
stat -f '%Lp' "$EVIDENCE_XDG/askuserquestionspro/rounds"
stat -f '%Lp' "$EVIDENCE_XDG/askuserquestionspro/rounds/<opaque-round>.json"
```

The focused suites cover normal atomic write/reload behavior, deterministic
injection of open, write, file-sync, close, rename, and directory-creation
failures while preserving an existing healthy snapshot and cleaning temporary
and lock artifacts. They also cover crash-created dead-lock recovery with an
atomically retired directory lease, fail-closed live/uncertain lock ownership, and a
deterministic contender interleaving that proves a newly acquired lease remains intact,
individual corrupt-sibling quarantine, startup expiry cleanup, existing
directory permission tightening, exact selection, immutable result replay,
an aborted immediate draft request followed by reload/replay (with the local
mirror cleared only after the server revision acknowledgement), and
repeated bridge restart recovery from detached through reconnecting `/resume`.
The observed store-directory mode was `700`; the snapshot-file mode was `600`.

## Boundaries

Linux and Windows were not available and were not tested. No power-loss test,
directory fsync claim, or remote-filesystem durability claim is made here.
Claude host acceptance was unavailable in this Codex-only workspace; the
evidence is filesystem/API automation, not a live Claude-host result.
