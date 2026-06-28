'use strict';
// Saf settings.json mantığı: AskUserQuestion PreToolUse hook'unu idempotent
// ekler/kaldırır. I/O sarmalayıcılar en altta. jq bağımlılığı yok (cross-platform).

const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('../lib/atomic-write.cjs');

const MATCHER = 'AskUserQuestion';
const TIMEOUT = 3600;

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

// Bir entry bizim hook'umuz mu? (exact command match ile — prefix yanlış pozitif engeller)
// ponytail: includes() yerine === ile sınır kontrolü.
function isOurEntry(entry, hookAbsPath) {
  if (!isAskUserMatcher(entry)) return false;
  const cmd = hookCommand(hookAbsPath);
  const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
  return hooks.some((h) => typeof h.command === 'string' && h.command === cmd);
}

/**
 * Hook'u idempotent ekler.
 * Önce conflict kontrolü (issue #15897): yabancı AskUserQuestion + bizim birlikte iken
 * conflict maskelenmez.
 * @returns {{ settings: object, status: 'added'|'already'|'conflict' }}
 */
function addHook(settings, hookAbsPath) {
  const out = clone(settings || {});
  out.hooks = out.hooks || {};
  out.hooks.PreToolUse = Array.isArray(out.hooks.PreToolUse) ? out.hooks.PreToolUse : [];
  const pre = out.hooks.PreToolUse;

  // ponytail: conflict ÖNCE kontrol edilir — bizim entry + yabancı birlikte iken
  // 'already' conflict'i maskelemesin (audit LOW #914).
  const hasOurs = pre.some((e) => isOurEntry(e, hookAbsPath));
  const hasForeign = pre.some((e) => isAskUserMatcher(e) && !isOurEntry(e, hookAbsPath));

  if (hasForeign) {
    // Yabancı AskUserQuestion hook var → çakışma (bizim hook da olsa bildir).
    return { settings: out, status: 'conflict' };
  }
  if (hasOurs) {
    return { settings: out, status: 'already' };
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
  let raw;
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Cannot read settings file ${settingsPath}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in settings file ${settingsPath}: ${err.message}`);
  }
}

// writeSettings: atomik tmp→rename kullanır (Critical #1).
function writeSettings(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileAtomic(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

module.exports = { addHook, removeHook, readSettings, writeSettings, hookCommand, ourEntry };
