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

All 77 focused tests passed. The deterministic suites cover injected write,
sync, close, rename, lock, and directory-creation failure seams; temporary
artifacts; individual corrupt-sibling quarantine; restart reload; exact
selection; immutable result replay; duplicate acknowledgement; and retention
expiry. The observed store-directory mode was `700`; the snapshot-file mode was
`600`.

## Boundaries

Linux and Windows were not available and were not tested. No power-loss test,
directory fsync claim, or remote-filesystem durability claim is made here.
Claude host acceptance was unavailable in this Codex-only workspace; the
evidence is filesystem/API automation, not a live Claude-host result.
