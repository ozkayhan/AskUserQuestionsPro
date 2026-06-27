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

test('requestTimeout devre dışı (uzun /ask beklemesi Node 5dk tavanına takılmaz)', () => {
  assert.strictEqual(server.requestTimeout, 0);
});

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { ok: true, app: APP_ID });
});

test('/ask soruları tutar, /answer ile resolve olur', async () => {
  const questions = [{ question: 'Q?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  // /ask açıkken /current bekleyen soruyu göstermeli
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.deepStrictEqual(cur.questions, questions);

  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.ok(typeof cur.id === 'number', 'id alani olmali');
  assert.deepStrictEqual(cur.questions, questions);
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'QID?': 'A' } }),
  });
  await askPromise;
});

test('/ask gecersiz questions (dizi degil) -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: 'oops' }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.ok(typeof j.error === 'string', '400 yaniti spesifik error icermeli');
});

// --- validQuestions yeni imza + per-type testleri ---

// validQuestions'ı server.js'den doğrudan test etmek için modülü tekrar require etmiyoruz;
// bunun yerine /ask endpoint'i üzerinden HTTP ile test ediyoruz.

test('/ask scale gecerli (min/max var) -> 200', async () => {
  const questions = [
    {
      question: 'Kac puan?',
      header: 'H',
      type: 'scale',
      min: 1,
      max: 10,
    },
  ];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Kac puan?': 7 } }),
  });
  const res = await askPromise;
  assert.strictEqual(res.status, 200);
});

test('/ask scale eksik min/max -> 400 spesifik hata', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ question: 'S?', header: 'H', type: 'scale', min: 1 }] }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /scale.*min.*max|min.*max.*scale/i, 'scale hatasi min/max icermeli');
});

test('/ask scale min >= max -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'S?', header: 'H', type: 'scale', min: 10, max: 1 }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /min.*max|max.*min/i);
});

test('/ask scale gecersiz step -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'S?', header: 'H', type: 'scale', min: 0, max: 10, step: -1 }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /step/i);
});

test('/ask ranking az seceneк (1 items) -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'R?', header: 'H', type: 'ranking', options: [{ label: 'A' }] }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /ranking.*2|2.*ranking/i);
});

test('/ask ranking gecerli (2+ secenek) -> 200', async () => {
  const questions = [
    {
      question: 'Sirala?',
      header: 'H',
      type: 'ranking',
      options: [{ label: 'A' }, { label: 'B' }],
    },
  ];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Sirala?': ['A', 'B'] } }),
  });
  const res = await askPromise;
  assert.strictEqual(res.status, 200);
});

test('/ask binary options tam 2 degil -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [
        {
          question: 'B?',
          header: 'H',
          type: 'binary',
          options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
        },
      ],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /binary.*2|2.*binary/i);
});

test('/ask binary options yok -> 200 (varsayilan)', async () => {
  const questions = [{ question: 'Evet mi?', header: 'H', type: 'binary' }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Evet mi?': 'Evet' } }),
  });
  const res = await askPromise;
  assert.strictEqual(res.status, 200);
});

test('/ask binary tam 2 option -> 200', async () => {
  const questions = [
    {
      question: 'Dogru mu?',
      header: 'H',
      type: 'binary',
      options: [{ label: 'Evet' }, { label: 'Hayir' }],
    },
  ];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Dogru mu?': 'Evet' } }),
  });
  const res = await askPromise;
  assert.strictEqual(res.status, 200);
});

test('/ask tree bos options -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'T?', header: 'H', type: 'tree', options: [] }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /tree/i);
});

test('/ask tree derinlik >6 -> 400', async () => {
  // 7 seviyeli ağaç oluştur
  function makeNode(depth) {
    if (depth <= 0) return { label: 'leaf' };
    return { label: `d${depth}`, children: [makeNode(depth - 1)] };
  }
  const deepOptions = [makeNode(7)];
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'Deep?', header: 'H', type: 'tree', options: deepOptions }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /depth|derinlik/i);
});

test('/ask tree gecerli (derinlik <=6) -> 200', async () => {
  const questions = [
    {
      question: 'Kategori?',
      header: 'H',
      type: 'tree',
      options: [{ label: 'A', children: [{ label: 'A1' }, { label: 'A2' }] }, { label: 'B' }],
    },
  ];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Kategori?': ['A', 'A1'] } }),
  });
  const res = await askPromise;
  assert.strictEqual(res.status, 200);
});

test('/ask gecersiz type string -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'X?', header: 'H', type: 'invalid_type', options: [{ label: 'A' }] }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /invalid type/i);
});

test('/ask single options bos -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'Q?', header: 'H', type: 'single', options: [] }],
    }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.ok(typeof j.error === 'string');
});

test('/ask multi options yok -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ question: 'M?', header: 'H', type: 'multi' }] }),
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.ok(typeof j.error === 'string');
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bozuk',
  });
  assert.strictEqual(r.status, 400);
});

test('POST /settings dizi/null -> 400', async () => {
  const r = await fetch(`${base}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '[1,2]',
  });
  assert.strictEqual(r.status, 400);
});

test('istemci /ask kopusunda SSE null push edilir (olu soru temizlenir)', async () => {
  // SSE dinle
  const sse = await fetch(`${base}/events`);
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const l of dec.decode(value).split('\n'))
        if (l.startsWith('data:')) events.push(l.slice(5).trim());
    }
  })();
  await new Promise((r) => setTimeout(r, 30));
  const ac = new AbortController();
  const askP = fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [{ question: 'BYE?', options: [{ label: 'A' }], multiSelect: false }],
    }),
    signal: ac.signal,
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 50));
  ac.abort(); // hook öldü
  await askP;
  await new Promise((r) => setTimeout(r, 80));
  const last = events[events.length - 1];
  assert.match(last, /"questions":null/, 'cancel sonrasi son SSE olayi null olmali');
  reader.cancel().catch(() => {});
});
