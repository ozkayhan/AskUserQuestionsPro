'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { addHook, removeHook } = require('../bin/install.js');

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
