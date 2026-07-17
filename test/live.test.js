'use strict';
// web/live.js regresyon testleri: Contract R body şekli, ağ/sunucu hata ayrımı,
// timeout abort ve yeniden bağlanma backoff'u (jitter + tavan).
const test = require('node:test');
const assert = require('node:assert');
const { postAnswers, postDraft, cancelRound, reconnectDelay, deliveryTransition, attemptClose, getRecoverableRounds, acknowledgeDelivery } = require('../web/live.js');

// fetch'i mock'la, t.after ile geri yükle (DOM/global kirliliği bırakma — Contract T ruhu).
function withFetch(t, impl) {
  const prev = global.fetch;
  global.fetch = impl;
  t.after(() => {
    global.fetch = prev;
  });
}

test('postAnswers Contract R: body {id,answers,capability} gönderir ve JSON döner', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), hasSignal: !!opts.signal };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  const res = await postAnswers('round-7', { Q: 'A' }, 'cap-round-7');
  assert.strictEqual(seen.url, '/answer');
  assert.deepStrictEqual(seen.body, {
    id: 'round-7',
    answers: { Q: 'A' },
    capability: 'cap-round-7',
  });
  assert.strictEqual(seen.hasSignal, true); // AbortController bağlı
  assert.deepStrictEqual(res, { ok: true });
});

test('postDraft küçük payload için unload-safe keepalive kullanır', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, keepalive: opts.keepalive, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true, revision: 2 }) };
  });
  await postDraft(9, { Q: 'A' }, 'cap-9', 1);
  assert.equal(seen.url, '/draft');
  assert.equal(seen.keepalive, true);
  assert.deepEqual(seen.body, { id: 9, answers: { Q: 'A' }, capability: 'cap-9', revision: 1 });
});

test('postAnswers HTTP !ok → err.server=true (sunucu hatası, kurtarılamaz)', async (t) => {
  withFetch(t, async () => ({ ok: false, status: 500, json: async () => ({}) }));
  await assert.rejects(
    () => postAnswers('id', {}, 'cap'),
    (err) => err.server === true && /500/.test(err.message)
  );
});

test('postAnswers HTTP reason/roundId alanlarını kaybetmez', async (t) => {
  withFetch(t, async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: 'no matching pending question set',
      reason: 'ownership_conflict',
      roundId: 8,
    }),
  }));
  await assert.rejects(
    () => postAnswers(8, { Q: 'A' }, 'cap-8'),
    (err) =>
      err.server === true &&
      err.status === 409 &&
      err.reason === 'ownership_conflict' &&
      err.roundId === 8 &&
      /ownership_conflict/.test(err.message)
  );
});

test('cancelRound Contract: id, reason ve capability body gönderir, typed error taşır', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true, reason: 'user_cancelled' }) };
  });
  assert.deepStrictEqual(await cancelRound(8, 'user cancelled', 'cap-8'), {
    ok: true,
    reason: 'user_cancelled',
  });
  assert.strictEqual(seen.url, '/cancel');
  assert.deepStrictEqual(seen.body, { id: 8, reason: 'user cancelled', capability: 'cap-8' });
});

test('postAnswers ağ hatası → err.server yok (kurtarılabilir, retry edilebilir)', async (t) => {
  withFetch(t, async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    () => postAnswers('id', {}, 'cap'),
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
  const p = postAnswers('id', {}, 'cap');
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

test('recovery requires exact selection and never chooses latest implicitly', async (t) => {
  withFetch(t, async () => ({ ok: true, status: 200, json: async () => ({ rounds: [{ roundId: 'opaque-1', state: 'drafting' }] }) }));
  assert.deepEqual(await getRecoverableRounds(), [{ roundId: 'opaque-1', state: 'drafting' }]);
  assert.equal(deliveryTransition('delivery-pending', 'timeout'), 'delivery-uncertain');
  assert.equal(deliveryTransition('delivery-uncertain', 'retry'), 'delivery-pending');
});

test('uncertain delivery and denied close remain recoverable', () => {
  assert.deepEqual(attemptClose(() => { throw new Error('denied'); }), { closed: false, denied: true });
  assert.equal(deliveryTransition('delivery-uncertain', 'acknowledged'), 'delivered');
});

test('acknowledgeDelivery uses the durable round id and is replayable', async (t) => {
  let seen;
  withFetch(t, async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  await acknowledgeDelivery('round_opaque_42', 'capability');
  assert.equal(seen.url, '/rounds/round_opaque_42/ack');
  assert.deepEqual(seen.body, { capability: 'capability' });
});
