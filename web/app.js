/* global React, ReactDOM, AnswerMap, useLiveQuestions, postAnswers, fullOptions,
   Check, Waiting, Sidebar, Hints, QuestionCard, CustomPopup, Summary */
/* askuseroz · app — durum makinesi: soru akışı, klavye, gönderim. Sunum web/views.js'te. */
const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const questions = useLiveQuestions();

  if (!questions || questions.length === 0) {
    return (
      <div className="app">
        <Waiting />
      </div>
    );
  }
  return <Flow questions={questions} key={questions.map((q) => q.question).join("|")} />;
}

function Flow({ questions }) {
  const QUESTIONS = questions;
  const n = QUESTIONS.length;

  // answers[question] = { sel:number[], confirmed, customText }
  const [answers, setAnswers] = useState(() => {
    const a = {};
    QUESTIONS.forEach((q) => { a[q.question] = { sel: [], confirmed: false, customText: "" }; });
    return a;
  });
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState("right");
  const [popup, setPopup] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const isSummary = current >= n;
  const ref = useRef({});
  ref.current = { answers, current, popup, n, isSummary, submitted };

  const inputRef = useRef(null);
  useEffect(() => { if (popup && inputRef.current) inputRef.current.focus(); }, [popup]);

  const goTo = useCallback((idx, direction) => {
    setDir(direction);
    setCurrent(Math.max(0, Math.min(n, idx)));
  }, [n]);

  const advance = useCallback((from) => {
    if (from < n - 1) goTo(from + 1, "right");
    else goTo(n, "right");
  }, [goTo, n]);

  const goBack = useCallback(() => {
    const idx = QUESTIONS.findIndex((q) => !ref.current.answers[q.question].confirmed);
    goTo(idx === -1 ? n - 1 : idx, "left");
  }, [goTo, n, QUESTIONS]);

  const setQ = useCallback((qid, patch) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }, []);

  const activate = useCallback((qIndex, optIdx) => {
    const q = QUESTIONS[qIndex];
    const a = ref.current.answers[q.question];
    const action = AnswerMap.decideActivate(q, a, optIdx);
    switch (action.type) {
      case "noop":
        return;
      case "select":
      case "toggle":
        setQ(q.question, { sel: action.sel, confirmed: false });
        return;
      case "popup":
        setPopup({ qid: q.question, optIdx: action.optIdx, draft: action.draft });
        return;
      case "confirm":
        setQ(q.question, { confirmed: true });
        advance(qIndex);
        return;
    }
  }, [setQ, advance, QUESTIONS]);

  const confirmCurrent = useCallback(() => {
    const { current: cur } = ref.current;
    if (cur >= n) return;
    const q = QUESTIONS[cur];
    const a = ref.current.answers[q.question];
    if (a.sel.length === 0) return;
    const opts = fullOptions(q);
    const customIdx = opts.length - 1;
    if (a.sel.includes(customIdx) && !a.customText) {
      setPopup({ qid: q.question, optIdx: customIdx, draft: "" });
      return;
    }
    setQ(q.question, { confirmed: true });
    advance(cur);
  }, [n, setQ, advance, QUESTIONS]);

  const savePopup = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    const text = (p.draft || "").trim();
    if (!text) return;
    setAnswers((prev) => {
      const a = prev[p.qid];
      const sel = a.sel.includes(p.optIdx) ? a.sel : [...a.sel, p.optIdx];
      return { ...prev, [p.qid]: { ...a, sel, customText: text, confirmed: false } };
    });
    setPopup(null);
  }, []);

  const submit = useCallback(() => {
    const stateForMap = {};
    QUESTIONS.forEach((q) => {
      const a = ref.current.answers[q.question];
      stateForMap[q.question] = { sel: a.sel, customText: a.customText };
    });
    const mapped = AnswerMap.mapAnswers(QUESTIONS, stateForMap);
    setSubmitted(true);
    postAnswers(mapped);
  }, [QUESTIONS]);

  useEffect(() => {
    const onKey = (e) => {
      const R = ref.current;
      if (R.popup || R.submitted) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(Math.min(R.n, R.current + 1), "right"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(Math.max(0, R.current - 1), "left"); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (R.isSummary) { submit(); return; }
        confirmCurrent();
      } else if (R.isSummary && (e.key === "b" || e.key === "B")) { e.preventDefault(); goBack(); }
      else if (!R.isSummary && /^[1-9]$/.test(e.key)) { e.preventDefault(); activate(R.current, parseInt(e.key, 10) - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, confirmCurrent, activate, goBack, submit]);

  const answered = QUESTIONS.filter((q) => answers[q.question].confirmed).length;

  return (
    <div className="app" data-panel="left" data-align="center">
      <Sidebar QUESTIONS={QUESTIONS} answers={answers} current={current} n={n}
               answered={answered} isSummary={isSummary} submitted={submitted}
               goTo={goTo} />
      <main className="inspector">
        <div className="stage">
          {isSummary ? (
            <Summary answers={answers} QUESTIONS={QUESTIONS}
                     onEdit={(i) => goTo(i, "left")} onBack={goBack}
                     onSubmit={submit} submitted={submitted} />
          ) : (
            <QuestionCard key={QUESTIONS[current].question} q={QUESTIONS[current]}
                          qIndex={current} ans={answers[QUESTIONS[current].question]}
                          motion="slide" dir={dir} onActivate={activate} />
          )}
        </div>
        {!isSummary && <Hints q={QUESTIONS[current]} />}
      </main>
      {popup && (
        <CustomPopup q={QUESTIONS.find((q) => q.question === popup.qid)} draft={popup.draft}
                     inputRef={inputRef} onChange={(v) => setPopup((p) => ({ ...p, draft: v }))}
                     onSave={savePopup} onCancel={() => setPopup(null)} />
      )}
      {submitted && (
        <div className="toast"><span className="ok"><Check c="var(--success)" /></span>
          Answers sent back to the agent.</div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
