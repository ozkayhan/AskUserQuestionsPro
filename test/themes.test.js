const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Themes = require('../web/themes.js');

const KNOWN = new Set(Themes.KNOWN_TOKENS);

// styles.css :root bloğundaki CSS custom property anahtarlarını çıkar.
function rootTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  const block = /:root\s*\{([\s\S]*?)\}/.exec(css);
  assert.ok(block, 'styles.css içinde :root bloğu bulunmalı');
  return [...block[1].matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]);
}

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

// B18: styles.css :root defaultları ↔ KNOWN_TOKENS sözleşmesi senkron.
// :root'taki her token KNOWN_TOKENS'ta olmalı (kaçak default yok), ve
// KNOWN_TOKENS'taki her anahtarın bir :root defaultu olmalı (eksik default yok).
test('styles.css :root tokenları KNOWN_TOKENS sözleşmesiyle birebir eşleşir', () => {
  const root = rootTokens();
  assert.ok(root.length > 0, ':root en az bir token içermeli');

  // benzersizlik — aynı token iki kez tanımlanmamalı
  assert.strictEqual(new Set(root).size, root.length, ':root tokenları benzersiz olmalı');

  const rootSet = new Set(root);

  const extraInCss = root.filter((t) => !KNOWN.has(t));
  assert.deepStrictEqual(extraInCss, [], `styles.css :root'ta sözleşme dışı token: ${extraInCss.join(', ')}`);

  const missingInCss = Themes.KNOWN_TOKENS.filter((t) => !rootSet.has(t));
  assert.deepStrictEqual(missingInCss, [], `KNOWN_TOKENS'ta olup :root defaultu olmayan: ${missingInCss.join(', ')}`);

  // bidirectional eşitlik → aynı boyut
  assert.strictEqual(rootSet.size, KNOWN.size);
});
