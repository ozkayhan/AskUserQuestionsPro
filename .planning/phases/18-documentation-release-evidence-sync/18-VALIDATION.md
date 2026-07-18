# Phase 18 Validation Manifest

This manifest is the executable contract for DOC-01 and DOC-02. It permits maintained-document and planning-metadata edits explicitly listed by the Phase 18 plans; application source, Phase 8–13 archives, protected dirty files, and unrelated worktree content are outside scope and must remain unchanged.

## Required gates

| Label | Command/check | Expected |
|---|---|---|
| maintained-doc-integrity | `node --test test/docs-integrity.test.js` | Exit 0; maintained index and relative links resolve |
| handoff-link-scan | Relative-link scan over `docs/README.md` and `docs/evidence/v1.1.1-release-handoff.md` | Every repository-relative target exists; no absolute or remote-only substitute hides a missing local artifact |
| handoff-schema | Required local labels and PARTIAL/UNAVAILABLE owner/environment/reason/next-gate fields | PASS rows have source, command/label, date/scope; unavailable lanes never become PASS |
| redaction-scan | Scan new/changed maintained evidence for question/answer payloads, credentials/tokens, absolute home paths, opaque capabilities, and raw host stderr | No forbidden sensitive classes |
| lint | `npm run lint` | Exit 0 |
| format | `npm run format:check` | Exit 0 under the explicit maintained scope |
| diff-check | `git diff --check` | Exit 0 |
| metadata-consistency | ROADMAP/REQUIREMENTS/STATE duplicate status and current-phase scan | Prior completed phases agree; Phase 18 is current; DOC-01/DOC-02 remain pending until execution |
| archive-immutability | `git diff --exit-code 7f87a92 -- <exact twelve Phase 8–13 archive paths>` | Exit 0; all twelve paths preserved |
| protected-file-comparison | Baseline-relative diff/hash/index/status comparison for `.planning/config.json` and `.planning/ui-reviews/.gitignore` | Exact pre-existing bytes and unstaged state preserved |
| source-edit-policy | Diff classification against application source and non-listed files | Exit 0; no source edit is permitted unless a plan explicitly lists a maintained document, never as a reason to alter runtime code |

## Evidence rules

Use current Phase 14–17 verification artifacts for current counts and statuses. Link historical v1.0.0/v1.1 rationale and archived reports without rewriting or copying them. Keep authenticated Claude/Codex and native Windows/Linux rows `UNAVAILABLE` until owner-supplied evidence exists. Record actual command, status, summary, interpretation, date/snapshot, and scope for each local gate; record owner, environment, reason, and next evidence command for each external row.

## Completion record

The Phase 18 executor appends the actual command results and final changed-file classification here. Raw logs, payloads, credentials, absolute user paths, and machine-specific host stderr must not be copied into this manifest.
