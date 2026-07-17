'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Schema = require('../web/settings-schema.js');
test('runtime settings matrix has an owner for every field', () => {
  assert.ok(Schema.matrix().every((field) => field.owner && field.effect));
});
test('future and invalid settings refuse runtime mutation', () => {
  assert.strictEqual(Schema.inspectEnvelope({ _v: 999 }).valid, false);
  assert.strictEqual(Schema.validateEnvelope({ recovery: { retentionMs: 0 } }).recovery.retentionMs, 3600000);
});
