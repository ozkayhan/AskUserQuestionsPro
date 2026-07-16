'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const docsRoot = path.join(root, 'docs');

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(file);
    return entry.name.endsWith('.md') ? [file] : [];
  });
}

function internalLinks(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !target.startsWith('http://') && !target.startsWith('https://'));
}

describe('documentation integrity', () => {
  it('maintained docs have no dead relative Markdown links', () => {
    for (const file of markdownFiles(docsRoot)) {
      for (const target of internalLinks(file)) {
        assert.ok(existsSync(path.resolve(path.dirname(file), target)), `${file} → ${target}`);
      }
    }
  });

  it('has one canonical index and no legacy duplicate directory/files', () => {
    assert.ok(existsSync(path.join(docsRoot, 'README.md')));
    assert.equal(existsSync(path.join(docsRoot, 'old')), false);
    assert.equal(existsSync(path.join(root, 'planv2.md')), false);
    for (const name of ['decisions.md', 'timeout-runbook.md', 'maintenance.md']) {
      assert.ok(existsSync(path.join(docsRoot, name)), `${name} missing`);
    }
  });
});
