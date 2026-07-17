'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('browser recovery integration contract keeps recovery surfaces redacted and keyboard-owned', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const views = fs.readFileSync(path.join(__dirname, '..', 'web', 'views.js'), 'utf8');
  const live = fs.readFileSync(path.join(__dirname, '..', 'web', 'live.js'), 'utf8');
  assert.match(app, /getRecoverableRounds/);
  assert.match(views, /aria-modal="true"/);
  assert.match(views, /aria-live="polite"/);
  assert.match(live, /deliveryTransition/);
  assert.match(live, /attemptClose/);
  assert.doesNotMatch(views, /questionText|answerPayload|answers.*roundId/);
});
