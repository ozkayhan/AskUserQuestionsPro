const test = require('node:test');
const assert = require('node:assert');
const { Bridge } = require('../server/bridge.js');

test('submitQuestions, provideAnswers gelince resolve olur', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  assert.deepStrictEqual(b.getCurrent(), [{ question: 'Q?' }]);
  b.provideAnswers({ 'Q?': 'A' });
  assert.deepStrictEqual(await p, { 'Q?': 'A' });
  assert.strictEqual(b.getCurrent(), null);
});

test('bekleyen varken ikinci submit reject olur', async () => {
  const b = new Bridge();
  b.submitQuestions([{ question: 'Q1' }]);
  await assert.rejects(() => b.submitQuestions([{ question: 'Q2' }]));
});

test('bekleyen yokken provideAnswers throw eder', () => {
  const b = new Bridge();
  assert.throws(() => b.provideAnswers({}));
});

test('cancel bekleyen promise i reject eder', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  b.cancel('timeout');
  await assert.rejects(() => p, /timeout/);
  assert.strictEqual(b.getCurrent(), null);
});
