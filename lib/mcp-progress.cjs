'use strict';

const DEFAULT_INTERVAL_MS = 15_000;

function isProgressToken(value) {
  return typeof value === 'string' || Number.isInteger(value);
}

/**
 * Emit optional MCP progress notifications for an in-flight request.
 *
 * The caller owns the JSON-RPC transport. This module deliberately accepts a
 * sender instead of writing to stdout so that it is safe to test and cannot
 * accidentally include question or answer payloads.
 */
function createProgressHeartbeat({
  token,
  send,
  intervalMs = DEFAULT_INTERVAL_MS,
  now = Date.now,
  message = 'Waiting for user input',
} = {}) {
  if (!isProgressToken(token) || typeof send !== 'function') {
    return { enabled: false, stop() {} };
  }

  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS;
  const startedAt = Number(now());
  let progress = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const elapsedSeconds = Math.max(0, Math.floor((Number(now()) - startedAt) / 1000));
    progress = Math.max(progress + 1, elapsedSeconds);
    try {
      send({
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          progressToken: token,
          progress,
          message,
        },
      });
    } catch {
      // A host that has already closed stdout will be reported by the owning
      // request's lifecycle path. A heartbeat must never crash that process.
    }
  };

  const timer = setInterval(tick, interval);
  timer.unref?.();

  return {
    enabled: true,
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}

module.exports = { createProgressHeartbeat, isProgressToken };
