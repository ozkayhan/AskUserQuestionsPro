const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
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
test.after(async () => {
  // Node's global fetch pool can keep idle/SSE sockets alive after the assertions
  // finish. Force those test-only connections closed so the test worker exits.
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
  fs.rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
});

// --- yardımcılar ---

function post(url, obj, opts = {}) {
  if (
    (url === '/answer' || url === '/cancel') &&
    obj &&
    typeof obj === 'object' &&
    obj.id != null
  ) {
    obj = {
      ...obj,
      capability: obj.capability || bridge.peek()?.capability || 'missing-capability',
    };
  }
  return fetch(`${base}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
    ...opts,
  });
}

// /ask in-flight kaydını sleep yerine POLL ile bekle (deterministik; yüklü CI'da
// da güvenli). non-null questions görene dek dış deadline içinde döner.
async function waitForPending(deadlineMs = 2000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const cur = await (await fetch(`${base}/current`)).json();
    if (cur && cur.questions) return cur;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('timed out waiting for pending question set');
}

// pending'in temizlendiğini (questions:null) POLL ile bekle.
async function waitForClear(deadlineMs = 2000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const cur = await (await fetch(`${base}/current`)).json();
    if (!cur || !cur.questions) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('timed out waiting for pending to clear');
}

async function waitForLifecycle(state, deadlineMs = 2000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const current = await (await fetch(`${base}/current`)).json();
    if (current.lifecycle?.state === state) return current;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`timed out waiting for lifecycle state ${state}`);
}

async function waitForCondition(predicate, deadlineMs = 2000) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timed out waiting for condition');
}

// /ask aç → pending'i bekle → id ile cevapla → askPromise'i çöz. answer plain object'tir
// (Contract R). Döner: askPromise json.
async function askAndAnswer(questions, answers) {
  const askPromise = post('/ask', { questions });
  const cur = await waitForPending();
  const r = await post('/answer', { id: cur.id, answers });
  assert.strictEqual(r.status, 200);
  return (await askPromise).json();
}

test('requestTimeout devre dışı (uzun /ask beklemesi Node 5dk tavanına takılmaz)', () => {
  assert.strictEqual(server.requestTimeout, 0);
});

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { ok: true, app: APP_ID });
});

test('/ask soruları tutar, /answer ile resolve olur (id round-trip)', async () => {
  const questions = [{ question: 'Q?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = post('/ask', { questions });
  const cur = await waitForPending();
  assert.deepStrictEqual(cur.questions, questions);
  assert.ok(typeof cur.id === 'number');

  const r = await post('/answer', { id: cur.id, answers: { 'Q?': 'A' } });
  assert.strictEqual(r.status, 200);

  const askResult = await (await askPromise).json();
  assert.deepStrictEqual(askResult.answers, { 'Q?': 'A' });
  assert.strictEqual(bridge.getCurrent(), null);
});

test('real server lifecycle diagnostics attribute Bridge events without question or answer payloads', async () => {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve()))
  );

  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-lifecycle-'));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: configHome },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const diagnostics = [];
  let stderr = '';
  let stderrBuffer = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
    stderrBuffer += chunk;
    let newline;
    while ((newline = stderrBuffer.indexOf('\n')) >= 0) {
      const line = stderrBuffer.slice(0, newline);
      stderrBuffer = stderrBuffer.slice(newline + 1);
      const match = line.match(/^\[askuser:lifecycle\] (.+)$/);
      if (match) diagnostics.push(JSON.parse(match[1]));
    }
  });

  try {
    const childBase = `http://127.0.0.1:${port}`;
    await waitForCondition(async () => {
      try {
        return (await fetch(`${childBase}/health`)).ok;
      } catch {
        return false;
      }
    });

    const ask = fetch(`${childBase}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'opaque-request',
        questions: [{ question: 'secret question', options: [{ label: 'A' }] }],
      }),
    });
    let current;
    await waitForCondition(async () => {
      current = await (await fetch(`${childBase}/current?requestId=opaque-request`)).json();
      return current.id != null;
    });
    const answer = await fetch(`${childBase}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: current.id,
        capability: current.capability,
        answers: { 'secret question': 'secret answer' },
      }),
    });
    assert.equal(answer.status, 200);
    assert.equal((await ask).status, 200);
    await waitForCondition(() => diagnostics.some((entry) => entry.event === 'round_finished'));

    const operational = Object.fromEntries(
      diagnostics
        .filter((entry) => ['answer_received', 'round_finished'].includes(entry.event))
        .map((entry) => [
          entry.event,
          { boundary: entry.boundary, deadlineOwner: entry.deadlineOwner },
        ])
    );
    assert.deepEqual(operational, {
      answer_received: { boundary: 'browser', deadlineOwner: 'browser' },
      round_finished: { boundary: 'bridge', deadlineOwner: 'none' },
    });
    assert.doesNotMatch(stderr, /secret question|secret answer/);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    fs.rmSync(configHome, { recursive: true, force: true });
  }
});

test('GET / index.html serve eder', async () => {
  const r = await fetch(`${base}/`);
  const body = await r.text();
  assert.match(body, /<div id="root">/);
});

test('/current ve /events payload {id, questions} icerir', async () => {
  const questions = [{ question: 'QID?', options: [{ label: 'A' }], multiSelect: false }];
  await askAndAnswer(questions, { 'QID?': 'A' });
});

test('/current requestId ile yalnizca ilgili pending turunu gosterir', async () => {
  const requestId = 'request-owner-a';
  const questions = [{ question: 'OWNER?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = post('/ask', { questions, requestId });
  const cur = await waitForPending();

  const unrelated = await fetch(`${base}/current?requestId=request-owner-b`);
  assert.deepStrictEqual(await unrelated.json(), {
    id: null,
    questions: null,
    lifecycle: bridge.getSnapshot(),
  });
  const owned = await fetch(`${base}/current?requestId=${requestId}`);
  assert.deepStrictEqual(await owned.json(), cur);

  await post('/answer', { id: cur.id, answers: { 'OWNER?': 'A' } });
  await askPromise;
});

test('requestId li /ask host soketi kapaninca round korunur ve /resume cevap verir', async () => {
  const requestId = 'resume-owner-a';
  const questions = [{ question: 'RESUME?', options: [{ label: 'A' }] }];
  const request = http.request(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  request.on('error', () => {});
  request.write(JSON.stringify({ questions, requestId }));
  request.end();

  const current = await waitForPending();
  request.destroy();
  await waitForLifecycle('detached');

  const retained = await fetch(`${base}/current?requestId=${requestId}`);
  const retainedRound = await retained.json();
  assert.equal(retainedRound.id, current.id);
  assert.equal(retainedRound.lifecycle.state, 'detached');

  const resumed = post('/resume', {});
  await post('/answer', { id: current.id, answers: { 'RESUME?': 'A' } });
  const resumeResponse = await resumed;
  assert.strictEqual(resumeResponse.status, 200);
  assert.deepStrictEqual(await resumeResponse.json(), { answers: { 'RESUME?': 'A' } });
});

test('detached round correct capability ile resume öncesi cevap kabul eder ve sonra recover edilir', async () => {
  const requestId = 'answer-before-resume';
  const request = http.request(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  request.on('error', () => {});
  request.end(
    JSON.stringify({ requestId, questions: [{ question: 'DETACHED?', options: [{ label: 'A' }] }] })
  );
  const current = await waitForPending();
  request.destroy();
  await waitForLifecycle('detached');

  const answer = await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'DETACHED?': 'A' },
  });
  assert.equal(answer.status, 200);
  await waitForLifecycle('delivery-uncertain');

  const resumed = await post('/resume', { requestId });
  assert.equal(resumed.status, 200);
  assert.deepEqual(await resumed.json(), { answers: { 'DETACHED?': 'A' } });
  await waitForClear();
});

test('closed /resume response remains delivery-uncertain and later resume recovers answers', async () => {
  const requestId = 'closed-resume-response';
  const ask = http.request(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  ask.on('error', () => {});
  ask.end(
    JSON.stringify({ requestId, questions: [{ question: 'RECOVER?', options: [{ label: 'A' }] }] })
  );
  const current = await waitForPending();
  ask.destroy();
  await waitForLifecycle('detached');

  const resume = http.request(`${base}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  resume.on('error', () => {});
  resume.end(JSON.stringify({ requestId }));
  await waitForLifecycle('reconnecting');
  resume.destroy();
  await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'RECOVER?': 'A' },
  });
  const uncertain = await waitForLifecycle('delivery-uncertain');
  assert.equal(uncertain.lifecycle.state, 'delivery-uncertain');

  const recovered = await post('/resume', { requestId });
  assert.equal(recovered.status, 200);
  assert.deepEqual(await recovered.json(), { answers: { 'RECOVER?': 'A' } });
  await waitForClear();
});

// --- Contract R: /answer round-id rendezvous ---

test('/answer stale id -> 409 (cross-round race korumasi)', async () => {
  const questions = [{ question: 'ST?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = post('/ask', { questions });
  const cur = await waitForPending();
  // Mevcut id'den farklı (stale) bir id ile cevapla → eşleşmez → 409.
  const stale = await post('/answer', { id: cur.id + 999, answers: { 'ST?': 'A' } });
  assert.strictEqual(stale.status, 409);
  // pending hâlâ açık; doğru id ile çöz, sızıntı bırakma.
  const ok = await post('/answer', { id: cur.id, answers: { 'ST?': 'A' } });
  assert.strictEqual(ok.status, 200);
  await askPromise;
});

test('/answer missing or wrong capability -> 409 ownership_conflict and round remains pending', async () => {
  const askPromise = post('/ask', { questions: [{ question: 'CAP?', options: [{ label: 'A' }] }] });
  const current = await waitForPending();
  const missing = await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: current.id, answers: { 'CAP?': 'A' } }),
  });
  assert.equal(missing.status, 409);
  assert.equal((await missing.json()).reason, 'ownership_conflict');
  const wrong = await post('/answer', {
    id: current.id,
    capability: 'wrong-capability',
    answers: { 'CAP?': 'A' },
  });
  assert.equal(wrong.status, 409);
  assert.equal((await wrong.json()).reason, 'ownership_conflict');
  assert.equal((await waitForPending()).id, current.id);
  await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'CAP?': 'A' },
  });
  await askPromise;
});

test('/answer pending yokken -> 409', async () => {
  await waitForClear();
  const r = await post('/answer', { id: 1, answers: { 'Q?': 'A' } });
  assert.strictEqual(r.status, 409);
});

test('/cancel correct round id ile typed user_cancelled sonucu döner', async () => {
  const askPromise = post('/ask', {
    questions: [{ question: 'CANCEL?', options: [{ label: 'A' }] }],
  });
  const current = await waitForPending();
  const cancel = await post('/cancel', { id: current.id, reason: 'user cancelled' });
  assert.strictEqual(cancel.status, 200);
  assert.deepStrictEqual(await cancel.json(), { ok: true, reason: 'user_cancelled' });

  const askResponse = await askPromise;
  assert.strictEqual(askResponse.status, 409);
  assert.strictEqual((await askResponse.json()).reason, 'user_cancelled');
  await waitForClear();
});

test('/cancel stale id -> 409 ve active round korunur', async () => {
  const askPromise = post('/ask', {
    questions: [{ question: 'KEEP?', options: [{ label: 'A' }] }],
  });
  const current = await waitForPending();
  const stale = await post('/cancel', { id: current.id + 999, reason: 'user cancelled' });
  assert.strictEqual(stale.status, 409);
  assert.strictEqual((await stale.json()).reason, 'ownership_conflict');
  assert.strictEqual((await (await fetch(`${base}/current`)).json()).id, current.id);
  await post('/answer', { id: current.id, answers: { 'KEEP?': 'A' } });
  await askPromise;
});

test('/cancel unknown reason -> 400 ve active round korunur', async () => {
  const askPromise = post('/ask', {
    questions: [{ question: 'REASON?', options: [{ label: 'A' }] }],
  });
  const current = await waitForPending();
  const bad = await post('/cancel', { id: current.id, reason: 'not-a-terminal-state' });
  assert.strictEqual(bad.status, 400);
  assert.match((await bad.json()).error, /cancel reason/i);
  await post('/answer', { id: current.id, answers: { 'REASON?': 'A' } });
  await askPromise;
});

test('/answer answers Array -> 400 (Contract R)', async () => {
  const questions = [{ question: 'AR?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = post('/ask', { questions });
  const cur = await waitForPending();
  const bad = await post('/answer', { id: cur.id, answers: ['A'] });
  assert.strictEqual(bad.status, 400);
  // pending hâlâ açık → doğru şekilde kapat.
  await post('/answer', { id: cur.id, answers: { 'AR?': 'A' } });
  await askPromise;
});

test('/answer bad json -> 400', async () => {
  const r = await post('/answer', '{bozuk');
  assert.strictEqual(r.status, 400);
});

test('iki es zamanli /ask: ikincisi 409 (concurrent pending)', async () => {
  const q1 = [{ question: 'C1?', options: [{ label: 'A' }], multiSelect: false }];
  const q2 = [{ question: 'C2?', options: [{ label: 'B' }], multiSelect: false }];
  const askP1 = post('/ask', { questions: q1 });
  const cur = await waitForPending();
  // pending varken ikinci /ask → 409.
  const r2 = await post('/ask', { questions: q2 });
  assert.strictEqual(r2.status, 409);
  // ilk turu temizle.
  await post('/answer', { id: cur.id, answers: { 'C1?': 'A' } });
  await askP1;
});

test('/ask gecersiz questions (dizi degil) -> 400', async () => {
  const r = await post('/ask', { questions: 'oops' });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.ok(typeof j.error === 'string', '400 yaniti spesifik error icermeli');
});

test('/ask bos questions array -> 400 (non-empty)', async () => {
  const r = await post('/ask', { questions: [] });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /non-empty|empty/i);
});

// --- validQuestions fuzz / sınır testleri ---

test('/ask question bos string -> 400', async () => {
  const r = await post('/ask', { questions: [{ question: '', options: [{ label: 'A' }] }] });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /1 and 1000|between/i);
});

test('/ask question >1000 char -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'x'.repeat(1001), options: [{ label: 'A' }] }],
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /1000|between/i);
});

test('/ask option label >500 char -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'Q?', options: [{ label: 'y'.repeat(501) }] }],
  });
  assert.strictEqual(r.status, 400);
  const j = await r.json();
  assert.match(j.error, /label.*500|500.*label/i);
});

test('/ask scale gecerli (min/max var) -> 200', async () => {
  await askAndAnswer([{ question: 'Kac puan?', header: 'H', type: 'scale', min: 1, max: 10 }], {
    'Kac puan?': 7,
  });
});

test('/ask scale eksik min/max -> 400 spesifik hata', async () => {
  const r = await post('/ask', { questions: [{ question: 'S?', type: 'scale', min: 1 }] });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /scale.*min.*max|min.*max.*scale/i);
});

test('/ask scale min >= max -> 400', async () => {
  const r = await post('/ask', { questions: [{ question: 'S?', type: 'scale', min: 10, max: 1 }] });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /min.*max|max.*min/i);
});

test('/ask scale gecersiz step -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'S?', type: 'scale', min: 0, max: 10, step: -1 }],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /step/i);
});

test('/ask ranking az secenek (1 item) -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'R?', type: 'ranking', options: [{ label: 'A' }] }],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /ranking.*2|2.*ranking/i);
});

test('/ask ranking gecerli (2+ secenek) -> 200', async () => {
  await askAndAnswer(
    [{ question: 'Sirala?', type: 'ranking', options: [{ label: 'A' }, { label: 'B' }] }],
    { 'Sirala?': ['A', 'B'] }
  );
});

test('/ask binary options tam 2 degil -> 400', async () => {
  const r = await post('/ask', {
    questions: [
      {
        question: 'B?',
        type: 'binary',
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      },
    ],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /binary.*2|2.*binary/i);
});

test('/ask binary options yok -> 200 (varsayilan)', async () => {
  await askAndAnswer([{ question: 'Evet mi?', type: 'binary' }], { 'Evet mi?': 'Evet' });
});

test('/ask binary tam 2 option -> 200', async () => {
  await askAndAnswer(
    [{ question: 'Dogru mu?', type: 'binary', options: [{ label: 'Evet' }, { label: 'Hayir' }] }],
    { 'Dogru mu?': 'Evet' }
  );
});

test('/ask tree bos options -> 400', async () => {
  const r = await post('/ask', { questions: [{ question: 'T?', type: 'tree', options: [] }] });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /tree/i);
});

test('/ask tree derinlik >6 -> 400', async () => {
  function makeNode(depth) {
    if (depth <= 0) return { label: 'leaf' };
    return { label: `d${depth}`, children: [makeNode(depth - 1)] };
  }
  const r = await post('/ask', {
    questions: [{ question: 'Deep?', type: 'tree', options: [makeNode(7)] }],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /depth|derinlik/i);
});

test('/ask tree children non-array -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'T?', type: 'tree', options: [{ label: 'A', children: 'bad' }] }],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /children.*array|array.*children/i);
});

test('/ask tree nested label string-disi -> 400 (recursive label check)', async () => {
  const r = await post('/ask', {
    questions: [
      { question: 'T?', type: 'tree', options: [{ label: 'A', children: [{ label: 12345 }] }] },
    ],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /label/i);
});

test('/ask tree nested label bos -> 400', async () => {
  const r = await post('/ask', {
    questions: [
      { question: 'T?', type: 'tree', options: [{ label: 'A', children: [{ label: '' }] }] },
    ],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /label/i);
});

test('/ask tree gecerli (derinlik <=6) -> 200', async () => {
  await askAndAnswer(
    [
      {
        question: 'Kategori?',
        type: 'tree',
        options: [{ label: 'A', children: [{ label: 'A1' }, { label: 'A2' }] }, { label: 'B' }],
      },
    ],
    { 'Kategori?': ['A', 'A1'] }
  );
});

test('/ask gecersiz type string -> 400', async () => {
  const r = await post('/ask', {
    questions: [{ question: 'X?', type: 'invalid_type', options: [{ label: 'A' }] }],
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /invalid type/i);
});

test('/ask single options bos -> 400', async () => {
  const r = await post('/ask', { questions: [{ question: 'Q?', type: 'single', options: [] }] });
  assert.strictEqual(r.status, 400);
  assert.ok(typeof (await r.json()).error === 'string');
});

test('/ask multi options yok -> 400', async () => {
  const r = await post('/ask', { questions: [{ question: 'M?', type: 'multi' }] });
  assert.strictEqual(r.status, 400);
  assert.ok(typeof (await r.json()).error === 'string');
});

// --- readBody sınır / hang guard ---

test('readBody >8MB body -> 4xx ve hang yok', async () => {
  const big = 'x'.repeat(8.2e6);
  const r = await post('/ask', `{"questions":"${big}"}`).catch((e) => e);
  // Sunucu ya 400 döner (json parse / read error) ya da bağlantıyı düşürür (fetch reject).
  // Önemli olan: süreç asılı kalmaz; promise settle olur.
  if (r instanceof Error) {
    assert.ok(r, 'baglanti drop edildi (hang yok)');
  } else {
    assert.ok(r.status >= 400 && r.status < 600, `4xx/5xx beklenir, gelen ${r.status}`);
  }
  // Sunucu hâlâ canlı mı? sonraki istek çalışmalı.
  const h = await fetch(`${base}/health`);
  assert.strictEqual(h.status, 200);
});

// --- serveStatic path traversal ---

test('serveStatic path traversal -> 403', async () => {
  // normalize sonrası WEB_DIR dışına çıkan yol reddedilir.
  const r = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.ok(r.status === 403 || r.status === 404, `403/404 beklenir, gelen ${r.status}`);
});

test('serveStatic ETag/304 revalidation', async () => {
  const r1 = await fetch(`${base}/app.js`);
  if (r1.status !== 200) return; // ponytail: asset yoksa atla (env'e bağlı).
  const etag = r1.headers.get('etag');
  assert.ok(etag, 'asset ETag tasimali');
  const r2 = await fetch(`${base}/app.js`, { headers: { 'If-None-Match': etag } });
  assert.strictEqual(r2.status, 304);
});

test('index.html window.__ASKUSER_SETTINGS__ inject eder', async () => {
  const body = await (await fetch(`${base}/`)).text();
  assert.match(body, /window\.__ASKUSER_SETTINGS__=/);
  const m = /window\.__ASKUSER_SETTINGS__=(\{.*?\})<\/script>/.exec(body);
  assert.ok(m, 'inject script bulunmali');
  const injected = JSON.parse(m[1]);
  assert.ok('theme' in injected && 'uiScale' in injected, 'settings degerleri');
  assert.ok(!('_v' in injected), '_v disk formati tarayiciya sizmamali');
});

test('POST /settings gecerli patch yazar (Contract W -> 200)', async () => {
  const r = await post('/settings', { theme: 'paper' });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.ok, true);
  assert.strictEqual(j.settings.theme, 'paper');
  assert.ok(!('_v' in j.settings), '_v sizmamali');
  // disk + cache'e yansidi mi → yeniden GET / inject paper gostermeli
  const body = await (await fetch(`${base}/`)).text();
  assert.match(body, /"theme":"paper"/);
});

test('POST /settings bad json -> 400', async () => {
  const r = await post('/settings', '{bozuk');
  assert.strictEqual(r.status, 400);
});

test('POST /settings dizi/null -> 400', async () => {
  const r = await post('/settings', '[1,2]');
  assert.strictEqual(r.status, 400);
});

test('istemci /ask kopusunda SSE null push edilir (olu soru temizlenir) — poll, sleep degil', async () => {
  const sse = await fetch(`${base}/events`);
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  let nullSeen = false;
  (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const l of dec.decode(value).split('\n')) {
        if (l.startsWith('data:')) {
          const v = l.slice(5).trim();
          events.push(v);
          if (/"questions":null/.test(v)) nullSeen = true;
        }
      }
    }
  })();

  const payload = JSON.stringify({
    questions: [{ question: 'BYE?', options: [{ label: 'A' }], multiSelect: false }],
  });
  const target = new URL('/ask', base);
  const askReq = http.request({
    hostname: target.hostname,
    port: target.port,
    path: target.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  });
  askReq.on('error', () => {});
  askReq.end(payload);
  await waitForPending();
  askReq.destroy(); // hook öldü; gerçek TCP kopuşu üret

  // SSE null event'i sabit-uyku yerine POLL ile bekle (yüklü CI'da false-negatif yok).
  const end = Date.now() + 2000;
  while (!nullSeen && Date.now() < end) await new Promise((r) => setTimeout(r, 5));
  assert.ok(nullSeen, 'cancel sonrasi questions:null SSE olayi gelmeli');
  await reader.cancel();
});
