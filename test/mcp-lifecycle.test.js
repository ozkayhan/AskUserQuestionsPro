'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const MCP_PATH = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');

function waitForExit(child, timeoutMs = 1000) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit);
      reject(new Error(`MCP process ${timeoutMs}ms içinde kapanmadı`));
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    child.once('exit', onExit);
  });
}

function waitForOutput(child, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.stdout.removeListener('data', onData);
      reject(new Error('MCP stdout yanıtı beklenirken zaman aşımı'));
    }, timeoutMs);
    const onData = (chunk) => {
      clearTimeout(timeout);
      child.stdout.removeListener('data', onData);
      resolve(chunk.toString());
    };
    child.stdout.once('data', onData);
  });
}

function spawnMcp() {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  return child;
}

function initialize(child) {
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {} },
    }) + '\n'
  );
  return waitForOutput(child);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.stdin.end();
  await waitForExit(child);
}

test('MCP kapalı stdout transportunu terminal hata olarak ele alıp kapanır', async () => {
  const mcp = spawnMcp();

  try {
    mcp.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {} },
      }) + '\n'
    );
    await waitForOutput(mcp);

    mcp.stdout.destroy();
    mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');

    await waitForExit(mcp);
    assert.equal(mcp.signalCode, null);
    assert.equal(mcp.exitCode, 1);
  } finally {
    if (mcp.exitCode === null) mcp.kill('SIGKILL');
  }
});

test('MCP stdin EOF boş oturumda bounded sürede kapanır', async () => {
  const mcp = spawnMcp();
  try {
    await initialize(mcp);
    await stop(mcp);
    assert.equal(mcp.exitCode, 0);
  } finally {
    if (mcp.exitCode === null) mcp.kill('SIGKILL');
  }
});

test('MCP stdin EOF geçersiz son satırda da shutdown yolunu çalıştırır', async () => {
  const mcp = spawnMcp();
  try {
    mcp.stdin.write('{not-json}\n');
    await stop(mcp);
    assert.equal(mcp.exitCode, 0);
  } finally {
    if (mcp.exitCode === null) mcp.kill('SIGKILL');
  }
});

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  test(`MCP ${signal} idempotent shutdown ile kapanır`, async () => {
    const mcp = spawnMcp();
    try {
      await initialize(mcp);
      mcp.kill(signal);
      await waitForExit(mcp);
      assert.equal(mcp.signalCode, null);
      assert.equal(mcp.exitCode, 0);
    } finally {
      if (mcp.exitCode === null) mcp.kill('SIGKILL');
    }
  });
}

test('MCP sahibi istemci zorla öldürülünce stdin EOF ile kapanır', async () => {
  const childScript = [
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, [${JSON.stringify(MCP_PATH)}], { stdio: ['inherit', 'ignore', 'ignore'] });`,
    'process.stdout.write(String(child.pid));',
    'setInterval(() => {}, 1000);',
  ].join('');
  const client = spawn(process.execPath, ['-e', childScript], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let pidOutput = '';
  client.stdout.setEncoding('utf8');
  client.stdout.on('data', (chunk) => {
    pidOutput += chunk;
  });
  let childExited = false;
  let cleanupError;

  try {
    const deadline = Date.now() + 1000;
    while (!pidOutput && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    const mcpPid = Number(pidOutput);
    assert.ok(Number.isInteger(mcpPid) && mcpPid > 0, 'MCP child PID alınmalı');
    client.kill('SIGKILL');

    const exitDeadline = Date.now() + 1500;
    while (Date.now() < exitDeadline) {
      try {
        process.kill(mcpPid, 0);
      } catch (error) {
        if (error.code === 'ESRCH') {
          childExited = true;
          break;
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(childExited, true, 'MCP sahibi öldükten sonra child kapanmalı');
  } finally {
    if (client.exitCode === null) client.kill('SIGKILL');
    const mcpPid = Number(pidOutput);
    if (Number.isInteger(mcpPid) && mcpPid > 0) {
      try {
        process.kill(mcpPid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') cleanupError = error;
      }
    }
  }
  if (cleanupError) throw cleanupError;
});

test('MCP istemcileri bağımsız kapanır ve eşzamanlı geçerli istemci etkilenmez', async () => {
  const first = spawnMcp();
  const second = spawnMcp();
  try {
    await Promise.all([initialize(first), initialize(second)]);
    await stop(first);
    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, null);

    second.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');
    const output = await waitForOutput(second);
    assert.match(output, /"id":2/);
  } finally {
    await Promise.all([stop(first), stop(second)]);
  }
});

test('MCP 100 spawn/EOF döngüsünde süreç veya handle sızıntısı bırakmaz', async () => {
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const mcp = spawnMcp();
    mcp.stdin.end();
    await waitForExit(mcp, 1000);
    assert.equal(mcp.exitCode, 0, `stres döngüsü ${iteration + 1} başarısız`);
  }
});
