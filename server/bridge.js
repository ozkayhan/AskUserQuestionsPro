'use strict';

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

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
// Her tur monoton artan bir `id` taşır (UI'ın tur başına remount kararı için).
// Cevap/iptal yolları bu id ile sahiplenir: gec gelen bir tur, o sirada bekleyen
// baska bir turu sessizce çözemez/iptal edemez (cross-round race koruması — Contract R).
class Bridge {
  constructor({ detachedTtlMs = DEFAULT_DETACHED_TTL_MS, now = Date.now } = {}) {
    this._pending = null; // { id, questions, resolve, reject, waiters, detached }
    this._seq = 0;
    this._now = now;
    this._detachedTtlMs = Number.isFinite(detachedTtlMs)
      ? Math.max(1, detachedTtlMs)
      : DEFAULT_DETACHED_TTL_MS;
    this._completed = new Map();
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
      };
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
    return { id: this._pending.id, questions: this._pending.questions };
  }

  // UI tarafı: cevapları ver, bekleyen submitQuestions promise'ini resolve et.
  // Contract R: id eslesmezse false döner (resolve etmez); aksi resolve+true.
  provideAnswers(id, answers) {
    if (!this._pending || this._pending.id !== id) return false;
    const p = this._pending;
    this._pending = null;
    if (p.detachTimer) clearTimeout(p.detachTimer);
    p.lifecycle?.event('answer_received');
    p.lifecycle?.finish('completed');
    this._rememberCompleted(p, answers);
    p.resolve(answers);
    for (const waiter of p.waiters) waiter.resolve(answers);
    return true;
  }

  // Host soketi koptuğunda requestId'li turü koru. Host daha sonra yeni MCP
  // sürecinde /resume çağırarak aynı browser turunun cevabını alabilir.
  detach(reason, expectedId) {
    if (!this._pending || (expectedId != null && this._pending.id !== expectedId)) {
      return false;
    }
    const p = this._pending;
    if (p.detached) return false;
    p.detached = true;
    p.lifecycle?.event('host_detached');
    p.detachTimer = setTimeout(() => {
      if (this._pending === p && p.detached) this.cancel('detached round expired', p.id);
    }, this._detachedTtlMs);
    p.detachTimer.unref?.();
    return true;
  }

  // A resumed HTTP request must be cancellable independently of the browser
  // round. The returned cancel function only removes that caller's waiter.
  waitForAnswers(requestId) {
    const p = this._findDetached(requestId);
    if (p) {
      p.lifecycle?.event('round_resumed');
      let waiter;
      const promise = new Promise((resolve, reject) => {
        waiter = { resolve, reject };
        p.waiters.push(waiter);
      });
      return {
        promise,
        cancel: () => {
          const index = p.waiters.indexOf(waiter);
          if (index >= 0) p.waiters.splice(index, 1);
        },
      };
    }

    const completed = this._findCompleted(requestId);
    if (!completed) {
      const error = new Error('no resumable question set');
      error.code = 'stale_round';
      return { promise: Promise.reject(error), cancel() {} };
    }
    return { promise: Promise.resolve(completed.answers), cancel() {} };
  }

  _findDetached(requestId) {
    if (this._pending?.detached && (requestId == null || this._pending.requestId === requestId)) {
      return this._pending;
    }
    return null;
  }

  _rememberCompleted(p, answers) {
    if (!p.detached || p.requestId == null) return;
    this._completed.set(p.requestId, {
      answers,
      roundId: p.id,
      expiresAt: this._now() + this._detachedTtlMs,
    });
    const timer = setTimeout(() => {
      const item = this._completed.get(p.requestId);
      if (item && item.roundId === p.id) this._completed.delete(p.requestId);
    }, this._detachedTtlMs);
    timer.unref?.();
  }

  _findCompleted(requestId) {
    const now = this._now();
    for (const [key, item] of this._completed) {
      if (item.expiresAt <= now) this._completed.delete(key);
    }
    if (requestId != null) return this._completed.get(requestId) || null;
    let latest = null;
    for (const item of this._completed.values()) latest = item;
    return latest;
  }

  // Timeout/iptal. Contract R: expectedId verilmis ve eslesmiyorsa hicbir sey yapma.
  cancel(reason, expectedId) {
    if (!this._pending || (expectedId != null && this._pending.id !== expectedId)) return false;
    const p = this._pending;
    this._pending = null;
    if (p.detachTimer) clearTimeout(p.detachTimer);
    const outcome = terminalReason(reason);
    p.lifecycle?.event('bridge_cancelled');
    p.lifecycle?.finish(outcome);
    const error = new Error(reason || 'cancelled');
    error.code = outcome;
    error.roundId = p.id;
    p.reject(error);
    for (const waiter of p.waiters) {
      waiter.reject(Object.assign(new Error(error.message), { code: outcome, roundId: p.id }));
    }
    return true;
  }
}

module.exports = { Bridge, DEFAULT_DETACHED_TTL_MS, terminalReason };
