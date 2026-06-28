'use strict';

// withClean(t, fn) — Contract T.
// AnswerMap.ENABLED (binary/scale/ranking/tree) ve ilgili process.env
// anahtarlarını snapshot alır, fn'i çalıştırır, t.after içinde — fn throw etse
// bile — kanonik state'e geri yükler. Böylece modül-global ENABLED mutasyonu
// sonraki testlere sızmaz (setEnabled leak fix).
const AnswerMap = require('../../web/answer-map.js');

// snapshot/restore edilen env anahtarları (testlerin dokunabileceği alan).
const ENV_KEYS = ['ASKUSER_RICH_TYPES', 'ASKUSER_ENABLED'];

function snapshotEnabled() {
  // ENABLED'a doğrudan erişimimiz yok; qType üstünden kanonik 4 tipi türet.
  // qType(type=X) === X ise enabled, değilse degrade (kapalı).
  return {
    binary: AnswerMap.qType({ type: 'binary' }) === 'binary',
    scale: AnswerMap.qType({ type: 'scale' }) === 'scale',
    ranking: AnswerMap.qType({ type: 'ranking' }) === 'ranking',
    tree: AnswerMap.qType({ type: 'tree' }) === 'tree',
  };
}

function withClean(t, fn) {
  const enabled = snapshotEnabled();
  const env = {};
  ENV_KEYS.forEach(function (k) {
    env[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
  });

  t.after(function () {
    AnswerMap.setEnabled(enabled);
    ENV_KEYS.forEach(function (k) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    });
  });

  return fn();
}

module.exports = { withClean: withClean };
