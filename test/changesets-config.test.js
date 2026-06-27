'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

describe('Changesets kurulumu', () => {
  it('package.json devDependencies içinde @changesets/cli olmalı', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.ok(pkg.devDependencies?.['@changesets/cli'], '@changesets/cli devDependencies içinde yok');
  });

  it('package.json scripts: changeset, version, release olmalı', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts?.changeset, 'changeset');
    assert.equal(pkg.scripts?.version, 'changeset version');
    assert.equal(pkg.scripts?.release, 'changeset publish');
  });

  it('package.json publishConfig access:public ve provenance:true olmalı', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.publishConfig?.access, 'public');
    assert.equal(pkg.publishConfig?.provenance, true);
  });

  it('.changeset/config.json geçerli ve doğru ayarlarda olmalı', () => {
    const cfgPath = path.join(root, '.changeset', 'config.json');
    assert.ok(existsSync(cfgPath), '.changeset/config.json bulunamadı');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    assert.equal(cfg.access, 'public');
    assert.equal(cfg.baseBranch, 'main');
  });

  it('.changeset/README.md mevcut olmalı', () => {
    assert.ok(existsSync(path.join(root, '.changeset', 'README.md')), '.changeset/README.md bulunamadı');
  });
});
