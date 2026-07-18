'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const doc = fs.readFileSync('docs/evidence/phase-13-native-os-runs.md', 'utf8');
const evidence = require('../docs/evidence/phase-13-native-os-runs.json');

test('native evidence has one metadata-complete result per OS and scenario', () => {
  assert.equal(evidence.oses.length, 3);
  for (const row of evidence.oses) {
    for (const key of [
      'os',
      'architecture',
      'node',
      'configRoot',
      'command',
      'date',
      'result',
      'limitation',
      'scenarioResults',
    ])
      assert.ok(row[key], `${row.id}/${key}`);
    for (const scenario of evidence.scenarios)
      assert.ok(row.scenarioResults[scenario], `${row.id}/${scenario}`);
  }
  assert.equal(evidence.oses.find((row) => row.id === 'linux').result, 'Unavailable');
  assert.equal(evidence.oses.find((row) => row.id === 'windows').result, 'Unavailable');
  assert.match(doc, /WSL does not qualify/i);
});

test('supported host promotion requires native OS and lifecycle evidence', () => {
  for (const phrase of [
    'installed conformance',
    'long-round',
    'install/upgrade',
    'trust',
    'config-scope',
  ])
    assert.match(doc, new RegExp(phrase));
  const raw = JSON.stringify(evidence);
  assert.doesNotMatch(raw, /synthetic-(question|answer)|password|token\s*[:=]|\/Users\/oka/i);
});
