'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const ciYml = readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

// Expected SHA pins (resolve from tag at bundle-fix time; update when action releases new v4.x)
const CHECKOUT_SHA = '34e114876b0b11c390a56381ad16ebd13914f8d5'; // actions/checkout v4.3.1
const SETUP_NODE_SHA = '49933ea5288caeca8642d1e84afbd3f7d6820020'; // actions/setup-node v4.4.0

describe('ci.yml yapısı', () => {
  it('pull_request tetikleyicisi var', () => {
    assert.match(ciYml, /pull_request/);
  });

  it('push branches main tetikleyicisi var', () => {
    assert.match(ciYml, /branches:[\s\S]*main/);
  });

  it('concurrency cancel-in-progress: true', () => {
    assert.match(ciYml, /cancel-in-progress:\s*true/);
  });

  it('top-level permissions contents: read', () => {
    assert.match(ciYml, /permissions:[\s\S]{0,50}contents:\s*read/);
  });

  it('lint job var', () => {
    assert.match(ciYml, /\blint\b/);
  });

  it('test job matrix: 18, 20, 22', () => {
    assert.match(ciYml, /18/);
    assert.match(ciYml, /20/);
    assert.match(ciYml, /22/);
  });

  it('npm ci kullanıyor (npm install değil)', () => {
    assert.match(ciYml, /npm ci/);
    assert.doesNotMatch(ciYml, /run:\s*npm install/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(ciYml, /timeout-minutes:\s*10/);
  });

  it('actions/checkout SHA-pinned (not floating @v4 tag)', () => {
    // Must reference by full commit SHA, not mutable tag
    assert.ok(
      ciYml.includes(`actions/checkout@${CHECKOUT_SHA}`),
      `actions/checkout must be pinned to ${CHECKOUT_SHA}`
    );
    // Floating tag must not appear (supply-chain guard)
    assert.doesNotMatch(ciYml, /actions\/checkout@v4(?!\s*#)/);
  });

  it('actions/setup-node SHA-pinned (not floating @v4 tag)', () => {
    assert.ok(
      ciYml.includes(`actions/setup-node@${SETUP_NODE_SHA}`),
      `actions/setup-node must be pinned to ${SETUP_NODE_SHA}`
    );
    assert.doesNotMatch(ciYml, /actions\/setup-node@v4(?!\s*#)/);
  });

  it('npm run lint adımı var', () => {
    assert.match(ciYml, /npm run lint/);
  });

  it('npm run format:check adımı var', () => {
    assert.match(ciYml, /npm run format:check/);
  });

  it('fail-fast: false', () => {
    assert.match(ciYml, /fail-fast:\s*false/);
  });

  it('shellcheck step in lint job', () => {
    assert.match(ciYml, /shellcheck/i);
  });

  it('npm audit comment is accurate (no misleading js-yaml claim)', () => {
    // Old comment mentioned js-yaml specifically; new comment must not
    assert.doesNotMatch(ciYml, /js-yaml/);
    // Must still have --omit=dev flag
    assert.match(ciYml, /--omit=dev/);
  });
});
