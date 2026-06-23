const test = require('node:test');
const assert = require('node:assert');
const Schema = require('../web/settings-schema.js');
const Themes = require('../web/themes.js');

test('defaults: theme/uiScale/reduceMotion', () => {
  assert.deepStrictEqual(Schema.defaults(), {
    theme: 'amoled',
    uiScale: 'md',
    reduceMotion: false
  });
});

test('entries() her girdi key/label/type/group/default taşır', () => {
  const e = Schema.entries();
  assert.ok(Array.isArray(e) && e.length >= 3);
  for (const it of e) {
    assert.ok(typeof it.key === 'string' && it.key.length, 'key');
    assert.ok(typeof it.label === 'string' && it.label.length, 'label');
    assert.ok(['select', 'toggle'].includes(it.type), `type ${it.type}`);
    assert.ok(typeof it.group === 'string' && it.group.length, 'group');
    assert.ok('default' in it, 'default');
  }
});

test('theme seçenekleri Themes.list ile senkron', () => {
  const theme = Schema.byKey('theme');
  assert.deepStrictEqual(
    theme.options.map((o) => o.value),
    Themes.list.map((t) => t.id)
  );
});

test('byKey bilinmeyen → undefined', () => {
  assert.strictEqual(Schema.byKey('yok'), undefined);
});

test('groups() benzersiz grup adları, Appearance içerir', () => {
  const g = Schema.groups();
  assert.ok(g.includes('Appearance'));
  assert.strictEqual(new Set(g).size, g.length);
});

test('validate boş → tam default', () => {
  assert.deepStrictEqual(Schema.validate({}), Schema.defaults());
});

test('validate geçersiz select değeri → default', () => {
  assert.strictEqual(Schema.validate({ theme: 'yok-tema' }).theme, 'amoled');
  assert.strictEqual(Schema.validate({ uiScale: 'xl' }).uiScale, 'md');
});

test('validate geçerli değer korunur', () => {
  const v = Schema.validate({ theme: 'paper', uiScale: 'lg', reduceMotion: true });
  assert.strictEqual(v.theme, 'paper');
  assert.strictEqual(v.uiScale, 'lg');
  assert.strictEqual(v.reduceMotion, true);
});

test('validate toggle tip zorlama → boolean', () => {
  assert.strictEqual(Schema.validate({ reduceMotion: 'true' }).reduceMotion, false,
    'string "true" geçerli boolean değil → default false');
  assert.strictEqual(Schema.validate({ reduceMotion: 1 }).reduceMotion, false);
  assert.strictEqual(Schema.validate({ reduceMotion: true }).reduceMotion, true);
});

test('validate bilinmeyen key atılır, eksik doldurulur', () => {
  const v = Schema.validate({ theme: 'paper', bogus: 42 });
  assert.ok(!('bogus' in v), 'bilinmeyen key atılmalı');
  assert.strictEqual(v.uiScale, 'md', 'eksik default ile dolar');
  assert.strictEqual(Object.keys(v).sort().join(','), 'reduceMotion,theme,uiScale');
});

test('validate null/array/garbage → default (throw etmez)', () => {
  assert.deepStrictEqual(Schema.validate(null), Schema.defaults());
  assert.deepStrictEqual(Schema.validate([1, 2]), Schema.defaults());
  assert.deepStrictEqual(Schema.validate('xx'), Schema.defaults());
});
