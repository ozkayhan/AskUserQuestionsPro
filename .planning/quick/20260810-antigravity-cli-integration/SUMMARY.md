---
name: antigravity-cli-integration
status: complete
completed: 2026-08-10
---

# Summary

Implemented first-class Antigravity CLI integration with automatic `agy`
detection, safe global MCP JSON registration, atomic plugin/skill deployment,
doctor/uninstall support, shell installer targets, documentation, and release
changeset.

## Verification

- `npm test`: 543 tests, 542 passed, 1 skipped, 0 failed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `bash -n install.sh uninstall.sh reinstall.sh`: passed.
- ShellCheck: passed when available.
- Isolated Antigravity shell lifecycle: install → doctor → uninstall passed.
