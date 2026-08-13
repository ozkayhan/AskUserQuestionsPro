'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const root = path.join(__dirname, '..');
const APP_ID = require('../lib/app-id.cjs');
const pkg = require('../package.json');
const { validQuestions, QUESTION_SCHEMA } = require('../lib/question-contract.cjs');

function runNode(file, input, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.end(input);
  });
}

test('bridge health exposes strict identity and protocol metadata', async () => {
  const { server } = require('../server/server.js');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.deepEqual(await response.json(), {
      ok: true,
      app: APP_ID,
      protocolVersion: '1',
      packageVersion: pkg.version,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections?.();
  }
});

test('question contract defaults headers and rejects duplicate question and sibling labels', () => {
  const missingHeader = validQuestions([{ question: 'One?', options: [{ label: 'A' }] }]);
  assert.equal(missingHeader.ok, true);
  assert.equal(missingHeader.questions[0].header, 'General');

  const duplicateQuestion = validQuestions([
    { question: 'Same?', options: [{ label: 'A' }] },
    { question: 'Same?', options: [{ label: 'B' }] },
  ]);
  assert.equal(duplicateQuestion.ok, false);
  assert.match(duplicateQuestion.error, /duplicate question/i);

  const duplicateLabels = validQuestions([
    { question: 'Pick?', options: [{ label: 'A' }, { label: 'A' }] },
  ]);
  assert.equal(duplicateLabels.ok, false);
  assert.match(duplicateLabels.error, /duplicate option label/i);
});

test('MCP ask schema is sourced from the shared question contract and header is optional', () => {
  const mcp = fs.readFileSync(path.join(root, 'mcp-server', 'askuserquestionspro-mcp.mjs'), 'utf8');
  assert.match(mcp, /QUESTION_SCHEMA/);
  assert.equal(QUESTION_SCHEMA.properties.questions.items.required.includes('header'), false);
  assert.deepEqual(QUESTION_SCHEMA.properties.questions.items.required, ['question']);
});

test('MCP initialize reports the package manifest version', async () => {
  const result = await runNode(
    path.join(root, 'mcp-server', 'askuserquestionspro-mcp.mjs'),
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {} },
    })}\n`
  );
  const response = JSON.parse(result.stdout.trim());
  assert.equal(response.result.serverInfo.version, pkg.version);
});

test('hook uses native fallback for stdin payloads over 8 MiB', async () => {
  const oversized = JSON.stringify({
    tool_input: { questions: [], padding: 'x'.repeat(8 * 1024 * 1024) },
  });
  const result = await runNode(
    path.join(root, 'hooks', 'askuserquestionspro-bridge.mjs'),
    oversized
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
});

test('installer validates Node 18+, stages the bundle, and verifies immutable releases', () => {
  const installer = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  assert.match(installer, /node --version/);
  assert.match(installer, /STAGING_DIR/);
  assert.match(installer, /rollback|ROLLBACK/i);
  assert.match(installer, /sha256|shasum/);
  assert.doesNotMatch(installer, /BRANCH="main"/);
});

test('uninstaller filters bridge PIDs by the managed AskUser runtime command', () => {
  const uninstaller = fs.readFileSync(path.join(root, 'uninstall.sh'), 'utf8');
  assert.match(uninstaller, /expected|managed|askuserquestionspro.*server\/server\.js/i);
  assert.match(uninstaller, /ps .*command|ps -p/);
});

test('reinstall fetches immutable tagged scripts with checksums', () => {
  const reinstall = fs.readFileSync(path.join(root, 'reinstall.sh'), 'utf8');
  assert.match(reinstall, /RELEASE_TAG/);
  assert.match(reinstall, /SHA256|sha256|shasum/);
  assert.doesNotMatch(reinstall, /BRANCH="main"/);
});

test('host hardening test fixtures do not leave temporary config directories behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'askpro-hardening-'));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(fs.existsSync(dir), false);
});

test('pending polling aborts a bridge that accepts but never answers', async () => {
  const stalled = http.createServer(() => {});
  await new Promise((resolve) => stalled.listen(0, '127.0.0.1', resolve));
  const savedPort = process.env.ASKUSER_PORT;
  process.env.ASKUSER_PORT = String(stalled.address().port);
  const bridgeClient = await import(`../lib/bridge-client.mjs?stalled=${Date.now()}`);
  try {
    const result = await Promise.race([
      bridgeClient.waitForPending({ timeoutMs: 120, intervalMs: 10 }),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 700)),
    ]);
    assert.equal(result, false);
  } finally {
    if (savedPort === undefined) delete process.env.ASKUSER_PORT;
    else process.env.ASKUSER_PORT = savedPort;
    stalled.closeAllConnections?.();
    await new Promise((resolve) => stalled.close(resolve));
  }
});

test('MCP rejects oversized JSONL input with a protocol error', async () => {
  const oversized = `${'{'.repeat(1)}${'x'.repeat(8 * 1024 * 1024)}\n`;
  const result = await runNode(
    path.join(root, 'mcp-server', 'askuserquestionspro-mcp.mjs'),
    oversized
  );
  assert.equal(result.code, 1);
  assert.match(result.stdout, /-32600/);
  assert.match(result.stdout, /8 MiB/);
});
