'use strict';

const { randomBytes } = require('node:crypto');
const { createRecord, transition, snapshot } = require('../lib/round-state.cjs');
const Record = require('../lib/round-record.cjs');

const RECOVERABLE_STATES = Object.freeze([
  'drafting',
  'detached',
  'reconnecting',
  'delivery-uncertain',
]);
const ROUND_ID_RE = /^round_[A-Za-z0-9_-]{16,}$/;

const CANCEL_REASON_MAP = new Map([
  ['client disconnected', 'host_disconnect'],
  ['host disconnected', 'host_disconnect'],
  ['host cancelled', 'host_cancelled'],
  ['browser disconnected', 'browser_disconnect'],
  ['user cancelled', 'user_cancelled'],
  ['timeout', 'application_timeout'],
  ['application timeout', 'application_timeout'],
  ['detached round expired', 'application_timeout'],
]);

const DEFAULT_DETACHED_TTL_MS = 60 * 60 * 1000;

function terminalReason(reason) {
  return CANCEL_REASON_MAP.get(String(reason || '').toLowerCase()) || 'bridge_error';
}

function terminalLifecycleDetails(outcome) {
  if (outcome === 'user_cancelled' || outcome === 'browser_disconnect') {
    return { boundary: 'browser', deadlineOwner: 'none' };
  }
  if (outcome === 'host_cancelled' || outcome === 'host_disconnect') {
    return { boundary: 'bridge', deadlineOwner: 'host' };
  }
  if (outcome === 'application_timeout') {
    return { boundary: 'bridge', deadlineOwner: 'application' };
  }
  return { boundary: 'bridge', deadlineOwner: 'none' };
}

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
// Her tur monoton artan bir `id` taşır (UI'ın tur başına remount kararı için).
// Cevap/iptal yolları bu id ile sahiplenir: gec gelen bir tur, o sirada bekleyen
// baska bir turu sessizce çözemez/iptal edemez (cross-round race koruması — Contract R).
class Bridge {
  constructor({
    detachedTtlMs = DEFAULT_DETACHED_TTL_MS,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    store = null,
  } = {}) {
    this._pending = null; // { id, questions, resolve, reject, waiters, detached }
    this._seq = 0;
    this._now = now;
    this._setTimer = setTimer;
    this._clearTimer = clearTimer;
    this._lastSnapshot = null;
    this._detachedTtlMs = Number.isFinite(detachedTtlMs)
      ? Math.max(1, detachedTtlMs)
      : DEFAULT_DETACHED_TTL_MS;
    this._completed = new Map();
    this._completedTimers = new Map();
    this._deliveries = new Map();
    this._store = store;
    this._hydrateUniqueRecovery();
  }

  _hydrateUniqueRecovery() {
    if (!this._store) return;
    const records = this._store.recoverable();
    if (records.length === 1) this._hydrate(records[0]);
  }

  _hydrate(record) {
    if (this._pending) return this._pending.durable?.roundId === record.roundId;
    const id =
      Number.isInteger(record.lifecycle.id) && record.lifecycle.id > 0
        ? record.lifecycle.id
        : ++this._seq;
    this._seq = Math.max(this._seq, id);
    const p = {
      id,
      questions: record.questions,
      requestId: record.requestId || undefined,
      resolve() {},
      reject() {},
      waiters: [],
      // A recovered browser round remains resumable until it reaches a terminal
      // lifecycle. In particular, a restart can happen after /resume persisted
      // `reconnecting`; treating that as host-owned would strand the browser.
      detached: ['drafting', 'detached', 'reconnecting'].includes(record.lifecycle.state),
      detachTimer: null,
      record: record.lifecycle,
      durable: record,
    };
    this._pending = p;
    const remaining = record.expiresAt - this._now();
    if (remaining <= 0) {
      this.expire(p.id, p.record.capability);
    } else {
      p.detachTimer = this._setTimer(() => this.expire(p.id, p.record.capability), remaining);
      p.detachTimer.unref?.();
    }
    return true;
  }

  _selector(selector) {
    if (typeof selector === 'string') return { requestId: selector };
    if (!selector || typeof selector !== 'object') return null;
    const { requestId, roundId } = selector;
    if (typeof requestId !== 'string' && typeof roundId !== 'string') return null;
    return { requestId, roundId };
  }

  _selectDurable(selector) {
    const selected = this._selector(selector);
    if (!selected) return { ok: false, code: 'invalid_selector' };
    if (!this._store) return { ok: false, code: 'not_found' };
    const found = selected.roundId
      ? this._store.get(selected.roundId)
      : this._store.findByRequestId(selected.requestId);
    if (!found.ok) return found;
    if (selected.requestId && found.record.requestId !== selected.requestId)
      return { ok: false, code: 'ownership_conflict' };
    if (found.record.expiresAt <= this._now()) return { ok: false, code: 'expired' };
    return found;
  }

  _recover(selector) {
    const found = this._selectDurable(selector);
    if (!found.ok) return found;
    if (found.record.answers) return { ok: true, record: found.record };
    if (!['drafting', 'detached', 'reconnecting'].includes(found.record.lifecycle.state))
      return { ok: false, code: 'stale_round' };
    if (this._pending && this._pending.durable?.roundId !== found.record.roundId)
      return { ok: false, code: 'round_in_progress' };
    this._hydrate(found.record);
    return { ok: true, record: found.record };
  }

  // Hook tarafı: soru setini kaydet, cevap promise'i al.
  // requestId, aynı anda yarışan istemcilerin /current yoklamasını birbirinden
  // ayırmak için kullanılır; eski çağrılar için isteğe bağlıdır.
  submitQuestions(questions, requestId, lifecycle) {
    if (this._pending) {
      return Promise.reject(new Error('A question set is already pending'));
    }
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      this._pending = {
        id,
        questions,
        requestId,
        lifecycle,
        resolve,
        reject,
        waiters: [],
        detached: false,
        detachTimer: null,
        record: createRecord({
          id,
          capability: randomBytes(32).toString('base64url'),
          now: this._now(),
        }),
      };
      if (this._store) {
        const created = this._store.create({
          questions,
          requestId,
          capability: this._pending.record.capability,
          retentionMs: this._detachedTtlMs,
          lifecycle: this._pending.record,
        });
        if (!created.ok) {
          this._pending = null;
          reject(
            Object.assign(new Error('durable round registration failed'), { code: created.code })
          );
          return;
        }
        this._pending.durable = created.record;
      }
    });
  }

  // UI tarafı: o an bekleyen soru seti (yoksa null) — yan etkisiz.
  // ponytail: senkron kalmalı; null-atama ile yaris yok (Node tek-thread).
  getCurrent() {
    return this._pending ? this._pending.questions : null;
  }

  // UI tarafı: o an bekleyen { id, questions } (yoksa null).
  // ponytail: senkron kalmalı; id+questions tek ifadede okunur.
  peek(requestId) {
    if (!this._pending || (requestId !== undefined && this._pending.requestId !== requestId)) {
      return null;
    }
    return {
      id: this._pending.id,
      questions: this._pending.questions,
      capability: this._pending.record.capability,
      roundId: this._pending.durable?.roundId,
      revision: this._pending.durable?.revision,
      draftAnswers: this._pending.durable?.draftAnswers || null,
      lifecycle: snapshot(this._pending.record),
    };
  }

  getSnapshot() {
    return snapshot(this._pending?.record) || this._lastSnapshot;
  }

  _transition(p, event, options) {
    if (p.durable) {
      const persisted = this._store.mutate(p.durable.roundId, (record, now) =>
        Record.transition(record, event, record.revision, now, {
          deadlineOwner: options?.deadlineOwner,
          terminalReason: options?.reason,
        })
      );
      if (!persisted.ok) return false;
      p.durable = persisted.record;
    }
    const result = transition(p.record, event, { now: this._now(), ...options });
    if (result.ok) p.record = result.record;
    return result.ok;
  }

  _owns(p, expectedId, capability) {
    return (
      !!p &&
      (expectedId == null || p.id === expectedId) &&
      (capability == null || p.record.capability === capability)
    );
  }

  // UI tarafı: cevapları ver, bekleyen submitQuestions promise'ini resolve et.
  // Contract R: id eslesmezse false döner (resolve etmez); aksi resolve+true.
  provideAnswers(id, answers, capability) {
    if (!this._owns(this._pending, id, capability)) return false;
    const p = this._pending;
    if (p.durable) {
      const persisted = this._store.mutate(p.durable.roundId, (record, now) =>
        Record.finalize(record, answers, record.revision, now)
      );
      if (!persisted.ok) return false;
      p.durable = persisted.record;
    }
    if (!this._transition(p, 'answerAccepted')) return false;
    this._pending = null;
    if (p.detachTimer) this._clearTimer(p.detachTimer);
    p.lifecycle?.event('answer_received', { boundary: 'browser', deadlineOwner: 'browser' });
    this._rememberDelivery(p, answers);
    this._lastSnapshot = snapshot(p.record);
    p.resolve(answers);
    for (const waiter of p.waiters) waiter.resolve(answers);
    return true;
  }

  saveDraft(id, answers, capability, expectedRevision) {
    if (!this._owns(this._pending, id, capability) || !this._pending.durable)
      return { ok: false, code: 'ownership_conflict' };
    const p = this._pending;
    const persisted = this._store.mutate(p.durable.roundId, (record, now) =>
      Record.saveDraft(record, answers, expectedRevision, now)
    );
    if (!persisted.ok) return persisted;
    p.durable = persisted.record;
    return { ok: true, record: persisted.record, replayed: !!persisted.replayed };
  }

  // Host soketi koptuğunda requestId'li turü koru. Host daha sonra yeni MCP
  // sürecinde /resume çağırarak aynı browser turunun cevabını alabilir.
  detach(reason, expectedId, capability) {
    if (!this._owns(this._pending, expectedId, capability)) {
      return false;
    }
    const p = this._pending;
    if (p.detached) return false;
    if (!this._transition(p, 'detach', { reason: terminalReason(reason), deadlineOwner: 'host' }))
      return false;
    p.detached = true;
    p.lifecycle?.event('host_detached', { boundary: 'bridge', deadlineOwner: 'host' });
    p.detachTimer = this._setTimer(() => {
      if (this._pending === p && p.detached) this.expire(p.id, p.record.capability);
    }, this._detachedTtlMs);
    p.detachTimer.unref?.();
    return true;
  }

  // A resumed HTTP request must be cancellable independently of the browser
  // round. The returned cancel function only removes that caller's waiter.
  waitForAnswers(selector) {
    const selected = this._selector(selector);
    if (!selected) {
      const error = Object.assign(new Error('an explicit roundId or requestId is required'), {
        code: 'invalid_selector',
      });
      return { promise: Promise.reject(error), cancel() {} };
    }
    const recovered = this._recover(selected);
    if (!recovered.ok && recovered.code !== 'not_found') {
      const error = Object.assign(new Error('round recovery unavailable'), {
        code: recovered.code,
      });
      return { promise: Promise.reject(error), cancel() {} };
    }
    const p = this._findDetached(selected);
    if (p) {
      this._transition(p, 'resume', { deadlineOwner: 'host' });
      p.lifecycle?.event('round_resumed', { boundary: 'bridge', deadlineOwner: 'host' });
      let waiter;
      const promise = new Promise((resolve, reject) => {
        waiter = { resolve, reject };
        p.waiters.push(waiter);
      });
      return {
        promise,
        roundId: p.durable?.roundId || p.id,
        cancel: () => {
          const index = p.waiters.indexOf(waiter);
          if (index >= 0) p.waiters.splice(index, 1);
        },
      };
    }

    const completed =
      this._findCompleted(selected) ||
      (recovered.ok && recovered.record.answers
        ? { answers: recovered.record.answers, roundId: recovered.record.roundId }
        : null);
    if (!completed) {
      const error = new Error('no resumable question set');
      error.code = 'stale_round';
      return { promise: Promise.reject(error), cancel() {} };
    }
    return { promise: Promise.resolve(completed.answers), roundId: completed.roundId, cancel() {} };
  }

  _findDetached(selector) {
    if (
      this._pending?.detached &&
      (!selector.roundId || this._pending.durable?.roundId === selector.roundId) &&
      (!selector.requestId || this._pending.requestId === selector.requestId)
    ) {
      return this._pending;
    }
    return null;
  }

  _rememberCompleted(p, answers) {
    if (!p.detached || p.requestId == null) return;
    this._forgetCompleted(p.requestId);
    this._completed.set(p.requestId, {
      answers,
      roundId: p.id,
      durableRoundId: p.durable?.roundId || null,
      expiresAt: this._now() + this._detachedTtlMs,
    });
    const timer = this._setTimer(() => {
      const item = this._completed.get(p.requestId);
      if (item && item.roundId === p.id) {
        this._completed.delete(p.requestId);
        this._deliveries.delete(p.id);
      }
      if (this._completedTimers.get(p.requestId) === timer)
        this._completedTimers.delete(p.requestId);
    }, this._detachedTtlMs);
    this._completedTimers.set(p.requestId, timer);
    timer.unref?.();
  }

  _forgetCompleted(requestId) {
    const timer = this._completedTimers.get(requestId);
    if (timer !== undefined) this._clearTimer(timer);
    this._completedTimers.delete(requestId);
    this._completed.delete(requestId);
  }

  _rememberDelivery(p, answers) {
    this._deliveries.set(p.id, { p, answers });
    this._rememberCompleted(p, answers);
  }

  // The browser accepting answers and a host receiving them are distinct events.
  // Retain request-id results until a response has finished so a closed host stream
  // can be recovered by /resume instead of being reported as a false delivery.
  confirmDelivery(roundId) {
    if (this._store && typeof roundId === 'string') {
      const confirmed = this._store.mutate(roundId, (record, now) =>
        Record.acknowledge(record, now)
      );
      const delivery = [...this._deliveries.values()].find(
        (item) => item.p.durable?.roundId === roundId
      );
      if (confirmed.ok && delivery) {
        const transitioned = transition(delivery.p.record, 'delivered', {
          now: this._now(),
          reason: 'completed',
          deadlineOwner: 'none',
        });
        if (transitioned.ok) delivery.p.record = transitioned.record;
        delivery.p.lifecycle?.finish('completed', { boundary: 'bridge', deadlineOwner: 'none' });
        this._lastSnapshot = snapshot(delivery.p.record);
        this._deliveries.delete(delivery.p.id);
        if (delivery.p.requestId != null) this._forgetCompleted(delivery.p.requestId);
      }
      return confirmed.ok;
    }
    const delivery = this._deliveries.get(roundId);
    if (
      !delivery ||
      !this._transition(delivery.p, 'delivered', { reason: 'completed', deadlineOwner: 'none' })
    )
      return false;
    delivery.p.lifecycle?.finish('completed', { boundary: 'bridge', deadlineOwner: 'none' });
    this._lastSnapshot = snapshot(delivery.p.record);
    this._deliveries.delete(roundId);
    if (delivery.p.requestId != null) this._forgetCompleted(delivery.p.requestId);
    return true;
  }

  markDeliveryUncertain(roundId) {
    if (this._store && typeof roundId === 'string') {
      const uncertain = this._store.mutate(roundId, (record, now) =>
        Record.transition(record, 'uncertain', record.revision, now, { deadlineOwner: 'host' })
      );
      const delivery = [...this._deliveries.values()].find(
        (item) => item.p.durable?.roundId === roundId
      );
      if (uncertain.ok && delivery) {
        const transitioned = transition(delivery.p.record, 'uncertain', {
          now: this._now(),
          deadlineOwner: 'host',
        });
        if (transitioned.ok) delivery.p.record = transitioned.record;
        delivery.p.lifecycle?.event('delivery_uncertain', {
          boundary: 'bridge',
          deadlineOwner: 'host',
        });
        this._lastSnapshot = snapshot(delivery.p.record);
      }
      return uncertain.ok;
    }
    const delivery = this._deliveries.get(roundId);
    if (!delivery || !this._transition(delivery.p, 'uncertain', { deadlineOwner: 'host' }))
      return false;
    delivery.p.lifecycle?.event('delivery_uncertain', {
      boundary: 'bridge',
      deadlineOwner: 'host',
    });
    this._lastSnapshot = snapshot(delivery.p.record);
    return true;
  }

  _findCompleted(selector) {
    const now = this._now();
    for (const [key, item] of this._completed) {
      if (item.expiresAt <= now) this._forgetCompleted(key);
    }
    if (!selector.requestId) return null;
    const item = this._completed.get(selector.requestId) || null;
    if (item && selector.roundId && item.roundId !== selector.roundId) return null;
    return item;
  }

  listRecoverable() {
    if (!this._store) return [];
    const now = this._now();
    // D-05/D-06/D-08/D-10: the bridge owns the chooser policy and only returns
    // exact, redacted metadata for states that still need a user decision.
    return this._store
      .list()
      .filter((record) => record.expiresAt > now && RECOVERABLE_STATES.includes(record.state));
  }

  deleteRecoverable(roundId) {
    if (!this._store) return { ok: false, code: 'not_found' };
    if (typeof roundId !== 'string' || !ROUND_ID_RE.test(roundId)) {
      return { ok: false, code: 'invalid_selector' };
    }
    const found = this._store.get(roundId);
    if (!found.ok) return found;
    if (found.record.expiresAt <= this._now()) return { ok: false, code: 'expired' };
    if (!RECOVERABLE_STATES.includes(found.record.lifecycle.state)) {
      return { ok: false, code: 'stale_round' };
    }

    const removed = this._store.remove(roundId);
    if (!removed.ok) return removed;

    const ownerIds = new Set();
    let removedCurrent = false;
    const pending = this._pending;
    if (pending?.durable?.roundId === roundId) {
      removedCurrent = true;
      ownerIds.add(pending.id);
      if (pending.detachTimer) this._clearTimer(pending.detachTimer);
      pending.detachTimer = null;
      const error = Object.assign(new Error('saved round deleted'), {
        code: 'round_deleted',
        roundId: pending.id,
      });
      pending.reject(error);
      for (const waiter of pending.waiters) {
        waiter.reject(Object.assign(new Error(error.message), error));
      }
      pending.waiters.length = 0;
      this._pending = null;
    }

    for (const [id, delivery] of this._deliveries) {
      if (delivery.p.durable?.roundId !== roundId) continue;
      ownerIds.add(delivery.p.id);
      this._deliveries.delete(id);
    }

    for (const [requestId, completed] of this._completed) {
      if (completed.durableRoundId !== roundId) continue;
      ownerIds.add(completed.roundId);
      this._forgetCompleted(requestId);
    }

    // D-03/D-04: deleting the exact current owner must not leave a stale
    // lifecycle snapshot that can be replayed to /current or SSE clients.
    if (removedCurrent || (this._lastSnapshot && ownerIds.has(this._lastSnapshot.id))) {
      this._lastSnapshot = null;
    }
    return { ok: true };
  }

  durableRoundId(id) {
    return this._deliveries.get(id)?.p.durable?.roundId || null;
  }

  getDurable(roundId) {
    if (!this._store) return { ok: false, code: 'not_found' };
    const found = this._store.get(roundId);
    if (!found.ok) return found;
    if (found.record.expiresAt <= this._now()) return { ok: false, code: 'expired' };
    return found;
  }

  getResult(roundId, capability) {
    const found = this.getDurable(roundId);
    if (!found.ok) return found;
    if (found.record.capability !== capability) return { ok: false, code: 'ownership_conflict' };
    if (!found.record.answers) return { ok: false, code: 'result_not_ready' };
    return { ok: true, result: found.record.answers, record: found.record };
  }

  // Timeout/iptal. Contract R: expectedId verilmis ve eslesmiyorsa hicbir sey yapma.
  cancel(reason, expectedId, capability) {
    if (!this._owns(this._pending, expectedId, capability)) return false;
    const p = this._pending;
    if (!this._transition(p, 'cancel', { reason: terminalReason(reason), deadlineOwner: 'host' }))
      return false;
    this._pending = null;
    if (p.detachTimer) this._clearTimer(p.detachTimer);
    const outcome = terminalReason(reason);
    const details = terminalLifecycleDetails(outcome);
    p.lifecycle?.event('bridge_cancelled', details);
    p.lifecycle?.finish(outcome, details);
    this._lastSnapshot = snapshot(p.record);
    const error = new Error(reason || 'cancelled');
    error.code = outcome;
    error.roundId = p.id;
    p.reject(error);
    for (const waiter of p.waiters) {
      waiter.reject(Object.assign(new Error(error.message), { code: outcome, roundId: p.id }));
    }
    return true;
  }

  expire(expectedId, capability) {
    if (!this._owns(this._pending, expectedId, capability)) return false;
    const p = this._pending;
    if (
      !this._transition(p, 'expire', {
        reason: 'application_timeout',
        deadlineOwner: 'application',
      })
    )
      return false;
    this._pending = null;
    const details = { boundary: 'bridge', deadlineOwner: 'application' };
    p.lifecycle?.event('round_timeout', details);
    p.lifecycle?.finish('application_timeout', details);
    this._lastSnapshot = snapshot(p.record);
    const error = Object.assign(new Error('detached round expired'), {
      code: 'application_timeout',
      roundId: p.id,
    });
    p.reject(error);
    for (const waiter of p.waiters) waiter.reject(error);
    return true;
  }
}

module.exports = { Bridge, DEFAULT_DETACHED_TTL_MS, terminalReason };
