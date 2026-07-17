'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDraftWriter, readPendingDraft } = require('../web/draft-writer.js');

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
  assert.deepEqual(saves.map((entry) => entry.expectedRevision), [0, 1]);
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
