#!/usr/bin/env node
'use strict';
// askuserquestionspro — CLI giriş noktası.
//   init       install ile aynı (hook + MCP kurulumu) — kurulum için önerilen ad
//   install    hook'u ~/.claude/settings.json'a bağla + MCP sunucusunu kaydet
//   uninstall  hook'u kaldır
//   serve      yerel köprüyü foreground çalıştır (debug)
//   mcp        MCP sunucusunu foreground çalıştır (stdio, debug)
//   doctor     kurulum + health kontrol
//   help       kullanım

const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { addHook, removeHook, readSettings, writeSettings } = require('./install.js');
const Settings = require('../lib/settings.js');
const Schema = require('../web/settings-schema.js');

const PKG_ROOT = path.join(__dirname, '..');
const HOOK_ABS = path.join(PKG_ROOT, 'hooks', 'askuserquestionspro-bridge.mjs');
const SERVER_ABS = path.join(PKG_ROOT, 'server', 'server.js');
const MCP_ABS = path.join(PKG_ROOT, 'mcp-server', 'askuserquestionspro-mcp.mjs');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

function usage() {
  process.stdout.write(`askuserquestionspro — AskUserQuestion için özel AMOLED arayüz

Kullanım:
  askuserquestionspro init        Kurulum (install ile aynı) — hook + MCP kaydı
  askuserquestionspro install     Hook'u Claude Code'a bağla + MCP sunucusunu kaydet
  askuserquestionspro uninstall   Hook'u kaldır
  askuserquestionspro serve       Yerel köprüyü foreground çalıştır (debug, port ${PORT})
  askuserquestionspro mcp         MCP stdio sunucusunu foreground çalıştır (debug)
  askuserquestionspro settings    Ayarları listele (settings get/set <key> [val])
  askuserquestionspro doctor      Kurulum ve köprü durumunu kontrol et
  askuserquestionspro help        Bu mesaj

Kurulumdan sonra yeni bir 'claude' oturumu açın.
`);
}

function cmdInstall() {
  // ponytail: readSettings/writeSettings throw edebilir → try/catch (HIGH #149).
  let settings;
  try {
    settings = readSettings(SETTINGS);
  } catch (err) {
    process.stderr.write(`Hata: ${err.message}\n`);
    process.exit(1);
  }
  const { settings: next, status } = addHook(settings, HOOK_ABS);
  if (status === 'conflict') {
    process.stderr.write(
      `UYARI: settings.json içinde başka bir AskUserQuestion PreToolUse hook'u var.\n` +
        `Tek PreToolUse hook olmalı (Claude Code issue #15897). Elle kontrol edin:\n  ${SETTINGS}\n`
    );
    process.exit(1);
  }
  if (status === 'already') {
    process.stdout.write(`Zaten kurulu → ${SETTINGS}\n`);
    return;
  }
  try {
    writeSettings(SETTINGS, next);
  } catch (err) {
    process.stderr.write(`Hata: ayarlar yazılamadı: ${err.message}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `Hook eklendi → ${SETTINGS}\n` +
      `Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır.\n`
  );

  // MCP sunucusunu claude CLI'ya global kaydet (varsa; yoksa ipucu ver).
  const claudeCheck = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  if (claudeCheck.error && claudeCheck.error.code === 'ENOENT') {
    process.stdout.write(
      `İpucu: claude CLI bulunamadı. MCP aracını elle kaydetmek için:\n` +
        `  claude mcp add --scope user askuserquestionspro -- node "${MCP_ABS}"\n`
    );
  } else {
    // Önce kaldır (idempotent), sonra ekle.
    spawnSync('claude', ['mcp', 'remove', 'askuserquestionspro'], { stdio: 'ignore' });
    const add = spawnSync(
      'claude',
      ['mcp', 'add', '--scope', 'user', 'askuserquestionspro', '--', 'node', MCP_ABS],
      { stdio: 'ignore' }
    );
    if (add.status === 0) {
      process.stdout.write(`MCP aracı (mcp__askuserquestionspro__ask) kaydedildi\n`);
    } else {
      process.stdout.write(
        `MCP kaydı başarısız oldu. Elle kaydetmek için:\n` +
          `  claude mcp add --scope user askuserquestionspro -- node "${MCP_ABS}"\n`
      );
    }
  }
}

function cmdUninstall() {
  // ponytail: readSettings/writeSettings throw edebilir → try/catch (HIGH #149).
  let settings;
  try {
    settings = readSettings(SETTINGS);
  } catch (err) {
    process.stderr.write(`Hata: ${err.message}\n`);
    process.exit(1);
  }
  const { settings: next, status } = removeHook(settings, HOOK_ABS);
  if (status === 'absent') {
    process.stdout.write(`Hook zaten yok → ${SETTINGS}\n`);
    return;
  }
  try {
    writeSettings(SETTINGS, next);
  } catch (err) {
    process.stderr.write(`Hata: ayarlar yazılamadı: ${err.message}\n`);
    process.exit(1);
  }
  process.stdout.write(`Hook kaldırıldı → ${SETTINGS}\n`);
}

function cmdServe() {
  const child = spawn(process.execPath, [SERVER_ABS], { stdio: 'inherit', env: process.env });
  // ponytail: 'error' listener olmadan ENOENT unhandled EventEmitter crash verir (HIGH #156).
  child.on('error', (err) => {
    process.stderr.write(`serve: spawn hatası: ${err.message}\n`);
    process.exit(1);
  });
  // ponytail: signal ile öldürülen child exit code=null; code ?? (signal ? 1 : 0) (LOW #927).
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

// MCP stdio sunucusunu foreground'da çalıştır (debug / manuel test için).
function cmdMcp() {
  const child = spawn(process.execPath, [MCP_ABS], { stdio: 'inherit', env: process.env });
  // ponytail: 'error' listener olmadan ENOENT unhandled EventEmitter crash verir (HIGH #156).
  child.on('error', (err) => {
    process.stderr.write(`mcp: spawn hatası: ${err.message}\n`);
    process.exit(1);
  });
  // ponytail: signal ile öldürülen child exit code=null; code ?? (signal ? 1 : 0) (LOW #927).
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

function cmdSettings(sub, key, val) {
  const cur = Settings.read();
  if (!sub || sub === 'list') {
    for (const g of Schema.groups()) {
      process.stdout.write(`${g}\n`);
      for (const e of Schema.entries().filter((x) => x.group === g)) {
        let line = `  ${e.key} = ${JSON.stringify(cur[e.key])}  (default ${JSON.stringify(e.default)}, ${e.type}`;
        if (e.type === 'select') line += `: ${e.options.map((o) => o.value).join('/')}`;
        process.stdout.write(line + `)\n`);
      }
    }
    process.stdout.write(`\nDosya: ${Settings.getPath()}\n`);
    return;
  }
  if (sub === 'get') {
    if (!Schema.byKey(key)) {
      process.stderr.write(
        `Bilinmeyen key: ${key}. Geçerli: ${Schema.entries()
          .map((e) => e.key)
          .join(', ')}\n`
      );
      process.exit(1);
    }
    process.stdout.write(`${JSON.stringify(cur[key])}\n`);
    return;
  }
  if (sub === 'set') {
    if (!Schema.byKey(key)) {
      process.stderr.write(
        `Bilinmeyen key: ${key}. Geçerli: ${Schema.entries()
          .map((e) => e.key)
          .join(', ')}\n`
      );
      process.exit(1);
    }
    if (val === undefined) {
      process.stderr.write(`settings set <key> için değer eksik.\n`);
      process.exit(1);
    }
    const c = Schema.coerce(key, val);
    if (!c.ok) {
      const e = Schema.byKey(key);
      // ponytail: 'yes/no' da kabul ediliyor ama hint'te eksikti (LOW #907).
      const hint =
        e.type === 'toggle'
          ? 'on/off/yes/no/true/false/1/0'
          : e.options.map((o) => o.value).join('/');
      process.stderr.write(`Geçersiz değer "${val}" for ${key}. Beklenen: ${hint}\n`);
      process.exit(1);
    }
    // Contract W: write() → { ok, value, error? } — başarısızlığı caller'a ilet.
    const r = Settings.write({ [key]: c.value });
    if (!r.ok) {
      process.stderr.write(
        `Hata: ${key} kaydedilemedi: ${r.error ? r.error.message : 'bilinmeyen hata'}\n`
      );
      process.exit(1);
    }
    process.stdout.write(`${key} = ${JSON.stringify(r.value[key])} kaydedildi\n`);
    if (Schema.byKey(key).applies === 'reload')
      process.stdout.write(`Not: açık tarayıcı sekmesini yenileyince tam etkili olur.\n`);
    return;
  }
  process.stderr.write(`Bilinmeyen settings alt komutu: ${sub}\n`);
  process.exit(1);
}

async function cmdDoctor() {
  let ok = true;
  // 1. settings.json'da hook kurulu mu?
  let settings;
  try {
    settings = readSettings(SETTINGS);
  } catch (err) {
    process.stderr.write(`Hata: ${err.message}\n`);
    process.exit(1);
  }
  const { status } = addHook(settings, HOOK_ABS); // 'already' beklenir
  if (status === 'already') {
    process.stdout.write(`✓ Hook kurulu (${SETTINGS})\n`);
  } else if (status === 'conflict') {
    process.stdout.write(
      `✗ Çakışan AskUserQuestion hook'u var — 'askuserquestionspro install' çalıştırın\n`
    );
    ok = false;
  } else {
    process.stdout.write(`✗ Hook kurulu değil — 'askuserquestionspro install' çalıştırın\n`);
    ok = false;
  }
  // 2. Hook dosyası var mı?
  if (require('node:fs').existsSync(HOOK_ABS)) {
    process.stdout.write(`✓ Hook dosyası mevcut (${HOOK_ABS})\n`);
  } else {
    process.stdout.write(`✗ Hook dosyası bulunamadı (${HOOK_ABS})\n`);
    ok = false;
  }
  // 3. Köprü ayakta mı? (opsiyonel — talep gelince spawn olur)
  // ponytail: fetch() timeout yok → AbortController + 2s (HIGH #163).
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    let r;
    try {
      r = await fetch(`${BASE}/health`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    process.stdout.write(
      r.ok ? `✓ Köprü çalışıyor (${BASE})\n` : `· Köprü yanıt verdi ama health başarısız\n`
    );
  } catch {
    process.stdout.write(`· Köprü şu an kapalı (normal — AskUserQuestion'da otomatik başlar)\n`);
  }
  // 4. MCP aracı kayıtlı mı? (bilgi amaçlı — başarısızlık ok'u false yapmaz)
  const mcpList = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8' });
  if (mcpList.error && mcpList.error.code === 'ENOENT') {
    process.stdout.write(`· claude CLI bulunamadı — MCP durumu kontrol edilemedi\n`);
  } else if (mcpList.stdout && mcpList.stdout.includes('askuserquestionspro')) {
    process.stdout.write(`✓ MCP aracı kayıtlı\n`);
  } else {
    process.stdout.write(
      `· MCP aracı kayıtlı değil — 'askuserquestionspro install' veya manuel ` +
        `'claude mcp add' çalıştırın\n`
    );
  }
  // 5. Ayar dosyası durumu (bilgi amaçlı).
  try {
    const p = Settings.getPath();
    if (require('node:fs').existsSync(p)) {
      const raw = JSON.parse(require('node:fs').readFileSync(p, 'utf8'));
      process.stdout.write(
        `✓ Ayar dosyası (${p}) _v=${raw._v} → ${JSON.stringify(Settings.read())}\n`
      );
    } else {
      process.stdout.write(
        `· Ayar dosyası yok (${p}) — varsayılanlar: ${JSON.stringify(Settings.read())}\n`
      );
    }
  } catch (e) {
    process.stdout.write(
      `· Ayar dosyası okunamadı/bozuk — varsayılanlara düşülür: ${JSON.stringify(Settings.read())}\n`
    );
  }
  process.exit(ok ? 0 : 1);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'init':
    case 'install':
      return cmdInstall();
    case 'uninstall':
      return cmdUninstall();
    case 'serve':
      return cmdServe();
    case 'mcp':
      return cmdMcp();
    case 'settings':
      return cmdSettings(process.argv[3], process.argv[4], process.argv[5]);
    case 'doctor':
      return cmdDoctor();
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      return usage();
    default:
      process.stderr.write(`Bilinmeyen komut: ${cmd}\n\n`);
      usage();
      process.exit(1);
  }
}

// ponytail: main() ciplak çağrı → unhandled rejection (HIGH #169). .catch() ile yakala.
main().catch((err) => {
  process.stderr.write(`Beklenmedik hata: ${err.message}\n`);
  process.exit(1);
});
