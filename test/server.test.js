const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// settings disk I/O'yu izole tmp'ye yönlendir (gerçek ~/.config kirlenmesin).
// server require'ından ÖNCE set edilmeli — lib/settings DIR'i load anında okur.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-srv-'));
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

test('index.html window.__ASKUSER_SETTINGS__ inject eder', async () => {
  const body = await (await fetch(`${base}/`)).text();
  assert.match(body, /window\.__ASKUSER_SETTINGS__=/);
  const m = /window\.__ASKUSER_SETTINGS__=(\{.*?\})<\/script>/.exec(body);
  assert.ok(m, 'inject script bulunmali');
  const injected = JSON.parse(m[1]);
  assert.ok('theme' in injected && 'uiScale' in injected, 'settings degerleri');
});

test('POST /settings gecerli patch yazar', async () => {
  const r = await fetch(`${base}/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'paper' }),
  });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.ok, true);
  assert.strictEqual(j.settings.theme, 'paper');
  // disk'e yansidi mi → yeniden GET / inject paper gostermeli
  const body = await (await fetch(`${base}/`)).text();
  assert.match(body, /"theme":"paper"/);
});

test('POST /settings bad json -> 400', async () => {
  const r = await fetch(`${base}/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bozuk',
  });
  assert.strictEqual(r.status, 400);
});

test('POST /settings dizi/null -> 400', async () => {
  const r = await fetch(`${base}/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[1,2]',
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
