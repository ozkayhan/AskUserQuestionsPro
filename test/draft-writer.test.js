'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDraftWriter } = require('../web/draft-writer.js');

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
