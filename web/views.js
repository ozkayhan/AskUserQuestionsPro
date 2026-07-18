/* global React, Check, Kbd, Brand, fullOptions, AnswerMap */
/* askuseroz · views — saf sunum bileşenleri (durumu prop ile alır, callback ile bildirir) */
const {
  useEffect: useEffectView,
  useState: useStateView,
  useMemo: useMemoView,
  useRef: useRefView,
} = React;

function useModalFocus(ref, onEscape) {
  const restoreRef = useRefView(null);
  useEffectView(() => {
    restoreRef.current = document.activeElement;
    ref.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = ref.current?.closest?.('[role="dialog"]');
      if (!dialog) return;
      const focusable = [
        ...dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [onEscape, ref]);
}

function RecoveryChooser({ rounds, onSelect, onRetry, onDismiss, error }) {
  const titleRef = useRefView(null);
  useModalFocus(titleRef, onDismiss);
  return (
    <div
      className="recovery-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      aria-describedby="recovery-description"
    >
      <div className="recovery-panel">
        <h2 id="recovery-title" tabIndex="-1" ref={titleRef}>
          Choose a round to recover
        </h2>
        <p id="recovery-description">
          Select the exact saved round. The newest round is never selected automatically.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="recovery-list">
          {(rounds || []).map((round) => (
            <button
              type="button"
              className="recovery-choice"
              key={round.roundId || round.requestId}
              onClick={() => onSelect(round)}
            >
              <strong>{round.state || 'Saved round'}</strong>
              <span>
                {round.updatedAt || 'Saved locally'} · {round.questionCount ?? '?'} questions
              </span>
            </button>
          ))}
        </div>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Retry recovery
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn" onClick={onDismiss}>
            Continue without recovery
          </button>
        )}
      </div>
    </div>
  );
}

function ReconciliationPanel({ conflict, onKeepServer, onReview, onDiscard }) {
  const titleRef = useRefView(null);
  useModalFocus(titleRef, onKeepServer);
  if (!conflict) return null;
  return (
    <div
      className="recovery-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconcile-title"
    >
      <div className="recovery-panel">
        <h2 id="reconcile-title" tabIndex="-1" ref={titleRef}>
          Saved round changed
        </h2>
        <p>Your local draft and the server have different revisions. Nothing was overwritten.</p>
        <p role="status">
          Server revision {conflict.serverRevision}; local revision {conflict.localRevision}.
        </p>
        <div className="recovery-actions">
          <button type="button" className="btn btn--primary" onClick={onKeepServer}>
            Keep server
          </button>
          <button type="button" className="btn" onClick={onReview}>
            Review differences
          </button>
          <button type="button" className="btn btn--danger" onClick={onDiscard}>
            Discard local draft
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryPanel({ state = 'saved', onRetry, onAcknowledge, closeDenied, opening }) {
  const copy = {
    saved: ['Saved locally on the bridge.', 'Continue editing or submit'],
    'delivery-pending': ['Saving your answer for delivery…', 'Wait; duplicate submit is disabled'],
    delivered: ['Delivered to the host.', 'Close when allowed; reopen result'],
    'delivery-uncertain': [
      'Delivery status is uncertain. Your answer is preserved.',
      'Check status, retry acknowledgement, or recover exact round',
    ],
    cancelled: ['This round was cancelled.', 'Start a new round or view retained record'],
    'recovery-error': [
      'This round could not be recovered safely. Your current work was not replaced.',
      'Retry, choose another round, or copy support-safe diagnostics',
    ],
  }[state] || ['Saved locally on the bridge.', 'Continue editing or submit'];
  return (
    <section className="delivery-panel" aria-labelledby="delivery-title">
      <h2 id="delivery-title">Delivery status</h2>
      <p role="status" aria-live="polite">
        {copy[0]}
      </p>
      <p>{copy[1]}</p>
      {state === 'delivery-pending' && (
        <button type="button" disabled>
          Saving…
        </button>
      )}
      {state === 'delivery-uncertain' && (
        <button type="button" onClick={onRetry}>
          Retry acknowledgement
        </button>
      )}
      {state === 'delivered' && onAcknowledge && (
        <button type="button" onClick={onAcknowledge}>
          Reopen result
        </button>
      )}
      {closeDenied && (
        <p role="alert">
          The browser did not allow automatic close. You may safely close this tab now; your result
          remains available.
        </p>
      )}
      {opening?.failed && (
        <div className="opening-fallback">
          <p>Browser opening failed for {opening.strategy || 'the configured strategy'}.</p>
          <input
            readOnly
            value={opening.url || ''}
            aria-label="Local URL"
            onFocus={(e) => e.target.select()}
          />
          <p>Copy the localhost URL and open it manually.</p>
        </div>
      )}
    </section>
  );
}

/* Küçük ok ikonu (accordion chevron) */
const ChevronRight = () => (
  // ponytail: decorative icon — aria-hidden suppresses screen reader noise
  <svg className="qgroup__chevron" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M5 3l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Header metni HTML id'si için güvenilir değildir (boşluk/emoji/aynı normalize
// edilen adlar). Deterministik küçük hash, her accordion paneli için stabil id üretir.
function groupId(title, suffix = 'body') {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return `qgroup-${suffix}-${hash.toString(36)}`;
}

function Waiting() {
  return (
    <main className="inspector">
      <div className="stage">
        <div className="qcard">
          <div className="qcard__chip">
            <span className="dot" />
            Agent · clarify
          </div>
          <h2 className="qcard__q">Waiting for a question…</h2>
          <p className="qcard__meta">
            Claude Code bir soru sorduğunda burada görünecek. Bu sekmeyi açık bırakın.
          </p>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────── sidebar: tek soru satırı (paylaşımlı) ─────────────────── */
function QItem({ q, i, answers, current, goTo }) {
  // ponytail: null guard for race between QUESTIONS update and answers init
  const a = answers[q.question] || {};
  const state = a.confirmed ? 'done' : i === current ? 'current' : 'pending';
  const answerText = a.confirmed
    ? typeof AnswerMap !== 'undefined' && AnswerMap.summaryText
      ? AnswerMap.summaryText(q, a)
      : (() => {
          const opts = fullOptions(q);
          return a.sel
            .map((s) => (opts[s] && opts[s].custom ? a.customText : opts[s] ? opts[s].label : ''))
            .filter(Boolean) // ponytail: match Summary fallback; avoids ", , Foo" for OOB indices
            .join(', ');
        })()
    : '';
  // ponytail: aria-current="step" for AT; aria-label encodes done state + answer text for keyboard users
  const ariaLabel = `${i + 1}. ${q.question}${state === 'done' ? ': ' + (answerText || 'done') : ''}`;
  return (
    <button
      key={q.question}
      className="qitem"
      type="button"
      data-active={i === current}
      data-state={state}
      aria-current={i === current ? 'step' : undefined}
      aria-label={ariaLabel}
      onClick={() => goTo(i, i > current ? 'right' : 'left')}
    >
      <span className="qitem__idx" aria-hidden="true">
        {state === 'done' ? <Check s={12} /> : i + 1}
      </span>
      <span className="qitem__body" aria-hidden="true">
        <span className="qitem__header">{q.header}</span>
        <span className="qitem__q">{q.question}</span>
        {a.confirmed && answerText && (
          <span className="qitem__answer">
            <Check s={11} /> {answerText}
          </span>
        )}
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
      const key = q.header && q.header.trim() ? q.header.trim() : 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ q, origIdx: i });
    });
    return [...map.entries()].map(([title, items]) => ({ title, items }));
    // ponytail: answers removed — doneCount is computed in JSX, not here; filteredIndices captures filter state
  }, [QUESTIONS, filteredIndices]);

  const [openGroups, setOpenGroups] = useStateView(() => {
    const s = new Set();
    groups.forEach((g) => s.add(g.title));
    return s;
  });

  // Filtreleme değişince kapanmış grupları yeniden aç (kullanıcı gördüklerini görsün).
  useEffectView(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => {
        if (!next.has(g.title)) next.add(g.title);
      });
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
        const doneCount = items.filter(({ q }) => answers[q.question]?.confirmed).length;
        const isOpen = openGroups.has(title);
        const allDone = doneCount === items.length;
        return (
          <div key={title} className="qgroup" data-open={isOpen} data-done={allDone}>
            <button
              className="qgroup__header"
              type="button"
              onClick={() => toggle(title)}
              aria-expanded={isOpen}
              aria-controls={groupId(title, 'body')}
            >
              <ChevronRight />
              <span className="qgroup__title">{title}</span>
              <span className="qgroup__badge">
                {doneCount}/{items.length}
              </span>
            </button>
            {isOpen && (
              <div id={groupId(title, 'body')} className="qgroup__body">
                {items.map(({ q, origIdx }) => (
                  <QItem
                    key={q.question}
                    q={q}
                    i={origIdx}
                    answers={answers}
                    current={current}
                    goTo={goTo}
                  />
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
        aria-label="Filter questions"
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="search__row">
        <button
          className="search__toggle"
          data-active={showUnanswered}
          onClick={onToggleUnanswered}
          type="button"
          role="switch"
          aria-checked={showUnanswered}
        >
          <span className="search__toggle__dot" aria-hidden="true">
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

function Sidebar({
  QUESTIONS,
  answers,
  current,
  n,
  answered,
  isSummary,
  submitted,
  goTo,
  searchQuery,
  onSearch,
  showUnanswered,
  onToggleUnanswered,
  onJumpUnanswered,
  onSkipAll,
  searchRef,
}) {
  const useLarge = n > ACCORDION_THRESHOLD;

  // Filtrelenmiş indeks kümesi (sadece large modda kullanılır).
  // isAnswered varsa onu kullan; yoksa geriye uyumlu sel.length kontrolü.
  const filteredIndices = useMemoView(() => {
    if (!useLarge) return null;
    const qStr = (searchQuery || '').toLowerCase().trim();
    const set = new Set();
    QUESTIONS.forEach((question, i) => {
      const a = answers[question.question];
      const isAns =
        typeof AnswerMap !== 'undefined' && AnswerMap.isAnswered
          ? AnswerMap.isAnswered(question, a)
          : (a?.sel || []).length > 0;
      if (showUnanswered && isAns) return;
      if (qStr && !question.question.toLowerCase().includes(qStr)) return;
      set.add(i);
    });
    return set;
  }, [QUESTIONS, answers, searchQuery, showUnanswered, useLarge]);

  return (
    <aside className="sidebar">
      {/* ponytail: single sr-only h1 for the page; question cards use h2 */}
      <h1
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        Agent Clarification — Questions
      </h1>
      <div className="sidebar__head">
        <div className="brand">
          <span className="brand__mark">
            <Brand s={20} />
          </span>
          <span className="brand__name">
            Agent <span>· clarify</span>
          </span>
        </div>
        <div className="progress__label">
          <span>Questions</span>
          <span>
            <b>{Math.min(answered, n)}</b> / {n}
          </span>
        </div>
        <div
          className="progress__track"
          role="progressbar"
          aria-valuenow={Math.min(answered, n)}
          aria-valuemin={0}
          aria-valuemax={n}
          aria-label="Questions answered"
        >
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
          <SidebarFlatList QUESTIONS={QUESTIONS} answers={answers} current={current} goTo={goTo} />
        )}
        <button
          className="qitem"
          type="button"
          data-active={isSummary}
          data-state={submitted ? 'done' : 'pending'}
          aria-current={isSummary ? 'step' : undefined}
          aria-label="Review and submit your answers"
          onClick={() => goTo(n, 'right')}
          style={{ marginTop: 4 }}
        >
          <span className="qitem__idx">{submitted ? <Check s={12} /> : '✓'}</span>
          <span className="qitem__body">
            <span className="qitem__header">Review</span>
            <span className="qitem__q">Confirm &amp; submit your answers</span>
          </span>
        </button>
      </div>
      <div className="sidebar__foot">
        <div className="legend">
          <span className="kbd-group">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </span>
          <span>Move between questions</span>
        </div>
        <div className="legend">
          <span className="kbd-group">
            <Kbd>1</Kbd>
            <Kbd>4</Kbd>
          </span>
          <span>Select · press again to confirm</span>
        </div>
        {useLarge && (
          <div className="legend">
            <span className="kbd-group">
              <Kbd>U</Kbd>
            </span>
            <span>Jump to next unanswered</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─────────────────── ipuçları (qType'a göre) ─────────────────── */
function Hints({ q }) {
  const qType =
    typeof AnswerMap !== 'undefined' && AnswerMap.qType
      ? AnswerMap.qType(q)
      : q.type || (q.multiSelect ? 'multi' : 'single');

  if (qType === 'scale') {
    // Slider odaktayken ←/→ değeri ayarlar; sorular arası geçiş ↵ (onayla→ilerle) veya kenar çubuğu.
    return (
      <footer className="hints">
        <span className="hint">
          <span className="kbd-group">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </span>{' '}
          Ayarla
        </span>
        <span className="hint">
          <Kbd>↵</Kbd> Onayla ve ilerle
        </span>
      </footer>
    );
  }
  if (qType === 'ranking') {
    return (
      <footer className="hints">
        <span className="hint">
          <span className="kbd-group">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>{' '}
          Taşı
        </span>
        <span className="hint">
          <Kbd>↵</Kbd> Onayla
        </span>
        <span className="hint__spacer" />
        <span className="hint">
          <span className="kbd-group">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </span>{' '}
          Navigate
        </span>
      </footer>
    );
  }
  if (qType === 'tree') {
    return (
      <footer className="hints">
        <span className="hint">
          <span className="kbd-group">
            <Kbd>1</Kbd>–<Kbd>9</Kbd>
          </span>{' '}
          Seç
        </span>
        <span className="hint">
          <Kbd>⌫</Kbd> Geri
        </span>
        <span className="hint__spacer" />
        <span className="hint">
          <Kbd>→</Kbd> İleri soru
        </span>
      </footer>
    );
  }
  if (qType === 'binary') {
    return (
      <footer className="hints">
        <span className="hint">
          <span className="kbd-group">
            <Kbd>1</Kbd>
            <Kbd>2</Kbd>
          </span>{' '}
          Seç
        </span>
        <span className="hint__spacer" />
        <span className="hint">
          <span className="kbd-group">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </span>{' '}
          Navigate
        </span>
      </footer>
    );
  }
  // single / multi (mevcut)
  return (
    <footer className="hints">
      <span className="hint">
        <span className="kbd-group">
          <Kbd>1</Kbd>–<Kbd>{Math.min(9, fullOptions(q).length)}</Kbd>
        </span>{' '}
        Select
      </span>
      <span className="hint">
        {q.multiSelect ? (
          <>
            <Kbd>↵</Kbd> Confirm selection
          </>
        ) : (
          <>
            <span style={{ color: 'var(--fg-faint)' }}>press key again →</span> Confirm
          </>
        )}
      </span>
      <span className="hint">
        <Kbd>↵</Kbd> on "Other" to type
      </span>
      <span className="hint__spacer" />
      <span className="hint">
        <span className="kbd-group">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </span>{' '}
        Navigate
      </span>
    </footer>
  );
}

/* ─────────────────── BinaryCard ─────────────────── */
function BinaryCard({ q, qIndex, ans, onActivate }) {
  const opts = fullOptions(q); // binary için 2 şık (Evet/Hayır veya özel)
  return (
    <div className="binary">
      {opts.map((o, i) => {
        const sel = ans.sel.includes(i);
        const confirmed = ans.confirmed && sel;
        return (
          <button
            key={i}
            className="binary__opt"
            type="button"
            data-sel={sel}
            data-confirmed={confirmed}
            aria-pressed={sel}
            // M-24: number-key (1-9) kısayolu AT'ye bildirilir (app.js keydown ile eşleşir).
            aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
            onClick={() => onActivate(qIndex, i)}
          >
            <span className="opt__key" aria-hidden="true">
              {i + 1}
            </span>
            <span className="opt__label">{o.label}</span>
            {sel && (
              <span className="opt__check" aria-hidden="true">
                <Check c={confirmed ? 'var(--success)' : 'var(--accent)'} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────── ScaleCard ─────────────────── */
function ScaleCard({ q, ans, qIndex, setQ, onConfirm }) {
  const min = q.min != null ? q.min : 0;
  const max = q.max != null ? q.max : 10;
  const step = q.step != null ? q.step : 1;
  // Görsel başlangıç: value ?? orta nokta — ama state'e null bırak (isAnswered value!=null bekler)
  const displayValue = ans.value != null ? ans.value : Math.round((min + max) / 2);

  const handleChange = (e) => {
    const clamped =
      typeof AnswerMap !== 'undefined' && AnswerMap.clampScale
        ? AnswerMap.clampScale(q, +e.target.value)
        : Math.min(max, Math.max(min, +e.target.value));
    setQ({ value: clamped });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      // Dokunulmamış slider'da bile gösterilen değeri (orta nokta) onayla — patch ile geç (stale-ref'siz).
      const committed =
        typeof AnswerMap !== 'undefined' && AnswerMap.clampScale
          ? AnswerMap.clampScale(q, displayValue)
          : displayValue;
      onConfirm(qIndex, { value: committed });
    }
  };

  return (
    <div className="scale">
      <div className="scale__value" data-empty={ans.value == null}>
        {displayValue}
      </div>
      <input
        type="range"
        className="scale__range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        aria-label={q.question}
        aria-valuetext={
          q.leftLabel || q.rightLabel
            ? `${displayValue}${q.leftLabel ? ' (' + q.leftLabel + ' to ' + (q.rightLabel || '') + ')' : ''}`
            : String(displayValue)
        }
        autoFocus
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="scale__labels">
        <span>{q.leftLabel || ''}</span>
        <span>{q.rightLabel || ''}</span>
      </div>
    </div>
  );
}

/* ─────────────────── RankingCard ─────────────────── */
function RankingCard({ q, ans, qIndex, setQ, onConfirm }) {
  const initOrder =
    typeof AnswerMap !== 'undefined' && AnswerMap.initOrder
      ? AnswerMap.initOrder(q)
      : q.options.map((_, i) => i);
  const order = ans.order || initOrder;

  // cursor: hangi satır odakta (klavye ile gezilecek)
  // ponytail: use ref to avoid stale closure when grabbed+ArrowDown/Up fires before re-render
  const cursorRef = useRefView(0);
  const [cursor, setCursor] = useStateView(0);
  // grabbed: o satır "tutuldu mu" (Enter/Space ile kap/bırak)
  const [grabbed, setGrabbed] = useStateView(false);
  // aria-live announcement for screen readers
  const [liveMsg, setLiveMsg] = useStateView('');

  const moveRank = (idx, dir) => {
    if (typeof AnswerMap !== 'undefined' && AnswerMap.moveRank) {
      return AnswerMap.moveRank(order, idx, dir);
    }
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return newOrder;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    return newOrder;
  };

  const handleKeyDown = (e) => {
    // Sadece kartın kullandığı tuşları yut; ←/→ ve u/b app'e ulaşıp navigasyonu sürdürsün.
    if (e.key === 'ArrowUp') {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        // ponytail: read from ref (not closure) to avoid stale cursor on rapid keydown
        const cur = cursorRef.current;
        const newOrder = moveRank(cur, -1);
        const nextCursor = Math.max(0, cur - 1);
        cursorRef.current = nextCursor;
        setQ({ order: newOrder });
        setCursor(nextCursor);
        const opt = q.options[newOrder[nextCursor]];
        if (opt) setLiveMsg(`${opt.label}, position ${nextCursor + 1} of ${order.length}`);
      } else {
        setCursor((c) => {
          const next = Math.max(0, c - 1);
          cursorRef.current = next;
          return next;
        });
      }
    } else if (e.key === 'ArrowDown') {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        const cur = cursorRef.current;
        const newOrder = moveRank(cur, 1);
        const nextCursor = Math.min(order.length - 1, cur + 1);
        cursorRef.current = nextCursor;
        setQ({ order: newOrder });
        setCursor(nextCursor);
        const opt = q.options[newOrder[nextCursor]];
        if (opt) setLiveMsg(`${opt.label}, position ${nextCursor + 1} of ${order.length}`);
      } else {
        setCursor((c) => {
          const next = Math.min(order.length - 1, c + 1);
          cursorRef.current = next;
          return next;
        });
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        setGrabbed(false);
        setLiveMsg('Dropped');
      } else if (e.key === ' ') {
        setGrabbed(true);
        const opt = q.options[order[cursor]];
        if (opt) setLiveMsg(`Grabbed ${opt.label}, position ${cursor + 1}`);
      } else {
        // Enter kapalıyken → gösterilen sırayı onayla (dokunulmamışsa initOrder; patch ile stale-ref'siz).
        onConfirm(qIndex, { order: order });
      }
    }
  };

  return (
    <div
      className="ranking"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label={q.question}
      aria-multiselectable={false}
    >
      {/* ponytail: assertive live region for drag-drop position announcements */}
      <span
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {liveMsg}
      </span>
      {order.map((optIdx, rankPos) => {
        const opt = q.options[optIdx];
        const isCursor = cursor === rankPos;
        const isGrabbed = grabbed && isCursor;
        return (
          <div
            key={optIdx}
            className="rank-row"
            data-cursor={isCursor}
            data-grabbed={isGrabbed}
            role="option"
            aria-selected={isCursor}
            aria-roledescription="sortable item"
            aria-label={`${rankPos + 1}. ${opt ? opt.label : ''}${isGrabbed ? ' (grabbed)' : ''}`}
          >
            <span className="rank-row__badge" aria-hidden="true">
              {rankPos + 1}
            </span>
            <span className="opt__label">{opt ? opt.label : ''}</span>
            <span className="rank-row__moves">
              <button
                className="rank-row__move"
                type="button"
                tabIndex={-1}
                disabled={rankPos === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setQ({ order: moveRank(rankPos, -1) });
                }}
                aria-label="Yukarı taşı"
              >
                ↑
              </button>
              <button
                className="rank-row__move"
                type="button"
                tabIndex={-1}
                disabled={rankPos === order.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setQ({ order: moveRank(rankPos, 1) });
                }}
                aria-label="Aşağı taşı"
              >
                ↓
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── TreeCard ─────────────────── */
function TreeCard({ q, ans, qIndex, setQ, onConfirm }) {
  const path = ans.path || [];

  const getChildren = (currentPath) => {
    if (typeof AnswerMap !== 'undefined' && AnswerMap.treeChildrenAt) {
      return AnswerMap.treeChildrenAt(q, currentPath);
    }
    // Fallback: manuel gezinti
    let nodes = q.options;
    for (const idx of currentPath) {
      if (!nodes || !nodes[idx]) return [];
      nodes = nodes[idx].children || [];
    }
    return nodes || [];
  };

  const isLeafNode = (node) => {
    if (typeof AnswerMap !== 'undefined' && AnswerMap.isLeaf) {
      return AnswerMap.isLeaf(node);
    }
    return !node.children || node.children.length === 0;
  };

  const getNodeAt = (currentPath) => {
    if (typeof AnswerMap !== 'undefined' && AnswerMap.treeNodeAt) {
      return AnswerMap.treeNodeAt(q, currentPath);
    }
    if (currentPath.length === 0) return null;
    let nodes = q.options;
    let node = null;
    for (const idx of currentPath) {
      if (!nodes || !nodes[idx]) return null;
      node = nodes[idx];
      nodes = node.children || [];
    }
    return node;
  };

  const children = getChildren(path);

  // Breadcrumb için yol etiketleri
  // ponytail: filter out null crumbs (invalid/stale path) — avoids empty breadcrumb buttons
  const crumbs = path.reduce((acc, _, depth) => {
    const node = getNodeAt(path.slice(0, depth + 1));
    if (!node) return acc; // truncate at first invalid index; dev guard below
    acc.push({ label: node.label, depth });
    return acc;
  }, []);

  const handleSelect = (i) => {
    const child = children[i];
    if (!child) return;
    const newPath = [...path, i];
    if (isLeafNode(child)) {
      // Yaprak → patch ile onayla (onConfirm path'i yazar + confirmed + ilerler; stale-ref yok).
      onConfirm(qIndex, { path: newPath });
    } else {
      // ponytail: reset confirmed so stale confirmed:true doesn't persist on back-navigation
      setQ({ path: newPath, confirmed: false });
    }
  };

  const handleBack = () => {
    if (path.length > 0) {
      // ponytail: reset confirmed on back so branch node doesn't look answered
      setQ({ path: path.slice(0, -1), confirmed: false });
    }
  };

  const handleKeyDown = (e) => {
    // Sadece kartın kullandığı tuşları yut; → (ileri) ve u/b app navigasyonuna geçsin.
    if (e.key === 'Backspace') {
      e.stopPropagation();
      e.preventDefault();
      handleBack();
    } else if (e.key === 'ArrowLeft') {
      if (path.length > 0) {
        // Ağaç içinde geri: yut
        e.stopPropagation();
        e.preventDefault();
        handleBack();
      }
      // Kökte iken: bubble → app-level ← soruyu geçsin
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      // Yaprak kontrolü: mevcut path bir yaprak ise onayla (patch ile path'i geç).
      if (path.length > 0) {
        const currentNode = getNodeAt(path);
        if (currentNode && isLeafNode(currentNode)) {
          onConfirm(qIndex, { path: path });
        }
      }
    } else {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.stopPropagation();
        e.preventDefault();
        handleSelect(num - 1);
      }
    }
  };

  return (
    <div
      className="tree"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
      role="tree"
      aria-label={q.question}
    >
      {crumbs.length > 0 && (
        <div className="tree__crumbs">
          <button
            className="tree__crumb tree__back"
            type="button"
            onClick={handleBack}
            tabIndex={-1}
            aria-label="Go back"
          >
            ← Geri
          </button>
          {crumbs.map(({ label, depth }) => (
            <button
              key={depth}
              className="tree__crumb"
              type="button"
              tabIndex={-1}
              onClick={() => setQ({ path: path.slice(0, depth + 1), confirmed: false })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="options">
        {children.map((child, i) => {
          const isLeaf = isLeafNode(child);
          return (
            <button
              key={i}
              className="opt"
              type="button"
              data-sel={false}
              data-confirmed={false}
              onClick={() => handleSelect(i)}
              role="treeitem"
              aria-expanded={isLeaf ? undefined : false}
              // M-24: tree dalı number-key (1-9) kısayolu AT'ye bildirilir.
              aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
            >
              <span className="opt__key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="opt__body">
                <span className="opt__label">{child.label}</span>
                {child.description && <span className="opt__desc">{child.description}</span>}
              </span>
              {!isLeaf && (
                <span className="opt__arrow" aria-hidden="true">
                  ›
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── question card dağıtıcı ─────────────────── */
// props: { q, qIndex, ans, motion, dir, onActivate, setQ, onConfirm }
function QuestionCard({ q, qIndex, ans, motion, dir, onActivate, setQ, onConfirm }) {
  const qType =
    typeof AnswerMap !== 'undefined' && AnswerMap.qType
      ? AnswerMap.qType(q)
      : q.type || (q.multiSelect ? 'multi' : 'single');

  let cardBody;
  switch (qType) {
    case 'binary':
      cardBody = <BinaryCard q={q} qIndex={qIndex} ans={ans} onActivate={onActivate} />;
      break;
    case 'scale':
      cardBody = <ScaleCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />;
      break;
    case 'ranking':
      cardBody = <RankingCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />;
      break;
    case 'tree':
      cardBody = <TreeCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />;
      break;
    default: {
      // single / multi — mevcut SelectCard gövdesi
      const opts = fullOptions(q);
      cardBody = (
        <div className="options">
          {opts.map((o, i) => {
            // ponytail: filter stale sel indices on qType degrade (binary→single/multi changes opts length/meaning)
            const sel = ans.sel.includes(i) && i < opts.length;
            const confirmed = ans.confirmed && sel;
            const isCustom = !!o.custom;
            const showCustomVal = isCustom && ans.customText;
            return (
              <button
                key={i}
                className={'opt' + (isCustom ? ' opt--custom' : '')}
                type="button"
                data-sel={sel}
                data-confirmed={confirmed}
                aria-pressed={sel}
                // M-24: number-key (1-9) kısayolu AT'ye bildirilir.
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                onClick={() => onActivate(qIndex, i)}
              >
                <span className="opt__key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="opt__body">
                  <span className="opt__label">
                    {isCustom && showCustomVal ? (
                      <>
                        Other <span className="custom-val">— "{ans.customText}"</span>
                      </>
                    ) : (
                      o.label
                    )}
                  </span>
                  <span className="opt__desc">
                    {isCustom ? (
                      sel ? (
                        <span className="hint-edit">
                          Press <Kbd>{i + 1}</Kbd> or <Kbd>↵</Kbd> to type your own answer.
                        </span>
                      ) : (
                        o.description
                      )
                    ) : (
                      o.description
                    )}
                  </span>
                </span>
                {q.multiSelect ? (
                  <span className="opt__box" aria-hidden="true">
                    {sel && <Check c="#fff" s={12} />}
                  </span>
                ) : (
                  <span className="opt__check" aria-hidden="true">
                    <Check c={confirmed ? 'var(--success)' : 'var(--accent)'} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      );
    }
  }

  // meta metni qType'a göre
  let metaText;
  switch (qType) {
    case 'binary':
      metaText = 'Bir seçenek seçin.';
      break;
    case 'scale':
      metaText = `${q.min ?? 0} – ${q.max ?? 10} arasında bir değer seçin.`;
      break;
    case 'ranking':
      metaText = 'Öğeleri öncelik sırasına göre düzenleyin.';
      break;
    case 'tree':
      metaText = 'Bir dal seçin; yaprak düğüme ulaşınca onaylanır.';
      break;
    default:
      metaText = q.multiSelect
        ? 'Select all that apply. An "Other" choice is always available.'
        : 'Select one option. An "Other" choice is always available.';
  }

  return (
    <div className="qcard" data-motion={motion} data-dir={dir}>
      <div className="qcard__chip">
        <span className="dot" />
        {q.header}
      </div>
      {/* ponytail: h2 avoids multiple h1s; a sr-only h1 lives in the page shell */}
      <h2 className="qcard__q">{q.question}</h2>
      <p className="qcard__meta">{metaText}</p>
      {cardBody}
    </div>
  );
}

/* ─────────────────── custom popup (referans birebir) ─────────────────── */
function CustomPopup({ q, draft, selected, inputRef, onChange, onSave, onRemove, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffectView(() => {
    autosize(inputRef.current);
  }, [draft]);

  // ponytail: focus trap — Tab cycles through focusable children of .popup only
  const popupRef = useRefView(null);
  const FOCUSABLE = 'button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';
  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const el = popupRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll(FOCUSABLE));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const trimmed = (draft || '').trim();
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={trapFocus}
    >
      <div
        className="popup"
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-title"
      >
        <div className="popup__chip">{q.header} · Other</div>
        <div id="popup-title" className="popup__title">
          {q.question}
        </div>
        <textarea
          ref={inputRef}
          className="popup__input"
          rows={1}
          value={draft}
          placeholder="Type your own answer — write as much as you need…"
          onChange={(e) => {
            onChange(e.target.value);
            autosize(e.target);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSave();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <div className="popup__foot">
          <span className="popup__hint">
            <Kbd>↵</Kbd> Save · <Kbd>⇧↵</Kbd> New line · <Kbd>esc</Kbd> Cancel
          </span>
          <div className="popup__actions">
            {selected && (
              <button className="btn btn--danger" type="button" onClick={onRemove}>
                Remove
              </button>
            )}
            <button className="btn" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={onSave}
              disabled={!selected && !trimmed}
            >
              {trimmed ? 'Save answer' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── summary (q.question anahtarı) ─────────────────── */
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted, canSubmit }) {
  const allDone = QUESTIONS.every((q) => answers[q.question]?.confirmed);
  return (
    <div className="summary">
      <div className="summary__chip">
        <Check c="var(--success)" s={12} /> Ready to send
      </div>
      <h2 className="summary__title">Review your answers</h2>
      <p className="summary__sub">
        These get sent back to the agent so it can continue. Edit anything before submitting.
      </p>
      <div className="summary__list">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question] || {};
          const summaryText =
            typeof AnswerMap !== 'undefined' && AnswerMap.summaryText
              ? AnswerMap.summaryText(q, a)
              : (() => {
                  const opts = fullOptions(q);
                  if (!a.sel || a.sel.length === 0) return '';
                  return a.sel
                    .map((s) => {
                      const o = opts[s];
                      return o ? (o.custom ? a.customText : o.label) : '';
                    })
                    .filter(Boolean)
                    .join(', ');
                })();
          return (
            <div className="srow" key={q.question}>
              <div className="srow__head">{q.header}</div>
              <div className="srow__val">
                <div className="srow__q">{q.question}</div>
                <div className="srow__a">
                  {!summaryText ? (
                    <span className="none">No answer yet</span>
                  ) : (
                    <span className="tag">{summaryText}</span>
                  )}
                </div>
              </div>
              <button className="srow__edit" type="button" onClick={() => onEdit(i)}>
                Edit
              </button>
            </div>
          );
        })}
      </div>
      <div className="summary__actions">
        {/* M-24: summary kısayolları (b=geri, ↵=gönder) AT'ye bildirilir (app.js keydown). */}
        <button
          className="btn btn--lg btn--ghost"
          type="button"
          onClick={onBack}
          aria-keyshortcuts="B"
        >
          <Kbd>B</Kbd> Back{allDone ? '' : ' to unanswered'}
        </button>
        <button
          className="btn btn--lg btn--primary"
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitted}
          aria-keyshortcuts="Enter"
        >
          {submitted ? (
            'Submitted ✓'
          ) : canSubmit ? (
            <>
              Submit answers <Kbd>↵</Kbd>
            </>
          ) : (
            'Answer at least one'
          )}
        </button>
      </div>
    </div>
  );
}
