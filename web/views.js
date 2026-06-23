/* global React, Check, Kbd, Brand, fullOptions */
/* askuseroz · views — saf sunum bileşenleri (durumu prop ile alır, callback ile bildirir) */
const { useEffect: useEffectView, useState: useStateView, useMemo: useMemoView } = React;

/* Küçük ok ikonu (accordion chevron) */
const ChevronRight = () => (
  <svg className="qgroup__chevron" viewBox="0 0 14 14" fill="none">
    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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

/* ─────────────────── sidebar: tek soru satırı (paylaşımlı) ─────────────────── */
function QItem({ q, i, answers, current, goTo }) {
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
}

/* ─────────────────── sidebar: düz liste (N ≤ 8) ─────────────────── */
function SidebarFlatList({ QUESTIONS, answers, current, goTo }) {
  return (
    <React.Fragment>
      {QUESTIONS.map((q, i) => (
        <QItem key={q.question} q={q} i={i} answers={answers} current={current} goTo={goTo} />
      ))}
    </React.Fragment>
  );
}

/* ─────────────────── sidebar: accordion gruplar (N > 8) ─────────────────── */
function SidebarGrouped({ QUESTIONS, answers, current, goTo, filteredIndices }) {
  // Grup açık/kapalı durumu: başlangıçta tüm gruplar açık.
  // Grupları header alanına göre oluştur; header boş/yok olanlar "General" altında.
  const groups = useMemoView(() => {
    const map = new Map(); // başlık -> [{q, origIdx}]
    QUESTIONS.forEach((q, i) => {
      if (!filteredIndices.has(i)) return;
      const key = (q.header && q.header.trim()) ? q.header.trim() : "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ q, origIdx: i });
    });
    return [...map.entries()].map(([title, items]) => ({ title, items }));
  }, [QUESTIONS, answers, filteredIndices]);

  const [openGroups, setOpenGroups] = useStateView(() => {
    const s = new Set();
    groups.forEach((g) => s.add(g.title));
    return s;
  });

  // Filtreleme değişince kapanmış grupları yeniden aç (kullanıcı gördüklerini görsün).
  useEffectView(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => { if (!next.has(g.title)) next.add(g.title); });
      return next;
    });
  }, [filteredIndices]);

  const toggle = (title) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <React.Fragment>
      {groups.map(({ title, items }) => {
        const doneCount = items.filter(({ q }) => answers[q.question].confirmed).length;
        const isOpen = openGroups.has(title);
        const allDone = doneCount === items.length;
        return (
          <div key={title} className="qgroup" data-open={isOpen} data-done={allDone}>
            <button className="qgroup__header" onClick={() => toggle(title)}>
              <ChevronRight />
              <span className="qgroup__title">{title}</span>
              <span className="qgroup__badge">{doneCount}/{items.length}</span>
            </button>
            {isOpen && (
              <div className="qgroup__body">
                {items.map(({ q, origIdx }) => (
                  <QItem key={q.question} q={q} i={origIdx} answers={answers} current={current} goTo={goTo} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </React.Fragment>
  );
}

/* ─────────────────── sidebar: arama + filtre çubuğu ─────────────────── */
function SidebarSearch({ searchQuery, onSearch, showUnanswered, onToggleUnanswered, searchRef }) {
  return (
    <div className="sidebar__search">
      <input
        ref={searchRef}
        className="search__input"
        type="text"
        placeholder="Filter questions…"
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="search__row">
        <button
          className="search__toggle"
          data-active={showUnanswered}
          onClick={onToggleUnanswered}
          type="button"
        >
          <span className="search__toggle__dot">
            {showUnanswered && <Check s={9} c="var(--accent-fg)" />}
          </span>
          Show unanswered only
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── sidebar ─────────────────── */
// N ≤ 8 → düz liste, arama/accordion yok. N > 8 → arama + accordion gruplar.
const ACCORDION_THRESHOLD = 8;

function Sidebar({ QUESTIONS, answers, current, n, answered, isSummary, submitted, goTo,
                   searchQuery, onSearch, showUnanswered, onToggleUnanswered,
                   onJumpUnanswered, onSkipAll, searchRef }) {
  const useLarge = n > ACCORDION_THRESHOLD;

  // Filtrelenmiş indeks kümesi (sadece large modda kullanılır).
  const filteredIndices = useMemoView(() => {
    if (!useLarge) return null;
    const q = (searchQuery || "").toLowerCase().trim();
    const set = new Set();
    QUESTIONS.forEach((question, i) => {
      if (showUnanswered && answers[question.question].sel.length > 0) return;
      if (q && !question.question.toLowerCase().includes(q)) return;
      set.add(i);
    });
    return set;
  }, [QUESTIONS, answers, searchQuery, showUnanswered, useLarge]);

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
      {useLarge && (
        <SidebarSearch
          searchRef={searchRef}
          searchQuery={searchQuery}
          onSearch={onSearch}
          showUnanswered={showUnanswered}
          onToggleUnanswered={onToggleUnanswered}
        />
      )}
      {useLarge && (
        <div className="sidebar__bulk">
          <button className="sidebar__bulk-btn" onClick={onSkipAll} type="button">
            <span>Skip remaining &amp; review</span>
            <Kbd>→</Kbd>
          </button>
        </div>
      )}
      <div className="qlist">
        {useLarge ? (
          <SidebarGrouped
            QUESTIONS={QUESTIONS}
            answers={answers}
            current={current}
            goTo={goTo}
            filteredIndices={filteredIndices}
          />
        ) : (
          <SidebarFlatList
            QUESTIONS={QUESTIONS}
            answers={answers}
            current={current}
            goTo={goTo}
          />
        )}
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
        {useLarge && (
          <div className="legend">
            <span className="kbd-group"><Kbd>U</Kbd></span>
            <span>Jump to next unanswered</span>
          </div>
        )}
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
