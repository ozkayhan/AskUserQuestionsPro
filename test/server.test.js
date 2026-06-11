const test = require('node:test');
const assert = require('node:assert');
const { server, bridge } = require('../server/server.js');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { ok: true });
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
