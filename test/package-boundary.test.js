'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function packagePreview() {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(output)[0];
}

describe('npm paket sınırı', () => {
  it('production dependency boundary is empty and dev dependency declarations match the lock root', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const lockRoot = lock.packages?.[''];

    assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
    assert.ok(!lockRoot?.dependencies || Object.keys(lockRoot.dependencies).length === 0);
    assert.deepEqual(
      Object.keys(lockRoot?.devDependencies || {}).sort(),
      Object.keys(pkg.devDependencies || {}).sort()
    );
    assert.deepEqual(lockRoot?.devDependencies, pkg.devDependencies);
  });

  it('package.json ve package-lock.json aynı sürümü taşır', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages?.['']?.version, pkg.version);
    assert.equal(pkg.engines?.node, '>=18');
  });

  it('yayın paketi yalnızca explicit runtime/install allowlist yüzeyini içerir', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.files, [
      'bin/',
      'hooks/',
      'server/',
      'lib/',
      'mcp-server/',
      'web/',
      'skill/',
      'install.sh',
      'uninstall.sh',
      'reinstall.sh',
      'README.md',
      'LICENSE',
    ]);

    const preview = packagePreview();
    const files = preview.files.map((entry) => entry.path);
    assert.ok(files.includes('package.json'));
    assert.ok(files.includes('mcp-server/askuserquestionspro-mcp.mjs'));
    for (const forbidden of ['.codex/', '.planning/', '.context/', 'docs/', 'test/']) {
      assert.equal(
        files.some((file) => file === forbidden || file.startsWith(forbidden)),
        false,
        `${forbidden} npm paketine sızmamalı`
      );
    }
  });
});
