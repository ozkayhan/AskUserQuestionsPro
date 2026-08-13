'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Record = require('../lib/round-record.cjs');

const base = () =>
  Record.create({
    questions: [{ question: 'Q?' }],
    requestId: 'request-1',
    capability: 'capability-1',
    now: 100,
    retentionMs: 1000,
  });

test('durable records have a version, opaque id, revision, lifecycle and expiry', () => {
  const record = base();
  assert.equal(record.formatVersion, 1);
  assert.match(record.roundId, /^round_[A-Za-z0-9_-]+$/);
  assert.equal(record.revision, 0);
  assert.equal(record.expiresAt, 1100);
  assert.equal(record.lifecycle.state, 'drafting');
});

test('draft writes require the current revision and final results are immutable', () => {
  const record = base();
  const edited = Record.saveDraft(record, { 'Q?': 'draft' }, 0, 101);
  assert.equal(edited.ok, true);
  assert.equal(edited.record.revision, 1);
  assert.equal(Record.saveDraft(edited.record, {}, 0, 102).code, 'stale_revision');
  const final = Record.finalize(edited.record, { 'Q?': 'answer' }, 1, 103);
  assert.equal(final.ok, true);
  assert.equal(Record.finalize(final.record, { 'Q?': 'answer' }, 2, 104).replayed, true);
  assert.equal(Record.finalize(final.record, { 'Q?': 'changed' }, 2, 104).code, 'immutable_result');
});

test('delivery acknowledgement is idempotent and persisted once', () => {
  const final = Record.finalize(base(), { 'Q?': 'answer' }, 0, 103).record;
  const first = Record.acknowledge(final, 104);
  assert.equal(first.ok, true);
  const replay = Record.acknowledge(first.record, 105);
  assert.equal(replay.replayed, true);
  assert.equal(replay.record.revision, first.record.revision);
  assert.equal(replay.record.delivery.acknowledgedAt, 104);
});

test('invalid persisted records and future formats are rejected', () => {
  assert.equal(Record.validate({ formatVersion: 2 }).code, 'unsupported_format');
  assert.equal(Record.validate({ formatVersion: 1, roundId: '../bad' }).ok, false);
});

test('durable transitions share the lifecycle legality and revision contract', () => {
  const record = base();
  const illegal = Record.transition(record, 'delivered', 0, 101);
  assert.equal(illegal.ok, false);
  assert.equal(illegal.code, 'illegal_transition');
  assert.strictEqual(illegal.record, undefined);

  const stale = Record.transition(record, 'detach', 1, 101);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'stale_revision');

  const detached = Record.transition(record, 'detach', 0, 101, {
    deadlineOwner: 'host',
    expiresAt: 1101,
  });
  assert.equal(detached.ok, true);
  assert.equal(detached.record.lifecycle.state, 'detached');
  assert.equal(detached.record.revision, 1);
  assert.equal(detached.record.expiresAt, 1101);
});

test('durable finalization rejects terminal records instead of reopening them', () => {
  const cancelled = Record.transition(base(), 'cancel', 0, 101, {
    terminalReason: 'user_cancelled',
  });
  assert.equal(cancelled.ok, true);
  const reopened = Record.finalize(cancelled.record, { 'Q?': 'answer' }, 1, 102);
  assert.equal(reopened.ok, false);
  assert.equal(reopened.code, 'illegal_transition');
});
