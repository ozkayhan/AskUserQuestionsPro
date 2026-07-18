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
});
