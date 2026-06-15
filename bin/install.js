'use strict';
// Saf settings.json mantığı: AskUserQuestion PreToolUse hook'unu idempotent
// ekler/kaldırır. I/O sarmalayıcılar en altta. jq bağımlılığı yok (cross-platform).

const fs = require('node:fs');
const path = require('node:path');

const MATCHER = 'AskUserQuestion';
const TIMEOUT = 360;

function hookCommand(hookAbsPath) {
  // Yolu çift tırnakla sar: "Application Support" gibi boşluk içeren yollarda
  // node'un "Cannot find module" hatasını önler (B7).
  return `node "${hookAbsPath}"`;
}

function ourEntry(hookAbsPath) {
  return {
    matcher: MATCHER,
    hooks: [{ type: 'command', command: hookCommand(hookAbsPath), timeout: TIMEOUT }],
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// Bir PreToolUse entry'si AskUserQuestion'ı hedefliyor mu?
function isAskUserMatcher(entry) {
  return entry && entry.matcher === MATCHER;
}

// Bir entry bizim hook'umuz mu? (komut içinde hook path'i geçiyorsa)
function isOurEntry(entry, hookAbsPath) {
  if (!isAskUserMatcher(entry)) return false;
  const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
  return hooks.some((h) => typeof h.command === 'string' && h.command.includes(hookAbsPath));
}

/**
 * Hook'u idempotent ekler.
 * @returns {{ settings: object, status: 'added'|'already'|'conflict' }}
 */
function addHook(settings, hookAbsPath) {
  const out = clone(settings || {});
  out.hooks = out.hooks || {};
  out.hooks.PreToolUse = Array.isArray(out.hooks.PreToolUse) ? out.hooks.PreToolUse : [];
  const pre = out.hooks.PreToolUse;

  if (pre.some((e) => isOurEntry(e, hookAbsPath))) {
    return { settings: out, status: 'already' };
  }
  // Bizim olmayan ama AskUserQuestion'ı hedefleyen başka hook → çakışma (issue #15897).
  if (pre.some((e) => isAskUserMatcher(e))) {
    return { settings: out, status: 'conflict' };
  }
  pre.push(ourEntry(hookAbsPath));
  return { settings: out, status: 'added' };
}

/**
 * Sadece bizim hook entry'mizi kaldırır.
 * @returns {{ settings: object, status: 'removed'|'absent' }}
 */
function removeHook(settings, hookAbsPath) {
  const out = clone(settings || {});
  const pre = out.hooks && Array.isArray(out.hooks.PreToolUse) ? out.hooks.PreToolUse : null;
  if (!pre || !pre.some((e) => isOurEntry(e, hookAbsPath))) {
    return { settings: out, status: 'absent' };
  }
  out.hooks.PreToolUse = pre.filter((e) => !isOurEntry(e, hookAbsPath));
  return { settings: out, status: 'removed' };
}

// --- I/O sarmalayıcılar (CLI'dan çağrılır) ---

function readSettings(settingsPath) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

module.exports = { addHook, removeHook, readSettings, writeSettings, hookCommand, ourEntry };
