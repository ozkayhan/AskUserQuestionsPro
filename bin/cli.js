#!/usr/bin/env node
'use strict';
// askuserquestionspro — CLI giriş noktası.
//   init       install ile aynı (host adaptörleri + MCP + skill kurulumu)
//   install    Claude Code ve/veya Codex App/CLI entegrasyonunu kur
//   uninstall  seçilen host entegrasyonlarını kaldır
//   serve      yerel köprüyü foreground çalıştır (debug)
//   mcp        MCP sunucusunu foreground çalıştır (stdio, debug)
//   doctor     kurulum + health kontrol
//   help       kullanım

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { addHook, removeHook, readSettings, writeSettings } = require('./install.js');
const Settings = require('../lib/settings.js');
const { writeFileAtomic } = require('../lib/atomic-write.cjs');
const Schema = require('../web/settings-schema.js');
const {
  HOSTS,
  DEFAULT_CODEX_TOOL_TIMEOUT_SEC,
  manualMcpCommand,
  mcpArgs,
  mcpToolTimeoutSec,
  parseTarget,
  resolveExecutable,
  selectedHosts,
  setMcpToolTimeoutSec,
  skillDestination,
} = require('../lib/host-platforms.cjs');

const PKG_ROOT = path.join(__dirname, '..');
const HOOK_ABS = path.join(PKG_ROOT, 'hooks', 'askuserquestionspro-bridge.mjs');
const SERVER_ABS = path.join(PKG_ROOT, 'server', 'server.js');
const MCP_ABS = path.join(PKG_ROOT, 'mcp-server', 'askuserquestionspro-mcp.mjs');
const SKILL_SOURCE = path.join(PKG_ROOT, 'skill', 'askpro');
const CLAUDE_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

function usage() {
  process.stdout.write(`askuserquestionspro — Claude Code ve Codex için tam ekran soru arayüzü

Kullanım:
  askuserquestionspro init [--target auto|all|claude|codex]
  askuserquestionspro install [--target auto|all|claude|codex]
  askuserquestionspro uninstall [--target auto|all|claude|codex]
  askuserquestionspro serve       Yerel köprüyü foreground çalıştır (debug, port ${PORT})
  askuserquestionspro mcp         MCP stdio sunucusunu foreground çalıştır (debug)
  askuserquestionspro settings    Ayarları listele (settings get/set <key> [val])
  askuserquestionspro settings export
  askuserquestionspro settings import-preview <file|->
  askuserquestionspro settings reset <namespace>
  askuserquestionspro doctor [--target auto|all|claude|codex]
  askuserquestionspro help        Bu mesaj

Varsayılan target=auto: makinede bulunan hostları algılar. Kurulumdan sonra yeni
bir Claude Code/Codex oturumu açın veya ChatGPT masaüstü uygulamasını yeniden başlatın.
`);
}

function fileContains(file, needle) {
  try {
    return fs.readFileSync(file, 'utf8').includes(needle);
  } catch {
    return false;
  }
}

function hasHostArtifacts(host) {
  if (fs.existsSync(path.join(skillDestination(host, os.homedir()), 'SKILL.md'))) return true;
  if (host === 'claude') return fileContains(CLAUDE_SETTINGS, 'askuserquestionspro');
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return fileContains(path.join(codexHome, 'config.toml'), 'mcp_servers.askuserquestionspro');
}

function hasCodexMcpArtifact() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return fileContains(path.join(codexHome, 'config.toml'), 'mcp_servers.askuserquestionspro');
}

function hostContext(target, operation) {
  const executables = {
    claude: resolveExecutable('claude', spawnSync),
    codex: resolveExecutable('codex', spawnSync),
  };
  const discoverable =
    operation === 'install'
      ? executables
      : {
          claude: executables.claude || hasHostArtifacts('claude'),
          codex: executables.codex || hasHostArtifacts('codex'),
        };
  let hosts = selectedHosts(target, discoverable);
  if (target === 'auto' && hosts.length === 0 && operation === 'install') {
    hosts = ['claude'];
    process.stdout.write(
      `· Claude/Codex komutu algılanamadı; geriye uyumluluk için Claude dosyaları hazırlanacak.\n`
    );
  }
  return { executables, hosts };
}

function deploySkill(host) {
  const destination = skillDestination(host, os.homedir());
  if (!fs.existsSync(path.join(SKILL_SOURCE, 'SKILL.md'))) {
    throw new Error(`skill kaynağı bulunamadı: ${SKILL_SOURCE}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.tmp.${process.pid}`;
  const backup = `${destination}.bak.${process.pid}`;
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(backup, { recursive: true, force: true });
  fs.cpSync(SKILL_SOURCE, temp, { recursive: true });
  let movedOld = false;
  try {
    if (fs.existsSync(destination)) {
      fs.renameSync(destination, backup);
      movedOld = true;
    }
    fs.renameSync(temp, destination);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    if (movedOld && !fs.existsSync(destination)) fs.renameSync(backup, destination);
    throw error;
  }
  process.stdout.write(`✓ ${HOSTS[host].label} skill → ${destination}\n`);
}

function registerMcp(host, executable, { optional = false } = {}) {
  if (!executable) {
    process.stderr.write(
      `${optional ? '·' : '✗'} ${HOSTS[host].label} komutu bulunamadı. MCP'yi elle kaydedin:\n  ${manualMcpCommand(host, MCP_ABS)}\n`
    );
    return optional;
  }
  if (host === 'codex') {
    fs.mkdirSync(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), { recursive: true });
  }
  if (host === 'claude') {
    const current = spawnSync(executable, mcpArgs(host, 'check', MCP_ABS), { encoding: 'utf8' });
    if (
      current.status === 0 &&
      `${current.stdout || ''}${current.stderr || ''}`.includes('askuserquestionspro')
    ) {
      const inspected = spawnSync(executable, mcpArgs(host, 'inspect', MCP_ABS), {
        encoding: 'utf8',
      });
      if (
        inspected.status === 0 &&
        `${inspected.stdout || ''}${inspected.stderr || ''}`.includes(MCP_ABS)
      ) {
        process.stdout.write(`✓ Claude Code MCP aracı zaten doğru path ile kayıtlı\n`);
        return true;
      }
      process.stderr.write(
        `✗ Claude Code MCP kaydı eski veya doğrulanamıyor; çalışan kaydı silmedim. Elle kaldırıp yeniden kurun.\n`
      );
      return false;
    }
  }
  const add = spawnSync(executable, mcpArgs(host, 'add', MCP_ABS), { stdio: 'ignore' });
  if (add.status !== 0) {
    process.stderr.write(
      `✗ ${HOSTS[host].label} MCP kaydı başarısız. Elle deneyin:\n  ${manualMcpCommand(host, MCP_ABS)}\n`
    );
    return false;
  }
  if (host === 'codex') {
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const configPath = path.join(codexHome, 'config.toml');
    try {
      const currentConfig = fs.readFileSync(configPath, 'utf8');
      const previousTimeout = mcpToolTimeoutSec(currentConfig);
      if (previousTimeout !== DEFAULT_CODEX_TOOL_TIMEOUT_SEC) {
        const nextConfig = setMcpToolTimeoutSec(currentConfig, DEFAULT_CODEX_TOOL_TIMEOUT_SEC);
        writeFileAtomic(configPath, nextConfig);
      }
      process.stdout.write(
        `✓ Codex MCP tool timeout → ${DEFAULT_CODEX_TOOL_TIMEOUT_SEC}s (${configPath})\n`
      );
    } catch (error) {
      process.stderr.write(
        `✗ Codex MCP kaydı yapıldı ancak tool_timeout_sec ayarlanamadı: ${error.message}\n` +
          `  ${configPath} içindeki [mcp_servers.askuserquestionspro] bölümüne tool_timeout_sec = ${DEFAULT_CODEX_TOOL_TIMEOUT_SEC} ekleyin.\n`
      );
      return false;
    }
  }
  process.stdout.write(`✓ ${HOSTS[host].label} MCP aracı kaydedildi\n`);
  return true;
}

function installClaudeHook() {
  let settings;
  try {
    settings = readSettings(CLAUDE_SETTINGS);
  } catch (err) {
    process.stderr.write(`✗ ${err.message}\n`);
    return false;
  }
  const { settings: next, status } = addHook(settings, HOOK_ABS);
  if (status === 'conflict') {
    process.stderr.write(
      `✗ ${CLAUDE_SETTINGS} içinde başka bir AskUserQuestion PreToolUse hook'u var.\n` +
        `  Claude Code issue #15897 nedeniyle elle çözülmeli.\n`
    );
    return false;
  }
  if (status === 'added') {
    try {
      writeSettings(CLAUDE_SETTINGS, next);
    } catch (err) {
      process.stderr.write(`✗ Claude hook ayarları yazılamadı: ${err.message}\n`);
      return false;
    }
    process.stdout.write(`✓ Claude AskUserQuestion hook'u → ${CLAUDE_SETTINGS}\n`);
  } else {
    process.stdout.write(`✓ Claude hook zaten kurulu → ${CLAUDE_SETTINGS}\n`);
  }
  return true;
}

function cmdInstall(argv) {
  const target = parseTarget(argv);
  const { executables, hosts } = hostContext(target, 'install');
  let ok = true;
  for (const host of hosts) {
    if (host === 'claude') ok = installClaudeHook() && ok;
    try {
      deploySkill(host);
    } catch (err) {
      process.stderr.write(`✗ ${HOSTS[host].label}: ${err.message}\n`);
      ok = false;
    }
    ok =
      registerMcp(host, executables[host], {
        optional: target === 'auto' && !executables[host],
      }) && ok;
  }
  if (hosts.includes('codex')) {
    process.stdout.write(
      `Codex App/CLI aynı MCP ayarını paylaşır. Yeni görev/oturum açın ve masaüstü uygulamasını yeniden başlatın.\n`
    );
  }
  if (!ok) process.exitCode = 1;
}

function removeClaudeHook() {
  let settings;
  try {
    settings = readSettings(CLAUDE_SETTINGS);
  } catch (err) {
    process.stderr.write(`✗ ${err.message}\n`);
    return false;
  }
  const { settings: next, status } = removeHook(settings, HOOK_ABS);
  if (status === 'absent') {
    process.stdout.write(`· Claude hook zaten yok → ${CLAUDE_SETTINGS}\n`);
    return true;
  }
  try {
    writeSettings(CLAUDE_SETTINGS, next);
  } catch (err) {
    process.stderr.write(`✗ Claude hook ayarları yazılamadı: ${err.message}\n`);
    return false;
  }
  process.stdout.write(`✓ Claude hook kaldırıldı → ${CLAUDE_SETTINGS}\n`);
  return true;
}

function cmdUninstall(argv) {
  const target = parseTarget(argv);
  const { executables, hosts } = hostContext(target, 'uninstall');
  let ok = true;
  for (const host of hosts) {
    if (host === 'claude') ok = removeClaudeHook() && ok;
    const skill = skillDestination(host, os.homedir());
    fs.rmSync(skill, { recursive: true, force: true });
    process.stdout.write(`✓ ${HOSTS[host].label} skill kaldırıldı → ${skill}\n`);
    const executable = executables[host];
    if (!executable) {
      if (host === 'codex' && hasCodexMcpArtifact()) {
        process.stderr.write(
          `✗ Codex komutu yok; ${process.env.CODEX_HOME || path.join(os.homedir(), '.codex')}/config.toml içindeki MCP kaydı kaldırılamadı\n`
        );
        ok = false;
      } else {
        process.stdout.write(`· ${HOSTS[host].label} komutu yok; MCP kaydı bulunamadı\n`);
      }
      continue;
    }
    const check = spawnSync(executable, mcpArgs(host, 'check', MCP_ABS), { encoding: 'utf8' });
    const present =
      check.status === 0 &&
      (host === 'codex' ||
        `${check.stdout || ''}${check.stderr || ''}`.includes('askuserquestionspro'));
    if (!present) {
      process.stdout.write(`· ${HOSTS[host].label} MCP kaydı zaten yok\n`);
      continue;
    }
    const remove = spawnSync(executable, mcpArgs(host, 'remove', MCP_ABS), {
      stdio: 'ignore',
    });
    if (remove.error || remove.status !== 0) {
      process.stderr.write(`✗ ${HOSTS[host].label} MCP kaydı kaldırılamadı\n`);
      ok = false;
    } else {
      process.stdout.write(`✓ ${HOSTS[host].label} MCP kaydı kaldırıldı\n`);
    }
  }
  if (!ok) process.exitCode = 1;
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
  if (sub === 'export') {
    process.stdout.write(JSON.stringify(Settings.inspect().effective, null, 2) + '\n');
    return;
  }
  if (sub === 'import-preview') {
    let raw;
    try { raw = key === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(key, 'utf8'); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 64; return; }
    if (Buffer.byteLength(raw) > 8e6) { process.stderr.write('Import too large\n'); process.exitCode = 2; return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { process.stderr.write('Invalid JSON\n'); process.exitCode = 2; return; }
    const result = Schema.inspectEnvelope(parsed);
    process.stdout.write(JSON.stringify({ status: result.status, valid: result.valid, migration: result.migrated, ignored: result.ignored || { count: 0, truncated: false }, canApply: result.valid && result.status !== 'unsupported-future' }) + '\n');
    process.exitCode = result.valid && result.status !== 'unsupported-future' ? 0 : 2;
    return;
  }
  if (sub === 'reset') {
    const defaults = Schema.namespaceDefaults();
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) { process.stderr.write(`Unknown namespace: ${key}\n`); process.exitCode = 64; return; }
    const result = Settings.mutateCompareAndSwap(Settings.inspect().revision, (current) => ({ ...current, [key]: defaults[key] }));
    if (!result.ok) { process.stderr.write(`${result.code}\n`); process.exitCode = 2; return; }
    process.stdout.write(JSON.stringify({ ok: true, namespace: key }) + '\n');
    return;
  }
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

function doctorClaudeHook() {
  let settings;
  try {
    settings = readSettings(CLAUDE_SETTINGS);
  } catch (err) {
    process.stdout.write(`✗ Claude settings okunamadı: ${err.message}\n`);
    return false;
  }
  const { status } = addHook(settings, HOOK_ABS);
  if (status === 'already') {
    process.stdout.write(`✓ Claude hook kurulu (${CLAUDE_SETTINGS})\n`);
    return true;
  }
  if (status === 'conflict') {
    process.stdout.write(`✗ Claude'da çakışan AskUserQuestion hook'u var\n`);
  } else {
    process.stdout.write(`✗ Claude hook kurulu değil\n`);
  }
  return false;
}

function doctorMcp(host, executable, { optional = false } = {}) {
  if (!executable) {
    process.stdout.write(
      `${optional ? '·' : '✗'} ${HOSTS[host].label} komutu bulunamadı${optional ? ' (MCP kaydı elle doğrulanmalı)' : ''}\n`
    );
    return optional;
  }
  const result = spawnSync(executable, mcpArgs(host, 'check', MCP_ABS), { encoding: 'utf8' });
  let installed = false;
  if (host === 'codex' && result.status === 0) {
    try {
      const config = JSON.parse(result.stdout);
      installed =
        config?.transport?.type === 'stdio' &&
        config.transport.command === process.execPath &&
        Array.isArray(config.transport.args) &&
        config.transport.args.length === 1 &&
        path.resolve(config.transport.args[0]) === path.resolve(MCP_ABS) &&
        Number(config.tool_timeout_sec) >= DEFAULT_CODEX_TOOL_TIMEOUT_SEC;
    } catch {
      installed = false;
    }
  } else if (host === 'claude') {
    const named =
      result.status === 0 &&
      `${result.stdout || ''}${result.stderr || ''}`.includes('askuserquestionspro');
    if (named) {
      const inspected = spawnSync(executable, mcpArgs(host, 'inspect', MCP_ABS), {
        encoding: 'utf8',
      });
      installed =
        inspected.status === 0 &&
        `${inspected.stdout || ''}${inspected.stderr || ''}`.includes(MCP_ABS);
    }
  }
  process.stdout.write(
    installed
      ? `✓ ${HOSTS[host].label} MCP kaydı kurulu\n`
      : `✗ ${HOSTS[host].label} MCP kaydı bulunamadı\n`
  );
  return installed;
}

async function cmdDoctor(argv) {
  const target = parseTarget(argv);
  const { executables, hosts } = hostContext(target, 'doctor');
  let ok = true;
  for (const host of hosts) {
    process.stdout.write(`\n[${HOSTS[host].label}]\n`);
    if (host === 'claude') ok = doctorClaudeHook() && ok;
    const skill = skillDestination(host, os.homedir());
    if (fs.existsSync(path.join(skill, 'SKILL.md'))) {
      process.stdout.write(`✓ skill kurulu (${skill})\n`);
    } else {
      process.stdout.write(`✗ skill kurulu değil (${skill})\n`);
      ok = false;
    }
    ok =
      doctorMcp(host, executables[host], {
        optional: target === 'auto' && !executables[host],
      }) && ok;
  }
  if (fs.existsSync(HOOK_ABS)) {
    process.stdout.write(`✓ Paket dosyaları mevcut (${PKG_ROOT})\n`);
  } else {
    process.stdout.write(`✗ Paket dosyaları eksik (${PKG_ROOT})\n`);
    ok = false;
  }
  // Köprü ayakta mı? (opsiyonel — talep gelince spawn olur)
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
    process.stdout.write(`· Köprü şu an kapalı (normal — ilk askpro çağrısında otomatik başlar)\n`);
  }
  // Ayar dosyası durumu (bilgi amaçlı).
  try {
    const p = Settings.getPath();
    if (fs.existsSync(p)) {
      process.stdout.write(`✓ Ayar dosyası durumu: ${JSON.stringify(Settings.doctorProjection(Settings.inspectReadOnly()))}\n`);
    } else {
      process.stdout.write(`· Ayar dosyası yok — varsayılanlar: ${JSON.stringify(Settings.doctorProjection(Settings.inspectReadOnly()))}\n`);
    }
  } catch (e) {
      process.stdout.write(`· Ayar dosyası okunamadı/bozuk — varsayılanlara düşülür: ${JSON.stringify(Settings.doctorProjection(Settings.inspectReadOnly()))}\n`);
  }
  if (!ok) process.exitCode = 1;
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'init':
    case 'install':
      return cmdInstall(process.argv.slice(3));
    case 'uninstall':
      return cmdUninstall(process.argv.slice(3));
    case 'serve':
      return cmdServe();
    case 'mcp':
      return cmdMcp();
    case 'settings':
      return cmdSettings(process.argv[3], process.argv[4], process.argv[5]);
    case 'doctor':
      return cmdDoctor(process.argv.slice(3));
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
