const test = require('node:test');
const assert = require('node:assert');
const Themes = require('../web/themes.js');

const KNOWN = new Set(Themes.KNOWN_TOKENS);

test('5 tema var, hepsi benzersiz id', () => {
  assert.strictEqual(Themes.list.length, 5);
  const ids = Themes.list.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, 5);
});

test('DEFAULT_ID amoled ve listenin ilk teması', () => {
  assert.strictEqual(Themes.DEFAULT_ID, 'amoled');
  assert.strictEqual(Themes.list[0].id, 'amoled');
});

test('amoled base sözleşmesi: tokens boş (styles.css :root defaultları)', () => {
  assert.deepStrictEqual(Themes.get('amoled').tokens, {});
});

test('her temada name + swatch.bg + swatch.accent var', () => {
  for (const t of Themes.list) {
    assert.ok(typeof t.name === 'string' && t.name.length, `${t.id} name`);
    assert.match(t.swatch.bg, /^#|rgb/, `${t.id} swatch.bg`);
    assert.match(t.swatch.accent, /^#|rgb/, `${t.id} swatch.accent`);
  }
});

test('tema token anahtarları bilinen sözleşmenin alt kümesi (kaçak anahtar yok)', () => {
  for (const t of Themes.list) {
    for (const key of Object.keys(t.tokens)) {
      assert.ok(KNOWN.has(key), `${t.id} bilinmeyen token: ${key}`);
    }
  }
});

test('non-base temalar çekirdek renkleri override eder (gerçekten farklı)', () => {
  for (const t of Themes.list) {
    if (t.id === Themes.DEFAULT_ID) continue;
    for (const key of ['--bg', '--accent', '--fg']) {
      assert.ok(key in t.tokens, `${t.id} ${key} override etmeli`);
    }
  }
});

test('font alanı yoksa null, varsa boş olmayan string', () => {
  for (const t of Themes.list) {
    assert.ok(t.font === null || (typeof t.font === 'string' && t.font.length), `${t.id} font`);
  }
});

test('get bilinmeyen id için default döndürür', () => {
  assert.strictEqual(Themes.get('yok-böyle-tema').id, 'amoled');
});

test('apply node ortamında (document yok) çökmeden id döndürür', () => {
  assert.strictEqual(Themes.apply('phosphor'), 'phosphor');
  assert.strictEqual(Themes.current(), 'phosphor');
  assert.strictEqual(Themes.apply('yok'), 'amoled');
});
