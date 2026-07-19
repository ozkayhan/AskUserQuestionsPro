'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('browser recovery integration contract keeps recovery surfaces redacted and keyboard-owned', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const views = fs.readFileSync(path.join(__dirname, '..', 'web', 'views.js'), 'utf8');
  const live = fs.readFileSync(path.join(__dirname, '..', 'web', 'live.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  assert.match(app, /getRecoverableRounds/);
  assert.match(app, /discoveryState/);
  assert.match(app, /selectedRecovery/);
  assert.match(app, /retireRound\(roundId\)/);
  assert.match(app, /currentClosureMode\(\)/);
  assert.match(views, /aria-modal="true"/);
  assert.match(views, /aria-live="polite"/);
  assert.match(views, /A question round was interrupted\./);
  assert.match(views, /Choose what to do with the saved round\./);
  for (const label of [
    'Continue this exact round',
    'Cancel/Delete it',
    'Start a new round',
    'Delete this saved round?',
    'This removes the retained round and cannot be undone.',
  ]) {
    assert.match(views, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(views, /Sending answers…/);
  assert.match(views, /This round is complete\./);
  assert.match(views, /This tab is no longer waiting for new questions\./);
  assert.match(live, /deliveryTransition/);
  assert.match(live, /attemptClose/);
  assert.match(live, /createRoundAcceptanceGate/);
  assert.match(live, /deleteRecoverableRound/);
  assert.doesNotMatch(views, /questionText|answerPayload|capability|filesystem|diagnostic/);
  assert.doesNotMatch(views, /role="alert"|Retry recovery|Continue without recovery/);
  assert.match(styles, /\.app--retired/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /--accent|var\(--surface/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\[data-reduce-motion='true'\]/);
});

test('waiting shell uses one column while active rounds retain the two-column shell', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');

  assert.match(app, /<div className="app app--waiting"[^>]*>\s*<Waiting \/>/);
  assert.match(app, /<div className="app" data-panel="left" data-align="center">\s*<Sidebar/);
  assert.match(styles, /\.app--waiting\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.app\s*\{[^}]*grid-template-columns:\s*clamp\(330px, 24vw, 416px\) 1fr/s);
  assert.match(
    styles,
    /@media \(max-width: 760px\)\s*\{[\s\S]*?\.app,[\s\S]*?grid-template-columns:\s*1fr/
  );
  assert.match(app, /<div className="app app--retired">[\s\S]*<RetiredState \/>/);
});

test('manual localhost boundary remains explicitly separate from source-contract evidence', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  assert.equal(packageJson.scripts.serve, 'node server/server.js');
  // Runtime evidence requires the existing `npm run serve` / installed
  // `askuserquestionspro serve` entrypoint and an already configured host ask
  // path. This source-contract test intentionally does not claim that evidence.
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'), /localhost/i);
});
