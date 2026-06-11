#!/usr/bin/env node
'use strict';
// claude-askui — CLI giriş noktası.
//   install    hook'u ~/.claude/settings.json'a bağla
//   uninstall  hook'u kaldır
//   serve      yerel köprüyü foreground çalıştır (debug)
//   doctor     kurulum + health kontrol
//   help       kullanım

const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { addHook, removeHook, readSettings, writeSettings } = require('./install.js');

const PKG_ROOT = path.join(__dirname, '..');
const HOOK_ABS = path.join(PKG_ROOT, 'hooks', 'askuser-bridge.mjs');
const SERVER_ABS = path.join(PKG_ROOT, 'server', 'server.js');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

function usage() {
  process.stdout.write(`claude-askui — AskUserQuestion için özel AMOLED arayüz

Kullanım:
  claude-askui install     Hook'u Claude Code'a bağla (~/.claude/settings.json)
  claude-askui uninstall   Hook'u kaldır
  claude-askui serve       Yerel köprüyü foreground çalıştır (debug, port ${PORT})
  claude-askui doctor      Kurulum ve köprü durumunu kontrol et
  claude-askui help        Bu mesaj

Kurulumdan sonra yeni bir 'claude' oturumu açın.
`);
}

function cmdInstall() {
  const settings = readSettings(SETTINGS);
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
  writeSettings(SETTINGS, next);
  process.stdout.write(
    `Hook eklendi → ${SETTINGS}\n` +
    `Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır.\n`
  );
}

function cmdUninstall() {
  const settings = readSettings(SETTINGS);
  const { settings: next, status } = removeHook(settings, HOOK_ABS);
  if (status === 'absent') {
    process.stdout.write(`Hook zaten yok → ${SETTINGS}\n`);
    return;
  }
  writeSettings(SETTINGS, next);
  process.stdout.write(`Hook kaldırıldı → ${SETTINGS}\n`);
}

function cmdServe() {
  const child = spawn(process.execPath, [SERVER_ABS], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => process.exit(code || 0));
}

async function cmdDoctor() {
  let ok = true;
  // 1. settings.json'da hook kurulu mu?
  const settings = readSettings(SETTINGS);
  const { status } = addHook(settings, HOOK_ABS); // 'already' beklenir
  if (status === 'already') {
    process.stdout.write(`✓ Hook kurulu (${SETTINGS})\n`);
  } else if (status === 'conflict') {
    process.stdout.write(`✗ Çakışan AskUserQuestion hook'u var — 'claude-askui install' çalıştırın\n`);
    ok = false;
  } else {
    process.stdout.write(`✗ Hook kurulu değil — 'claude-askui install' çalıştırın\n`);
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
  try {
    const r = await fetch(`${BASE}/health`);
    process.stdout.write(r.ok ? `✓ Köprü çalışıyor (${BASE})\n` : `· Köprü yanıt verdi ama health başarısız\n`);
  } catch {
    process.stdout.write(`· Köprü şu an kapalı (normal — AskUserQuestion'da otomatik başlar)\n`);
  }
  process.exit(ok ? 0 : 1);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'install': return cmdInstall();
    case 'uninstall': return cmdUninstall();
    case 'serve': return cmdServe();
    case 'doctor': return cmdDoctor();
    case 'help': case '--help': case '-h': case undefined: return usage();
    default:
      process.stderr.write(`Bilinmeyen komut: ${cmd}\n\n`);
      usage();
      process.exit(1);
  }
}

main();
