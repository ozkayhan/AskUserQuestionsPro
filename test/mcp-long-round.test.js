'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');

const MCP_PATH = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');
const SERVER_PATH = path.join(__dirname, '..', 'server', 'server.js');

async function unusedPort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForHealth(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // The child may need a few event-loop turns before listen().
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('test bridge başlamadı');
}

async function waitForLifecycleState(port, state, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
    if (current.lifecycle?.state === state) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`lifecycle state beklenirken zaman aşımı: ${state}`);
}

test('MCP stdio: 15 soru heartbeat arkasında bekler ve doğru cevapla tamamlanır', async () => {
  const port = await unusedPort();
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-mcp-long-'));
  const env = {
    ...process.env,
    ASKUSER_PORT: String(port),
    ASKUSER_OPEN_BROWSER: '0',
    ASKUSER_MCP_PROGRESS_INTERVAL_MS: '25',
    XDG_CONFIG_HOME: xdg,
  };
  const server = spawn(process.execPath, [SERVER_PATH], { stdio: 'ignore', env });
  const mcp = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'], env });
  const messages = [];
  const waiters = [];
  let output = '';

  const notifyWaiters = () => {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      const match = messages.find(waiter.predicate);
      if (match) {
        waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(match);
      }
    }
  };
  const waitFor = (predicate, timeoutMs = 10_000) => {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        timeout: setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('MCP JSON-RPC yanıtı zaman aşımına uğradı'));
        }, timeoutMs),
      };
      waiters.push(waiter);
    });
  };

  mcp.stdout.setEncoding('utf8');
  mcp.stdout.on('data', (chunk) => {
    output += chunk;
    const lines = output.split('\n');
    output = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      messages.push(JSON.parse(line));
    }
    notifyWaiters();
  });

  const stopChild = (child) =>
    child.exitCode === null
      ? new Promise((resolve) => {
          child.once('exit', resolve);
          child.kill();
        })
      : Promise.resolve();

  try {
    await waitForHealth(port);
    mcp.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {} },
      }) + '\n'
    );
    await waitFor((message) => message.id === 1);

    const questions = Array.from({ length: 15 }, (_, index) => ({
      question: `Uzun tur sorusu ${index + 1}?`,
      header: `S${index + 1}`,
      options: [{ label: 'Devam' }, { label: 'Durdur' }],
    }));
    const answers = Object.fromEntries(questions.map((question) => [question.question, 'Devam']));
    mcp.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ask',
          _meta: { progressToken: 'long-round-test' },
          arguments: { questions },
        },
      }) + '\n'
    );

    const currentDeadline = Date.now() + 10_000;
    let current;
    while (Date.now() < currentDeadline) {
      current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
      if (current.id != null) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(current?.id != null, '15 soruluk tur sunucuda pending olmalı');
    assert.strictEqual(current.questions.length, 15);

    const progress = await waitFor(
      (message) =>
        message.method === 'notifications/progress' &&
        message.params?.progressToken === 'long-round-test',
      10_000
    );
    await waitFor(
      (message) =>
        message.method === 'notifications/progress' &&
        message.params?.progressToken === 'long-round-test' &&
        message.params.progress > progress.params.progress,
      10_000
    );

    const answerResponse = await fetch(`http://127.0.0.1:${port}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: current.id, capability: current.capability, answers }),
    });
    assert.strictEqual(answerResponse.status, 200);
    const result = await waitFor((message) => message.id === 2, 10_000);
    assert.strictEqual(result.result.isError, undefined);
    assert.deepStrictEqual(result.result.structuredContent, { answers });

    const progressCount = messages.filter(
      (message) => message.method === 'notifications/progress'
    ).length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(
      messages.filter((message) => message.method === 'notifications/progress').length,
      progressCount,
      'tool sonucu sonrasında heartbeat durmalı'
    );
  } finally {
    for (const waiter of waiters) clearTimeout(waiter.timeout);
    await Promise.all([stopChild(mcp), stopChild(server)]);
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});

test('MCP resume: kopan host turu browser cevabini yeni MCP processine verir', async () => {
  const port = await unusedPort();
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-mcp-resume-'));
  const env = {
    ...process.env,
    ASKUSER_PORT: String(port),
    ASKUSER_OPEN_BROWSER: '0',
    XDG_CONFIG_HOME: xdg,
  };
  const server = spawn(process.execPath, [SERVER_PATH], { stdio: 'ignore', env });
  const mcp = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'], env });
  let output = '';
  const messages = [];
  const waitForResult = (id) =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('resume MCP sonucu gelmedi')), 5000);
      const check = () => {
        const message = messages.find((item) => item.id === id);
        if (message) {
          clearTimeout(deadline);
          resolve(message);
          return true;
        }
        return false;
      };
      if (check()) return;
      const interval = setInterval(() => {
        if (check()) clearInterval(interval);
      }, 10);
    });

  try {
    await waitForHealth(port);
    const request = require('node:http').request(`http://127.0.0.1:${port}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    request.on('error', () => {});
    request.end(
      JSON.stringify({
        requestId: 'lost-host',
        questions: [{ question: 'Kopan tur?', header: 'Resume', options: [{ label: 'Tamam' }] }],
      })
    );
    let current;
    const currentDeadline = Date.now() + 5000;
    while (Date.now() < currentDeadline) {
      current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
      if (current.id != null) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(current?.id != null, 'detached test round sunucuda pending olmali');
    request.destroy();
    current = await waitForLifecycleState(port, 'detached');
    assert.ok(current.capability, 'detached round capability korunmalı');

    mcp.stdout.setEncoding('utf8');
    mcp.stdout.on('data', (chunk) => {
      output += chunk;
      const lines = output.split('\n');
      output = lines.pop();
      for (const line of lines) if (line.trim()) messages.push(JSON.parse(line));
    });
    mcp.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'resume', arguments: { requestId: 'lost-host' } },
      }) + '\n'
    );
    current = await waitForLifecycleState(port, 'reconnecting');
    const answer = await fetch(`http://127.0.0.1:${port}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: current.id,
        capability: current.capability,
        answers: { 'Kopan tur?': 'Tamam' },
      }),
    });
    assert.strictEqual(answer.status, 200);
    const result = await waitForResult(9);
    assert.deepStrictEqual(result.result.structuredContent, { answers: { 'Kopan tur?': 'Tamam' } });
  } finally {
    await Promise.all(
      [mcp, server].map((child) =>
        child.exitCode === null
          ? new Promise((resolve) => {
              child.once('exit', resolve);
              child.kill();
            })
          : Promise.resolve()
      )
    );
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});

test('MCP stdin EOF aktif ask turunu detach eder ve yeni process resume edebilir', async () => {
  const port = await unusedPort();
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-mcp-eof-'));
  const env = {
    ...process.env,
    ASKUSER_PORT: String(port),
    ASKUSER_OPEN_BROWSER: '0',
    XDG_CONFIG_HOME: xdg,
  };
  const server = spawn(process.execPath, [SERVER_PATH], { stdio: 'ignore', env });
  const first = spawn(process.execPath, [MCP_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
  const firstMessages = [];
  const attachParser = (child, messages) => {
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const lines = output.split('\n');
      output = lines.pop();
      for (const line of lines) if (line.trim()) messages.push(JSON.parse(line));
    });
    return () => output;
  };
  const getFirstOutput = attachParser(first, firstMessages);

  const waitForMessage = (messages, predicate, timeoutMs = 5000) =>
    new Promise((resolve, reject) => {
      let poll;
      const deadline = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('MCP JSON-RPC yanıtı zaman aşımına uğradı'));
      }, timeoutMs);
      const check = () => {
        const message = messages.find(predicate);
        if (!message) return;
        clearTimeout(deadline);
        clearInterval(poll);
        resolve(message);
      };
      poll = setInterval(check, 10);
      check();
      deadline.unref?.();
      poll.unref?.();
    });
  const waitForExit = (child, timeoutMs = 5000) =>
    child.exitCode !== null
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('EOF sonrası MCP process kapanmadı')),
            timeoutMs
          );
          child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
  const stopChild = (child) =>
    child?.exitCode === null
      ? new Promise((resolve) => {
          child.once('exit', resolve);
          child.kill();
        })
      : Promise.resolve();

  try {
    await waitForHealth(port);
    first.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {} },
      }) + '\n'
    );
    await waitForMessage(firstMessages, (message) => message.id === 1);
    first.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'ask',
          arguments: {
            questions: [{ question: 'EOF detach?', header: 'T-Rex', options: [{ label: 'Yes' }] }],
          },
        },
      }) + '\n'
    );

    let current;
    const currentDeadline = Date.now() + 5000;
    while (Date.now() < currentDeadline) {
      current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
      if (current.id != null) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(current?.id != null, 'EOF test round sunucuda pending olmalı');

    first.stdin.end();
    await waitForExit(first);
    assert.strictEqual(getFirstOutput(), '', 'EOF sonrası ilk process geç sonuç yazmamalı');
    current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
    assert.equal(current.id != null, true, 'stdin EOF browser roundunu düşürmemeli');
    assert.ok(current.capability, 'stdin EOF capability bilgisini korumalı');

    const second = spawn(process.execPath, [MCP_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    const secondMessages = [];
    attachParser(second, secondMessages);
    try {
      second.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 11,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {} },
        }) + '\n'
      );
      await waitForMessage(secondMessages, (message) => message.id === 11);
      second.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: { name: 'resume', arguments: { roundId: current.roundId } },
        }) + '\n'
      );
      await waitForLifecycleState(port, 'reconnecting');
      const answer = await fetch(`http://127.0.0.1:${port}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: current.id,
          capability: current.capability,
          answers: { 'EOF detach?': 'Yes' },
        }),
      });
      assert.strictEqual(answer.status, 200);
      const result = await waitForMessage(secondMessages, (message) => message.id === 12);
      assert.deepStrictEqual(result.result.structuredContent, {
        answers: { 'EOF detach?': 'Yes' },
      });
    } finally {
      await stopChild(second);
    }
  } finally {
    await Promise.all([stopChild(first), stopChild(server)]);
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});
