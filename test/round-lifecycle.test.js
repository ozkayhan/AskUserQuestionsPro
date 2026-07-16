'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');

test('lifecycle events carry correlation data but never question or answer payloads', () => {
  const seen = [];
  let now = 1000;
  const lifecycle = createLifecycle({
    adapter: 'mcp',
    requestId: 'request-1',
    roundId: 7,
    pid: 123,
    now: () => now,
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });

  now = 1450;
  lifecycle.event('answer_received', { question: 'secret question', answers: { secret: 'value' } });
  lifecycle.finish('completed');
  lifecycle.finish('host_disconnect');

  assert.equal(seen.length, 3);
  assert.deepEqual(seen[0], {
    event: 'round_started',
    adapter: 'mcp',
    requestId: 'request-1',
    roundId: 7,
    pid: 123,
    elapsedMs: 0,
  });
  assert.equal(seen[1].event, 'answer_received');
  assert.equal(seen[1].elapsedMs, 450);
  assert.equal(seen[1].requestId, 'request-1');
  assert.equal(seen[2].event, 'round_finished');
  assert.equal(seen[2].reason, 'completed');
  assert.equal(seen[2].elapsedMs, 450);
  assert.doesNotMatch(JSON.stringify(seen), /secret/);
  assert.doesNotMatch(JSON.stringify(seen), /value/);
});

test('lifecycle normalizes unknown terminal reasons and never throws when logging fails', () => {
  const lifecycle = createLifecycle({
    adapter: 'hook',
    requestId: 'request-2',
    logger: () => {
      throw new Error('stderr unavailable');
    },
  });

  assert.doesNotThrow(() => lifecycle.finish('not-a-contract-reason'));
  assert.doesNotThrow(() => lifecycle.event('not-a-contract-event'));
});
