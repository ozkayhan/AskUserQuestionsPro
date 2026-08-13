'use strict';
// Regression tests for web/settings-panel.js fixes.
// Since settings-panel.js is a JSX browser module (no Node runtime), we test
// the source text for structural guarantees (aria, isSaving guard, AbortController,
// needsReload sticky) and unit-test the underlying schema primitives it relies on.
//
// Findings addressed:
//   [HIGH] settings-panel.js:107-129 — isSaving flag + AbortController + Save disable
//   [HIGH] settings-panel.js:101-130 — cancel() revert guard during in-flight save
//   [HIGH] settings-panel.js:39-48  — SettingRow toggle aria-label
//   [LOW]  settings-panel.js:88-99  — change() clears saveError
//   [LOW]  settings-panel.js:119-122 — needsReload sticky (sessionBaseline)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC_PATH = path.join(__dirname, '..', 'web', 'settings-panel.js');
const src = fs.readFileSync(SRC_PATH, 'utf8');

// ── Structural source-text assertions ────────────────────────────────────────

test('[HIGH] SettingRow toggle: aria-label={entry.label} present', () => {
  // The toggle button must carry aria-label so screen readers announce the setting name.
  assert.ok(
    src.includes('aria-label={entry.label}'),
    'toggle switch must have aria-label={entry.label}'
  );
});

test('[HIGH] isSaving state declared in SettingsModal', () => {
  assert.ok(src.includes('isSaving'), 'isSaving state variable must be declared');
});

test('[HIGH] AbortController used in save()', () => {
  assert.ok(
    src.includes('AbortController'),
    'AbortController must be used for in-flight fetch abort'
  );
});

test('[HIGH] save() disabled while isSaving (Save button disabled prop)', () => {
  // Both Save and Cancel buttons should be disabled={isSaving}.
  const disabledCount = (src.match(/disabled=\{isSaving\}/g) || []).length;
  assert.ok(disabledCount >= 2, 'both Save and Cancel buttons must be disabled={isSaving}');
});

test('[HIGH] AbortController aborted on unmount (cleanup in useEffect)', () => {
  // The cleanup function returned from useEffect should abort the controller.
  assert.ok(
    src.includes('abortRef.current.abort()') || src.includes('.abort()'),
    'AbortController must be aborted in cleanup'
  );
});

test('[HIGH] cancel() blocked while isSaving', () => {
  // cancel() must return early when isSaving is true.
  assert.ok(
    src.includes('if (isSaving) return'),
    'cancel() must guard against in-flight save (if isSaving return)'
  );
});

test('[HIGH] sessionBaseline used for needsReload comparison', () => {
  // sessionBaseline (frozen at mount) should be used in the reload comparison
  // instead of baseline (which updates each save), making needsReload sticky.
  assert.ok(
    src.includes('sessionBaseline'),
    'sessionBaseline ref must be used for sticky needsReload comparison'
  );
});

test('[LOW] needsReload is sticky: setNeedsReload uses prev => prev || ...', () => {
  // needsReload must never go back to false after being set true.
  assert.ok(
    src.includes('prev => prev || reloadChanged') || src.includes('prev || reloadChanged'),
    'setNeedsReload must use prev => prev || reloadChanged for sticky behavior'
  );
});

test('[LOW] change() clears saveError (setSaveError(false) inside change)', () => {
  // When the user changes a value, stale "Save failed" notices must be cleared.
  // Check that setSaveError(false) appears inside the change function body.
  // Broad check: setSaveError(false) appears after the change function definition.
  assert.ok(
    src.includes('setSaveError(false)'),
    'setSaveError(false) must be called to clear stale error on change'
  );
  // Verify it appears in the change() context (before the cancel function).
  const changeIdx = src.indexOf('function change(');
  const cancelIdx = src.indexOf('function cancel(');
  const saveErrIdx = src.indexOf('setSaveError(false)');
  // First setSaveError(false) should be inside change (before save function saves it too)
  assert.ok(
    saveErrIdx > changeIdx && saveErrIdx < cancelIdx,
    'setSaveError(false) should be called within change() body'
  );
});

test('[HIGH] SettingRow: role="switch" still present alongside aria-label', () => {
  // Ensure we didn't accidentally remove the role="switch" while adding aria-label.
  assert.ok(src.includes('role="switch"'), 'role="switch" must remain on toggle button');
  assert.ok(src.includes('aria-checked={value === true}'), 'aria-checked must remain');
});

test('[MEDIUM] select settings expose pressed state and readable descriptions', () => {
  assert.ok(src.includes('aria-pressed={o.value === value}'));
  assert.ok(src.includes('{entry.description}'));
});

test('[MEDIUM] destructive and close paths ask before discarding a dirty draft', () => {
  assert.ok(src.includes('showDiscardPrompt'));
  assert.ok(src.includes('Discard unsaved changes?'));
  assert.ok(src.includes('setResetConfirm(true)'));
  assert.ok(!src.includes('window.confirm('), 'settings should use an in-context confirmation');
});

test('[MEDIUM] data recovery is progressively disclosed', () => {
  assert.ok(src.includes('className="settings__data"'));
  assert.ok(src.includes('className="settings__data-summary"'));
  assert.ok(src.includes('setDataOpen(true)'));
});

test('useRef imported (required for abortRef and sessionBaseline)', () => {
  assert.ok(src.includes('useRef'), 'useRef must be imported and used');
});

test('settings import input is excluded from keyboard tab order', () => {
  const importStart = src.indexOf('accept="application/json,.json"');
  assert.notEqual(importStart, -1, 'import input should exist');
  const importInput = src.slice(
    src.lastIndexOf('<input', importStart),
    src.indexOf('/>', importStart) + 2
  );
  assert.match(importInput, /tabIndex=\{-1\}/);
});

test('settings button is placed in the workspace utility region instead of a fixed FAB', () => {
  assert.match(src, /className="settings-button"/);
  assert.doesNotMatch(src, /className="settings-fab"/);
});

test('settings focus trap excludes hidden and disabled controls', () => {
  assert.match(src, /input:not\(\[disabled\]\):not\(\[tabindex="-1"\]\)/);
  assert.match(src, /:not\(\.sr-only\)/);
});

// ── Schema-level unit tests (settings-panel logic depends on schema) ──────────

const Schema = require('../web/settings-schema.js');

test('Schema.entries() all have applies field (live or reload)', () => {
  for (const e of Schema.entries()) {
    assert.ok(
      e.applies === 'live' || e.applies === 'reload',
      `entry ${e.key} must have applies='live'|'reload'`
    );
  }
});

test('Schema live entries: theme + uiScale', () => {
  const liveKeys = Schema.entries()
    .filter((e) => e.applies === 'live')
    .map((e) => e.key);
  assert.ok(liveKeys.includes('theme'), 'theme must be live');
  assert.ok(liveKeys.includes('uiScale'), 'uiScale must be live');
});

test('Schema reload entries include reduceMotion', () => {
  const reloadKeys = Schema.entries()
    .filter((e) => e.applies === 'reload')
    .map((e) => e.key);
  assert.ok(reloadKeys.includes('reduceMotion'), 'reduceMotion must be reload');
});

test('needsReload sticky simulation: reload-type setting change survives second save', () => {
  // Simulate the sessionBaseline pattern:
  // session opens with defaults; reduceMotion changes → save1 (reload=true).
  // Then theme changes → save2. needsReload should remain true.
  const sessionBaseline = Schema.defaults(); // frozen at open
  let needsReload = false;

  // Save 1: reduceMotion toggled
  const save1Settings = { ...Schema.defaults(), reduceMotion: true };
  const reloadChanged1 = Schema.entries().some(
    (e) => e.applies === 'reload' && save1Settings[e.key] !== sessionBaseline[e.key]
  );
  needsReload = needsReload || reloadChanged1;
  assert.ok(needsReload, 'after save1, needsReload should be true');

  // Save 2: only theme changes (no new reload-type changes)
  const save2Settings = { ...save1Settings, theme: 'paper' };
  const reloadChanged2 = Schema.entries().some(
    (e) => e.applies === 'reload' && save2Settings[e.key] !== sessionBaseline[e.key]
  );
  needsReload = needsReload || reloadChanged2;
  assert.ok(needsReload, 'after save2 (sticky), needsReload must remain true');
});

test('[HIGH] save synchronizes the v2 envelope used by the next modal session', () => {
  const saveIdx = src.indexOf('function save(');
  const saveEndIdx = src.indexOf('\n  function adoptEnvelope', saveIdx);
  const saveBody = src.slice(saveIdx, saveEndIdx);
  assert.match(saveBody, /window\.__ASKUSER_SETTINGS_V2__\s*=\s*nextEnvelope/);
  assert.match(saveBody, /nextEnvelope\.browser\s*=\s*Settings_Schema\.mergeBrowserLegacy/);
});
