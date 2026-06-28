'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const wfDir = path.join(__dirname, '..', '.github', 'workflows');

// Expected SHA pins (resolve from tag at bundle-fix time; update when action releases new v4.x)
const CHECKOUT_SHA = '34e114876b0b11c390a56381ad16ebd13914f8d5'; // actions/checkout v4.3.1
const SETUP_NODE_SHA = '49933ea5288caeca8642d1e84afbd3f7d6820020'; // actions/setup-node v4.4.0

describe('release.yml yapısı', () => {
  it('release.yml mevcut olmalı', () => {
    assert.ok(existsSync(path.join(wfDir, 'release.yml')), 'release.yml bulunamadı');
  });

  it('publish.yml silinmiş olmalı', () => {
    assert.ok(!existsSync(path.join(wfDir, 'publish.yml')), 'publish.yml hâlâ mevcut — silinmeli');
  });

  const releaseYml = existsSync(path.join(wfDir, 'release.yml'))
    ? readFileSync(path.join(wfDir, 'release.yml'), 'utf8')
    : '';

  it('workflow_run CI tetikleyicisi — release yalnızca CI başarısında çalışır', () => {
    // Must depend on CI workflow via workflow_run so all matrix legs (18/20/22) must pass
    assert.match(releaseYml, /workflow_run/);
    assert.match(releaseYml, /workflows:[\s\S]{0,20}CI/);
    assert.match(releaseYml, /types:[\s\S]{0,20}completed/);
  });

  it('release job if-guard: conclusion == success', () => {
    // Job must only proceed when CI concluded successfully
    assert.match(releaseYml, /conclusion.*==.*success/);
  });

  it('concurrency cancel-in-progress: false (yayını asla kesme)', () => {
    assert.match(releaseYml, /cancel-in-progress:\s*false/);
  });

  it('permissions: contents: write, pull-requests: write, id-token: write', () => {
    assert.match(releaseYml, /contents:\s*write/);
    assert.match(releaseYml, /pull-requests:\s*write/);
    assert.match(releaseYml, /id-token:\s*write/);
  });

  it('changesets/action SHA-pinned with v1 comment', () => {
    assert.match(releaseYml, /changesets\/action@[0-9a-f]{40}\s*#\s*v1/);
  });

  it('actions/checkout SHA-pinned (not floating @v4 tag)', () => {
    assert.ok(
      releaseYml.includes(`actions/checkout@${CHECKOUT_SHA}`),
      `actions/checkout must be pinned to ${CHECKOUT_SHA}`
    );
    assert.doesNotMatch(releaseYml, /actions\/checkout@v4(?!\s*#)/);
  });

  it('actions/setup-node SHA-pinned (not floating @v4 tag)', () => {
    assert.ok(
      releaseYml.includes(`actions/setup-node@${SETUP_NODE_SHA}`),
      `actions/setup-node must be pinned to ${SETUP_NODE_SHA}`
    );
    assert.doesNotMatch(releaseYml, /actions\/setup-node@v4(?!\s*#)/);
  });

  it('npm ci kullanıyor', () => {
    assert.match(releaseYml, /npm ci/);
  });

  it('npm install yasak — sadece npm ci kullanılmalı', () => {
    assert.doesNotMatch(releaseYml, /run:\s*npm install/);
  });

  it('NODE_AUTH_TOKEN secrets.NPM_TOKEN bağlantısı (tam pattern)', () => {
    assert.match(releaseYml, /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/);
  });

  it('registry-url npmjs.org olarak ayarlı', () => {
    assert.match(releaseYml, /registry-url:\s*['"]?https:\/\/registry\.npmjs\.org/);
  });

  it('fetch-depth: 0 — Changesets tam geçmiş gerektirir', () => {
    assert.match(releaseYml, /fetch-depth:\s*0/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(releaseYml, /timeout-minutes:\s*10/);
  });

  it('release job does NOT contain redundant npm test (CI gate is sufficient)', () => {
    // With workflow_run gate, duplicating npm test in release is unnecessary noise;
    // the correctness invariant is enforced by CI. Assert it is removed.
    assert.doesNotMatch(releaseYml, /run:\s*npm test/);
  });
});
