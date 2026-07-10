'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { validQuestions } = require('../lib/question-contract.cjs');

test('question contract accepts the documented option object shape', () => {
  assert.deepStrictEqual(
    validQuestions([
      {
        question: 'Mevsim?',
        header: 'Test',
        type: 'single',
        options: [{ label: 'İlkbahar' }, { label: 'Yaz' }],
      },
    ]),
    { ok: true }
  );
});

test('question contract rejects string options with an actionable error', () => {
  const result = validQuestions([
    {
      question: 'Mevsim?',
      header: 'Test',
      type: 'single',
      options: ['İlkbahar', 'Yaz'],
    },
  ]);
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /object.*label/i);
  assert.match(result.error, /strings.*invalid/i);
});

test('question contract allows binary and scale questions without options', () => {
  assert.deepStrictEqual(validQuestions([{ question: 'Hazır mı?', type: 'binary' }]), { ok: true });
  assert.deepStrictEqual(validQuestions([{ question: 'Önem?', type: 'scale', min: 1, max: 5 }]), {
    ok: true,
  });
});
