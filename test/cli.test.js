'use strict';
// L-45: bin/cli.js integration tests.
// CLI komutlarını gerçek bir child process olarak çalıştırıp stdout/stderr/exit
// kodunu doğrular. Sadece DETERMİNİSTİK ve YAN-ETKİSİZ-İZOLE komutlar test edilir:
//   help / unknown / settings (list|get|set|invalid)
// install/uninstall (~/.claude yazar) ve serve/mcp (uzun-soluklu foreground)
// burada test edilmez — onlar ayrı izolasyon/lifecycle gerektirir.
//
// İzolasyon: HOME + XDG_CONFIG_HOME tmp dizine yönlendirilir → gerçek
// ~/.claude/settings.json ve ~/.config/askuserquestionspro asla kirlenmez.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

// CLI'yi izole HOME/XDG ile çalıştır. → { status, stdout, stderr }
function runCli(args, extraEnv = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-cli-home-'));
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-cli-xdg-'));
  try {
    const r = spawnSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: xdg,
        // claude CLI doctor/install'da spawn edilir; PATH'i koru ama testi onun
        // varlığına bağlamayız (komutlar ENOENT'i zarifçe ele alır).
        ...extraEnv,
      },
    });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', xdg };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    // xdg'yi caller okuyabilsin diye bırakmıyoruz; settings set testi kendi okur.
    fs.rmSync(xdg, { recursive: true, force: true });
  }
}

test('help: kullanım metni basar, exit 0', () => {
  const r = runCli(['help']);
  assert.strictEqual(r.status, 0, 'help exit 0 olmalı');
  assert.match(r.stdout, /Kullanım:/, 'kullanım başlığı olmalı');
  assert.match(r.stdout, /install/, 'install komutu listelenmeli');
});

test('argümansız çağrı: usage basar (exit 0)', () => {
  const r = runCli([]);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Kullanım:/);
});

test('bilinmeyen komut: stderr uyarısı + exit 1', () => {
  const r = runCli(['frobnicate']);
  assert.strictEqual(r.status, 1, 'bilinmeyen komut exit 1 olmalı');
  assert.match(r.stderr, /Bilinmeyen komut/, 'stderr bilinmeyen komut demeli');
});

test('settings list: grupları ve dosya yolunu basar (exit 0)', () => {
  const r = runCli(['settings']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Appearance/, 'Appearance grubu olmalı');
  assert.match(r.stdout, /theme = /, 'theme satırı olmalı');
  assert.match(r.stdout, /Dosya:/, 'dosya yolu basılmalı');
});

test('settings get theme: varsayılan amoled (exit 0)', () => {
  const r = runCli(['settings', 'get', 'theme']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /"amoled"/, 'varsayılan theme amoled olmalı');
});

test('settings get bilinmeyen key: stderr + exit 1', () => {
  const r = runCli(['settings', 'get', 'nope']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Bilinmeyen key/);
});

test('settings set theme paper: kaydeder, disk dosyası oluşur (exit 0)', () => {
  // İzole XDG dizinini elde tut ki diske yazıldığını doğrulayabilelim.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-cli-home-'));
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-cli-xdg-'));
  try {
    const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: xdg };
    const set = spawnSync(process.execPath, [CLI, 'settings', 'set', 'theme', 'paper'], {
      encoding: 'utf8',
      env,
    });
    assert.strictEqual(set.status, 0, 'settings set exit 0 olmalı');
    assert.match(set.stdout, /theme = "paper" kaydedildi/);
    const file = path.join(xdg, 'askuserquestionspro', 'settings.json');
    assert.ok(fs.existsSync(file), 'settings.json diske yazılmalı');
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).theme, 'paper');

    // Aynı izole env'de get → kalıcılığı doğrula.
    const get = spawnSync(process.execPath, [CLI, 'settings', 'get', 'theme'], {
      encoding: 'utf8',
      env,
    });
    assert.match(get.stdout, /"paper"/, 'kaydedilen değer get ile okunmalı');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});

test('settings set geçersiz değer: stderr hint + exit 1', () => {
  const r = runCli(['settings', 'set', 'theme', 'yok-tema']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Geçersiz değer/);
});

test('settings set değer eksik: stderr + exit 1', () => {
  const r = runCli(['settings', 'set', 'theme']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /değer eksik/);
});

test('settings bilinmeyen alt komut: stderr + exit 1', () => {
  const r = runCli(['settings', 'bogus']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Bilinmeyen settings alt komutu/);
});

test('doctor: izole HOME altında hook kurulu değil → exit 1, tanı satırları basar', () => {
  // doctor read-only: addHook saf, writeSettings çağrılmaz. İzole HOME'da hook yok.
  const r = runCli(['doctor']);
  assert.strictEqual(r.status, 1, 'hook kurulu değilken doctor exit 1 olmalı');
  assert.match(r.stdout, /Hook/, 'doctor hook durumunu raporlamalı');
});
