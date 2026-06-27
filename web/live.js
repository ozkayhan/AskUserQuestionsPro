/* global React */
/* askuseroz · live — köprüyle I/O: bekleyen soruları SSE ile al, cevabı POST et */
const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = React;

// SSE ile bekleyen turu canlı al: { id, questions } (questions null = bekliyor).
function useLiveQuestions() {
  const [round, setRound] = useStateLive({ id: null, questions: null });
  const timerRef = useRefLive(null);
  useEffectLive(() => {
    let es;
    let closed = false;
    const connect = () => {
      es = new EventSource('/events');
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          setRound({ id: d.id ?? null, questions: d.questions ?? null });
        } catch {
          /* ': ping' yorumları onmessage'a düşmez; yine de yut */
        }
      };
      es.onerror = () => {
        es.close();
        if (!closed) timerRef.current = setTimeout(connect, 1000);
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
async function postAnswers(answers) {
  const r = await fetch('/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) throw new Error(`/answer ${r.status}`);
  return r.json();
}
