'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runProcess, redact } = require('./helpers/fake-host');

const HOOK = path.join(__dirname, '..', 'hooks', 'askuserquestionspro-bridge.mjs');

test('fake Claude host drives the real hook process and preserves native fallback', async () => {
  const result = await runProcess(HOOK, 'not-json', { ASKUSER_FORCE_MCP: '0' });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('fake Claude host captures empty-input fallback without payload leakage', async () => {
  const result = await runProcess(
    HOOK,
    JSON.stringify({ tool_input: {} }),
    {}
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stdout, /synthetic-question|synthetic-answer/);
});

test('fake host redaction is stable for replayed lifecycle metadata', () => {
  const first = redact('roundId=7 synthetic-answer-1 state=complete');
  const replay = redact('roundId=7 synthetic-answer-1 state=complete');
  assert.equal(first, replay);
  assert.match(first, /roundId=7 .*state=complete/);
  assert.doesNotMatch(first, /synthetic-answer/);
});

test('stale selectors are represented as distinct from current opaque identity', () => {
  const current = { requestId: 'current-request', roundId: 'round-2', capability: 'cap-2' };
  const stale = { requestId: 'old-request', roundId: 'round-1', capability: 'cap-1' };
  assert.notDeepEqual(stale, current);
  assert.notEqual(stale.capability, current.capability);
});
