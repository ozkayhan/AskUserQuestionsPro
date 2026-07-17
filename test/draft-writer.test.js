'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDraftWriter, readPendingDraft, readLatestPendingDraft, reconcileDraft } = require('../web/draft-writer.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('draft writer persists an edit before immediate unmount/reload and keeps revisions ordered', async () => {
  let revision = 0;
  let durable = null;
  const saves = [];
  const writer = createDraftWriter({
    save(draft, expectedRevision) {
      saves.push({ draft, expectedRevision });
      durable = draft;
      return Promise.resolve({ revision: expectedRevision + 1 });
    },
    getRevision: () => revision,
    setRevision: (next) => {
      revision = next;
    },
    roundKey: 'round:cap',
    storage: memoryStorage(),
  });

  const edit = { Q: { sel: [0], confirmed: true } };
  writer.write(edit); // material edit starts POST synchronously, before unmount
  assert.deepEqual(saves, [{ draft: edit, expectedRevision: 0 }]);
  await new Promise((resolve) => setImmediate(resolve));

  // A new Flow after reload receives the already durable browser draft.
  assert.deepEqual(durable, edit);
  assert.equal(revision, 1);
  writer.write({ Q: { sel: [1], confirmed: true } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    saves.map((entry) => entry.expectedRevision),
    [0, 1]
  );
});

test('draft writer replays an immediately aborted edit after reload and clears it only on acknowledgement', async () => {
  const storage = memoryStorage();
  const roundKey = 'round-9:capability-9';
  const edit = { Q: { sel: [0], confirmed: true } };
  let revision = 4;
  const aborted = createDraftWriter({
    save: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    getRevision: () => revision,
    setRevision: (next) => {
      revision = next;
    },
    roundKey,
    storage,
  });

  aborted.write(edit);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(readPendingDraft(roundKey, 4, storage), edit);

  const replayed = [];
  const reloaded = createDraftWriter({
    save: (draft, expectedRevision) => {
      replayed.push({ draft, expectedRevision });
      return Promise.resolve({ revision: expectedRevision + 1, replayed: false });
    },
    getRevision: () => revision,
    setRevision: (next) => {
      revision = next;
    },
    roundKey,
    storage,
  });
  reloaded.replay();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(replayed, [{ draft: edit, expectedRevision: 4 }]);
  assert.equal(revision, 5);
  assert.equal(readPendingDraft(roundKey, 4, storage), null);
});

test('draft writer re-keys a queued edit after an earlier save and replays it after transport rejection', async () => {
  const storage = memoryStorage();
  const roundKey = 'round-queued:capability-queued';
  const first = { Q: { sel: [0], confirmed: true } };
  const second = { Q: { sel: [1], confirmed: true } };
  let revision = 0;
  const saves = [];
  let resolveFirst;
  let rejectSecond;
  const writer = createDraftWriter({
    save(draft, expectedRevision) {
      saves.push({ draft, expectedRevision });
      if (saves.length === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise((_, reject) => {
        rejectSecond = reject;
      });
    },
    getRevision: () => revision,
    setRevision: (next) => {
      revision = next;
    },
    roundKey,
    storage,
  });

  writer.write(first);
  writer.write(second);
  resolveFirst({ revision: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(saves, [
    { draft: first, expectedRevision: 0 },
    { draft: second, expectedRevision: 1 },
  ]);
  rejectSecond(new DOMException('Aborted', 'AbortError'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(revision, 1);
  assert.equal(readPendingDraft(roundKey, 0, storage), null);
  assert.deepEqual(readPendingDraft(roundKey, 1, storage), second);

  const replayed = [];
  const reloaded = createDraftWriter({
    save(draft, expectedRevision) {
      replayed.push({ draft, expectedRevision });
      return Promise.resolve({ revision: expectedRevision + 1 });
    },
    getRevision: () => revision,
    setRevision: (next) => {
      revision = next;
    },
    roundKey,
    storage,
  });
  reloaded.replay();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(replayed, [{ draft: second, expectedRevision: 1 }]);
  assert.equal(revision, 2);
  assert.equal(readPendingDraft(roundKey, 1, storage), null);
});

test('draft reconciliation preserves both versions until explicit choice', () => {
  const result = reconcileDraft({ Q: { sel: [0] } }, { Q: { sel: [1] } }, 4, 3);
  assert.equal(result.state, 'conflict');
  assert.deepEqual(result.actions, ['keep-server', 'review-differences', 'discard-local-draft']);
  assert.deepEqual(result.serverDraft, { Q: { sel: [0] } });
  assert.deepEqual(result.localDraft, { Q: { sel: [1] } });
});

test('draft writer finds the newest local revision for conflict reconciliation', () => {
  const entries = new Map([
    ['askuserquestionspro:draft:r:1', JSON.stringify({ value: 'old' })],
    ['askuserquestionspro:draft:r:4', JSON.stringify({ value: 'new' })],
  ]);
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][index] || null; },
    getItem(key) { return entries.get(key) ?? null; },
  };
  const latest = readLatestPendingDraft('r', storage);
  assert.deepEqual(latest, { revision: 4, draft: { value: 'new' } });
});
