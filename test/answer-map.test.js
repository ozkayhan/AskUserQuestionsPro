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

const { test: t2 } = require('node:test');
const assert2 = require('node:assert');
const AM = require('../web/answer-map.js');

const singleQ = { options: [{ label: 'A' }, { label: 'B' }], multiSelect: false };
const customIdx = 2; // [A, B, Other]

t2('single-select: ilk basışta custom seçenek armlanır (select)', () => {
  const a = { sel: [], customText: '', confirmed: false };
  assert2.deepStrictEqual(AM.decideActivate(singleQ, a, customIdx), { type: 'select', sel: [customIdx] });
});

t2('single-select: armlı custom + metin YOK -> boş popup', () => {
  const a = { sel: [customIdx], customText: '', confirmed: false };
  assert2.deepStrictEqual(AM.decideActivate(singleQ, a, customIdx), { type: 'popup', optIdx: customIdx, draft: '' });
});

t2('REGRESSION: armlı custom + metin VAR -> mevcut metinle popup (düzenleme), confirm DEĞİL', () => {
  const a = { sel: [customIdx], customText: 'benim cevabım', confirmed: false };
  assert2.deepStrictEqual(AM.decideActivate(singleQ, a, customIdx), { type: 'popup', optIdx: customIdx, draft: 'benim cevabım' });
});

t2('single-select: armlı normal seçenek -> confirm', () => {
  const a = { sel: [0], customText: '', confirmed: false };
  assert2.deepStrictEqual(AM.decideActivate(singleQ, a, 0), { type: 'confirm' });
});

const multiQ = { options: [{ label: 'A' }, { label: 'B' }], multiSelect: true };

t2('REGRESSION: multiSelect yeni custom -> popup, seçim HENÜZ işaretlenmez', () => {
  const a = { sel: [], customText: '', confirmed: false };
  // sel alanı olmamalı; metin kaydedilene dek hayalet seçili "Other" oluşmaz
  assert2.deepStrictEqual(AM.decideActivate(multiQ, a, customIdx), { type: 'popup', optIdx: customIdx, draft: '' });
});

t2('multiSelect normal seçenek -> toggle ekler', () => {
  const a = { sel: [0], customText: '', confirmed: false };
  assert2.deepStrictEqual(AM.decideActivate(multiQ, a, 1), { type: 'toggle', sel: [0, 1] });
});

const AM2 = require('../web/answer-map.js');

t2('savePopupState: bos metin custom secimi KALDIRIR (multiSelect deselect yolu)', () => {
  const a = { sel: [0, 2], customText: 'eski' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, ''), { sel: [0], customText: '' });
});
t2('savePopupState: metin custom secimi EKLER/gunceller', () => {
  const a = { sel: [0], customText: '' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, 'yeni'), { sel: [0, 2], customText: 'yeni' });
});
t2('savePopupState: zaten secili custom metin gunceller (cift eklemez)', () => {
  const a = { sel: [2], customText: 'a' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, 'b'), { sel: [2], customText: 'b' });
});
