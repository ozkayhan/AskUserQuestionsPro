'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createProgressHeartbeat } = require('../lib/mcp-progress.cjs');

test('progress heartbeat: valid token ile monoton bildirim üretir', async () => {
  const notifications = [];
  const heartbeat = createProgressHeartbeat({
    token: 'codex-request-1',
    intervalMs: 5,
    send: (message) => notifications.push(message),
  });

  await new Promise((resolve) => setTimeout(resolve, 24));
  heartbeat.stop();

  assert.ok(notifications.length >= 2, 'en az iki progress bildirimi beklenir');
  assert.ok(
    notifications.every((message) => message.method === 'notifications/progress'),
    'bildirim metodu MCP progress olmalı'
  );
  assert.ok(
    notifications.every((message) => message.params.progressToken === 'codex-request-1'),
    'her bildirim özgün progress tokenı taşımalı'
  );
  for (let index = 1; index < notifications.length; index += 1) {
    assert.ok(
      notifications[index].params.progress > notifications[index - 1].params.progress,
      'progress her bildirimde artmalı'
    );
  }
});

test('progress heartbeat: token yoksa bildirim göndermez', async () => {
  const notifications = [];
  const heartbeat = createProgressHeartbeat({
    send: (message) => notifications.push(message),
    intervalMs: 5,
  });

  await new Promise((resolve) => setTimeout(resolve, 15));
  heartbeat.stop();

  assert.strictEqual(heartbeat.enabled, false);
  assert.deepStrictEqual(notifications, []);
});

test('progress heartbeat: stop sonrası yeni bildirim üretmez', async () => {
  const notifications = [];
  const heartbeat = createProgressHeartbeat({
    token: 7,
    send: (message) => notifications.push(message),
    intervalMs: 5,
  });

  await new Promise((resolve) => setTimeout(resolve, 8));
  heartbeat.stop();
  const countAtStop = notifications.length;
  await new Promise((resolve) => setTimeout(resolve, 18));

  assert.strictEqual(notifications.length, countAtStop);
});
