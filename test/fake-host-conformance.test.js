'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { runProcess, redact } = require('./helpers/fake-host');

const HOOK = path.join(__dirname, '..', 'hooks', 'askuserquestionspro-bridge.mjs');
const MCP = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');

test('fake Claude host drives the real hook process and preserves native fallback', async () => {
  const result = await runProcess(HOOK, 'not-json', { ASKUSER_FORCE_MCP: '0' });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('fake Claude host captures empty-input fallback without payload leakage', async () => {
  const result = await runProcess(
    HOOK,
    JSON.stringify({ tool_input: {} }),
    {}
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stdout, /synthetic-question|synthetic-answer/);
});

test('fake host redaction is stable for replayed lifecycle metadata', () => {
  const first = redact(JSON.stringify({ roundId: 'round-7', answer: 'secret answer', state: 'complete' }));
  const replay = redact(JSON.stringify({ roundId: 'round-7', answer: 'secret answer', state: 'complete' }));
  assert.equal(first, replay);
  assert.match(first, /roundId/);
  assert.match(first, /state/);
  assert.doesNotMatch(first, /secret answer|answer/);
});

test('fake host redaction removes arbitrary question, answer, and secret fields', () => {
  const captured = redact(JSON.stringify({ question: 'What is your SSN?', answer: '123-45-6789', token: 'secret-token' }));
  assert.equal(captured, '[redacted-output]');
  assert.doesNotMatch(captured, /SSN|123-45|secret-token/);
});

test('fake Codex host launches the real MCP process boundary', async () => {
  const child = spawn(process.execPath, [MCP], {
    env: { ...process.env, ASKUSER_OPEN_BROWSER: '0', ASKUSER_ADAPTER_CODEX: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('fake MCP host handshake timed out')), 5000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const line = stdout.split(/\r?\n/).find((entry) => entry.includes('"result"'));
      if (line) {
        clearTimeout(timer);
        resolve(JSON.parse(line));
      }
    });
    child.on('error', reject);
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fake-codex', version: 'test' } } })}\n`);
  const result = await response;
  assert.equal(result.id, 1);
  assert.equal(result.result.serverInfo.name, 'askuserquestionspro');
  child.kill();
});

test('stale selectors are represented as distinct from current opaque identity', () => {
  const current = { requestId: 'current-request', roundId: 'round-2', capability: 'cap-2' };
  const stale = { requestId: 'old-request', roundId: 'round-1', capability: 'cap-1' };
  assert.notDeepEqual(stale, current);
  assert.notEqual(stale.capability, current.capability);
});
