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

test('doctor --target claude: izole HOME altında eksikleri raporlar', () => {
  // doctor read-only: addHook saf, writeSettings çağrılmaz. İzole HOME'da hook yok.
  const r = runCli(['doctor', '--target', 'claude']);
  assert.strictEqual(r.status, 1, 'hook kurulu değilken doctor exit 1 olmalı');
  assert.match(r.stdout, /Claude hook kurulu değil/, 'doctor hook durumunu raporlamalı');
});

test('install --target auto: host CLI yokken uyumluluk fallback kurulumu basar', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-auto-home-'));
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-auto-xdg-'));
  try {
    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      ASKUI_CLAUDE_BIN: path.join(home, 'missing-claude'),
      ASKUI_CODEX_BIN: path.join(home, 'missing-codex'),
      ASKUI_ANTIGRAVITY_BIN: path.join(home, 'missing-agy'),
    };
    const install = spawnSync(process.execPath, [CLI, 'install', '--target', 'auto'], {
      encoding: 'utf8',
      env,
    });
    assert.strictEqual(install.status, 0, install.stdout + install.stderr);
    assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'askpro', 'SKILL.md')));

    const doctor = spawnSync(process.execPath, [CLI, 'doctor', '--target', 'auto'], {
      encoding: 'utf8',
      env,
    });
    assert.strictEqual(doctor.status, 0, doctor.stdout + doctor.stderr);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});

test(
  'install/uninstall --target codex deploys Codex skill and MCP without touching Claude',
  { skip: process.platform === 'win32' },
  () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-codex-home-'));
    const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-codex-xdg-'));
    const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-codex-bin-'));
    const fakeCodex = path.join(fakeDir, 'codex');
    const logFile = path.join(fakeDir, 'calls.log');
    fs.writeFileSync(
      fakeCodex,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ASKUI_TEST_LOG"\n' +
        'if [ "$1 $2" = "mcp get" ]; then\n' +
        '  printf \'{"transport":{"type":"stdio","command":"%s","args":["%s"]},"tool_timeout_sec":3600}\\n\' "$ASKUI_TEST_NODE" "$ASKUI_TEST_MCP"\n' +
        'fi\n' +
        'if [ "$1 $2" = "mcp remove" ] && [ "${ASKUI_REMOVE_FAIL:-0}" = "1" ]; then exit 7; fi\n' +
        'exit 0\n',
      { mode: 0o755 }
    );
    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      ASKUI_CODEX_BIN: fakeCodex,
      ASKUI_TEST_LOG: logFile,
      ASKUI_TEST_NODE: process.execPath,
      ASKUI_TEST_MCP: path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs'),
    };
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.codex', 'config.toml'),
      '[mcp_servers.askuserquestionspro]\ncommand = "node"\nargs = ["old.mjs"]\n'
    );
    try {
      const install = spawnSync(process.execPath, [CLI, 'install', '--target', 'codex'], {
        encoding: 'utf8',
        env,
      });
      assert.strictEqual(install.status, 0, install.stderr);
      assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'askpro', 'SKILL.md')));
      assert.ok(!fs.existsSync(path.join(home, '.claude')), 'Codex-only install Claude yazmamalı');
      const calls = fs.readFileSync(logFile, 'utf8');
      assert.match(calls, /mcp add askuserquestionspro -- .*node/);

      const repair = spawnSync(process.execPath, [CLI, 'install', '--target', 'codex'], {
        encoding: 'utf8',
        env,
      });
      assert.strictEqual(repair.status, 0, repair.stderr);
      const repairedCalls = fs.readFileSync(logFile, 'utf8');
      assert.strictEqual(
        (repairedCalls.match(/mcp add askuserquestionspro -- .*node/g) || []).length,
        2,
        'tekrar install MCP kaydını onarmalıdır'
      );
      const staleDoctor = spawnSync(process.execPath, [CLI, 'doctor', '--target', 'codex'], {
        encoding: 'utf8',
        env: { ...env, ASKUI_TEST_MCP: '/stale/mcp.mjs' },
      });
      assert.strictEqual(staleDoctor.status, 1, 'doctor eski MCP pathini sağlıklı saymamalı');
      const doctor = spawnSync(process.execPath, [CLI, 'doctor', '--target', 'codex'], {
        encoding: 'utf8',
        env,
      });
      assert.strictEqual(doctor.status, 0, doctor.stdout + doctor.stderr);
      assert.match(doctor.stdout, /Codex App\/CLI MCP kaydı kurulu/);

      const failedRemove = spawnSync(process.execPath, [CLI, 'uninstall', '--target', 'codex'], {
        encoding: 'utf8',
        env: { ...env, ASKUI_REMOVE_FAIL: '1' },
      });
      assert.strictEqual(
        failedRemove.status,
        1,
        'MCP remove nonzero ise uninstall başarısız olmalı'
      );

      const uninstall = spawnSync(process.execPath, [CLI, 'uninstall', '--target', 'codex'], {
        encoding: 'utf8',
        env,
      });
      assert.strictEqual(uninstall.status, 0, uninstall.stderr);
      assert.ok(!fs.existsSync(path.join(home, '.agents', 'skills', 'askpro')));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(xdg, { recursive: true, force: true });
      fs.rmSync(fakeDir, { recursive: true, force: true });
    }
  }
);

test(
  'uninstall --target auto finds residual Codex skill even when executable disappeared',
  { skip: process.platform === 'win32' },
  () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-residual-home-'));
    const skill = path.join(home, '.agents', 'skills', 'askpro');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, 'SKILL.md'), 'residual');
    try {
      const result = spawnSync(process.execPath, [CLI, 'uninstall', '--target', 'auto'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          ASKUI_CODEX_BIN: path.join(home, 'missing-codex'),
          ASKUI_CLAUDE_BIN: path.join(home, 'missing-claude'),
        },
      });
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      assert.ok(!fs.existsSync(skill), 'residual Codex skill temizlenmeli');
      assert.ok(!fs.existsSync(path.join(home, '.claude')), 'Claude state oluşturulmamalı');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
);
