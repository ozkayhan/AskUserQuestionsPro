---
status: complete
created: 2026-08-10
---

# Settings UI/UX polish quick task

## Objective

Turn the Settings modal into a calm, scannable, accessible, responsive product
surface without changing the settings contract or save semantics.

## Scope

- Replace repeated generic copy with useful setting-specific descriptions and
  readable current/effect states.
- Establish visible modal hierarchy, scroll-safe content, sticky actions, dirty
  state, and safe discard behavior.
- Make data/recovery actions progressive, readable, and safe on reset/import.
- Fix mobile layout ordering, control target sizes, focus states, and theme
  token drift.
- Preserve existing browser, schema, and settings-route contracts.

## Verification

- Focused settings source/schema tests and browser CLI flow.
- `npm test`, `npm run lint`, `npm run format:check`, and `git diff --check`.
- Desktop and 320px visual artifact inspection.
