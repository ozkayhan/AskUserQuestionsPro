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
    // eslint web/vendor, node_modules, .context ve workspace .codex'i ignore'lar; prettier de
    // aynı dizinleri atlamalı — yoksa tool kapsamı ayrışır (format vs lint drift).
    const ignore = readFileSync(path.join(root, '.prettierignore'), 'utf8');
    for (const pat of ['web/vendor', 'node_modules', '.context', '.codex']) {
      assert.match(ignore, new RegExp(pat.replace('/', '\\/')), `${pat} .prettierignore'da yok`);
    }
  });

  it('format:check maintained scope is explicit and covers application roots', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const script = pkg.scripts?.['format:check'];
    for (const scope of [
      'bin',
      'hooks',
      'lib',
      'mcp-server',
      'server',
      'test',
      'web',
      'docs',
      'package.json',
      'eslint.config.js',
      '.prettierrc.json',
      'README.md',
      '*.sh',
    ]) {
      assert.match(script, new RegExp(`(?:^|\\s)${scope.replace('.', '\\.')}(?:\\s|$)`));
    }
    assert.doesNotMatch(script, /\.github/);
  });

  it('format policy documents intentional vendor, generated, and historical exclusions', () => {
    const ignore = readFileSync(path.join(root, '.prettierignore'), 'utf8');
    for (const pattern of [
      'web/vendor',
      'node_modules',
      'package-lock.json',
      '.context',
      '.codex',
      '.omo',
      '.planning/research/.cache',
      '.planning/phases',
      '.planning/debug',
      '.planning/milestones',
      'docs/archive',
    ]) {
      assert.match(ignore, new RegExp(pattern.replace(/[./]/g, '\\$&')), `${pattern} exclusion missing`);
    }
    for (const sourceRoot of ['bin', 'hooks', 'lib', 'mcp-server', 'server', 'test', 'web']) {
      assert.doesNotMatch(ignore, new RegExp(`^${sourceRoot}/\\*\\*`, 'm'), `${sourceRoot} must remain covered`);
    }
    assert.match(ignore, /\.github.*outside|outside.*\.github|\.github.*non-Prettier/i);
  });

  it('format policy keeps workflow YAML as a separately tested non-Prettier surface', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const ignore = readFileSync(path.join(root, '.prettierignore'), 'utf8');
    assert.doesNotMatch(pkg.scripts?.['format:check'], /\.github/);
    assert.match(ignore, /\.github.*non-Prettier|non-Prettier.*\.github/i);
  });

  it('package.json scripts: lint, format, format:check', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts?.lint, 'eslint .');
    assert.equal(pkg.scripts?.format, 'prettier --write .');
    assert.match(pkg.scripts?.['format:check'], /^prettier --check /);
  });
});
