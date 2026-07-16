'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Bridge } = require('../server/bridge.js');

function questions(count) {
  return Array.from({ length: count }, (_, i) => ({
    question: `Long round question ${i + 1}?`,
    header: 'Long round',
    options: [{ label: 'Continue' }],
  }));
}

test('15-question round remains pending through idle time and resolves exact answers', async () => {
  const bridge = new Bridge();
  const set = questions(15);
  const answers = Object.fromEntries(set.map((q) => [q.question, 'Continue']));
  const pending = bridge.submitQuestions(set, 'long-round-request');

  await new Promise((resolve) => setTimeout(resolve, 125));
  const current = bridge.peek('long-round-request');
  assert.deepEqual(current.questions, set);
  assert.equal(current.questions.length, 15);
  assert.equal(bridge.provideAnswers(current.id, answers), true);
  assert.deepEqual(await pending, answers);
});

test('delayed close from an old owner cannot cancel a newer round', async () => {
  const bridge = new Bridge();
  const first = bridge.submitQuestions(questions(1), 'old-owner');
  const firstRound = bridge.peek('old-owner');
  assert.equal(bridge.cancel('client disconnected', firstRound.id), true);
  await assert.rejects(first, /client disconnected/);

  const second = bridge.submitQuestions(questions(15), 'new-owner');
  const secondRound = bridge.peek('new-owner');
  assert.equal(bridge.cancel('client disconnected', firstRound.id), false);
  assert.deepEqual(bridge.peek('new-owner'), secondRound);
  bridge.provideAnswers(secondRound.id, { ok: true });
  assert.deepEqual(await second, { ok: true });
});
