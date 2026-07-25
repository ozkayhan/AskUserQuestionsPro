'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { MAX_BODY, readBody, sendJson, sendJsonAndObserve } = require('../server/http-io.cjs');

function response() {
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  res.writeHead = (status, headers) => {
    res.status = status;
    res.headers = headers;
  };
  res.body = () => Buffer.concat(chunks).toString('utf8');
  return res;
}

test('readBody decodes UTF-8 and rejects a body above the 8 MB limit', async () => {
  assert.equal(
    await readBody(Readable.from([Buffer.from('merhaba')], { objectMode: false })),
    'merhaba'
  );

  await assert.rejects(
    readBody(Readable.from([Buffer.alloc(MAX_BODY + 1)], { objectMode: false })),
    /request body too large/
  );
});

test('sendJson writes the established JSON response contract', async () => {
  const res = response();
  const finished = new Promise((resolve) => res.once('finish', resolve));

  sendJson(res, 201, { ok: true });
  await finished;

  assert.equal(res.status, 201);
  assert.deepEqual(res.headers, { 'Content-Type': 'application/json' });
  assert.equal(res.body(), '{"ok":true}');
});

test('sendJsonAndObserve reports finished responses and already closed streams', async () => {
  const delivered = response();
  assert.equal(await sendJsonAndObserve(delivered, 200, { answers: {} }), true);
  assert.equal(delivered.body(), '{"answers":{}}');

  const closed = response();
  closed.destroy();
  assert.equal(await sendJsonAndObserve(closed, 200, { answers: {} }), false);
});
