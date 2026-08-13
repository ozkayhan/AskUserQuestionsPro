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

  it('push: main tetikleyicisi kullanır; workflow_run ve manual dispatch yoktur', () => {
    assert.match(releaseYml, /push:[\s\S]*branches:\s*\[main\]/);
    assert.doesNotMatch(releaseYml, /workflow_run/);
    assert.doesNotMatch(releaseYml, /workflow_dispatch/);
  });

  it('exact main SHA için Release Gate job ve status yazımı vardır', () => {
    assert.match(releaseYml, /name:\s*Release Gate/);
    assert.match(releaseYml, /github\.ref\s*==\s*['"]refs\/heads\/main['"]/);
    assert.match(releaseYml, /github\.sha/);
    assert.match(releaseYml, /git rev-parse HEAD/);
    assert.match(releaseYml, /statuses\/\$GITHUB_SHA/);
    assert.match(releaseYml, /context=.*Release Gate/);
  });

  it('concurrency cancel-in-progress: false (yayını asla kesme)', () => {
    assert.match(releaseYml, /cancel-in-progress:\s*false/);
  });

  it('permissions: contents/statuses/pull-requests/id-token write', () => {
    assert.match(releaseYml, /contents:\s*write/);
    assert.match(releaseYml, /statuses:\s*write/);
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

  it('trusted publishing için NPM_TOKEN ve NODE_AUTH_TOKEN yoktur', () => {
    assert.doesNotMatch(releaseYml, /NPM_TOKEN|NODE_AUTH_TOKEN/);
    assert.match(releaseYml, /id-token:\s*write/);
  });

  it('registry-url npmjs.org olarak ayarlı', () => {
    assert.match(releaseYml, /registry-url:\s*['"]?https:\/\/registry\.npmjs\.org/);
  });

  it('fetch-depth: 0 — Changesets tam geçmiş gerektirir', () => {
    assert.match(releaseYml, /fetch-depth:\s*0/);
  });

  it('publisher Node 24, npm 11.5.1+ ve cache kapalı kullanır', () => {
    assert.match(releaseYml, /node-version:\s*['"]?24['"]?/);
    assert.match(releaseYml, /npm\s+i\s+-g\s+npm@11\.5\.1/);
    assert.match(releaseYml, /package-manager-cache:\s*false/);
    assert.doesNotMatch(releaseYml, /cache:\s*npm/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(releaseYml, /timeout-minutes:\s*10/);
  });

  it('release gate re-runs the clean-checkout checks before publish', () => {
    assert.match(releaseYml, /name:\s*Release Gate[\s\S]*npm test/);
    assert.match(releaseYml, /name:\s*Release Gate[\s\S]*npm run lint/);
    assert.match(releaseYml, /name:\s*Release Gate[\s\S]*npm pack --dry-run --json/);
  });
});
