/* global React, Check, Kbd, Brand, fullOptions, Themes */
/* askuseroz · views — saf sunum bileşenleri (durumu prop ile alır, callback ile bildirir) */
const { useEffect: useEffectView, useState: useStateView } = React;

/* ─────────────────── theme switcher (sadece seçici) ─────────────────── */
function ThemeSwitcher() {
  if (typeof Themes === "undefined") return null;
  const [active, setActive] = useStateView(() => Themes.current());
  const pick = (id) => { setActive(Themes.apply(id)); };
  return (
    <div className="themer">
      <div className="themer__label">Theme</div>
      <div className="themer__row">
        {Themes.list.map((t) => (
          <button key={t.id} className="swatch" data-active={t.id === active}
                  title={t.name} onClick={() => pick(t.id)}>
            <span className="swatch__dot"
                  style={{ background: t.swatch.bg, "--sw-accent": t.swatch.accent }} />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
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

/* ─────────────────── sidebar ─────────────────── */
function Sidebar({ QUESTIONS, answers, current, n, answered, isSummary, submitted, goTo }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <div className="brand">
          <span className="brand__mark"><Brand s={20} /></span>
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
        <ThemeSwitcher />
      </div>
    </aside>
  );
}

function Hints({ q }) {
  return (
    <footer className="hints">
      <span className="hint">
        <span className="kbd-group"><Kbd>1</Kbd>–<Kbd>{Math.min(9, fullOptions(q).length)}</Kbd></span> Select
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
function CustomPopup({ q, draft, selected, inputRef, onChange, onSave, onRemove, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffectView(() => { autosize(inputRef.current); }, [draft]);
  const trimmed = (draft || "").trim();
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
            {selected && <button className="btn btn--danger" onClick={onRemove}>Remove</button>}
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary" onClick={onSave} disabled={!selected && !trimmed}>
              {trimmed ? "Save answer" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── summary (q.question anahtarı) ─────────────────── */
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted, canSubmit }) {
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
        <button className="btn btn--lg btn--primary" onClick={onSubmit} disabled={!canSubmit || submitted}>
          {submitted ? "Submitted ✓" : canSubmit ? <>Submit answers <Kbd>↵</Kbd></> : "Answer at least one"}
        </button>
      </div>
    </div>
  );
}
