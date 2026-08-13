'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const coverageConfig = require('../test/coverage-config.cjs');

const ciYml = readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

// Expected SHA pins (resolve from the immutable action release tag when upgrading).
const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1'; // actions/checkout v7.0.1
const SETUP_NODE_SHA = '820762786026740c76f36085b0efc47a31fe5020'; // actions/setup-node v7.0.0

describe('ci.yml yapısı', () => {
  it('pull_request tetikleyicisi var', () => {
    assert.match(ciYml, /pull_request/);
  });

  it('push branches main tetikleyicisi var', () => {
    assert.match(ciYml, /branches:[\s\S]*main/);
  });

  it('concurrency cancel-in-progress: true', () => {
    assert.match(ciYml, /cancel-in-progress:\s*true/);
  });

  it('top-level permissions contents: read', () => {
    assert.match(ciYml, /permissions:[\s\S]{0,50}contents:\s*read/);
  });

  it('lint job var', () => {
    assert.match(ciYml, /\blint\b/);
  });

  it('test job matrix: 18, 20, 22, 24', () => {
    assert.match(ciYml, /node-version:\s*\[18,\s*20,\s*22,\s*24\]/);
  });

  it('npm ci kullanıyor (npm install değil)', () => {
    assert.match(ciYml, /npm ci/);
    assert.doesNotMatch(ciYml, /run:\s*npm install/);
  });

  it('timeout-minutes: 10', () => {
    assert.match(ciYml, /timeout-minutes:\s*10/);
  });

  it('actions/checkout SHA-pinned (not a floating major tag)', () => {
    // Must reference by full commit SHA, not mutable tag
    assert.ok(
      ciYml.includes(`actions/checkout@${CHECKOUT_SHA}`),
      `actions/checkout must be pinned to ${CHECKOUT_SHA}`
    );
    // Floating tag must not appear (supply-chain guard)
    assert.doesNotMatch(ciYml, /actions\/checkout@v\d/);
  });

  it('actions/setup-node SHA-pinned (not a floating major tag)', () => {
    assert.ok(
      ciYml.includes(`actions/setup-node@${SETUP_NODE_SHA}`),
      `actions/setup-node must be pinned to ${SETUP_NODE_SHA}`
    );
    assert.doesNotMatch(ciYml, /actions\/setup-node@v\d/);
  });

  it('npm run lint adımı var', () => {
    assert.match(ciYml, /npm run lint/);
  });

  it('npm run format:check adımı var', () => {
    assert.match(ciYml, /npm run format:check/);
  });

  it('fail-fast: false', () => {
    assert.match(ciYml, /fail-fast:\s*false/);
  });

  it('separates runtime, coverage, OS, browser, and audit jobs', () => {
    for (const job of ['test:', 'coverage:', 'os-smoke:', 'browser:', 'audit:'])
      assert.match(ciYml, new RegExp(`\\n  ${job}`));
    assert.match(
      ciYml,
      /browser:[\s\S]*matrix:[\s\S]*browser:\s*\[chromium,\s*firefox,\s*webkit\]/
    );
    assert.match(
      ciYml,
      /os-smoke:[\s\S]*matrix:[\s\S]*os:\s*\[ubuntu-latest,\s*macos-latest,\s*windows-latest\]/
    );
    assert.match(
      ciYml,
      /browser:[\s\S]*playwright install --with-deps \$\{\{ matrix\.browser \}\}/
    );
    assert.match(
      ciYml,
      /browser:[\s\S]*npm run test:playwright -- --project=\$\{\{ matrix\.browser \}\}/
    );
  });

  it('native coverage gate uses the configured 90/80/80 thresholds', () => {
    assert.match(ciYml, /coverage:[\s\S]*node-version:\s*24/);
    assert.match(ciYml, /coverage:[\s\S]*node test\/coverage-runner\.cjs/);
    assert.deepEqual(
      {
        lines: coverageConfig.lines,
        branches: coverageConfig.branches,
        functions: coverageConfig.functions,
      },
      { lines: 90, branches: 80, functions: 80 }
    );
  });

  it('audit job keeps full and production-boundary high-severity gates', () => {
    assert.match(ciYml, /audit:[\s\S]*npm audit --audit-level=high/);
    assert.match(ciYml, /audit:[\s\S]*npm audit --audit-level=high --omit=dev/);
  });

  it('shellcheck step in lint job', () => {
    assert.match(ciYml, /shellcheck/i);
    assert.match(ciYml, /-not -path ['"]?\.\/\.git\/\*['"]?/);
  });

  it('npm audit comment is accurate (no misleading js-yaml claim)', () => {
    // Old comment mentioned js-yaml specifically; new comment must not
    assert.doesNotMatch(ciYml, /js-yaml/);
    // Must still have --omit=dev flag
    assert.match(ciYml, /--omit=dev/);
  });
});
