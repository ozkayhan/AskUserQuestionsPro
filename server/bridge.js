'use strict';

const CANCEL_REASON_MAP = new Map([
  ['client disconnected', 'host_disconnect'],
  ['host disconnected', 'host_disconnect'],
  ['host cancelled', 'host_cancelled'],
  ['browser disconnected', 'browser_disconnect'],
  ['user cancelled', 'user_cancelled'],
  ['timeout', 'application_timeout'],
  ['application timeout', 'application_timeout'],
]);

function terminalReason(reason) {
  return CANCEL_REASON_MAP.get(String(reason || '').toLowerCase()) || 'bridge_error';
}

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
// Her tur monoton artan bir `id` taşır (UI'ın tur başına remount kararı için).
// Cevap/iptal yolları bu id ile sahiplenir: gec gelen bir tur, o sirada bekleyen
// baska bir turu sessizce çözemez/iptal edemez (cross-round race koruması — Contract R).
class Bridge {
  constructor() {
    this._pending = null; // { id, questions, resolve, reject }
    this._seq = 0;
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
      this._pending = { id, questions, requestId, lifecycle, resolve, reject };
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
    p.lifecycle?.event('answer_received');
    p.lifecycle?.finish('completed');
    p.resolve(answers);
    return true;
  }

  // Timeout/iptal. Contract R: expectedId verilmis ve eslesmiyorsa hicbir sey yapma.
  cancel(reason, expectedId) {
    if (!this._pending || (expectedId != null && this._pending.id !== expectedId)) return false;
    const p = this._pending;
    this._pending = null;
    const outcome = terminalReason(reason);
    p.lifecycle?.event('bridge_cancelled');
    p.lifecycle?.finish(outcome);
    const error = new Error(reason || 'cancelled');
    error.code = outcome;
    error.roundId = p.id;
    p.reject(error);
    return true;
  }
}

module.exports = { Bridge, terminalReason };
