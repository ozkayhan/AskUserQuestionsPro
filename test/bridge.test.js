const test = require('node:test');
const assert = require('node:assert');
const { Bridge, terminalReason } = require('../server/bridge.js');

function scheduler() {
  let now = 0;
  const pending = new Map();
  let sequence = 0;
  return {
    now: () => now,
    setTimer(callback, delay) {
      const id = ++sequence;
      pending.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimer(id) {
      pending.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, entry] of [...pending]) {
        if (entry.at <= now) {
          pending.delete(id);
          entry.callback();
        }
      }
    },
  };
}

test('Bridge snapshot uses opaque capability and deterministic detached expiry', async () => {
  const clock = scheduler();
  const b = new Bridge({ detachedTtlMs: 10, ...clock });
  const owner = b.submitQuestions([{ question: 'private' }], 'owner');
  const round = b.peek('owner');
  const state = b.getSnapshot();
  assert.equal(state.state, 'drafting');
  assert.equal(typeof state.capability, 'string');
  assert.equal(JSON.stringify(state).includes('private'), false);
  assert.equal(b.detach('host disconnected', round.id, state.capability), true);
  clock.advance(10);
  await assert.rejects(owner, (error) => error.code === 'application_timeout');
  assert.equal(b.getSnapshot().state, 'expired');
});

test('wrong id or capability cannot mutate a later round', async () => {
  const b = new Bridge();
  const first = b.submitQuestions([{ question: 'one' }]);
  const old = b.peek();
  const oldCapability = b.getSnapshot().capability;
  b.cancel('user cancelled', old.id, oldCapability);
  await assert.rejects(first);
  const second = b.submitQuestions([{ question: 'two' }]);
  const current = b.peek();
  assert.equal(b.detach('host disconnected', old.id, oldCapability), false);
  assert.equal(b.cancel('user cancelled', current.id, oldCapability), false);
  assert.equal(b.provideAnswers(current.id, { two: 'yes' }, oldCapability), false);
  assert.equal(b.getSnapshot().state, 'drafting');
  assert.equal(b.provideAnswers(current.id, { two: 'yes' }, b.getSnapshot().capability), true);
  await second;
});

test('submitQuestions, provideAnswers(id) gelince resolve olur', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  const { id } = b.peek();
  assert.deepStrictEqual(b.getCurrent(), [{ question: 'Q?' }]);
  assert.strictEqual(b.provideAnswers(id, ['A']), true);
  assert.deepStrictEqual(await p, ['A']);
  assert.strictEqual(b.getCurrent(), null);
});

test('bekleyen varken ikinci submit reject olur', async () => {
  const b = new Bridge();
  b.submitQuestions([{ question: 'Q1' }]);
  await assert.rejects(() => b.submitQuestions([{ question: 'Q2' }]));
});

test('bekleyen yokken provideAnswers false doner (throw etmez)', () => {
  const b = new Bridge();
  assert.strictEqual(b.provideAnswers(1, ['A']), false);
});

test('provideAnswers id eslesmezse false doner, pending temizlenmez', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  const { id } = b.peek();
  // stale id → eşleşmez → false, resolve etmez.
  assert.strictEqual(b.provideAnswers(id + 99, ['stale']), false);
  assert.ok(b.peek(), 'pending hâlâ açık olmalı');
  // doğru id → resolve.
  assert.strictEqual(b.provideAnswers(id, ['real']), true);
  assert.deepStrictEqual(await p, ['real']);
});

test('cancel bekleyen promise i reject eder', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  assert.strictEqual(b.cancel('timeout'), true);
  await assert.rejects(() => p, /timeout/);
  assert.strictEqual(b.getCurrent(), null);
});

test('cancel pending yokken false doner', () => {
  const b = new Bridge();
  assert.strictEqual(b.cancel('x'), false);
});

test('cancel(reason, expectedId) eslesmeyen id ile iptal etmez (cross-round)', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  const { id } = b.peek();
  // gec gelen onClose, sahiplenmediği başka id ile iptal etmeye çalışır → no-op.
  assert.strictEqual(b.cancel('stale onClose', id + 5), false);
  assert.ok(b.peek(), 'eşleşmeyen expectedId pending i bozmamalı');
  // doğru id ile iptal → reject.
  assert.strictEqual(b.cancel('client disconnected', id), true);
  await assert.rejects(() => p, /client disconnected/);
});

test('cancel terminal nedenleri typed code ile korunur', async () => {
  assert.strictEqual(terminalReason('user cancelled'), 'user_cancelled');
  assert.strictEqual(terminalReason('host cancelled'), 'host_cancelled');
  assert.strictEqual(terminalReason('browser disconnected'), 'browser_disconnect');
  assert.strictEqual(terminalReason('timeout'), 'application_timeout');
  assert.strictEqual(terminalReason('unrecognized'), 'bridge_error');

  const b = new Bridge();
  const pending = b.submitQuestions([{ question: 'Q?' }]);
  const roundId = b.peek().id;
  assert.strictEqual(b.cancel('user cancelled', roundId), true);
  await assert.rejects(
    pending,
    (error) => error.code === 'user_cancelled' && error.roundId === roundId
  );
  assert.strictEqual(
    b.cancel('user cancelled', roundId),
    false,
    'terminal geçiş idempotent olmalı'
  );
});

test('her submit artan benzersiz id verir; peek {id,questions} doner', async () => {
  const b = new Bridge();
  assert.strictEqual(b.peek(), null);
  const q1promise = b.submitQuestions([{ question: 'Q1' }]);
  q1promise.catch(() => {}); // reject'i tüket (unhandled rejection olmasın).
  const p1 = b.peek();
  assert.ok(typeof p1.id === 'number');
  assert.deepStrictEqual(p1.questions, [{ question: 'Q1' }]);
  b.cancel('x', p1.id);
  b.submitQuestions([{ question: 'Q2' }]);
  const p2 = b.peek();
  assert.ok(p2.id > p1.id, 'id artmali');
});

test('peek(requestId) yalnizca ilgili istemcinin turunu gosterir', () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  p.catch(() => {});
  assert.ok(b.peek('owner-a'));
  assert.strictEqual(b.peek('owner-b'), null);
  b.cancel('test');
});

test('detach host baglantisi kopsa da pending roundu korur ve resume cevabi alir', async () => {
  const b = new Bridge({ detachedTtlMs: 1000 });
  const owner = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  const round = b.peek('owner-a');
  assert.strictEqual(b.detach('host disconnected', round.id), true);
  assert.equal(b.peek('owner-a').id, round.id);
  assert.equal(b.getSnapshot().state, 'detached');

  const resumed = b.waitForAnswers('owner-a');
  assert.equal(b.provideAnswers(round.id, { 'Q?': 'A' }), true);
  assert.deepStrictEqual(await resumed.promise, { 'Q?': 'A' });
  assert.deepStrictEqual(await owner, { 'Q?': 'A' });
  assert.equal(b.peek('owner-a'), null);
});

test('detached round correct capability ile resume öncesi cevap kabul eder ve sonuç saklanır', async () => {
  const b = new Bridge({ detachedTtlMs: 1000 });
  const owner = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  const round = b.peek('owner-a');
  assert.equal(b.detach('host disconnected', round.id, round.capability), true);
  assert.equal(b.provideAnswers(round.id, { 'Q?': 'A' }, round.capability), true);
  assert.equal(b.getSnapshot().state, 'delivery-pending');
  assert.deepEqual(await owner, { 'Q?': 'A' });
  assert.equal(b.markDeliveryUncertain(round.id), true);
  assert.equal(b.getSnapshot().state, 'delivery-uncertain');
  const resumed = b.waitForAnswers('owner-a');
  assert.deepEqual(await resumed.promise, { 'Q?': 'A' });
  assert.equal(b.confirmDelivery(round.id), true);
  assert.equal(b.getSnapshot().state, 'delivered');
});

test('resume round requestId olmadan en son detached cevabi bulur', async () => {
  const b = new Bridge({ detachedTtlMs: 1000 });
  const owner = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  const round = b.peek('owner-a');
  b.detach('host disconnected', round.id);
  const resumed = b.waitForAnswers();
  b.provideAnswers(round.id, { 'Q?': 'A' });
  assert.deepStrictEqual(await resumed.promise, { 'Q?': 'A' });
  await owner;
});

test('detached round TTL sonunda typed application timeout ile temizlenir', async () => {
  const b = new Bridge({ detachedTtlMs: 15 });
  const owner = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  const round = b.peek('owner-a');
  b.detach('host disconnected', round.id);
  const rejection = assert.rejects(owner, (error) => error.code === 'application_timeout');
  await new Promise((resolve) => setTimeout(resolve, 30));
  await rejection;
  assert.equal(b.peek(), null);
});
