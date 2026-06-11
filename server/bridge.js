'use strict';

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
// Her tur monoton artan bir `id` taşır (UI'ın tur başına remount kararı için).
class Bridge {
  constructor() {
    this._pending = null; // { id, questions, resolve, reject }
    this._seq = 0;
  }

  // Hook tarafı: soru setini kaydet, cevap promise'i al.
  submitQuestions(questions) {
    if (this._pending) {
      return Promise.reject(new Error('A question set is already pending'));
    }
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      this._pending = { id, questions, resolve, reject };
    });
  }

  // UI tarafı: o an bekleyen soru seti (yoksa null) — yan etkisiz.
  getCurrent() {
    return this._pending ? this._pending.questions : null;
  }

  // UI tarafı: o an bekleyen { id, questions } (yoksa null).
  peek() {
    return this._pending ? { id: this._pending.id, questions: this._pending.questions } : null;
  }

  // UI tarafı: cevapları ver, bekleyen submitQuestions promise'ini resolve et.
  provideAnswers(answers) {
    if (!this._pending) throw new Error('No pending question set');
    const p = this._pending;
    this._pending = null;
    p.resolve(answers);
    return true;
  }

  // Timeout/iptal.
  cancel(reason) {
    if (!this._pending) return false;
    const p = this._pending;
    this._pending = null;
    p.reject(new Error(reason || 'cancelled'));
    return true;
  }
}

module.exports = { Bridge };
