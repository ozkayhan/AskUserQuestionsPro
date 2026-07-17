'use strict';

const { randomBytes } = require('node:crypto');
const { STATES, createRecord, snapshot } = require('./round-state.cjs');

const FORMAT_VERSION = 1;
const ID_RE = /^round_[A-Za-z0-9_-]{16,}$/;

function fail(code) {
  return { ok: false, code };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function create({ questions, requestId, capability, now, retentionMs, lifecycle, roundId }) {
  const id = roundId || `round_${randomBytes(18).toString('base64url')}`;
  if (!Array.isArray(questions) || !questions.length || !Number.isFinite(now) || !Number.isFinite(retentionMs) || retentionMs < 1) {
    throw new TypeError('invalid durable round registration');
  }
  const state = lifecycle || createRecord({ id, capability, now });
  return {
    formatVersion: FORMAT_VERSION,
    roundId: id,
    requestId: typeof requestId === 'string' ? requestId : null,
    capability,
    questions: clone(questions),
    answers: null,
    lifecycle: snapshot(state),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + retentionMs,
    delivery: { uncertainAt: null, acknowledgedAt: null },
    migration: { legacyRegistration: true },
  };
}

function validate(record) {
  if (!record || typeof record !== 'object') return fail('invalid_record');
  if (record.formatVersion !== FORMAT_VERSION) return fail('unsupported_format');
  if (!ID_RE.test(record.roundId || '')) return fail('invalid_record');
  if (!Array.isArray(record.questions) || !record.questions.length || typeof record.capability !== 'string') return fail('invalid_record');
  if (!Number.isInteger(record.revision) || record.revision < 0 || !Number.isFinite(record.createdAt) || !Number.isFinite(record.updatedAt) || !Number.isFinite(record.expiresAt) || record.expiresAt < record.createdAt) return fail('invalid_record');
  if (!record.lifecycle || !STATES.includes(record.lifecycle.state)) return fail('invalid_record');
  if (record.answers !== null && (typeof record.answers !== 'object' || Array.isArray(record.answers))) return fail('invalid_record');
  if (!record.delivery || typeof record.delivery !== 'object') return fail('invalid_record');
  return { ok: true, record: clone(record) };
}

function revised(record, patch, now) {
  return { ...record, ...patch, revision: record.revision + 1, updatedAt: now };
}

function expected(record, expectedRevision) {
  return expectedRevision == null || record.revision === expectedRevision;
}

function saveDraft(record, answers, expectedRevision, now) {
  if (!validate(record).ok || !expected(record, expectedRevision)) return fail('stale_revision');
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || record.answers) return fail('invalid_record');
  if (JSON.stringify(record.draftAnswers || null) === JSON.stringify(answers)) return { ok: true, record, replayed: true };
  return { ok: true, record: revised(record, { draftAnswers: clone(answers) }, now) };
}

function transition(record, event, expectedRevision, now, details = {}) {
  if (!validate(record).ok || !expected(record, expectedRevision)) return fail('stale_revision');
  const nextState = {
    detach: 'detached', resume: 'reconnecting', uncertain: 'delivery-uncertain', delivered: 'delivered',
    cancel: 'cancelled', expire: 'expired', recoveryError: 'recovery-error',
  }[event];
  if (!nextState) return fail('invalid_record');
  if (record.lifecycle.state === nextState) return { ok: true, record, replayed: true };
  return { ok: true, record: revised(record, { lifecycle: { ...record.lifecycle, state: nextState, updatedAt: now, ...details } }, now) };
}

function finalize(record, answers, expectedRevision, now) {
  if (!validate(record).ok) return fail('invalid_record');
  if (record.answers) {
    return JSON.stringify(record.answers) === JSON.stringify(answers)
      ? { ok: true, record, replayed: true }
      : fail('immutable_result');
  }
  if (!expected(record, expectedRevision) || !answers || typeof answers !== 'object' || Array.isArray(answers)) return fail('stale_revision');
  return { ok: true, record: revised(record, { answers: clone(answers), draftAnswers: clone(answers), lifecycle: { ...record.lifecycle, state: 'delivery-pending', updatedAt: now } }, now) };
}

function acknowledge(record, now) {
  if (!validate(record).ok) return fail('invalid_record');
  if (!record.answers) return fail('result_not_ready');
  if (record.delivery.acknowledgedAt != null) return { ok: true, record, replayed: true };
  return { ok: true, record: revised(record, { delivery: { ...record.delivery, acknowledgedAt: now }, lifecycle: { ...record.lifecycle, state: 'delivered', updatedAt: now } }, now) };
}

function metadata(record) {
  return { roundId: record.roundId, requestId: record.requestId, state: record.lifecycle.state, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt, expiresAt: record.expiresAt, questionCount: record.questions.length };
}

module.exports = { FORMAT_VERSION, create, validate, saveDraft, transition, finalize, acknowledge, metadata };
