'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./host-compatibility-evidence.json');
test('candidate research has a record, dated source state, and next gate', () => {
  const dir = path.join(__dirname, '..', 'docs', 'host-research');
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  assert.match(readme, /temporary `HOME`/); assert.match(readme, /never\ninstalls candidate hosts/);
  for (const h of ledger.hosts) {
    assert.ok(h.status === 'Researching' || h.status === 'Unsupported');
    assert.ok(h.nextGate && h.nextGate.length > 10);
    if (h.evidenceClass.includes('official-doc')) assert.ok(h.sources.length, `${h.id} source missing`);
    assert.doesNotMatch(JSON.stringify(h), /synthetic-(question|answer)|password|token\s*[:=]|\/Users\/oka/i);
  }
});
