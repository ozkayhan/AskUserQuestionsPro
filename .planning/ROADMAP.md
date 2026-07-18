# Milestone v1.2: Multilingual, Responsive, and Branching Question Experience

**Status:** Planning
**Started:** 2026-07-18
**Phases:** 20–24
**Requirements:** 26

## Overview

This milestone expands the browser experience without changing the local bridge or host integration model. User-facing browser copy and agent-provided question prose can follow the user’s language, while machine-readable identifiers remain stable English metadata. The UI receives a full host-authored question tree and evaluates it deterministically, adds visible story-type context and architecture decision support, and receives a responsive visual redesign that preserves existing settings, recovery, delivery, and accessibility behavior.

The implementation order establishes the data contracts and pure decision logic before rebuilding the visual surfaces, then closes with cross-boundary and accessibility evidence.

## Phases

### Phase 20: Language and Presentation Contract Foundations

**Goal:** The project has explicit locale, story metadata, and host-language guidance contracts that preserve stable structured fields and legacy rounds.
**Requirements:** LOC-01–LOC-05

**Success criteria:**

1. A persisted locale preference and deterministic fallback are defined and covered by contract fixtures.
2. User-facing strings are separated from stable English question/story/option/condition identifiers.
3. Maintained host skill guidance instructs agents to use the user’s language for prose while emitting required structured metadata unchanged.
4. Legacy linear question payloads remain accepted without requiring localization or tree fields.

### Phase 21: Story Metadata and Conditional Tree Engine

**Goal:** The browser can deterministically render story-aware questions and evaluate a complete host-provided branching tree without AI or hidden network calls.
**Requirements:** STORY-01–STORY-04, TREE-01–TREE-06

**Success criteria:**

1. Every question can expose a stable story type; architecture questions preserve separate pros and cons; agent-decision answers are distinguishable from ordinary answers.
2. Nested conditions and dependent option sets produce the expected visible/required/skipped question path for single- and multi-select answers.
3. Changing an upstream answer removes or marks invalid downstream answers and prevents stale hidden answers from submission.
4. Malformed/cyclic/unsupported trees fail with actionable validation while a legacy linear round still works.
5. Pure decision and answer-mapping tests cover all supported operators, branches, story variants, and unknown story types.

### Phase 22: Responsive Design System and Core Round UI

**Goal:** The main round, question, navigation, review, and submission surfaces use a coherent responsive design system while retaining current behavior and accessibility semantics.
**Requirements:** UX-01–UX-04

**Success criteria:**

1. Color, typography, spacing, radius, elevation, motion, focus, and semantic-status tokens are documented and consumed by redesigned surfaces.
2. Compact, medium, and wide viewport layouts remain usable without horizontal scrolling, clipped actions, or inaccessible menus.
3. Existing question dispatch, drafting, navigation, review, submit, acknowledgement, and error states remain behaviorally equivalent.
4. Keyboard, focus, contrast, reduced-motion, accessible-name, role/state, and live-status checks pass for the redesigned core flow.

### Phase 23: Localized Settings, Recovery, and Story Presentation

**Goal:** All remaining browser surfaces present translated UI and host-provided multilingual content, including settings/recovery and story-specific controls, with robust long-text and directionality handling.
**Requirements:** LOC-06, TREE-07

**Success criteria:**

1. Long translated labels, mixed scripts, Unicode content, and RTL directionality do not overlap, truncate actionable text, or break navigation.
2. Settings, recovery, delivery, review, validation, and status copy use locale resources with the documented fallback.
3. Localized presentation is applied to the story controls delivered by Phase 21 without changing their structured answer output.
4. Host guidance and fixtures demonstrate a multilingual, fully expanded tree whose English metadata arrives unchanged and whose prose renders in the user’s language.

### Phase 24: Cross-Boundary Verification and UX Audit

**Goal:** The milestone is proven across host-to-browser boundaries with regression, accessibility, responsive visual, and compatibility evidence.
**Requirements:** UX-05, COMPAT-01–COMPAT-02, VERIFY-01–VERIFY-02

**Success criteria:**

1. Automated tests cover locale fallback, Unicode/RTL, story metadata, pros/cons, agent decision, nested tree evaluation, stale-branch cleanup, and legacy rounds.
2. A browser/host integration path proves a host-generated multilingual tree reaches the UI, returns expected localized answers, and preserves structured metadata.
3. UI/UX review uses `ui-ux-pro-max`, `ux-laws-advisor`, `ui-a11y`, `frontend-design`, and `frontend-developer` guidance with captured viewport evidence.
4. Claude Code and Codex/MCP paths continue to pass existing lifecycle, recovery, delivery, localhost, packaging, and zero-production-dependency checks.

## Traceability

| Requirement group | Phase | Evidence |
|---|---:|---|
| LOC-01–LOC-05 | 20 | Locale/host contract fixtures and skill guidance |
| STORY-01–STORY-04 | 21 | Story contract, answer-map tests, and UI fixtures |
| TREE-01–TREE-06 | 21 | Tree schema, deterministic evaluator, and validation tests |
| UX-01–UX-04 | 22 | Token source, responsive browser evidence, accessibility tests |
| LOC-06 | 23 | Multilingual/RTL/long-content browser evidence |
| TREE-07 | 23 | Expanded-tree host fixtures and language guidance |
| UX-05, COMPAT-01–02, VERIFY-01–02 | 24 | Audit report, integration run, regression suite, and release gates |

## Dependencies and Risks

- Tree and story contract changes must be additive so old Claude/Codex rounds remain valid.
- Locale resources must not become a runtime production dependency or require a frontend build pipeline.
- Branch evaluation must remain a pure browser decision layer; AI-generated data is an input contract, not a UI service.
- Visual redesign can expose hidden behavior regressions in settings/recovery/delivery, so Phase 24 is a release gate rather than a cosmetic sign-off.
