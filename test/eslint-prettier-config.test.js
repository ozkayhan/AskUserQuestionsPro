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

  it('package.json devDependencies: @babel/core, @babel/eslint-parser, eslint-plugin-react-hooks', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const deps = pkg.devDependencies || {};
    for (const dep of ['@babel/core', '@babel/eslint-parser', 'eslint-plugin-react-hooks']) {
      assert.ok(deps[dep], `${dep} devDependencies içinde yok`);
    }
  });

  it('eslint.config.js mevcut olmalı', () => {
    assert.ok(existsSync(path.join(root, 'eslint.config.js')), 'eslint.config.js bulunamadı');
  });

  it('eslint.config.js: no-empty allowEmptyCatch:false enforced', () => {
    const cfg = readFileSync(path.join(root, 'eslint.config.js'), 'utf8');
    assert.match(cfg, /no-empty/);
    assert.match(cfg, /allowEmptyCatch.*false/);
  });

  it('eslint.config.js: @babel/eslint-parser used for web/** files', () => {
    const cfg = readFileSync(path.join(root, 'eslint.config.js'), 'utf8');
    assert.match(cfg, /@babel\/eslint-parser/);
    assert.match(cfg, /web\/\*\*\/\*\.js/);
  });

  it('eslint.config.js: react-hooks/rules-of-hooks and exhaustive-deps enforced', () => {
    const cfg = readFileSync(path.join(root, 'eslint.config.js'), 'utf8');
    assert.match(cfg, /react-hooks\/rules-of-hooks/);
    assert.match(cfg, /react-hooks\/exhaustive-deps/);
  });

  it('.prettierrc.json mevcut ve geçerli JSON olmalı', () => {
    const p = path.join(root, '.prettierrc.json');
    assert.ok(existsSync(p), '.prettierrc.json bulunamadı');
    assert.doesNotThrow(() => JSON.parse(readFileSync(p, 'utf8')));
  });

  it('.prettierignore mevcut olmalı', () => {
    assert.ok(existsSync(path.join(root, '.prettierignore')), '.prettierignore bulunamadı');
  });

  it('.prettierignore eslint.config.js ile aynı ignore kapsamını taşır (L-54)', () => {
    // eslint web/vendor, node_modules ve .context'i ignore'lar; prettier de
    // aynı dizinleri atlamalı — yoksa tool kapsamı ayrışır (format vs lint drift).
    const ignore = readFileSync(path.join(root, '.prettierignore'), 'utf8');
    for (const pat of ['web/vendor', 'node_modules', '.context']) {
      assert.match(ignore, new RegExp(pat.replace('/', '\\/')), `${pat} .prettierignore'da yok`);
    }
  });

  it('package.json scripts: lint, format, format:check', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts?.lint, 'eslint .');
    assert.equal(pkg.scripts?.format, 'prettier --write .');
    assert.equal(pkg.scripts?.['format:check'], 'prettier --check .');
  });
});
