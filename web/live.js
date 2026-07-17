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
  const [round, setRound] = useStateLive({ id: null, questions: null, capability: null, lifecycle: null });
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
        const next = { id: d.id ?? null, questions: d.questions ?? null, capability: d.capability ?? null, lifecycle: d.lifecycle ?? null };
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
  module.exports = { postAnswers, cancelRound, reconnectDelay };
}
