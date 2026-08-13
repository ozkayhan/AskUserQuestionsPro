'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { STATES, createRecord, transition, snapshot } = require('../lib/round-state.cjs');

test('round-state represents every Phase 8 lifecycle state without payload content', () => {
  const expected = [
    'drafting',
    'detached',
    'reconnecting',
    'delivery-pending',
    'delivered',
    'delivery-uncertain',
    'cancelled',
    'recovery-error',
    'expired',
  ];
  assert.deepEqual([...STATES], expected);

  let record = createRecord({ id: 7, capability: 'opaque-capability', now: 100 });
  for (const [event, state] of [
    ['detach', 'detached'],
    ['resume', 'reconnecting'],
    ['answerAccepted', 'delivery-pending'],
    ['delivered', 'delivered'],
  ]) {
    record = transition(record, event, { now: record.updatedAt + 1 }).record;
    assert.equal(record.state, state);
  }
  const publicRecord = snapshot(record);
  assert.deepEqual(Object.keys(publicRecord).sort(), [
    'capability',
    'createdAt',
    'deadlineOwner',
    'id',
    'state',
    'terminalReason',
    'updatedAt',
  ]);
  assert.equal(JSON.stringify(publicRecord).includes('question'), false);
  assert.equal(JSON.stringify(publicRecord).includes('answer'), false);
});

test('round-state rejects illegal and duplicate transitions without replacing record', () => {
  const record = createRecord({ id: 1, capability: 'cap', now: 1 });
  const illegal = transition(record, 'delivered', { now: 2 });
  assert.equal(illegal.ok, false);
  assert.strictEqual(illegal.record, record);
  const detached = transition(record, 'detach', { now: 2 }).record;
  const duplicate = transition(detached, 'detach', { now: 3 });
  assert.equal(duplicate.ok, false);
  assert.strictEqual(duplicate.record, detached);
});

test('round-state rejects invalid transition metadata without mutating the record', () => {
  const record = createRecord({ id: 1, capability: 'cap', now: 10 });

  const invalidDeadline = transition(record, 'detach', {
    now: 11,
    deadlineOwner: 'not-a-deadline-owner',
  });
  assert.equal(invalidDeadline.ok, false);
  assert.equal(invalidDeadline.code, 'invalid_deadline_owner');
  assert.strictEqual(invalidDeadline.record, record);

  const invalidTime = transition(record, 'detach', { now: 9 });
  assert.equal(invalidTime.ok, false);
  assert.equal(invalidTime.code, 'invalid_timestamp');
  assert.strictEqual(invalidTime.record, record);
});
