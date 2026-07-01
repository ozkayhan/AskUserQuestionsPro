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
  try {
    fn(Settings, dir);
  } finally {
    if (prev === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prev;
    delete require.cache[require.resolve('../lib/settings.js')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('defaults: theme/uiScale/reduceMotion + qtype toggles', () => {
  assert.deepStrictEqual(Schema.defaults(), {
    theme: 'amoled',
    accentColor: 'theme',
    cornerRadius: 'default',
    motionSpeed: 'normal',
    fontFamily: 'system',
    uiScale: 'md',
    highContrast: false,
    reduceMotion: false,
    qtypeBinary: true,
    qtypeScale: true,
    qtypeRanking: true,
    qtypeTree: true,
    autoAdvance: false,
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
  assert.strictEqual(
    Schema.validate({ reduceMotion: 'true' }).reduceMotion,
    false,
    'string "true" geçerli boolean değil → default false'
  );
  assert.strictEqual(Schema.validate({ reduceMotion: 1 }).reduceMotion, false);
  assert.strictEqual(Schema.validate({ reduceMotion: true }).reduceMotion, true);
});

test('validate bilinmeyen key atılır, eksik doldurulur', () => {
  const v = Schema.validate({ theme: 'paper', bogus: 42 });
  assert.ok(!('bogus' in v), 'bilinmeyen key atılmalı');
  assert.strictEqual(v.uiScale, 'md', 'eksik default ile dolar');
  assert.strictEqual(
    Object.keys(v).sort().join(','),
    'accentColor,autoAdvance,cornerRadius,fontFamily,highContrast,motionSpeed,qtypeBinary,qtypeRanking,qtypeScale,qtypeTree,reduceMotion,theme,uiScale'
  );
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

// ── accentColor ──────────────────────────────────────────────
test('accentColor: default theme, geçersiz değer default a düşer', () => {
  assert.strictEqual(Schema.defaults().accentColor, 'theme');
  assert.strictEqual(Schema.validate({ accentColor: 'nope' }).accentColor, 'theme');
  assert.strictEqual(Schema.validate({ accentColor: 'blue' }).accentColor, 'blue');
});

test('accentColor: coerce preset kabul eder', () => {
  assert.deepStrictEqual(Schema.coerce('accentColor', 'green'), { ok: true, value: 'green' });
  assert.strictEqual(Schema.coerce('accentColor', 'gold').ok, false);
});

// ── cornerRadius ──────────────────────────────────────────────
test('cornerRadius: default "default", geçersiz değer default a düşer', () => {
  assert.strictEqual(Schema.defaults().cornerRadius, 'default');
  assert.strictEqual(Schema.validate({ cornerRadius: 'huge' }).cornerRadius, 'default');
  assert.strictEqual(Schema.validate({ cornerRadius: 'sharp' }).cornerRadius, 'sharp');
});

// ── motionSpeed ──────────────────────────────────────────────
test('motionSpeed: default "normal", geçersiz değer default a düşer', () => {
  assert.strictEqual(Schema.defaults().motionSpeed, 'normal');
  assert.strictEqual(Schema.validate({ motionSpeed: 'ludicrous' }).motionSpeed, 'normal');
  assert.strictEqual(Schema.validate({ motionSpeed: 'fast' }).motionSpeed, 'fast');
});

// ── fontFamily ──────────────────────────────────────────────
test('fontFamily: default "system", geçersiz değer default a düşer', () => {
  assert.strictEqual(Schema.defaults().fontFamily, 'system');
  assert.strictEqual(Schema.validate({ fontFamily: 'comic-sans' }).fontFamily, 'system');
  assert.strictEqual(Schema.validate({ fontFamily: 'mono' }).fontFamily, 'mono');
});

// ── highContrast ──────────────────────────────────────────────
test('highContrast: default false, toggle tip zorlanır', () => {
  assert.strictEqual(Schema.defaults().highContrast, false);
  assert.strictEqual(Schema.validate({ highContrast: 'true' }).highContrast, false);
  assert.strictEqual(Schema.validate({ highContrast: true }).highContrast, true);
});

// ── autoAdvance ──────────────────────────────────────────────
test('autoAdvance: default false, toggle tip zorlanır, group Behavior', () => {
  assert.strictEqual(Schema.defaults().autoAdvance, false);
  assert.strictEqual(Schema.validate({ autoAdvance: 'true' }).autoAdvance, false);
  assert.strictEqual(Schema.validate({ autoAdvance: true }).autoAdvance, true);
  assert.strictEqual(Schema.byKey('autoAdvance').group, 'Behavior');
});

// ── qtype toggles ──────────────────────────────────────────────
test('qtype toggle defaults hepsi true', () => {
  const d = Schema.defaults();
  assert.strictEqual(d.qtypeBinary, true);
  assert.strictEqual(d.qtypeScale, true);
  assert.strictEqual(d.qtypeRanking, true);
  assert.strictEqual(d.qtypeTree, true);
});

test('qtype toggle validate: boolean korunur', () => {
  const v = Schema.validate({
    qtypeBinary: false,
    qtypeScale: true,
    qtypeRanking: false,
    qtypeTree: true,
  });
  assert.strictEqual(v.qtypeBinary, false);
  assert.strictEqual(v.qtypeScale, true);
  assert.strictEqual(v.qtypeRanking, false);
  assert.strictEqual(v.qtypeTree, true);
});

test('qtype toggle validate: boolean olmayan → default true', () => {
  const v = Schema.validate({ qtypeBinary: 'false', qtypeScale: 0 });
  assert.strictEqual(v.qtypeBinary, true, 'string → default');
  assert.strictEqual(v.qtypeScale, true, 'number → default');
});

test('qtype toggle coerce: on/off çalışır', () => {
  assert.deepStrictEqual(Schema.coerce('qtypeBinary', 'off'), { ok: true, value: false });
  assert.deepStrictEqual(Schema.coerce('qtypeScale', 'on'), { ok: true, value: true });
  assert.deepStrictEqual(Schema.coerce('qtypeRanking', 'false'), { ok: true, value: false });
  assert.deepStrictEqual(Schema.coerce('qtypeTree', 'true'), { ok: true, value: true });
});

test('qtype entries: Question types grubu var', () => {
  const g = Schema.groups();
  assert.ok(g.includes('Question types'), 'Question types grubu olmalı');
  const qtEntries = Schema.entries().filter((e) => e.group === 'Question types');
  assert.strictEqual(qtEntries.length, 4);
  const keys = qtEntries.map((e) => e.key).sort();
  assert.deepStrictEqual(keys, ['qtypeBinary', 'qtypeRanking', 'qtypeScale', 'qtypeTree']);
  for (const e of qtEntries) {
    assert.strictEqual(e.type, 'toggle');
    assert.strictEqual(e.default, true);
    assert.strictEqual(e.applies, 'reload');
    assert.strictEqual(typeof e.apply, 'function');
  }
});

// ── lib/settings.js disk I/O ──────────────────────────────────────────
test('read: dosya yoksa default döner (throw yok)', () => {
  withTmpConfig((Settings) => {
    assert.deepStrictEqual(Settings.read(), Schema.defaults());
  });
});

test('write: patch yazar + okur, _v eklenir, atomic dosya kalır', () => {
  withTmpConfig((Settings, dir) => {
    const r = Settings.write({ theme: 'paper' });
    assert.strictEqual(r.ok, true, 'Contract W: ok:true beklenir');
    assert.strictEqual(r.value.theme, 'paper');
    assert.strictEqual(r.value._v, 1);
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
    const r = Settings.write({ theme: 'yok', uiScale: 'xl' });
    assert.strictEqual(r.value.theme, 'amoled');
    assert.strictEqual(r.value.uiScale, 'md');
  });
});

// L-25: read() çıktısı _v içermez (disk-only marker); disk dosyası içerir.
test('read(): _v çıktıda yok ama diskte var (belgeli asimetri, L-25)', () => {
  withTmpConfig((Settings, dir) => {
    Settings.write({ theme: 'paper' });
    const out = Settings.read();
    assert.ok(!('_v' in out), 'read() çıktısı _v içermemeli (schema şekli)');
    const file = path.join(dir, 'askuserquestionspro', 'settings.json');
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(disk._v, 1, 'disk dosyası _v=1 marker taşımalı');
  });
});

test('getPath: XDG_CONFIG_HOME altında settings.json', () => {
  withTmpConfig((Settings, dir) => {
    assert.strictEqual(Settings.getPath(), path.join(dir, 'askuserquestionspro', 'settings.json'));
  });
});

// ── write() hata yolu (Contract W) ───────────────────────────────────
// Regresyon: yazma başarısızlığında ok:false döner, disk değişmez, .tmp kalmaz.
test('write: yazılamaz dizin → ok:false, disk değişmez, .tmp kalmaz', () => {
  // Sadece salt-okunur dizin desteği olan ortamlarda çalışır (root değilse).
  if (process.getuid && process.getuid() === 0) return; // root her şeyi yazabilir

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-ro-'));
  const cfgDir = path.join(dir, 'askuserquestionspro');
  fs.mkdirSync(cfgDir, { recursive: true });

  const prev = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  delete require.cache[require.resolve('../lib/settings.js')];
  const Settings = require('../lib/settings.js');

  // Önce geçerli bir dosya yaz (salt-okunur öncesi).
  Settings.write({ theme: 'paper' });

  // Dizini salt-okunur yap.
  fs.chmodSync(cfgDir, 0o555);

  try {
    const r = Settings.write({ theme: 'dark' });

    // Contract W: ok:false dönmeli.
    assert.strictEqual(r.ok, false, 'Contract W: başarısızlıkta ok:false beklenir');
    assert.ok(r.error instanceof Error, 'error field Error olmalı');
    // Disk değişmemiş olmalı.
    const disk = JSON.parse(fs.readFileSync(Settings.getPath(), 'utf8'));
    assert.strictEqual(disk.theme, 'paper', 'disk değeri değişmemeli');
    // .tmp artık diskte kalmamalı.
    assert.ok(!fs.existsSync(Settings.getPath() + '.tmp.' + process.pid), '.tmp temizlenmeli');
  } finally {
    fs.chmodSync(cfgDir, 0o755);
    if (prev === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = prev;
    delete require.cache[require.resolve('../lib/settings.js')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('write: ok:true döndüğünde value geçerli settings objesidir', () => {
  withTmpConfig((Settings) => {
    const r = Settings.write({ theme: 'paper', uiScale: 'lg' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(typeof r.value, 'object');
    assert.strictEqual(r.value.theme, 'paper');
    assert.strictEqual(r.value.uiScale, 'lg');
    assert.ok(!('error' in r), 'başarıda error field olmamalı');
  });
});

// ── lib/atomic-write.cjs ─────────────────────────────────────────────
test('writeFileAtomic: dosyayı doğru yazar, .tmp kalmaz', () => {
  const { writeFileAtomic } = require('../lib/atomic-write.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-aw-'));
  try {
    const file = path.join(dir, 'test.json');
    writeFileAtomic(file, '{"ok":true}');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"ok":true}');
    // tmp pid-suffixed dosya kalmamali
    const entries = fs.readdirSync(dir);
    assert.ok(!entries.some((e) => e.endsWith('.tmp.' + process.pid)), '.tmp kalmamali');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// L-46: eşzamanlı yazıcı kilidi.
test('writeFileAtomic: kilit tutulurken ikinci yazım fail-fast eder (L-46)', () => {
  const { writeFileAtomic } = require('../lib/atomic-write.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-lock-'));
  try {
    const file = path.join(dir, 'test.json');
    // Başka bir yazıcının taze kilidini taklit et (O_EXCL ile oluşturulmuş).
    fs.writeFileSync(file + '.lock', '99999', { flag: 'wx' });
    assert.throws(() => writeFileAtomic(file, '{"x":1}'), /concurrent write lock/);
    // Hedef yazılmamış olmalı (kilit kaybeden yazıcı diske dokunmaz).
    assert.ok(!fs.existsSync(file), 'kilit kaybeden yazıcı hedefe dokunmamalı');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic: başarılı yazımdan sonra kilit bırakılır (tekrar yazılabilir)', () => {
  const { writeFileAtomic } = require('../lib/atomic-write.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-lock2-'));
  try {
    const file = path.join(dir, 'test.json');
    writeFileAtomic(file, '{"a":1}');
    assert.ok(!fs.existsSync(file + '.lock'), 'başarıdan sonra kilit kalmamalı');
    // İkinci yazım, kilit bırakıldığı için başarılı olmalı.
    writeFileAtomic(file, '{"a":2}');
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).a, 2);
    assert.ok(!fs.existsSync(file + '.lock'), 'ikinci yazımdan sonra da kilit kalmamalı');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic: bayat kilit (>10sn) devralınır', () => {
  const { writeFileAtomic } = require('../lib/atomic-write.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-lock3-'));
  try {
    const file = path.join(dir, 'test.json');
    const lock = file + '.lock';
    fs.writeFileSync(lock, '12345', { flag: 'wx' });
    // mtime'ı 1 dakika geriye al → bayat say.
    const old = Date.now() / 1000 - 60;
    fs.utimesSync(lock, old, old);
    // Bayat kilit devralınmalı → yazım başarılı.
    writeFileAtomic(file, '{"ok":true}');
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).ok, true);
    assert.ok(!fs.existsSync(lock), 'devralınan kilit yazım sonunda bırakılmalı');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic: hedef yazılamaz → throw eder, .tmp temizlenir', () => {
  if (process.getuid && process.getuid() === 0) return;
  const { writeFileAtomic } = require('../lib/atomic-write.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-aw-'));
  fs.chmodSync(dir, 0o555); // salt-okunur
  try {
    const file = path.join(dir, 'test.json');
    assert.throws(() => writeFileAtomic(file, '{}'), /EACCES/);
    // .tmp kalmamali
    const entries = fs.readdirSync(dir);
    assert.ok(!entries.some((e) => e.includes('.tmp.')), '.tmp kalmamali');
  } finally {
    fs.chmodSync(dir, 0o755);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
