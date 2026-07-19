'use strict';
// Regression tests for web/views.js accessibility fixes.
// Finding M-24 — interactive controls bound to keyboard shortcuts (1-9, Enter, b)
// must expose aria-keyshortcuts so assistive tech announces the shortcut.
//
// views.js is browser-only JSX (React, AnswerMap globals); per repo convention
// (see ui-kit.test.js) we assert via source-text structure — the lightest
// correct seam without a DOM.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'web', 'views.js'), 'utf8');

// Slice a named function body so assertions are scoped, not file-global.
function fnBody(name) {
  const start = SRC.indexOf('function ' + name + '(');
  assert.ok(start !== -1, `${name} tanımı bulunmalı`);
  // sonraki top-level "function " başlangıcına kadar (kaba ama yeterli scope).
  const next = SRC.indexOf('\nfunction ', start + 1);
  return SRC.slice(start, next === -1 ? undefined : next);
}

test('M-24: BinaryCard option button number-key kısayolunu aria-keyshortcuts ile bildirir', () => {
  const body = fnBody('BinaryCard');
  assert.match(
    body,
    /aria-keyshortcuts=\{i < 9 \? String\(i \+ 1\) : undefined\}/,
    'binary opt aria-keyshortcuts i+1 olmalı'
  );
});

test('M-24: tek/çoklu seçim option button aria-keyshortcuts (1-9) taşır', () => {
  // QuestionCard içindeki single/multi options bloğu (opt class'lı buton).
  const body = fnBody('QuestionCard');
  assert.match(
    body,
    /aria-keyshortcuts=\{i < 9 \? String\(i \+ 1\) : undefined\}/,
    'single/multi opt aria-keyshortcuts i+1 olmalı'
  );
});

test('M-24: TreeCard dal butonu aria-keyshortcuts (1-9) taşır', () => {
  const body = fnBody('TreeCard');
  assert.match(
    body,
    /aria-keyshortcuts=\{i < 9 \? String\(i \+ 1\) : undefined\}/,
    'tree opt aria-keyshortcuts i+1 olmalı'
  );
});

test('M-24: Summary Back butonu aria-keyshortcuts="B", Submit aria-keyshortcuts="Enter"', () => {
  const body = fnBody('Summary');
  assert.match(body, /aria-keyshortcuts="B"/, 'Back butonu B kısayolu bildirmeli');
  assert.match(body, /aria-keyshortcuts="Enter"/, 'Submit butonu Enter kısayolu bildirmeli');
});

test("M-24: number-key kısayolu yalnızca 1-9 için (10+ option undefined → DOM'da yok)", () => {
  // i < 9 guard'ı: 10. option (index 9) ve sonrası kısayol almamalı (1-9 sınırı).
  assert.match(
    SRC,
    /i < 9 \? String\(i \+ 1\) : undefined/,
    'kısayol i<9 ile sınırlanmalı (klavye 1-9 ile uyumlu)'
  );
});

test('recovery actions have the locked touch target and responsive layout rules', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  assert.match(styles, /\.btn\s*\{[\s\S]{0,260}min-height: 44px;/);
  assert.match(styles, /\.recovery-panel[\s\S]{0,140}width: min\(620px, 100%\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]{0,260}\.recovery-actions \.btn/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
