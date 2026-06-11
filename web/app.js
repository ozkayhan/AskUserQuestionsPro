/* global React, ReactDOM, AnswerMap */
const { useState, useEffect, useRef, useCallback } = React;

const CUSTOM_LABEL = "Other";
const CUSTOM_DESC = "Let me describe something else.";

/* ── icons (design-reference/project/app.jsx ile birebir) ── */
const Check = ({ c = "currentColor", s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3.5 8.5l3 3 6-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowR = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

function fullOptions(q) {
  return [...q.options, { label: CUSTOM_LABEL, description: CUSTOM_DESC, custom: true }];
}

/* ── canlı veri: SSE ile bekleyen soru setini al ── */
function useLiveQuestions() {
  const [questions, setQuestions] = useState(null); // null = bekliyor
  useEffect(() => {
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

async function postAnswers(answers) {
  await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

/* ─────────────────── app ─────────────────── */
function App() {
  const questions = useLiveQuestions();

  if (!questions || questions.length === 0) {
    return (
      <div className="app" data-bg="amoled" style={{ "--accent": "#0070f3", "--motion-ms": "380ms" }}>
        <Waiting />
      </div>
    );
  }
  return <Flow questions={questions} key={questions.map((q) => q.question).join("|")} />;
}

function Waiting() {
  return (
    <main className="inspector">
      <div className="stage">
        <div className="qcard">
          <div className="qcard__chip"><span className="dot" />Agent · clarify</div>
          <h1 className="qcard__q">Waiting for a question…</h1>
          <p className="qcard__meta">Claude Code bir soru sorduğunda burada görünecek. Bu sekmeyi açık bırakın.</p>
        </div>
      </div>
    </main>
  );
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
    const opts = fullOptions(q);
    if (optIdx >= opts.length) return;
    const a = ref.current.answers[q.question];
    const isCustom = !!opts[optIdx].custom;

    if (q.multiSelect) {
      const inSel = a.sel.includes(optIdx);
      if (inSel) {
        if (isCustom) { setPopup({ qid: q.question, optIdx, draft: a.customText }); return; }
        setQ(q.question, { sel: a.sel.filter((i) => i !== optIdx), confirmed: false });
      } else {
        setQ(q.question, { sel: [...a.sel, optIdx], confirmed: false });
        if (isCustom && !a.customText) setPopup({ qid: q.question, optIdx, draft: "" });
      }
      return;
    }

    const armed = a.sel[0] === optIdx;
    if (!armed) { setQ(q.question, { sel: [optIdx], confirmed: false }); return; }
    if (isCustom && !a.customText) { setPopup({ qid: q.question, optIdx, draft: "" }); return; }
    setQ(q.question, { confirmed: true });
    advance(qIndex);
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
    <div className="app" data-panel="left" data-align="center" data-bg="amoled"
         style={{ "--accent": "#0070f3", "--motion-ms": "380ms" }}>
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

/* ─────────────────── sidebar ─────────────────── */
function Sidebar({ QUESTIONS, answers, current, n, answered, isSummary, submitted, goTo }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <div className="brand">
          <span className="brand__mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 1.5L18.5 17H1.5L10 1.5z" fill="var(--fg)" />
            </svg>
          </span>
          <span className="brand__name">Agent <span>· clarify</span></span>
        </div>
        <div className="progress__label">
          <span>Questions</span><span><b>{Math.min(answered, n)}</b> / {n}</span>
        </div>
        <div className="progress__track">
          <div className="progress__fill" style={{ width: `${(answered / n) * 100}%` }} />
        </div>
      </div>
      <div className="qlist">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question];
          const state = a.confirmed ? "done" : (i === current ? "current" : "pending");
          const opts = fullOptions(q);
          const answerText = a.confirmed
            ? a.sel.map((s) => (opts[s].custom ? a.customText : opts[s].label)).join(", ") : "";
          return (
            <button key={q.question} className="qitem" data-active={i === current} data-state={state}
                    onClick={() => goTo(i, i > current ? "right" : "left")}>
              <span className="qitem__idx">{state === "done" ? <Check s={12} /> : i + 1}</span>
              <span className="qitem__body">
                <span className="qitem__header">{q.header}</span>
                <span className="qitem__q">{q.question}</span>
                {a.confirmed && <span className="qitem__answer"><Check s={11} /> {answerText}</span>}
              </span>
            </button>
          );
        })}
        <button className="qitem" data-active={isSummary} data-state={submitted ? "done" : "pending"}
                onClick={() => goTo(n, "right")} style={{ marginTop: 4 }}>
          <span className="qitem__idx">{submitted ? <Check s={12} /> : "✓"}</span>
          <span className="qitem__body">
            <span className="qitem__header">Review</span>
            <span className="qitem__q">Confirm &amp; submit your answers</span>
          </span>
        </button>
      </div>
      <div className="sidebar__foot">
        <div className="legend"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span><span>Move between questions</span></div>
        <div className="legend"><span className="kbd-group"><Kbd>1</Kbd><Kbd>4</Kbd></span><span>Select · press again to confirm</span></div>
      </div>
    </aside>
  );
}

function Hints({ q }) {
  return (
    <footer className="hints">
      <span className="hint">
        <span className="kbd-group"><Kbd>1</Kbd>–<Kbd>{fullOptions(q).length}</Kbd></span> Select
      </span>
      <span className="hint">
        {q.multiSelect
          ? <><Kbd>↵</Kbd> Confirm selection</>
          : <><span style={{ color: "var(--fg-faint)" }}>press key again →</span> Confirm</>}
      </span>
      <span className="hint"><Kbd>↵</Kbd> on “Other” to type</span>
      <span className="hint__spacer" />
      <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Navigate</span>
    </footer>
  );
}

/* ─────────────────── question card (referans birebir) ─────────────────── */
function QuestionCard({ q, qIndex, ans, motion, dir, onActivate }) {
  const opts = fullOptions(q);
  return (
    <div className="qcard" data-motion={motion} data-dir={dir}>
      <div className="qcard__chip"><span className="dot" />{q.header}</div>
      <h1 className="qcard__q">{q.question}</h1>
      <p className="qcard__meta">
        {q.multiSelect ? "Select all that apply." : "Select one option."} An “Other” choice is always available.
      </p>
      <div className="options">
        {opts.map((o, i) => {
          const sel = ans.sel.includes(i);
          const confirmed = ans.confirmed && sel;
          const isCustom = !!o.custom;
          const showCustomVal = isCustom && ans.customText;
          return (
            <button key={i} className={"opt" + (isCustom ? " opt--custom" : "")}
                    data-sel={sel} data-confirmed={confirmed} onClick={() => onActivate(qIndex, i)}>
              <span className="opt__key">{i + 1}</span>
              <span className="opt__body">
                <span className="opt__label">
                  {isCustom && showCustomVal
                    ? <>Other <span className="custom-val">— “{ans.customText}”</span></>
                    : o.label}
                </span>
                <span className="opt__desc">
                  {isCustom
                    ? (sel
                        ? <span className="hint-edit">Press <Kbd>{i + 1}</Kbd> or <Kbd>↵</Kbd> to type your own answer.</span>
                        : o.description)
                    : o.description}
                </span>
              </span>
              {q.multiSelect
                ? <span className="opt__box">{sel && <Check c="#fff" s={12} />}</span>
                : <span className="opt__check"><Check c={confirmed ? "var(--success)" : "var(--accent)"} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── custom popup (referans birebir) ─────────────────── */
function CustomPopup({ q, draft, inputRef, onChange, onSave, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffect(() => { autosize(inputRef.current); }, [draft]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="popup">
        <div className="popup__chip">{q.header} · Other</div>
        <div className="popup__title">{q.question}</div>
        <textarea ref={inputRef} className="popup__input" rows={1} value={draft}
                  placeholder="Type your own answer — write as much as you need…"
                  onChange={(e) => { onChange(e.target.value); autosize(e.target); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
                    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                  }} />
        <div className="popup__foot">
          <span className="popup__hint"><Kbd>↵</Kbd> Save · <Kbd>⇧↵</Kbd> New line · <Kbd>esc</Kbd> Cancel</span>
          <div className="popup__actions">
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary" onClick={onSave} disabled={!draft.trim()}>Save answer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── summary (referanstan port: q.question anahtarı) ─────────────────── */
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted }) {
  const allDone = QUESTIONS.every((q) => answers[q.question].confirmed);
  return (
    <div className="summary">
      <div className="summary__chip"><Check c="var(--success)" s={12} /> Ready to send</div>
      <h1 className="summary__title">Review your answers</h1>
      <p className="summary__sub">These get sent back to the agent so it can continue. Edit anything before submitting.</p>
      <div className="summary__list">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question];
          const opts = fullOptions(q);
          return (
            <div className="srow" key={q.question}>
              <div className="srow__head">{q.header}</div>
              <div className="srow__val">
                <div className="srow__q">{q.question}</div>
                <div className="srow__a">
                  {a.sel.length === 0
                    ? <span className="none">No answer yet</span>
                    : a.sel.map((s) => {
                        const o = opts[s];
                        const val = o.custom ? a.customText : o.label;
                        return <span key={s} className={"tag" + (o.custom ? " tag--custom" : "")}>{val}</span>;
                      })}
                </div>
              </div>
              <button className="srow__edit" onClick={() => onEdit(i)}>Edit</button>
            </div>
          );
        })}
      </div>
      <div className="summary__actions">
        <button className="btn btn--lg btn--ghost" onClick={onBack}>
          <Kbd>B</Kbd> Back{allDone ? "" : " to unanswered"}
        </button>
        <button className="btn btn--lg btn--primary" onClick={onSubmit}>
          {submitted ? "Submitted ✓" : <>Submit answers <Kbd>↵</Kbd></>}
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
