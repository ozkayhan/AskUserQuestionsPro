'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

it('locks the refactor parity contract at public process, browser, and durable-store boundaries', () => {
  const packageJson = require('../package.json');
  assert.deepEqual(packageJson.bin, {
    askuserquestionspro: 'bin/cli.js',
    'askuserquestionspro-mcp': 'mcp-server/askuserquestionspro-mcp.mjs',
  });

  const server = read('server/server.js');
  assert.match(server, /server\.requestTimeout\s*=\s*0/);
  assert.match(server, /server\.listen\(PORT, '127\.0\.0\.1'/);

  const scriptSources = [...read('web/index.html').matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(scriptSources, [
    './vendor/react.production.min.js',
    './vendor/react-dom.production.min.js',
    './vendor/babel.min.js',
    'answer-map.js',
    'themes.js',
    'settings-schema.js',
    'draft-writer.js',
    'ui-kit.js',
    'live.js',
    'views.js',
    'settings-panel.js',
    'app.js',
  ]);

  const parityPath = path.join(root, 'docs', 'REFACTOR-PARITY.md');
  assert.equal(existsSync(parityPath), true, 'the authoritative parity manifest must exist');
  const parity = read('docs/REFACTOR-PARITY.md');
  assert.match(parity, /D-010/);
  assert.match(parity, /round-store\.cjs/);
  assert.match(parity, /authoritative.*durable/i);
});
