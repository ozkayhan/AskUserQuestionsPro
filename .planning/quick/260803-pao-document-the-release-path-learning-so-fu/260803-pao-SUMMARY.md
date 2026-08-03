---
status: complete
---

# Summary

## Outcome

Recorded the release incident and made GitHub Actions/npm trusted publishing
the explicit repository-native path. Future agents are instructed to inspect
the release workflow before publishing, avoid local `npm publish` by default,
and route `EOTP` to the GitHub path instead of requesting an authenticator code.

## Files

- `AGENTS.md` — direct agent-facing release guardrails.
- `docs/release.md` — canonical release runbook and incident learning.
- `docs/decisions.md` — durable D-011 operational decision.
- `docs/README.md`, `docs/maintenance.md`, `docs/tech-stack.md`, `README.md` — indexed and synchronized release guidance.
- `test/release-gates.test.js` — regression assertion for the release guardrails.

## Verification

- `npm test`: 533 passed, 1 optional Playwright test skipped, 0 failed.
- `node --test test/release-gates.test.js test/workflows-release.test.js`: 21 passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed.
