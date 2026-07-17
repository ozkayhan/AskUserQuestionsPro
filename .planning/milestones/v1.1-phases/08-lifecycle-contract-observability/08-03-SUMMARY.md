# Plan 08-03 Summary

## Outcome

Made host deadline ownership explicit at the adapter boundary and preserved resumable behavior when a host-side call deadline detaches a round.

## Evidence

- Adapter diagnostics identify the host-owned deadline boundary and provide recovery guidance.
- Claude hook and Codex MCP paths retain their distinct response/error semantics.
- Deadline-owner and long-round regressions pass, including the existing MCP recovery behavior.

## Commit

`e8eb91f` — `feat(08-03): record adapter deadline ownership`

