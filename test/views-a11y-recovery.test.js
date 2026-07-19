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

test('views: recovery copy and actions stay exact and selection-gated', () => {
  assert.match(views, /function RecoveryChooser/);
  assert.match(views, /role="dialog"[\s\S]{0,80}aria-modal="true"/);
  assert.match(views, /A question round was interrupted\./);
  assert.match(views, /Choose what to do with the saved round\./);
  assert.match(views, /Checking for saved rounds…/);
  assert.match(views, /We couldn't load a saved round right now\./);
  assert.match(views, /Continue this exact round/);
  assert.match(views, /Cancel\/Delete it/);
  assert.match(views, /Start a new round/);
  assert.match(views, /disabled=\{!selectedRecovery\}/);
  assert.doesNotMatch(views, /Retry recovery|Continue without recovery/);
});

test('views: deletion confirmation and passive delivery states are accessible', () => {
  assert.match(views, /function RecoveryDeleteDialog/);
  assert.match(views, /Delete this saved round\?/);
  assert.match(views, /This removes the retained round and cannot be undone\./);
  assert.match(views, /Delete this round/);
  assert.match(views, /Keep this round/);
  assert.match(views, /Sending answers…/);
  assert.match(views, /This round is complete\./);
  assert.match(
    views,
    /This tab is no longer waiting for new questions\. You can close it when convenient\./
  );
  assert.doesNotMatch(views, /role="alert"/);
  assert.match(views, /aria-live="polite"/);
});

test('views: modal recovery controls retain keyboard focus ownership', () => {
  assert.match(views, /useModalFocus\(titleRef, handleStartNewRound\)/);
  assert.match(views, /useModalFocus\(titleRef, onCancel\)/);
  assert.match(views, /aria-pressed=\{identity\}/);
});
