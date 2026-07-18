'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ledger = require('./host-compatibility-evidence.json');
test('install gate is no-install and records unavailable hosts honestly', () => {
  const source = fs.readFileSync('test/host-install-gates.test.js', 'utf8');
  assert.doesNotMatch(source, /npm\s+(install|i|ci)|pip\s+install|brew\s+install|winget\s+install/);
  assert.ok(ledger.hosts.some((h) => h.id === 'opencode' && h.version !== 'unavailable'));
  assert.ok(ledger.hosts.filter((h) => h.version === 'unavailable').length >= 10);
});
test('future promotion requires complete isolated lifecycle evidence', () => {
  const required = ['version', 'configScope', 'scenarios', 'installScope', 'nextGate'];
  for (const h of ledger.hosts.filter((h) => h.status === 'Supported'))
    for (const key of required) assert.ok(h[key]);
  assert.match(
    fs.readFileSync('docs/host-research/README.md', 'utf8'),
    /install, upgrade, uninstall, trust, scope/
  );
});
