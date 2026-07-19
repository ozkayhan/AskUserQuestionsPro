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

test('app: recovery chooser and delivery surfaces are explicit and keyboard-owned', () => {
  assert.match(app, /RecoveryChooser/);
  assert.match(app, /getRecoverableRounds/);
  assert.match(app, /selectedRecovery/);
  assert.match(app, /delivery-pending|DeliveryPanel/);
  assert.match(app, /durableRoundId/);
  assert.match(app, /retryAcknowledgement/);
  assert.match(app, /clearPendingDrafts/);
  assert.match(app, /createAnswerState\(QUESTIONS, draftAnswers\)/);
});

test('app: recovery discovery has explicit loading, error, empty, and populated states', () => {
  assert.match(app, /useState\(['"]loading['"]\)/);
  assert.match(app, /setDiscoveryState\(['"]error['"]\)/);
  assert.match(app, /setDiscoveryState\(['"]empty['"]\)/);
  assert.match(app, /['"]populated['"]/);
  assert.match(app, /recoveryIdentity\(round\)/);
  assert.match(app, /handleStartNewRound/);
  assert.match(app, /handleConfirmDelete/);
  assert.match(app, /deleteRecoverableRound\(deleteTarget\.roundId\)/);
});

test('app: submit retires the exact round before delivery and uncertainty returns to recovery', () => {
  const retired = app.indexOf('retireRound(roundId)');
  const pending = app.indexOf("setDeliveryState('delivery-pending')", retired);
  const post = app.indexOf('postAnswers(roundId, mapped, capability)', pending);
  assert.ok(retired >= 0 && retired < pending && pending < post);
  assert.match(app, /onDeliveryUncertain\?\.\(\)/);
  assert.match(app, /currentClosureMode\(\)/);
  assert.match(app, /['"]after-delivery['"]/);
  assert.match(app, /['"]never['"]/);
  assert.doesNotMatch(app, /Answers sent back to the agent\./);
});
