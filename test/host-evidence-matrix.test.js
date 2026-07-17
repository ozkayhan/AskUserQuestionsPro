'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./host-compatibility-evidence.json');
const required = ['cursor','github-copilot-cli','gemini-cli','amazon-q-developer','cline','kiro','kilo-code','qwen-code','opencode','roo-code','windsurf','aider'];
const allowed = new Set(['Supported','Experimental','Researching','Unsupported']);
const installed = new Set(['installed','installed-unverified','official-doc+installed-unverified','authenticated','manual']);
test('ledger has one dated row per named host and required fields', () => {
  assert.equal(ledger.hosts.length, required.length);
  assert.deepEqual(ledger.hosts.map((h) => h.id), required);
  for (const h of ledger.hosts) {
    assert.ok(allowed.has(h.status)); assert.match(h.evidenceDate || ledger.evidenceDate, /^2026-07-17$/);
    for (const key of ['name','sources','transport','version','scenarios','nextGate','evidenceClass']) assert.ok(h[key] !== undefined, `${h.id}/${key}`);
    assert.ok(typeof (h.limitations || h.limitation) === 'string' && (h.limitations || h.limitation).length);
    for (const url of h.sources) assert.match(url, /^https:\/\//);
  }
});
test('promotion fails closed and unavailable rows are honest', () => {
  for (const h of ledger.hosts) {
    if (h.status === 'Supported' || h.status === 'Experimental') assert.ok([...installed].some((x) => h.evidenceClass.includes(x)), `${h.id} lacks installed evidence`);
    if (h.status === 'Unsupported') assert.ok((h.limitations || h.limitation).length > 10);
  }
  assert.equal(ledger.hosts.find((h) => h.id === 'aider').status, 'Unsupported');
  assert.ok(ledger.hosts.filter((h) => h.status === 'Researching').length >= 10);
});
test('ledger is redacted and matrix/cards map one-to-one', () => {
  const raw = fs.readFileSync(path.join(__dirname, 'host-compatibility-evidence.json'), 'utf8');
  assert.doesNotMatch(raw, /synthetic-(question|answer)|password|secret|token\s*[:=]|\/Users\/oka|\/home\/[^/\s"']+/i);
  const matrix = fs.readFileSync(path.join(__dirname, 'host-compatibility-evidence.md'), 'utf8');
  for (const h of ledger.hosts) { assert.equal((matrix.match(new RegExp(`\\| ${h.id} \\|`, 'g')) || []).length, 1); assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', 'host-capability-cards', `${h.id}.md`))); }
});
