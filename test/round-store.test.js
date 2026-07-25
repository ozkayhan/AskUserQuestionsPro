'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { RoundStore } = require('../lib/round-store.cjs');
const { createRecord, transition } = require('../lib/round-state.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-round-store-'));
  return { root, store: new RoundStore({ root, now: () => 100 }) };
}

test('store writes private snapshots and reloads the newest record', () => {
  const { root, store } = fixture();
  const created = store.create({
    questions: [{ question: 'Q?' }],
    capability: 'cap',
    retentionMs: 1000,
  });
  assert.equal(created.ok, true);
  assert.equal(fs.statSync(path.join(root, 'rounds')).mode & 0o777, 0o700);
  const loaded = new RoundStore({ root, now: () => 100 }).get(created.record.roundId);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.revision, 0);
});

test('store tightens existing round and quarantine directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-round-store-private-'));
  fs.mkdirSync(path.join(root, 'rounds'), { mode: 0o755 });
  fs.mkdirSync(path.join(root, 'quarantine'), { mode: 0o755 });
  new RoundStore({ root });
  assert.equal(fs.statSync(path.join(root, 'rounds')).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(root, 'quarantine')).mode & 0o777, 0o700);
});

test('injected mkdir failure preserves existing healthy snapshots for a later reload', () => {
  const { root, store } = fixture();
  const created = store.create({
    questions: [{ question: 'healthy?' }],
    capability: 'healthy-cap',
    retentionMs: 1000,
  });
  assert.equal(created.ok, true);
  const fsImpl = new Proxy(fs, {
    get(target, property) {
      if (property !== 'mkdirSync') return target[property];
      return () => {
        throw Object.assign(new Error('injected mkdir'), { code: 'EIO' });
      };
    },
  });
  assert.throws(() => new RoundStore({ root, fsImpl }), /injected mkdir/);
  const reloaded = new RoundStore({ root, now: () => 100 });
  assert.equal(reloaded.get(created.record.roundId).ok, true);
});

test('bad records are quarantined individually while healthy siblings remain', () => {
  const { root, store } = fixture();
  const created = store.create({
    questions: [{ question: 'Q?' }],
    capability: 'cap',
    retentionMs: 1000,
  });
  fs.writeFileSync(path.join(root, 'rounds', 'round_bad.json'), '{bad');
  const fresh = new RoundStore({ root, now: () => 100 });
  assert.equal(fresh.list().length, 1);
  assert.equal(fresh.get(created.record.roundId).ok, true);
  assert.ok(fs.readdirSync(path.join(root, 'quarantine')).length >= 1);
});

test('startup cleanup removes only expired records', () => {
  const { store } = fixture();
  const expired = store.create({
    questions: [{ question: 'old' }],
    capability: 'a',
    retentionMs: 1,
  });
  const fresh = store.create({
    questions: [{ question: 'new' }],
    capability: 'b',
    retentionMs: 1000,
  });
  const later = new RoundStore({ root: store.root, now: () => 102 });
  assert.equal(later.get(expired.record.roundId).ok, false);
  assert.equal(later.get(fresh.record.roundId).ok, true);
});

test('cleanup retains expired reconnecting snapshots for long-round recovery', () => {
  let now = 0;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-round-store-reconnecting-'));
  const store = new RoundStore({ root, now: () => now });
  let lifecycle = createRecord({ id: 1, capability: 'cap', now });
  lifecycle = transition(lifecycle, 'detach', { now }).record;
  lifecycle = transition(lifecycle, 'resume', { now }).record;
  const created = store.create({
    roundId: 'round_reconnecting_store',
    requestId: 'reconnecting-store',
    capability: 'cap',
    questions: [{ question: 'Q?' }],
    lifecycle,
    retentionMs: 100,
  });
  assert.equal(created.ok, true);

  now = 100;
  assert.deepEqual(store.cleanupExpired(), []);
  assert.equal(store.get(created.record.roundId).ok, true);
  assert.equal(store.recoverable()[0].roundId, created.record.roundId);
});
