const test = require('node:test');
const assert = require('node:assert');
const { Bridge, terminalReason } = require('../server/bridge.js');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');
const { RoundStore } = require('../lib/round-store.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Bridge persists durable registration and immutable result replay', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-bridge-store-'));
  const store = new RoundStore({ root });
  const bridge = new Bridge({ store, detachedTtlMs: 1000 });
  const pending = bridge.submitQuestions([{ question: 'durable' }], 'durable-request');
  const current = bridge.peek('durable-request');
  assert.match(current.roundId, /^round_/);
  assert.equal(bridge.provideAnswers(current.id, { durable: 'answer' }, current.capability), true);
  await pending;
  const restarted = new Bridge({ store: new RoundStore({ root }) });
  const result = restarted.getResult(current.roundId, current.capability);
  assert.deepEqual(result.result, { durable: 'answer' });
  assert.equal(restarted.confirmDelivery(current.roundId), true);
  assert.equal(restarted.confirmDelivery(current.roundId), true);
});

test('Bridge hydrates one detached draft after restart with its durable identity and expiry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-bridge-restart-'));
  const first = new Bridge({ store: new RoundStore({ root }), detachedTtlMs: 1000 });
  const owner = first.submitQuestions([{ question: 'recover me' }], 'restart-request');
  const original = first.peek('restart-request');
  assert.equal(
    first.saveDraft(original.id, { 'recover me': { sel: [0] } }, original.capability, 0).ok,
    true
  );
  assert.equal(first.detach('host disconnected', original.id, original.capability), true);

  const restarted = new Bridge({ store: new RoundStore({ root }), detachedTtlMs: 1000 });
  const recovered = restarted.peek('restart-request');
  assert.deepEqual(recovered.questions, [{ question: 'recover me' }]);
  assert.equal(recovered.roundId, original.roundId);
  assert.equal(recovered.capability, original.capability);
  assert.deepEqual(recovered.draftAnswers, { 'recover me': { sel: [0] } });
  assert.equal(recovered.lifecycle.state, 'detached');
  const resumed = restarted.waitForAnswers({
    requestId: 'restart-request',
    roundId: original.roundId,
  });
  assert.equal(
    restarted.provideAnswers(recovered.id, { 'recover me': 'A' }, recovered.capability),
    true
  );
  assert.deepEqual(await resumed.promise, { 'recover me': 'A' });
  owner.catch(() => {});
});

test('Bridge resumes a reconnecting browser round after a second bridge restart', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-bridge-reconnecting-restart-'));
  const first = new Bridge({ store: new RoundStore({ root }), detachedTtlMs: 1000 });
  const owner = first.submitQuestions([{ question: 'resume twice' }], 'resume-twice');
  const original = first.peek('resume-twice');
  assert.equal(first.detach('host disconnected', original.id, original.capability), true);

  const resumedOnce = new Bridge({ store: new RoundStore({ root }), detachedTtlMs: 1000 });
  const firstResume = resumedOnce.waitForAnswers({
    requestId: 'resume-twice',
    roundId: original.roundId,
  });
  assert.equal(resumedOnce.peek('resume-twice').lifecycle.state, 'reconnecting');

  const restartedAgain = new Bridge({ store: new RoundStore({ root }), detachedTtlMs: 1000 });
  const recovered = restartedAgain.peek('resume-twice');
  assert.equal(recovered.lifecycle.state, 'reconnecting');
  const secondResume = restartedAgain.waitForAnswers({
    requestId: 'resume-twice',
    roundId: original.roundId,
  });
  assert.equal(
    restartedAgain.provideAnswers(recovered.id, { 'resume twice': 'A' }, recovered.capability),
    true
  );
  assert.deepEqual(await secondResume.promise, { 'resume twice': 'A' });
  firstResume.cancel();
  owner.catch(() => {});
});

test('Bridge draft saves are capability/revision guarded, idempotent, and reloadable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'askuser-bridge-draft-'));
  const bridge = new Bridge({ store: new RoundStore({ root }) });
  const round = bridge.submitQuestions([{ question: 'draft' }], 'draft-request');
  round.catch(() => {});
  const current = bridge.peek('draft-request');
  const draft = { draft: { sel: [0], confirmed: true } };
  const saved = bridge.saveDraft(current.id, draft, current.capability, 0);
  assert.equal(saved.record.revision, 1);
  assert.equal(bridge.saveDraft(current.id, draft, current.capability, 0).replayed, true);
  assert.equal(
    bridge.saveDraft(current.id, { draft: { sel: [1] } }, current.capability, 0).code,
    'stale_revision'
  );
  assert.equal(bridge.saveDraft(current.id, draft, 'wrong', 1).code, 'ownership_conflict');
  assert.deepEqual(
    new Bridge({ store: new RoundStore({ root }) }).peek('draft-request').draftAnswers,
    draft
  );
});

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

test('Bridge lifecycle diagnostics attribute operational paths without question or answer payloads', async () => {
  const seen = [];
  const lifecycle = createLifecycle({
    adapter: 'http',
    requestId: 'opaque-request',
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });
  const bridge = new Bridge({ detachedTtlMs: 1000 });
  const owner = bridge.submitQuestions(
    [{ question: 'secret question' }],
    'opaque-request',
    lifecycle
  );
  const round = bridge.peek('opaque-request');
  lifecycle.setRoundId(round.id);

  assert.equal(bridge.detach('host disconnected', round.id, round.capability), true);
  const resumed = bridge.waitForAnswers('opaque-request');
  assert.equal(
    bridge.provideAnswers(round.id, { 'secret question': 'secret answer' }, round.capability),
    true
  );
  assert.deepEqual(await owner, { 'secret question': 'secret answer' });
  assert.deepEqual(await resumed.promise, { 'secret question': 'secret answer' });
  assert.equal(bridge.markDeliveryUncertain(round.id), true);
  assert.equal(bridge.confirmDelivery(round.id), true);

  const metadata = Object.fromEntries(
    seen
      .filter((entry) =>
        [
          'host_detached',
          'round_resumed',
          'answer_received',
          'delivery_uncertain',
          'round_finished',
        ].includes(entry.event)
      )
      .map((entry) => [
        entry.event,
        { boundary: entry.boundary, deadlineOwner: entry.deadlineOwner },
      ])
  );
  assert.deepEqual(metadata, {
    host_detached: { boundary: 'bridge', deadlineOwner: 'host' },
    round_resumed: { boundary: 'bridge', deadlineOwner: 'host' },
    answer_received: { boundary: 'browser', deadlineOwner: 'browser' },
    delivery_uncertain: { boundary: 'bridge', deadlineOwner: 'host' },
    round_finished: { boundary: 'bridge', deadlineOwner: 'none' },
  });
  assert.doesNotMatch(JSON.stringify(seen), /secret question|secret answer/);
});

test('Bridge lifecycle diagnostics attribute cancellation and expiry terminal outcomes', async () => {
  const seen = [];
  const lifecycle = createLifecycle({
    now: () => 0,
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });
  const bridge = new Bridge({ detachedTtlMs: 1000 });
  const pending = bridge.submitQuestions([{ question: 'private' }], undefined, lifecycle);
  const round = bridge.peek();
  lifecycle.setRoundId(round.id);
  assert.equal(bridge.cancel('user cancelled', round.id, round.capability), true);
  await assert.rejects(pending);

  const expired = new Bridge({ detachedTtlMs: 1000 });
  const expiryLifecycle = createLifecycle({
    requestId: 'timeout',
    now: () => 0,
    logger: (_scope, detail) => seen.push(JSON.parse(detail)),
  });
  const expiryPending = expired.submitQuestions(
    [{ question: 'private timeout' }],
    'timeout',
    expiryLifecycle
  );
  const expiryRound = expired.peek('timeout');
  expiryLifecycle.setRoundId(expiryRound.id);
  assert.equal(expired.detach('host disconnected', expiryRound.id, expiryRound.capability), true);
  assert.equal(expired.expire(expiryRound.id, expiryRound.capability), true);
  await assert.rejects(expiryPending);

  const byEvent = seen.filter((entry) =>
    ['bridge_cancelled', 'round_timeout', 'round_finished'].includes(entry.event)
  );
  assert.deepEqual(byEvent, [
    {
      event: 'bridge_cancelled',
      adapter: 'unknown',
      roundId: round.id,
      pid: process.pid,
      elapsedMs: 0,
      boundary: 'browser',
      deadlineOwner: 'none',
    },
    {
      event: 'round_finished',
      adapter: 'unknown',
      roundId: round.id,
      pid: process.pid,
      elapsedMs: 0,
      reason: 'user_cancelled',
      boundary: 'browser',
      deadlineOwner: 'none',
    },
    {
      event: 'round_timeout',
      adapter: 'unknown',
      requestId: 'timeout',
      roundId: expiryRound.id,
      pid: process.pid,
      elapsedMs: 0,
      boundary: 'bridge',
      deadlineOwner: 'application',
    },
    {
      event: 'round_finished',
      adapter: 'unknown',
      requestId: 'timeout',
      roundId: expiryRound.id,
      pid: process.pid,
      elapsedMs: 0,
      reason: 'application_timeout',
      boundary: 'bridge',
      deadlineOwner: 'application',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(seen), /private/);
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

test('resume requires an explicit roundId or requestId', async () => {
  const b = new Bridge({ detachedTtlMs: 1000 });
  const owner = b.submitQuestions([{ question: 'Q?' }], 'owner-a');
  const round = b.peek('owner-a');
  b.detach('host disconnected', round.id);
  const resumed = b.waitForAnswers();
  await assert.rejects(resumed.promise, (error) => error.code === 'invalid_selector');
  b.cancel('test cleanup', round.id);
  await assert.rejects(owner);
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
