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
  const [round, setRound] = useStateLive({ id: null, questions: null });
  const timerRef = useRefLive(null);
  useEffectLive(() => {
    let es;
    let closed = false;
    let attempt = 0;
    const connect = () => {
      es = new EventSource('/events');
      es.onopen = () => {
        attempt = 0; // başarılı bağlantı backoff'u sıfırlar.
      };
      es.onmessage = (e) => {
        let d;
        try {
          d = JSON.parse(e.data);
        } catch (err) {
          // ': ping' yorumları onmessage'a düşmez; geçersiz payload'ı izlenebilir biçimde yut.
          console.warn('[live] SSE parse edilemedi:', err.message, e.data);
          return;
        }
        const next = { id: d.id ?? null, questions: d.questions ?? null };
        // Eşitlik guard'ı: aynı tur tekrar yayınlanırsa (heartbeat) boş re-render planlama.
        setRound((prev) =>
          prev.id === next.id && prev.questions === next.questions ? prev : next
        );
      };
      es.onerror = () => {
        es.close();
        if (closed) return;
        // Orphan timer'ları önle: yeni timer kurmadan önce öncekini iptal et.
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(connect, reconnectDelay(attempt++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timerRef.current);
      if (es) es.close();
    };
  }, []);
  return round;
}

// Eşlenmiş cevapları köprüye gönder; başarısızlıkta THROW eder (UI kurtarsın).
// Ağ hatası (TypeError/abort) ile sunucu hatası (HTTP !ok) çağıran tarafça ayrılabilsin
// diye HTTP hatasında err.server=true işaretlenir. 10s timeout sonsuz askıyı keser.
async function postAnswers(id, answers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answers }), // Contract R: body {id,answers}
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const err = new Error(`/answer ${r.status}`);
      err.server = true; // HTTP 4xx/5xx → kurtarılamaz, sonsuz retry'a girme.
      throw err;
    }
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

// node:test için CommonJS dışa aktarımı (tarayıcıda global olarak yüklenir).
if (typeof module === 'object' && module.exports) {
  module.exports = { postAnswers, reconnectDelay };
}
