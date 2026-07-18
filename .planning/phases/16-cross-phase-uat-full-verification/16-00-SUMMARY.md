---
phase: 16-cross-phase-uat-full-verification
plan: 00
subsystem: verification
tags: [uat, evidence, runner, validator]
requires: [16-VALIDATION.md]
provides: [deterministic-verification-runner, strict-evidence-validator]
affects: [16-02, release-evidence]
tech-stack:
  added: []
  patterns: [exact-label-evidence, baseline-relative-protected-file-checks]
key-files:
  created: [16-run-verification.sh, 16-validate-verification.mjs]
decisions:
  - "Use the v1.1 UAT evidence commit 7f87a92 as the immutable archive baseline because the v1.1 tag and origin/main predate the archived UAT report files in this checkout."
  - "Require all local release gates to be zero and keep unavailable external lanes explicitly bounded."
metrics:
  duration: current-session
  completed: 2026-07-18
status: complete
---

# Phase 16 Plan 00: Verification harness summary

Created the deterministic Wave 0 runner and strict report validator used by the Phase 16 UAT execution.

## Completed tasks

1. `16-run-verification.sh` captures protected-file baselines, runs all fourteen labeled gates, checks archive immutability against `7f87a92`, and invokes the validator.
2. `16-validate-verification.mjs` structurally validates every label, required fields, zero statuses, archive evidence, and both protected-file comparisons; its valid/invalid fixture self-test passes.

## Verification

- `bash -n .planning/phases/16-cross-phase-uat-full-verification/16-run-verification.sh`: PASS.
- `node --check .planning/phases/16-cross-phase-uat-full-verification/16-validate-verification.mjs`: PASS.
- Validator self-test: PASS.
- Full runner: PASS; 14 exact labels validated.
- Application source, v1.1 archives, protected dirty files, and unrelated generated artifacts were not modified.

The current branch is protected, so these artifacts were left for the parent workflow to review rather than claiming an executor commit.
