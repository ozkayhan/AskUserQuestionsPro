/* global React */
/* askuseroz · live — köprüyle I/O: bekleyen soruları SSE ile al, cevabı POST et */
const { useState: useStateLive, useEffect: useEffectLive } = React;

// SSE ile bekleyen soru setini canlı al (null = henüz soru yok / bekliyor).
function useLiveQuestions() {
  const [questions, setQuestions] = useStateLive(null);
  useEffectLive(() => {
    let es;
    const connect = () => {
      es = new EventSource("/events");
      es.onmessage = (e) => {
        try { setQuestions(JSON.parse(e.data).questions); } catch {}
      };
      es.onerror = () => { es.close(); setTimeout(connect, 1000); };
    };
    connect();
    return () => es && es.close();
  }, []);
  return questions;
}

// Eşlenmiş cevapları köprüye gönder (bekleyen /ask promise'ini resolve eder).
async function postAnswers(answers) {
  await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}
