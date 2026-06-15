#!/usr/bin/env node
'use strict';
// claude-askui — CLI giriş noktası.
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

const PKG_ROOT = path.join(__dirname, '..');
const HOOK_ABS = path.join(PKG_ROOT, 'hooks', 'askuser-bridge.mjs');
const SERVER_ABS = path.join(PKG_ROOT, 'server', 'server.js');
const MCP_ABS = path.join(PKG_ROOT, 'mcp-server', 'askui-mcp.mjs');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

function usage() {
  process.stdout.write(`claude-askui — AskUserQuestion için özel AMOLED arayüz

Kullanım:
  claude-askui install     Hook'u Claude Code'a bağla + MCP sunucusunu kaydet
  claude-askui uninstall   Hook'u kaldır
  claude-askui serve       Yerel köprüyü foreground çalıştır (debug, port ${PORT})
  claude-askui mcp         MCP stdio sunucusunu foreground çalıştır (debug)
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

  // MCP sunucusunu claude CLI'ya global kaydet (varsa; yoksa ipucu ver).
  const claudeCheck = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  if (claudeCheck.error && claudeCheck.error.code === 'ENOENT') {
    process.stdout.write(
      `İpucu: claude CLI bulunamadı. MCP aracını elle kaydetmek için:\n` +
      `  claude mcp add --scope user askui -- node "${MCP_ABS}"\n`
    );
  } else {
    // Önce kaldır (idempotent), sonra ekle.
    spawnSync('claude', ['mcp', 'remove', 'askui'], { stdio: 'ignore' });
    const add = spawnSync('claude', ['mcp', 'add', '--scope', 'user', 'askui', '--', 'node', MCP_ABS], { stdio: 'ignore' });
    if (add.status === 0) {
      process.stdout.write(`MCP aracı (mcp__askui__ask) kaydedildi\n`);
    } else {
      process.stdout.write(
        `MCP kaydı başarısız oldu. Elle kaydetmek için:\n` +
        `  claude mcp add --scope user askui -- node "${MCP_ABS}"\n`
      );
    }
  }
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

// MCP stdio sunucusunu foreground'da çalıştır (debug / manuel test için).
function cmdMcp() {
  const child = spawn(process.execPath, [MCP_ABS], { stdio: 'inherit', env: process.env });
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
  // 4. MCP aracı kayıtlı mı? (bilgi amaçlı — başarısızlık ok'u false yapmaz)
  const mcpList = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8' });
  if (mcpList.error && mcpList.error.code === 'ENOENT') {
    process.stdout.write(`· claude CLI bulunamadı — MCP durumu kontrol edilemedi\n`);
  } else if (mcpList.stdout && mcpList.stdout.includes('askui')) {
    process.stdout.write(`✓ MCP aracı kayıtlı\n`);
  } else {
    process.stdout.write(
      `· MCP aracı kayıtlı değil — 'claude-askui install' veya manuel ` +
      `'claude mcp add' çalıştırın\n`
    );
  }
  process.exit(ok ? 0 : 1);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'install': return cmdInstall();
    case 'uninstall': return cmdUninstall();
    case 'serve': return cmdServe();
    case 'mcp': return cmdMcp();
    case 'doctor': return cmdDoctor();
    case 'help': case '--help': case '-h': case undefined: return usage();
    default:
      process.stderr.write(`Bilinmeyen komut: ${cmd}\n\n`);
      usage();
      process.exit(1);
  }
}

main();
