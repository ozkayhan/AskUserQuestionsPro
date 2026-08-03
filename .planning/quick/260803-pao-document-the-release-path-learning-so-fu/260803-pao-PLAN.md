---
status: complete
---

# Quick task: document the release-path learning

## Objective

Make the repository explicitly require the existing GitHub Actions trusted-publishing path for npm releases, record why the local OTP attempt was the wrong first move, and add a regression check so the release guidance cannot silently lose this rule.

## Completed tasks

1. Added a maintained release runbook covering the canonical Changesets/OIDC path, local-publish hazards, preflight, and verification.
2. Added the release invariant to agent-facing instructions and the architecture decision record; linked it from the docs index and updated release references.
3. Added a test assertion for the durable release guardrails.
4. Ran the documentation and release checks.
