'use strict';

const STATES = Object.freeze([
  'drafting',
  'detached',
  'reconnecting',
  'delivery-pending',
  'delivered',
  'delivery-uncertain',
  'cancelled',
  'recovery-error',
  'expired',
]);
const DEADLINE_OWNERS = Object.freeze(['application', 'host', 'transport', 'browser', 'none']);
const TERMINAL_REASONS = Object.freeze([
  'completed',
  'user_cancelled',
  'host_cancelled',
  'host_disconnect',
  'browser_disconnect',
  'application_timeout',
  'bridge_error',
]);

const TRANSITIONS = {
  drafting: {
    detach: 'detached',
    answerAccepted: 'delivery-pending',
    cancel: 'cancelled',
    recoveryError: 'recovery-error',
  },
  detached: {
    resume: 'reconnecting',
    answerAccepted: 'delivery-pending',
    expire: 'expired',
    cancel: 'cancelled',
    recoveryError: 'recovery-error',
  },
  reconnecting: {
    answerAccepted: 'delivery-pending',
    detach: 'detached',
    cancel: 'cancelled',
    recoveryError: 'recovery-error',
  },
  'delivery-pending': {
    delivered: 'delivered',
    uncertain: 'delivery-uncertain',
    cancel: 'cancelled',
    recoveryError: 'recovery-error',
  },
  delivered: {},
  'delivery-uncertain': { delivered: 'delivered' },
  cancelled: {},
  'recovery-error': {},
  expired: {},
};

function createRecord({ id, capability, now, deadlineOwner = 'none' }) {
  return {
    id,
    capability,
    state: 'drafting',
    deadlineOwner,
    terminalReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function transition(record, event, { now, deadlineOwner, reason } = {}) {
  const state = TRANSITIONS[record.state]?.[event];
  if (!state) return { ok: false, record };
  const terminalReason =
    reason ||
    (event === 'delivered'
      ? 'completed'
      : event === 'expire'
        ? 'application_timeout'
        : event === 'cancel'
          ? 'bridge_error'
          : null);
  return {
    ok: true,
    record: {
      ...record,
      state,
      deadlineOwner: DEADLINE_OWNERS.includes(deadlineOwner) ? deadlineOwner : record.deadlineOwner,
      terminalReason: TERMINAL_REASONS.includes(terminalReason)
        ? terminalReason
        : terminalReason == null
          ? null
          : 'bridge_error',
      updatedAt: now,
    },
  };
}

function snapshot(record) {
  if (!record) return null;
  const { id, capability, state, deadlineOwner, terminalReason, createdAt, updatedAt } = record;
  return { id, capability, state, deadlineOwner, terminalReason, createdAt, updatedAt };
}

module.exports = { STATES, DEADLINE_OWNERS, TERMINAL_REASONS, createRecord, transition, snapshot };
