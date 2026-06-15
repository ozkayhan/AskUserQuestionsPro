/* global React, ReactDOM, AnswerMap, useLiveQuestions, postAnswers, fullOptions,
   Check, Waiting, Sidebar, Hints, QuestionCard, CustomPopup, Summary */
/* askuseroz · app — durum makinesi: soru akışı, klavye, gönderim. Sunum web/views.js'te. */
const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const { id, questions } = useLiveQuestions();

  if (!questions || questions.length === 0) {
    return (
      <div className="app">
        <Waiting />
      </div>
    );
  }
  // key = tur kimliği: aynı metinli ardışık soru setleri bile temiz remount olur (B10).
  return <Flow questions={questions} key={id == null ? "q" : "round-" + id} />;
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
  const [sendError, setSendError] = useState(false);

  // Büyük soru seti: arama + filtre durumu (N > 8)
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnanswered, setShowUnanswered] = useState(false);
  const searchInputRef = useRef(null);

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
    setAnswers((prev) => {
      const a = prev[p.qid];
      const next = AnswerMap.savePopupState(a, p.optIdx, text); // boş metin = kaldır (B4)
      return { ...prev, [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false } };
    });
    setPopup(null);
  }, []);

  // Custom popup'tan "Remove": seçimi kaldır (B4 — multiSelect Other deselect).
  const removeCustom = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    setAnswers((prev) => {
      const a = prev[p.qid];
      const next = AnswerMap.savePopupState(a, p.optIdx, "");
      return { ...prev, [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false } };
    });
    setPopup(null);
  }, []);

  // "u" kısayolu: yanıtlanmamış ilk soruya atla; hepsi yanıtlanmışsa Summary'ye git.
  const jumpToNextUnanswered = useCallback(() => {
    const idx = QUESTIONS.findIndex((q) => ref.current.answers[q.question].sel.length === 0);
    goTo(idx === -1 ? n : idx, idx === -1 || idx > ref.current.current ? "right" : "left");
  }, [QUESTIONS, goTo, n]);

  // "Skip remaining & review": doğrudan Summary ekranına geç.
  const skipAll = useCallback(() => {
    goTo(n, "right");
  }, [goTo, n]);

  const mappedAnswers = useCallback(() => {
    const stateForMap = {};
    QUESTIONS.forEach((q) => {
      const a = ref.current.answers[q.question];
      stateForMap[q.question] = { sel: a.sel, customText: a.customText };
    });
    return AnswerMap.mapAnswers(QUESTIONS, stateForMap);
  }, [QUESTIONS]);

  const submit = useCallback(() => {
    if (ref.current.submitted) return;               // double-submit guard (B17)
    const mapped = mappedAnswers();
    if (Object.keys(mapped).length === 0) return;    // boş submit guard (B8)
    setSendError(false);
    setSubmitted(true);
    postAnswers(mapped).catch(() => {                // B6: hata → kilidi aç, uyar
      setSubmitted(false);
      setSendError(true);
    });
  }, [mappedAnswers]);

  useEffect(() => {
    const onKey = (e) => {
      const R = ref.current;
      if (R.popup || R.submitted) return;
      // Metin alanında (input, textarea) tuş yönlendirmesi: sadece ok tuşlarını ve Escape'i engelle.
      const inTextField = document.activeElement &&
        (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(Math.min(R.n, R.current + 1), "right"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(Math.max(0, R.current - 1), "left"); }
      else if (e.key === "Enter") {
        // Arama inputundayken Enter ile onay yok (input formu kontrolü).
        if (inTextField) return;
        e.preventDefault();
        if (R.isSummary) { submit(); return; }
        confirmCurrent();
      } else if (R.isSummary && (e.key === "b" || e.key === "B")) {
        if (inTextField) return;
        e.preventDefault();
        goBack();
      } else if (!R.isSummary && /^[1-9]$/.test(e.key)) {
        if (inTextField) return;
        e.preventDefault();
        activate(R.current, parseInt(e.key, 10) - 1);
      } else if (!R.isSummary && (e.key === "u" || e.key === "U")) {
        // "u": yanıtlanmamış ilk soruya atla (sadece büyük N için Hints gösterilir ama kısayol her zaman çalışır).
        if (inTextField) return;
        e.preventDefault();
        jumpToNextUnanswered();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, confirmCurrent, activate, goBack, submit, jumpToNextUnanswered]);

  // "answered" = en az bir şık seçili (sel) — gönderimle tutarlı (B16).
  const answered = QUESTIONS.filter((q) => answers[q.question].sel.length > 0).length;
  const canSubmit = answered > 0;

  return (
    <div className="app" data-panel="left" data-align="center">
      <Sidebar QUESTIONS={QUESTIONS} answers={answers} current={current} n={n}
               answered={answered} isSummary={isSummary} submitted={submitted}
               goTo={goTo}
               searchQuery={searchQuery} onSearch={setSearchQuery}
               showUnanswered={showUnanswered} onToggleUnanswered={() => setShowUnanswered((v) => !v)}
               onJumpUnanswered={jumpToNextUnanswered} onSkipAll={skipAll}
               searchRef={searchInputRef} />
      <main className="inspector">
        <div className="stage">
          {isSummary ? (
            <Summary answers={answers} QUESTIONS={QUESTIONS}
                     onEdit={(i) => goTo(i, "left")} onBack={goBack}
                     onSubmit={submit} submitted={submitted} canSubmit={canSubmit} />
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
                     selected={answers[popup.qid].sel.includes(popup.optIdx)}
                     inputRef={inputRef} onChange={(v) => setPopup((p) => ({ ...p, draft: v }))}
                     onSave={savePopup} onRemove={removeCustom} onCancel={() => setPopup(null)} />
      )}
      {submitted && (
        <div className="toast"><span className="ok"><Check c="var(--success)" /></span>
          Answers sent back to the agent.</div>
      )}
      {sendError && (
        <div className="toast toast--err">Couldn't send — bridge unavailable. Press Enter to retry.</div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
