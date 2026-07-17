---
phase: 10-settings-v2
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - bin/cli.js
  - lib/settings.js
  - server/server.js
  - web/settings-panel.js
  - web/settings-schema.js
  - test/browser-settings.test.js
  - test/runtime-settings.test.js
  - test/settings-schema.test.js
  - test/fixtures/settings-future.json
  - test/fixtures/settings-unversioned.json
  - test/fixtures/settings-v1.json
  - test/fixtures/settings-v2.json
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-17
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The Phase 10 settings-v2 implementation has a broken compatibility boundary between the v2 envelope and the existing flat browser/runtime settings contract. The full test suite passes, but the added tests do not exercise a v2 file through the browser boot path or through a subsequent legacy save. The implementation should not ship until the two blocker findings are fixed.

## Critical Issues

### CR-01: Legacy browser save destroys all non-browser v2 settings

**File:** `server/server.js:568-591`, `lib/settings.js:48-55,84-89`
**Issue:** The browser settings panel posts a flat legacy patch to `/settings`. `Settings.write()` reads a v2 envelope with `Schema.validate()`, which ignores the nested namespaces and returns browser defaults, then rewrites the file as a v1 flat object. Therefore, after a v2 import/reset/apply has stored values such as `recovery`, `autosave`, `diagnostics`, `delivery`, `closure`, or `adapters`, saving any browser preference silently replaces the envelope and loses every non-flat namespace. This is a data-loss bug in the primary UI path.
**Fix:** Make `/settings` update the `browser` namespace of the current v2 envelope using compare-and-swap, and persist with `writeEnvelope()`; alternatively migrate the panel to submit a complete v2 envelope and reject stale revisions. Do not call the legacy `write()` path when the on-disk source is v2.

### CR-02: Runtime consumers ignore v2 browser settings at boot

**File:** `web/app.js:180-181,325-326,539-546`, `server/server.js:213-215`
**Issue:** The server injects both the legacy flat value and the v2 envelope, but `web/app.js` continues to read only `window.__ASKUSER_SETTINGS__`. With a v2 settings file, `Settings.read()` validates the nested envelope as a flat object and returns browser defaults. Consequently `autoAdvance`, `confirmSubmit`, and the question-type enablement flags are reset to defaults on every page load even when the v2 envelope contains explicit values. `settings-panel.js` understands `__ASKUSER_SETTINGS_V2__`, but the actual question flow does not.
**Fix:** Normalize one v2-aware browser settings object during boot and use it consistently in `app.js` (including `autoAdvance`, `confirmSubmit`, and `AnswerMap.setEnabled`). Keep the flat variable only as an explicit legacy fallback for v1 files.

## Warnings

### WR-01: Unsupported and malformed version markers are accepted as current settings

**File:** `web/settings-schema.js:468-474`
**Issue:** `inspectEnvelope()` rejects only `_v > CURRENT_VERSION`. Values such as `_v: 0`, `_v: -1`, `_v: 1.5`, or `_v: "2"` are classified as `current` and accepted after partial validation. This makes the import/preview contract ambiguous and can cause an unknown historical format to be silently rewritten as v2.
**Fix:** Require an integer version marker and explicitly support only the known versions (`undefined`/v1 legacy and v2); return an invalid/unsupported status for every other value, including non-numeric and lower unknown versions.

---

_Reviewed: 2026-07-17_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
