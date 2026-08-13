'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  addHook,
  removeHook,
  readSettings,
  writeSettings,
  hookCommand,
} = require('../bin/install.js');

const HOOK = '/abs/path/hooks/askuserquestionspro-bridge.mjs';
const CMD = `node "${HOOK}"`;

function ourEntry() {
  return {
    matcher: 'AskUserQuestion',
    hooks: [{ type: 'command', command: CMD, timeout: 3600 }],
  };
}

test('addHook: boş settings → added, doğru şekil', () => {
  const { settings, status } = addHook({}, HOOK);
  assert.strictEqual(status, 'added');
  assert.deepStrictEqual(settings.hooks.PreToolUse, [ourEntry()]);
});

test('addHook: bizim hook zaten var → already, çift eklemez', () => {
  const start = { hooks: { PreToolUse: [ourEntry()] } };
  const { settings, status } = addHook(start, HOOK);
  assert.strictEqual(status, 'already');
  assert.strictEqual(settings.hooks.PreToolUse.length, 1);
});

test('addHook: başka AskUserQuestion hook var → conflict, dokunmaz', () => {
  const foreign = {
    matcher: 'AskUserQuestion',
    hooks: [{ type: 'command', command: 'node /other/thing.js' }],
  };
  const start = { hooks: { PreToolUse: [foreign] } };
  const { settings, status } = addHook(start, HOOK);
  assert.strictEqual(status, 'conflict');
  assert.deepStrictEqual(settings.hooks.PreToolUse, [foreign]);
});

test('addHook: var olan başka matcher korunur', () => {
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] };
  const start = { hooks: { PreToolUse: [other] } };
  const { settings, status } = addHook(start, HOOK);
  assert.strictEqual(status, 'added');
  assert.deepStrictEqual(settings.hooks.PreToolUse, [other, ourEntry()]);
});

test('removeHook: mevcut → removed, PreToolUse temizlenir', () => {
  const start = { hooks: { PreToolUse: [ourEntry()] } };
  const { settings, status } = removeHook(start, HOOK);
  assert.strictEqual(status, 'removed');
  assert.ok(
    !settings.hooks || !settings.hooks.PreToolUse || settings.hooks.PreToolUse.length === 0
  );
});

test('removeHook: yok → absent', () => {
  const { settings, status } = removeHook({}, HOOK);
  assert.strictEqual(status, 'absent');
  assert.deepStrictEqual(settings, {});
});

test('removeHook: başka matcher korunur, sadece bizim silinir', () => {
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] };
  const start = { hooks: { PreToolUse: [other, ourEntry()] } };
  const { settings, status } = removeHook(start, HOOK);
  assert.strictEqual(status, 'removed');
  assert.deepStrictEqual(settings.hooks.PreToolUse, [other]);
});

test('round-trip: add sonra remove → orijinale eşit', () => {
  const orig = { someKey: 1, hooks: { PreToolUse: [] } };
  const added = addHook(JSON.parse(JSON.stringify(orig)), HOOK).settings;
  const back = removeHook(added, HOOK).settings;
  // boşalan PreToolUse [] olarak kalmalı, someKey korunmalı
  assert.strictEqual(back.someKey, 1);
  assert.deepStrictEqual(back.hooks.PreToolUse, []);
});

test('addHook girdiyi mutasyona uğratmaz (saf)', () => {
  const start = { hooks: { PreToolUse: [] } };
  const snapshot = JSON.stringify(start);
  addHook(start, HOOK);
  assert.strictEqual(JSON.stringify(start), snapshot);
});

// ── Conflict-before-already (LOW #914) ───────────────────────────────
// Bizim entry + yabancı AskUserQuestion entry birlikte iken 'conflict' dönmeli,
// 'already' conflict'i maskelememeli.
test('addHook: bizim entry + yabancı AskUserQuestion birlikte → conflict (maskeleme yok)', () => {
  const foreign = {
    matcher: 'AskUserQuestion',
    hooks: [{ type: 'command', command: 'node /other/bridge.js' }],
  };
  const start = { hooks: { PreToolUse: [ourEntry(), foreign] } };
  const { status } = addHook(start, HOOK);
  assert.strictEqual(status, 'conflict', 'yabancı hook varsa conflict döndürmeli');
});

// ── isOurEntry exact-match (LOW #921) ────────────────────────────────
// Path-prefix çakışmasında yanlış pozitif olmamalı.
test('isOurEntry: prefix içeren farklı path → false (yanlış pozitif yok)', () => {
  // Modülü içe aktarıp isOurEntry'e ulaş — export edilmemişse hookCommand üzerinden test et.
  // Farklı bir path (HOOK'u prefix olarak içeren) bizim entry sayılmamalı.
  const longerHook = HOOK + '-extra';
  const longerCmd = `node "${longerHook}"`;
  const entry = {
    matcher: 'AskUserQuestion',
    hooks: [{ type: 'command', command: longerCmd, timeout: 3600 }],
  };
  // addHook ile test: longer path'li entry varken ekleme yapılmalı (already değil).
  const start = { hooks: { PreToolUse: [entry] } };
  // longer entry yabancı (bizim değil, AskUser matcher) → conflict
  const { status } = addHook(start, HOOK);
  assert.strictEqual(status, 'conflict', 'farklı path → bizim entry sayılmamalı → conflict');
});

test('hookCommand: path boşluk içeriyorsa çift tırnakla sarılır', () => {
  const cmd = hookCommand('/path/with spaces/hook.mjs');
  assert.ok(cmd.includes('"'), 'çift tırnak içermeli');
  assert.strictEqual(cmd, 'node "/path/with spaces/hook.mjs"');
});

// ── writeSettings atomik (Critical #1) ───────────────────────────────
test('writeSettings: tmp→rename atomik, sonuç okunabilir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-ws-'));
  try {
    const file = path.join(dir, 'settings.json');
    writeSettings(file, { hooks: { PreToolUse: [] } });
    assert.ok(fs.existsSync(file), 'dosya oluşturulmalı');
    assert.ok(!fs.existsSync(file + '.tmp.' + process.pid), '.tmp kalmamali');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(parsed, { hooks: { PreToolUse: [] } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSettings: yazılamaz dizin → throw eder, orijinal korunur', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-ws-'));
  const file = path.join(dir, 'settings.json');
  // Önce geçerli içerik yaz.
  fs.writeFileSync(file, '{"original":true}\n', 'utf8');
  try {
    const deniedFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'mkdirSync') {
          return () => {
            throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
          };
        }
        return target[property];
      },
    });
    assert.throws(
      () => writeSettings(file, { overwrite: true }, { fs: deniedFs }),
      /EACCES|permission denied/
    );
    // Orijinal bozulmamış olmalı.
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('"original"'), 'orijinal içerik korunmalı');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── readSettings ─────────────────────────────────────────────────────
test('readSettings: ENOENT → boş obje döner', () => {
  const result = readSettings('/non/existent/path/settings.json');
  assert.deepStrictEqual(result, {});
});

test('readSettings: bozuk JSON → throw eder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-rs-'));
  try {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, '{ bozuk', 'utf8');
    assert.throws(() => readSettings(file), /Invalid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readSettings: EACCES → throw eder', () => {
  const deniedFs = new Proxy(fs, {
    get(target, property) {
      if (property === 'readFileSync') {
        return () => {
          throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
        };
      }
      return target[property];
    },
  });
  assert.throws(
    () => readSettings('/isolated/settings.json', { fs: deniedFs }),
    /Cannot read settings file.*permission denied/
  );
});
