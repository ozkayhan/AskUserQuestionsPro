'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
test('browser settings evidence artifact is present and distinguishes manual checks', () => {
  const evidence = fs.readFileSync('test/frontend-settings-evidence.md', 'utf8');
  assert.match(evidence, /Future-version import/);
  assert.match(evidence, /MANUAL CHECK/);
});
