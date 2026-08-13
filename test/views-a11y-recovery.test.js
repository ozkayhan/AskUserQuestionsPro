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
  assert.match(chooser, /Checking for saved rounds…/);
  assert.match(chooser, /We couldn't load a saved round right now\./);
  for (const label of ['Continue this exact round', 'Cancel/Delete it', 'Start a new round']) {
    assert.match(chooser, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(chooser, /disabled=\{!selectedRecovery\}/);
  assert.match(chooser, /Retry recovery/);
  assert.match(chooser, /Close recovery/);
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

test('views: every question screen exposes visible Previous and Continue controls', () => {
  assert.match(views, /function QuestionNavigation\(/);
  assert.match(views, /Previous/);
  assert.match(views, /Continue/);
  assert.match(views, /className="question-navigation"/);
});

test('views: recovery error state offers retry and close actions', () => {
  assert.match(views, /onRetry/);
  assert.match(views, /Retry recovery/);
  assert.match(views, /Close recovery/);
});

test('views: conflict dialog presents question-level local and saved values with merge action', () => {
  assert.match(views, /Local answer/);
  assert.match(views, /Saved answer/);
  assert.match(views, /Choose which to use/);
  assert.match(views, /Use selected answers/);
});

test('views: ranking uses roving row focus and keeps the active row visible', () => {
  assert.match(views, /scrollIntoView\(\{ block: 'nearest' \}\)/);
  assert.match(views, /tabIndex=\{isCursor \? 0 : -1\}/);
  assert.match(views, /onFocus=\{\(\) => \{[\s\S]*setCursor\(rankPos\)/);
});

test('views: release-facing hardcoded UI copy is English', () => {
  assert.doesNotMatch(
    views,
    /Bir seçenek seçin|Öğeleri öncelik sırasına göre düzenleyin|Yukarı taşı|Aşağı taşı/
  );
  assert.match(views, /Waiting for a question/);
});

test('views: modal owner is singular when recovery deletion is open', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  assert.match(app, /showChooser && !settingsOpen && !deleteTarget/);
  assert.match(views, /aria-modal="true"/);
});

test('styles: default text contrast, visible focus, and reduced motion safeguards remain present', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  assert.match(styles, /--fg-subtle:\s*#a0a0a0/);
  assert.match(styles, /:where\([^\n]*\):focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(index, /<html lang="en">/);
});
