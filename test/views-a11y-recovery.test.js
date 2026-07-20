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
  const start = views.indexOf('function RecoveryChooser(');
  const end = views.indexOf('\nfunction RecoveryDeleteDialog', start);
  assert.notEqual(start, -1, 'RecoveryChooser tanımı bulunmalı');
  assert.notEqual(end, -1, 'RecoveryChooser sınırı bulunmalı');
  const chooser = views.slice(start, end);
  const copy = chooser.slice(chooser.indexOf('const recoveryCopy'), chooser.indexOf('  return ('));

  assert.match(chooser, /role="dialog"[\s\S]{0,80}aria-modal="true"/);
  assert.match(
    copy,
    /const recoveryCopy = uncertain\s*\?\s*\{[\s\S]*heading: "We couldn't confirm delivery\."[\s\S]*description:\s*'Your answers are preserved\. Continue this exact round to check again, cancel\/delete it, or start a new round\.'[\s\S]*\}\s*:\s*\{[\s\S]*heading: 'A question round was interrupted\.'[\s\S]*description: 'Choose what to do with the saved round\.'/
  );
  assert.equal((copy.match(/We couldn't confirm delivery\./g) || []).length, 1);
  assert.equal((copy.match(/A question round was interrupted\./g) || []).length, 1);
  assert.equal((copy.match(/Choose what to do with the saved round\./g) || []).length, 1);
  const actionStart = chooser.indexOf('<div className="recovery-actions">');
  const actionEnd = chooser.indexOf('</div>', actionStart);
  assert.notEqual(actionStart, -1, 'recovery action row bulunmalı');
  assert.notEqual(actionEnd, -1, 'recovery action row sınırı bulunmalı');
  const actions = chooser.slice(actionStart, actionEnd);
  assert.match(chooser, /Checking for saved rounds…/);
  assert.match(chooser, /We couldn't load a saved round right now\./);
  for (const label of ['Continue this exact round', 'Cancel/Delete it', 'Start a new round']) {
    assert.equal(
      (actions.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      1
    );
  }
  assert.match(chooser, /disabled=\{!selectedRecovery\}/);
  assert.doesNotMatch(chooser, /Retry recovery|Continue without recovery/);
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
