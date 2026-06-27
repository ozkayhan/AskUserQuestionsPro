'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

describe('ESLint + Prettier kurulumu', () => {
  it('package.json devDependencies: eslint, @eslint/js, globals, prettier, eslint-config-prettier', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const deps = pkg.devDependencies || {};
    for (const dep of ['eslint', '@eslint/js', 'globals', 'prettier', 'eslint-config-prettier']) {
      assert.ok(deps[dep], `${dep} devDependencies içinde yok`);
    }
  });

  it('eslint.config.js mevcut olmalı', () => {
    assert.ok(existsSync(path.join(root, 'eslint.config.js')), 'eslint.config.js bulunamadı');
  });

  it('.prettierrc.json mevcut ve geçerli JSON olmalı', () => {
    const p = path.join(root, '.prettierrc.json');
    assert.ok(existsSync(p), '.prettierrc.json bulunamadı');
    assert.doesNotThrow(() => JSON.parse(readFileSync(p, 'utf8')));
  });

  it('.prettierignore mevcut olmalı', () => {
    assert.ok(existsSync(path.join(root, '.prettierignore')), '.prettierignore bulunamadı');
  });

  it('package.json scripts: lint, format, format:check', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts?.lint, 'eslint .');
    assert.equal(pkg.scripts?.format, 'prettier --write .');
    assert.equal(pkg.scripts?.['format:check'], 'prettier --check .');
  });
});
