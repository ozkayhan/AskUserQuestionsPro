'use strict';
// web/live.js regresyon testleri: Contract R body şekli, ağ/sunucu hata ayrımı,
// timeout abort ve yeniden bağlanma backoff'u (jitter + tavan).
const test = require('node:test');
const assert = require('node:assert');
const { postAnswers, cancelRound, reconnectDelay } = require('../web/live.js');

// fetch'i mock'la, t.after ile geri yükle (DOM/global kirliliği bırakma — Contract T ruhu).
function withFetch(t, impl) {
  const prev = global.fetch;
  global.fetch = impl;
  t.after(() => {
    global.fetch = prev;
  });
}

test('postAnswers Contract R: body {id,answers} gönderir ve JSON döner', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), hasSignal: !!opts.signal };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  const res = await postAnswers('round-7', { Q: 'A' });
  assert.strictEqual(seen.url, '/answer');
  assert.deepStrictEqual(seen.body, { id: 'round-7', answers: { Q: 'A' } });
  assert.strictEqual(seen.hasSignal, true); // AbortController bağlı
  assert.deepStrictEqual(res, { ok: true });
});

test('postAnswers HTTP !ok → err.server=true (sunucu hatası, kurtarılamaz)', async (t) => {
  withFetch(t, async () => ({ ok: false, status: 500, json: async () => ({}) }));
  await assert.rejects(
    () => postAnswers('id', {}),
    (err) => err.server === true && /500/.test(err.message)
  );
});

test('postAnswers HTTP reason/roundId alanlarını kaybetmez', async (t) => {
  withFetch(t, async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: 'no matching pending question set',
      reason: 'stale_round',
      roundId: 8,
    }),
  }));
  await assert.rejects(
    () => postAnswers(8, { Q: 'A' }),
    (err) =>
      err.server === true &&
      err.status === 409 &&
      err.reason === 'stale_round' &&
      err.roundId === 8 &&
      /stale_round/.test(err.message)
  );
});

test('cancelRound Contract: id ve reason body gönderir, typed error taşır', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true, reason: 'user_cancelled' }) };
  });
  assert.deepStrictEqual(await cancelRound(8, 'user cancelled'), {
    ok: true,
    reason: 'user_cancelled',
  });
  assert.strictEqual(seen.url, '/cancel');
  assert.deepStrictEqual(seen.body, { id: 8, reason: 'user cancelled' });
});

test('postAnswers ağ hatası → err.server yok (kurtarılabilir, retry edilebilir)', async (t) => {
  withFetch(t, async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    () => postAnswers('id', {}),
    (err) => err instanceof TypeError && !err.server
  );
});

test('postAnswers 10s timeout: hung fetch abort sinyaliyle reddedilir', async (t) => {
  withFetch(
    t,
    (url, opts) =>
      new Promise((_resolve, reject) => {
        // Asla resolve etme; sadece abort sinyalini dinle (gerçek askıda kalan ağı taklit).
        opts.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      })
  );
  // Sahte zamanlayıcı ile 10s'i ilerlet — gerçek bekleme yok.
  if (Number(process.versions.node.split('.')[0]) >= 20) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
  } else {
    t.mock.timers.enable(['setTimeout']);
  }
  const p = postAnswers('id', {});
  t.mock.timers.tick(10000);
  await assert.rejects(p, (err) => err.name === 'AbortError');
});

test('reconnectDelay: full-jitter [0, exp) ve 30s tavanı aşmaz', () => {
  for (let i = 0; i < 50; i++) {
    assert.ok(reconnectDelay(0) < 1000, 'attempt 0 < 1s');
    assert.ok(reconnectDelay(3) < 8000, 'attempt 3 < 8s');
    const big = reconnectDelay(20);
    assert.ok(big >= 0 && big < 30000, 'tavan 30s, negatif değil');
  }
});
