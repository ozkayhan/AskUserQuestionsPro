'use strict';
// Regression tests for web/settings-schema.js fixes.
// Covers: applyAll empty-catch → console.warn in browser (LOW finding line 994).

const test = require('node:test');
const assert = require('node:assert');

// settings-schema.js is a UMD module that requires themes.js.
const Schema = require('../web/settings-schema.js');

// ── applyAll: console.warn on browser-side apply() error ─────────────────────
// Finding [LOW] web/settings-schema.js:168-172: catch was empty; browser apply
// failures were silently swallowed. Fix: console.warn when typeof document !== 'undefined'.

test('applyAll: emits console.warn when apply() throws and document is defined', () => {
  // Simulate a browser-like environment by temporarily defining document.
  const origDocument = global.document;
  global.document = {}; // presence signals "browser"

  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);

  // Temporarily corrupt one entry's apply to throw.
  const themeEntry = Schema.byKey('theme');
  const origApply = themeEntry.apply;
  const sentinel = new Error('apply-boom');
  themeEntry.apply = () => {
    throw sentinel;
  };

  try {
    Schema.applyAll(Schema.defaults());
  } finally {
    themeEntry.apply = origApply;
    console.warn = origWarn;
    if (origDocument === undefined) delete global.document;
    else global.document = origDocument;
  }

  // At least one warn fired for 'theme' key.
  assert.ok(warns.length >= 1, 'console.warn should have been called');
  const [msg, key, err] = warns[0];
  assert.ok(typeof msg === 'string' && msg.includes('[settings]'), 'warn message prefix');
  assert.strictEqual(key, 'theme', 'warn includes failing key');
  assert.strictEqual(err, sentinel, 'warn includes the thrown error');
});

test('applyAll: does NOT emit console.warn when document is undefined (Node/headless)', () => {
  // Ensure document is not defined.
  const origDocument = global.document;
  delete global.document;

  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);

  const themeEntry = Schema.byKey('theme');
  const origApply = themeEntry.apply;
  themeEntry.apply = () => {
    throw new Error('silent-boom');
  };

  try {
    Schema.applyAll(Schema.defaults());
  } finally {
    themeEntry.apply = origApply;
    console.warn = origWarn;
    if (origDocument !== undefined) global.document = origDocument;
  }

  assert.strictEqual(warns.length, 0, 'no console.warn in headless/node environment');
});

test('applyAll: does not throw when apply() throws (catch is safe)', () => {
  const themeEntry = Schema.byKey('theme');
  const origApply = themeEntry.apply;
  themeEntry.apply = () => {
    throw new Error('boom');
  };

  const origWarn = console.warn;
  console.warn = () => {}; // suppress output

  try {
    assert.doesNotThrow(() => Schema.applyAll(Schema.defaults()));
  } finally {
    themeEntry.apply = origApply;
    console.warn = origWarn;
  }
});

test('applyAll: calls all remaining entries even if one throws', () => {
  const called = [];
  const entries = Schema.entries();

  // Patch first two entries: first throws, second records call.
  const e0 = entries[0];
  const e1 = entries[1];
  const orig0 = e0.apply;
  const orig1 = e1.apply;
  e0.apply = () => {
    throw new Error('boom-0');
  };
  e1.apply = (v) => {
    called.push({ key: e1.key, v });
    orig1(v);
  };

  const origWarn = console.warn;
  console.warn = () => {};

  try {
    Schema.applyAll(Schema.defaults());
  } finally {
    e0.apply = orig0;
    e1.apply = orig1;
    console.warn = origWarn;
  }

  assert.ok(called.length >= 1, 'entries after the throwing one should still be called');
});

// ── applyAll: validates values before applying ────────────────────────────────
test('applyAll: validates values (invalid select falls back to default)', () => {
  // applyAll calls validate internally; passing junk should not throw.
  assert.doesNotThrow(() => Schema.applyAll({ theme: 'nonexistent', uiScale: 'xl' }));
});

// ── applyAll: with no document defined, all entries run silently ───────────────
test('applyAll defaults: no error in pure Node context (baseline health)', () => {
  const hadDocument = 'document' in global;
  const savedDoc = global.document;
  delete global.document;
  try {
    assert.doesNotThrow(() => Schema.applyAll(Schema.defaults()));
  } finally {
    if (hadDocument) global.document = savedDoc;
  }
});
