const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Schema = require('../web/settings-schema.js');
const Themes = require('../web/themes.js');

// lib/settings.js disk I/O'yu izole tmp dizine yönlendir (XDG_CONFIG_HOME).
function withTmpConfig(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-set-'));
  const prev = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  delete require.cache[require.resolve('../lib/settings.js')];
  const Settings = require('../lib/settings.js');
  try { fn(Settings, dir); }
  finally {
    if (prev === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prev;
    delete require.cache[require.resolve('../lib/settings.js')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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

// ── coerce: CLI string → tip ──────────────────────────────────────────
test('coerce toggle: on/true/1/yes → true, off/false/0/no → false', () => {
  for (const s of ['on', 'true', '1', 'yes']) {
    assert.deepStrictEqual(Schema.coerce('reduceMotion', s), { ok: true, value: true }, s);
  }
  for (const s of ['off', 'false', '0', 'no']) {
    assert.deepStrictEqual(Schema.coerce('reduceMotion', s), { ok: true, value: false }, s);
  }
});

test('coerce toggle geçersiz → ok:false', () => {
  assert.strictEqual(Schema.coerce('reduceMotion', 'maybe').ok, false);
});

test('coerce select: options içindeyse value, değilse ok:false', () => {
  assert.deepStrictEqual(Schema.coerce('theme', 'paper'), { ok: true, value: 'paper' });
  assert.strictEqual(Schema.coerce('theme', 'yok').ok, false);
  assert.strictEqual(Schema.coerce('uiScale', 'lg').value, 'lg');
});

test('coerce bilinmeyen key → ok:false', () => {
  assert.strictEqual(Schema.coerce('yok', 'x').ok, false);
});

// ── lib/settings.js disk I/O ──────────────────────────────────────────
test('read: dosya yoksa default döner (throw yok)', () => {
  withTmpConfig((Settings) => {
    assert.deepStrictEqual(Settings.read(), Schema.defaults());
  });
});

test('write: patch yazar + okur, _v eklenir, atomic dosya kalır', () => {
  withTmpConfig((Settings, dir) => {
    const next = Settings.write({ theme: 'paper' });
    assert.strictEqual(next.theme, 'paper');
    assert.strictEqual(next._v, 1);
    const file = path.join(dir, 'askuserquestionspro', 'settings.json');
    assert.ok(fs.existsSync(file));
    assert.ok(!fs.existsSync(file + '.tmp'), 'tmp temizlenmeli');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(disk.theme, 'paper');
    // read patch'i korur, diğerleri default
    assert.strictEqual(Settings.read().theme, 'paper');
    assert.strictEqual(Settings.read().uiScale, 'md');
  });
});

test('write: kısmi patch öncekini korur (merge)', () => {
  withTmpConfig((Settings) => {
    Settings.write({ theme: 'paper' });
    Settings.write({ uiScale: 'lg' });
    const v = Settings.read();
    assert.strictEqual(v.theme, 'paper');
    assert.strictEqual(v.uiScale, 'lg');
  });
});

test('read: bozuk JSON → default (self-heal, throw yok)', () => {
  withTmpConfig((Settings, dir) => {
    const cfgDir = path.join(dir, 'askuserquestionspro');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, 'settings.json'), '{ bozuk json', 'utf8');
    assert.deepStrictEqual(Settings.read(), Schema.defaults());
  });
});

test('write: geçersiz değer diske ulaşmaz (validate)', () => {
  withTmpConfig((Settings) => {
    const next = Settings.write({ theme: 'yok', uiScale: 'xl' });
    assert.strictEqual(next.theme, 'amoled');
    assert.strictEqual(next.uiScale, 'md');
  });
});

test('getPath: XDG_CONFIG_HOME altında settings.json', () => {
  withTmpConfig((Settings, dir) => {
    assert.strictEqual(Settings.getPath(),
      path.join(dir, 'askuserquestionspro', 'settings.json'));
  });
});
