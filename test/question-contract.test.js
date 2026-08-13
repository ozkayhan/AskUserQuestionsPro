'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { validQuestions } = require('../lib/question-contract.cjs');

test('question contract accepts the documented option object shape', () => {
  const result = validQuestions([
    {
      question: 'Mevsim?',
      header: 'Test',
      type: 'single',
      options: [{ label: 'İlkbahar' }, { label: 'Yaz' }],
    },
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.questions[0], {
    question: 'Mevsim?',
    header: 'Test',
    type: 'single',
    options: [{ label: 'İlkbahar' }, { label: 'Yaz' }],
  });
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
  const binary = validQuestions([{ question: 'Hazır mı?', type: 'binary' }]);
  const scale = validQuestions([{ question: 'Önem?', type: 'scale', min: 1, max: 5 }]);
  assert.equal(binary.ok, true);
  assert.equal(binary.questions[0].header, 'General');
  assert.equal(scale.ok, true);
  assert.equal(scale.questions[0].header, 'General');
});

test('question contract accepts scale options from generic MCP clients', () => {
  const result = validQuestions([
    {
      question: 'Güven?',
      type: 'scale',
      min: 1,
      max: 5,
      options: [{ label: 'Düşük' }, { label: 'Yüksek' }],
    },
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.questions[0].options, [{ label: 'Düşük' }, { label: 'Yüksek' }]);
});
