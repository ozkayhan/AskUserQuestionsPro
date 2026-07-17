'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const evidence = fs.readFileSync('test/tier1-acceptance-evidence.md', 'utf8');
const scenarios = ['idle', 'reconnect', 'restart', 'cancel', 'recovery', 'result', 'ack'];

test('Tier 1 matrix enumerates every scenario for both adapters', () => {
  for (const host of ['Claude Code', 'Codex']) assert.match(evidence, new RegExp(`\\| ${host} \\|`));
  for (const scenario of scenarios) assert.match(evidence, new RegExp(scenario));
});

test('local evidence links to executable tests and remains redacted', () => {
  assert.match(evidence, /node --test test\/fake-host-conformance\.test\.js/);
  assert.match(evidence, /node --test test\/mcp-long-round\.test\.js/);
  assert.doesNotMatch(evidence, /synthetic-question|synthetic-answer|password|token=/i);
});

test('authenticated live prerequisites are explicitly unavailable, never passed', () => {
  assert.match(evidence, /Authenticated live host unavailable/);
  assert.match(evidence, /\| Unavailable \|/);
  assert.match(evidence, /not passes/);
  assert.doesNotMatch(evidence, /live.*\| (Automated )?pass \|/i);
});
