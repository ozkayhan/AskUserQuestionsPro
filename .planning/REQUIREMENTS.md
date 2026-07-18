# Requirements: AskUserQuestionsPro v1.2

**Milestone:** Multilingual, Responsive, and Branching Question Experience
**Defined:** 2026-07-18
**Scope:** Browser presentation and host-provided question data only. Existing localhost, host, lifecycle, packaging, and zero-production-dependency contracts remain in force unless a requirement below explicitly extends the question contract.

## Localization and Language Presentation

- [ ] **LOC-01** — User can choose a preferred browser UI language, and the choice persists across reloads and new rounds.
- [ ] **LOC-02** — Browser chrome (navigation, settings, validation, review, recovery, delivery, and status messages) is rendered from locale resources with a documented fallback when a translation is incomplete.
- [ ] **LOC-03** — Host-provided question text, descriptions, option labels, help text, and answer summaries render correctly in any Unicode language supplied by the host, including mixed scripts and right-to-left layout where applicable.
- [ ] **LOC-04** — Presentation language is separate from structured metadata: stable question types, story-type identifiers, option identifiers, condition operators, and bridge/MCP payload fields remain language-neutral and backward compatible.
- [ ] **LOC-05** — The maintained host skill guidance tells the agent to write user-facing questions, options, and answer summaries in the language the user is using while keeping required structured metadata in the existing English identifiers.
- [ ] **LOC-06** — Locale formatting handles directionality, plural-sensitive UI copy, long translated labels, and font fallback without truncating or overlapping actionable content.

## Responsive Visual System

- [ ] **UX-01** — Browser UI uses a documented design-token layer for color, typography, spacing, radii, elevation, motion, focus, and semantic status states; tokens are the single styling source for redesigned surfaces.
- [ ] **UX-02** — The round, question, review, settings, recovery, and delivery surfaces reflow at compact, medium, and wide viewport sizes without horizontal scrolling or inaccessible controls.
- [ ] **UX-03** — The visual refresh preserves existing product behavior: question-type dispatch, answer drafts, navigation, review, submit/delivery acknowledgement, recovery, themes, settings persistence, and host completion semantics remain functional.
- [ ] **UX-04** — Redesigned surfaces preserve accessible names, roles, states, keyboard operation, focus order/restoration, contrast, reduced-motion behavior, and visible error/status announcements.
- [ ] **UX-05** — The redesign is reviewed with the project’s UI/UX and accessibility audit skills and has repeatable browser evidence at representative viewport and content-length combinations.

## Story Types and Decision Support

- [ ] **STORY-01** — Every question can carry a stable story-type identifier and a localized display label that is visible in the question UI without changing the existing question-type semantics.
- [ ] **STORY-02** — Architecture-story questions can request and display structured pros/cons input with distinct positive and negative affordances, and the submitted answer preserves both sides separately.
- [ ] **STORY-03** — Any applicable question can expose an explicit, clearly labeled “let the agent decide for me” option whose result is distinguishable from a user-selected option or free-form answer.
- [ ] **STORY-04** — Unknown or future story types degrade safely to a readable label/metadata presentation and do not prevent the rest of a valid round from being answered.

## Declarative Question Trees

- [ ] **TREE-01** — A round can carry the complete question tree, including all potential child questions and option sets, in one host-provided payload so the browser does not need to ask an AI model for missing branches.
- [ ] **TREE-02** — Declarative conditions can use prior answers to determine whether a question is visible, required, skipped, or replaced by a dependent option set.
- [ ] **TREE-03** — Conditions support nested branches, single- and multi-select answers, stable option identifiers, and provider/feature-style dependencies such as showing Vercel features only after Vercel is selected.
- [ ] **TREE-04** — The browser evaluates the supplied tree deterministically and locally; it performs no AI inference or hidden network request while deciding visibility, options, validation, or navigation.
- [ ] **TREE-05** — When an answer changes and invalidates a downstream branch, the UI removes or marks affected answers deterministically, explains the resulting change, and never submits stale hidden answers.
- [ ] **TREE-06** — Tree validation rejects malformed, cyclic, ambiguous, or unsupported conditions at the host/contract boundary with an actionable error, while a legacy linear question list remains valid.
- [ ] **TREE-07** — Maintained host skill guidance instructs the agent to emit the full branch structure and stable English metadata for every plausible path, while writing user-facing prose in the user’s language.

## Compatibility and Verification

- [ ] **COMPAT-01** — Claude Code and Codex/MCP integrations continue to submit and receive rounds through the existing localhost bridge without requiring a remote service, authentication change, or production dependency.
- [ ] **COMPAT-02** — Existing question types, settings, recovery, delivery acknowledgement, cancellation, and stale-round protections remain backward compatible for rounds that do not use localization, story metadata, or tree conditions.
- [ ] **VERIFY-01** — Automated contract, browser decision, accessibility, and regression tests cover locale fallback, Unicode/RTL rendering, story metadata, pros/cons, agent-decision answers, nested tree evaluation, stale-branch cleanup, and legacy linear rounds.
- [ ] **VERIFY-02** — Browser/host boundary changes have an integration or manual verification path that demonstrates a host-generated multilingual tree reaches the UI, produces the expected localized answers, and returns structured metadata unchanged.

## Future Requirements

- **FUTURE-01** — Server-side or browser-side AI translation of legacy English rounds.
- **FUTURE-02** — A remote translation service, user accounts, shared locale contributions, or cloud-synchronized language preferences.
- **FUTURE-03** — A visual tree editor for users to author or modify agent-generated branching logic in the browser.
- **FUTURE-04** — Browser-side AI that invents, repairs, or expands missing question branches.

## Out of Scope

- Changing MCP/JSON-RPC semantics, host adapter invocation contracts, or the English structured metadata identifiers solely to translate UI copy.
- Translating the installed skill’s command names, internal question-type names, or machine-readable fields; only its language-selection guidance and user-facing output instruction are extended.
- Replacing the local single-user bridge, exposing it beyond `127.0.0.1`, adding authentication, adding a database, or changing the zero-production-dependency distribution model.
- Redesigning the product’s lifecycle behavior or settings meaning; this milestone changes presentation and question expressiveness while preserving those behaviors.

## Traceability

| Requirement | Phase | Evidence |
|---|---:|---|
| LOC-01–LOC-06 | TBD | TBD |
| UX-01–UX-05 | TBD | TBD |
| STORY-01–STORY-04 | TBD | TBD |
| TREE-01–TREE-07 | TBD | TBD |
| COMPAT-01–COMPAT-02 | TBD | TBD |
| VERIFY-01–VERIFY-02 | TBD | TBD |
