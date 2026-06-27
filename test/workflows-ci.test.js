'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const ciYml = readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'),
  'utf8'
);

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

  it('actions/checkout@v4 pinli', () => {
    assert.match(ciYml, /actions\/checkout@v4/);
  });

  it('actions/setup-node@v4 pinli', () => {
    assert.match(ciYml, /actions\/setup-node@v4/);
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
});
