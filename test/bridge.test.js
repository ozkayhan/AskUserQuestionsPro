const test = require('node:test');
const assert = require('node:assert');
const { Bridge, terminalReason } = require('../server/bridge.js');

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
