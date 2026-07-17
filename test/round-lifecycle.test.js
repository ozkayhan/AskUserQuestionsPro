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
    boundary: 'mcp',
    deadlineOwner: 'none',
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

test('lifecycle defaults every record to an adapter boundary or safe bridge fallback', () => {
  const adapters = ['bridge', 'http', 'sse', 'hook', 'mcp', 'stdio', 'browser', 'unknown'];

  for (const adapter of adapters) {
    const seen = [];
    const lifecycle = createLifecycle({
      adapter,
      logger: (_scope, detail) => seen.push(JSON.parse(detail)),
    });
    lifecycle.event('ask_received');
    lifecycle.finish('completed');

    assert.deepEqual(
      seen.map(({ boundary, deadlineOwner }) => ({ boundary, deadlineOwner })),
      Array.from({ length: 3 }, () => ({
        boundary: adapter === 'unknown' ? 'bridge' : adapter,
        deadlineOwner: 'none',
      })),
      `adapter ${adapter} should attribute every lifecycle record`
    );
  }
});

test('explicit lifecycle metadata overrides centralized defaults without admitting payloads', () => {
  const seen = [];
  const lifecycle = createLifecycle({
    adapter: 'http',
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });
  lifecycle.event('host_detached', {
    boundary: 'stdio',
    deadlineOwner: 'transport',
    question: 'secret question',
    answers: { secret: 'secret answer' },
  });

  assert.deepEqual(
    { boundary: seen[1].boundary, deadlineOwner: seen[1].deadlineOwner },
    { boundary: 'stdio', deadlineOwner: 'transport' }
  );
  assert.doesNotMatch(JSON.stringify(seen), /secret question|secret answer/);
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

test('lifecycle diagnostics allowlist boundary and deadline owner without payload metadata', () => {
  const seen = [];
  const lifecycle = createLifecycle({
    adapter: 'mcp',
    requestId: 'opaque-request',
    now: () => 10,
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });
  lifecycle.event('host_detached', {
    boundary: 'stdio',
    deadlineOwner: 'transport',
    question: 'secret',
  });
  lifecycle.finish('host_disconnect', { boundary: 'stdio', deadlineOwner: 'transport' });
  assert.deepEqual(seen[1], {
    event: 'host_detached',
    adapter: 'mcp',
    requestId: 'opaque-request',
    pid: process.pid,
    elapsedMs: 0,
    boundary: 'stdio',
    deadlineOwner: 'transport',
  });
  assert.equal(JSON.stringify(seen).includes('secret'), false);
});

test('lifecycle records delivery uncertainty without answer payloads', () => {
  const seen = [];
  const lifecycle = createLifecycle({ logger: (_scope, detail) => seen.push(JSON.parse(detail)) });
  lifecycle.event('delivery_uncertain', { answers: { secret: 'value' } });
  assert.equal(seen[1].event, 'delivery_uncertain');
  assert.equal(JSON.stringify(seen).includes('secret'), false);
});
