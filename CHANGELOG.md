# Changelog

All notable user-facing changes are recorded here. Commit identifiers are
intentionally omitted from the summary; the Git history remains the source for
line-by-line provenance.

## 1.4.0

### Reliability

- Long-running rounds now survive host disconnects, browser recovery, process
  restarts, and resume-waiter loss with bounded, exact-round lifecycle rules.
- Host and MCP boundaries share strict health identity, protocol limits,
  question validation, typed cancellation, and bounded network deadlines.

### Experience

- Added visible question navigation, question-level draft conflict choices,
  recovery retry/close actions, accessible ranking controls, and clearer
  delivery results.
- Added real Playwright browser coverage across Chromium, Firefox, and WebKit,
  plus cross-platform installer and release quality gates.

## 1.3.1

### Reliability

- MCP stdio processes now terminate cleanly after client or transport loss,
  avoiding orphaned processes and CPU spin.

## 1.3.0

### Added

- Added first-class Antigravity CLI integration, including host discovery,
  global MCP registration, the `askpro` skill plugin, doctor checks, and
  target-aware uninstall behavior.

### Reliability

- Resumed rounds reopen the configured local question panel when the original
  host request has ended.
- Added exact-round `cancel_round` control and preserved the user’s language
  when replacing an active round.

## 1.2.1

### Added

- Added redacted recoverable-round discovery and actionable exact-ID guidance
  when another round is already pending.

## 1.2.0

### Reliability

- Completed browser rounds are retired before later rounds render, preventing
  duplicate tabs and stale answers.
- Normal draft acknowledgements no longer trigger false recovery conflicts.
- Recovery actions now depend on exact round identity and valid round state.

## 1.1.1

### Reliability

- Hardened release quality gates, local recovery, privacy checks, installer
  verification, and release documentation.

## 1.1.0

### Added

- Expanded the structured question experience with multiple input types and a
  larger review-oriented browser flow.
