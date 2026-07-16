'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');

test('app: stale round error ayrı bir recovery state olarak gösterilir', () => {
  assert.match(app, /err\.reason === ['"]stale_round['"]/);
  assert.match(app, /sendError === ['"]stale['"]/);
  assert.match(app, /Press Enter to retry/);
  assert.match(app, /round.*already.*completed|replaced/i);
});

test('app: stale round retry edilmez', () => {
  assert.match(app, /sendError === ['"]network['"]\s*\)\s*\{/);
  assert.match(app, /(?:R\.)?sendError !== ['"]stale['"]/);
});
