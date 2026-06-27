'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const wfDir = path.join(__dirname, '..', '.github', 'workflows');

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

  it('push branches main tetikleyicisi', () => {
    assert.match(releaseYml, /branches:[\s\S]*main/);
  });

  it('concurrency cancel-in-progress: false (yayını asla kesme)', () => {
    assert.match(releaseYml, /cancel-in-progress:\s*false/);
  });

  it('permissions: contents: write, pull-requests: write, id-token: write', () => {
    assert.match(releaseYml, /contents:\s*write/);
    assert.match(releaseYml, /pull-requests:\s*write/);
    assert.match(releaseYml, /id-token:\s*write/);
  });

  it('changesets/action@v1 kullanıyor', () => {
    assert.match(releaseYml, /changesets\/action@v1/);
  });

  it('npm ci kullanıyor', () => {
    assert.match(releaseYml, /npm ci/);
  });

  it('npm test adımı var (yayın öncesi son kapı)', () => {
    assert.match(releaseYml, /npm test/);
  });

  it('NPM_TOKEN / NODE_AUTH_TOKEN secrets referansı', () => {
    assert.match(releaseYml, /NPM_TOKEN/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(releaseYml, /timeout-minutes:\s*10/);
  });
});
