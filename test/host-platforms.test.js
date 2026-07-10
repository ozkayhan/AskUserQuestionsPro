'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const {
  candidatesFor,
  manualMcpCommand,
  mcpArgs,
  parseTarget,
  resolveExecutable,
  selectedHosts,
  skillDestination,
} = require('../lib/host-platforms.cjs');

test('parseTarget supports spaced/equal forms and rejects unknown input', () => {
  assert.strictEqual(parseTarget([]), 'auto');
  assert.strictEqual(parseTarget(['--target', 'codex']), 'codex');
  assert.strictEqual(parseTarget(['--target=all']), 'all');
  assert.throws(() => parseTarget(['--target', 'nope']), /Geçersiz target/);
  assert.throws(() => parseTarget(['--wat']), /Bilinmeyen seçenek/);
});

test('auto selects detected hosts while explicit/all are deterministic', () => {
  assert.deepStrictEqual(selectedHosts('auto', { claude: 'claude', codex: null }), ['claude']);
  assert.deepStrictEqual(selectedHosts('auto', { claude: null, codex: '/codex' }), ['codex']);
  assert.deepStrictEqual(selectedHosts('all', { claude: null, codex: null }), ['claude', 'codex']);
  assert.deepStrictEqual(selectedHosts('codex', {}), ['codex']);
});

test('Codex discovery honors override before PATH and desktop bundle candidates', () => {
  assert.deepStrictEqual(candidatesFor('codex', { ASKUI_CODEX_BIN: '/custom/codex' }), [
    '/custom/codex',
  ]);
  assert.deepStrictEqual(candidatesFor('codex', {}).slice(0, 2), [
    'codex',
    '/Applications/ChatGPT.app/Contents/Resources/codex',
  ]);

  const seen = [];
  const fakeSpawn = (bin) => {
    seen.push(bin);
    return bin === '/Applications/ChatGPT.app/Contents/Resources/codex'
      ? { status: 0 }
      : { error: Object.assign(new Error('missing'), { code: 'ENOENT' }) };
  };
  assert.strictEqual(
    resolveExecutable('codex', fakeSpawn, {}),
    '/Applications/ChatGPT.app/Contents/Resources/codex'
  );
  assert.deepStrictEqual(seen.slice(0, 2), [
    'codex',
    '/Applications/ChatGPT.app/Contents/Resources/codex',
  ]);
});

test('MCP argv reflects each host CLI contract', () => {
  const mcp = '/tmp/Ask User/mcp.mjs';
  assert.deepStrictEqual(mcpArgs('claude', 'add', mcp), [
    'mcp',
    'add',
    '--scope',
    'user',
    'askuserquestionspro',
    '--',
    process.execPath,
    mcp,
  ]);
  assert.deepStrictEqual(mcpArgs('codex', 'add', mcp), [
    'mcp',
    'add',
    'askuserquestionspro',
    '--',
    process.execPath,
    mcp,
  ]);
  assert.deepStrictEqual(mcpArgs('codex', 'check', mcp), [
    'mcp',
    'get',
    'askuserquestionspro',
    '--json',
  ]);
  assert.deepStrictEqual(mcpArgs('claude', 'inspect', mcp), ['mcp', 'get', 'askuserquestionspro']);
  assert.match(manualMcpCommand('codex', mcp), /^codex mcp add/);
  assert.match(manualMcpCommand('codex', mcp), /"\/tmp\/Ask User\/mcp\.mjs"/);
});

test('skills deploy to host-native discovery locations', () => {
  const home = path.join(path.sep, 'Users', 'tester');
  assert.strictEqual(
    skillDestination('claude', home),
    path.join(home, '.claude', 'skills', 'askpro')
  );
  assert.strictEqual(
    skillDestination('codex', home),
    path.join(home, '.agents', 'skills', 'askpro')
  );
});

test('askpro skill names both native fallbacks without claiming Claude-only semantics', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'skill', 'askpro', 'SKILL.md'), 'utf8');
  assert.match(text, /Codex App/);
  assert.match(text, /request_user_input/);
  assert.match(text, /Claude Code/);
  assert.match(text, /AskUserQuestion/);
  assert.doesNotMatch(text, /plain text only/);
  assert.doesNotMatch(text, /renders all questions simultaneously/);
});
