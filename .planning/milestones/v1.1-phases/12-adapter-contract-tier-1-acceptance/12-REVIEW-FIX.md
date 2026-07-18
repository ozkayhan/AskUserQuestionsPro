---
phase: 12-adapter-contract-tier-1-acceptance
status: complete
---

# Phase 12 review fixes

- Replaced fixture-prefix-only redaction with an explicit lifecycle-field allowlist; arbitrary question, answer, token, and unknown output fields are replaced.
- Added a real MCP JSON-RPC process-boundary initialization check and retained the executable long-round/resume/EOF integration suite as the lifecycle evidence.
- Parsed the Tier 1 Markdown matrix and require one passing local row for every host/scenario pair plus explicit unavailable live rows.
- Added isolated `auto`, `all`, `doctor`, repeated uninstall, and reinstall target validation; assertions preserve unrelated host settings and reflect optional-host semantics.
- Updated the Codex capability card to cite the exact process-boundary evidence.
