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

// ─── YENİ TİP TESTLERİ ────────────────────────────────────────────────────────

const { test: t3 } = require('node:test');
const assert3 = require('node:assert');
const AM3 = require('../web/answer-map.js');

// --- qType ---
t3('qType: type yoksa multiSelect->multi, yoksa->single', () => {
  assert3.strictEqual(AM3.qType({ multiSelect: true, options: [] }), 'multi');
  assert3.strictEqual(AM3.qType({ multiSelect: false, options: [] }), 'single');
  assert3.strictEqual(AM3.qType({ options: [] }), 'single');
});

t3('qType: q.type açıkça verilmişse kullanır', () => {
  assert3.strictEqual(AM3.qType({ type: 'binary' }), 'binary');
  assert3.strictEqual(AM3.qType({ type: 'scale' }), 'scale');
  assert3.strictEqual(AM3.qType({ type: 'ranking' }), 'ranking');
  assert3.strictEqual(AM3.qType({ type: 'tree' }), 'tree');
});

t3('qType: setEnabled false -> RICH tip degrade olur', () => {
  AM3.setEnabled({ binary: false, scale: false, ranking: false, tree: false });
  assert3.strictEqual(AM3.qType({ type: 'binary' }), 'single');
  assert3.strictEqual(AM3.qType({ type: 'scale' }), 'single');
  assert3.strictEqual(AM3.qType({ type: 'ranking', multiSelect: true }), 'multi');
  assert3.strictEqual(AM3.qType({ type: 'tree' }), 'single');
  // Geri aç
  AM3.setEnabled({ binary: true, scale: true, ranking: true, tree: true });
});

t3('qType: setEnabled true sonrası RICH tip düzgün döner', () => {
  AM3.setEnabled({ binary: true, scale: true, ranking: true, tree: true });
  assert3.strictEqual(AM3.qType({ type: 'binary' }), 'binary');
  assert3.strictEqual(AM3.qType({ type: 'scale' }), 'scale');
});

// --- mapAnswers binary ---
t3('mapAnswers: binary — varsayılan şıklar', () => {
  const q = [{ question: 'Devam?', type: 'binary' }];
  const s = { 'Devam?': { sel: [0], customText: '', value: null, order: null, path: null } };
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'Devam?': 'Evet' });
});

t3('mapAnswers: binary — özel şıklar', () => {
  const q = [{ question: 'Kabul?', type: 'binary', options: [{ label: 'Evet, devam et' }, { label: 'Hayır, dur' }] }];
  const s = { 'Kabul?': { sel: [1], customText: '' } };
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'Kabul?': 'Hayır, dur' });
});

t3('mapAnswers: binary — seçim yoksa atlanır', () => {
  const q = [{ question: 'Devam?', type: 'binary' }];
  assert3.deepStrictEqual(AM3.mapAnswers(q, { 'Devam?': { sel: [] } }), {});
});

// --- mapAnswers scale ---
t3('mapAnswers: scale — number döndürür', () => {
  const q = [{ question: 'Puan?', type: 'scale', min: 1, max: 10, step: 1 }];
  const s = { 'Puan?': { sel: [], customText: '', value: 7, order: null, path: null } };
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'Puan?': 7 });
});

t3('mapAnswers: scale — value null ise atlanır', () => {
  const q = [{ question: 'Puan?', type: 'scale', min: 1, max: 10, step: 1 }];
  assert3.deepStrictEqual(AM3.mapAnswers(q, { 'Puan?': { sel: [], value: null } }), {});
});

// --- mapAnswers ranking ---
t3('mapAnswers: ranking — sıralı string[] döndürür', () => {
  const q = [{ question: 'Öncelik?', type: 'ranking', options: [{ label: 'Auth' }, { label: 'Cache' }, { label: 'Billing' }] }];
  const s = { 'Öncelik?': { sel: [], customText: '', value: null, order: [2, 0, 1], path: null } };
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'Öncelik?': ['Billing', 'Auth', 'Cache'] });
});

t3('mapAnswers: ranking — order null ise atlanır', () => {
  const q = [{ question: 'Öncelik?', type: 'ranking', options: [{ label: 'A' }] }];
  assert3.deepStrictEqual(AM3.mapAnswers(q, { 'Öncelik?': { order: null } }), {});
});

// --- mapAnswers tree ---
t3('mapAnswers: tree — kök->yaprak yol döndürür', () => {
  const q = [{
    question: 'Kategori?', type: 'tree',
    options: [
      { label: 'AI', children: [{ label: 'LLM', children: [{ label: 'fine-tune' }] }] },
      { label: 'DB' },
    ]
  }];
  const s = { 'Kategori?': { sel: [], customText: '', value: null, order: null, path: [0, 0, 0] } };
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'Kategori?': ['AI', 'LLM', 'fine-tune'] });
});

t3('mapAnswers: tree — path boşsa atlanır', () => {
  const q = [{ question: 'K?', type: 'tree', options: [{ label: 'A' }] }];
  assert3.deepStrictEqual(AM3.mapAnswers(q, { 'K?': { path: [] } }), {});
});

// --- decideActivate binary ---
t3('decideActivate: binary — her basış select döndürür, noop yok', () => {
  const q = { type: 'binary' };
  const a = { sel: [], customText: '', confirmed: false };
  assert3.deepStrictEqual(AM3.decideActivate(q, a, 0), { type: 'select', sel: [0] });
  assert3.deepStrictEqual(AM3.decideActivate(q, a, 1), { type: 'select', sel: [1] });
});

t3('decideActivate: binary — sınır dışı -> noop', () => {
  const q = { type: 'binary' };
  const a = { sel: [], customText: '' };
  assert3.deepStrictEqual(AM3.decideActivate(q, a, 2), { type: 'noop' });
  assert3.deepStrictEqual(AM3.decideActivate(q, a, -1), { type: 'noop' });
});

t3('decideActivate: binary — özel şıklarla', () => {
  const q = { type: 'binary', options: [{ label: 'Evet, devam et' }, { label: 'Hayır, iptal' }] };
  const a = { sel: [], customText: '' };
  assert3.deepStrictEqual(AM3.decideActivate(q, a, 0), { type: 'select', sel: [0] });
});

// --- isAnswered ---
t3('isAnswered: single/multi/binary — sel>0 ise true', () => {
  const sq = { type: 'single', options: [{ label: 'A' }] };
  const mq = { type: 'multi', options: [{ label: 'A' }] };
  const bq = { type: 'binary' };
  assert3.strictEqual(AM3.isAnswered(sq, { sel: [0], value: null, order: null, path: null }), true);
  assert3.strictEqual(AM3.isAnswered(mq, { sel: [0, 1] }), true);
  assert3.strictEqual(AM3.isAnswered(bq, { sel: [1] }), true);
  assert3.strictEqual(AM3.isAnswered(sq, { sel: [] }), false);
  assert3.strictEqual(AM3.isAnswered(bq, { sel: [] }), false);
});

t3('isAnswered: scale — value!=null ise true', () => {
  const sq = { type: 'scale', min: 1, max: 10, step: 1 };
  assert3.strictEqual(AM3.isAnswered(sq, { value: 7 }), true);
  assert3.strictEqual(AM3.isAnswered(sq, { value: 0 }), true);
  assert3.strictEqual(AM3.isAnswered(sq, { value: null }), false);
});

t3('isAnswered: ranking — order boş değilse true', () => {
  const rq = { type: 'ranking', options: [{ label: 'A' }, { label: 'B' }] };
  assert3.strictEqual(AM3.isAnswered(rq, { order: [0, 1] }), true);
  assert3.strictEqual(AM3.isAnswered(rq, { order: null }), false);
  assert3.strictEqual(AM3.isAnswered(rq, { order: [] }), false);
});

t3('isAnswered: tree — path var ve son düğüm yaprak ise true', () => {
  const tq = {
    type: 'tree',
    options: [
      { label: 'AI', children: [{ label: 'LLM', children: [{ label: 'fine-tune' }] }] },
      { label: 'DB' },
    ]
  };
  // DB yaprak (path=[1])
  assert3.strictEqual(AM3.isAnswered(tq, { path: [1] }), true);
  // fine-tune yaprak (path=[0,0,0])
  assert3.strictEqual(AM3.isAnswered(tq, { path: [0, 0, 0] }), true);
  // AI yaprak değil (path=[0])
  assert3.strictEqual(AM3.isAnswered(tq, { path: [0] }), false);
  // boş path
  assert3.strictEqual(AM3.isAnswered(tq, { path: [] }), false);
  assert3.strictEqual(AM3.isAnswered(tq, { path: null }), false);
});

t3('isAnswered: null answer -> false', () => {
  assert3.strictEqual(AM3.isAnswered({ type: 'single', options: [] }, null), false);
});

// --- summaryText ---
t3('summaryText: single/multi — virgülle birleştirir', () => {
  const sq = { options: [{ label: 'Next.js' }, { label: 'Remix' }], multiSelect: false };
  assert3.strictEqual(AM3.summaryText(sq, { sel: [0], customText: '' }), 'Next.js');
  const mq = { options: [{ label: 'Auth' }, { label: 'Cache' }], multiSelect: true };
  assert3.strictEqual(AM3.summaryText(mq, { sel: [0, 1], customText: '' }), 'Auth, Cache');
});

t3('summaryText: binary — seçili label', () => {
  const bq = { type: 'binary' };
  assert3.strictEqual(AM3.summaryText(bq, { sel: [0] }), 'Evet');
  assert3.strictEqual(AM3.summaryText(bq, { sel: [1] }), 'Hayır');
  assert3.strictEqual(AM3.summaryText(bq, { sel: [] }), '');
});

t3('summaryText: scale — "değer / max" formatı', () => {
  const sq = { type: 'scale', min: 1, max: 10, step: 1 };
  assert3.strictEqual(AM3.summaryText(sq, { value: 7 }), '7 / 10');
  assert3.strictEqual(AM3.summaryText(sq, { value: null }), '');
});

t3('summaryText: ranking — ok ile ayrılmış', () => {
  const rq = { type: 'ranking', options: [{ label: 'Auth' }, { label: 'Cache' }, { label: 'Billing' }] };
  assert3.strictEqual(AM3.summaryText(rq, { order: [2, 0, 1] }), 'Billing → Auth → Cache');
  assert3.strictEqual(AM3.summaryText(rq, { order: null }), '');
});

t3('summaryText: tree — ok ile ayrılmış yol', () => {
  const tq = {
    type: 'tree',
    options: [
      { label: 'AI', children: [{ label: 'LLM', children: [{ label: 'fine-tune' }] }] },
      { label: 'DB' },
    ]
  };
  assert3.strictEqual(AM3.summaryText(tq, { path: [0, 0, 0] }), 'AI → LLM → fine-tune');
  assert3.strictEqual(AM3.summaryText(tq, { path: [1] }), 'DB');
  assert3.strictEqual(AM3.summaryText(tq, { path: [] }), '');
});

t3('summaryText: null answer -> boş string', () => {
  assert3.strictEqual(AM3.summaryText({ type: 'scale', min: 1, max: 10 }, null), '');
});

// --- moveRank ---
t3('moveRank: elemanı yukarı taşır', () => {
  assert3.deepStrictEqual(AM3.moveRank([0, 1, 2], 1, -1), [1, 0, 2]);
});

t3('moveRank: elemanı aşağı taşır', () => {
  assert3.deepStrictEqual(AM3.moveRank([0, 1, 2], 1, 1), [0, 2, 1]);
});

t3('moveRank: sınırda taşınmaz, aynı diziyi döndürür', () => {
  assert3.deepStrictEqual(AM3.moveRank([0, 1, 2], 0, -1), [0, 1, 2]);
  assert3.deepStrictEqual(AM3.moveRank([0, 1, 2], 2, 1), [0, 1, 2]);
});

t3('moveRank: orijinal diziyi mutate etmez', () => {
  const orig = [0, 1, 2];
  AM3.moveRank(orig, 1, -1);
  assert3.deepStrictEqual(orig, [0, 1, 2]);
});

// --- initOrder ---
t3('initOrder: [0..n-1] döndürür', () => {
  const q = { options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] };
  assert3.deepStrictEqual(AM3.initOrder(q), [0, 1, 2]);
});

t3('initOrder: tek elemanlı', () => {
  const q = { options: [{ label: 'A' }] };
  assert3.deepStrictEqual(AM3.initOrder(q), [0]);
});

// --- clampScale ---
t3('clampScale: değeri min/max aralığında sınırlar', () => {
  const sq = { min: 1, max: 10, step: 1 };
  assert3.strictEqual(AM3.clampScale(sq, 5), 5);
  assert3.strictEqual(AM3.clampScale(sq, 0), 1);
  assert3.strictEqual(AM3.clampScale(sq, 15), 10);
});

t3('clampScale: step\'e yuvarlar', () => {
  const sq = { min: 0, max: 100, step: 10 };
  assert3.strictEqual(AM3.clampScale(sq, 34), 30);
  assert3.strictEqual(AM3.clampScale(sq, 35), 40); // Math.round, 0.5 yukarı
  assert3.strictEqual(AM3.clampScale(sq, 95), 100);
  assert3.strictEqual(AM3.clampScale(sq, 0), 0);
});

t3('clampScale: step yoksa 1 varsayar', () => {
  const sq = { min: 0, max: 5 };
  assert3.strictEqual(AM3.clampScale(sq, 3), 3);
  assert3.strictEqual(AM3.clampScale(sq, 7), 5);
});

// --- treeNodeAt ---
t3('treeNodeAt: boş path -> null', () => {
  const tq = { options: [{ label: 'A' }, { label: 'B' }] };
  assert3.strictEqual(AM3.treeNodeAt(tq, []), null);
});

t3('treeNodeAt: kök seviye düğümü', () => {
  const tq = { options: [{ label: 'A' }, { label: 'B' }] };
  assert3.deepStrictEqual(AM3.treeNodeAt(tq, [1]), { label: 'B' });
});

t3('treeNodeAt: iç içe düğüm', () => {
  const tq = {
    options: [
      { label: 'AI', children: [{ label: 'LLM', children: [{ label: 'fine-tune' }] }] },
    ]
  };
  assert3.deepStrictEqual(AM3.treeNodeAt(tq, [0, 0, 0]), { label: 'fine-tune' });
});

t3('treeNodeAt: geçersiz path -> null', () => {
  const tq = { options: [{ label: 'A' }] };
  assert3.strictEqual(AM3.treeNodeAt(tq, [5]), null);
});

// --- treeChildrenAt ---
t3('treeChildrenAt: boş path -> kök options', () => {
  const tq = { options: [{ label: 'A' }, { label: 'B' }] };
  assert3.deepStrictEqual(AM3.treeChildrenAt(tq, []), [{ label: 'A' }, { label: 'B' }]);
});

t3('treeChildrenAt: path verilen düğümün children\'larını döndürür', () => {
  const child1 = { label: 'LLM' };
  const tq = { options: [{ label: 'AI', children: [child1] }, { label: 'DB' }] };
  assert3.deepStrictEqual(AM3.treeChildrenAt(tq, [0]), [child1]);
});

t3('treeChildrenAt: yaprak düğümde boş dizi', () => {
  const tq = { options: [{ label: 'DB' }] };
  assert3.deepStrictEqual(AM3.treeChildrenAt(tq, [0]), []);
});

// --- isLeaf ---
t3('isLeaf: children yok -> true', () => {
  assert3.strictEqual(AM3.isLeaf({ label: 'DB' }), true);
});

t3('isLeaf: children boş dizi -> true', () => {
  assert3.strictEqual(AM3.isLeaf({ label: 'DB', children: [] }), true);
});

t3('isLeaf: children varsa -> false', () => {
  assert3.strictEqual(AM3.isLeaf({ label: 'AI', children: [{ label: 'LLM' }] }), false);
});

// --- setEnabled degrade entegrasyon ---
t3('setEnabled kapalıyken mapAnswers ranking degrades to single', () => {
  AM3.setEnabled({ binary: true, scale: true, ranking: false, tree: true });
  // type:ranking ama ENABLED kapalı → qType single döner
  // mapAnswers single gibi davranır: sel[0] değerini string olarak verir
  const q = [{ question: 'R?', type: 'ranking', multiSelect: false, options: [{ label: 'X' }, { label: 'Y' }] }];
  const s = { 'R?': { sel: [0], customText: '', value: null, order: [1, 0], path: null } };
  // degrade -> single -> options[0].label = 'X'
  assert3.deepStrictEqual(AM3.mapAnswers(q, s), { 'R?': 'X' });
  AM3.setEnabled({ ranking: true });
});

t3('setEnabled kapalıyken isAnswered scale degrades', () => {
  AM3.setEnabled({ scale: false });
  // type:scale degrade -> single -> sel[]
  const sq = { type: 'scale', min: 1, max: 10, step: 1 };
  assert3.strictEqual(AM3.isAnswered(sq, { sel: [], value: 7 }), false);
  assert3.strictEqual(AM3.isAnswered(sq, { sel: [0], value: 7 }), true);
  AM3.setEnabled({ scale: true });
});
