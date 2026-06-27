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

  it('changesets/action SHA-pinned with v1 comment', () => {
    assert.match(releaseYml, /changesets\/action@[0-9a-f]{40}\s*#\s*v1/);
  });

  it('npm ci kullanıyor', () => {
    assert.match(releaseYml, /npm ci/);
  });

  it('npm test adımı var (yayın öncesi son kapı)', () => {
    assert.match(releaseYml, /npm test/);
  });

  it('NODE_AUTH_TOKEN secrets.NPM_TOKEN bağlantısı (tam pattern)', () => {
    assert.match(releaseYml, /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/);
  });

  it('registry-url npmjs.org olarak ayarlı', () => {
    assert.match(releaseYml, /registry-url:\s*['"]?https:\/\/registry\.npmjs\.org/);
  });

  it('npm install yasak — sadece npm ci kullanılmalı', () => {
    assert.doesNotMatch(releaseYml, /run:\s*npm install/);
  });

  it('fetch-depth: 0 — Changesets tam geçmiş gerektirir', () => {
    assert.match(releaseYml, /fetch-depth:\s*0/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(releaseYml, /timeout-minutes:\s*10/);
  });
});
