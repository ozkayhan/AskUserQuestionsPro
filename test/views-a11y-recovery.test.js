'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const views = fs.readFileSync(path.join(__dirname, '..', 'web', 'views.js'), 'utf8');

test('views: grouped sidebar idleri title metninden güvenli ve benzersiz üretilir', () => {
  assert.match(views, /function groupId\(/);
  assert.match(views, /aria-controls=\{groupId\(title, ['"]body['"]\)\}/);
  assert.match(views, /id=\{groupId\(title, ['"]body['"]\)\}/);
});

test('views: review ve grouped controls button type/current semantics taşır', () => {
  assert.match(views, /className="qgroup__header"[\s\S]{0,180}type="button"/);
  assert.match(views, /className="qitem"[\s\S]{0,280}aria-current=\{isSummary/);
  assert.match(views, /answers\[q\.question\] \|\| \{\}/);
});

test('views: recovery and delivery states use labelled dialogs and live text', () => {
  assert.match(views, /function RecoveryChooser/);
  assert.match(views, /role="dialog" aria-modal="true"/);
  assert.match(views, /function ReconciliationPanel/);
  assert.match(views, /Delivery status/);
  assert.match(views, /aria-live="polite"/);
});
