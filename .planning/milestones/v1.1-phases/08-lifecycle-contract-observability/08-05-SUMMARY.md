# Plan 08-05 Summary

## Outcome

Completed the available live host acceptance for Codex and recorded the Claude limitation without making an unsupported compatibility claim.

## Codex acceptance

- Codex CLI `0.144.5`, authenticated with ChatGPT, Node `v22.23.1`, macOS `26.4.1`.
- A clean 15-question round completed normally through the local MCP server.
- A controlled host boundary test with MCP `tool_timeout_sec=3.0` timed out the original call while the browser round remained recoverable.
- A fresh Codex process issued exactly one `resume`; all 15 synthetic answers were preserved and returned successfully.
- No question or answer content is included in lifecycle diagnostics; acceptance evidence uses opaque identifiers and redacted boundary metadata.

## Claude acceptance

Claude Code is not installed or authenticated in this environment and is explicitly outside this run. No Claude support claim is made; the evidence records this as unavailable rather than inferring behavior from shared code.

## Verification

- Focused lifecycle/bridge/server/MCP/docs suite: 85 passing, 0 failing.
- Full `npm test`: 402 passing, 0 failing.
- ESLint and Prettier executables are unavailable in the environment; no dependency installation was performed.
- Detailed host evidence: `docs/evidence/phase-08-lifecycle-acceptance.md`.

