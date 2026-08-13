'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const docs = fs.readFileSync('docs/testing.md', 'utf8');
const releaseDocs = fs.readFileSync('docs/release.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('npm test keeps optional Playwright CLI evidence on its dedicated command', () => {
  assert.equal(pkg.scripts.test, 'node --test test/*.test.js');
  assert.equal(pkg.scripts['test:browser'], 'node test/browser-settings-cli-e2e.js');
});

test('release gate documents the complete clean-checkout sequence', () => {
  for (const cmd of [
    'npm ci',
    'npm test',
    'npm run lint',
    'npm run format:check',
    'npm audit --audit-level=high --omit=dev',
    'npm pack --dry-run --json',
    'shellcheck',
  ])
    assert.match(docs, new RegExp(cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(docs, /unavailable optional tools[\s\S]{0,80}environment gaps/i);
});
test('release gate preserves package boundary and no new installs', () => {
  assert.match(docs, /zero\s+production dependencies/i);
  assert.match(docs, /file allowlist/i);
  assert.match(docs, /changeset.*release workflow/i);
});
test('release guidance preserves the repository-native OTP-free publisher', () => {
  assert.match(
    releaseDocs,
    /(?:canonical npm publishing path is GitHub Actions|GitHub Actions is the only normal publisher)/i
  );
  assert.match(releaseDocs, /id-token:\s*write/i);
  assert.match(releaseDocs, /trusted publishing/i);
  assert.match(
    releaseDocs,
    /(?:Do not\s+start a release with a local `npm publish`|Do not\s+start with local `npm publish`)/i
  );
  assert.match(releaseDocs, /EOTP/);
});
test('release gate executes the locally available package and shell checks', () => {
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const shell = spawnSync('bash', ['-n', 'install.sh', 'uninstall.sh', 'reinstall.sh'], {
    encoding: 'utf8',
  });
  assert.equal(shell.status, 0, shell.stderr);
  const shellcheck = spawnSync('shellcheck', ['install.sh', 'uninstall.sh', 'reinstall.sh'], {
    encoding: 'utf8',
  });
  if (shellcheck.error?.code === 'ENOENT') assert.match(docs, /unavailable optional tools/i);
  else assert.equal(shellcheck.status, 0, shellcheck.stdout || shellcheck.stderr);
});

test('release gate config is kept in the repository test surface', () => {
  const coverage = fs.readFileSync('test/coverage-config.cjs', 'utf8');
  assert.match(coverage, /lines:\s*90/);
  assert.match(coverage, /branches:\s*80/);
  assert.match(coverage, /functions:\s*80/);
  assert.match(coverage, /criticalLine:\s*85/);
  assert.match(coverage, /round-lifecycle\.cjs/);
  assert.match(coverage, /question-contract\.cjs/);
  assert.match(coverage, /round-store\.cjs/);
  assert.match(coverage, /test\/\*\*/);
  assert.match(coverage, /web\/\*\*/);
});
