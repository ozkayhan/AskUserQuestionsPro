/* global React */
/* askuseroz · live — köprüyle I/O: bekleyen soruları SSE ile al, cevabı POST et */
// ponytail: React tarayıcıda global; node:test postAnswers'ı izole çağırabilsin diye guard.
const _React = typeof React !== 'undefined' ? React : {};
const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = _React;

// Yeniden bağlanma backoff'u: 1s tabanlı, 30s tavanlı üstel + jitter (thundering herd'i kır).
const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30000;
function reconnectDelay(attempt) {
  const exp = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** attempt);
  // ponytail: tek satır full-jitter — [0, exp) aralığı thundering herd'i dağıtmaya yeter.
  return Math.random() * exp;
}

// SSE ile bekleyen turu canlı al: { id, questions } (questions null = bekliyor).
function useLiveQuestions() {
  const [round, setRound] = useStateLive({
    id: null,
    roundId: null,
    questions: null,
    capability: null,
    lifecycle: null,
    revision: null,
    draftAnswers: null,
  });
  const timerRef = useRefLive(null);
  useEffectLive(() => {
    let es;
    let closed = false;
    let attempt = 0;
    let generation = 0;
    const connect = () => {
      const currentGeneration = ++generation;
      const source = new EventSource('/events');
      es = source;
      source.onopen = () => {
        if (closed || currentGeneration !== generation) return;
        attempt = 0; // başarılı bağlantı backoff'u sıfırlar.
      };
      source.onmessage = (e) => {
        if (closed || currentGeneration !== generation) return;
        let d;
        try {
          d = JSON.parse(e.data);
        } catch (err) {
          // ': ping' yorumları onmessage'a düşmez; geçersiz payload'ı izlenebilir biçimde yut.
          console.warn('[live] SSE parse edilemedi:', err.message);
          return;
        }
        const next = {
          id: d.id ?? null,
          roundId: d.roundId ?? null,
          questions: d.questions ?? null,
          capability: d.capability ?? null,
          lifecycle: d.lifecycle ?? null,
          revision: d.revision ?? null,
          draftAnswers: d.draftAnswers ?? null,
        };
        // Round id state boundary'sidir: reconnect aynı round'u yeniden yayınlasa da
        // Flow içindeki cevaplar korunur; yeni id React key ile temiz remount eder.
        setRound((prev) => (prev.id === next.id ? { ...prev, ...next } : next));
      };
      source.onerror = () => {
        if (closed || currentGeneration !== generation) return;
        source.close();
        // Orphan timer'ları önle: yeni timer kurmadan önce öncekini iptal et.
        clearTimeout(timerRef.current);
        const delay = reconnectDelay(attempt++);
        timerRef.current = setTimeout(() => {
          if (!closed && currentGeneration === generation) connect();
        }, delay);
      };
    };
    connect();
    return () => {
      closed = true;
      generation += 1;
      clearTimeout(timerRef.current);
      if (es) es.close();
    };
  }, []);
  return round;
}

async function responseError(path, response) {
  const body = await response.json().catch(() => ({}));
  const detail = body && typeof body.error === 'string' ? `: ${body.error}` : '';
  const reason = body && typeof body.reason === 'string' ? ` [${body.reason}]` : '';
  const err = new Error(`${path} ${response.status}${reason}${detail}`);
  err.server = true;
  err.status = response.status;
  err.reason = body?.reason;
  err.roundId = body?.roundId;
  return err;
}

// Eşlenmiş cevapları köprüye gönder; başarısızlıkta THROW eder (UI kurtarsın).
// Ağ hatası (TypeError/abort) ile sunucu hatası (HTTP !ok) çağıran tarafça ayrılabilsin
// diye HTTP hatasında err.server=true işaretlenir. 10s timeout sonsuz askıyı keser.
async function postAnswers(id, answers, capability) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answers, capability }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      // HTTP 4xx/5xx → kurtarılamaz; server reason'ı UI'nin stale/network ayrımını
      // doğru yapabilmesi için korunur.
      throw await responseError('/answer', r);
    }
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function postDraft(id, answers, capability, revision) {
  const body = JSON.stringify({ id, answers, capability, revision });
  // Fetch keepalive lets a small in-flight draft survive page teardown in
  // supporting browsers. Larger payloads retain the local replay mirror,
  // because browsers commonly reject keepalive bodies above their quota.
  const keepalive = body.length <= 60 * 1024;
  const r = await fetch('/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive,
  });
  if (!r.ok) throw await responseError('/draft', r);
  return r.json();
}

class RecoveryError extends Error {
  constructor(message, { code = 'recovery_error', status, preserveDraft = true, cause } = {}) {
    super(message, { cause });
    this.name = 'RecoveryError';
    this.code = code;
    this.status = status;
    this.preserveDraft = preserveDraft;
  }
}

async function getRecoverableRounds() {
  let response;
  try {
    response = await fetch('/rounds');
  } catch (error) {
    throw new RecoveryError('Recoverable rounds are unavailable. Your current work remains active.', {
      code: 'origin_or_network',
      cause: error,
    });
  }
  if (!response.ok) throw new RecoveryError('Recoverable rounds could not be loaded.', { status: response.status });
  const body = await response.json().catch((cause) => {
    throw new RecoveryError('Recoverable rounds returned invalid data.', { code: 'invalid_response', cause });
  });
  if (!Array.isArray(body.rounds)) throw new RecoveryError('Recoverable rounds are unavailable.', { code: 'invalid_response' });
  return body.rounds;
}

async function selectRecoveryRound(selector) {
  if (!selector || (selector.roundId == null && !selector.requestId)) {
    throw new RecoveryError('Choose an exact recoverable round before continuing.', { code: 'selection_required' });
  }
  const query = selector.roundId != null ? `/resume/${encodeURIComponent(selector.roundId)}` : '/resume';
  try {
    const response = await fetch(query, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selector),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new RecoveryError('This round could not be recovered safely. Your current work was not replaced.', {
        code: body.reason || 'selection_failed', status: response.status,
      });
    }
    return body;
  } catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw new RecoveryError('Recovery failed. Retry or choose another round.', { code: 'origin_or_network', cause: error });
  }
}

async function acknowledgeDelivery(id, capability) {
  const response = await fetch(`/rounds/${encodeURIComponent(id)}/ack`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capability }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new RecoveryError('Delivery status is uncertain. Your answer is preserved.', {
      code: body.reason || 'ack_uncertain', status: response.status,
    });
    error.server = true;
    throw error;
  }
  return { ...body, state: 'delivered', acknowledged: true };
}

function attemptClose(close = typeof window !== 'undefined' ? window.close.bind(window) : null) {
  if (typeof close !== 'function') return { closed: false, denied: true };
  try {
    close();
    return { closed: true, denied: false };
  } catch {
    return { closed: false, denied: true };
  }
}

function deliveryTransition(state, event) {
  const table = {
    drafting: { submit: 'delivery-pending', cancel: 'cancelled' },
    'delivery-pending': { acknowledged: 'delivered', timeout: 'delivery-uncertain', network_error: 'delivery-uncertain', cancelled: 'cancelled' },
    'delivery-uncertain': { acknowledged: 'delivered', retry: 'delivery-pending', recovered: 'delivery-uncertain' },
    delivered: {},
    cancelled: {},
    'recovery-error': { retry: 'drafting', choose: 'drafting' },
  };
  return table[state]?.[event] || state;
}

async function cancelRound(id, reason = 'user cancelled', capability) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason, capability }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw await responseError('/cancel', r);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

// node:test için CommonJS dışa aktarımı (tarayıcıda global olarak yüklenir).
if (typeof module === 'object' && module.exports) {
  module.exports = { postAnswers, postDraft, cancelRound, reconnectDelay, RecoveryError, getRecoverableRounds, selectRecoveryRound, acknowledgeDelivery, attemptClose, deliveryTransition };
}
if (typeof window !== 'undefined') {
  window.RecoveryError = RecoveryError;
  window.getRecoverableRounds = getRecoverableRounds;
  window.selectRecoveryRound = selectRecoveryRound;
  window.acknowledgeDelivery = acknowledgeDelivery;
  window.attemptClose = attemptClose;
  window.deliveryTransition = deliveryTransition;
}
