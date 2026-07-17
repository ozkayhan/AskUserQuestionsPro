const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const contract = fs.readFileSync('docs/adapter-contract.md', 'utf8');
const cards = [
  fs.readFileSync('docs/host-capability-cards/claude-code.md', 'utf8'),
  fs.readFileSync('docs/host-capability-cards/codex.md', 'utf8'),
];

test('contract inventories all lifecycle operations and safe replay rules', () => {
  for (const operation of ['start', 'attach', 'detach', 'cancel', 'resume', 'status', 'result', 'delivery acknowledgement']) {
    assert.match(contract, new RegExp(`\\| ${operation} \\|`));
  }
  assert.match(contract, /opaque selectors/);
  assert.match(contract, /immutable/);
  assert.match(contract, /idempotent/);
});

test('contract states loopback and redaction invariants', () => {
  assert.match(contract, /127\.0\.0\.1/);
  assert.match(contract, /never question or answer content/);
  assert.match(contract, /stale capability is rejected/);
});

test('contract preserves Claude fallback and Codex disconnect semantics', () => {
  assert.match(contract, /native fallback/);
  assert.match(contract, /Codex.*MCP adapter/s);
  assert.match(contract, /stdin EOF/);
  assert.match(contract, /cancellation is terminal/);
});

test('capability cards expose evidence fields and unavailable live status', () => {
  for (const card of cards) {
    for (const field of ['Transport', 'Timeout/deadline', 'Cancellation/disconnect', 'Approval/trust', 'Configuration', 'Installation/upgrade/uninstall', 'Evidence state', 'Limitations']) {
      assert.match(card, new RegExp(`^- ${field}:`, 'm'));
    }
    assert.match(card, /live authenticated acceptance `Unavailable`/);
    assert.match(card, /2026-07-17/);
  }
});
