const test = require('node:test');
const assert = require('node:assert');
const { server, bridge } = require('../server/server.js');
const APP_ID = require('../lib/app-id.cjs');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { ok: true, app: APP_ID });
});

test('/ask soruları tutar, /answer ile resolve olur', async () => {
  const questions = [{ question: 'Q?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  // /ask açıkken /current bekleyen soruyu göstermeli
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.deepStrictEqual(cur.questions, questions);

  await fetch(`${base}/answer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Q?': 'A' } }),
  });

  const askResult = await (await askPromise).json();
  assert.deepStrictEqual(askResult.answers, { 'Q?': 'A' });
  assert.strictEqual(bridge.getCurrent(), null);
});

test('GET / index.html serve eder', async () => {
  const r = await fetch(`${base}/`);
  const body = await r.text();
  assert.match(body, /<div id="root">/);
});

test('/current ve /events payload {id, questions} icerir', async () => {
  const questions = [{ question: 'QID?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.ok(typeof cur.id === 'number', 'id alani olmali');
  assert.deepStrictEqual(cur.questions, questions);
  await fetch(`${base}/answer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'QID?': 'A' } }),
  });
  await askPromise;
});

test('/ask gecersiz questions (dizi degil) -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: 'oops' }),
  });
  assert.strictEqual(r.status, 400);
});

test('istemci /ask kopusunda SSE null push edilir (olu soru temizlenir)', async () => {
  // SSE dinle
  const sse = await fetch(`${base}/events`);
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  (async () => { while (true) { const { value, done } = await reader.read(); if (done) break;
    for (const l of dec.decode(value).split('\n')) if (l.startsWith('data:')) events.push(l.slice(5).trim()); } })();
  await new Promise((r) => setTimeout(r, 30));
  const ac = new AbortController();
  const askP = fetch(`${base}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ question: 'BYE?', options: [{ label: 'A' }], multiSelect: false }] }),
    signal: ac.signal }).catch(() => {});
  await new Promise((r) => setTimeout(r, 50));
  ac.abort();           // hook öldü
  await askP;
  await new Promise((r) => setTimeout(r, 80));
  const last = events[events.length - 1];
  assert.match(last, /"questions":null/, 'cancel sonrasi son SSE olayi null olmali');
  reader.cancel().catch(() => {});
});
