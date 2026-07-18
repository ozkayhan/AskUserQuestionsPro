'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Schema = require('../web/settings-schema.js');
const {
  adapterEnabled,
  diagnosticsPolicy,
  deliveryPolicy,
  closurePolicy,
} = require('../lib/runtime-settings.cjs');
test('runtime settings matrix has an owner for every field', () => {
  assert.ok(Schema.matrix().every((field) => field.owner && field.effect));
});
test('future and invalid settings refuse runtime mutation', () => {
  assert.strictEqual(Schema.inspectEnvelope({ _v: 999 }).valid, false);
  assert.strictEqual(
    Schema.validateEnvelope({ recovery: { retentionMs: 0 } }).recovery.retentionMs,
    3600000
  );
});

test('runtime matrix owner hooks change behavior for every runtime field', () => {
  const settings = Schema.envelopeDefaults();
  settings.delivery.mode = 'confirm';
  settings.delivery.retryMs = 2500;
  settings.closure.mode = 'after-delivery';
  settings.adapters.claudeEnabled = false;
  settings.adapters.codexEnabled = false;
  settings.diagnostics.enabled = true;
  settings.diagnostics.includePaths = false;
  assert.deepStrictEqual(deliveryPolicy(settings), {
    mode: 'confirm',
    retryMs: 2500,
    acknowledgement: 'explicit-recovery',
  });
  assert.deepStrictEqual(closurePolicy(settings), { mode: 'after-delivery' });
  assert.equal(adapterEnabled('claude', settings), false);
  assert.equal(adapterEnabled('codex', settings), false);
  const diagnostics = diagnosticsPolicy(settings);
  assert.equal(diagnostics.enabled, true);
  assert.deepStrictEqual(diagnostics.redact({ boundary: 'hook', path: '/secret/file' }), {
    boundary: 'hook',
  });
  settings.diagnostics.includePaths = true;
  assert.equal(diagnosticsPolicy(settings).redact({ path: '/secret/file' }).path, '/secret/file');
});
