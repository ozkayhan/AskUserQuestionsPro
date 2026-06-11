const test = require('node:test');
const assert = require('node:assert');
const { mapAnswers } = require('../web/answer-map.js');

const QS = [
  { question: 'Framework?', multiSelect: false, options: [{ label: 'Next.js' }, { label: 'Remix' }] },
  { question: 'Features?', multiSelect: true, options: [{ label: 'Auth' }, { label: 'Cache' }] },
];

test('single-select bir label string döndürür', () => {
  const state = { 'Framework?': { sel: [0], customText: '' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Framework?': 'Next.js' });
});

test('multiSelect label dizisi döndürür', () => {
  const state = { 'Features?': { sel: [0, 1], customText: '' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Features?': ['Auth', 'Cache'] });
});

test('Other şıkkı customText kullanır (label "Other" değil)', () => {
  // Other = options.length indeksi (burada 2)
  const state = { 'Framework?': { sel: [2], customText: 'Astro' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Framework?': 'Astro' });
});

test('cevaplanmamış sorular atlanır', () => {
  assert.deepStrictEqual(mapAnswers(QS, {}), {});
});
