'use strict';

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
  // ponytail: senkron kalmalı; null-atama ile yaris yok (Node tek-thread).
  getCurrent() {
    return this._pending ? this._pending.questions : null;
  }

  // UI tarafı: o an bekleyen { id, questions } (yoksa null).
  // ponytail: senkron kalmalı; id+questions tek ifadede okunur.
  peek() {
    return this._pending ? { id: this._pending.id, questions: this._pending.questions } : null;
  }

  // UI tarafı: cevapları ver, bekleyen submitQuestions promise'ini resolve et.
  // Contract R: id eslesmezse false döner (resolve etmez); aksi resolve+true.
  provideAnswers(id, answers) {
    if (!this._pending || this._pending.id !== id) return false;
    const p = this._pending;
    this._pending = null;
    p.resolve(answers);
    return true;
  }

  // Timeout/iptal. Contract R: expectedId verilmis ve eslesmiyorsa hicbir sey yapma.
  cancel(reason, expectedId) {
    if (!this._pending || (expectedId != null && this._pending.id !== expectedId)) return false;
    const p = this._pending;
    this._pending = null;
    p.reject(new Error(reason || 'cancelled'));
    return true;
  }
}

module.exports = { Bridge };
