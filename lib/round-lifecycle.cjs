'use strict';

const { log: defaultLogger } = require('./log.cjs');

const EVENTS = new Set([
  'round_started',
  'ask_received',
  'round_registered',
  'browser_opened',
  'sse_connected',
  'answer_received',
  'ask_response_closed',
  'host_detached',
  'round_resumed',
  'delivery_uncertain',
  'host_abort',
  'host_cancelled',
  'browser_disconnect',
  'bridge_cancelled',
  'round_timeout',
  'process_exit',
  'round_finished',
]);

const REASONS = new Set([
  'completed',
  'user_cancelled',
  'host_cancelled',
  'host_disconnect',
  'browser_disconnect',
  'application_timeout',
  'process_exit',
  'bridge_error',
]);
const BOUNDARIES = new Set(['bridge', 'http', 'sse', 'hook', 'mcp', 'stdio', 'browser']);
const DEADLINE_OWNERS = new Set(['application', 'host', 'transport', 'browser', 'none']);

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Redacted, correlation-only lifecycle recorder for a question round.
 * It intentionally accepts no question/answer payload in its output schema.
 */
function createLifecycle({
  adapter = 'unknown',
  requestId,
  roundId,
  pid = process.pid,
  now = Date.now,
  logger = defaultLogger,
} = {}) {
  const startedAt = finite(now(), Date.now());
  let finished = false;
  let currentRoundId = roundId;

  function emit(event, reason, details = {}) {
    const payload = {
      event: EVENTS.has(event) ? event : 'unknown_event',
      adapter: String(adapter),
      requestId: requestId == null ? undefined : String(requestId),
      roundId: currentRoundId == null ? undefined : currentRoundId,
      pid: finite(pid, process.pid),
      elapsedMs: Math.max(0, finite(now(), startedAt) - startedAt),
    };
    if (reason !== undefined) payload.reason = REASONS.has(reason) ? reason : 'unknown';
    if (BOUNDARIES.has(details.boundary)) payload.boundary = details.boundary;
    if (DEADLINE_OWNERS.has(details.deadlineOwner)) payload.deadlineOwner = details.deadlineOwner;
    try {
      logger('lifecycle', JSON.stringify(payload));
    } catch {
      // Diagnostics must never change the question flow.
    }
  }

  emit('round_started');

  return {
    setRoundId(id) {
      currentRoundId = id;
    },
    event(name, details) {
      if (finished) return;
      emit(name, undefined, details);
    },
    finish(reason = 'bridge_error', details) {
      if (finished) return;
      finished = true;
      emit('round_finished', reason, details);
    },
  };
}

module.exports = { createLifecycle, EVENTS, REASONS, BOUNDARIES, DEADLINE_OWNERS };
