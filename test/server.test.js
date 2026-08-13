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
const { BRIDGE_PROTOCOL_VERSION, packageVersion } = require('../lib/bridge-protocol.cjs');
const Record = require('../lib/round-record.cjs');
const { createRecord, transition } = require('../lib/round-state.cjs');
const { RoundStore } = require('../lib/round-store.cjs');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  assert.equal(server.address().address, '127.0.0.1');
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

let seededRoundSequence = 100;
function seedHttpDurable({
  roundId,
  requestId,
  state = 'drafting',
  answers = null,
  retentionMs = 60000,
}) {
  const now = Date.now();
  let lifecycle = createRecord({
    id: seededRoundSequence++,
    capability: `${roundId}-capability`,
    now,
  });
  if (state === 'detached') {
    lifecycle = transition(lifecycle, 'detach', {
      now,
      deadlineOwner: 'host',
      reason: 'host_disconnect',
    }).record;
  }
  const created = bridge._store.create({
    roundId,
    requestId,
    capability: `${roundId}-private-capability`,
    questions: [{ question: `${roundId}-private-question` }],
    lifecycle,
    retentionMs,
  });
  assert.equal(created.ok, true);
  if (answers) {
    const finalized = bridge._store.mutate(roundId, (record, at) =>
      Record.finalize(record, answers, record.revision, at)
    );
    assert.equal(finalized.ok, true);
    const delivered = bridge._store.mutate(roundId, (record, at) =>
      Record.transition(record, 'delivered', record.revision, at)
    );
    assert.equal(delivered.ok, true);
  }
  return created.record;
}

test('requestTimeout devre dışı (uzun /ask beklemesi Node 5dk tavanına takılmaz)', () => {
  assert.strictEqual(server.requestTimeout, 0);
});

test('delivery.mode confirm retires a successfully delivered host response', async () => {
  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-confirm-'));
  const settingsDir = path.join(configHome, 'askuserquestionspro');
  fs.mkdirSync(settingsDir, { recursive: true });
  const settings = require('../web/settings-schema.js').envelopeDefaults();
  settings.delivery.mode = 'confirm';
  fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify(settings));
  const port = 4600 + (process.pid % 1000);
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: configHome },
    stdio: 'ignore',
  });
  const childBase = `http://127.0.0.1:${port}`;
  try {
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
        requestId: 'confirm-delivery',
        questions: [{ question: 'CONFIRM?', options: [{ label: 'A' }] }],
      }),
    });
    let current;
    await waitForCondition(async () => {
      try {
        current = await (await fetch(`${childBase}/current`)).json();
        return !!current.questions;
      } catch {
        return false;
      }
    });
    await fetch(`${childBase}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: current.id,
        capability: current.capability,
        answers: { 'CONFIRM?': 'A' },
      }),
    });
    assert.deepEqual((await (await ask).json()).answers, { 'CONFIRM?': 'A' });
    await waitForCondition(async () => {
      const rounds = (await (await fetch(`${childBase}/rounds`)).json()).rounds;
      return rounds.length === 0;
    });
    assert.equal((await (await fetch(`${childBase}/current`)).json()).questions, null);
  } finally {
    child.kill();
    fs.rmSync(configHome, { recursive: true, force: true });
  }
});

test('durable discovery is redacted and result acknowledgement is idempotent', async () => {
  const ask = post('/ask', {
    questions: [{ question: 'DURABLE?', options: [{ label: 'A' }] }],
    requestId: 'durable-http',
  });
  const current = await waitForPending();
  const listed = await (await fetch(`${base}/rounds`)).json();
  const item = listed.rounds.find((round) => round.roundId === current.roundId);
  assert.ok(item);
  assert.equal(JSON.stringify(item).includes('DURABLE?'), false);
  const before = await post(`/rounds/${current.roundId}/result`, {
    capability: current.capability,
  });
  assert.equal(before.status, 409);
  await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'DURABLE?': 'A' },
  });
  await ask;
  const result = await post(`/rounds/${current.roundId}/result`, {
    capability: current.capability,
  });
  assert.deepEqual((await result.json()).answers, { 'DURABLE?': 'A' });
  const first = await (
    await post(`/rounds/${current.roundId}/ack`, { capability: current.capability })
  ).json();
  const replay = await (
    await post(`/rounds/${current.roundId}/ack`, { capability: current.capability })
  ).json();
  assert.deepEqual(replay, first);
});

test('recovery discovery retains uncertain delivery but excludes delivered records', async () => {
  const request = http.request(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  request.on('error', () => {});
  request.end(
    JSON.stringify({
      requestId: 'uncertain-http',
      questions: [{ question: 'UNCERTAIN?', options: [{ label: 'A' }] }],
    })
  );
  const current = await waitForPending();
  request.destroy();
  await waitForLifecycle('detached');
  await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'UNCERTAIN?': 'A' },
  });
  await waitForLifecycle('delivery-uncertain');

  const rounds = (await (await fetch(`${base}/rounds`)).json()).rounds;
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].roundId, current.roundId);
  assert.equal(rounds[0].state, 'delivery-uncertain');
  assert.doesNotMatch(JSON.stringify(rounds[0]), /UNCERTAIN\?|secret|capability|answer/);

  const acknowledgement = await post(`/rounds/${current.roundId}/ack`, {
    capability: current.capability,
  });
  assert.equal(acknowledgement.status, 200);
  assert.deepEqual((await (await fetch(`${base}/rounds`)).json()).rounds, []);
});

test('exact durable deletion clears the selected owner, current snapshot, and SSE state', async () => {
  const requestId = 'delete-http';
  const request = http.request(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  request.on('error', () => {});
  request.end(
    JSON.stringify({
      requestId,
      questions: [{ question: 'DELETE?', options: [{ label: 'A' }] }],
    })
  );
  const current = await waitForPending();
  request.destroy();
  await waitForLifecycle('detached');

  const listed = (await (await fetch(`${base}/rounds`)).json()).rounds;
  assert.deepEqual(
    listed.map((round) => round.roundId),
    [current.roundId]
  );
  assert.doesNotMatch(JSON.stringify(listed), /DELETE\?|capability|answer/);

  const sse = await fetch(`${base}/events`);
  const reader = sse.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data:')) events.push(JSON.parse(line.slice(5).trim()));
        }
      }
    } catch {
      // The test deliberately closes the SSE stream after observing deletion.
    }
  })();
  await waitForCondition(() => events.length > 0);
  assert.equal(events.at(-1).id, current.id);

  const deleted = await post(`/rounds/${current.roundId}/delete`, {
    capability: 'must-not-be-read',
    answers: { private: 'must-not-be-read' },
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true });
  await waitForCondition(() =>
    events.some((event) => event.id === null && event.questions === null)
  );
  assert.deepEqual((await (await fetch(`${base}/rounds`)).json()).rounds, []);
  assert.deepEqual(await (await fetch(`${base}/current`)).json(), {
    id: null,
    questions: null,
    lifecycle: null,
  });
  await reader.cancel();

  const malformed = await post('/rounds/not-a-round/delete', {});
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).reason, 'invalid_selector');
  const missing = await post('/rounds/round_missingxxxxxxxxx/delete', {});
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).reason, 'not_found');

  const unrelated = seedHttpDurable({
    roundId: 'round_httpunrelatedxxx',
    requestId: 'unrelated-http',
    state: 'detached',
  });
  const selected = seedHttpDurable({
    roundId: 'round_httpselectedxxxx',
    requestId: 'selected-http',
  });
  const delivered = seedHttpDurable({
    roundId: 'round_httpdeliveredxxx',
    requestId: 'delivered-http',
    answers: { private: 'answer' },
  });
  const expired = seedHttpDurable({
    roundId: 'round_httpexpiredxxxxxx',
    requestId: 'expired-http',
    retentionMs: 1,
  });
  const deliveredDelete = await post(`/rounds/${delivered.roundId}/delete`, {});
  assert.equal(deliveredDelete.status, 409);
  assert.equal((await deliveredDelete.json()).reason, 'stale_round');
  await waitForCondition(() => Date.now() >= expired.expiresAt);
  const expiredDelete = await post(`/rounds/${expired.roundId}/delete`, {});
  assert.equal(expiredDelete.status, 410);
  assert.equal((await expiredDelete.json()).reason, 'expired');
  const selectedDelete = await post(`/rounds/${selected.roundId}/delete`, {});
  assert.equal(selectedDelete.status, 200);
  assert.deepEqual(
    (await (await fetch(`${base}/rounds`)).json()).rounds.map((round) => round.roundId),
    [unrelated.roundId]
  );
});

test('/draft persists capability/revision guarded browser state and rejects a stale edit', async () => {
  const ask = post('/ask', {
    requestId: 'draft-http',
    questions: [{ question: 'DRAFT?', options: [{ label: 'A' }] }],
  });
  const current = await waitForPending();
  const draft = { 'DRAFT?': { sel: [0], confirmed: true } };
  const first = await post('/draft', {
    id: current.id,
    capability: current.capability,
    revision: current.revision,
    answers: draft,
  });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    ok: true,
    revision: current.revision + 1,
    replayed: false,
  });
  const replay = await post('/draft', {
    id: current.id,
    capability: current.capability,
    revision: current.revision,
    answers: draft,
  });
  assert.equal((await replay.json()).replayed, true);
  const stale = await post('/draft', {
    id: current.id,
    capability: current.capability,
    revision: current.revision,
    answers: { 'DRAFT?': { sel: [1] } },
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).reason, 'stale_revision');
  await post('/answer', {
    id: current.id,
    capability: current.capability,
    answers: { 'DRAFT?': 'A' },
  });
  await ask;
});

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), {
    ok: true,
    app: APP_ID,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    packageVersion,
  });
});

test('/ask soruları tutar, /answer ile resolve olur (id round-trip)', async () => {
  const questions = [{ question: 'Q?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = post('/ask', { questions });
  const cur = await waitForPending();
  assert.deepStrictEqual(cur.questions, [{ ...questions[0], header: 'General' }]);
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

    assert.ok(diagnostics.length > 0, 'real server should emit lifecycle diagnostics');
    assert.ok(
      diagnostics.every(
        (entry) => typeof entry.boundary === 'string' && typeof entry.deadlineOwner === 'string'
      ),
      'every emitted operational lifecycle record must identify its boundary and deadline owner'
    );

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

test('real server restart hydrates a detached draft for /current and exact /resume', async () => {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve()))
  );
  const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-restart-'));
  const store = new RoundStore({ root: path.join(configHome, 'askuserquestionspro') });
  const capability = 'restart-capability';
  const lifecycle = transition(createRecord({ id: 41, capability, now: Date.now() }), 'detach', {
    now: Date.now(),
    deadlineOwner: 'host',
    reason: 'host_disconnect',
  }).record;
  const created = store.create({
    questions: [{ question: 'RESTART?', options: [{ label: 'A' }] }],
    requestId: 'restart-http',
    capability,
    lifecycle,
    retentionMs: 60 * 1000,
  });
  const drafted = store.mutate(created.record.roundId, (record, now) =>
    Record.saveDraft(record, { 'RESTART?': { sel: [0], confirmed: true } }, record.revision, now)
  );
  assert.equal(drafted.ok, true);
  const childPath = path.join(__dirname, '..', 'server', 'server.js');
  const start = () =>
    spawn(process.execPath, [childPath], {
      env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: configHome },
      stdio: 'ignore',
    });
  const stop = async (child) => {
    if (child.exitCode != null || child.signalCode != null) return;
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const force = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 1000);
      child.once('exit', () => {
        clearTimeout(force);
        resolve();
      });
    });
  };
  let first = start();
  let second;
  try {
    const childBase = `http://127.0.0.1:${port}`;
    await waitForCondition(async () => {
      try {
        return (await fetch(`${childBase}/health`)).ok;
      } catch {
        return false;
      }
    });
    const current = await (await fetch(`${childBase}/current?requestId=restart-http`)).json();
    assert.equal(current.id, 41);
    assert.equal(current.lifecycle.state, 'detached');
    await stop(first);

    second = start();
    await waitForCondition(async () => {
      try {
        return (await fetch(`${childBase}/health`)).ok;
      } catch {
        return false;
      }
    });
    const hydrated = await (await fetch(`${childBase}/current?requestId=restart-http`)).json();
    assert.deepEqual(hydrated.questions, [{ question: 'RESTART?', options: [{ label: 'A' }] }]);
    assert.equal(hydrated.roundId, created.record.roundId);
    assert.equal(hydrated.capability, capability);
    assert.equal(hydrated.lifecycle.state, 'detached');
    assert.deepEqual(hydrated.draftAnswers, { 'RESTART?': { sel: [0], confirmed: true } });
    const resumed = fetch(`${childBase}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'restart-http', roundId: created.record.roundId }),
    });
    const answer = await fetch(`${childBase}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: hydrated.id,
        capability: hydrated.capability,
        answers: { 'RESTART?': 'A' },
      }),
    });
    assert.equal(answer.status, 200);
    assert.deepEqual(await (await resumed).json(), { answers: { 'RESTART?': 'A' } });
  } finally {
    await stop(first);
    if (second) await stop(second);
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

  const resumed = post('/resume', { requestId });
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

test('settings recovery endpoints expose redacted doctor data and CAS-protected preview/apply/reset', async () => {
  const doctor = await (await fetch(`${base}/settings/doctor`)).json();
  assert.ok(doctor.effective && doctor.effective.browser);
  assert.equal(Object.prototype.hasOwnProperty.call(doctor, 'path'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(doctor.effective, 'path'), false);

  const Schema = require('../web/settings-schema.js');
  const candidate = Schema.envelopeDefaults();
  candidate.browser.theme = 'paper';
  const previewResponse = await post('/settings/preview', {
    payload: candidate,
    baselineRevision: doctor.revision,
  });
  assert.strictEqual(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(preview.valid, true);
  assert.equal(preview.canApply, true);

  const appliedResponse = await post('/settings/apply', {
    previewId: preview.previewId,
    payload: candidate,
    baselineRevision: preview.baselineRevision,
  });
  assert.strictEqual(appliedResponse.status, 200);
  assert.equal((await appliedResponse.json()).settings.browser.theme, 'paper');

  const afterApply = await (await fetch(`${base}/settings/doctor`)).json();
  const resetResponse = await post('/settings/reset', {
    namespace: 'browser',
    baselineRevision: afterApply.revision,
  });
  assert.strictEqual(resetResponse.status, 200);
  assert.equal(
    (await resetResponse.json()).settings.browser.theme,
    Schema.namespaceDefaults().browser.theme
  );
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
